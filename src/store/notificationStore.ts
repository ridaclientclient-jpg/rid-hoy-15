import { create } from 'zustand';
import { supabase, type AppNotification } from '@/lib/supabase';

interface NotificationState {
  notifications: AppNotification[];
  unreadCount: number;
  isLoading: boolean;

  fetchNotifications: (userId: string) => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: (userId: string) => Promise<void>;
  subscribeToNotifications: (userId: string) => () => void;
}

// Track active channels to avoid duplicate subscriptions
const activeChannels: Map<string, { channel: ReturnType<typeof supabase.channel>; count: number }> = new Map();

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,

  fetchNotifications: async (userId: string) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        const notifications = data as AppNotification[];
        set({
          notifications,
          unreadCount: notifications.filter((n) => !n.is_read).length,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  markAsRead: async (notificationId: string) => {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === notificationId ? { ...n, is_read: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
    } catch {
      // Ignore
    }
  },

  markAllAsRead: async (userId: string) => {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, is_read: true })),
        unreadCount: 0,
      }));
    } catch {
      // Ignore
    }
  },

  subscribeToNotifications: (userId: string) => {
    const channelName = `notifications-${userId}`;

    // If channel already exists and is subscribed, just increment ref count
    const existing = activeChannels.get(channelName);
    if (existing) {
      existing.count++;
      // Return a cleanup function that decrements ref count
      return () => {
        existing.count--;
        if (existing.count <= 0) {
          supabase.removeChannel(existing.channel);
          activeChannels.delete(channelName);
        }
      };
    }

    // Create new channel with postgres_changes BEFORE subscribe()
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          const newNotif = payload.new as AppNotification;
          set((state) => ({
            notifications: [newNotif, ...state.notifications].slice(0, 50),
            unreadCount: state.unreadCount + (newNotif.is_read ? 0 : 1),
          }));
        }
      )
      .subscribe();

    activeChannels.set(channelName, { channel, count: 1 });

    return () => {
      const entry = activeChannels.get(channelName);
      if (entry) {
        entry.count--;
        if (entry.count <= 0) {
          supabase.removeChannel(entry.channel);
          activeChannels.delete(channelName);
        }
      }
    };
  },
}));
