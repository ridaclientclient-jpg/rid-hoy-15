'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Smartphone, CreditCard, CheckCircle, XCircle, Clock,
  RefreshCw, Search, Filter, AlertTriangle, ChevronDown,
  Loader2, MessageSquare, ArrowUpCircle, ArrowDownCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */

interface RechargeRequest {
  id: string;
  user_id: string;
  amount: number;
  method: string;
  sinpe_phone: string | null;
  card_last_four: string | null;
  status: string;
  admin_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  profiles: {
    name: string | null;
    phone: string | null;
    email: string | null;
  } | null;
}

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */

function formatCRC(amount: number): string {
  return `₡${Math.round(amount).toLocaleString('es-CR')}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-CR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function timeAgo(dateStr: string): string {
  const now = new Date().getTime();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Ahora mismo';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `Hace ${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  return `Hace ${diffDay}d`;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  pending: { label: 'Pendiente', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', icon: Clock },
  approved: { label: 'Aprobada', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle },
  rejected: { label: 'Rechazada', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', icon: XCircle },
};

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export default function AdminRecharges() {
  const { session } = useAuthStore();

  const [recharges, setRecharges] = useState<RechargeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string>('pending');
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  /* ── Fetch recharges ───────────────────────────────────── */
  const fetchRecharges = useCallback(async () => {
    try {
      setLoading(true);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

      const params = new URLSearchParams();
      if (activeFilter !== 'all') params.set('status', activeFilter);

      const res = await fetch(`/api/recharges/list?${params.toString()}`, { headers });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Error al cargar');

      setRecharges(data.data || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error de conexion';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [activeFilter, session]);

  useEffect(() => {
    fetchRecharges();
  }, [fetchRecharges]);

  /* ── Approve ───────────────────────────────────────────── */
  const handleApprove = async (id: string) => {
    try {
      setApprovingId(id);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

      const res = await fetch('/api/recharges/approve', {
        method: 'POST',
        headers,
        body: JSON.stringify({ request_id: id }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Error al aprobar');

      toast.success('Recarga aprobada exitosamente');
      fetchRecharges();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error';
      toast.error(msg);
    } finally {
      setApprovingId(null);
    }
  };

  /* ── Reject ────────────────────────────────────────────── */
  const handleReject = async () => {
    if (!rejectingId) return;
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

      const res = await fetch('/api/recharges/reject', {
        method: 'POST',
        headers,
        body: JSON.stringify({ request_id: rejectingId, reason: rejectReason.trim() || null }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Error al rechazar');

      toast.success('Recarga rechazada');
      setRejectingId(null);
      setRejectReason('');
      fetchRecharges();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error';
      toast.error(msg);
    }
  };

  /* ── Filtered data ─────────────────────────────────────── */
  const filtered = searchTerm.trim()
    ? recharges.filter(r =>
        r.profiles?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.profiles?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.sinpe_phone?.includes(searchTerm) ||
        r.amount.toString().includes(searchTerm)
      )
    : recharges;

  /* ── Stats ─────────────────────────────────────────────── */
  const pendingCount = recharges.filter(r => r.status === 'pending').length;
  const pendingTotal = recharges.filter(r => r.status === 'pending').reduce((s, r) => s + Number(r.amount), 0);
  const approvedCount = recharges.filter(r => r.status === 'approved').length;
  const rejectedCount = recharges.filter(r => r.status === 'rejected').length;

  /* ═══════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            Recargas SINPE
          </h1>
          <p className="text-sm text-gray-400 mt-1">Gestiona las solicitudes de recarga de billetera</p>
        </div>
        <button
          onClick={fetchRecharges}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl glass border border-white/10 text-sm text-gray-300 hover:text-white hover:border-cyan-500/30 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="glass rounded-2xl p-4 border border-amber-500/20">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-gray-400">Pendientes</span>
          </div>
          <p className="text-2xl font-bold text-amber-400">{pendingCount}</p>
          <p className="text-xs text-gray-500 mt-1">Total: {formatCRC(pendingTotal)}</p>
        </div>
        <div className="glass rounded-2xl p-4 border border-emerald-500/20">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-gray-400">Aprobadas</span>
          </div>
          <p className="text-2xl font-bold text-emerald-400">{approvedCount}</p>
        </div>
        <div className="glass rounded-2xl p-4 border border-red-500/20">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-4 h-4 text-red-400" />
            <span className="text-xs text-gray-400">Rechazadas</span>
          </div>
          <p className="text-2xl font-bold text-red-400">{rejectedCount}</p>
        </div>
        <div className="glass rounded-2xl p-4 border border-cyan-500/20">
          <div className="flex items-center gap-2 mb-2">
            <ArrowUpCircle className="w-4 h-4 text-cyan-400" />
            <span className="text-xs text-gray-400">Total solicitudes</span>
          </div>
          <p className="text-2xl font-bold text-cyan-400">{recharges.length}</p>
        </div>
      </div>

      {/* Filters + Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-2 flex-wrap">
          {[
            { key: 'pending', label: 'Pendientes' },
            { key: 'approved', label: 'Aprobadas' },
            { key: 'rejected', label: 'Rechazadas' },
            { key: 'all', label: 'Todas' },
          ].map(f => {
            const count = f.key === 'all'
              ? recharges.length
              : recharges.filter(r => r.status === f.key).length;
            return (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  activeFilter === f.key
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : 'glass text-gray-400 border border-white/10 hover:text-white'
                }`}
              >
                {f.label}
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${
                  activeFilter === f.key ? 'bg-cyan-500/20' : 'bg-white/5'
                }`}>{count}</span>
              </button>
            );
          })}
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre, email, telefono o monto..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-gray-600 outline-none focus:border-cyan-500/30 transition-colors"
          />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
        </div>
      ) : filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((req) => {
            const statusCfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
            const StatusIcon = statusCfg.icon;
            const isPending = req.status === 'pending';

            return (
              <motion.div
                key={req.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className={`glass rounded-2xl p-4 border transition-all ${
                  isPending ? 'border-amber-500/20' : 'border-white/5'
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Method icon */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    req.method === 'sinpe'
                      ? 'bg-gradient-to-br from-amber-500 to-orange-400'
                      : 'bg-gradient-to-br from-purple-500 to-violet-400'
                  }`}>
                    {req.method === 'sinpe'
                      ? <Smartphone className="w-5 h-5 text-white" />
                      : <CreditCard className="w-5 h-5 text-white" />
                    }
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-white">
                        {req.profiles?.name || 'Usuario'}
                      </p>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium border ${statusCfg.bg} ${statusCfg.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusCfg.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-gray-500">
                      {req.profiles?.email && (
                        <span>{req.profiles.email}</span>
                      )}
                      {req.profiles?.phone && (
                        <span>{req.profiles.phone}</span>
                      )}
                      {req.sinpe_phone && (
                        <span className="text-amber-400/70">
                          SINPE: +506 {req.sinpe_phone}
                        </span>
                      )}
                      {req.card_last_four && (
                        <span className="text-purple-400/70">
                          Tarjeta: ****{req.card_last_four}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                      <span>{formatDate(req.created_at)}</span>
                      <span>({timeAgo(req.created_at)})</span>
                    </div>

                    {/* Admin note for rejected */}
                    {req.admin_note && (
                      <div className="mt-2 flex items-start gap-1.5 p-2 rounded-lg bg-red-500/5 border border-red-500/10">
                        <MessageSquare className="w-3 h-3 text-red-400 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-red-400">{req.admin_note}</p>
                      </div>
                    )}
                  </div>

                  {/* Amount + Actions */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <p className="text-lg font-bold text-white">{formatCRC(req.amount)}</p>

                    {isPending && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApprove(req.id)}
                          disabled={approvingId === req.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
                        >
                          {approvingId === req.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <CheckCircle className="w-3 h-3" />
                          )}
                          Aprobar
                        </button>
                        <button
                          onClick={() => setRejectingId(req.id)}
                          disabled={rejectingId !== null}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/20 text-red-400 text-xs font-semibold hover:bg-red-500/30 transition-colors disabled:opacity-50"
                        >
                          <XCircle className="w-3 h-3" />
                          Rechazar
                        </button>
                      </div>
                    )}

                    {req.reviewed_at && (
                      <p className="text-[10px] text-gray-600">
                        Revisado: {formatDate(req.reviewed_at)}
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
            <Smartphone className="w-8 h-8 text-gray-600" />
          </div>
          <p className="text-sm text-gray-400">
            {searchTerm ? 'No se encontraron resultados' : 'No hay solicitudes de recarga'}
          </p>
          <p className="text-xs text-gray-600 mt-1">
            {searchTerm ? 'Intenta con otro termino de busqueda' : 'Las solicitudes apareceran aqui cuando los usuarios hagan recargas'}
          </p>
        </div>
      )}

      {/* Reject Modal */}
      <AnimatePresence>
        {rejectingId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
            onClick={() => { setRejectingId(null); setRejectReason(''); }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="glass-strong rounded-2xl p-6 w-full max-w-md border border-red-500/20"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Rechazar recarga</h3>
                  <p className="text-xs text-gray-400">Esta accion no se puede deshacer</p>
                </div>
              </div>

              <div className="space-y-3 mb-5">
                <p className="text-xs text-gray-400">Motivo del rechazo (opcional):</p>
                <textarea
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  placeholder="Ejemplo: No se recibio el SINPE correspondiente..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-gray-600 outline-none focus:border-red-500/30 resize-none transition-colors"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setRejectingId(null); setRejectReason(''); }}
                  className="flex-1 py-2.5 rounded-xl glass text-sm text-gray-300 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleReject}
                  disabled={!rejectReason.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-red-500/20 text-red-400 text-sm font-semibold hover:bg-red-500/30 transition-colors disabled:opacity-50"
                >
                  Rechazar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
