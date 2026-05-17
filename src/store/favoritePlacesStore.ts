import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export interface FavoritePlace {
  id: string;
  user_id: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  icon: string;
  created_at: string;
}

interface FavoritePlacesState {
  places: FavoritePlace[];
  isLoading: boolean;
  /** Pre-filled address to pass to ride page (origin or destination) */
  prefill: { address: string; lat: number | null; lng: number | null } | null;
  /** Which field to pre-fill: 'origin' or 'destination' */
  prefillTarget: 'origin' | 'destination' | null;
  /** Whether the "save after ride" dialog should show */
  showSaveDialog: boolean;
  saveDialogData: { origin: string; originLat: number | null; originLng: number | null; destination: string; destLat: number | null; destLng: number | null } | null;

  fetchPlaces: (userId: string) => Promise<void>;
  addPlace: (userId: string, name: string, address: string, icon: string, lat: number | null, lng: number | null) => Promise<boolean>;
  deletePlace: (placeId: string) => Promise<void>;
  /** Set prefill and navigate to ride page */
  setPrefill: (address: string, lat: number | null, lng: number | null, target: 'origin' | 'destination') => void;
  clearPrefill: () => void;
  /** Show save dialog after completing a ride */
  showSaveAfterRide: (data: { origin: string; originLat: number | null; originLng: number | null; destination: string; destLat: number | null; destLng: number | null }) => void;
  hideSaveDialog: () => void;
}

export const useFavoritePlacesStore = create<FavoritePlacesState>((set, get) => ({
  places: [],
  isLoading: false,
  prefill: null,
  prefillTarget: null,
  showSaveDialog: false,
  saveDialogData: null,

  fetchPlaces: async (userId: string) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase
        .from('favorite_places')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (!error && data) {
        set({ places: data as FavoritePlace[], isLoading: false });
      } else {
        console.error('Fetch favorite places error:', error);
        set({ isLoading: false });
      }
    } catch (error) {
      console.error('Fetch favorite places error:', error);
      set({ isLoading: false });
    }
  },

  addPlace: async (userId: string, name: string, address: string, icon: string, lat: number | null, lng: number | null) => {
    try {
      const { error } = await supabase
        .from('favorite_places')
        .insert({
          user_id: userId,
          name,
          address,
          lat,
          lng,
          icon,
        });

      if (error) {
        console.error('Add favorite place error:', error);
        return false;
      }

      // Refresh list
      await get().fetchPlaces(userId);
      return true;
    } catch (error) {
      console.error('Add favorite place error:', error);
      return false;
    }
  },

  deletePlace: async (placeId: string) => {
    try {
      const { error } = await supabase
        .from('favorite_places')
        .delete()
        .eq('id', placeId);

      if (!error) {
        set({ places: get().places.filter(p => p.id !== placeId) });
      } else {
        console.error('Delete favorite place error:', error);
      }
    } catch (error) {
      console.error('Delete favorite place error:', error);
    }
  },

  setPrefill: (address: string, lat: number | null, lng: number | null, target: 'origin' | 'destination') => {
    set({ prefill: { address, lat, lng }, prefillTarget: target });
  },

  clearPrefill: () => {
    set({ prefill: null, prefillTarget: null });
  },

  showSaveAfterRide: (data) => {
    set({ showSaveDialog: true, saveDialogData: data });
  },

  hideSaveDialog: () => {
    set({ showSaveDialog: false, saveDialogData: null });
  },
}));
