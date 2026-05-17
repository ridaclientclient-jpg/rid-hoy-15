import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export type TemperaturePreference = 'cold' | 'neutral' | 'warm';
export type ConversationLevel = 'quiet' | 'neutral' | 'chatty';
export type MusicPreference = 'no_music' | 'no_preference' | 'soft_music' | 'my_music';

export interface ClientPreferences {
  user_id: string;
  temperature_preference: TemperaturePreference;
  conversation_level: ConversationLevel;
  music_preference: MusicPreference;
  push_ride_updates: boolean;
  push_promotions: boolean;
  push_payment: boolean;
  email_receipts: boolean;
  share_live_location: boolean;
  show_phone_to_driver: boolean;
  language: string;
}

const DEFAULT_PREFERENCES: Omit<ClientPreferences, 'user_id'> = {
  temperature_preference: 'neutral',
  conversation_level: 'neutral',
  music_preference: 'no_preference',
  push_ride_updates: true,
  push_promotions: true,
  push_payment: true,
  email_receipts: true,
  share_live_location: false,
  show_phone_to_driver: false,
  language: 'es',
};

interface ClientPreferencesState {
  preferences: ClientPreferences | null;
  isLoading: boolean;
  fetchPreferences: (userId: string) => Promise<void>;
  updatePreference: <K extends keyof ClientPreferences>(
    userId: string,
    key: K,
    value: ClientPreferences[K]
  ) => Promise<void>;
}

export const useClientPreferencesStore = create<ClientPreferencesState>((set, get) => ({
  preferences: null,
  isLoading: false,

  fetchPreferences: async (userId: string) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase
        .from('client_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (!error && data) {
        set({ preferences: data as ClientPreferences, isLoading: false });
      } else {
        // Row doesn't exist yet — create with defaults
        const newRow = { user_id: userId, ...DEFAULT_PREFERENCES };
        const { data: insertedData, error: insertError } = await supabase
          .from('client_preferences')
          .insert(newRow)
          .select()
          .single();

        if (!insertError && insertedData) {
          set({ preferences: insertedData as ClientPreferences, isLoading: false });
        } else {
          console.error('Error creating preferences:', insertError);
          // Still set local defaults so UI doesn't break
          set({
            preferences: { user_id: userId, ...DEFAULT_PREFERENCES },
            isLoading: false,
          });
        }
      }
    } catch (err) {
      console.error('Error fetching preferences:', err);
      set({ isLoading: false });
    }
  },

  updatePreference: async (userId, key, value) => {
    const current = get().preferences;
    if (!current) return;

    // Optimistic update
    set({ preferences: { ...current, [key]: value } });

    try {
      const { error } = await supabase
        .from('client_preferences')
        .update({ [key]: value })
        .eq('user_id', userId);

      if (error) {
        // Revert on error
        set({ preferences: current });
        console.error('Error updating preference:', error);
      }
    } catch (err) {
      set({ preferences: current });
      console.error('Error updating preference:', err);
    }
  },
}));
