'use client';

import { motion } from 'framer-motion';
import {
  DollarSign,
  Car,
  Route,
  Star,
  Heart,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertTriangle,
  BarChart3,
  PieChart as PieChartIcon,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback, useMemo } from 'react';

// ─── RPC Stats Types ───────────────────────────────
interface RPCPassengerStats {
  total_rides: number;
  total_spent: number;
  total_spent_formatted: string;
  total_tips: number;
  total_tips_formatted: string;
  total_distance_km: number;
  avg_fare: number;
  avg_fare_formatted: string;
  completed: number;
  cancelled: number;
  cancellation_rate: number;
  most_common_type: string | null;
}

// ─── Types ──────────────────────────────────────────
interface DailySpend {
  day: number;
  amount: number;
}

interface RideTypeBreakdown {
  type: string;
  label: string;
  count: number;
  percentage: number;
  color: string;
}

interface MonthlyStats {
  totalSpent: number;
  totalRides: number;
  totalDistance: number;
  avgRating: number | null;
  totalTips: number;
  mostExpensive: number;
  cancellationRate: number;
  dailySpending: DailySpend[];
  rideTypeBreakdown: RideTypeBreakdown[];
}

// ─── Constants ─────────────────────────────────────
const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const RIDE_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  standard: { label: 'Economico', color: '#06b6d4' },
  premium: { label: 'Premium', color: '#f59e0b' },
  suv: { label: 'SUV', color: '#8b5cf6' },
  moto: { label: 'Moto', color: '#10b981' },
  moto_express: { label: 'Moto Express', color: '#ec4899' },
  grua: { label: 'Grua', color: '#ef4444' },
  flete: { label: 'Flete', color: '#f97316' },
};

function formatCurrency(amount: number): string {
  return '₡' + Math.round(amount).toLocaleString('es-CR');
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

// ─── Animation variants ────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 25 },
  },
};

// ─── Component ─────────────────────────────────────
export default function ClientStats() {
  const router = useRouter();
  const { user, session } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<MonthlyStats | null>(null);

  // ─── RPC Stats State ─────────────────────────────
  const [rpcStats, setRpcStats] = useState<RPCPassengerStats | null>(null);
  const [rpcLoading, setRpcLoading] = useState(false);
  const [rpcError, setRpcError] = useState<string | null>(null);

  // Month selector state
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

  // Generate month options: current + 5 previous months
  const monthOptions = useMemo(() => {
    const options: { year: number; month: number; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      options.push({
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`,
      });
    }
    return options;
  }, []);

  const currentMonthIndex = useMemo(
    () =>
      monthOptions.findIndex(
        o => o.year === selectedYear && o.month === selectedMonth,
      ),
    [monthOptions, selectedYear, selectedMonth],
  );

  const goToMonth = useCallback(
    (direction: -1 | 1) => {
      const nextIndex = currentMonthIndex + direction;
      if (nextIndex >= 0 && nextIndex < monthOptions.length) {
        const opt = monthOptions[nextIndex];
        setSelectedYear(opt.year);
        setSelectedMonth(opt.month);
      }
    },
    [currentMonthIndex, monthOptions],
  );

  const currentLabel = useMemo(
    () => `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`,
    [selectedMonth, selectedYear],
  );

  // ─── Fetch stats ─────────────────────────────────
  const fetchStats = useCallback(
    async (userId: string, year: number, month: number) => {
      setLoading(true);
      try {
        const monthStr = `${year}-${String(month).padStart(2, '0')}`;
        const startDate = `${monthStr}-01T00:00:00`;
        const daysInMonth = getDaysInMonth(year, month);
        const endDate = `${monthStr}-${String(daysInMonth).padStart(2, '0')}T23:59:59`;

        // Fetch all rides for the selected month
        const { data: rides, error: ridesError } = await supabase
          .from('rides')
          .select('*')
          .eq('rider_id', userId)
          .gte('created_at', startDate)
          .lte('created_at', endDate);

        const ridesList = rides || [];

        // Compute summary stats
        const completedRides = ridesList.filter(r => r.status === 'completed');
        const cancelledRides = ridesList.filter(r => r.status === 'cancelled');
        const totalRides = ridesList.length;
        const totalSpent = completedRides.reduce((s, r) => s + (r.price || 0), 0);
        const totalDistance = completedRides.reduce(
          (s, r) => s + (r.distance || 0),
          0,
        );
        const mostExpensive = completedRides.length
          ? Math.max(...completedRides.map(r => r.price || 0))
          : 0;

        // Average rating given by rider
        const ratedRides = completedRides.filter(
          r => r.driver_rating != null && r.driver_rating > 0,
        );
        const avgRating =
          ratedRides.length > 0
            ? ratedRides.reduce((s, r) => s + (r.driver_rating || 0), 0) /
              ratedRides.length
            : null;

        // Tips from transactions
        let totalTips = 0;
        try {
          const { data: tipTx } = await supabase
            .from('transactions')
            .select('amount')
            .eq('wallet_id', userId)
            .like('description', '%propina%')
            .gte('created_at', startDate)
            .lte('created_at', endDate);
          if (tipTx) {
            totalTips = tipTx.reduce((s, t) => s + (t.amount || 0), 0);
          }
        } catch {
          // Table may not exist
        }

        // Cancellation rate
        const cancellationRate =
          totalRides > 0
            ? Math.round((cancelledRides.length / totalRides) * 1000) / 10
            : 0;

        // Daily spending breakdown
        const dailySpending: DailySpend[] = [];
        for (let d = 1; d <= daysInMonth; d++) {
          const dayStart = `${monthStr}-${String(d).padStart(2, '0')}T00:00:00`;
          const dayEnd = `${monthStr}-${String(d).padStart(2, '0')}T23:59:59`;
          const dayRides = completedRides.filter(r => {
            const rideDate = new Date(r.created_at);
            return (
              rideDate.getFullYear() === year &&
              rideDate.getMonth() + 1 === month &&
              rideDate.getDate() === d
            );
          });
          const dayAmount = dayRides.reduce((s, r) => s + (r.price || 0), 0);
          dailySpending.push({ day: d, amount: dayAmount });
        }

        // Ride type breakdown
        const typeCounts: Record<string, number> = {};
        completedRides.forEach(r => {
          const t = r.ride_type || 'standard';
          typeCounts[t] = (typeCounts[t] || 0) + 1;
        });

        const rideTypeBreakdown: RideTypeBreakdown[] = Object.entries(
          typeCounts,
        ).map(([type, count]) => {
          const config = RIDE_TYPE_CONFIG[type] || {
            label: type,
            color: '#64748b',
          };
          return {
            type,
            label: config.label,
            count,
            percentage:
              completedRides.length > 0
                ? Math.round((count / completedRides.length) * 100)
                : 0,
            color: config.color,
          };
        });

        setStats({
          totalSpent: Math.round(totalSpent),
          totalRides,
          totalDistance: Math.round(totalDistance * 10) / 10,
          avgRating: avgRating !== null ? Math.round(avgRating * 10) / 10 : null,
          totalTips: Math.round(totalTips),
          mostExpensive: Math.round(mostExpensive),
          cancellationRate,
          dailySpending,
          rideTypeBreakdown: rideTypeBreakdown.sort(
            (a, b) => b.count - a.count,
          ),
        });
      } catch (err) {
        console.error('Stats fetch error:', err);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // ─── Fetch RPC Stats ─────────────────────────────
  useEffect(() => {
    if (!session?.access_token) return;
    const monthStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
    let cancelled = false;
    (async () => {
      setRpcLoading(true);
      setRpcError(null);
      try {
        const res = await fetch(`/api/rides/passenger-stats?month=${monthStr}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          throw new Error(errData?.error || `Error ${res.status}`);
        }
        const json = await res.json();
        if (!cancelled && json.success) setRpcStats(json.stats);
      } catch (err: any) {
        if (!cancelled) setRpcError(err?.message || 'Error al cargar estadisticas del sistema');
      } finally {
        if (!cancelled) setRpcLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [session?.access_token, selectedYear, selectedMonth]);

  useEffect(() => {
    if (user?.id) {
      fetchStats(user.id, selectedYear, selectedMonth);
    }
  }, [user?.id, selectedYear, selectedMonth, fetchStats]);

  // ─── Computed values ──────────────────────────────
  const maxDailySpend = useMemo(
    () =>
      stats ? Math.max(...stats.dailySpending.map(d => d.amount), 1) : 1,
    [stats],
  );

  const totalTypePercentage = useMemo(
    () =>
      stats
        ? stats.rideTypeBreakdown.reduce((s, r) => s + r.percentage, 0)
        : 0,
    [stats],
  );

  const cancellationColor = useMemo(() => {
    if (!stats) return 'text-gray-400 bg-gray-500/20';
    if (stats.cancellationRate <= 5)
      return 'text-emerald-400 bg-emerald-500/20';
    if (stats.cancellationRate <= 15)
      return 'text-amber-400 bg-amber-500/20';
    return 'text-red-400 bg-red-500/20';
  }, [stats]);

  const cancellationLabel = useMemo(() => {
    if (!stats) return '';
    if (stats.cancellationRate <= 5) return 'Excelente';
    if (stats.cancellationRate <= 15) return 'Normal';
    return 'Alta';
  }, [stats]);

  // ─── Loading state ────────────────────────────────
  if (loading) {
    return (
      <div className="p-4 space-y-6">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-4 space-y-6">
        <div className="glass rounded-2xl p-6 text-center">
          <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
          <p className="text-sm text-gray-400">
            No se pudieron cargar las estadisticas
          </p>
          <button
            type="button"
            onClick={() =>
              user?.id &&
              fetchStats(user.id, selectedYear, selectedMonth)
            }
            className="mt-3 text-xs text-cyan-400 hover:underline"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-5">
      {/* Header + Month Selector */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-xl font-bold text-white">Estadisticas</h1>
          <p className="text-sm text-gray-400 mt-0.5">Gastos mensuales</p>
        </div>
        <button
          type="button"
          onClick={() => router.push('/client')}
          className="p-2 rounded-xl hover:bg-white/5 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-gray-400" />
        </button>
      </motion.div>

      {/* Month Selector */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="flex items-center justify-center gap-4"
      >
        <button
          type="button"
          disabled={currentMonthIndex >= monthOptions.length - 1}
          onClick={() => goToMonth(1)}
          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-30"
        >
          <ChevronLeft className="w-4 h-4 text-gray-400" />
        </button>
        <span className="text-sm font-semibold text-white min-w-[160px] text-center">
          {currentLabel}
        </span>
        <button
          type="button"
          disabled={currentMonthIndex <= 0}
          onClick={() => goToMonth(-1)}
          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-30"
        >
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </button>
      </motion.div>

      {/* ═══ Resumen del Sistema (RPC) ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-strong rounded-2xl p-4"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-white">Resumen del Sistema</h3>
          </div>
          {rpcLoading && <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />}
          {rpcStats && (
            <div className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              RPC
            </div>
          )}
        </div>

        {rpcError && !rpcLoading && (
          <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-amber-400 font-medium">Sin datos del sistema</p>
              <p className="text-[10px] text-gray-500 mt-0.5">Se muestran los datos calculados localmente</p>
            </div>
          </div>
        )}

        {rpcStats && !rpcError && (
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 rounded-xl bg-emerald-500/10">
              <div className="flex items-center gap-1.5 mb-1">
                <DollarSign className="w-3 h-3 text-emerald-400" />
                <span className="text-[10px] text-gray-500 uppercase tracking-wide">Total Gastado</span>
              </div>
              <p className="text-sm font-bold text-emerald-400">{rpcStats.total_spent_formatted}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-cyan-500/10">
              <div className="flex items-center gap-1.5 mb-1">
                <Car className="w-3 h-3 text-cyan-400" />
                <span className="text-[10px] text-gray-500 uppercase tracking-wide">Total Viajes</span>
              </div>
              <p className="text-sm font-bold text-cyan-400">{rpcStats.total_rides}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-white/5">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-[10px] text-gray-500 uppercase tracking-wide">Completados</span>
              </div>
              <p className="text-sm font-bold text-white">{rpcStats.completed}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-white/5">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-[10px] text-gray-500 uppercase tracking-wide">Cancelados</span>
              </div>
              <p className="text-sm font-bold text-red-400">{rpcStats.cancelled}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-white/5">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="w-3 h-3 text-purple-400" />
                <span className="text-[10px] text-gray-500 uppercase tracking-wide">Tarifa Promedio</span>
              </div>
              <p className="text-sm font-bold text-purple-400">{rpcStats.avg_fare_formatted}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-white/5">
              <div className="flex items-center gap-1.5 mb-1">
                <Route className="w-3 h-3 text-amber-400" />
                <span className="text-[10px] text-gray-500 uppercase tracking-wide">Tasa Cancelacion</span>
              </div>
              <p className="text-sm font-bold text-amber-400">{rpcStats.cancellation_rate}%</p>
            </div>
            {rpcStats.most_common_type && (
              <div className="col-span-2 p-2.5 rounded-xl bg-white/5 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <PieChartIcon className="w-3 h-3 text-pink-400" />
                  <span className="text-[10px] text-gray-500 uppercase tracking-wide">Tipo Mas Comun</span>
                </div>
                <span className="text-xs font-semibold text-pink-400 bg-pink-500/10 px-2 py-0.5 rounded-full">
                  {RIDE_TYPE_CONFIG[rpcStats.most_common_type]?.label || rpcStats.most_common_type}
                </span>
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* Stats Cards Grid */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 gap-3"
      >
        {/* Total Gastado */}
        <motion.div variants={itemVariants} className="glass-strong rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <span className="text-[10px] text-gray-500 uppercase tracking-wide">
              Total Gastado
            </span>
          </div>
          <p className="text-lg font-bold text-white">
            {formatCurrency(stats.totalSpent)}
          </p>
        </motion.div>

        {/* Total Viajes */}
        <motion.div variants={itemVariants} className="glass-strong rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/15 flex items-center justify-center">
              <Car className="w-4 h-4 text-cyan-400" />
            </div>
            <span className="text-[10px] text-gray-500 uppercase tracking-wide">
              Total Viajes
            </span>
          </div>
          <p className="text-lg font-bold text-white">{stats.totalRides}</p>
        </motion.div>

        {/* Total Distancia */}
        <motion.div variants={itemVariants} className="glass-strong rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
              <Route className="w-4 h-4 text-blue-400" />
            </div>
            <span className="text-[10px] text-gray-500 uppercase tracking-wide">
              Distancia
            </span>
          </div>
          <p className="text-lg font-bold text-white">
            {stats.totalDistance}
            <span className="text-xs font-normal text-gray-500 ml-1">km</span>
          </p>
        </motion.div>

        {/* Calificacion Promedio */}
        <motion.div variants={itemVariants} className="glass-strong rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
              <Star className="w-4 h-4 text-amber-400" />
            </div>
            <span className="text-[10px] text-gray-500 uppercase tracking-wide">
              Calificacion
            </span>
          </div>
          <p className="text-lg font-bold text-white">
            {stats.avgRating !== null ? stats.avgRating.toFixed(1) : '--'}
            <span className="text-xs font-normal text-gray-500 ml-1">/5</span>
          </p>
        </motion.div>

        {/* Propinas Dadas */}
        <motion.div variants={itemVariants} className="glass-strong rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-pink-500/15 flex items-center justify-center">
              <Heart className="w-4 h-4 text-pink-400" />
            </div>
            <span className="text-[10px] text-gray-500 uppercase tracking-wide">
              Propinas
            </span>
          </div>
          <p className="text-lg font-bold text-white">
            {formatCurrency(stats.totalTips)}
          </p>
        </motion.div>

        {/* Viaje Mas Caro */}
        <motion.div variants={itemVariants} className="glass-strong rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-purple-400" />
            </div>
            <span className="text-[10px] text-gray-500 uppercase tracking-wide">
              Mas Caro
            </span>
          </div>
          <p className="text-lg font-bold text-white">
            {stats.mostExpensive > 0
              ? formatCurrency(stats.mostExpensive)
              : '--'}
          </p>
        </motion.div>
      </motion.div>

      {/* Cancellation Rate Card */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="glass rounded-2xl p-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${cancellationColor}`}
            >
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">
                Tasa de Cancelacion
              </p>
              <p className="text-[10px] text-gray-500">
                {stats.cancellationRate}% de viajes cancelados
              </p>
            </div>
          </div>
          <div className="text-right">
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cancellationColor}`}
            >
              {cancellationLabel}
            </span>
          </div>
        </div>
        {/* Visual indicator bar */}
        <div className="mt-3 h-1.5 rounded-full bg-white/5 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{
              width: `${Math.min(stats.cancellationRate * 3, 100)}%`,
            }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className={`h-full rounded-full ${
              stats.cancellationRate <= 5
                ? 'bg-emerald-500'
                : stats.cancellationRate <= 15
                  ? 'bg-amber-500'
                  : 'bg-red-500'
            }`}
          />
        </div>
      </motion.div>

      {/* Daily Spending Bar Chart */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="glass-strong rounded-2xl p-4"
      >
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-semibold text-white">
            Gasto Diario
          </h3>
          <span className="text-[10px] text-gray-500 ml-auto">
            {currentLabel}
          </span>
        </div>

        <div className="flex items-end gap-[3px] h-32">
          {stats.dailySpending.map((d) => {
            const heightPct =
              d.amount > 0
                ? Math.max((d.amount / maxDailySpend) * 100, 4)
                : 2;
            const intensity =
              d.amount === 0
                ? 'bg-white/5'
                : d.amount / maxDailySpend > 0.75
                  ? 'bg-gradient-to-t from-cyan-500 to-cyan-300'
                  : d.amount / maxDailySpend > 0.4
                    ? 'bg-gradient-to-t from-cyan-600 to-cyan-400'
                    : 'bg-gradient-to-t from-cyan-700/60 to-cyan-500/60';

            return (
              <div
                key={d.day}
                className="flex-1 flex flex-col items-center gap-1"
                title={`${d.day} ${MONTH_NAMES[selectedMonth - 1]}: ₡${Math.round(d.amount).toLocaleString('es-CR')}`}
              >
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${heightPct}%` }}
                  transition={{
                    duration: 0.4,
                    ease: 'easeOut',
                    delay: d.day * 0.01,
                  }}
                  className={`w-full rounded-t-sm ${intensity} min-h-[2px]`}
                />
              </div>
            );
          })}
        </div>

        {/* X-axis labels */}
        <div className="flex justify-between mt-2 px-1">
          <span className="text-[9px] text-gray-600">1</span>
          <span className="text-[9px] text-gray-600">
            {Math.floor(getDaysInMonth(selectedYear, selectedMonth) / 2)}
          </span>
          <span className="text-[9px] text-gray-600">
            {getDaysInMonth(selectedYear, selectedMonth)}
          </span>
        </div>
      </motion.div>

      {/* Ride Type Breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="glass-strong rounded-2xl p-4"
      >
        <div className="flex items-center gap-2 mb-4">
          <PieChartIcon className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-semibold text-white">
            Tipos de Viaje
          </h3>
        </div>

        {stats.rideTypeBreakdown.length === 0 ? (
          <p className="text-xs text-gray-500 text-center py-4">
            Sin viajes completados este mes
          </p>
        ) : (
          <>
            {/* CSS Pie Chart */}
            <div className="flex items-center justify-center mb-4">
              <div
                className="w-28 h-28 rounded-full relative"
                style={{
                  background: `conic-gradient(
                    ${stats.rideTypeBreakdown
                      .map(
                        (r, i, arr) =>
                          `${r.color} ${
                            arr
                              .slice(0, i)
                              .reduce(
                                (s, prev) => s + prev.percentage,
                                0,
                              ) * 3.6
                          }deg ${r.percentage * 3.6}deg`,
                      )
                      .join(', ')}
                  )`,
                }}
              >
                {/* Center hole for donut effect */}
                <div className="absolute inset-[18px] rounded-full bg-[#0a0e1a] flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-lg font-bold text-white">
                      {stats.totalRides}
                    </p>
                    <p className="text-[9px] text-gray-500">viajes</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="space-y-2">
              {stats.rideTypeBreakdown.map((rt) => (
                <div key={rt.type} className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-sm shrink-0"
                    style={{ backgroundColor: rt.color }}
                  />
                  <span className="text-xs text-gray-300 flex-1">
                    {rt.label}
                  </span>
                  <span className="text-xs text-gray-500">{rt.count}</span>
                  <span className="text-[10px] text-gray-500 w-10 text-right">
                    {rt.percentage}%
                  </span>
                  {/* Percentage bar */}
                  <div className="w-16 h-1 rounded-full bg-white/5 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${rt.percentage}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: rt.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
