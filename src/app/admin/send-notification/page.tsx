'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  Send, Users, Car, Store, Truck, UserCheck, Loader2, X,
  ChevronRight, ArrowLeft, Bell, CheckCircle2, AlertCircle,
  MessageSquare, Eye, Clock, ChevronDown, Search, Filter
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

/* ─── Types ────────────────────────────────────────────────── */
type TargetAudience = 'all_clients' | 'all_drivers' | 'all_vendors' | 'all_couriers' | 'all_users' | 'specific_user';
type NotificationType = 'info' | 'promo' | 'alert' | 'system' | 'ride' | 'payment';

interface TargetOption {
  value: TargetAudience;
  label: string;
  icon: React.ElementType;
  color: string;
  description: string;
}

interface SentNotification {
  id: string;
  title: string;
  message: string;
  target_audience: TargetAudience;
  target_type: NotificationType;
  sent_count: number;
  sent_by: string;
  created_at: string;
}

interface PreviewUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

const targetOptions: TargetOption[] = [
  { value: 'all_clients', label: 'Todos los Clientes', icon: Users, color: 'text-cyan-400', description: 'Todos los usuarios cliente registrados' },
  { value: 'all_drivers', label: 'Todos los Conductores', icon: Car, color: 'text-emerald-400', description: 'Todos los conductores registrados' },
  { value: 'all_vendors', label: 'Todos los Vendedores', icon: Store, color: 'text-amber-400', description: 'Todos los vendedores del marketplace' },
  { value: 'all_couriers', label: 'Todos los Repartidores', icon: Truck, color: 'text-purple-400', description: 'Todos los repartidores registrados' },
  { value: 'all_users', label: 'Todos los Usuarios', icon: UserCheck, color: 'text-blue-400', description: 'Todos los usuarios del sistema' },
  { value: 'specific_user', label: 'Usuario Específico', icon: Search, color: 'text-orange-400', description: 'Buscar y seleccionar un usuario individual' },
];

const typeOptions: { value: NotificationType; label: string; color: string; bg: string; dot: string }[] = [
  { value: 'info', label: 'Información', color: 'text-blue-400', bg: 'bg-blue-500/15', dot: 'bg-blue-400' },
  { value: 'promo', label: 'Promoción', color: 'text-emerald-400', bg: 'bg-emerald-500/15', dot: 'bg-emerald-400' },
  { value: 'alert', label: 'Alerta', color: 'text-red-400', bg: 'bg-red-500/15', dot: 'bg-red-400' },
  { value: 'system', label: 'Sistema', color: 'text-gray-400', bg: 'bg-gray-500/15', dot: 'bg-gray-400' },
  { value: 'ride', label: 'Viaje', color: 'text-cyan-400', bg: 'bg-cyan-500/15', dot: 'bg-cyan-400' },
  { value: 'payment', label: 'Pago', color: 'text-amber-400', bg: 'bg-amber-500/15', dot: 'bg-amber-400' },
];

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export default function SendNotificationPage() {
  // Form state
  const [targetAudience, setTargetAudience] = useState<TargetAudience>('all_clients');
  const [notificationType, setNotificationType] = useState<NotificationType>('info');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  // Specific user search
  const [userSearch, setUserSearch] = useState('');
  const [searchResults, setSearchResults] = useState<PreviewUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<PreviewUser | null>(null);
  const [searching, setSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Preview / Stats
  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // History
  const [history, setHistory] = useState<SentNotification[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  /* ── Fetch audience count ── */
  const fetchAudienceCount = useCallback(async (audience: TargetAudience) => {
    let query = supabase.from('profiles').select('id', { count: 'exact', head: true });

    switch (audience) {
      case 'all_clients': query = query.eq('role', 'client'); break;
      case 'all_drivers': query = query.eq('role', 'driver'); break;
      case 'all_vendors': query = query.eq('role', 'vendor'); break;
      case 'all_couriers': query = query.eq('role', 'courier'); break;
      case 'all_users': break; // all
      case 'specific_user': setAudienceCount(selectedUser ? 1 : null); return;
    }

    const { count } = await query;
    setAudienceCount(count ?? 0);
  }, [selectedUser]);

  useEffect(() => {
    if (targetAudience !== 'specific_user') {
      fetchAudienceCount(targetAudience);
    }
  }, [targetAudience, fetchAudienceCount]);

  /* ── Search user ── */
  const searchUser = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email, role')
        .or(`name.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(10);

      if (!error && data) {
        setSearchResults(data as PreviewUser[]);
      }
    } catch {
      // ignore
    }
    setSearching(false);
  }, []);

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (targetAudience !== 'specific_user') return;
    searchTimeoutRef.current = setTimeout(() => searchUser(userSearch), 400);
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [userSearch, targetAudience, searchUser]);

  /* ── Send notification ── */
  const handleSend = async () => {
    if (!title.trim()) {
      toast.error('El título es obligatorio');
      return;
    }
    if (!message.trim()) {
      toast.error('El mensaje es obligatorio');
      return;
    }
    if (targetAudience === 'specific_user' && !selectedUser) {
      toast.error('Selecciona un usuario');
      return;
    }

    setSending(true);
    try {
      // Build the insert payload for each target user
      let targetIds: string[] = [];

      if (targetAudience === 'specific_user' && selectedUser) {
        targetIds = [selectedUser.id];
      } else {
        let query = supabase.from('profiles').select('id');
        switch (targetAudience) {
          case 'all_clients': query = query.eq('role', 'client'); break;
          case 'all_drivers': query = query.eq('role', 'driver'); break;
          case 'all_vendors': query = query.eq('role', 'vendor'); break;
          case 'all_couriers': query = query.eq('role', 'courier'); break;
          case 'all_users': break;
        }
        const { data } = await query;
        targetIds = (data || []).map((u: any) => u.id);
      }

      if (targetIds.length === 0) {
        toast.error('No se encontraron usuarios para enviar la notificación');
        setSending(false);
        return;
      }

      // Insert notifications in batches of 100
      const BATCH_SIZE = 100;
      let sentCount = 0;

      for (let i = 0; i < targetIds.length; i += BATCH_SIZE) {
        const batch = targetIds.slice(i, i + BATCH_SIZE);
        const notifications = batch.map(userId => ({
          user_id: userId,
          title: title.trim(),
          message: message.trim(),
          type: notificationType,
          is_read: false,
        }));

        const { error } = await supabase.from('app_notifications').insert(notifications);
        if (error) throw error;
        sentCount += batch.length;
      }

      // Log the sent notification in push_notification_logs table
      try {
        await supabase.from('push_notification_logs').insert({
          title: title.trim(),
          message: message.trim(),
          target_audience: targetAudience,
          notification_type: notificationType,
          sent_count: sentCount,
        });
      } catch {
        // Log table might not exist yet - non-critical
      }

      toast.success(`Notificación enviada a ${sentCount} usuarios`);

      // Reset form
      setTitle('');
      setMessage('');
      setSelectedUser(null);
      setUserSearch('');
      setShowPreview(false);

      // Refresh history
      fetchHistory();
    } catch (err: any) {
      toast.error(err.message || 'Error al enviar notificación');
    } finally {
      setSending(false);
    }
  };

  /* ── Fetch history ── */
  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('push_notification_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (!error && data) {
        setHistory(data as SentNotification[]);
      }
    } catch {
      // ignore - table might not exist
    }
    setLoadingHistory(false);
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('es-CR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const selectedTarget = targetOptions.find(t => t.value === targetAudience);
  const selectedType = typeOptions.find(t => t.value === notificationType);
  const charCount = message.length;
  const isFormValid = title.trim() && message.trim() && (targetAudience !== 'specific_user' || selectedUser);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/admin" className="hover:text-white transition-colors flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" />
            Panel
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-white font-medium">Send Push-Notification</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
            <Bell className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Send Push-Notification</h1>
            <p className="text-gray-400 mt-1">Envía notificaciones a los usuarios del sistema</p>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <motion.div className="glass rounded-2xl p-4 border border-amber-500/20"
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-amber-300 font-medium">Cómo funciona</p>
            <p className="text-xs text-gray-400 mt-1">
              Esta función te permite enviar notificaciones directas a los usuarios del sistema. Puedes enviar a todos los clientes,
              conductores, vendedores, repartidores o a un usuario específico. Las notificaciones se entregan en tiempo real
              a través de Supabase y también aparecerán como notificación del navegador si el usuario está conectado.
            </p>
            <p className="text-[10px] text-gray-500 mt-1">
              Nota: Evita usar caracteres especiales, símbolos o emojis en el mensaje, ya que pueden causar problemas en la notificación.
            </p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ===== FORM (2 cols) ===== */}
        <motion.div className="lg:col-span-2 space-y-5"
          initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>

          {/* Target Audience */}
          <div className="glass rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-400" />
              Destinatarios
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {targetOptions.map((opt) => {
                const Icon = opt.icon;
                const isSelected = targetAudience === opt.value;
                return (
                  <button type="button" key={opt.value} onClick={() => { setTargetAudience(opt.value); setSelectedUser(null); }}
                    className={`relative flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-cyan-500/10 border-cyan-500/30'
                        : 'bg-white/[0.02] border-white/10 hover:border-white/20 hover:bg-white/[0.04]'
                    }`}>
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-cyan-400" />
                    )}
                    <Icon className={`w-4 h-4 ${isSelected ? 'text-cyan-400' : 'text-gray-500'}`} />
                    <span className={`text-xs font-medium ${isSelected ? 'text-white' : 'text-gray-400'}`}>{opt.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Audience count */}
            {!showPreview && audienceCount !== null && targetAudience !== 'specific_user' && (
              <motion.div className="mt-3 flex items-center gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-gray-400">
                  <span className="text-white font-semibold">{audienceCount}</span> usuarios serán notificados
                </span>
              </motion.div>
            )}
          </div>

          {/* Specific User Search (conditional) */}
          <AnimatePresence>
            {targetAudience === 'specific_user' && (
              <motion.div className="glass rounded-2xl p-5"
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <Search className="w-4 h-4 text-orange-400" />
                  Buscar Usuario
                </h3>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input type="text" value={userSearch}
                    onChange={e => setUserSearch(e.target.value)}
                    placeholder="Buscar por nombre o email..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/50 transition-colors" />
                  {searching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 animate-spin" />
                  )}
                </div>

                {/* Selected user */}
                {selectedUser && (
                  <motion.div className="mt-3 flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20"
                    initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate">{selectedUser.name}</p>
                      <p className="text-[10px] text-gray-400 truncate">{selectedUser.email}</p>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-gray-300">{selectedUser.role}</span>
                    <button type="button" onClick={() => setSelectedUser(null)}
                      className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-red-400 transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </motion.div>
                )}

                {/* Search results */}
                {!selectedUser && searchResults.length > 0 && (
                  <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-white/10 divide-y divide-white/5">
                    {searchResults.map((user) => (
                      <button type="button" key={user.id} onClick={() => { setSelectedUser(user); setUserSearch(''); setSearchResults([]); }}
                        className="w-full flex items-center gap-2 p-2.5 hover:bg-white/5 transition-colors text-left">
                        <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                          <Users className="w-3.5 h-3.5 text-gray-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-white truncate">{user.name}</p>
                          <p className="text-[10px] text-gray-500 truncate">{user.email}</p>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-400">{user.role}</span>
                      </button>
                    ))}
                  </div>
                )}
                {!selectedUser && userSearch.length >= 2 && !searching && searchResults.length === 0 && (
                  <p className="mt-2 text-xs text-gray-600 text-center">No se encontraron usuarios</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Notification Type */}
          <div className="glass rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-cyan-400" />
              Tipo de Notificación
            </h3>
            <div className="flex flex-wrap gap-2">
              {typeOptions.map((opt) => (
                <button type="button" key={opt.value} onClick={() => setNotificationType(opt.value)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    notificationType === opt.value
                      ? `${opt.bg} ${opt.color} border border-current/20`
                      : 'bg-white/[0.02] text-gray-500 border border-white/10 hover:border-white/20'
                  }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${opt.dot}`} />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div className="glass rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Bell className="w-4 h-4 text-cyan-400" />
              Contenido
            </h3>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-400">
                  Título <span className="text-red-400">*</span>
                </label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
                  placeholder="Ej: Nueva promoción de viajes disponible" />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-gray-400">
                    Mensaje <span className="text-red-400">*</span>
                  </label>
                  <span className={`text-[10px] ${charCount > 250 ? 'text-red-400' : 'text-gray-600'}`}>
                    {charCount}/250
                  </span>
                </div>
                <textarea value={message} onChange={e => { if (e.target.value.length <= 250) setMessage(e.target.value); }}
                  rows={4}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 transition-colors resize-none"
                  placeholder="Escribe el mensaje que quieres enviar a los usuarios..." />
                <p className="text-[10px] text-gray-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Evita caracteres especiales, símbolos o emojis. Pueden causar problemas en la notificación.
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setShowPreview(true)} disabled={!isFormValid}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm font-medium hover:bg-white/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              <Eye className="w-4 h-4" />
              Vista Previa
            </button>
            <button type="button" onClick={handleSend} disabled={!isFormValid || sending}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl btn-neon text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {sending ? 'Enviando...' : 'Enviar Notificación'}
            </button>
          </div>
        </motion.div>

        {/* ===== SIDEBAR: Stats + Quick Info ===== */}
        <motion.div className="space-y-5"
          initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>

          {/* Current Config Summary */}
          <div className="glass rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Resumen</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Destino</span>
                <span className={`text-xs font-medium ${selectedTarget?.color}`}>
                  {selectedTarget?.label}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Tipo</span>
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${selectedType?.dot}`} />
                  <span className={`text-xs font-medium ${selectedType?.color}`}>{selectedType?.label}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Usuarios</span>
                <span className="text-xs text-white font-mono">
                  {targetAudience === 'specific_user'
                    ? (selectedUser ? '1' : '—')
                    : (audienceCount ?? '—')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Título</span>
                <span className="text-xs text-white truncate max-w-[140px]">{title || '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Caracteres</span>
                <span className={`text-xs font-mono ${charCount > 250 ? 'text-red-400' : 'text-gray-400'}`}>{charCount}</span>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="glass rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Estado</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-gray-400">Sistema conectado</span>
              </div>
              <div className="flex items-center gap-2">
                <Bell className="w-3 h-3 text-amber-400" />
                <span className="text-xs text-gray-400">Notificaciones en tiempo real</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-3 h-3 text-gray-500" />
                <span className="text-xs text-gray-400">Entrega instantánea</span>
              </div>
            </div>
          </div>

          {/* Recent History */}
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-500" />
                Historial Reciente
              </h3>
              {history.length > 0 && (
                <button type="button" onClick={fetchHistory}
                  className="text-[10px] text-gray-500 hover:text-cyan-400 transition-colors">
                  Actualizar
                </button>
              )}
            </div>
            {loadingHistory && (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-12 rounded-lg bg-white/5 animate-pulse" />
                ))}
              </div>
            )}
            {!loadingHistory && history.length === 0 && (
              <p className="text-xs text-gray-600 text-center py-4">No hay notificaciones enviadas aún</p>
            )}
            {!loadingHistory && history.length > 0 && (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {history.map((item) => {
                  const tOpt = targetOptions.find(t => t.value === item.target_audience);
                  return (
                    <div key={item.id} className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
                      <p className="text-xs font-medium text-white truncate">{item.title}</p>
                      <p className="text-[10px] text-gray-500 truncate">{item.message}</p>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className={`text-[10px] ${tOpt?.color || 'text-gray-500'}`}>{tOpt?.label || item.target_audience}</span>
                        <span className="text-[10px] text-gray-600">{item.sent_count} enviados</span>
                      </div>
                      <p className="text-[9px] text-gray-600 mt-1">{formatDate(item.created_at)}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* ===================== PREVIEW MODAL ===================== */}
      <AnimatePresence>
        {showPreview && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/60" onClick={() => setShowPreview(false)} />
            <motion.div className="relative glass-strong rounded-2xl p-6 w-full max-w-md z-10"
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}>

              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white">Vista Previa de Notificación</h3>
                <button type="button" onClick={() => setShowPreview(false)}
                  className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Phone mockup */}
              <div className="bg-[#1a1a2e] rounded-2xl p-4 border border-white/10">
                <div className="bg-[#0f0f1a] rounded-xl p-3 space-y-2">
                  {/* Status bar mock */}
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[8px] text-gray-500">9:41</span>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-1.5 rounded-sm bg-gray-600" />
                      <div className="w-3 h-1.5 rounded-sm bg-emerald-500" />
                    </div>
                  </div>

                  {/* Notification card */}
                  <div className="bg-white/10 rounded-xl p-3 space-y-1.5 border border-white/5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center flex-shrink-0">
                        <Bell className="w-3 h-3 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-gray-400">RIDA SUPREME</p>
                        <p className="text-xs font-semibold text-white truncate">ahora</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white">{title}</p>
                      <p className="text-[11px] text-gray-300 mt-0.5">{message}</p>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <span className={`inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full ${selectedType?.bg} ${selectedType?.color}`}>
                        <span className={`w-1 h-1 rounded-full ${selectedType?.dot}`} />
                        {selectedType?.label}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Preview info */}
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Destino:</span>
                  <span className={`font-medium ${selectedTarget?.color}`}>{selectedTarget?.label}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Usuarios:</span>
                  <span className="text-white font-mono">
                    {targetAudience === 'specific_user'
                      ? (selectedUser ? '1' : '—')
                      : (audienceCount ?? '—')}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-5">
                <button type="button" onClick={() => setShowPreview(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-sm font-medium hover:bg-white/10 transition-colors">
                  Cancelar
                </button>
                <button type="button" onClick={() => { setShowPreview(false); handleSend(); }}
                  className="flex-1 py-2.5 rounded-xl btn-neon text-white text-sm font-semibold flex items-center justify-center gap-2">
                  <Send className="w-3.5 h-3.5" />
                  Enviar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
