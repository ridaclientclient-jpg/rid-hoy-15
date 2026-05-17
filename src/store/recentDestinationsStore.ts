import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export interface RecentDestination {
  id: string;
  address: string;
  lat: number | null;
  lng: number | null;
  ride_count: number;
  last_used: string;
}

interface RecentDestinationsState {
  destinations: RecentDestination[];
  isLoading: boolean;

  fetchRecentDestinations: (userId: string) => Promise<void>;
}

const DEFAULT_LIMIT = 10;

export const useRecentDestinationsStore = create<RecentDestinationsState>((set) => ({
  destinations: [],
  isLoading: false,

  fetchRecentDestinations: async (userId: string) => {
    set({ isLoading: true });
    try {
      // Fetch the limit from settings first
      const { data: settings } = await supabase
        .from('settings')
        .select('key, value')
        .eq('key', 'recent_destinations_limit')
        .single();

      const limit = settings ? Number(settings.value) || DEFAULT_LIMIT : DEFAULT_LIMIT;

      const { data, error } = await supabase
        .from('recent_destinations')
        .select('*')
        .eq('user_id', userId)
        .order('last_used', { ascending: false })
        .limit(limit);

      if (!error && data) {
        set({ destinations: data as RecentDestination[], isLoading: false });
      } else {
        console.error('Fetch recent destinations error:', error);
        set({ isLoading: false });
      }
    } catch (error) {
      console.error('Fetch recent destinations error:', error);
      set({ isLoading: false });
    }
  },
}));
