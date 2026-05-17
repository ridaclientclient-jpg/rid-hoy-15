'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  ShieldAlert, ShieldCheck, MapPin, Phone, Clock, User, Car,
  Navigation, Loader2, Bell, Search, Filter, CheckCircle2,
  AlertTriangle, Volume2, VolumeX, RefreshCw, ExternalLink,
  ChevronDown, ChevronRight, ArrowLeft,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface SOSEvent {
  id: string;
  user_id: string;
  ride_id?: string;
  latitude: number;
  longitude: number;
  status: 'active' | 'resolved';
  created_at: string;
  resolved_by?: string;
  resolved_at?: string;
  profiles?: { name: string; phone?: string; email?: string };
  rides?: {
    id: string;
    origin?: string;
    destination?: string;
    driver_id?: string;
    status?: string;
  };
}

type TabKey = 'active' | 'resolved';

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 10) return 'Ahora mismo';
  if (diffSec < 60) return `${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d`;
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString('es-CR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function playAlertSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    // Alarm-like SOS tone
    const playBeep = (time: number, freq: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'square';
      gain.gain.setValueAtTime(0.15, ctx.currentTime + time);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + time + duration);
      osc.start(ctx.currentTime + time);
      osc.stop(ctx.currentTime + time + duration);
    };
    // Triple beep pattern
    playBeep(0, 880, 0.15);
    playBeep(0.2, 880, 0.15);
    playBeep(0.4, 1100, 0.3);
  } catch {
    // AudioContext not available
  }
}

function getGoogleMapsLink(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

/* ─── Loading Skeleton ─────────────────────────────────────────────────────── */

function LoadingSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/5" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 bg-white/5 rounded" />
              <div className="h-3 w-48 bg-white/5 rounded" />
            </div>
          </div>
          <div className="h-3 w-full bg-white/5 rounded" />
          <div className="bg-white/5 rounded-lg px-3 py-2">
            <div className="h-3 w-52 bg-white/5 rounded" />
          </div>
          <div className="flex gap-2">
            <div className="h-8 w-24 bg-white/5 rounded" />
            <div className="h-8 w-28 bg-white/5 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── SOS Card Component ─────────────────────────────────────────────────── */

function SOSCard({
  sos,
  onResolve,
  resolving,
}: {
  sos: SOSEvent;
  onResolve: (id: string) => void;
  resolving: string | null;
}) {
  const isActive = sos.status === 'active';
  const userName = sos.profiles?.name || 'Desconocido';
  const userPhone = sos.profiles?.phone || '';
  const userEmail = sos.profiles?.email || '';
  const ride = sos.rides;
  const mapsUrl = getGoogleMapsLink(sos.latitude, sos.longitude);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`rounded-xl border p-4 transition-all ${
        isActive
          ? 'border-red-500/50 bg-red-500/5 shadow-lg shadow-red-500/10'
          : 'border-white/10 bg-white/[0.02]'
      }`}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className={`relative flex-shrink-0`}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            isActive
              ? 'bg-red-500/20 ring-2 ring-red-500/50 animate-pulse'
              : 'bg-emerald-500/20 ring-2 ring-emerald-500/50'
          }`}>
            {isActive ? (
              <ShieldAlert className="w-5 h-5 text-red-400" />
            ) : (
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            )}
          </div>
          {isActive && (
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 animate-ping" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-white">{userName}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
              isActive
                ? 'bg-red-500/20 text-red-400 animate-pulse'
                : 'bg-emerald-500/20 text-emerald-400'
            }`}>
              {isActive ? 'ACTIVO' : 'RESUELTO'}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {timeAgo(sos.created_at)}
            </span>
            <span>{formatDateTime(sos.created_at)}</span>
          </div>
        </div>
      </div>

      {/* Contact info */}
      <div className="flex flex-wrap gap-2 mb-3">
        {userPhone && (
          <a
            href={`tel:${userPhone}`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 text-gray-300 text-xs hover:bg-white/10 transition-colors"
          >
            <Phone className="w-3 h-3 text-emerald-400" />
            {userPhone}
          </a>
        )}
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-400 text-xs hover:bg-cyan-500/20 transition-colors"
        >
          <MapPin className="w-3 h-3" />
          Ver en Google Maps
          <ExternalLink className="w-2.5 h-2.5" />
        </a>
      </div>

      {/* GPS Coordinates */}
      <div className="bg-white/5 rounded-lg px-3 py-2 mb-3">
        <div className="flex items-center gap-2 text-xs">
          <Navigation className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
          <span className="text-gray-400 font-mono">
            {sos.latitude.toFixed(6)}, {sos.longitude.toFixed(6)}
          </span>
        </div>
      </div>

      {/* Ride info */}
      {ride && (
        <div className="bg-white/[0.03] rounded-lg px-3 py-2 mb-3 text-xs space-y-1">
          <div className="flex items-center gap-1.5 text-gray-500">
            <span className="font-medium text-gray-400">Viaje:</span>
            <span className="font-mono text-cyan-400">{ride.id.slice(0, 8).toUpperCase()}</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
              ['started', 'in_progress'].includes(ride.status || '')
                ? 'bg-cyan-500/15 text-cyan-400'
                : 'bg-gray-500/15 text-gray-400'
            }`}>
              {ride.status}
            </span>
          </div>
          {ride.origin && (
            <div className="text-gray-400">
              <span className="text-emerald-400">De:</span> {ride.origin}
            </div>
          )}
          {ride.destination && (
            <div className="text-gray-400">
              <span className="text-red-400">A:</span> {ride.destination}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      {isActive && (
        <div className="flex items-center gap-2 pt-2 border-t border-white/5">
          <button
            type="button"
            onClick={() => onResolve(sos.id)}
            disabled={resolving === sos.id}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-medium hover:bg-emerald-500/25 transition-all disabled:opacity-50"
          >
            {resolving === sos.id ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" />
            )}
            Resolver SOS
          </button>
        </div>
      )}

      {/* Resolved info */}
      {!isActive && sos.resolved_at && (
        <div className="text-[10px] text-gray-500 pt-2 border-t border-white/5">
          Resuelto: {formatDateTime(sos.resolved_at)}
        </div>
      )}
    </motion.div>
  );
}

/* ─── Empty State ────────────────────────────────────────────────────────── */

function EmptyState({ active }: { active: boolean }) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center py-16 text-gray-500"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${
        active ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-white/5 border border-white/10'
      }`}>
        {active ? (
          <ShieldCheck className="w-8 h-8 text-emerald-500/60" />
        ) : (
          <ShieldAlert className="w-8 h-8 text-gray-600" />
        )}
      </div>
      <p className="text-sm font-medium text-gray-400">
        {active ? 'No hay alertas SOS activas' : 'No hay alertas SOS resueltas'}
      </p>
      <p className="text-xs text-gray-600 mt-1">
        {active
          ? 'Las alertas activas apareceran aqui con animacion y sonido.'
          : 'Los SOS resueltos por los administradores se mostraran aqui.'}
      </p>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export default function DriverAlertsPage() {
  const { session } = useAuthStore();
  const [activeAlerts, setActiveAlerts] = useState<SOSEvent[]>([]);
  const [resolvedAlerts, setResolvedAlerts] = useState<SOSEvent[]>([]);
  const [tab, setTab] = useState<TabKey>('active');
  const [loading, setLoading] = useState(true);
  const [loadingResolved, setLoadingResolved] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [search, setSearch] = useState('');
  const lastAlertCountRef = useRef<number>(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  /* ── Fetch Active SOS ─────────────────────────────────────────────── */
  const fetchActiveAlerts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('sos_events')
        .select(`
          *,
          profiles:user_id(name, phone, email),
          rides:ride_id(id, origin, destination, driver_id, status)
        `)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        const errMsg = error.message || error.code || String(error);
        console.error('Supabase SOS error:', errMsg, 'Code:', error.code, 'Hint:', error.hint);
        toast.error(`Error al cargar alertas: ${errMsg}`);
        return;
      }

      const events = (data || []) as unknown as SOSEvent[];

      // Sound notification for new alerts
      if (events.length > lastAlertCountRef.current && lastAlertCountRef.current > 0 && soundEnabled) {
        playAlertSound();
        toast.error('Nueva alerta SOS recibida', {
          description: `Hay ${events.length - lastAlertCountRef.current} alerta(s) nueva(s)`,
          duration: 5000,
        });
      }
      lastAlertCountRef.current = events.length;

      setActiveAlerts(events);
    } catch (err: any) {
      const raw = JSON.parse(JSON.stringify(err || {}));
      console.error('Error inesperado cargando alertas:', raw);
      toast.error('Error inesperado al cargar alertas SOS');
    } finally {
      setLoading(false);
    }
  }, [soundEnabled]);

  /* ── Fetch Resolved SOS ───────────────────────────────────────────── */
  const fetchResolvedAlerts = useCallback(async () => {
    setLoadingResolved(true);
    try {
      const { data, error } = await supabase
        .from('sos_events')
        .select(`
          *,
          profiles:user_id(name, phone, email),
          rides:ride_id(id, origin, destination, driver_id, status)
        `)
        .eq('status', 'resolved')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        const errMsg = error.message || error.code || String(error);
        console.error('Supabase SOS resolved error:', errMsg, 'Code:', error.code);
        toast.error(`Error al cargar resueltas: ${errMsg}`);
        return;
      }
      setResolvedAlerts((data || []) as unknown as SOSEvent[]);
    } catch (err: any) {
      const raw = JSON.parse(JSON.stringify(err || {}));
      console.error('Error inesperado cargando resueltas:', raw);
      toast.error('Error inesperado al cargar alertas resueltas');
    } finally {
      setLoadingResolved(false);
    }
  }, []);

  /* ── Resolve SOS ──────────────────────────────────────────────────── */
  const resolveSOS = useCallback(async (sosId: string) => {
    setResolvingId(sosId);
    try {
      const token = session?.access_token;
      if (!token) {
        toast.error('No se pudo resolver: sesion no valida');
        return;
      }
      const res = await fetch('/api/sos/resolve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ sos_id: sosId }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Error');

      toast.success('SOS resuelto exitosamente');
      await Promise.all([fetchActiveAlerts(), fetchResolvedAlerts()]);
    } catch (err: unknown) {
      let message = 'Error desconocido';
      if (err instanceof Error) {
        message = (err as any).message || (err as any).msg || (err as any).code || err.message;
      } else if (err && typeof err === 'object') {
        const obj = err as Record<string, any>;
        message = obj.message || obj.msg || obj.error_description || obj.code || '';
        if (!message) { try { message = JSON.stringify(obj); } catch { message = 'Error'; } }
      } else if (typeof err === 'string') {
        message = err;
      }
      console.error('Error resolviendo SOS:', err);
      toast.error(`Error al resolver SOS: ${message}`);
    } finally {
      setResolvingId(null);
    }
  }, [session, fetchActiveAlerts, fetchResolvedAlerts]);

  /* ── Auto-refresh every 10 seconds ───────────────────────────────── */
  useEffect(() => {
    fetchActiveAlerts();
    const interval = setInterval(fetchActiveAlerts, 10000);
    return () => clearInterval(interval);
  }, [fetchActiveAlerts]);

  /* ── Fetch resolved when switching to resolved tab ────────────────── */
  useEffect(() => {
    if (tab === 'resolved' && resolvedAlerts.length === 0) {
      fetchResolvedAlerts();
    }
  }, [tab, resolvedAlerts.length, fetchResolvedAlerts]);

  /* ── Supabase Realtime subscription ───────────────────────────────── */
  useEffect(() => {
    const channel = supabase
      .channel('sos-admin-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sos_events',
          filter: 'status=eq.active',
        },
        () => {
          fetchActiveAlerts();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sos_events',
        },
        () => {
          fetchActiveAlerts();
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchActiveAlerts]);

  /* ── Stats ────────────────────────────────────────────────────────── */
  const stats = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const resolvedToday = resolvedAlerts.filter(a => a.created_at >= todayStart).length;
    const resolvedThisWeek = resolvedAlerts.filter(a => a.created_at >= weekStart).length;

    return {
      active: activeAlerts.length,
      resolvedToday,
      resolvedThisWeek,
      total: activeAlerts.length + resolvedAlerts.length,
    };
  }, [activeAlerts, resolvedAlerts]);

  /* ── Filtered data ────────────────────────────────────────────────── */
  const filteredActive = useMemo(() => {
    if (!search.trim()) return activeAlerts;
    const q = search.toLowerCase();
    return activeAlerts.filter(a =>
      a.profiles?.name?.toLowerCase().includes(q) ||
      a.profiles?.phone?.includes(q) ||
      a.id.toLowerCase().includes(q)
    );
  }, [activeAlerts, search]);

  const filteredResolved = useMemo(() => {
    if (!search.trim()) return resolvedAlerts;
    const q = search.toLowerCase();
    return resolvedAlerts.filter(a =>
      a.profiles?.name?.toLowerCase().includes(q) ||
      a.profiles?.phone?.includes(q) ||
      a.id.toLowerCase().includes(q)
    );
  }, [resolvedAlerts, search]);

  const currentList = tab === 'active' ? filteredActive : filteredResolved;
  const currentLoading = tab === 'active' ? loading : loadingResolved;

  /* ── Stat Cards ───────────────────────────────────────────────────── */
  const statCards = [
    {
      label: 'SOS Activos',
      value: stats.active,
      color: 'text-red-400',
      bg: 'bg-red-500/10',
      icon: ShieldAlert,
      pulse: stats.active > 0,
    },
    {
      label: 'Resueltos Hoy',
      value: stats.resolvedToday,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      icon: ShieldCheck,
      pulse: false,
    },
    {
      label: 'Esta Semana',
      value: stats.resolvedThisWeek,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
      icon: Clock,
      pulse: false,
    },
    {
      label: 'Total Histórico',
      value: stats.total,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      icon: AlertTriangle,
      pulse: false,
    },
  ];

  /* ─── Render ──────────────────────────────────────────────────────────── */

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
        <Link href="/admin" className="hover:text-white transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          Panel
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-white font-medium">Alertas SOS</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            stats.active > 0
              ? 'bg-red-500/20 ring-2 ring-red-500/50'
              : 'bg-cyan-500/20'
          }`}>
            <ShieldAlert className={`w-5 h-5 ${stats.active > 0 ? 'text-red-400' : 'text-cyan-400'}`} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Alertas SOS</h1>
            <p className="text-sm text-gray-500">
              Monitoreo de emergencias en tiempo real
              {stats.active > 0 && (
                <span className="text-red-400 font-medium ml-1">
                  — {stats.active} {stats.active === 1 ? 'activa' : 'activas'}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
              soundEnabled
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'bg-white/5 text-gray-500 border border-white/10'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            Sonido {soundEnabled ? 'ON' : 'OFF'}
          </button>
          <button
            type="button"
            onClick={() => { fetchActiveAlerts(); fetchResolvedAlerts(); }}
            className="px-3 py-2 rounded-lg bg-white/5 text-gray-400 text-xs font-medium flex items-center gap-1.5 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refrescar
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={i}
              className="glass rounded-xl p-4"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">{stat.label}</p>
                <div className={`${stat.bg} p-1.5 rounded-lg`}>
                  <Icon className={`w-3.5 h-3.5 ${stat.color}`} />
                </div>
              </div>
              <p className={`text-2xl font-bold ${stat.color} ${stat.pulse ? 'animate-pulse' : ''}`}>
                {stat.value}
              </p>
            </motion.div>
          );
        })}
      </div>

      {/* Search + Tabs */}
      <div className="glass rounded-2xl p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Buscar por nombre, telefono, ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-cyan-500 text-white placeholder:text-gray-600 outline-none text-sm transition-all"
            />
          </div>
          <div className="flex gap-1 p-1 rounded-xl bg-white/5">
            <button
              type="button"
              onClick={() => setTab('active')}
              className={`px-4 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                tab === 'active'
                  ? 'bg-red-500/20 text-red-400 shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              Activos {stats.active > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                  {stats.active}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setTab('resolved')}
              className={`px-4 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                tab === 'resolved'
                  ? 'bg-emerald-500/20 text-emerald-400 shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Resueltos
            </button>
          </div>
        </div>
      </div>

      {/* Alert List */}
      <motion.div
        className="glass rounded-2xl overflow-hidden"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {currentLoading ? (
          <LoadingSkeleton />
        ) : currentList.length > 0 ? (
          <div className="max-h-[calc(100vh-380px)] overflow-y-auto">
            <AnimatePresence mode="popLayout">
              {currentList.map((sos) => (
                <SOSCard
                  key={sos.id}
                  sos={sos}
                  onResolve={resolveSOS}
                  resolving={resolvingId}
                />
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <EmptyState active={tab === 'active'} />
        )}
      </motion.div>
    </div>
  );
}
