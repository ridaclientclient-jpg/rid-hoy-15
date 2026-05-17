import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { Ride, PaymentMethodType } from '@/lib/supabase';

// Haversine distance in km between two coordinates
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export type RideStatus = 'searching' | 'assigned' | 'arriving' | 'started' | 'completed' | 'cancelled' | 'scheduled';

export interface UnratedRide {
  rideId: string;
  driverName: string;
  driverId: string;
}

interface RideState {
  currentRide: (Ride & { driver_name?: string; driver_phone?: string; driver_vehicle?: string; driver_rating?: number; stops?: Array<{ address: string; lat?: number; lng?: number }>; scheduled_at?: string; is_scheduled?: boolean }) | null;
  rideHistory: (Ride & { driver_name?: string; driver_vehicle?: string })[];
  isCreating: boolean;
  availableDrivers: Array<{ id: string; name: string; vehicle: string; rating: number; distance: number; eta: number }>;
  lastCompletedUnratedRide: UnratedRide | null;

  createRide: (origin: string, destination: string, originLat?: number, originLng?: number, destLat?: number, destLng?: number, rideType?: string, stops?: Array<{ address: string; lat?: number; lng?: number }>, paymentMethod?: PaymentMethodType, paymentExtra?: { cardLastFour?: string; sinpePhone?: string }, scheduledAt?: string) => Promise<string | null>;
  cancelRide: (rideId: string, reason?: string) => Promise<void>;
  completeRide: (rideId: string) => Promise<void>;
  fetchRideHistory: (userId: string) => Promise<void>;
  subscribeToRideUpdates: (rideId: string) => () => void;
  searchNearbyDrivers: (lat: number, lng: number) => Promise<void>;
  markRideAsRated: (rideId: string) => void;
}

const DEMO_DRIVERS = []; // Demo drivers removed — using REAL matching

export const useRideStore = create<RideState>((set, get) => ({
  currentRide: null,
  rideHistory: [],
  isCreating: false,
  availableDrivers: [],
  lastCompletedUnratedRide: null,

  createRide: async (origin, destination, originLat, originLng, destLat, destLng, rideType = 'standard', stops = [], paymentMethod = 'cash', paymentExtra = {}, scheduledAt) => {
    set({ isCreating: true });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        set({ isCreating: false });
        return null;
      }

      // Use RPC to calculate REAL fare with haversine distance from settings
      let fareResult: any = null;
      if (originLat && originLng && destLat && destLng) {
        const { data: rpcData, error: rpcError } = await supabase.rpc('calculate_fare_estimate', {
          p_origin_lat: originLat,
          p_origin_lng: originLng,
          p_dest_lat: destLat,
          p_dest_lng: destLng,
          p_ride_type: rideType,
        });
        if (!rpcError && rpcData) {
          fareResult = Array.isArray(rpcData) ? rpcData[0] : rpcData;
        }
      }

      const distance = fareResult ? Number(fareResult.estimated_distance) : (originLat && destLat ? haversineDistance(originLat, originLng, destLat, destLng) : 5);
      const price = fareResult ? Number(fareResult.estimated_price) : 1500;
      const duration = fareResult ? Number(fareResult.estimated_duration) : Math.round(distance * 3);
      const etaMinutes = fareResult ? Number(fareResult.eta_to_pickup) : 5;
      const stopExtra = stops.length * 2;
      const finalDistance = distance + stopExtra;

      // Check wallet balance if paying with wallet
      if (paymentMethod === 'wallet') {
        const { data: walletData } = await supabase
          .from('wallets')
          .select('balance')
          .eq('user_id', user.id)
          .single();

        if (!walletData || walletData.balance < price) {
          set({ isCreating: false });
          throw new Error('Saldo insuficiente en tu billetera para este viaje');
        }
      }

      // Check if this is a scheduled ride
      const isScheduled = !!scheduledAt;

      // Build the ride data — try full insert first (with ride_type + stops + payment)
      const fullInsert: Record<string, any> = {
        rider_id: user.id,
        status: isScheduled ? 'scheduled' : 'searching',
        origin,
        origin_lat: originLat,
        origin_lng: originLng,
        destination,
        dest_lat: destLat,
        dest_lng: destLng,
        price,
        distance: finalDistance,
        duration,
        payment_method: paymentMethod,
        payment_status: 'pending',
        card_last_four: paymentExtra.cardLastFour || null,
        sinpe_phone: paymentExtra.sinpePhone || null,
        scheduled_at: scheduledAt || null,
        is_scheduled: isScheduled,
        fare_estimate: fareResult ? Number(fareResult.estimated_price) : null,
        eta_minutes: etaMinutes,
      };

      let ride: any = null;
      let insertError: any = null;

      // Attempt 1: Insert with ride_type and stops columns
      try {
        const result = await supabase
          .from('rides')
          .insert({
            ...fullInsert,
            ride_type: rideType,
            stops: stops.length > 0 ? JSON.stringify(stops) : null,
          })
          .select()
          .single();
        ride = result.data;
        insertError = result.error;
      } catch (e) {
        insertError = e;
      }

      // Attempt 2: If failed (likely missing columns), retry without ride_type and stops
      if (insertError && (insertError.message?.includes('ride_type') || insertError.message?.includes('stops') || insertError.code === '42P01' || insertError.code === '42703')) {
        console.warn('ride_type/stops columns missing, retrying without them...');
        try {
          const result2 = await supabase
            .from('rides')
            .insert(fullInsert)
            .select()
            .single();
          ride = result2.data;
          insertError = result2.error;
        } catch (e) {
          insertError = e;
        }
      }

      if (insertError || !ride) {
        throw new Error(insertError?.message || 'No se pudo crear el viaje');
      }

      const rideWithDriver = {
        ...ride,
        driver_name: undefined,
        driver_phone: undefined,
        driver_vehicle: undefined,
        driver_rating: undefined,
        stops: stops.length > 0 ? stops : undefined,
        ride_type: rideType,
        payment_method: paymentMethod,
        payment_status: 'pending',
        card_last_four: paymentExtra.cardLastFour || null,
        sinpe_phone: paymentExtra.sinpePhone || null,
        scheduled_at: scheduledAt || undefined,
        is_scheduled: isScheduled,
      };

      set({ currentRide: rideWithDriver, isCreating: false });

      // Subscribe to real-time updates
      get().subscribeToRideUpdates(ride.id);

      // ─── PROGRESSIVE DRIVER MATCHING ───
      if (!isScheduled) {
        let retryCount = 0;
        const searchStages = [
          { radius: 3, wait: 0 },      // 0s: Start at 3km
          { radius: 5, wait: 10000 },  // 10s: Expand to 5km
          { radius: 8, wait: 10000 },  // 20s: Expand to 8km
          { radius: 12, wait: 10000 }, // 30s: Expand to 12km
          { radius: 20, wait: 10000 }  // 40s: Max 20km (Rural/Final)
        ];

        const attemptMatch = async (stageIndex: number) => {
          const state = get();
          // Stop if ride is no longer searching (cancelled or assigned)
          if (!state.currentRide || state.currentRide.id !== ride.id || state.currentRide.status !== 'searching') return;

          const stage = searchStages[stageIndex];
          console.log(`[Matching] Stage ${stageIndex + 1}: Searching in ${stage.radius}km...`);

          try {
            const matchRes = await fetch('/api/rides/match', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                ride_id: ride.id, 
                radius_km: stage.radius,
                stage: stageIndex + 1
              }),
            });
            const matchData = await matchRes.json();
            
            // If match found, the real-time subscription will update the UI
            if (matchData.success && matchData.driver) {
              console.log(`[Matching] Success! Driver ${matchData.driver.name} assigned.`);
              return; 
            }
          } catch (err) {
            console.error(`[Matching] Attempt error:`, err);
          }

          // Expand to next stage if available
          if (stageIndex < searchStages.length - 1) {
            setTimeout(() => attemptMatch(stageIndex + 1), searchStages[stageIndex + 1].wait);
          } else {
            console.warn('[Matching] No drivers found after full expansion.');
          }
        };

        // Initial delay to let the UI settle
        setTimeout(() => attemptMatch(0), 1000);
      }

      return ride.id;
    } catch (error: any) {
      console.error('Create ride error:', error);
      set({ isCreating: false });
      throw error;
    }
  },

  cancelRide: async (rideId: string, reason?: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        const res = await fetch('/api/rides/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ ride_id: rideId, reason: reason || null }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al cancelar');
        const fee = data.fee_applied || 0;
        if (fee > 0) {
          console.warn(`Cancellation fee applied: ₡${fee}`);
        }
      } else {
        // Fallback: direct DB update without auth
        const cancelPayload: Record<string, any> = {
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancelled_by: (await supabase.auth.getUser()).data.user?.id || null,
        };
        if (reason) cancelPayload.cancellation_reason = reason;
        await supabase.from('rides').update(cancelPayload).eq('id', rideId);
      }
      const state = get();
      if (state.currentRide) {
        set({
          rideHistory: [...state.rideHistory, { ...state.currentRide, status: 'cancelled' } as any],
          currentRide: null,
        });
      }
    } catch (error) {
      console.error('Cancel ride error:', error);
      throw error;
    }
  },

  completeRide: async (rideId: string) => {
    try {
      const state = get();
      const ride = state.currentRide;

      // Fetch commission settings from DB
      const { data: commissionSettings } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['commission_percentage', 'base_fee']);

      const commissionPct = Number(commissionSettings?.find((s: any) => s.key === 'commission_percentage')?.value || 15);
      const baseFee = Number(commissionSettings?.find((s: any) => s.key === 'base_fee')?.value || 0);
      const price = ride?.price || 0;
      const commission = Math.round(price * commissionPct / 100) + baseFee;
      const driverEarnings = Math.max(0, price - commission);

      // Process payment based on payment method
      const paymentMethod = (ride as any)?.payment_method || 'cash';
      const riderId = ride?.rider_id;
      const driverId = ride?.driver_id;

      if (paymentMethod === 'wallet' && riderId) {
        /* ── WALLET PAYMENT ── */
        // Deduct from rider's wallet
        const { data: riderWallet } = await supabase
          .from('wallets')
          .select('id, balance')
          .eq('user_id', riderId)
          .single();

        if (riderWallet && riderWallet.balance >= price) {
          // Deduct from rider
          await supabase
            .from('wallets')
            .update({ balance: riderWallet.balance - price })
            .eq('id', riderWallet.id);

          // Record rider transaction
          await supabase.from('transactions').insert({
            wallet_id: riderWallet.id,
            amount: -price,
            type: 'ride_payment',
            status: 'completed',
            description: `Pago viaje #${rideId.slice(0, 8).toUpperCase()} — Billetera RIDA`,
          });
        }

        // Credit driver's wallet (minus commission)
        if (driverId) {
          const { data: driverWallet } = await supabase
            .from('wallets')
            .select('id, balance')
            .eq('user_id', driverId)
            .single();

          if (driverWallet) {
            await supabase
              .from('wallets')
              .update({
                balance: driverWallet.balance + driverEarnings,
                total_earnings: (driverWallet.total_earnings || 0) + driverEarnings,
              })
              .eq('id', driverWallet.id);

            await supabase.from('transactions').insert({
              wallet_id: driverWallet.id,
              amount: driverEarnings,
              type: 'credit',
              status: 'completed',
              description: `Ganancia viaje #${rideId.slice(0, 8).toUpperCase()}`,
            });
          }
        }
      } else if (paymentMethod === 'cash' && driverId) {
        /* ── CASH PAYMENT ── */
        // Credit driver's wallet with full amount (minus commission) when they confirm cash
        const { data: driverWallet } = await supabase
          .from('wallets')
          .select('id, balance')
          .eq('user_id', driverId)
          .single();

        if (driverWallet) {
          await supabase
            .from('wallets')
            .update({
              balance: driverWallet.balance + driverEarnings,
              total_earnings: (driverWallet.total_earnings || 0) + driverEarnings,
            })
            .eq('id', driverWallet.id);

          await supabase.from('transactions').insert({
            wallet_id: driverWallet.id,
            amount: driverEarnings,
            type: 'credit',
            status: 'completed',
            description: `Ganancia viaje (efectivo) #${rideId.slice(0, 8).toUpperCase()}`,
          });
        }
      } else if (paymentMethod === 'card' || paymentMethod === 'sinpe') {
        /* ── CARD / SINPE — mark as processing (real integration pending) ── */
        if (driverId) {
          const { data: driverWallet } = await supabase
            .from('wallets')
            .select('id, balance')
            .eq('user_id', driverId)
            .single();

          if (driverWallet) {
            await supabase
              .from('wallets')
              .update({
                balance: driverWallet.balance + driverEarnings,
                total_earnings: (driverWallet.total_earnings || 0) + driverEarnings,
              })
              .eq('id', driverWallet.id);

            const methodLabel = paymentMethod === 'card' ? 'tarjeta' : 'SINPE';
            await supabase.from('transactions').insert({
              wallet_id: driverWallet.id,
              amount: driverEarnings,
              type: 'credit',
              status: 'completed',
              description: `Ganancia viaje (${methodLabel}) #${rideId.slice(0, 8).toUpperCase()}`,
            });
          }
        }
      }

      // Update ride status with commission breakdown
      await supabase.from('rides').update({
        status: 'completed',
        driver_earnings: driverEarnings,
        commission_rate: commissionPct,
        commission: commission,
        payment_status: 'completed',
      }).eq('id', rideId);

      if (state.currentRide) {
        // Save unrated ride info before clearing currentRide
        const unratedRide: UnratedRide = {
          rideId: ride.id,
          driverName: state.currentRide.driver_name || '',
          driverId: state.currentRide.driver_id || '',
        };
        set({
          rideHistory: [...state.rideHistory, { ...state.currentRide, status: 'completed' } as any],
          currentRide: null,
          lastCompletedUnratedRide: unratedRide,
        });
      }
    } catch (error) {
      console.error('Complete ride error:', error);
    }
  },

  fetchRideHistory: async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('rides')
        .select('*')
        .eq('rider_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (!error && data) {
        set({ rideHistory: data as any });
      }
    } catch (error) {
      console.error('Fetch history error:', error);
    }
  },

  subscribeToRideUpdates: (rideId: string) => {
    const channel = supabase
      .channel(`ride-${rideId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'rides',
        filter: `id=eq.${rideId}`,
      }, async (payload) => {
        const state = get();
        if (state.currentRide?.id === rideId) {
          const updatedRide = payload.new as any;
          
          // If driver was just assigned, fetch their details
          if (updatedRide.driver_id && !state.currentRide.driver_name) {
            try {
              const { data: driverData } = await supabase
                .from('drivers')
                .select('rating, profiles(name, phone), vehicles(model, color, plate)')
                .eq('id', updatedRide.driver_id)
                .single();
              
              if (driverData) {
                updatedRide.driver_name = (driverData.profiles as any)?.name;
                updatedRide.driver_phone = (driverData.profiles as any)?.phone;
                updatedRide.driver_vehicle = driverData.vehicles 
                  ? `${(driverData.vehicles as any).model} ${(driverData.vehicles as any).color}`
                  : 'Vehículo';
                updatedRide.driver_rating = driverData.rating;
              }
            } catch (err) {
              console.error('Error fetching driver details on update:', err);
            }
          }

          set({ currentRide: { ...state.currentRide, ...updatedRide } });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  markRideAsRated: (rideId: string) => {
    const state = get();
    if (state.lastCompletedUnratedRide?.rideId === rideId) {
      set({ lastCompletedUnratedRide: null });
    }
  },

  searchNearbyDrivers: async (lat: number, lng: number) => {
    try {
      const { data } = await supabase
        .from('drivers')
        .select('id, rating, current_lat, current_lng, profiles(name, phone), vehicles(model, color, plate)')
        .eq('status', 'online')
        .eq('is_verified', true)
        .not('current_lat', 'is', null)
        .not('current_lng', 'is', null);

      if (data && data.length > 0) {
        const R = 6371;
        const driversWithDist = data.map((d: any) => {
          const dLat = ((d.current_lat - lat) * Math.PI) / 180;
          const dLng = ((d.current_lng - lng) * Math.PI) / 180;
          const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat * Math.PI) / 180) * Math.cos((d.current_lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
          const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          return {
            id: d.id,
            name: d.profiles?.name || 'Conductor',
            vehicle: d.vehicles ? `${d.vehicles.model} ${d.vehicles.color}` : 'Vehiculo',
            rating: d.rating || 5.0,
            distance: Math.round(dist * 10) / 10,
            eta: Math.max(1, Math.round((dist / 30) * 60)),
          };
        }).sort((a: any, b: any) => a.distance - b.distance).slice(0, 10);
        set({ availableDrivers: driversWithDist });
      } else {
        set({ availableDrivers: [] });
      }
    } catch (error) {
      console.error('Search drivers error:', error);
    }
  },
}));
