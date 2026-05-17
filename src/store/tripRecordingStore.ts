import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

/**
 * Trip Recording Store — RIDA SUPREME
 * 
 * Records GPS points during an active ride.
 * Points are sent to Supabase in batches every 15 seconds.
 */

interface TrackingPoint {
  lat: number;
  lng: number;
  speed: number | null;
  heading: number | null;
  accuracy: number | null;
  recorded_at: string;
}

interface TripRecordingState {
  isRecording: boolean;
  rideId: string | null;
  points: TrackingPoint[];
  pointCount: number;
  watchId: number | null;
  uploadTimer: ReturnType<typeof setInterval> | null;

  startRecording: (rideId: string) => void;
  stopRecording: () => Promise<void>;
  uploadBatch: () => Promise<void>;
}

export const useTripRecordingStore = create<TripRecordingState>((set, get) => ({
  isRecording: false,
  rideId: null,
  points: [],
  pointCount: 0,
  watchId: null,
  uploadTimer: null,

  startRecording: (rideId: string) => {
    // Don't start if already recording
    if (get().isRecording) return;

    if (!navigator.geolocation) {
      console.warn('Geolocation not available for trip recording');
      return;
    }

    set({ isRecording: true, rideId, points: [], pointCount: 0 });

    // Start watching GPS position
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const point: TrackingPoint = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          speed: position.coords.speed,
          heading: position.coords.heading,
          accuracy: position.coords.accuracy,
          recorded_at: new Date().toISOString(),
        };

        set((state) => {
          const newPoints = [...state.points, point];
          // Keep local buffer limited to 100 points
          if (newPoints.length > 100) {
            newPoints.splice(0, newPoints.length - 100);
          }
          return { points: newPoints, pointCount: state.pointCount + 1 };
        });
      },
      (error) => {
        console.warn('GPS tracking error:', error.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      }
    );

    // Upload batch every 15 seconds
    const uploadTimer = setInterval(() => {
      if (get().isRecording && get().points.length > 0) {
        get().uploadBatch();
      }
    }, 15000);

    set({ watchId, uploadTimer });

    // Also do an initial upload after 3 seconds
    setTimeout(() => {
      if (get().isRecording && get().points.length > 0) {
        get().uploadBatch();
      }
    }, 3000);
  },

  stopRecording: async () => {
    const state = get();

    // Clear watch
    if (state.watchId !== null) {
      navigator.geolocation.clearWatch(state.watchId);
    }

    // Clear upload timer
    if (state.uploadTimer !== null) {
      clearInterval(state.uploadTimer);
    }

    // Final upload of remaining points
    if (state.points.length > 0 && state.rideId) {
      try {
        await state.uploadBatch();
      } catch (err) {
        console.error('Final batch upload failed:', err);
      }
    }

    set({
      isRecording: false,
      rideId: null,
      points: [],
      watchId: null,
      uploadTimer: null,
    });
  },

  uploadBatch: async () => {
    const state = get();
    if (!state.rideId || state.points.length === 0) return;

    // Take current points and clear the buffer
    const pointsToUpload = [...state.points];
    set({ points: [] });

    try {
      const rows = pointsToUpload.map(p => ({
        ride_id: state.rideId,
        lat: p.lat,
        lng: p.lng,
        speed: p.speed,
        heading: p.heading,
        accuracy: p.accuracy,
        recorded_at: p.recorded_at,
      }));

      const { error } = await supabase
        .from('ride_tracking_points')
        .upsert(rows, { onConflict: 'id' });

      if (error) {
        // On error, put points back
        set((s) => ({ points: [...s.points, ...pointsToUpload] }));
        console.error('Batch upload error:', error.message);
      }
    } catch (err) {
      // On error, put points back
      set((s) => ({ points: [...s.points, ...pointsToUpload] }));
      console.error('Batch upload exception:', err);
    }
  },
}));
