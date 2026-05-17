import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { Driver, Vehicle, Ride, Profile } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ─── Extended Driver type with new columns ──────────────────────

interface DriverFull extends Driver {
  driver_type?: 'conductor' | 'repartidor';
  level?: number;
  total_accepted?: number;
  total_cancelled?: number;
  avg_arrival_minutes?: number;
}

// ─── State interface ────────────────────────────────────────────

interface DriverState {
  // Driver info
  driver: DriverFull | null;
  vehicle: Vehicle | null;
  isOnline: boolean;
  isOnBreak: boolean;
  driverType: 'conductor' | 'repartidor';

  // GPS
  currentLat: number | null;
  currentLng: number | null;
  gpsInterval: ReturnType<typeof setInterval> | null;
  gpsWatchId: number | null;

  // Active ride
  activeRide: Ride | null;

  // Ride queue (incoming rides)
  incomingRides: Ride[];

  // Stats
  todayEarnings: number;
  todayRides: number;
  acceptanceRate: number;

  // Loading flags
  isLoading: boolean;

  // Realtime channel refs for cleanup
  _rideChannel: RealtimeChannel | null;
  _incomingChannel: RealtimeChannel | null;

  // Actions
  fetchDriver: (userId: string) => Promise<void>;
  goOnline: (userId: string) => Promise<void>;
  goOffline: (userId: string) => Promise<void>;
  toggleBreak: (userId: string, onBreak: boolean) => Promise<void>;
  startGpsTracking: (userId: string) => void;
  stopGpsTracking: () => void;
  acceptRide: (rideId: string, driverId: string) => Promise<void>;
  updateRideStatus: (rideId: string, status: string, driverId: string) => Promise<void>;
  completeRide: (rideId: string, driverId: string, riderId: string, amount: number) => Promise<void>;
  fetchIncomingRides: (driverId: string, driverType: string) => Promise<void>;
  fetchActiveRide: (driverId: string) => Promise<void>;
  fetchTodayStats: (driverId: string) => Promise<void>;
  declineRide: (rideId: string) => void;
  cleanup: () => void;
}

// ─── GPS tracking interval (10 seconds) ─────────────────────────

const GPS_INTERVAL_MS = 10_000;

// ─── Store ──────────────────────────────────────────────────────

export const useDriverStore = create<DriverState>((set, get) => ({
  // ── Initial state ──
  driver: null,
  vehicle: null,
  isOnline: false,
  isOnBreak: false,
  driverType: 'conductor',

  currentLat: null,
  currentLng: null,
  gpsInterval: null,
  gpsWatchId: null,

  activeRide: null,
  incomingRides: [],

  todayEarnings: 0,
  todayRides: 0,
  acceptanceRate: 0,

  isLoading: false,

  _rideChannel: null,
  _incomingChannel: null,

  // ──────────────────────────────────────────────────────────────
  // fetchDriver — joins drivers + vehicles + profiles
  // ──────────────────────────────────────────────────────────────
  fetchDriver: async (userId: string) => {
    set({ isLoading: true });
    try {
      const { data: driverData, error: driverError } = await supabase
        .from('drivers')
        .select(`
          *,
          profiles:user_id (id, name, email, phone, avatar, is_verified, is_active, role),
          vehicles:vehicles (id, driver_id, plate, model, color, year, verified)
        `)
        .eq('user_id', userId)
        .single();

      if (driverError) {
        console.warn('[DriverStore] fetchDriver error:', driverError.message);
        set({ isLoading: false });
        return;
      }

      const driver = driverData as unknown as DriverFull;
      const profile = (driverData as any).profiles as Profile | undefined;
      const vehicle = (driverData as any).vehicles as Vehicle | undefined;

      // Merge profile into driver for convenience
      if (profile) {
        (driver as any).profiles = profile;
      }

      set({
        driver,
        vehicle: vehicle || null,
        isOnline: driver.status === 'online' || driver.status === 'busy',
        isOnBreak: driver.is_on_break ?? false,
        driverType: (driver.driver_type as 'conductor' | 'repartidor') || 'conductor',
        isLoading: false,
      });
    } catch (err) {
      console.error('[DriverStore] fetchDriver error:', err);
      set({ isLoading: false });
    }
  },

  // ──────────────────────────────────────────────────────────────
  // goOnline — call POST /api/drivers/toggle-status
  // ──────────────────────────────────────────────────────────────
  goOnline: async (userId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const { currentLat, currentLng } = get();

      const body: Record<string, unknown> = { status: 'online' };
      if (currentLat != null && currentLng != null) {
        body.latitude = currentLat;
        body.longitude = currentLng;
      }

      const res = await fetch('/api/drivers/toggle-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error((errData as any).error || 'Error al conectarse');
      }

      set({ isOnline: true });
      get().startGpsTracking(userId);
    } catch (err) {
      console.error('[DriverStore] goOnline error:', err);
      throw err;
    }
  },

  // ──────────────────────────────────────────────────────────────
  // goOffline — call POST /api/drivers/toggle-status
  // ──────────────────────────────────────────────────────────────
  goOffline: async (userId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const { currentLat, currentLng } = get();

      const body: Record<string, unknown> = { status: 'offline' };
      if (currentLat != null && currentLng != null) {
        body.latitude = currentLat;
        body.longitude = currentLng;
      }

      const res = await fetch('/api/drivers/toggle-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error((errData as any).error || 'Error al desconectarse');
      }

      set({ isOnline: false });
      get().stopGpsTracking();
    } catch (err) {
      console.error('[DriverStore] goOffline error:', err);
      throw err;
    }
  },

  // ──────────────────────────────────────────────────────────────
  // toggleBreak — update drivers.is_on_break
  // ──────────────────────────────────────────────────────────────
  toggleBreak: async (userId: string, onBreak: boolean) => {
    try {
      // Check if break feature is enabled
      const { data: setting } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'driver_break_enabled')
        .single();

      if (setting && setting.value === 'false') {
        throw new Error('La funcion de pausa esta deshabilitada');
      }

      // Check max break minutes
      const { data: maxBreakSetting } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'driver_max_break_minutes')
        .single();

      if (onBreak && maxBreakSetting) {
        const maxMinutes = Number(maxBreakSetting.value) || 30;
        // maxMinutes validation — the frontend timer should enforce this
        console.log(`[DriverStore] Break enabled, max ${maxMinutes} minutes`);
      }

      const { error } = await supabase
        .from('drivers')
        .update({ is_on_break: onBreak })
        .eq('user_id', userId);

      if (error) {
        throw new Error('Error al actualizar estado de pausa');
      }

      set({ isOnBreak: onBreak });
    } catch (err) {
      console.error('[DriverStore] toggleBreak error:', err);
      throw err;
    }
  },

  // ──────────────────────────────────────────────────────────────
  // startGpsTracking — uses navigator.geolocation.watchPosition
  //   with 10s interval, calls POST /api/drivers/update-location
  // ──────────────────────────────────────────────────────────────
  startGpsTracking: (userId: string) => {
    const state = get();

    // Already tracking
    if (state.gpsWatchId !== null || state.gpsInterval !== null) return;

    if (!navigator?.geolocation) {
      console.warn('[DriverStore] Geolocation not available');
      return;
    }

    // Get initial position
    navigator.geolocation.getCurrentPosition(
      (position) => {
        set({
          currentLat: position.coords.latitude,
          currentLng: position.coords.longitude,
        });
        // Send first location immediately
        get()._sendLocation(userId, position.coords.latitude, position.coords.longitude);
      },
      (err) => {
        console.warn('[DriverStore] getCurrentPosition error:', err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );

    // Watch position for continuous updates
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        set({
          currentLat: position.coords.latitude,
          currentLng: position.coords.longitude,
        });
      },
      (err) => {
        console.warn('[DriverStore] watchPosition error:', err.message);
      },
      { enableHighAccuracy: true, maximumAge: 5000 }
    );

    set({ gpsWatchId: watchId });

    // Also set a 10s interval to batch-send location to server
    // (watchPosition fires frequently but we only POST every 10s)
    const interval = setInterval(() => {
      const s = get();
      if (s.currentLat != null && s.currentLng != null) {
        get()._sendLocation(userId, s.currentLat, s.currentLng);
      }
    }, GPS_INTERVAL_MS);

    set({ gpsInterval: interval });
  },

  // ──────────────────────────────────────────────────────────────
  // _sendLocation — internal helper to POST GPS to server
  // ──────────────────────────────────────────────────────────────
  _sendLocation: async (userId: string, lat: number, lng: number) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      await fetch('/api/drivers/update-location', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ latitude: lat, longitude: lng }),
      });
    } catch {
      // Silent — GPS sends are best-effort
    }
  },

  // ──────────────────────────────────────────────────────────────
  // stopGpsTracking — clear watch + interval
  // ──────────────────────────────────────────────────────────────
  stopGpsTracking: () => {
    const state = get();

    if (state.gpsWatchId !== null && navigator?.geolocation) {
      navigator.geolocation.clearWatch(state.gpsWatchId);
      set({ gpsWatchId: null });
    }

    if (state.gpsInterval !== null) {
      clearInterval(state.gpsInterval);
      set({ gpsInterval: null });
    }
  },

  // ──────────────────────────────────────────────────────────────
  // acceptRide — set rides.driver_id, status='assigned',
  //   set accepted_at=NOW()
  // ──────────────────────────────────────────────────────────────
  acceptRide: async (rideId: string, driverId: string) => {
    try {
      const { error } = await supabase
        .from('rides')
        .update({
          driver_id: driverId,
          status: 'assigned',
          accepted_at: new Date().toISOString(),
        })
        .eq('id', rideId)
        .is('driver_id', null); // Only if not already assigned

      if (error) {
        throw new Error('No se pudo aceptar el viaje');
      }

      // Remove from incoming rides
      set((s) => ({
        incomingRides: s.incomingRides.filter((r) => r.id !== rideId),
      }));

      // Fetch the full ride with rider info and set as active
      const { data: ride, error: rideErr } = await supabase
        .from('rides')
        .select('*, profiles:rider_id (id, name, phone, avatar)')
        .eq('id', rideId)
        .single();

      if (!rideErr && ride) {
        set({ activeRide: ride as unknown as Ride });
      }

      // Set driver status to busy
      await supabase
        .from('drivers')
        .update({ status: 'busy' })
        .eq('id', driverId);
    } catch (err) {
      console.error('[DriverStore] acceptRide error:', err);
      throw err;
    }
  },

  // ──────────────────────────────────────────────────────────────
  // updateRideStatus — set arriving_at/started_at/completed_at
  //   based on status
  // ──────────────────────────────────────────────────────────────
  updateRideStatus: async (rideId: string, status: string, driverId: string) => {
    try {
      const updateData: Record<string, unknown> = { status };

      // Set the appropriate timestamp
      if (status === 'arriving') {
        updateData.arriving_at = new Date().toISOString();
      } else if (status === 'started') {
        updateData.started_at = new Date().toISOString();
      } else if (status === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('rides')
        .update(updateData)
        .eq('id', rideId)
        .eq('driver_id', driverId);

      if (error) {
        throw new Error('Error al actualizar estado del viaje');
      }

      // Update local activeRide
      set((s) => ({
        activeRide: s.activeRide
          ? { ...s.activeRide, status: status as Ride['status'], ...updateData }
          : null,
      }));

      // Set driver back to online after completion
      if (status === 'completed' || status === 'cancelled') {
        await supabase
          .from('drivers')
          .update({ status: 'online' })
          .eq('id', driverId);

        // Clear active ride after completion
        if (status === 'completed') {
          set({ activeRide: null });
        }
      }
    } catch (err) {
      console.error('[DriverStore] updateRideStatus error:', err);
      throw err;
    }
  },

  // ──────────────────────────────────────────────────────────────
  // completeRide — call update_driver_stats RPC, credit wallet,
  //   create transaction
  // ──────────────────────────────────────────────────────────────
  completeRide: async (rideId: string, driverId: string, riderId: string, amount: number) => {
    try {
      // 1. Get commission settings
      const { data: commissionSettings } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['commission_percentage', 'base_fee']);

      const commissionPct = Number(
        commissionSettings?.find((s: any) => s.key === 'commission_percentage')?.value || 15
      );
      const baseFee = Number(
        commissionSettings?.find((s: any) => s.key === 'base_fee')?.value || 0
      );
      const commission = Math.round(amount * commissionPct / 100) + baseFee;
      const driverEarnings = Math.max(0, amount - commission);

      // 2. Update ride status with completed_at and earnings
      const { error: rideError } = await supabase
        .from('rides')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          driver_earnings: driverEarnings,
          commission_rate: commissionPct,
          commission,
          payment_status: 'completed',
        })
        .eq('id', rideId);

      if (rideError) {
        throw new Error('Error al completar el viaje');
      }

      // 3. Call update_driver_stats RPC
      try {
        await supabase.rpc('update_driver_stats', { p_ride_id: rideId });
      } catch (rpcErr) {
        console.warn('[DriverStore] update_driver_stats RPC failed:', rpcErr);
      }

      // Also increment the standard stats RPC (backward compat)
      try {
        await supabase.rpc('increment_driver_stats', {
          p_driver_id: driverId,
          p_earnings: driverEarnings,
        });
      } catch {
        // Ignore — old RPC may not exist
      }

      // 4. Credit driver wallet
      const { data: driverWallet } = await supabase
        .from('wallets')
        .select('id, balance, total_earnings')
        .eq('user_id', riderId ? undefined : driverId)
        .eq('user_id', driverId)
        .single();

      if (driverWallet) {
        const newBalance = (driverWallet.balance || 0) + driverEarnings;
        const newTotalEarnings = (driverWallet.total_earnings || 0) + driverEarnings;

        await supabase
          .from('wallets')
          .update({
            balance: newBalance,
            total_earnings: newTotalEarnings,
          })
          .eq('id', driverWallet.id);

        // 5. Create transaction
        await supabase.from('transactions').insert({
          wallet_id: driverWallet.id,
          amount: driverEarnings,
          type: 'credit',
          status: 'completed',
          description: `Ganancia viaje #${rideId.slice(0, 8).toUpperCase()}`,
          ride_id: rideId,
        });
      }

      // 6. Set driver back to online
      await supabase
        .from('drivers')
        .update({ status: 'online' })
        .eq('id', driverId);

      // 7. Clear active ride
      set({ activeRide: null });

      // 8. Refresh today stats
      const driver = get().driver;
      if (driver) {
        get().fetchTodayStats(driver.id);
      }
    } catch (err) {
      console.error('[DriverStore] completeRide error:', err);
      throw err;
    }
  },

  // ──────────────────────────────────────────────────────────────
  // fetchIncomingRides — query rides with status='searching'
  //   within driver's service type
  // ──────────────────────────────────────────────────────────────
  fetchIncomingRides: async (driverId: string, driverType: string) => {
    try {
      // Check if ride type filter is enabled
      const { data: filterSetting } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'driver_ride_type_filter')
        .single();

      let query = supabase
        .from('rides')
        .select('*, profiles:rider_id (id, name, phone, avatar)')
        .eq('status', 'searching')
        .order('created_at', { ascending: false })
        .limit(10);

      // Apply ride type filter if enabled
      if (filterSetting?.value !== 'false') {
        // If driver is a repartidor, only show delivery-type rides
        if (driverType === 'repartidor') {
          query = query.eq('ride_type', 'moto_express');
        }
        // Conductors see all except moto_express
        else {
          query = query.neq('ride_type', 'moto_express');
        }
      }

      const { data, error } = await query;

      if (!error && data) {
        // Only show rides not already in local state and not declined
        const existingIds = new Set(get().incomingRides.map((r) => r.id));
        const newRides = (data as unknown as Ride[]).filter((r) => !existingIds.has(r.id));
        set({ incomingRides: [...get().incomingRides, ...newRides] });
      }
    } catch (err) {
      console.error('[DriverStore] fetchIncomingRides error:', err);
    }
  },

  // ──────────────────────────────────────────────────────────────
  // fetchActiveRide — get current ride for this driver
  // ──────────────────────────────────────────────────────────────
  fetchActiveRide: async (driverId: string) => {
    try {
      const { data, error } = await supabase
        .from('rides')
        .select('*, profiles:rider_id (id, name, phone, avatar)')
        .eq('driver_id', driverId)
        .in('status', ['assigned', 'arriving', 'started'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        set({ activeRide: data as unknown as Ride });
      } else {
        set({ activeRide: null });
      }
    } catch (err) {
      console.error('[DriverStore] fetchActiveRide error:', err);
    }
  },

  // ──────────────────────────────────────────────────────────────
  // fetchTodayStats — rides completed today, sum earnings,
  //   calc acceptance rate from total_accepted/total_cancelled
  // ──────────────────────────────────────────────────────────────
  fetchTodayStats: async (driverId: string) => {
    try {
      // Get driver record for total_accepted and total_cancelled
      const { data: driver } = await supabase
        .from('drivers')
        .select('total_accepted, total_cancelled')
        .eq('id', driverId)
        .single();

      const totalAccepted = (driver as any)?.total_accepted || 0;
      const totalCancelled = (driver as any)?.total_cancelled || 0;
      const total = totalAccepted + totalCancelled;
      const acceptanceRate = total > 0 ? Math.round((totalAccepted / total) * 100) : 0;

      // Get today's completed rides and earnings
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      const { data: todayRides, error } = await supabase
        .from('rides')
        .select('driver_earnings, created_at')
        .eq('driver_id', driverId)
        .eq('status', 'completed')
        .gte('created_at', todayISO);

      if (!error && todayRides) {
        const earnings = todayRides.reduce((sum: number, r: any) => {
          return sum + (r.driver_earnings || 0);
        }, 0);

        set({
          todayEarnings: earnings,
          todayRides: todayRides.length,
          acceptanceRate,
        });
      } else {
        set({
          todayEarnings: 0,
          todayRides: 0,
          acceptanceRate,
        });
      }

      // Also update local driver stats
      const currentDriver = get().driver;
      if (currentDriver && driver) {
        set({
          driver: {
            ...currentDriver,
            total_accepted: totalAccepted,
            total_cancelled: totalCancelled,
          },
        });
      }
    } catch (err) {
      console.error('[DriverStore] fetchTodayStats error:', err);
    }
  },

  // ──────────────────────────────────────────────────────────────
  // declineRide — remove from incomingRides local state only
  // ──────────────────────────────────────────────────────────────
  declineRide: (rideId: string) => {
    set((s) => ({
      incomingRides: s.incomingRides.filter((r) => r.id !== rideId),
    }));
  },

  // ──────────────────────────────────────────────────────────────
  // cleanup — clear all intervals, unsubscribe realtime
  // ──────────────────────────────────────────────────────────────
  cleanup: () => {
    const state = get();

    // Stop GPS
    get().stopGpsTracking();

    // Remove realtime channels
    if (state._rideChannel) {
      supabase.removeChannel(state._rideChannel);
      set({ _rideChannel: null });
    }

    if (state._incomingChannel) {
      supabase.removeChannel(state._incomingChannel);
      set({ _incomingChannel: null });
    }

    // Reset state
    set({
      driver: null,
      vehicle: null,
      isOnline: false,
      isOnBreak: false,
      currentLat: null,
      currentLng: null,
      activeRide: null,
      incomingRides: [],
      todayEarnings: 0,
      todayRides: 0,
      acceptanceRate: 0,
      isLoading: false,
    });
  },
}));
