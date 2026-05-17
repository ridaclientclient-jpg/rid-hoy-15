import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

interface DriverLocation {
  driverId: string;
  lat: number;
  lng: number;
  timestamp: number;
  heading?: number;
  speed?: number;
}

interface RealtimeState {
  /** Driver locations being tracked (keyed by driverId) */
  driverLocations: Map<string, DriverLocation>;
  /** Whether we're subscribed to driver location updates */
  isTrackingDriver: boolean;

  /** Start tracking a driver's live location (for client ride view) */
  startDriverTracking: (driverId: string, onUpdate?: (loc: DriverLocation) => void) => () => void;
  /** Stop tracking a driver */
  stopDriverTracking: (driverId: string) => void;
  /** Get current driver location */
  getDriverLocation: (driverId: string) => DriverLocation | undefined;
  /** Subscribe to new rides for drivers (for driver ride requests) */
  subscribeToNewRides: (driverUserId: string, onNewRide: (ride: any) => void) => () => void;
  /** Subscribe to SOS events (for admin) */
  subscribeToSOSUpdates: (onSOS: (sos: any) => void) => () => void;
  /** Subscribe to ride status changes for admin */
  subscribeToAllRides: (onRideChange: (ride: any) => void) => () => void;
}

const driverTrackingChannels = new Map<string, ReturnType<typeof supabase.channel>>();
const activeCallbacks = new Map<string, Set<(loc: DriverLocation) => void>>();

export const useRealtimeStore = create<RealtimeState>((set, get) => ({
  driverLocations: new Map(),
  isTrackingDriver: false,

  startDriverTracking: (driverId: string, onUpdate?: (loc: DriverLocation) => void) => {
    // Don't duplicate
    if (driverTrackingChannels.has(driverId)) {
      if (onUpdate) {
        const cbs = activeCallbacks.get(driverId) || new Set();
        cbs.add(onUpdate);
        activeCallbacks.set(driverId, cbs);
      }
      return () => {
        if (onUpdate) {
          const cbs = activeCallbacks.get(driverId);
          if (cbs) {
            cbs.delete(onUpdate);
            if (cbs.size === 0) activeCallbacks.delete(driverId);
          }
        }
      };
    }

    if (onUpdate) {
      const cbs = activeCallbacks.get(driverId) || new Set();
      cbs.add(onUpdate);
      activeCallbacks.set(driverId, cbs);
    }

    // Subscribe to driver location updates via postgres_changes
    const channel = supabase
      .channel(`driver-location-${driverId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'drivers',
          filter: `id=eq.${driverId}`,
        },
        (payload) => {
          const newDriver = payload.new as any;
          if (newDriver.current_lat && newDriver.current_lng) {
            const location: DriverLocation = {
              driverId,
              lat: newDriver.current_lat,
              lng: newDriver.current_lng,
              timestamp: Date.now(),
              heading: newDriver.heading,
              speed: newDriver.speed,
            };

            set((state) => {
              const newMap = new Map(state.driverLocations);
              newMap.set(driverId, location);
              return { driverLocations: newMap, isTrackingDriver: true };
            });

            // Fire callbacks
            const cbs = activeCallbacks.get(driverId);
            if (cbs) cbs.forEach(cb => cb(location));
          }
        }
      )
      .subscribe();

    driverTrackingChannels.set(driverId, channel);

    // Fetch initial location
    supabase
      .from('drivers')
      .select('current_lat, current_lng')
      .eq('id', driverId)
      .single()
      .then(({ data }) => {
        if (data && data.current_lat && data.current_lng) {
          const location: DriverLocation = {
            driverId,
            lat: data.current_lat,
            lng: data.current_lng,
            timestamp: Date.now(),
          };
          set((state) => {
            const newMap = new Map(state.driverLocations);
            newMap.set(driverId, location);
            return { driverLocations: newMap };
          });
        }
      })
      .catch(() => { /* Ignore */ });

    return () => {
      if (onUpdate) {
        const cbs = activeCallbacks.get(driverId);
        if (cbs) {
          cbs.delete(onUpdate);
          if (cbs.size === 0) activeCallbacks.delete(driverId);
        }
      }
    };
  },

  stopDriverTracking: (driverId: string) => {
    const channel = driverTrackingChannels.get(driverId);
    if (channel) {
      supabase.removeChannel(channel);
      driverTrackingChannels.delete(driverId);
      activeCallbacks.delete(driverId);
    }
    set((state) => {
      const newMap = new Map(state.driverLocations);
      newMap.delete(driverId);
      return {
        driverLocations: newMap,
        isTrackingDriver: newMap.size > 0,
      };
    });
  },

  getDriverLocation: (driverId: string) => {
    return get().driverLocations.get(driverId);
  },

  subscribeToNewRides: (driverUserId: string, onNewRide: (ride: any) => void) => {
    const channel = supabase
      .channel(`new-rides-${driverUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${driverUserId}`,
        },
        (payload) => {
          const notif = payload.new as any;
          if (notif.type === 'ride' && notif.data?.ride_id) {
            // Fetch full ride details
            supabase
              .from('rides')
              .select('*')
              .eq('id', notif.data.ride_id)
              .single()
              .then(({ data: rideData }) => {
                if (rideData) onNewRide(rideData);
              })
              .catch(() => { /* Ignore */ });
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  },

  subscribeToSOSUpdates: (onSOS: (sos: any) => void) => {
    const channel = supabase
      .channel('admin-sos-events')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sos_events' },
        (payload) => {
          onSOS(payload.new);
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  },

  subscribeToAllRides: (onRideChange: (ride: any) => void) => {
    const channel = supabase
      .channel('admin-all-rides')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rides' },
        (payload) => {
          if (payload.new) onRideChange(payload.new);
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  },
}));
