'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DollarSign, TrendingUp, Wallet, CreditCard, Smartphone,
  Download, Search, Calendar, Loader2, Filter, FileDown,
  CheckCircle2, XCircle, ArrowDownCircle, Clock, BarChart3,
  AlertTriangle,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

/* ─── Types ──────────────────────────────────────────────────────────────── */

type PaymentMethod = 'cash' | 'wallet' | 'card' | 'sinpe';

interface CompletedRide {
  id: string;
  created_at: string;
  rider_id: string;
  driver_id?: string;
  price: number;
  commission_rate: number;
  driver_earnings?: number;
  payment_method?: string;
  payment_status?: string;
  rider_name?: string;
  driver_name?: string;
}

interface TransactionRow {
  id: string;
  created_at: string;
  amount: number;
  type: string;
  status: string;
  description?: string;
  user_name?: string;
}

interface WithdrawalItem {
  id: string;
  user_id: string;
  wallet_id?: string;
  amount: number;
  status: string;
  created_at: string;
  processed_at?: string;
  error_message?: string;
  user_name?: string;
  user_phone?: string;
}

interface DailyRevenue {
  date: string;
  revenue: number;
}

/* ─── Constants ──────────────────────────────────────────────────────────── */

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  wallet: 'Billetera',
  card: 'Tarjeta',
  sinpe: 'SINPE',
};

const PAYMENT_METHOD_COLORS: Record<string, string> = {
  cash: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  wallet: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  card: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  sinpe: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
};

const PAYMENT_METHOD_ICONS: Record<string, React.ElementType> = {
  cash: DollarSign,
  wallet: Wallet,
  card: CreditCard,
  sinpe: Smartphone,
};

const PAGE_SIZE = 20;

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString('es-CR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function shortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function formatCurrency(amount: number): string {
  return `₡${Math.round(amount).toLocaleString()}`;
}

/* ─── CSS Bar Chart Component ────────────────────────────────────────────── */

function RevenueChart({ data }: { data: DailyRevenue[] }) {
  if (data.length === 0) return null;

  const maxRevenue = Math.max(...data.map(d => d.revenue), 1);

  return (
    <div className="flex items-end gap-1 h-40 px-2">
      {data.map((day, i) => {
        const height = Math.max((day.revenue / maxRevenue) * 100, 2);
        const isToday = i === data.length - 1;
        return (
          <div key={day.date} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <span className="text-[9px] text-gray-500 truncate w-full text-center hidden sm:block">
              {day.revenue > 0 ? formatCurrency(day.revenue) : ''}
            </span>
            <div
              className={`w-full rounded-t-sm transition-all ${
                isToday
                  ? 'bg-gradient-to-t from-cyan-600 to-cyan-400'
                  : 'bg-gradient-to-t from-cyan-600/60 to-cyan-400/40 hover:from-cyan-600/80 hover:to-cyan-400/60'
              }`}
              style={{ height: `${height}%` }}
              title={`${day.date}: ${formatCurrency(day.revenue)}`}
            />
            <span className="text-[9px] text-gray-600">{shortDate(day.date)}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Skeleton Loaders ───────────────────────────────────────────────────── */

function StatSkeleton() {
  return (
    <div className="glass rounded-xl p-4 space-y-2">
      <Skeleton className="h-3 w-24 bg-white/10" />
      <Skeleton className="h-7 w-32 bg-white/10" />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export default function PaymentReportPage() {
  const { session } = useAuthStore();

  // Data states
  const [completedRides, setCompletedRides] = useState<CompletedRide[]>([]);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalItem[]>([]);
  const [dailyRevenue, setDailyRevenue] = useState<DailyRevenue[]>([]);
  const [totalWallets, setTotalWallets] = useState(0);

  // UI states
  const [loading, setLoading] = useState(true);
  const [loadingWithdrawals, setLoadingWithdrawals] = useState(false);
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [activeTab, setActiveTab] = useState<'rides' | 'transactions' | 'withdrawals'>('rides');
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  /* ── Fetch Financial Data via API Route ──────────────────────────── */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const token = session?.access_token;
      if (!token) {
        toast.error('Sesion no valida');
        setLoading(false);
        return;
      }

      const res = await fetch('/api/admin/payment-report', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Error al cargar datos');

      setCompletedRides(result.rides || []);
      setDailyRevenue(result.dailyRevenue || []);
      setTransactions(result.transactions || []);
      setTotalWallets(result.totalWallets || 0);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      toast.error(`Error al cargar datos financieros: ${message}`);
    } finally {
      setLoading(false);
    }
  }, [session]);

  /* ── Fetch Withdrawals via API Route ─────────────────────────────── */
  const fetchWithdrawals = useCallback(async () => {
    setLoadingWithdrawals(true);
    try {
      const token = session?.access_token;
      if (!token) { setLoadingWithdrawals(false); return; }

      const res = await fetch('/api/admin/withdrawals', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Error al cargar retiros');

      setWithdrawals(result.withdrawals || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error';
      toast.error(`Error al cargar retiros: ${message}`);
    } finally {
      setLoadingWithdrawals(false);
    }
  }, [session]);

  /* ── Approve / Reject Withdrawals ─────────────────────────────────── */
  const approveWithdrawal = useCallback(async (id: string) => {
    try {
      const token = session?.access_token;
      if (!token) { toast.error('Sesion no valida'); return; }

      const res = await fetch('/api/withdrawals/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ withdrawal_id: id }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      toast.success('Retiro aprobado exitosamente');
      fetchWithdrawals();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error';
      toast.error(`Error al aprobar retiro: ${msg}`);
    }
  }, [session, fetchWithdrawals]);

  const openRejectDialog = (id: string) => {
    setRejectingId(id);
    setRejectReason('');
    setShowRejectDialog(true);
  };

  const rejectWithdrawal = useCallback(async () => {
    if (!rejectingId || !rejectReason.trim()) return;
    try {
      const token = session?.access_token;
      if (!token) { toast.error('Sesion no valida'); return; }

      const res = await fetch('/api/withdrawals/reject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ withdrawal_id: rejectingId, reason: rejectReason.trim() }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      toast.success('Retiro rechazado. Monto devuelto a la billetera.');
      setShowRejectDialog(false);
      setRejectingId(null);
      fetchWithdrawals();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error';
      toast.error(`Error al rechazar retiro: ${msg}`);
    }
  }, [rejectingId, rejectReason, session, fetchWithdrawals]);

  /* ── Effects ──────────────────────────────────────────────────────── */
  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    if (activeTab === 'withdrawals') fetchWithdrawals();
  }, [activeTab, fetchWithdrawals]);

  /* ── Computed Stats ───────────────────────────────────────────────── */
  const stats = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const allRides = completedRides;
    const todayRides = allRides.filter(r => r.created_at >= todayStart);
    const weekRides = allRides.filter(r => r.created_at >= weekStart);
    const monthRides = allRides.filter(r => r.created_at >= monthStart);

    const sumRevenue = (rides: CompletedRide[]) => rides.reduce((s, r) => s + r.price, 0);
    const sumCommission = (rides: CompletedRide[]) =>
      rides.reduce((s, r) => s + r.price * r.commission_rate, 0);

    const pendingWithdrawals = withdrawals
      .filter(w => w.status === 'queued' || w.status === 'processing')
      .reduce((s, w) => s + w.amount, 0);

    return {
      totalRevenue: sumRevenue(allRides),
      revenueToday: sumRevenue(todayRides),
      revenueWeek: sumRevenue(weekRides),
      revenueMonth: sumRevenue(monthRides),
      totalCommission: sumCommission(allRides),
      pendingWithdrawals,
      totalWallets,
      totalRides: allRides.length,
    };
  }, [completedRides, withdrawals, totalWallets]);

  /* ── Filtered / Paginated Data ────────────────────────────────────── */
  const dateFilteredRides = useMemo(() => {
    let rides = completedRides;
    if (dateFrom) {
      rides = rides.filter(r => r.created_at >= new Date(dateFrom).toISOString());
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      rides = rides.filter(r => r.created_at <= to.toISOString());
    }
    if (methodFilter !== 'all') {
      rides = rides.filter(r => r.payment_method === methodFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      rides = rides.filter(r =>
        r.rider_name?.toLowerCase().includes(q) ||
        r.driver_name?.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q)
      );
    }
    return rides;
  }, [completedRides, dateFrom, dateTo, methodFilter, search]);

  const totalPages = Math.max(1, Math.ceil(dateFilteredRides.length / PAGE_SIZE));
  const paginatedRides = dateFilteredRides.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const showingFrom = dateFilteredRides.length > 0 ? (page - 1) * PAGE_SIZE + 1 : 0;
  const showingTo = Math.min(page * PAGE_SIZE, dateFilteredRides.length);

  useEffect(() => { setPage(1); }, [search, methodFilter, dateFrom, dateTo]);

  /* ── CSV Export ───────────────────────────────────────────────────── */
  const exportCSV = async () => {
    setExporting(true);
    try {
      const data = dateFilteredRides;
      if (data.length === 0) { toast.error('No hay datos para exportar'); setExporting(false); return; }

      const headers = ['Fecha', 'Pasajero', 'Conductor', 'Tarifa (CRC)', 'Comision (%)', 'Comision (CRC)', 'Ganancia Conductor (CRC)', 'Metodo', 'Estado'];
      const rows = data.map(r => [
        formatDate(r.created_at), `"${r.rider_name}"`, `"${r.driver_name}"`,
        r.price.toString(), `${(r.commission_rate * 100).toFixed(1)}%`,
        Math.round(r.price * r.commission_rate).toString(),
        Math.round(r.driver_earnings ?? 0).toString(),
        PAYMENT_METHOD_LABELS[r.payment_method || 'cash'] || r.payment_method || 'cash',
        r.payment_status || 'paid',
      ]);

      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `reporte-pagos-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('CSV exportado correctamente');
    } catch { toast.error('Error al exportar CSV'); }
    finally { setExporting(false); }
  };

  /* ── Stat Cards ───────────────────────────────────────────────────── */
  const statCards = [
    { label: 'Ingresos Totales', value: formatCurrency(stats.totalRevenue), color: 'text-cyan-400', icon: DollarSign },
    { label: 'Hoy', value: formatCurrency(stats.revenueToday), color: 'text-emerald-400', icon: TrendingUp },
    { label: 'Esta Semana', value: formatCurrency(stats.revenueWeek), color: 'text-amber-400', icon: BarChart3 },
    { label: 'Este Mes', value: formatCurrency(stats.revenueMonth), color: 'text-purple-400', icon: Calendar },
    { label: 'Comisiones Totales', value: formatCurrency(stats.totalCommission), color: 'text-pink-400', icon: TrendingUp },
    { label: 'Retiros Pendientes', value: formatCurrency(stats.pendingWithdrawals), color: 'text-orange-400', icon: ArrowDownCircle },
    { label: 'En Billeteras', value: formatCurrency(stats.totalWallets), color: 'text-teal-400', icon: Wallet },
    { label: 'Viajes Totales', value: stats.totalRides.toLocaleString(), color: 'text-blue-400', icon: CheckCircle2 },
  ];

  /* ─── Render ──────────────────────────────────────────────────────────── */

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Reporte Financiero</h1>
          <p className="text-gray-400 mt-1">Ingresos, comisiones, transacciones y retiros</p>
        </div>
        <button
          type="button"
          onClick={exportCSV}
          disabled={exporting || dateFilteredRides.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-sm font-medium hover:bg-cyan-500/20 transition-all disabled:opacity-40"
        >
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
          Exportar CSV
        </button>
      </div>

      {/* Stats Grid */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <StatSkeleton key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {statCards.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={i}
                className="glass rounded-xl p-4"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">{stat.label}</p>
                  <Icon className={`w-3.5 h-3.5 ${stat.color} opacity-60`} />
                </div>
                <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Revenue Chart */}
      {!loading && dailyRevenue.length > 0 && (
        <motion.div
          className="glass rounded-2xl p-4"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-white">Ingresos Diarios — Ultimos 30 Dias</h3>
          </div>
          <RevenueChart data={dailyRevenue} />
        </motion.div>
      )}

      {/* Tab Switcher + Filters */}
      <div className="glass rounded-2xl p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          {/* Tabs */}
          <div className="flex gap-1 p-1 rounded-xl bg-white/5 flex-shrink-0">
            {([
              { key: 'rides', label: 'Viajes Completados', icon: CreditCard },
              { key: 'transactions', label: 'Transacciones', icon: DollarSign },
              { key: 'withdrawals', label: 'Cola de Retiros', icon: ArrowDownCircle },
            ] as const).map(({ key, label, icon: TabIcon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                  activeTab === key
                    ? 'bg-cyan-500/20 text-cyan-400 shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <TabIcon className="w-3.5 h-3.5" />
                {label}
                {key === 'withdrawals' && withdrawals.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-orange-500 text-white text-[10px] font-bold">
                    {withdrawals.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Search + Date (for rides tab) */}
          {activeTab === 'rides' && (
            <div className="flex flex-col sm:flex-row gap-2 flex-1">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Buscar por pasajero, conductor o ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-cyan-500 text-white placeholder:text-gray-600 outline-none text-sm transition-all"
                />
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="pl-9 pr-3 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-cyan-500 text-white text-sm outline-none transition-all [color-scheme:dark]"
                  />
                </div>
                <span className="text-gray-500 text-xs">a</span>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="pl-9 pr-3 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-cyan-500 text-white text-sm outline-none transition-all [color-scheme:dark]"
                  />
                </div>
                {(dateFrom || dateTo) && (
                  <button
                    type="button"
                    onClick={() => { setDateFrom(''); setDateTo(''); }}
                    className="px-3 py-2.5 rounded-xl bg-white/5 text-gray-400 hover:text-white text-xs hover:bg-white/10 transition-all"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Method filter (rides tab) */}
        {activeTab === 'rides' && (
          <div className="flex flex-wrap gap-2 mt-3">
            {(['all', 'cash', 'wallet', 'card', 'sinpe'] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setMethodFilter(m)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  methodFilter === m
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : 'bg-white/5 text-gray-400 hover:text-white border border-transparent'
                }`}
              >
                {m !== 'all' && (() => {
                  const Icon = PAYMENT_METHOD_ICONS[m];
                  return <Icon className="w-3.5 h-3.5" />;
                })()}
                {m === 'all' ? 'Todos' : PAYMENT_METHOD_LABELS[m]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tab Content */}
      <motion.div
        className="glass rounded-2xl overflow-hidden"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {/* Rides Tab */}
        {activeTab === 'rides' && (
          loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mb-3" />
              <p className="text-sm">Cargando pagos...</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Fecha</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Pasajero</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider hidden md:table-cell">Conductor</th>
                      <th className="text-right px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Tarifa</th>
                      <th className="text-right px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider hidden lg:table-cell">Comision</th>
                      <th className="text-right px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider hidden lg:table-cell">Ganancia</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Metodo</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {paginatedRides.map((r, i) => {
                        const MethodIcon = PAYMENT_METHOD_ICONS[r.payment_method || 'cash'] || DollarSign;
                        const commission = Math.round(r.price * r.commission_rate);
                        return (
                          <motion.tr
                            key={r.id}
                            className="border-b border-white/5 hover:bg-white/5 transition-colors"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: i * 0.02 }}
                          >
                            <td className="px-5 py-3 text-sm text-gray-400 whitespace-nowrap">{formatDate(r.created_at)}</td>
                            <td className="px-5 py-3 text-sm text-white">{r.rider_name}</td>
                            <td className="px-5 py-3 text-sm text-gray-400 hidden md:table-cell">{r.driver_name}</td>
                            <td className="px-5 py-3 text-sm text-white text-right font-medium">{formatCurrency(r.price)}</td>
                            <td className="px-5 py-3 text-sm text-purple-400 text-right hidden lg:table-cell">
                              <div>{formatCurrency(commission)}</div>
                              <div className="text-[10px] text-gray-500">{(r.commission_rate * 100).toFixed(1)}%</div>
                            </td>
                            <td className="px-5 py-3 text-sm text-emerald-400 text-right hidden lg:table-cell">
                              {formatCurrency(r.driver_earnings ?? 0)}
                            </td>
                            <td className="px-5 py-3">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${PAYMENT_METHOD_COLORS[r.payment_method || 'cash'] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>
                                <MethodIcon className="w-3 h-3" />
                                {PAYMENT_METHOD_LABELS[r.payment_method || 'cash'] || r.payment_method || 'cash'}
                              </span>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>

              {dateFilteredRides.length === 0 && (
                <div className="text-center py-16 text-gray-500">
                  <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No se encontraron pagos con los filtros seleccionados</p>
                </div>
              )}

              {dateFilteredRides.length > PAGE_SIZE && (
                <div className="flex items-center justify-between px-5 py-4 border-t border-white/5">
                  <p className="text-xs text-gray-400">
                    Mostrando {showingFrom}-{showingTo} de {dateFilteredRides.length} pagos
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-all"
                    >
                      Anterior
                    </button>
                    <span className="px-3 py-1.5 text-xs text-cyan-400 font-medium">
                      {page} / {totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-all"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              )}
            </>
          )
        )}

        {/* Transactions Tab */}
        {activeTab === 'transactions' && (
          loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mb-3" />
            </div>
          ) : transactions.length > 0 ? (
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0 bg-[#0a0e1a] z-10">
                  <tr className="border-b border-white/5">
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase">Fecha</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase">Usuario</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-gray-400 uppercase">Monto</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase">Tipo</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(tx => (
                    <tr key={tx.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-5 py-3 text-xs text-gray-400 whitespace-nowrap">{formatDate(tx.created_at)}</td>
                      <td className="px-5 py-3 text-xs text-white">{tx.user_name}</td>
                      <td className={`px-5 py-3 text-sm text-right font-medium ${tx.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {tx.amount >= 0 ? '+' : ''}{formatCurrency(Math.abs(tx.amount))}
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs text-gray-400 capitalize">{tx.type}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          tx.status === 'completed' ? 'bg-emerald-500/15 text-emerald-400' :
                          tx.status === 'processing' ? 'bg-amber-500/15 text-amber-400' :
                          tx.status === 'failed' ? 'bg-red-500/15 text-red-400' :
                          'bg-gray-500/15 text-gray-400'
                        }`}>
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-16 text-gray-500">
              <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No hay transacciones</p>
            </div>
          )
        )}

        {/* Withdrawals Tab */}
        {activeTab === 'withdrawals' && (
          loadingWithdrawals ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mb-3" />
              <p className="text-sm">Cargando cola de retiros...</p>
            </div>
          ) : withdrawals.length > 0 ? (
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0 bg-[#0a0e1a] z-10">
                  <tr className="border-b border-white/5">
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase">Fecha</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase">Usuario</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase hidden md:table-cell">Telefono</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-gray-400 uppercase">Monto</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase">Estado</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-gray-400 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {withdrawals.map(w => (
                    <tr key={w.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-5 py-3 text-xs text-gray-400 whitespace-nowrap">{formatDate(w.created_at)}</td>
                      <td className="px-5 py-3 text-sm text-white font-medium">{w.user_name}</td>
                      <td className="px-5 py-3 text-xs text-gray-400 hidden md:table-cell">{w.user_phone || '-'}</td>
                      <td className="px-5 py-3 text-sm text-white text-right font-semibold">{formatCurrency(w.amount)}</td>
                      <td className="px-5 py-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          w.status === 'queued' ? 'bg-amber-500/15 text-amber-400' :
                          w.status === 'processing' ? 'bg-cyan-500/15 text-cyan-400' :
                          'bg-gray-500/15 text-gray-400'
                        }`}>
                          {w.status === 'queued' ? 'En cola' : 'Procesando'}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => approveWithdrawal(w.id)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-medium hover:bg-emerald-500/25 transition-all"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Aprobar
                          </button>
                          <button
                            type="button"
                            onClick={() => openRejectDialog(w.id)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-medium hover:bg-red-500/25 transition-all"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Rechazar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-16 text-gray-500">
              <ArrowDownCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No hay retiros pendientes</p>
            </div>
          )
        )}
      </motion.div>

      {/* Reject Dialog */}
      <AnimatePresence>
        {showRejectDialog && (
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowRejectDialog(false)}
          >
            <motion.div
              className="glass rounded-2xl p-6 w-full max-w-md"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Rechazar Retiro</h3>
                  <p className="text-xs text-gray-400">El monto sera devuelto a la billetera del usuario</p>
                </div>
              </div>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Motivo del rechazo..."
                rows={3}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-red-500 text-white placeholder:text-gray-600 outline-none text-sm resize-none transition-all mb-4"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRejectDialog(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 text-gray-400 text-sm hover:text-white hover:bg-white/10 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={rejectWithdrawal}
                  disabled={!rejectReason.trim()}
                  className="px-4 py-2 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/25 transition-all disabled:opacity-40"
                >
                  Rechazar Retiro
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
