'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import {
  ArrowLeft,
  CalendarDays,
  Car,
  Wallet,
  DollarSign,
  MapPin,
  Star,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Gift,
  Timer,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────
interface WeeklySummary {
  total_rides: number;
  total_earnings: number;
  total_tips: number;
  total_distance_km: number;
  avg_rating: number;
  acceptance_rate: number;
  cancellation_rate: number;
  active_days: number;
  peak_hours_rides: number;
}

interface DailyEarning {
  day: string;
  shortDay: string;
  earnings: number;
}

interface ComparisonMetric {
  label: string;
  current: number;
  previous: number;
  format: 'currency' | 'number' | 'percent';
  unit?: string;
}

// ─── Constants ────────────────────────────────────────────
const DAY_LABELS = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
const DAY_FULL = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'];

// Framer Motion variants
const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

// ─── Helpers ──────────────────────────────────────────────
function formatCurrency(amount: number): string {
  return `₡${Math.round(amount).toLocaleString('es-CR')}`;
}

function getWeekRange(offset: number): { start: Date; end: Date; label: string } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const start = new Date(now);
  start.setDate(now.getDate() + mondayOffset - offset * 7);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  const label =
    offset === 0
      ? 'Esta Semana'
      : offset === 1
        ? 'Semana Pasada'
        : `Hace ${offset} Semanas`;

  return { start, end, label };
}

function formatDateShort(d: Date): string {
  return d.toLocaleDateString('es-CR', { day: 'numeric', month: 'short' });
}

// ─── Comparison Badge Component ──────────────────────────
function ComparisonBadge({ current, previous, invert = false }: { current: number; previous: number; invert?: boolean }) {
  if (previous === 0 && current === 0) {
    return (
      <span className="flex items-center gap-0.5 text-[10px] text-gray-500">
        <Minus className="w-3 h-3" /> Sin datos
      </span>
    );
  }
  if (previous === 0) {
    return (
      <span className="flex items-center gap-0.5 text-[10px] text-emerald-400">
        <ArrowUpRight className="w-3 h-3" /> Nuevo
      </span>
    );
  }

  const change = ((current - previous) / previous) * 100;
  const isPositive = invert ? change < 0 : change > 0;
  const isNeutral = Math.abs(change) < 1;

  if (isNeutral) {
    return (
      <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
        <Minus className="w-3 h-3" /> Sin cambio
      </span>
    );
  }

  return (
    <span
      className={`flex items-center gap-0.5 text-[10px] font-medium ${
        isPositive ? 'text-emerald-400' : 'text-red-400'
      }`}
    >
      {isPositive ? (
        <ArrowUpRight className="w-3 h-3" />
      ) : (
        <ArrowDownRight className="w-3 h-3" />
      )}
      {Math.abs(change).toFixed(1)}%
    </span>
  );
}

// ─── Star Rating Component ────────────────────────────────
function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-4 h-4 ${
            star <= Math.round(rating)
              ? 'text-amber-400 fill-amber-400'
              : 'text-gray-600'
          }`}
        />
      ))}
      <span className="text-sm font-bold text-white ml-1">{rating.toFixed(1)}</span>
    </div>
  );
}

// ─── Main Page Component ─────────────────────────────────
export default function WeeklySummaryPage() {
  const router = useRouter();
  const { session } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const [currentWeek, setCurrentWeek] = useState<WeeklySummary | null>(null);
  const [previousWeek, setPreviousWeek] = useState<WeeklySummary | null>(null);
  const [dailyEarnings, setDailyEarnings] = useState<DailyEarning[]>([]);
  const [avgDuration, setAvgDuration] = useState(0);

  const weekRange = getWeekRange(weekOffset);

  const fetchSummary = useCallback(
    async (offset: number) => {
      const accessToken = session?.access_token;
      if (!accessToken) {
        // Don't redirect — let AuthGuard handle auth. Just return null.
        console.warn('[WeeklySummary] No access token available, skipping fetch');
        return null;
      }

      try {
        const res = await fetch(
          `/api/drivers/weekly-summary?weekOffset=${offset}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          },
        );

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Error ${res.status}`);
        }

        const data = await res.json();
        return data.summary as WeeklySummary;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error desconocido';
        if (offset === 0) {
          toast.error(msg);
        }
        return null;
      }
    },
    [session?.access_token, router],
  );

  const loadAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [currentData, previousData] = await Promise.all([
        fetchSummary(0),
        fetchSummary(1),
      ]);

      setCurrentWeek(currentData);
      setPreviousWeek(previousData);

      // Daily earnings: only show if there are real daily breakdowns from the API
      // Currently the API returns a weekly total, so we show the total without faking daily data
      setDailyEarnings([]);
    } finally {
      setLoading(false);
    }
  }, [fetchSummary]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Derived comparison data
  const displayData = weekOffset === 0 ? currentWeek : previousWeek;
  const comparisonBase = weekOffset === 0 ? previousWeek : null;

  const comparisons: ComparisonMetric[] = displayData
    ? [
        { label: 'Viajes', current: displayData.total_rides, previous: comparisonBase?.total_rides ?? 0, format: 'number' },
        { label: 'Ganancias', current: displayData.total_earnings, previous: comparisonBase?.total_earnings ?? 0, format: 'currency' },
        { label: 'Propinas', current: displayData.total_tips, previous: comparisonBase?.total_tips ?? 0, format: 'currency' },
        { label: 'Distancia (km)', current: displayData.total_distance_km, previous: comparisonBase?.total_distance_km ?? 0, format: 'number', unit: 'km' },
        { label: 'Calificacion', current: displayData.avg_rating, previous: comparisonBase?.avg_rating ?? 0, format: 'number' },
        { label: 'Cancelacion', current: displayData.cancellation_rate, previous: comparisonBase?.cancellation_rate ?? 0, format: 'percent', invert: true },
      ]
    : [];

  // ─── Loading State ──────────────────────────────────────
  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          <p className="text-sm text-gray-400">Cargando resumen semanal...</p>
        </div>
      </div>
    );
  }

  // ─── Empty State ────────────────────────────────────────
  if (!displayData) {
    return (
      <div className="p-4 space-y-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <button
            onClick={() => router.push('/driver')}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver
          </button>
          <h1 className="text-xl font-bold text-white">Resumen Semanal</h1>
        </motion.div>
        <div className="glass rounded-2xl p-8 text-center">
          <BarChart3 className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-400">No hay datos disponibles para esta semana.</p>
          <p className="text-xs text-gray-500 mt-1">Los datos apareceran cuando completes viajes.</p>
        </div>
      </div>
    );
  }

  const maxDailyEarning = Math.max(...dailyEarnings.map((d) => d.earnings), 1);
  const totalTips = displayData.total_tips;
  const avgTipPerRide =
    displayData.total_rides > 0 ? totalTips / displayData.total_rides : 0;

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="p-4 space-y-4"
    >
      {/* ─── Header with Back Button ──────────────────── */}
      <motion.div variants={item} className="flex items-center justify-between">
        <button
          onClick={() => router.push('/driver')}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver</span>
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-600 to-emerald-600 flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-white" />
          </div>
        </div>
      </motion.div>

      {/* ─── Page Title ───────────────────────────────── */}
      <motion.div variants={item}>
        <h1 className="text-xl font-bold text-white">Resumen Semanal</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          Tu desempeno detallado de la semana
        </p>
      </motion.div>

      {/* ─── Week Selector ────────────────────────────── */}
      <motion.div variants={item} className="glass-strong rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setWeekOffset((p) => Math.min(p + 1, 4))}
              disabled={weekOffset >= 4}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4 text-gray-300" />
            </button>
            <div className="text-center min-w-[160px]">
              <div className="flex items-center gap-2 justify-center">
                <CalendarDays className="w-4 h-4 text-cyan-400" />
                <span className="text-sm font-bold text-white">
                  {weekOffset === 0
                    ? 'Esta Semana'
                    : weekOffset === 1
                      ? 'Semana Pasada'
                      : `Hace ${weekOffset} Semanas`}
                </span>
              </div>
              <p className="text-[10px] text-gray-500 mt-0.5">
                {formatDateShort(weekRange.start)} — {formatDateShort(weekRange.end)}
              </p>
            </div>
            <button
              onClick={() => setWeekOffset((p) => Math.max(p - 1, 0))}
              disabled={weekOffset <= 0}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </button>
          </div>
          <div
            className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
              weekOffset === 0
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-white/5 text-gray-400'
            }`}
          >
            {weekOffset === 0 ? 'Actual' : 'Anterior'}
          </div>
        </div>
      </motion.div>

      {/* ─── Summary Cards Grid ───────────────────────── */}
      <motion.div variants={item} className="grid grid-cols-2 gap-2.5">
        {/* Total Viajes */}
        <div className="glass-strong rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/15 flex items-center justify-center">
              <Car className="w-4.5 h-4.5 text-cyan-400" />
            </div>
            {comparisonBase && (
              <ComparisonBadge
                current={displayData.total_rides}
                previous={comparisonBase.total_rides}
              />
            )}
          </div>
          <p className="text-2xl font-bold text-white">{displayData.total_rides}</p>
          <p className="text-[10px] text-gray-500 mt-0.5">Total viajes</p>
        </div>

        {/* Ganancias Totales */}
        <div className="glass-strong rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center">
              <Wallet className="w-4.5 h-4.5 text-emerald-400" />
            </div>
            {comparisonBase && (
              <ComparisonBadge
                current={displayData.total_earnings}
                previous={comparisonBase.total_earnings}
              />
            )}
          </div>
          <p className="text-xl font-bold text-white">
            {displayData.total_earnings >= 1000000
              ? `₡${(displayData.total_earnings / 1000000).toFixed(1)}M`
              : formatCurrency(displayData.total_earnings)}
          </p>
          <p className="text-[10px] text-gray-500 mt-0.5">Ganancias totales</p>
        </div>

        {/* Propinas Recibidas */}
        <div className="glass-strong rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center">
              <Gift className="w-4.5 h-4.5 text-amber-400" />
            </div>
            {comparisonBase && (
              <ComparisonBadge
                current={displayData.total_tips}
                previous={comparisonBase.total_tips}
              />
            )}
          </div>
          <p className="text-lg font-bold text-white">
            {formatCurrency(displayData.total_tips)}
          </p>
          <p className="text-[10px] text-gray-500 mt-0.5">Propinas recibidas</p>
        </div>

        {/* Distancia Recorrida */}
        <div className="glass-strong rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-xl bg-purple-500/15 flex items-center justify-center">
              <MapPin className="w-4.5 h-4.5 text-purple-400" />
            </div>
            {comparisonBase && (
              <ComparisonBadge
                current={displayData.total_distance_km}
                previous={comparisonBase.total_distance_km}
              />
            )}
          </div>
          <p className="text-2xl font-bold text-white">
            {displayData.total_distance_km.toFixed(1)}
          </p>
          <p className="text-[10px] text-gray-500 mt-0.5">Distancia recorrida (km)</p>
        </div>

        {/* Calificacion Promedio */}
        <div className="glass-strong rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-xl bg-yellow-500/15 flex items-center justify-center">
              <Star className="w-4.5 h-4.5 text-yellow-400 fill-yellow-400" />
            </div>
            {comparisonBase && (
              <ComparisonBadge
                current={displayData.avg_rating}
                previous={comparisonBase.avg_rating}
              />
            )}
          </div>
          <StarRating rating={displayData.avg_rating} />
          <p className="text-[10px] text-gray-500 mt-1">Calificacion promedio</p>
        </div>

        {/* Tasa de Aceptacion */}
        <div className="glass-strong rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center">
              <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400" />
            </div>
            {comparisonBase && (
              <ComparisonBadge
                current={displayData.acceptance_rate}
                previous={comparisonBase.acceptance_rate}
              />
            )}
          </div>
          <div className="flex items-end gap-1">
            <p className="text-2xl font-bold text-white">
              {displayData.acceptance_rate.toFixed(0)}
            </p>
            <span className="text-sm text-gray-400 mb-0.5">%</span>
          </div>
          <p className="text-[10px] text-gray-500 mt-0.5">Tasa de aceptacion</p>
        </div>

        {/* Tasa de Cancelacion */}
        <div className="glass-strong rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-xl bg-red-500/15 flex items-center justify-center">
              <XCircle className="w-4.5 h-4.5 text-red-400" />
            </div>
            {comparisonBase && (
              <ComparisonBadge
                current={displayData.cancellation_rate}
                previous={comparisonBase.cancellation_rate}
                invert
              />
            )}
          </div>
          <div className="flex items-end gap-1">
            <p
              className={`text-2xl font-bold ${
                displayData.cancellation_rate <= 5
                  ? 'text-emerald-400'
                  : displayData.cancellation_rate <= 10
                    ? 'text-amber-400'
                    : 'text-red-400'
              }`}
            >
              {displayData.cancellation_rate.toFixed(0)}
            </p>
            <span className="text-sm text-gray-400 mb-0.5">%</span>
          </div>
          <p className="text-[10px] text-gray-500 mt-0.5">Tasa de cancelacion</p>
        </div>

        {/* Dias Activos */}
        <div className="glass-strong rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-xl bg-sky-500/15 flex items-center justify-center">
              <CalendarDays className="w-4.5 h-4.5 text-sky-400" />
            </div>
          </div>
          <div className="flex items-end gap-1">
            <p className="text-2xl font-bold text-white">
              {displayData.active_days}
            </p>
            <span className="text-sm text-gray-400 mb-0.5">/7</span>
          </div>
          <p className="text-[10px] text-gray-500 mt-0.5">Dias activos</p>
          {/* Mini day indicators */}
          <div className="flex gap-1 mt-2">
            {DAY_LABELS.map((day, i) => (
              <div
                key={day}
                className={`flex-1 h-1.5 rounded-full ${
                  i < displayData.active_days
                    ? 'bg-cyan-400'
                    : 'bg-white/10'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Viajes en Hora Pico */}
        <div className="glass-strong rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-xl bg-orange-500/15 flex items-center justify-center">
              <Zap className="w-4.5 h-4.5 text-orange-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white">
            {displayData.peak_hours_rides}
          </p>
          <p className="text-[10px] text-gray-500 mt-0.5">Viajes en hora pico</p>
          {displayData.total_rides > 0 && (
            <p className="text-[9px] text-gray-600 mt-1">
              {((displayData.peak_hours_rides / displayData.total_rides) * 100).toFixed(0)}% del total
            </p>
          )}
        </div>

        {/* Duracion Promedio */}
        <div className="glass-strong rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-xl bg-teal-500/15 flex items-center justify-center">
              <Timer className="w-4.5 h-4.5 text-teal-400" />
            </div>
          </div>
          <div className="flex items-end gap-1">
            <p className="text-2xl font-bold text-white">
              {avgDuration > 0 ? avgDuration : '—'}
            </p>
            {avgDuration > 0 && (
              <span className="text-sm text-gray-400 mb-0.5">min</span>
            )}
          </div>
          <p className="text-[10px] text-gray-500 mt-0.5">Duracion promedio</p>
        </div>
      </motion.div>

      {/* ─── Visual Bar Chart: Earnings per Day ──────── */}
      <motion.div variants={item} className="glass-strong rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-bold text-white">
              Ganancias por Dia
            </span>
          </div>
          <span className="text-xs text-gray-500">
            Total: {formatCurrency(displayData.total_earnings)}
          </span>
        </div>

        <div className="space-y-3">
          {dailyEarnings.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-gray-500">Sin datos diarios disponibles</p>
              <p className="text-xs text-gray-600 mt-1">Los datos apareceran al completar viajes</p>
            </div>
          ) : (
          <>
          {dailyEarnings.map((day, i) => {
            const heightPercent = maxDailyEarning > 0 ? (day.earnings / maxDailyEarning) * 100 : 0;
            const isHighest = day.earnings === maxDailyEarning && day.earnings > 0;

            return (
              <div key={day.shortDay} className="flex items-center gap-3">
                {/* Day label */}
                <span className="w-8 text-[11px] text-gray-400 text-right font-medium shrink-0">
                  {day.shortDay}
                </span>

                {/* Bar */}
                <div className="flex-1 relative h-7 rounded-lg bg-white/5 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(heightPercent, 0)}%` }}
                    transition={{
                      duration: 0.7,
                      delay: i * 0.07,
                      ease: 'easeOut',
                    }}
                    className={`absolute inset-y-0 left-0 rounded-lg ${
                      isHighest
                        ? 'bg-gradient-to-r from-emerald-500 to-cyan-400'
                        : day.earnings > 0
                          ? 'bg-gradient-to-r from-cyan-600 to-cyan-500/80'
                          : ''
                    }`}
                  >
                    {day.earnings > 0 && (
                      <div className="absolute inset-0 bg-gradient-to-r from-white/15 to-transparent" />
                    )}
                  </motion.div>

                  {/* Value inside bar */}
                  {day.earnings > 0 && heightPercent > 20 && (
                    <span className="absolute inset-0 flex items-center px-2 text-[10px] font-bold text-white z-10 truncate">
                      ₡{(day.earnings / 1000).toFixed(0)}k
                    </span>
                  )}
                </div>

                {/* Value outside bar for small bars */}
                {day.earnings > 0 && heightPercent <= 20 && (
                  <span className="text-[10px] text-gray-500 shrink-0 w-12 text-right">
                    ₡{(day.earnings / 1000).toFixed(0)}k
                  </span>
                )}
                {day.earnings === 0 && (
                  <span className="text-[10px] text-gray-600 shrink-0 w-12 text-right">
                    —
                  </span>
                )}
              </div>
            );
          })}
          </>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/5">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-gradient-to-r from-emerald-500 to-cyan-400" />
            <span className="text-[9px] text-gray-500">Mejor dia</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-gradient-to-r from-cyan-600 to-cyan-500" />
            <span className="text-[9px] text-gray-500">Con viajes</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-white/5" />
            <span className="text-[9px] text-gray-500">Sin viajes</span>
          </div>
        </div>
      </motion.div>

      {/* ─── Comparison vs Last Week ─────────────────── */}
      {weekOffset === 0 && previousWeek && (
        <motion.div
          variants={item}
          className="glass-strong rounded-2xl p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-bold text-white">
                Comparativa vs Semana Pasada
              </span>
            </div>
            <span className="text-[10px] text-gray-500 px-2 py-0.5 rounded-full bg-white/5">
              Semana a semana
            </span>
          </div>

          <div className="space-y-3">
            {comparisons.map((metric) => {
              const currentFormatted =
                metric.format === 'currency'
                  ? formatCurrency(metric.current)
                  : metric.format === 'percent'
                    ? `${metric.current.toFixed(1)}%`
                    : `${metric.current.toFixed(metric.label === 'Calificacion' ? 1 : 0)}${metric.unit ? ` ${metric.unit}` : ''}`;

              const previousFormatted =
                metric.format === 'currency'
                  ? formatCurrency(metric.previous)
                  : metric.format === 'percent'
                    ? `${metric.previous.toFixed(1)}%`
                    : `${metric.previous.toFixed(metric.label === 'Calificacion' ? 1 : 0)}${metric.unit ? ` ${metric.unit}` : ''}`;

              const hasChange = metric.current !== metric.previous && metric.previous > 0;
              const change = metric.previous > 0 ? ((metric.current - metric.previous) / metric.previous) * 100 : 0;
              const isPositive = metric.invert ? change < 0 : change > 0;

              return (
                <div
                  key={metric.label}
                  className="flex items-center justify-between p-3 rounded-xl bg-white/5"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs text-gray-300 shrink-0">
                      {metric.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[10px] text-gray-500">
                      {previousFormatted}
                    </span>
                    <span className="text-gray-600">→</span>
                    <span className="text-xs font-bold text-white">
                      {currentFormatted}
                    </span>
                    {hasChange && (
                      <span
                        className={`flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          isPositive
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : 'bg-red-500/15 text-red-400'
                        }`}
                      >
                        {isPositive ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        {Math.abs(change).toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {weekOffset !== 0 && (
        <motion.div
          variants={item}
          className="glass rounded-2xl p-5 text-center"
        >
          <p className="text-xs text-gray-500">
            Vuelve a &quot;Esta Semana&quot; para ver la comparativa con la semana anterior.
          </p>
        </motion.div>
      )}

      {/* ─── Tips Breakdown ───────────────────────────── */}
      <motion.div variants={item} className="glass-strong rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Gift className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-bold text-white">
              Desglose de Propinas
            </span>
          </div>
          {totalTips > 0 && (
            <span className="text-[10px] text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded-full font-bold">
              {displayData.total_rides > 0
                ? `${((totalTips / displayData.total_earnings) * 100).toFixed(1)}%`
                : '0%'}{' '}
              de ganancias
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Total Tips */}
          <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/15 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-amber-400" />
              </div>
              <span className="text-[10px] text-gray-400">Total propinas</span>
            </div>
            <p className="text-xl font-bold text-amber-300">
              {formatCurrency(totalTips)}
            </p>
            {comparisonBase && totalTips > 0 && (
              <ComparisonBadge current={totalTips} previous={comparisonBase.total_tips} />
            )}
          </div>

          {/* Average Tip per Ride */}
          <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/5 border border-cyan-500/15 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                <Gift className="w-4 h-4 text-cyan-400" />
              </div>
              <span className="text-[10px] text-gray-400">Promedio por viaje</span>
            </div>
            <p className="text-xl font-bold text-cyan-300">
              {avgTipPerRide > 0
                ? formatCurrency(avgTipPerRide)
                : '—'}
            </p>
            <p className="text-[9px] text-gray-600 mt-0.5">
              De {displayData.total_rides} viajes
            </p>
          </div>
        </div>

        {/* Tip distribution bar */}
        {displayData.total_earnings > 0 && (
          <div className="mt-4 pt-3 border-t border-white/5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-gray-500">
                Propinas vs Tarifas
              </span>
              <span className="text-[10px] text-gray-400">
                {totalTips.toLocaleString('es-CR')} / {displayData.total_earnings.toLocaleString('es-CR')} ₡
              </span>
            </div>
            <div className="w-full h-3 rounded-full bg-white/10 overflow-hidden flex">
              <motion.div
                initial={{ width: 0 }}
                animate={{
                  width: `${Math.max((totalTips / displayData.total_earnings) * 100, 0)}%`,
                }}
                transition={{ duration: 0.8, delay: 0.5, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-amber-500 to-orange-400 rounded-l-full"
              />
              <motion.div
                initial={{ width: '100%' }}
                animate={{
                  width: `${Math.max(100 - (totalTips / displayData.total_earnings) * 100, 0)}%`,
                }}
                transition={{ duration: 0.8, delay: 0.5, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-cyan-600 to-cyan-500 rounded-r-full"
              />
            </div>
            <div className="flex justify-between mt-1.5">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-[9px] text-gray-500">Propinas</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-cyan-500" />
                <span className="text-[9px] text-gray-500">Tarifas</span>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* ─── Quick Performance Summary ───────────────── */}
      <motion.div variants={item} className="glass rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-bold text-white">
            Resumen Rapido
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/15">
            <p className="text-lg font-bold text-emerald-400">
              {displayData.acceptance_rate >= 80 ? (
                <CheckCircle2 className="w-5 h-5 mx-auto" />
              ) : displayData.acceptance_rate >= 50 ? (
                <TrendingUp className="w-5 h-5 mx-auto" />
              ) : (
                <TrendingDown className="w-5 h-5 mx-auto" />
              )}
            </p>
            <p className="text-[9px] text-gray-400 mt-1">Aceptacion</p>
            <p className="text-xs font-bold text-white">
              {displayData.acceptance_rate.toFixed(0)}%
            </p>
          </div>
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/15">
            <p className="text-lg font-bold text-amber-400">
              {displayData.avg_rating >= 4.5 ? (
                <Star className="w-5 h-5 mx-auto fill-amber-400" />
              ) : displayData.avg_rating >= 4.0 ? (
                <Star className="w-5 h-5 mx-auto" />
              ) : (
                <Star className="w-5 h-5 mx-auto text-gray-500" />
              )}
            </p>
            <p className="text-[9px] text-gray-400 mt-1">Calificacion</p>
            <p className="text-xs font-bold text-white">
              {displayData.avg_rating > 0 ? displayData.avg_rating.toFixed(1) : '\u2014'}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/15">
            <p className="text-lg font-bold text-red-400">
              {displayData.cancellation_rate <= 3 ? (
                <CheckCircle2 className="w-5 h-5 mx-auto" />
              ) : displayData.cancellation_rate <= 8 ? (
                <TrendingUp className="w-5 h-5 mx-auto" />
              ) : (
                <XCircle className="w-5 h-5 mx-auto" />
              )}
            </p>
            <p className="text-[9px] text-gray-400 mt-1">Cancelacion</p>
            <p className="text-xs font-bold text-white">
              {displayData.cancellation_rate.toFixed(0)}%
            </p>
          </div>
        </div>
      </motion.div>

      {/* Bottom spacing */}
      <div className="h-4" />
    </motion.div>
  );
}
