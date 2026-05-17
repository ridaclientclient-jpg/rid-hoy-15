'use client';

import { useState, useEffect, useCallback, useRef, type TouchEvent as RTouchEvent } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import {
  Car, Wallet, Tag, Bell, AlertTriangle, X, CheckCheck,
  RefreshCw, ChevronRight, Trash2, Info,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

/* ───────────────────────── Types ───────────────────────── */

interface NotifItem {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: string;
  data?: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

interface ClientNotificationPanelProps {
  open: boolean;
  onClose: () => void;
}

/* ───────────────────────── Config ───────────────────────── */

const typeConfig: Record<string, { icon: typeof Car; color: string; bgColor: string }> = {
  ride:    { icon: Car,           color: 'text-cyan-400',    bgColor: 'bg-cyan-500/20' },
  payment: { icon: Wallet,        color: 'text-emerald-400', bgColor: 'bg-emerald-500/20' },
  promo:   { icon: Tag,           color: 'text-amber-400',   bgColor: 'bg-amber-500/20' },
  system:  { icon: Bell,          color: 'text-gray-400',    bgColor: 'bg-gray-500/20' },
  alert:   { icon: AlertTriangle, color: 'text-red-400',     bgColor: 'bg-red-500/20' },
  sos:     { icon: AlertTriangle, color: 'text-red-400',     bgColor: 'bg-red-500/20' },
  warning: { icon: AlertTriangle, color: 'text-amber-400',   bgColor: 'bg-amber-500/20' },
  info:    { icon: Info,          color: 'text-blue-400',    bgColor: 'bg-blue-500/20' },
};

/* ───────────────────── Helpers ───────────────────── */

function getDateGroup(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);
  const weekAgoStart = new Date(todayStart.getTime() - 7 * 86400000);
  const notifDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (notifDay >= todayStart) return 'Hoy';
  if (notifDay >= yesterdayStart) return 'Ayer';
  if (notifDay >= weekAgoStart) return 'Esta semana';
  return 'Mas antiguo';
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'Ahora';
  if (diffMin < 60) return `hace ${diffMin} min`;
  if (diffHrs < 24) return `hace ${diffHrs} hora${diffHrs !== 1 ? 's' : ''}`;
  if (diffDays < 7) return `hace ${diffDays} dia${diffDays !== 1 ? 's' : ''}`;
  return date.toLocaleDateString('es-CR', { day: 'numeric', month: 'short' });
}

type DateGroup = 'Hoy' | 'Ayer' | 'Esta semana' | 'Mas antiguo';
const DATE_GROUP_ORDER: DateGroup[] = ['Hoy', 'Ayer', 'Esta semana', 'Mas antiguo'];

function groupByDate(notifications: NotifItem[]): Map<string, NotifItem[]> {
  const groups = new Map<string, NotifItem[]>();
  for (const n of notifications) {
    const group = getDateGroup(n.created_at);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(n);
  }
  // Sort groups by order
  const sorted = new Map<string, NotifItem[]>();
  for (const key of DATE_GROUP_ORDER) {
    if (groups.has(key)) sorted.set(key, groups.get(key)!);
  }
  return sorted;
}

/* ───────────────────── Swipeable Item ───────────────────── */

const SWIPE_THRESHOLD = 80;

function SwipeableNotifItem({
  notif,
  onRead,
  onDelete,
}: {
  notif: NotifItem;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const x = useMotionValue(0);
  const deleteOpacity = useTransform(x, [-SWIPE_THRESHOLD, -SWIPE_THRESHOLD / 2, 0], [1, 0.5, 0]);
  const config = typeConfig[notif.type] || typeConfig.system;
  const TypeIcon = config.icon;

  const handleDragEnd = (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
    if (info.offset.x < -SWIPE_THRESHOLD || info.velocity.x < -500) {
      onDelete(notif.id);
    } else {
      animate(x, 0, { type: 'spring', stiffness: 500, damping: 30 });
    }
  };

  return (
    <div className="relative overflow-hidden">
      {/* Delete background */}
      <motion.div
        style={{ opacity: deleteOpacity }}
        className="absolute inset-y-0 right-0 flex items-center justify-end pr-4 bg-red-500/20 z-0"
      >
        <div className="flex items-center gap-2 text-red-400">
          <Trash2 className="w-4 h-4" />
          <span className="text-xs font-medium">Eliminar</span>
        </div>
      </motion.div>

      {/* Content */}
      <motion.div
        style={{ x }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0.3, right: 0 }}
        onDragEnd={handleDragEnd}
        onClick={() => { if (!notif.is_read) onRead(notif.id); }}
        className={`relative z-10 flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-white/5 ${
          !notif.is_read ? 'bg-cyan-500/[0.03]' : ''
        }`}
      >
        <div className={`w-9 h-9 rounded-lg ${config.bgColor} flex items-center justify-center shrink-0 mt-0.5`}>
          <TypeIcon className={`w-4 h-4 ${config.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={`text-sm font-medium leading-tight ${notif.is_read ? 'text-white/70' : 'text-white'}`}>
              {notif.title}
            </p>
            <div className="flex items-center gap-1.5 shrink-0">
              {!notif.is_read && (
                <div className="w-2 h-2 rounded-full bg-cyan-400 shrink-0 mt-1.5" />
              )}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDelete(notif.id); }}
                className="p-1 rounded-lg hover:bg-red-500/10 text-white hover:text-red-400 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <p className="text-xs text-white mt-1 line-clamp-2 leading-relaxed">
            {notif.body}
          </p>
          <p className="text-[10px] text-white mt-1.5">
            {formatRelativeTime(notif.created_at)}
          </p>
        </div>
      </motion.div>
    </div>
  );
}

/* ───────────────────── Main Component ───────────────────── */

export default function ClientNotificationPanel({ open, onClose }: ClientNotificationPanelProps) {
  const [notifications, setNotifications] = useState<NotifItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuthStore();
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  /* ── Fetch ── */
  const fetchNotifications = useCallback(async (showLoader = true) => {
    if (!user) return;
    if (showLoader) setLoading(true);
    try {
      const { data, error } = await supabase
        .from('app_notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        if (error.name === 'AbortError' || error.message?.includes('Lock broken')) return;
        console.error('Error fetching app_notifications:', error.message);
        setNotifications([]);
        return;
      }
      if (data) setNotifications(data as unknown as NotifItem[]);
    } catch (err: unknown) {
      const e = err as { name?: string; message?: string };
      if (e?.name === 'AbortError' || e?.message?.includes('Lock broken')) return;
      console.error('Error fetch app_notifications:', err);
      setNotifications([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  /* ── Fetch on open ── */
  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  /* ── Realtime subscription ── */
  useEffect(() => {
    if (!user || !open) {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    const channelName = `client-app-notif-${user.id}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'app_notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const newNotif = payload.new as unknown as NotifItem;
          setNotifications((prev) => [newNotif, ...prev].slice(0, 20));
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'app_notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          setNotifications((prev) => prev.filter((n) => n.id !== payload.old.id));
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'app_notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const updated = payload.new as unknown as NotifItem;
          setNotifications((prev) =>
            prev.map((n) => (n.id === updated.id ? updated : n)),
          );
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user, open]);

  /* ── Mark as read ── */
  const markAsRead = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
    );
    try {
      await supabase.from('app_notifications').update({ is_read: true }).eq('id', id);
    } catch {
      // silent
    }
  }, []);

  /* ── Mark all as read ── */
  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    try {
      if (!user) return;
      await supabase
        .from('app_notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
    } catch {
      // silent
    }
    toast.success('Todas las notificaciones marcadas como leidas');
  }, [user]);

  /* ── Delete ── */
  const deleteNotification = useCallback(async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    try {
      await supabase.from('app_notifications').delete().eq('id', id);
    } catch {
      // silent
    }
  }, []);

  /* ── Refresh ── */
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNotifications(false);
  }, [fetchNotifications]);

  /* ── Pull to refresh ── */
  const [pullDistance, setPullDistance] = useState(0);
  const pullStartY = useRef(0);
  const isPulling = useRef(false);

  const handleTouchStart = (e: RTouchEvent<HTMLDivElement>) => {
    if (scrollRef.current && scrollRef.current.scrollTop <= 0) {
      pullStartY.current = e.touches[0].clientY;
      isPulling.current = true;
    }
  };

  const handleTouchMove = (e: RTouchEvent<HTMLDivElement>) => {
    if (!isPulling.current) return;
    const diff = e.touches[0].clientY - pullStartY.current;
    if (diff > 0) {
      setPullDistance(Math.min(diff * 0.5, 60));
    }
  };

  const handleTouchEnd = () => {
    if (pullDistance > 40) {
      handleRefresh();
    }
    setPullDistance(0);
    isPulling.current = false;
  };

  /* ── Unread count ── */
  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const grouped = groupByDate(notifications);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 z-[200]"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-sm z-[201] flex flex-col"
          >
            <div className="h-full glass-strong border-l border-white/10 flex flex-col">
              {/* ── Header ── */}
              <div className="flex items-center justify-between px-4 py-4 border-b border-white/5 shrink-0">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold text-white">Notificaciones</h2>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] font-bold">
                      {unreadCount}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="p-2 rounded-xl hover:bg-white/5 transition-colors text-white disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                  </button>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllRead}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/15 transition-colors"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Marcar todas</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    className="p-2 rounded-xl hover:bg-white/5 transition-colors text-white ml-1"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* ── Pull to refresh indicator ── */}
              {pullDistance > 0 && (
                <div className="flex justify-center py-2 shrink-0" style={{ height: pullDistance }}>
                  <div className={`flex items-center gap-2 text-cyan-400 text-xs ${pullDistance > 40 ? 'opacity-100' : 'opacity-50'}`}>
                    <RefreshCw className={`w-3.5 h-3.5 ${pullDistance > 40 ? 'animate-spin' : ''}`} />
                    <span>Soltar para actualizar</span>
                  </div>
                </div>
              )}

              {/* ── Notification List ── */}
              <div
                ref={scrollRef}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                className="flex-1 overflow-y-auto"
              >
                {loading ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="w-7 h-7 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="text-center py-16 px-6">
                    <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                      <Bell className="w-8 h-8 text-white" />
                    </div>
                    <p className="text-sm font-medium text-white">No tienes notificaciones</p>
                    <p className="text-xs text-white mt-1.5">
                      Las alertas de tus viajes, pagos y promociones apareceran aqui
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {Array.from(grouped.entries()).map(([group, items]) => (
                      <div key={group}>
                        {/* Date group header */}
                        <div className="px-4 py-2 bg-white/[0.02]">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-white">
                            {group}
                          </span>
                        </div>
                        {/* Items */}
                        {items.map((notif, i) => (
                          <motion.div
                            key={notif.id}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.03, duration: 0.2 }}
                          >
                            <SwipeableNotifItem
                              notif={notif}
                              onRead={markAsRead}
                              onDelete={deleteNotification}
                            />
                          </motion.div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Footer ── */}
              {notifications.length > 0 && (
                <div className="border-t border-white/5 px-4 py-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => { onClose(); router.push('/client/notifications'); }}
                    className="flex items-center justify-center gap-2 w-full text-xs text-cyan-400 hover:text-cyan-300 transition-colors py-1"
                  >
                    <span>Ver todas las notificaciones</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
