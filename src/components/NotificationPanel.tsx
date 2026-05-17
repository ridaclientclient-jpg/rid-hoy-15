'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, X, MapPin, Wallet, AlertTriangle, Info, CheckCircle2, Shield, ChevronRight, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import ClientNotificationPanel from '@/components/ClientNotificationPanel';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'ride' | 'payment' | 'sos' | 'system';
  is_read: boolean;
  created_at: string;
  data?: Record<string, unknown>;
}

const typeConfig: Record<string, { icon: any; color: string; bgColor: string }> = {
  info: { icon: Info, color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
  warning: { icon: AlertTriangle, color: 'text-amber-400', bgColor: 'bg-amber-500/20' },
  ride: { icon: MapPin, color: 'text-cyan-400', bgColor: 'bg-cyan-500/20' },
  payment: { icon: Wallet, color: 'text-emerald-400', bgColor: 'bg-emerald-500/20' },
  sos: { icon: Shield, color: 'text-red-400', bgColor: 'bg-red-500/20' },
  system: { icon: Info, color: 'text-gray-400', bgColor: 'bg-gray-500/20' },
};

export default function NotificationPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const { user } = useAuthStore();

  // ─── Client slide-out panel state ───
  const [clientPanelOpen, setClientPanelOpen] = useState(false);

  // ─── Unread count from app_notifications (client badge) ───
  const [appUnreadCount, setAppUnreadCount] = useState(0);

  const fetchAppUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      const { count, error } = await supabase
        .from('app_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (!error && count !== null) {
        setAppUnreadCount(count);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError' || err?.message?.includes('Lock broken')) return;
      // silent
    }
  }, [user]);

  // Fetch app_notifications unread count on mount + polling
  useEffect(() => {
    fetchAppUnreadCount();
    const interval = setInterval(fetchAppUnreadCount, 15000);
    return () => clearInterval(interval);
  }, [user, fetchAppUnreadCount]);

  // Subscribe to realtime new notifications from app_notifications
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`notif-badge-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'app_notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const newNotif = payload.new as { is_read: boolean };
          if (!newNotif.is_read) {
            setAppUnreadCount((prev) => prev + 1);
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'app_notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const old = payload.old as { is_read: boolean };
          const updated = payload.new as { is_read: boolean };
          if (!old.is_read && updated.is_read) {
            setAppUnreadCount((prev) => Math.max(0, prev - 1));
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'app_notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const deleted = payload.old as { is_read: boolean };
          if (!deleted.is_read) {
            setAppUnreadCount((prev) => Math.max(0, prev - 1));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        // AbortError = lock contention with initAuth(), not a real error — polling will retry
        if (error.name === 'AbortError' || error.message?.includes('Lock broken')) return;
        console.error('Error notificaciones:', error.message, error.code);
        setNotifications([]);
        return;
      }
      if (data) setNotifications(data as unknown as NotificationItem[]);
    } catch (err: any) {
      // AbortError = lock contention, ignore silently
      if (err?.name === 'AbortError' || err?.message?.includes('Lock broken')) return;
      console.error('Error fetch notif:', err);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Cargar al abrir panel
  useEffect(() => {
    if (isOpen && user) fetchNotifications();
  }, [isOpen, user, fetchNotifications]);

  // Cargar al montar + polling cada 30s para detectar nuevas
  useEffect(() => {
    if (!user) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [user, fetchNotifications]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAsRead = async (notifId: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === notifId ? { ...n, is_read: true } : n)
    );
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notifId);
    } catch (err: any) {
      if (err?.name === 'AbortError' || err?.message?.includes('Lock broken')) return;
      // silent for other errors too
    }
  };

  const markAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    try {
      if (!user) return;
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
    } catch (err: any) {
      if (err?.name === 'AbortError' || err?.message?.includes('Lock broken')) return;
      // silent
    }
    toast.success('Todas las notificaciones leidas');
  };

  const deleteNotification = async (notifId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notifId));
    try {
      await supabase.from('notifications').delete().eq('id', notifId);
    } catch (err: any) {
      if (err?.name === 'AbortError' || err?.message?.includes('Lock broken')) return;
      // silent
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'Ahora';
    if (diffMin < 60) return `Hace ${diffMin} min`;
    if (diffHrs < 24) return `Hace ${diffHrs}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;
    return date.toLocaleDateString('es-CR', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setClientPanelOpen(true)}
        className="relative p-2 rounded-xl hover:bg-white/5 transition-colors"
      >
        <Bell className="w-5 h-5 text-gray-400" />
        {appUnreadCount > 0 && (
          <div className="absolute top-1 right-1 min-w-[16px] h-4 rounded-full bg-cyan-500 flex items-center justify-center">
            <span className="text-[8px] font-bold text-white px-0.5">{appUnreadCount > 9 ? '9+' : appUnreadCount}</span>
          </div>
        )}
      </button>

      {/* Legacy dropdown (preserved for existing functionality) */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 bottom-full mb-1 w-72 rounded-xl overflow-hidden z-[100] border border-blue-800/60 shadow-2xl bg-blue-900"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-blue-800/40">
              <h3 className="text-xs font-bold text-white">Notificaciones</h3>
              <div className="flex items-center gap-1.5">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-[9px] text-white hover:text-white transition-colors"
                  >
                    Marcar todas
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-0.5 rounded-md hover:bg-blue-800/50 transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-white" />
                </button>
              </div>
            </div>

            {/* Notification List */}
            <div className="max-h-56 overflow-y-auto custom-scrollbar">
              {loading ? (
                <div className="flex items-center justify-center py-6">
                  <div className="w-5 h-5 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="text-center py-6 px-3">
                  <Bell className="w-8 h-8 text-white mx-auto mb-2" />
                  <p className="text-xs text-white">Sin notificaciones</p>
                  <p className="text-[10px] text-white mt-1">Las notificaciones apareceran aqui</p>
                </div>
              ) : (
                notifications.map((notif, i) => {
                  const config = typeConfig[notif.type] || typeConfig.system;
                  const TypeIcon = config.icon;
                  return (
                    <motion.div
                      key={notif.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      onClick={() => !notif.is_read && markAsRead(notif.id)}
                      className={`flex items-start gap-2.5 px-3 py-2.5 border-b border-blue-800/30 cursor-pointer transition-colors hover:bg-blue-800/40 ${
                        !notif.is_read ? 'bg-blue-800/30' : ''
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-md ${config.bgColor} flex items-center justify-center shrink-0 mt-0.5`}>
                        <TypeIcon className={`w-3.5 h-3.5 ${config.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1.5">
                          <p className="text-[11px] font-medium text-white leading-tight">
                            {notif.title}
                          </p>
                          {!notif.is_read && (
                            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0 mt-1" />
                          )}
                        </div>
                        <p className="text-[10px] text-white mt-0.5 line-clamp-2">
                          {notif.message}
                        </p>
                        <p className="text-[9px] text-white mt-0.5">
                          {formatTime(notif.created_at)}
                        </p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteNotification(notif.id); }}
                        className="p-0.5 rounded-md hover:bg-red-500/20 text-white hover:text-red-400 transition-colors shrink-0 self-center"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </motion.div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-blue-800/40 px-3 py-1.5">
              <p className="text-[9px] text-white text-center">
                {notifications.length} notificacion{notifications.length !== 1 ? 'es' : ''}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Client slide-out notification panel */}
      <ClientNotificationPanel
        open={clientPanelOpen}
        onClose={() => setClientPanelOpen(false)}
      />
    </div>
  );
}
