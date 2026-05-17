'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, BellOff, Check, CheckCheck, Trash2, RefreshCw,
  MapPin, Wallet, AlertTriangle, Shield, Settings, Package, Info,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function getNotifIcon(type: string) {
  switch (type) {
    case 'ride':
      return <MapPin className="w-4 h-4 text-orange-400" />;
    case 'payment':
      return <Wallet className="w-4 h-4 text-emerald-400" />;
    case 'sos':
      return <Shield className="w-4 h-4 text-red-400" />;
    case 'warning':
      return <AlertTriangle className="w-4 h-4 text-amber-400" />;
    case 'system':
      return <Settings className="w-4 h-4 text-gray-400" />;
    default:
      return <Info className="w-4 h-4 text-blue-400" />;
  }
}

function getNotifBg(type: string) {
  switch (type) {
    case 'ride':
      return 'bg-orange-500/20';
    case 'payment':
      return 'bg-emerald-500/20';
    case 'sos':
      return 'bg-red-500/20';
    case 'warning':
      return 'bg-amber-500/20';
    default:
      return 'bg-white/5';
  }
}

function getTypeLabel(type: string) {
  switch (type) {
    case 'ride': return 'Entrega';
    case 'payment': return 'Pago';
    case 'sos': return 'SOS';
    case 'warning': return 'Alerta';
    case 'system': return 'Sistema';
    default: return 'Info';
  }
}

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Ahora';
  if (minutes < 60) return `Hace ${minutes}m`;
  if (hours < 24) return `Hace ${hours}h`;
  if (days < 7) return `Hace ${days}d`;
  return date.toLocaleDateString('es-CR', { day: 'numeric', month: 'short' });
}

type DateGroup = 'hoy' | 'ayer' | 'anteriores';

function groupByDate(notifications: { created_at: string }[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const groups: Record<DateGroup, typeof notifications> = {
    hoy: [],
    ayer: [],
    anteriores: [],
  };

  notifications.forEach((n) => {
    const d = new Date(n.created_at);
    if (d >= today) groups.hoy.push(n);
    else if (d >= yesterday) groups.ayer.push(n);
    else groups.anteriores.push(n);
  });

  return groups;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export default function CourierNotifications() {
  const { user } = useAuthStore();
  const {
    notifications,
    unreadCount,
    isLoading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    subscribeToNotifications,
  } = useNotificationStore();

  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  /* ---- load & subscribe ---- */
  const load = useCallback(async () => {
    if (!user?.id) return;
    await fetchNotifications(user.id);
  }, [user?.id, fetchNotifications]);

  useEffect(() => {
    load();
    if (!user?.id) return;
    const unsub = subscribeToNotifications(user.id);
    return unsub;
  }, [user?.id, load, subscribeToNotifications]);

  /* ---- actions ---- */
  const handleMarkAllRead = async () => {
    if (!user?.id) return;
    await markAllAsRead(user.id);
    toast.success('Todas las notificaciones marcadas como leidas');
  };

  const handleMarkRead = async (id: string) => {
    await markAsRead(id);
  };

  const handleDelete = async (id: string) => {
    setDeletingIds((prev) => new Set(prev).add(id));
    try {
      const { error } = await supabase.from('app_notifications').delete().eq('id', id);
      if (error) throw error;
      // Remove from local state via store-like approach
      // The store fetches from `notifications` table; direct delete on `app_notifications`
      toast.success('Notificacion eliminada');
      // Re-fetch to stay in sync
      load();
    } catch {
      toast.error('Error al eliminar notificacion');
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  /* ---- grouped data ---- */
  const groups = groupByDate(notifications);

  const groupLabels: { key: DateGroup; label: string }[] = [
    { key: 'hoy', label: 'Hoy' },
    { key: 'ayer', label: 'Ayer' },
    { key: 'anteriores', label: 'Anteriores' },
  ];

  /* ---- render ---- */
  if (isLoading && notifications.length === 0) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-5">
      {/* ---- Header ---- */}
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
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-medium hover:bg-orange-500/20 transition-colors"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Leer todo</span>
            </button>
          )}
          <button
            onClick={load}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
            title="Actualizar"
          >
            <RefreshCw className={`w-4 h-4 text-gray-400 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </motion.div>

      {/* ---- Notification list ---- */}
      {notifications.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-16 space-y-3"
        >
          <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
            <BellOff className="w-8 h-8 text-gray-600" />
          </div>
          <p className="text-sm text-gray-400">Sin notificaciones</p>
          <p className="text-xs text-gray-600 max-w-[220px] text-center leading-relaxed">
            Las alertas de entregas y pagos apareceran aqui
          </p>
        </motion.div>
      ) : (
        <div className="space-y-5">
          {groupLabels.map(({ key, label }) => {
            const items = groups[key];
            if (items.length === 0) return null;

            return (
              <div key={key}>
                {/* Date group header */}
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2 px-1"
                >
                  {label}
                </motion.p>

                <AnimatePresence>
                  {items.map((notif, i) => (
                    <motion.div
                      key={notif.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -80, transition: { duration: 0.25 } }}
                      transition={{ delay: i * 0.03 }}
                      className={`glass rounded-xl p-3 flex items-start gap-3 transition-all mb-2 ${
                        !notif.is_read
                          ? 'border border-orange-500/20 bg-orange-500/[0.03]'
                          : ''
                      }`}
                    >
                      {/* Icon */}
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${getNotifBg(notif.type)}`}
                      >
                        {getNotifIcon(notif.type)}
                      </div>

                      {/* Content */}
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => {
                          if (!notif.is_read) handleMarkRead(notif.id);
                        }}
                      >
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-gray-500">
                            {getTypeLabel(notif.type)}
                          </span>
                          <span className="text-[10px] text-gray-600">
                            {formatTime(notif.created_at)}
                          </span>
                          {!notif.is_read && (
                            <span className="w-2 h-2 rounded-full bg-orange-400 shrink-0" />
                          )}
                        </div>
                        <p
                          className={`text-sm ${
                            !notif.is_read ? 'text-white font-medium' : 'text-gray-300'
                          }`}
                        >
                          {notif.title}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                          {notif.message}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        {!notif.is_read && (
                          <button
                            onClick={() => handleMarkRead(notif.id)}
                            className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                            title="Marcar como leida"
                          >
                            <Check className="w-3.5 h-3.5 text-gray-500" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(notif.id)}
                          disabled={deletingIds.has(notif.id)}
                          className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors disabled:opacity-40"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-gray-600 hover:text-red-400" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
