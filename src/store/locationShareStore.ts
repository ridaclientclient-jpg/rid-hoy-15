import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

/**
 * Location Share Store — RIDA SUPREME
 * 
 * Manages sharing live ride location with contacts.
 * Generates unique share tokens and manages active shares.
 */

interface LocationShare {
  id: string;
  share_token: string;
  ride_id: string;
  rider_name: string;
  driver_name: string;
  driver_phone: string;
  vehicle_info: string;
  origin: string;
  destination: string;
  status: string;
  expires_at: string;
  created_at: string;
}

interface LocationShareState {
  shares: LocationShare[];
  isCreating: boolean;
  isFetching: boolean;

  createShare: (params: {
    rideId: string;
    riderName: string;
    driverName?: string;
    driverPhone?: string;
    vehicleInfo?: string;
    origin: string;
    destination: string;
  }) => Promise<string | null>;
  fetchShares: (rideId: string) => Promise<void>;
  cancelShare: (shareId: string) => Promise<void>;
  getShareUrl: (token: string) => string;
  generateWhatsAppLink: (token: string, contactPhone?: string) => string;
}

export const useLocationShareStore = create<LocationShareState>((set, get) => ({
  shares: [],
  isCreating: false,
  isFetching: false,

  createShare: async (params) => {
    set({ isCreating: true });

    try {
      // Generate unique token
      const token = 'rida-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 8);

      // Get share duration from settings
      const { data: settings } = await supabase
        .from('settings')
        .select('key, value')
        .eq('key', 'location_share_duration_minutes')
        .single();

      const durationMinutes = Number(settings?.value || 120);
      const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('location_shares')
        .insert({
          ride_id: params.rideId,
          share_token: token,
          rider_name: params.riderName,
          driver_name: params.driverName || '',
          driver_phone: params.driverPhone || '',
          vehicle_info: params.vehicleInfo || '',
          origin: params.origin,
          destination: params.destination,
          expires_at: expiresAt,
        })
        .select()
        .single();

      if (error) {
        console.error('Create share error:', error.message);
        return null;
      }

      if (data) {
        set((state) => ({ shares: [...state.shares, data as LocationShare], isCreating: false }));
        return token;
      }

      return null;
    } catch (err) {
      console.error('Create share exception:', err);
      set({ isCreating: false });
      return null;
    }
  },

  fetchShares: async (rideId: string) => {
    set({ isFetching: true });
    try {
      const { data, error } = await supabase
        .from('location_shares')
        .select('*')
        .eq('ride_id', rideId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        set({ shares: data as LocationShare[] });
      }
    } catch (err) {
      console.error('Fetch shares error:', err);
    } finally {
      set({ isFetching: false });
    }
  },

  cancelShare: async (shareId: string) => {
    try {
      await supabase
        .from('location_shares')
        .update({ status: 'cancelled', expires_at: new Date().toISOString() })
        .eq('id', shareId);

      set((state) => ({
        shares: state.shares.map(s =>
          s.id === shareId ? { ...s, status: 'cancelled' } : s
        ),
      }));
    } catch (err) {
      console.error('Cancel share error:', err);
    }
  },

  getShareUrl: (token: string) => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/track/${token}`;
  },

  generateWhatsAppLink: (token: string, contactPhone?: string) => {
    const url = get().getShareUrl(token);
    const text = `Estoy en viaje con RIDA. Puedes ver mi ubicacion en tiempo real aqui: ${url}`;
    // Default WhatsApp number (506)87838329 format if no contact provided
    const phone = contactPhone ? contactPhone.replace(/\D/g, '') : '';
    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  },
}));
