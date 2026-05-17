'use client';

import { useEffect, useCallback, useRef, useState, useMemo, type TouchEvent as RTouchEvent } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import {
  Bell, CheckCheck, Info, AlertTriangle, MapPin, Wallet,
  Shield, Settings, Loader2, Car, Tag, Trash2, X, RefreshCw,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
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

/* ───────────────────────── Config ───────────────────────── */

const typeConfig: Record<string, { icon: typeof Car; color: string; bgColor: string; label: string }> = {
  ride:    { icon: Car,           color: 'text-cyan-400',    bgColor: 'bg-cyan-500/20',    label: 'Viajes' },
  payment: { icon: Wallet,        color: 'text-emerald-400', bgColor: 'bg-emerald-500/20', label: 'Pagos' },
  promo:   { icon: Tag,           color: 'text-amber-400',   bgColor: 'bg-amber-500/20',   label: 'Promos' },
  system:  { icon: Settings,      color: 'text-gray-400',    bgColor: 'bg-gray-500/20',    label: 'Sistema' },
  alert:   { icon: AlertTriangle, color: 'text-red-400',     bgColor: 'bg-red-500/20',     label: 'Alertas' },
  sos:     { icon: Shield,        color: 'text-red-400',     bgColor: 'bg-red-500/20',     label: 'SOS' },
  warning: { icon: AlertTriangle, color: 'text-amber-400',   bgColor: 'bg-amber-500/20',   label: 'Alertas' },
  info:    { icon: Info,          color: 'text-blue-400',    bgColor: 'bg-blue-500/20',    label: 'Sistema' },
};

const FILTER_TABS = [
  { key: 'all', label: 'Todas' },
  { key: 'unread', label: 'No leidas' },
  { key: 'ride', label: 'Viajes' },
  { key: 'payment', label: 'Pagos' },
  { key: 'promo', label: 'Promos' },
  { key: 'system', label: 'Sistema' },
] as const;

type FilterKey = (typeof FILTER_TABS)[number]['key'];

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
    <div className="relative overflow-hidden rounded-xl">
      {/* Delete background */}
      <motion.div
        style={{ opacity: deleteOpacity }}
        className="absolute inset-y-0 right-0 flex items-center justify-end pr-5 bg-red-500/20 z-0 rounded-xl"
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
        className={`relative z-10 glass rounded-xl p-3.5 flex items-start gap-3 cursor-pointer transition-all hover:bg-white/5 ${
          !notif.is_read ? 'border border-cyan-500/20' : ''
        }`}
      >
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${config.bgColor}`}>
          <TypeIcon className={`w-4 h-4 ${config.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={`text-sm leading-tight ${!notif.is_read ? 'text-white font-medium' : 'text-gray-300'}`}>
              {notif.title}
            </p>
            <div className="flex items-center gap-1.5 shrink-0">
              {!notif.is_read && (
                <div className="w-2 h-2 rounded-full bg-cyan-400 shrink-0 mt-1.5" />
              )}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDelete(notif.id); }}
                className="p-1 rounded-lg hover:bg-red-500/10 text-gray-600 hover:text-red-400 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">{notif.body}</p>
          <p className="text-[10px] text-gray-600 mt-1.5">{formatRelativeTime(notif.created_at)}</p>
        </div>
      </motion.div>
    </div>
  );
}

/* ───────────────────── Main Page ───────────────────── */

const PAGE_SIZE = 20;

export default function ClientNotifications() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<FilterKey>('all');
  const [allNotifications, setAllNotifications] = useState<NotifItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  /* ── Pull to refresh state ── */
  const [pullDistance, setPullDistance] = useState(0);
  const pullStartY = useRef(0);
  const isPulling = useRef(false);

  /* ── Fetch notifications ── */
  const fetchNotifications = useCallback(async (offset = 0, append = false) => {
    if (!user?.id) return;
    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }

    try {
      const { data, error } = await supabase
        .from('app_notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) {
        if (error.name === 'AbortError' || error.message?.includes('Lock broken')) return;
        console.error('Error fetching app_notifications:', error.message);
        return;
      }

      const newItems = (data || []) as unknown as NotifItem[];

      setAllNotifications((prev) => {
        if (append) {
          const existingIds = new Set(prev.map((n) => n.id));
          const unique = newItems.filter((n) => !existingIds.has(n.id));
          return [...prev, ...unique];
        }
        return newItems;
      });

      setHasMore(newItems.length === PAGE_SIZE);
    } catch (err: unknown) {
      const e = err as { name?: string; message?: string };
      if (e?.name === 'AbortError' || e?.message?.includes('Lock broken')) return;
      console.error('Error fetch app_notifications:', err);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  /* ── Initial load ── */
  useEffect(() => {
    setAllNotifications([]);
    setHasMore(true);
    fetchNotifications(0, false);
  }, [user?.id, fetchNotifications]);

  /* ── Realtime subscription ── */
  useEffect(() => {
    if (!user?.id) return;

    const channelName = `client-notif-page-${user.id}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'app_notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const newNotif = payload.new as unknown as NotifItem;
          setAllNotifications((prev) => [newNotif, ...prev].slice(0, 200));
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'app_notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          setAllNotifications((prev) => prev.filter((n) => n.id !== payload.old.id));
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'app_notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const updated = payload.new as unknown as NotifItem;
          setAllNotifications((prev) =>
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
  }, [user?.id]);

  /* ── Infinite scroll with IntersectionObserver ── */
  useEffect(() => {
    if (!sentinelRef.current || !hasMore || isLoadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          fetchNotifications(allNotifications.length, true);
        }
      },
      { rootMargin: '200px' },
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, allNotifications.length, fetchNotifications]);

  /* ── Filtered + grouped ── */
  const filteredNotifications = useMemo(() => {
    switch (activeTab) {
      case 'unread':
        return allNotifications.filter((n) => !n.is_read);
      case 'ride':
        return allNotifications.filter((n) => n.type === 'ride');
      case 'payment':
        return allNotifications.filter((n) => n.type === 'payment');
      case 'promo':
        return allNotifications.filter((n) => n.type === 'promo');
      case 'system':
        return allNotifications.filter((n) => ['system', 'info'].includes(n.type));
      default:
        return allNotifications;
    }
  }, [allNotifications, activeTab]);

  const grouped = useMemo(() => groupByDate(filteredNotifications), [filteredNotifications]);
  const unreadCount = allNotifications.filter((n) => !n.is_read).length;

  /* ── Actions ── */
  const handleMarkRead = useCallback(async (id: string) => {
    setAllNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
    );
    try {
      await supabase.from('app_notifications').update({ is_read: true }).eq('id', id);
    } catch {
      // silent
    }
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    setAllNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    try {
      if (!user?.id) return;
      await supabase
        .from('app_notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
    } catch {
      // silent
    }
    toast.success('Todas las notificaciones marcadas como leidas');
  }, [user?.id]);

  const handleDelete = useCallback(async (id: string) => {
    setAllNotifications((prev) => prev.filter((n) => n.id !== id));
    try {
      await supabase.from('app_notifications').delete().eq('id', id);
      toast.success('Notificacion eliminada');
    } catch {
      // silent
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setAllNotifications([]);
    setHasMore(true);
    await fetchNotifications(0, false);
  }, [fetchNotifications]);

  /* ── Pull to refresh handlers ── */
  const handleTouchStart = (e: RTouchEvent<HTMLDivElement>) => {
    if (scrollContainerRef.current && scrollContainerRef.current.scrollTop <= 0) {
      pullStartY.current = e.touches[0].clientY;
      isPulling.current = true;
    }
  };

  const handleTouchMove = (e: RTouchEvent<HTMLDivElement>) => {
    if (!isPulling.current) return;
    const diff = e.touches[0].clientY - pullStartY.current;
    if (diff > 0) {
      setPullDistance(Math.min(diff * 0.4, 60));
    }
  };

  const handleTouchEnd = () => {
    if (pullDistance > 40) {
      handleRefresh();
    }
    setPullDistance(0);
    isPulling.current = false;
  };

  /* ── Tab change: reset scroll to top ── */
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [activeTab]);

  /* ── Loading state ── */
  if (isLoading && allNotifications.length === 0) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          <span className="text-xs text-gray-500">Cargando notificaciones...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-xl font-bold text-white">Notificaciones</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {unreadCount > 0 ? `${unreadCount} sin leer` : 'Todo al dia'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 rounded-xl hover:bg-white/5 transition-colors text-gray-400 hover:text-white disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 px-3 py-1.5 rounded-lg transition-colors"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Leer todo
            </button>
          )}
        </div>
      </motion.div>

      {/* ── Filter Tabs ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none"
      >
        {FILTER_TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const count =
            tab.key === 'all'
              ? allNotifications.length
              : tab.key === 'unread'
                ? unreadCount
                : tab.key === 'system'
                  ? allNotifications.filter((n) => ['system', 'info'].includes(n.type)).length
                  : allNotifications.filter((n) => n.type === tab.key).length;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                  : 'bg-white/5 text-gray-400 hover:text-gray-300 border border-transparent hover:bg-white/[0.07]'
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  isActive ? 'bg-cyan-500/20' : 'bg-white/10'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </motion.div>

      {/* ── Pull to refresh indicator ── */}
      <AnimatePresence>
        {pullDistance > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: pullDistance, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex justify-center items-end overflow-hidden"
          >
            <div className={`flex items-center gap-2 text-cyan-400 text-xs pb-1 transition-opacity ${pullDistance > 40 ? 'opacity-100' : 'opacity-40'}`}>
              <RefreshCw className={`w-3.5 h-3.5 ${pullDistance > 40 ? 'animate-spin' : ''}`} />
              <span>Soltar para actualizar</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Notification List ── */}
      <div
        ref={scrollContainerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="space-y-2 max-h-[calc(100vh-240px)] overflow-y-auto pr-0.5"
      >
        {filteredNotifications.length > 0 ? (
          Array.from(grouped.entries()).map(([group, items], groupIdx) => (
            <div key={group}>
              {/* Date group header */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: groupIdx * 0.05 }}
                className="px-1 py-1.5"
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  {group}
                </span>
              </motion.div>

              {/* Items in group */}
              <div className="space-y-2">
                {items.map((notif, i) => (
                  <motion.div
                    key={notif.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: (groupIdx * 5 + i) * 0.02, duration: 0.2 }}
                    layout
                  >
                    <SwipeableNotifItem
                      notif={notif}
                      onRead={handleMarkRead}
                      onDelete={handleDelete}
                    />
                  </motion.div>
                ))}
              </div>
            </div>
          ))
        ) : (
          /* ── Empty state ── */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass rounded-2xl p-10 text-center"
          >
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] flex items-center justify-center mx-auto mb-5 border border-white/5">
              <Bell className="w-9 h-9 text-gray-600" />
            </div>
            <p className="text-sm font-medium text-gray-400">
              {activeTab === 'unread'
                ? 'No tienes notificaciones sin leer'
                : activeTab === 'all'
                  ? 'No tienes notificaciones'
                  : `No hay notificaciones de ${FILTER_TABS.find((t) => t.key === activeTab)?.label?.toLowerCase() || 'esta categoria'}`}
            </p>
            <p className="text-xs text-gray-600 mt-2 leading-relaxed">
              {activeTab === 'all'
                ? 'Las alertas de viajes, pagos y promociones apareceran aqui'
                : 'Cambia el filtro para ver otras notificaciones'}
            </p>
            {activeTab !== 'all' && (
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className="mt-4 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                Ver todas las notificaciones
              </button>
            )}
          </motion.div>
        )}

        {/* ── Infinite scroll sentinel ── */}
        {hasMore && filteredNotifications.length > 0 && (
          <div ref={sentinelRef} className="py-4 flex items-center justify-center">
            {isLoadingMore && (
              <div className="flex items-center gap-2 text-gray-500 text-xs">
                <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                <span>Cargando mas...</span>
              </div>
            )}
          </div>
        )}

        {/* ── End of list ── */}
        {!hasMore && filteredNotifications.length > 0 && (
          <div className="py-4 text-center">
            <span className="text-[10px] text-gray-600">
              {filteredNotifications.length} notificacion{filteredNotifications.length !== 1 ? 'es' : ''}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
