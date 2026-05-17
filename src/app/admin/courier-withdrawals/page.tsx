'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet, Clock, CheckCircle2, XCircle, ArrowLeft, ChevronRight,
  Loader2, Search, Eye, CreditCard, AlertTriangle, Ban,
  DollarSign, RefreshCw, Filter, ChevronDown, X,
} from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface WithdrawalRequest {
  id: string;
  courier_id: string;
  courier_name: string;
  amount: number;
  status: string;
  sinpe_number: string | null;
  created_at: string;
  processable_at: string;
  processed_at: string | null;
  rejection_reason: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  queued: { label: 'En Cola', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: Clock },
  processing: { label: 'Procesando', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: Loader2 },
  completed: { label: 'Completado', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: CheckCircle2 },
  rejected: { label: 'Rechazado', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: XCircle },
  cancelled: { label: 'Cancelado', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', icon: Ban },
};

export default function AdminCourierWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedWd, setSelectedWd] = useState<WithdrawalRequest | null>(null);
  const [rejectModalId, setRejectModalId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const fetchWithdrawals = useCallback(async () => {
    setLoading(true);
    try {
      // Try RPC first
      const { data: rpcData, error: rpcError } = await supabase.rpc('list_courier_withdrawals', {
        p_status: filter === 'all' ? null : filter,
        p_limit: 100,
      });

      if (!rpcError && rpcData) {
        setWithdrawals(rpcData as WithdrawalRequest[]);
      } else {
        // Fallback: direct query
        let query = supabase
          .from('withdrawal_requests')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);

        if (filter !== 'all') {
          query = query.eq('status', filter);
        }

        const { data, error } = await query;

        if (error) throw error;

        // Enrich with courier names
        const enriched = await Promise.all(
          (data || []).map(async (wd: any) => {
            let courierName = 'Desconocido';
            if (wd.courier_id) {
              const { data: courier } = await supabase
                .from('couriers')
                .select('user_id')
                .eq('id', wd.courier_id)
                .single();
              if (courier?.user_id) {
                const { data: profile } = await supabase
                  .from('profiles')
                  .select('name')
                  .eq('id', courier.user_id)
                  .single();
                if (profile) courierName = profile.name;
              }
            }
            return { ...wd, courier_name: courierName };
          })
        );
        setWithdrawals(enriched);
      }
    } catch (err) {
      console.error('Error fetching withdrawals:', err);
      toast.error('Error al cargar retiros');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchWithdrawals();
  }, [fetchWithdrawals]);

  const handleApprove = async (id: string) => {
    setProcessingId(id);
    try {
      const { data: rpcResult, error: rpcError } = await supabase.rpc('complete_courier_withdrawal', {
        p_request_id: id,
      });

      if (rpcError) throw rpcError;

      if (rpcResult?.error) {
        toast.error(rpcResult.error);
        return;
      }

      toast.success('Retiro completado exitosamente');
      setSelectedWd(null);
      fetchWithdrawals();
    } catch (err: any) {
      console.error('Approve error:', err);
      toast.error('Error al completar retiro: ' + (err.message || ''));
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!rejectReason.trim()) {
      toast.error('Ingresa un motivo de rechazo');
      return;
    }

    setProcessingId(id);
    try {
      const { data: rpcResult, error: rpcError } = await supabase.rpc('reject_courier_withdrawal', {
        p_request_id: id,
        p_reason: rejectReason.trim(),
      });

      if (rpcError) throw rpcError;

      if (rpcResult?.error) {
        toast.error(rpcResult.error);
        return;
      }

      toast.success('Retiro rechazado');
      setRejectModalId(null);
      setRejectReason('');
      setSelectedWd(null);
      fetchWithdrawals();
    } catch (err: any) {
      console.error('Reject error:', err);
      toast.error('Error al rechazar retiro: ' + (err.message || ''));
    } finally {
      setProcessingId(null);
    }
  };

  const filtered = withdrawals.filter((wd) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return wd.courier_name?.toLowerCase().includes(s) || wd.id.toLowerCase().includes(s);
  });

  const totalAmount = withdrawals.reduce((sum, wd) => sum + (wd.amount || 0), 0);
  const queuedCount = withdrawals.filter(w => w.status === 'queued').length;
  const processingCount = withdrawals.filter(w => w.status === 'processing').length;
  const completedAmount = withdrawals.filter(w => w.status === 'completed').reduce((sum, w) => sum + (w.amount || 0), 0);

  const formatCurrency = (amount: number) => `₡${Math.round(amount || 0).toLocaleString()}`;
  const formatDate = (date: string) => new Date(date).toLocaleDateString('es-CR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const isProcessable = (date: string) => new Date(date) <= new Date();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <Wallet className="w-8 h-8 text-emerald-400" />
            Retiros Repartidores
          </h1>
          <p className="text-gray-400 mt-1">Gestiona solicitudes de retiro de courier</p>
        </div>
        <button
          onClick={fetchWithdrawals}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl glass text-sm text-gray-300 hover:text-white hover:bg-white/10 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/admin" className="hover:text-white transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Panel
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-white font-medium">Retiros Repartidores</span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'En Cola', value: queuedCount, color: 'text-amber-400', icon: Clock, gradient: 'from-amber-600 to-orange-500' },
          { label: 'Procesando', value: processingCount, color: 'text-blue-400', icon: Loader2, gradient: 'from-blue-600 to-cyan-500' },
          { label: 'Total Solicitudes', value: formatCurrency(totalAmount), color: 'text-white', icon: DollarSign, gradient: 'from-purple-600 to-pink-500' },
          { label: 'Total Completados', value: formatCurrency(completedAmount), color: 'text-emerald-400', icon: CheckCircle2, gradient: 'from-emerald-600 to-green-500' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass rounded-2xl p-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400">{stat.label}</p>
                <p className={`text-xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
              </div>
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center`}>
                <stat.icon className="w-5 h-5 text-white" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Filters + Search */}
      <div className="glass rounded-2xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Buscar por nombre o ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-emerald-500 text-white placeholder:text-gray-600 outline-none text-sm"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {['all', 'queued', 'processing', 'completed', 'rejected'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  filter === f
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                }`}
              >
                {f === 'all' ? 'Todos' : STATUS_CONFIG[f]?.label || f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Withdrawal List */}
      <div className="space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Wallet className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500">No hay solicitudes de retiro</p>
          </div>
        ) : (
          <AnimatePresence>
            {filtered.map((wd, i) => {
              const sc = STATUS_CONFIG[wd.status] || STATUS_CONFIG.queued;
              const StatusIcon = sc.icon;
              const canApprove = (wd.status === 'queued' || wd.status === 'processing') && isProcessable(wd.processable_at);

              return (
                <motion.div
                  key={wd.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="glass rounded-xl p-4 hover:bg-white/[0.07] transition-all group"
                >
                  <div className="flex items-center gap-4">
                    {/* Amount */}
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-600/20 to-cyan-600/20 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                      <CreditCard className="w-6 h-6 text-emerald-400" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-white truncate">{wd.courier_name || 'Courier'}</h3>
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-medium border ${sc.color}`}>
                          <StatusIcon className="w-3 h-3 inline mr-0.5" />
                          {sc.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span>{formatCurrency(wd.amount)}</span>
                        <span className="text-gray-700">|</span>
                        <span>Solicitado: {formatDate(wd.created_at)}</span>
                        {!isProcessable(wd.processable_at) && wd.status === 'queued' && (
                          <>
                            <span className="text-gray-700">|</span>
                            <span className="text-amber-400">Procesable: {formatDate(wd.processable_at)}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Amount display */}
                    <div className="text-right hidden sm:block">
                      <p className="text-lg font-bold text-white">{formatCurrency(wd.amount)}</p>
                      <p className="text-[10px] text-gray-500">#{wd.id.slice(-6)}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => setSelectedWd(wd)}
                        className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {canApprove && (
                        <>
                          <button
                            onClick={() => handleApprove(wd.id)}
                            disabled={processingId === wd.id}
                            className="px-3 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-medium hover:bg-emerald-500/30 transition-all flex items-center gap-1 disabled:opacity-50"
                          >
                            {processingId === wd.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                            <span className="hidden sm:inline">Completar</span>
                          </button>
                          <button
                            onClick={() => setRejectModalId(wd.id)}
                            disabled={processingId === wd.id}
                            className="px-3 py-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-medium hover:bg-red-500/30 transition-all flex items-center gap-1 disabled:opacity-50"
                          >
                            <XCircle className="w-3 h-3" />
                            <span className="hidden sm:inline">Rechazar</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedWd && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/60" onClick={() => setSelectedWd(null)} />
            <motion.div
              className="relative glass-strong rounded-2xl p-6 w-full max-w-md z-10"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-white">Detalle del Retiro</h2>
                <button onClick={() => setSelectedWd(null)} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="text-center py-4">
                  <p className="text-3xl font-bold text-white">{formatCurrency(selectedWd.amount)}</p>
                  <span className={`inline-flex items-center gap-1 mt-2 px-3 py-1 rounded-lg text-xs font-medium border ${STATUS_CONFIG[selectedWd.status]?.color}`}>
                    {(() => { const I = STATUS_CONFIG[selectedWd.status]?.icon || Clock; return <I className="w-3 h-3" />; })()}
                    {STATUS_CONFIG[selectedWd.status]?.label || selectedWd.status}
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Repartidor</span>
                    <span className="text-white font-medium">{selectedWd.courier_name || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">ID Solicitud</span>
                    <span className="text-white font-mono text-xs">#{selectedWd.id.slice(-8)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Fecha solicitud</span>
                    <span className="text-white">{formatDate(selectedWd.created_at)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Procesable desde</span>
                    <span className={isProcessable(selectedWd.processable_at) ? 'text-emerald-400' : 'text-amber-400'}>
                      {formatDate(selectedWd.processable_at)}
                    </span>
                  </div>
                  {selectedWd.processed_at && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Procesado el</span>
                      <span className="text-white">{formatDate(selectedWd.processed_at)}</span>
                    </div>
                  )}
                  {selectedWd.rejection_reason && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Motivo rechazo</span>
                      <span className="text-red-400">{selectedWd.rejection_reason}</span>
                    </div>
                  )}
                  {selectedWd.sinpe_number && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">SINPE</span>
                      <span className="text-white">{selectedWd.sinpe_number}</span>
                    </div>
                  )}
                </div>

                {(selectedWd.status === 'queued' || selectedWd.status === 'processing') && (
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    {isProcessable(selectedWd.processable_at) ? (
                      <>
                        <button
                          onClick={() => handleApprove(selectedWd.id)}
                          disabled={processingId === selectedWd.id}
                          className="py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {processingId === selectedWd.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                          Completar
                        </button>
                        <button
                          onClick={() => { setRejectModalId(selectedWd.id); setSelectedWd(null); }}
                          className="py-2.5 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/30 transition-all flex items-center justify-center gap-2"
                        >
                          <XCircle className="w-4 h-4" /> Rechazar
                        </button>
                      </>
                    ) : (
                      <div className="col-span-2 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-medium text-center flex items-center justify-center gap-2">
                        <Clock className="w-4 h-4" />
                        Procesable desde {formatDate(selectedWd.processable_at)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reject Modal */}
      <AnimatePresence>
        {rejectModalId && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/60" onClick={() => { setRejectModalId(null); setRejectReason(''); }} />
            <motion.div
              className="relative glass-strong rounded-2xl p-6 w-full max-w-sm z-10"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  Rechazar Retiro
                </h2>
                <button onClick={() => { setRejectModalId(null); setRejectReason(''); }} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-400 block mb-1.5">Motivo del rechazo</label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Ingresa el motivo..."
                    rows={3}
                    className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-red-500 text-white placeholder:text-gray-600 outline-none text-sm resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => { setRejectModalId(null); setRejectReason(''); }}
                    className="py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm font-medium hover:bg-white/10 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => handleReject(rejectModalId)}
                    disabled={processingId === rejectModalId || !rejectReason.trim()}
                    className="py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {processingId === rejectModalId ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Rechazar
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
