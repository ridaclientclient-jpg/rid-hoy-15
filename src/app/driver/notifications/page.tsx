'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Check, CheckCheck, Trash2, BellOff, RefreshCw } from 'lucide-react';
import { supabase, type AppNotification } from '@/lib/supabase';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';

export default function DriverNotifications() {
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<'all' | 'unread'>('all');

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('app_notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        const errMsg = error.message || JSON.stringify(error);
        if (error.code === '42P01') {
          // Table doesn't exist yet - silent
          setNotifications([]);
        } else {
          // RLS or other DB error - show user-friendly message
          console.warn('[Notifications]', errMsg);
          toast.error('No se pudieron cargar las notificaciones');
        }
      } else {
        setNotifications(data || []);
      }
    } catch (err: any) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      const msg = err?.message || JSON.stringify(err);
      console.warn('[Notifications]', msg);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = async (id: string) => {
    try {
      await supabase
        .from('app_notifications')
        .update({ is_read: true })
        .eq('id', id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      toast.error('Error al marcar notificacion');
    }
  };

  const markAllRead = async () => {
    if (!user?.id) return;
    try {
      await supabase
        .from('app_notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      toast.success('Todas las notificaciones marcadas como leidas');
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      toast.error('Error al marcar todas');
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await supabase
        .from('app_notifications')
        .delete()
        .eq('id', id);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      toast.error('Error al eliminar notificacion');
    }
  };

  const getIconColor = (type: AppNotification['type']) => {
    switch (type) {
      case 'ride': return 'text-cyan-400 bg-cyan-500/20';
      case 'payment': return 'text-emerald-400 bg-emerald-500/20';
      case 'warning': return 'text-amber-400 bg-amber-500/20';
      case 'sos': return 'text-red-400 bg-red-500/20';
      default: return 'text-blue-400 bg-blue-500/20';
    }
  };

  const getTypeLabel = (type: AppNotification['type']) => {
    switch (type) {
      case 'ride': return 'Viaje';
      case 'payment': return 'Pago';
      case 'warning': return 'Alerta';
      case 'sos': return 'SOS';
      case 'system': return 'Sistema';
      default: return 'Info';
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'Ahora mismo';
    if (diffMin < 60) return `Hace ${diffMin} min`;
    if (diffHrs < 24) return `Hace ${diffHrs}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;
    return date.toLocaleDateString('es-CR', { day: 'numeric', month: 'short' });
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Notificaciones</h1>
            <p className="text-sm text-gray-400 mt-1">
              {unreadCount > 0 ? `${unreadCount} sin leer` : 'Sin novedades'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-medium hover:bg-cyan-500/20 transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Leer todo
              </button>
            )}
            <button
              onClick={() => { setLoading(true); fetchNotifications(); }}
              className="p-2 rounded-lg hover:bg-white/5 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Filter tabs */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="flex gap-2"
      >
        <button
          onClick={() => setFilterTab('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            filterTab === 'all'
              ? 'bg-white/10 text-white'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          Todas
        </button>
        <button
          onClick={() => setFilterTab('unread')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            filterTab === 'unread'
              ? 'bg-white/10 text-white'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          Sin leer{unreadCount > 0 ? ` (${unreadCount})` : ''}
        </button>
      </motion.div>

      {/* Notifications List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
        </div>
      ) : notifications.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-12 space-y-3"
        >
          <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
            <BellOff className="w-8 h-8 text-gray-600" />
          </div>
          <p className="text-sm text-gray-500">No tienes notificaciones</p>
          <p className="text-xs text-gray-600">Las alertas de viajes y pagos apareceran aqui</p>
        </motion.div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {(filterTab === 'unread' ? notifications.filter(n => !n.is_read) : notifications).map((notif, index) => (
              <motion.div
                key={notif.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className={`glass rounded-xl p-3 flex items-start gap-3 transition-colors ${
                  !notif.is_read ? 'border border-cyan-500/20' : ''
                }`}
              >
                {/* Icon */}
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${getIconColor(notif.type)}`}>
                  <Bell className="w-4 h-4" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-gray-500">
                      {getTypeLabel(notif.type)}
                    </span>
                    <span className="text-[10px] text-gray-600">{formatTime(notif.created_at)}</span>
                    {!notif.is_read && (
                      <span className="w-2 h-2 rounded-full bg-cyan-500 shrink-0" />
                    )}
                  </div>
                  <p className="text-sm font-medium text-white">{notif.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{notif.message}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {!notif.is_read && (
                    <button
                      onClick={() => markAsRead(notif.id)}
                      className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                      title="Marcar como leida"
                    >
                      <Check className="w-3.5 h-3.5 text-gray-500" />
                    </button>
                  )}
                  <button
                    onClick={() => deleteNotification(notif.id)}
                    className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-gray-600 hover:text-red-400" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
