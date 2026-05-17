'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3, TrendingUp, Users, MapPin, Clock, DollarSign,
  Star, Trophy, ArrowUpRight, ArrowDownRight, Globe
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Skeleton } from '@/components/ui/skeleton';

// ─── Constants ───────────────────────────────────────────────────────────────

const SPANISH_DAYS = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
const SPANISH_MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const geoColors = ['#06b6d4', '#2563eb', '#8b5cf6', '#f59e0b', '#64748b'];

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChartData {
  day: string;
  value: number;
}

interface KeyMetric {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  trend: string;
  trendUp: boolean;
}

interface TopRoute {
  from: string;
  to: string;
  trips: number;
  avgPrice: string;
}

interface DriverEntry {
  name: string;
  rides: number;
  rating: number;
  earnings: string;
}

interface GeoZone {
  zone: string;
  percentage: number;
}

type TimeRange = 'week' | 'month' | 'year';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return `₡${Math.round(amount).toLocaleString('es-CR')}`;
}

function formatMillions(val: number) {
  if (val >= 1000000) return `₡${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `₡${(val / 1000).toFixed(0)}K`;
  return `₡${val.toLocaleString()}`;
}

function getDateRange(range: TimeRange): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();
  switch (range) {
    case 'week':
      start.setDate(end.getDate() - 7);
      break;
    case 'month':
      start.setDate(end.getDate() - 30);
      break;
    case 'year':
      start.setFullYear(end.getFullYear() - 1);
      break;
  }
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

function groupByDay(data: any[], dateField: string, valueField: string): ChartData[] {
  const grouped: Record<string, number> = {};
  for (const item of data) {
    const d = new Date(item[dateField]);
    const key = d.toISOString().split('T')[0];
    grouped[key] = (grouped[key] || 0) + (item[valueField] || 0);
  }

  return Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => {
      const d = new Date(date + 'T00:00:00');
      return {
        day: SPANISH_DAYS[d.getDay()],
        value,
      };
    });
}

function groupByMonth(data: any[], dateField: string, valueField: string): ChartData[] {
  const grouped: Record<string, number> = {};
  for (const item of data) {
    const d = new Date(item[dateField]);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    grouped[key] = (grouped[key] || 0) + (item[valueField] || 0);
  }

  return Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => {
      const [year, month] = key.split('-');
      return {
        day: SPANISH_MONTHS[parseInt(month, 10) - 1],
        value,
      };
    });
}

function groupByWeek(data: any[], dateField: string, valueField: string): ChartData[] {
  const grouped: Record<string, number> = {};
  for (const item of data) {
    const d = new Date(item[dateField]);
    // Get start of week (Monday)
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const weekStart = new Date(d);
    weekStart.setDate(diff);
    const key = weekStart.toISOString().split('T')[0];
    grouped[key] = (grouped[key] || 0) + (item[valueField] || 0);
  }

  return Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value], i) => ({
      day: `Sem ${i + 1}`,
      value,
    }));
}

// ─── SimpleBarChart ──────────────────────────────────────────────────────────

function SimpleBarChart({ data, color = 'from-cyan-500 to-blue-600', formatValue }: { data: ChartData[]; color?: string; formatValue?: (v: number) => string }) {
  const maxVal = Math.max(...data.map(d => d.value), 1);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
        Sin datos
      </div>
    );
  }

  return (
    <div className="flex items-end gap-2 h-48 px-2">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-2">
          <span className="text-[10px] text-gray-400 font-medium">
            {formatValue ? formatValue(d.value) : d.value.toLocaleString()}
          </span>
          <motion.div
            className={`w-full rounded-t-lg bg-gradient-to-t ${color} min-h-[4px] relative group cursor-pointer`}
            initial={{ height: 0 }}
            animate={{ height: `${(d.value / maxVal) * 100}%` }}
            transition={{ delay: 0.3 + i * 0.1, duration: 0.6, ease: 'easeOut' }}
            whileHover={{ opacity: 0.8 }}
          />
          <span className="text-xs text-gray-500">{d.day}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Loading Skeleton ────────────────────────────────────────────────────────

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Skeleton className="h-9 w-40 bg-white/10" />
          <Skeleton className="h-5 w-60 mt-2 bg-white/5" />
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-28 rounded-xl bg-white/5" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <Skeleton className="w-10 h-10 rounded-xl bg-white/10" />
              <Skeleton className="w-14 h-5 rounded-full bg-white/5" />
            </div>
            <Skeleton className="h-8 w-24 mb-1 bg-white/10" />
            <Skeleton className="h-4 w-36 bg-white/5" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <Skeleton className="h-6 w-40 bg-white/10" />
              <Skeleton className="h-5 w-24 bg-white/5" />
            </div>
            <div className="flex items-end gap-2 h-48">
              {Array.from({ length: 7 }).map((_, j) => (
                <div key={j} className="flex-1">
                  <Skeleton className="h-32 w-full rounded-t-lg bg-white/5" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass rounded-2xl p-5">
          <Skeleton className="h-6 w-48 mb-4 bg-white/10" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full bg-white/5" />
            ))}
          </div>
        </div>
        <div className="glass rounded-2xl p-5">
          <Skeleton className="h-6 w-48 mb-4 bg-white/10" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i}>
                <Skeleton className="h-3 w-24 mb-1 bg-white/5" />
                <Skeleton className="h-2.5 w-full rounded-full bg-white/5" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass rounded-2xl p-5">
          <Skeleton className="h-6 w-48 mb-4 bg-white/10" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl bg-white/5" />
            ))}
          </div>
        </div>
        <div className="glass rounded-2xl p-5">
          <Skeleton className="h-6 w-48 mb-4 bg-white/10" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl bg-white/5" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('week');
  const [loading, setLoading] = useState(true);

  const [revenueData, setRevenueData] = useState<ChartData[]>([]);
  const [ridesData, setRidesData] = useState<ChartData[]>([]);
  const [userGrowthData, setUserGrowthData] = useState<ChartData[]>([]);
  const [topRoutes, setTopRoutes] = useState<TopRoute[]>([]);
  const [driverLeaderboard, setDriverLeaderboard] = useState<DriverEntry[]>([]);
  const [geoDistribution, setGeoDistribution] = useState<GeoZone[]>([]);
  const [keyMetrics, setKeyMetrics] = useState<KeyMetric[]>([]);

  const fetchAnalyticsData = useCallback(async (range: TimeRange) => {
    setLoading(true);
    try {
      const { start } = getDateRange(range);
      const startISO = start.toISOString();

      // User growth: last 6 months
      const ugStart = new Date();
      ugStart.setMonth(ugStart.getMonth() - 6);
      ugStart.setDate(1);
      ugStart.setHours(0, 0, 0, 0);
      const ugStartISO = ugStart.toISOString();

      const [
        completedRidesRes,
        allRidesRes,
        profilesRes,
        topRoutesRidesRes,
        driversRes,
        allCompletedRidesRes, // For key metrics (wider range)
      ] = await Promise.all([
        // Completed rides for revenue chart
        supabase.from('rides').select('price, created_at')
          .gte('created_at', startISO)
          .eq('status', 'completed'),
        // All rides for rides chart
        supabase.from('rides').select('created_at, id')
          .gte('created_at', startISO),
        // Profiles for user growth (last 6 months)
        supabase.from('profiles').select('created_at')
          .gte('created_at', ugStartISO),
        // Top routes (completed rides, limited for performance)
        supabase.from('rides').select('origin, destination, price')
          .eq('status', 'completed')
          .not('origin', 'is', null)
          .not('destination', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1000),
        // Driver leaderboard
        supabase.from('drivers').select('total_rides, rating, total_earnings, profiles(name)')
          .order('total_rides', { ascending: false })
          .limit(5),
        // All completed rides for key metrics (last 30 days for accuracy)
        supabase.from('rides').select('price, duration, distance, created_at, status, origin')
          .gte('created_at', startISO),
      ]);

      // ── Revenue Chart ────────────────────────────────────────────────
      const completedRides = completedRidesRes.data ?? [];
      let revenue: ChartData[] = [];
      if (range === 'year') {
        revenue = groupByMonth(completedRides, 'created_at', 'price');
      } else if (range === 'month') {
        revenue = groupByWeek(completedRides, 'created_at', 'price');
      } else {
        revenue = groupByDay(completedRides, 'created_at', 'price');
      }
      setRevenueData(revenue);

      // ── Rides Chart ──────────────────────────────────────────────────
      const allRides = allRidesRes.data ?? [];
      const ridesByRange = allRides.map((r: any) => ({ ...r, value: 1 }));
      let rides: ChartData[] = [];
      if (range === 'year') {
        rides = groupByMonth(ridesByRange, 'created_at', 'value');
      } else if (range === 'month') {
        rides = groupByWeek(ridesByRange, 'created_at', 'value');
      } else {
        rides = groupByDay(ridesByRange, 'created_at', 'value');
      }
      setRidesData(rides);

      // ── User Growth ──────────────────────────────────────────────────
      const profiles = profilesRes.data ?? [];
      const profileWithCount = profiles.map((p: any) => ({ ...p, count: 1 }));
      const userGrowth = groupByMonth(profileWithCount, 'created_at', 'count');
      setUserGrowthData(userGrowth);

      // ── Top Routes ───────────────────────────────────────────────────
      const routeRides = topRoutesRidesRes.data ?? [];
      const routeMap: Record<string, { from: string; to: string; trips: number; totalPrice: number }> = {};
      for (const r of routeRides) {
        const key = `${r.origin || '?'}|${r.destination || '?'}`;
        if (!routeMap[key]) {
          routeMap[key] = { from: r.origin || '?', to: r.destination || '?', trips: 0, totalPrice: 0 };
        }
        routeMap[key].trips++;
        routeMap[key].totalPrice += r.price || 0;
      }
      const sortedRoutes = Object.values(routeMap)
        .sort((a, b) => b.trips - a.trips)
        .slice(0, 5)
        .map(r => ({
          from: r.from,
          to: r.to,
          trips: r.trips,
          avgPrice: formatCurrency(r.trips > 0 ? r.totalPrice / r.trips : 0),
        }));
      setTopRoutes(sortedRoutes);

      // ── Driver Leaderboard ───────────────────────────────────────────
      const driverData = driversRes.data ?? [];
      const leaderboard: DriverEntry[] = driverData.map((d: any) => ({
        name: d.profiles?.name || 'Conductor',
        rides: d.total_rides ?? 0,
        rating: d.rating ?? 0,
        earnings: formatCurrency(d.total_earnings ?? 0),
      }));
      setDriverLeaderboard(leaderboard);

      // ── Key Metrics (real period-over-period comparison) ──────────
      const allInRange = allCompletedRidesRes.data ?? [];
      const completedInRange = allInRange.filter((r: any) => r.status === 'completed');

      const avgDuration = completedInRange.length > 0
        ? completedInRange.reduce((sum: number, r: any) => sum + (r.duration || 0), 0) / completedInRange.length
        : 0;

      const avgFare = completedInRange.length > 0
        ? completedInRange.reduce((sum: number, r: any) => sum + (r.price || 0), 0) / completedInRange.length
        : 0;

      // Fetch previous period for real trend comparison
      let prevStartISO = '';
      const { start: prevStart } = (() => {
        const prev = new Date();
        switch (range) {
          case 'week': prev.setDate(prev.getDate() - 14); break;
          case 'month': prev.setDate(prev.getDate() - 60); break;
          case 'year': prev.setFullYear(prev.getFullYear() - 2); break;
        }
        prev.setHours(0, 0, 0, 0);
        const currStart = new Date(start);
        prevStartISO = prev.toISOString();
        return { start: prev, end: currStart };
      })();

      const { data: prevPeriodRides } = await supabase.from('rides').select('price, status')
        .gte('created_at', prevStartISO)
        .lt('created_at', startISO)
        .eq('status', 'completed');

      const prevCompleted = (prevPeriodRides ?? []).filter((r: any) => r.status === 'completed');
      const prevAvgFare = prevCompleted.length > 0
        ? prevCompleted.reduce((sum: number, r: any) => sum + (r.price || 0), 0) / prevCompleted.length
        : 0;
      const prevTotalRides = (prevPeriodRides ?? []).length;

      const fareTrend = prevAvgFare > 0
        ? `${(((avgFare - prevAvgFare) / prevAvgFare) * 100).toFixed(0)}%`
        : '0%';
      const ridesTrend = prevTotalRides > 0
        ? `${(((completedInRange.length - prevTotalRides) / prevTotalRides) * 100).toFixed(0)}%`
        : '0%';

      const totalDistance = completedInRange.reduce((sum: number, r: any) => sum + (r.distance || 0), 0);

      // Driver utilization: ratio of completed+in_progress rides to total rides
      const totalRidesCount = allInRange.length || 1;
      const completedCount = completedInRange.length;
      const utilizationPct = totalRidesCount > 0 ? Math.round((completedCount / totalRidesCount) * 100) : 0;

      // User retention estimate: ratio of repeat users in the period
      const riderIds = allInRange.map((r: any) => r.rider_id).filter(Boolean);
      const uniqueRiders = new Set(riderIds);
      const repeatRiders = riderIds.filter((id: string) => riderIds.filter((rid: string) => rid === id).length > 1);
      const uniqueRepeatRiders = new Set(repeatRiders);
      const retentionPct = uniqueRiders.size > 0
        ? Math.round((uniqueRepeatRiders.size / uniqueRiders.size) * 100)
        : 0;

      setKeyMetrics([
        {
          label: 'Tiempo promedio de viaje',
          value: avgDuration > 0 ? `${Math.round(avgDuration)} min` : '— min',
          icon: Clock,
          trend: completedInRange.length > 0 ? `${completedInRange.length} viajes` : 'Sin datos',
          trendUp: avgDuration > 0 && avgDuration < 30,
        },
        {
          label: 'Tarifa promedio',
          value: avgFare > 0 ? formatCurrency(avgFare) : '₡0',
          icon: DollarSign,
          trend: fareTrend.startsWith('-') ? fareTrend : `+${fareTrend}`,
          trendUp: !fareTrend.startsWith('-'),
        },
        {
          label: 'Viajes vs periodo anterior',
          value: `${completedInRange.length} viajes`,
          icon: TrendingUp,
          trend: ridesTrend.startsWith('-') ? ridesTrend : `+${ridesTrend}`,
          trendUp: !ridesTrend.startsWith('-'),
        },
        {
          label: 'Retención de usuarios',
          value: `${retentionPct}%`,
          icon: Users,
          trend: uniqueRiders.size > 0 ? `${uniqueRiders.size} usuarios` : 'Sin datos',
          trendUp: retentionPct >= 40,
        },
      ]);

      // ── Geo Distribution ─────────────────────────────────────────────
      const originMap: Record<string, number> = {};
      for (const r of allInRange) {
        const origin = r.origin || 'Otros';
        // Simplify origin to city/zone level
        let zone = 'Otros';
        const lower = origin.toLowerCase();
        if (lower.includes('san josé') || lower.includes('san jose') || lower.includes('centro')) zone = 'San José Metro';
        else if (lower.includes('heredia')) zone = 'Heredia';
        else if (lower.includes('alajuela')) zone = 'Alajuela';
        else if (lower.includes('cartago')) zone = 'Cartago';
        else if (lower.includes('escazú') || lower.includes('escazu')) zone = 'Escazú';
        else if (lower.includes('santa ana')) zone = 'Santa Ana';
        else if (lower.includes('pavas')) zone = 'Pavas';
        else zone = 'Otros';
        originMap[zone] = (originMap[zone] || 0) + 1;
      }

      const totalOrigins = Object.values(originMap).reduce((a, b) => a + b, 0) || 1;
      const geoSorted = Object.entries(originMap)
        .sort(([, a], [, b]) => b - a)
        .map(([zone, count]) => ({
          zone,
          percentage: Math.round((count / totalOrigins) * 100),
        }));
      setGeoDistribution(geoSorted.length > 0 ? geoSorted : [
        { zone: 'San José Metro', percentage: 0 },
        { zone: 'Heredia', percentage: 0 },
        { zone: 'Alajuela', percentage: 0 },
        { zone: 'Cartago', percentage: 0 },
        { zone: 'Otros', percentage: 0 },
      ]);

      setLoading(false);
    } catch (error) {
      console.error('Error cargando analytics:', error);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalyticsData(timeRange);
  }, [timeRange, fetchAnalyticsData]);

  // ── Compute totals ──────────────────────────────────────────────────
  const revenueTotal = revenueData.reduce((s, d) => s + d.value, 0);
  const ridesTotal = ridesData.reduce((s, d) => s + d.value, 0);

  const rangeLabel = timeRange === 'week' ? '7 días' : timeRange === 'month' ? '30 días' : '12 meses';

  // ── Loading State ───────────────────────────────────────────────────
  if (loading) {
    return <AnalyticsSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Analytics</h1>
          <p className="text-gray-400 mt-1">Métricas y análisis del sistema</p>
        </div>
        <div className="flex gap-2">
          {(['week', 'month', 'year'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-xl text-xs font-medium transition-all ${
                timeRange === range
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'bg-white/5 text-gray-400 hover:text-white border border-transparent'
              }`}
            >
              {range === 'week' ? 'Esta Semana' : range === 'month' ? 'Este Mes' : 'Este Año'}
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {keyMetrics.map((metric, i) => (
          <motion.div
            key={i}
            className="glass rounded-2xl p-5"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            whileHover={{ y: -2 }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                <metric.icon className="w-5 h-5 text-cyan-400" />
              </div>
              <span className={`flex items-center gap-0.5 text-xs font-medium ${metric.trendUp ? 'text-emerald-400' : 'text-red-400'}`}>
                {metric.trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {metric.trend}
              </span>
            </div>
            <p className="text-2xl font-bold text-white">{metric.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{metric.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <motion.div
          className="glass rounded-2xl p-5"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-400" />
              Ingresos ({rangeLabel})
            </h3>
            <span className="text-sm font-bold text-emerald-400">
              {formatMillions(revenueTotal)} total
            </span>
          </div>
          <SimpleBarChart data={revenueData} color="from-emerald-500 to-cyan-600" formatValue={formatMillions} />
        </motion.div>

        {/* Rides Chart */}
        <motion.div
          className="glass rounded-2xl p-5"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-cyan-400" />
              Viajes ({rangeLabel})
            </h3>
            <span className="text-sm font-bold text-cyan-400">
              {ridesTotal.toLocaleString()} total
            </span>
          </div>
          <SimpleBarChart data={ridesData} color="from-cyan-500 to-blue-600" />
        </motion.div>
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Growth */}
        <motion.div
          className="glass rounded-2xl p-5"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-purple-400" />
            Crecimiento de Usuarios
          </h3>
          <SimpleBarChart data={userGrowthData} color="from-purple-500 to-blue-600" />
        </motion.div>

        {/* Geographic Distribution */}
        <motion.div
          className="glass rounded-2xl p-5"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
            <Globe className="w-5 h-5 text-blue-400" />
            Distribución Geográfica
          </h3>
          <div className="space-y-3">
            {geoDistribution.length > 0 && geoDistribution.some(g => g.percentage > 0) ? geoDistribution.map((geo, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-300">{geo.zone}</span>
                  <span className="text-sm font-medium text-white">{geo.percentage}%</span>
                </div>
                <div className="h-2.5 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: geoColors[i % geoColors.length] }}
                    initial={{ width: 0 }}
                    animate={{ width: `${geo.percentage}%` }}
                    transition={{ delay: 0.6 + i * 0.1, duration: 0.8, ease: 'easeOut' }}
                  />
                </div>
              </div>
            )) : (
              <div className="py-8 text-center">
                <Globe className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">Sin datos geográficos</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Third Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Routes */}
        <motion.div
          className="glass rounded-2xl p-5"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
            <MapPin className="w-5 h-5 text-amber-400" />
            Rutas Más Populares
          </h3>
          <div className="space-y-3">
            {topRoutes.length > 0 ? topRoutes.map((route, i) => (
              <motion.div
                key={i}
                className="flex items-center gap-3 bg-white/5 rounded-xl p-3"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 + i * 0.05 }}
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center text-sm font-bold text-amber-400">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{route.from} → {route.to}</p>
                  <p className="text-xs text-gray-500">{route.trips.toLocaleString()} viajes</p>
                </div>
                <span className="text-sm font-medium text-emerald-400">{route.avgPrice}</span>
              </motion.div>
            )) : (
              <div className="py-8 text-center">
                <MapPin className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">Sin datos de rutas</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Driver Leaderboard */}
        <motion.div
          className="glass rounded-2xl p-5"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
            <Trophy className="w-5 h-5 text-amber-400" />
            Ranking de Conductores
          </h3>
          <div className="space-y-3">
            {driverLeaderboard.length > 0 ? driverLeaderboard.map((driver, i) => (
              <motion.div
                key={i}
                className={`flex items-center gap-3 rounded-xl p-3 ${
                  i === 0 ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-white/5'
                }`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.8 + i * 0.05 }}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                  i === 0 ? 'bg-amber-500/30 text-amber-400' :
                  i === 1 ? 'bg-gray-400/30 text-gray-300' :
                  i === 2 ? 'bg-orange-500/30 text-orange-400' :
                  'bg-white/10 text-gray-400'
                }`}>
                  {i === 0 ? <Trophy className="w-4 h-4" /> : i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{driver.name}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{driver.rides} viajes</span>
                    <span className="flex items-center gap-0.5 text-amber-400"><Star className="w-3 h-3 fill-amber-400" /> {driver.rating}</span>
                  </div>
                </div>
                <span className="text-sm font-medium text-emerald-400">{driver.earnings}</span>
              </motion.div>
            )) : (
              <div className="py-8 text-center">
                <Trophy className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">Sin datos de conductores</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
