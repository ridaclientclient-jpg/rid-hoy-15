'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, AlertTriangle, CheckCircle2, XCircle, Ban, Eye, Search,
  RefreshCw, Clock, DollarSign, TrendingUp, Wallet, Users, Tag,
  ChevronDown, ChevronUp, Info, Loader2, ArrowLeft, ChevronRight,
  ShieldAlert, Package, Store, User, Phone, CreditCard, Unlock,
  CircleDot
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import type { MarketplaceDelivery, MarketplaceOrdersDashboard } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';

// ─── Helpers ──────────────────────────────────────────────────────
function formatCRC(amount: number): string {
  return `₡${Math.round(amount || 0).toLocaleString('es-CR')}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-CR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  }) + ' ' + d.toLocaleTimeString('es-CR', {
    hour: '2-digit', minute: '2-digit',
  });
}

function shortId(id: string): string {
  return '#ORD-' + id.slice(-6).toUpperCase();
}

// ─── Risk Score Helpers ──────────────────────────────────────────
function getRiskLevel(score: number): 'critical' | 'high' | 'medium' | 'low' {
  if (score >= 60) return 'critical';
  if (score >= 40) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
}

const riskBadgeConfig: Record<string, { label: string; classes: string }> = {
  critical: {
    label: 'CRITICO',
    classes: 'bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse',
  },
  high: {
    label: 'ALTO',
    classes: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
  },
  medium: {
    label: 'MEDIO',
    classes: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  },
  low: {
    label: 'BAJO',
    classes: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  },
};

const paymentStatusColors: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  processing: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  completed: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  failed: 'bg-red-500/15 text-red-400 border-red-500/30',
};

const paymentStatusLabels: Record<string, string> = {
  pending: 'Pendiente',
  processing: 'Procesando',
  completed: 'Completado',
  failed: 'Fallido',
};

const deliveryStatusColors: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  assigned: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  picked_up: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  in_transit: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  delivered: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  cancelled: 'bg-red-500/15 text-red-400 border-red-500/30',
};

const deliveryStatusLabels: Record<string, string> = {
  pending: 'Pendiente',
  assigned: 'Asignado',
  picked_up: 'Recogido',
  in_transit: 'En Camino',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

const reviewStatusColors: Record<string, string> = {
  under_review: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  flagged: 'bg-red-500/15 text-red-400 border-red-500/30',
  blocked: 'bg-red-600/15 text-red-300 border-red-600/30',
  approved: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  rejected: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
};

const reviewStatusLabels: Record<string, string> = {
  under_review: 'En Revision',
  flagged: 'Marcado',
  blocked: 'Bloqueado',
  approved: 'Aprobado',
  rejected: 'Rechazado',
};

type FilterOption = 'all' | 'under_review' | 'flagged' | 'blocked';
type SortOption = 'score_desc' | 'date_desc' | 'amount_desc';

const filterTabs: { key: FilterOption; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'under_review', label: 'En Revision' },
  { key: 'flagged', label: 'Marcados' },
  { key: 'blocked', label: 'Bloqueados' },
];

// ─── Skeleton ────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-56 bg-white/5 rounded-lg mb-2" />
          <div className="h-4 w-48 bg-white/5 rounded" />
        </div>
        <div className="h-10 w-48 bg-white/5 rounded-xl" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="glass rounded-2xl p-4">
            <div className="w-10 h-10 rounded-xl bg-white/5 mb-3" />
            <div className="h-3 w-24 bg-white/5 rounded mb-2" />
            <div className="h-6 w-20 bg-white/5 rounded" />
          </div>
        ))}
      </div>
      <div className="glass rounded-2xl p-4">
        <div className="flex gap-3 mb-4">
          <div className="flex-1 h-10 bg-white/5 rounded-xl" />
          <div className="h-10 w-32 bg-white/5 rounded-xl" />
          <div className="h-10 w-32 bg-white/5 rounded-xl" />
        </div>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 bg-white/5 rounded-xl mb-3 last:mb-0" />
        ))}
      </div>
    </div>
  );
}

// ─── Animation Variants ──────────────────────────────────────────
const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

// ─── Main Page ───────────────────────────────────────────────────
export default function SuspiciousOrdersPage() {
  const { user } = useAuthStore();
  const userId = user?.id || '';

  // Data
  const [dashboard, setDashboard] = useState<MarketplaceOrdersDashboard | null>(null);
  const [orders, setOrders] = useState<MarketplaceDelivery[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [releasingFunds, setReleasingFunds] = useState(false);

  // Filters
  const [selectedFilter, setSelectedFilter] = useState<FilterOption>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('score_desc');

  // Detail modal
  const [selectedOrder, setSelectedOrder] = useState<MarketplaceDelivery | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ─── Fetch Data ────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [dashRes, ordersRes] = await Promise.all([
        supabase.rpc('get_marketplace_orders_dashboard'),
        supabase.rpc('get_suspicious_marketplace_orders', {
          p_limit: 50,
          p_status: selectedFilter === 'all' ? null : selectedFilter,
        }),
      ]);

      if (dashRes.data) {
        setDashboard(dashRes.data as MarketplaceOrdersDashboard);
      }
      if (ordersRes.data) {
        setOrders(ordersRes.data as MarketplaceDelivery[]);
      }
    } catch (err) {
      console.error('Error loading suspicious orders:', err);
      toast.error('Error al cargar pedidos sospechosos');
    } finally {
      setIsLoading(false);
    }
  }, [selectedFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Release Funds ─────────────────────────────────────────────
  const handleReleaseFunds = async () => {
    setReleasingFunds(true);
    try {
      const { data, error } = await supabase.rpc('release_marketplace_funds');
      if (error) {
        toast.error('Error al liberar fondos: ' + error.message);
        return;
      }
      const count = data as number;
      toast.success(`${count} transacciones liberadas exitosamente`);
      fetchData();
    } catch (err) {
      console.error('Error releasing funds:', err);
      toast.error('Error al liberar fondos');
    } finally {
      setReleasingFunds(false);
    }
  };

  // ─── Review Order ──────────────────────────────────────────────
  const handleReview = async (orderId: string, action: 'approve' | 'reject' | 'block') => {
    if (!userId) {
      toast.error('No se pudo identificar al administrador');
      return;
    }

    setActionLoading(orderId);
    try {
      const { data, error } = await supabase.rpc('admin_review_marketplace_order', {
        p_delivery_id: orderId,
        p_action: action,
        p_reviewer_id: userId,
      });

      if (error) {
        toast.error('Error: ' + error.message);
        return;
      }

      const success = data as boolean;
      if (success) {
        const actionLabels = {
          approve: 'Pedido aprobado',
          reject: 'Comision rechazada',
          block: 'Pedido bloqueado',
        };
        toast.success(actionLabels[action]);

        // Remove from local list or update
        if (action === 'block') {
          setOrders((prev) => prev.filter((o) => o.id !== orderId));
        }
        if (selectedOrder?.id === orderId) {
          setSelectedOrder(null);
        }
        fetchData();
      } else {
        toast.error('No se pudo procesar la accion');
      }
    } catch (err) {
      console.error('Error reviewing order:', err);
      toast.error('Error al procesar la accion');
    } finally {
      setActionLoading(null);
    }
  };

  // ─── Filtered & Sorted ─────────────────────────────────────────
  const filteredOrders = useMemo(() => {
    let result = [...orders];

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((o) =>
        o.id.toLowerCase().includes(q) ||
        (o.customer_name || '').toLowerCase().includes(q) ||
        shortId(o.id).toLowerCase().includes(q)
      );
    }

    // Sort
    switch (sortBy) {
      case 'score_desc':
        result.sort((a, b) => (b.fraud_score || 0) - (a.fraud_score || 0));
        break;
      case 'date_desc':
        result.sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime());
        break;
      case 'amount_desc':
        result.sort((a, b) => (b.total || 0) - (a.total || 0));
        break;
    }

    return result;
  }, [orders, searchQuery, sortBy]);

  // ─── KPI Cards Config ─────────────────────────────────────────
  const kpiCards = dashboard ? [
    {
      label: 'En Revision',
      value: dashboard.under_review,
      icon: Eye,
      color: 'amber',
      classes: 'border-amber-500/20',
    },
    {
      label: 'Marcados',
      value: dashboard.flagged,
      icon: AlertTriangle,
      color: 'red',
      classes: 'border-red-500/20',
    },
    {
      label: 'Bloqueados',
      value: dashboard.blocked,
      icon: Ban,
      color: 'red-dark',
      classes: 'border-red-600/20',
    },
    {
      label: 'Comisiones Pendientes',
      value: formatCRC(dashboard.pending_commissions),
      icon: DollarSign,
      color: 'cyan',
      classes: 'border-cyan-500/20',
    },
    {
      label: 'Comisiones Totales',
      value: formatCRC(dashboard.total_revenue),
      icon: TrendingUp,
      color: 'emerald',
      classes: 'border-emerald-500/20',
    },
    {
      label: 'Ganancias Vendors Pend.',
      value: formatCRC(dashboard.pending_vendor_earnings),
      icon: Wallet,
      color: 'blue',
      classes: 'border-blue-500/20',
    },
  ] : [];

  const iconColorMap: Record<string, string> = {
    amber: 'bg-amber-500/15 text-amber-400',
    red: 'bg-red-500/15 text-red-400',
    'red-dark': 'bg-red-600/15 text-red-300',
    cyan: 'bg-cyan-500/15 text-cyan-400',
    emerald: 'bg-emerald-500/15 text-emerald-400',
    blue: 'bg-blue-500/15 text-blue-400',
  };

  const valueColorMap: Record<string, string> = {
    amber: 'text-amber-400',
    red: 'text-red-400',
    'red-dark': 'text-red-300',
    cyan: 'text-cyan-400',
    emerald: 'text-emerald-400',
    blue: 'text-blue-400',
  };

  // ─── Loading State ─────────────────────────────────────────────
  if (isLoading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <LoadingSkeleton />
      </motion.div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────
  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* ── Breadcrumb ── */}
      <Link
        href="/admin/marketplace"
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-cyan-400 transition-colors group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        <span>Marketplace</span>
        <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
        <span className="text-cyan-400">Sospechosos</span>
      </Link>

      {/* ── Header ── */}
      <motion.div
        variants={item}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center flex-shrink-0">
              <Shield className="w-5 h-5 text-red-400" />
            </div>
            Pedidos Sospechosos
          </h1>
          <p className="text-gray-400 text-sm mt-1">Revision anti-fraude de marketplace</p>
        </div>
        <div className="flex items-center gap-3 self-start">
          <motion.button
            type="button"
            onClick={handleReleaseFunds}
            disabled={releasingFunds}
            whileHover={{ scale: releasingFunds ? 1 : 1.03 }}
            whileTap={{ scale: releasingFunds ? 1 : 0.97 }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-emerald-600 to-green-600 text-white shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {releasingFunds ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Unlock className="w-4 h-4" />
            )}
            {releasingFunds ? 'Liberando...' : 'Liberar Fondos (48h)'}
          </motion.button>
          <motion.button
            type="button"
            onClick={fetchData}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Actualizar
          </motion.button>
        </div>
      </motion.div>

      {/* ── KPI Cards (2x3 grid) ── */}
      <motion.div variants={item} className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {kpiCards.map((kpi, i) => (
          <motion.div
            key={kpi.label}
            className={`glass rounded-2xl p-4 border ${kpi.classes} transition-all duration-300`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + i * 0.05 }}
            whileHover={{ y: -2 }}
          >
            <div className={`w-10 h-10 rounded-xl ${iconColorMap[kpi.color]} flex items-center justify-center mb-3`}>
              <kpi.icon className="w-5 h-5" />
            </div>
            <p className={`text-xl sm:text-2xl font-bold ${valueColorMap[kpi.color]}`}>{kpi.value}</p>
            <p className="text-[11px] text-gray-500 uppercase tracking-wider mt-0.5">{kpi.label}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* ── Filter Bar ── */}
      <motion.div variants={item} className="glass rounded-2xl p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Buscar por ID o nombre del cliente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-red-500/50 transition-colors"
            />
          </div>

          {/* Review Status Filter */}
          <div className="relative">
            <select
              value={selectedFilter}
              onChange={(e) => setSelectedFilter(e.target.value as FilterOption)}
              className="appearance-none pl-3 pr-8 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-red-500/50 cursor-pointer w-full sm:w-auto"
            >
              {filterTabs.map((tab) => (
                <option key={tab.key} value={tab.key} className="bg-[#0d1117] text-white">
                  {tab.label}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500" />
          </div>

          {/* Sort */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="appearance-none pl-3 pr-8 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-red-500/50 cursor-pointer w-full sm:w-auto"
            >
              <option value="score_desc" className="bg-[#0d1117] text-white">Score (desc)</option>
              <option value="date_desc" className="bg-[#0d1117] text-white">Fecha (desc)</option>
              <option value="amount_desc" className="bg-[#0d1117] text-white">Monto (desc)</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500" />
          </div>
        </div>

        {/* Filter tabs (mobile friendly) */}
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1 scrollbar-none">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setSelectedFilter(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 whitespace-nowrap border ${
                selectedFilter === tab.key
                  ? 'bg-red-500/15 text-red-400 border-red-500/30'
                  : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
              }`}
            >
              {tab.label}
              {tab.key !== 'all' && dashboard && (
                <span className="text-[10px] opacity-60">
                  ({dashboard[tab.key === 'under_review' ? 'under_review' : tab.key as keyof MarketplaceOrdersDashboard] as number || 0})
                </span>
              )}
            </button>
          ))}
        </div>
      </motion.div>

      {/* ── Orders List ── */}
      <motion.div variants={item} className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-red-400" />
            Pedidos Sospechosos
          </h3>
          <span className="text-xs text-gray-500">{filteredOrders.length} resultado{filteredOrders.length !== 1 ? 's' : ''}</span>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="glass rounded-2xl text-center py-16">
            <ShieldAlert className="w-12 h-12 text-gray-700 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No hay pedidos sospechosos con los filtros actuales</p>
            <p className="text-xs text-gray-600 mt-1">Los pedidos sospechosos se detectan automaticamente por el sistema anti-fraude</p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {filteredOrders.map((order, i) => {
                const risk = getRiskLevel(order.fraud_score || 0);
                const badge = riskBadgeConfig[risk];
                return (
                  <motion.div
                    key={order.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: Math.min(i * 0.03, 0.3) }}
                    className="glass rounded-2xl p-4 sm:p-5 space-y-3 hover:bg-white/[0.03] transition-colors cursor-pointer"
                    onClick={() => setSelectedOrder(order)}
                  >
                    {/* Top row: Risk badge + ID + Date */}
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        {/* Risk Score Badge */}
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold ${badge.classes}`}>
                          <ShieldAlert className="w-3.5 h-3.5" />
                          {badge.label}
                          <span className="opacity-80">({order.fraud_score || 0})</span>
                        </span>

                        {/* Order ID */}
                        <span className="text-sm font-mono text-gray-300">{shortId(order.id)}</span>

                        {/* Review status badge */}
                        {order.review_status && (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${reviewStatusColors[order.review_status] || reviewStatusColors.flagged}`}>
                            {reviewStatusLabels[order.review_status] || order.review_status}
                          </span>
                        )}
                      </div>

                      <span className="text-[11px] text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {order.created_at ? formatDate(order.created_at) : 'N/A'}
                      </span>
                    </div>

                    {/* Customer + Vendor + Total */}
                    <div className="flex items-center gap-4 flex-wrap text-sm">
                      <div className="flex items-center gap-1.5 text-gray-300">
                        <User className="w-3.5 h-3.5 text-gray-500" />
                        <span className="font-medium">{order.customer_name || 'Sin nombre'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-gray-500">
                        <Store className="w-3.5 h-3.5" />
                        <span>{order.vendor_name || 'Sin vendedor'}</span>
                      </div>
                      <div className="ml-auto text-emerald-400 font-semibold">
                        {formatCRC(order.total)}
                      </div>
                    </div>

                    {/* Fraud Reasons */}
                    {order.fraud_reasons && order.fraud_reasons.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {order.fraud_reasons.map((reason, ri) => (
                          <span
                            key={ri}
                            className="bg-red-500/10 text-red-300 text-[10px] px-2 py-0.5 rounded-full border border-red-500/10"
                          >
                            {reason}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Commission Info */}
                    <div className="flex items-center gap-4 flex-wrap text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        Comision: {order.commission_rate || 0}%
                      </span>
                      <span className="text-cyan-400">
                        Comision: {formatCRC(order.commission || 0)}
                      </span>
                      <span className="text-blue-400">
                        Vendor: {formatCRC(order.vendor_earning || 0)}
                      </span>

                      {/* Payment status */}
                      {order.payment_status && (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${paymentStatusColors[order.payment_status] || ''}`}>
                          {paymentStatusLabels[order.payment_status] || order.payment_status}
                        </span>
                      )}

                      {/* Order status */}
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${deliveryStatusColors[order.status] || deliveryStatusColors.pending}`}>
                        {deliveryStatusLabels[order.status] || order.status}
                      </span>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-2 border-t border-white/5">
                      <motion.button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReview(order.id, 'approve');
                        }}
                        disabled={actionLoading === order.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                      >
                        {actionLoading === order.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        Aprobar
                      </motion.button>
                      <motion.button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReview(order.id, 'reject');
                        }}
                        disabled={actionLoading === order.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Rechazar comision
                      </motion.button>
                      <motion.button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReview(order.id, 'block');
                        }}
                        disabled={actionLoading === order.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-red-600/10 text-red-300 border border-red-600/20 hover:bg-red-600/20 transition-colors disabled:opacity-50"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        Bloquear pedido
                      </motion.button>
                      <motion.button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedOrder(order);
                        }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Ver Detalle
                      </motion.button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </motion.div>

      {/* ── Order Detail Modal ── */}
      <AnimatePresence>
        {selectedOrder && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setSelectedOrder(null)}
            />

            <motion.div
              className="relative w-full max-w-2xl glass-strong rounded-2xl z-10 max-h-[90vh] overflow-y-auto scrollbar-thin"
              initial={{ scale: 0.92, y: 24 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 24 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              {/* ── Modal Header ── */}
              <div className="sticky top-0 z-10 glass-strong rounded-t-2xl p-5 border-b border-white/10">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center flex-shrink-0">
                      <ShieldAlert className="w-5 h-5 text-red-400" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-base font-bold text-white truncate">
                        {shortId(selectedOrder.id)}
                      </h2>
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {selectedOrder.created_at ? formatDate(selectedOrder.created_at) : 'N/A'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Risk badge */}
                    {(() => {
                      const risk = getRiskLevel(selectedOrder.fraud_score || 0);
                      const badge = riskBadgeConfig[risk];
                      return (
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold ${badge.classes}`}>
                          <ShieldAlert className="w-3.5 h-3.5" />
                          {badge.label} ({selectedOrder.fraud_score || 0})
                        </span>
                      );
                    })()}
                    <button
                      type="button"
                      onClick={() => setSelectedOrder(null)}
                      className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
                    >
                      <XCircle className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-5">
                {/* ── Customer Info ── */}
                <div className="glass rounded-xl p-4">
                  <h3 className="text-xs font-semibold text-white flex items-center gap-2 mb-3 uppercase tracking-wider">
                    <User className="w-4 h-4 text-cyan-400" />
                    Cliente
                  </h3>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase">Nombre</p>
                      <p className="text-sm text-white mt-0.5">{selectedOrder.customer_name || 'Sin nombre'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase flex items-center gap-1">
                        <Phone className="w-3 h-3" /> Telefono
                      </p>
                      <p className="text-sm text-white mt-0.5">{selectedOrder.customer_phone || '—'}</p>
                    </div>
                    {selectedOrder.customer_created_at && (
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase">Antiguedad cuenta</p>
                        <p className="text-sm text-white mt-0.5">
                          {(() => {
                            const created = new Date(selectedOrder.customer_created_at);
                            const now = new Date();
                            const diffDays = Math.floor((now.getTime() - created.getTime()) / 86400000);
                            if (diffDays < 1) return 'Hoy';
                            if (diffDays < 30) return `${diffDays} dias`;
                            if (diffDays < 365) return `${Math.floor(diffDays / 30)} meses`;
                            return `${Math.floor(diffDays / 365)} anios`;
                          })()}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Vendor Info ── */}
                <div className="glass rounded-xl p-4">
                  <h3 className="text-xs font-semibold text-white flex items-center gap-2 mb-3 uppercase tracking-wider">
                    <Store className="w-4 h-4 text-amber-400" />
                    Vendedor
                  </h3>
                  <p className="text-sm text-white">{selectedOrder.vendor_name || 'Sin vendedor'}</p>
                </div>

                {/* ── Items List ── */}
                {selectedOrder.items && Array.isArray(selectedOrder.items) && selectedOrder.items.length > 0 && (
                  <div className="glass rounded-xl p-4">
                    <h3 className="text-xs font-semibold text-white flex items-center gap-2 mb-3 uppercase tracking-wider">
                      <Package className="w-4 h-4 text-purple-400" />
                      Productos ({selectedOrder.items.length})
                    </h3>
                    <div className="space-y-0 divide-y divide-white/5">
                      {(selectedOrder.items as Array<{ name?: string; quantity?: number; price?: number }>).map((itm, idx) => (
                        <div key={idx} className="flex items-center justify-between py-2.5">
                          <div className="min-w-0 flex-1 mr-4">
                            <p className="text-sm text-white truncate">{itm.name || 'Producto'}</p>
                            <p className="text-[11px] text-gray-500">
                              {formatCRC(itm.price || 0)} x {itm.quantity || 0}
                            </p>
                          </div>
                          <p className="text-sm text-white font-medium flex-shrink-0">
                            {formatCRC((itm.price || 0) * (itm.quantity || 0))}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Totals */}
                    <div className="pt-3 mt-2 border-t border-white/10 space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Subtotal</span>
                        <span className="text-gray-300">{formatCRC(selectedOrder.subtotal || 0)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Envio</span>
                        <span className="text-gray-300">{formatCRC(selectedOrder.delivery_fee || 0)}</span>
                      </div>
                      <div className="flex justify-between text-sm pt-2 border-t border-white/5">
                        <span className="text-white font-semibold">Total</span>
                        <span className="text-emerald-400 font-bold text-base">{formatCRC(selectedOrder.total)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Commission Breakdown ── */}
                <div className="glass rounded-xl p-4">
                  <h3 className="text-xs font-semibold text-white flex items-center gap-2 mb-3 uppercase tracking-wider">
                    <DollarSign className="w-4 h-4 text-cyan-400" />
                    Desglose Comision
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white/[0.03] rounded-lg p-3 text-center">
                      <p className="text-[10px] text-gray-500 uppercase">Tasa</p>
                      <p className="text-lg font-bold text-white">{selectedOrder.commission_rate || 0}%</p>
                    </div>
                    <div className="bg-white/[0.03] rounded-lg p-3 text-center">
                      <p className="text-[10px] text-gray-500 uppercase">Comision</p>
                      <p className="text-lg font-bold text-cyan-400">{formatCRC(selectedOrder.commission || 0)}</p>
                    </div>
                    <div className="bg-white/[0.03] rounded-lg p-3 text-center">
                      <p className="text-[10px] text-gray-500 uppercase">Vendor</p>
                      <p className="text-lg font-bold text-blue-400">{formatCRC(selectedOrder.vendor_earning || 0)}</p>
                    </div>
                  </div>
                </div>

                {/* ── Fraud Reasons ── */}
                {selectedOrder.fraud_reasons && selectedOrder.fraud_reasons.length > 0 && (
                  <div className="glass rounded-xl p-4">
                    <h3 className="text-xs font-semibold text-white flex items-center gap-2 mb-3 uppercase tracking-wider">
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                      Razones de Fraude Detectadas ({selectedOrder.fraud_reasons.length})
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedOrder.fraud_reasons.map((reason, ri) => (
                        <span
                          key={ri}
                          className="bg-red-500/10 text-red-300 text-[11px] px-3 py-1 rounded-full border border-red-500/15 flex items-center gap-1"
                        >
                          <AlertTriangle className="w-3 h-3" />
                          {reason}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Status Info ── */}
                <div className="glass rounded-xl p-4">
                  <h3 className="text-xs font-semibold text-white flex items-center gap-2 mb-3 uppercase tracking-wider">
                    <CreditCard className="w-4 h-4 text-purple-400" />
                    Estado del Pedido
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase">Estado Pago</p>
                      <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${paymentStatusColors[selectedOrder.payment_status || 'pending'] || paymentStatusColors.pending}`}>
                        {paymentStatusLabels[selectedOrder.payment_status || 'pending'] || selectedOrder.payment_status || 'Pendiente'}
                      </span>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase">Estado Entrega</p>
                      <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${deliveryStatusColors[selectedOrder.status || 'pending'] || deliveryStatusColors.pending}`}>
                        {deliveryStatusLabels[selectedOrder.status || 'pending'] || selectedOrder.status || 'Pendiente'}
                      </span>
                    </div>
                    {selectedOrder.review_status && (
                      <div className="col-span-2">
                        <p className="text-[10px] text-gray-500 uppercase">Estado Revision</p>
                        <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${reviewStatusColors[selectedOrder.review_status] || ''}`}>
                          {reviewStatusLabels[selectedOrder.review_status] || selectedOrder.review_status}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Timeline ── */}
                <div className="glass rounded-xl p-4">
                  <h3 className="text-xs font-semibold text-white flex items-center gap-2 mb-4 uppercase tracking-wider">
                    <CircleDot className="w-4 h-4 text-purple-400" />
                    Timeline
                  </h3>
                  <div className="space-y-4">
                    {/* Created */}
                    <div className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-3 h-3 rounded-full bg-emerald-400 ring-4 ring-emerald-400/10" />
                        <div className="w-0.5 h-full bg-white/10 min-h-[16px]" />
                      </div>
                      <div>
                        <p className="text-sm text-white font-medium">Pedido creado</p>
                        <p className="text-[11px] text-gray-500">
                          {selectedOrder.created_at ? formatDate(selectedOrder.created_at) : 'N/A'}
                        </p>
                      </div>
                    </div>

                    {/* Status changes */}
                    <div className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-3 h-3 rounded-full bg-blue-400 ring-4 ring-blue-400/10" />
                        <div className="w-0.5 h-full bg-white/10 min-h-[16px]" />
                      </div>
                      <div>
                        <p className="text-sm text-white font-medium">
                          Estado: {deliveryStatusLabels[selectedOrder.status || 'pending'] || selectedOrder.status}
                        </p>
                        <p className="text-[11px] text-gray-500">
                          Pago: {paymentStatusLabels[selectedOrder.payment_status || 'pending'] || selectedOrder.payment_status}
                        </p>
                      </div>
                    </div>

                    {/* Fraud detected */}
                    <div className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-3 h-3 rounded-full bg-red-400 ring-4 ring-red-400/10 animate-pulse" />
                      </div>
                      <div>
                        <p className="text-sm text-red-400 font-medium flex items-center gap-1.5">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          Fraude detectado (Score: {selectedOrder.fraud_score || 0})
                        </p>
                        <p className="text-[11px] text-gray-500">
                          {(selectedOrder.fraud_reasons || []).join(' | ') || 'Sin razones especificadas'}
                        </p>
                        {selectedOrder.auto_blocked && (
                          <p className="text-[10px] text-red-400 mt-1">Pedido bloqueado automaticamente</p>
                        )}
                      </div>
                    </div>

                    {/* Review actions */}
                    {selectedOrder.reviewed_by && (
                      <div className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className={`w-3 h-3 rounded-full ring-4 ${
                            selectedOrder.review_status === 'approved' ? 'bg-emerald-400 ring-emerald-400/10' :
                            selectedOrder.review_status === 'blocked' ? 'bg-red-400 ring-red-400/10' :
                            'bg-amber-400 ring-amber-400/10'
                          }`} />
                        </div>
                        <div>
                          <p className="text-sm text-white font-medium">
                            Revision: {reviewStatusLabels[selectedOrder.review_status || ''] || selectedOrder.review_status}
                          </p>
                          <p className="text-[11px] text-gray-500">
                            Por: {selectedOrder.reviewer_name || 'Admin'}
                            {selectedOrder.reviewed_at && ` — ${formatDate(selectedOrder.reviewed_at)}`}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Action Buttons ── */}
                <div className="space-y-3 pt-2">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Acciones de Revision</p>
                  <div className="grid grid-cols-3 gap-2">
                    <motion.button
                      type="button"
                      onClick={() => handleReview(selectedOrder.id, 'approve')}
                      disabled={actionLoading === selectedOrder.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-medium hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                    >
                      {actionLoading === selectedOrder.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      Aprobar
                    </motion.button>
                    <motion.button
                      type="button"
                      onClick={() => handleReview(selectedOrder.id, 'reject')}
                      disabled={actionLoading === selectedOrder.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-colors disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" />
                      Rechazar
                    </motion.button>
                    <motion.button
                      type="button"
                      onClick={() => handleReview(selectedOrder.id, 'block')}
                      disabled={actionLoading === selectedOrder.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="flex items-center justify-center gap-2 py-3 rounded-xl bg-red-600/10 border border-red-600/30 text-red-300 text-sm font-medium hover:bg-red-600/20 transition-colors disabled:opacity-50"
                    >
                      <Ban className="w-4 h-4" />
                      Bloquear
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
