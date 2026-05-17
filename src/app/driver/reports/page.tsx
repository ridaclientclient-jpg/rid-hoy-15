'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { supabase, type Driver } from '@/lib/supabase';
import { toast } from 'sonner';
import {
  BarChart3, TrendingUp, TrendingDown, Calendar, Star, DollarSign,
  Clock, Car, XCircle, CheckCircle2, Route as RouteIcon, Loader2,
  ChevronDown, ChevronUp, Target, Percent,
} from 'lucide-react';

interface WeeklyReport {
  week_start: string;
  week_end: string;
  total_rides: number;
  completed_rides: number;
  cancelled_rides: number;
  total_earnings: number;
  total_commission: number;
  total_tips: number;
  net_earnings: number;
  total_distance: number;
  avg_rating: number;
  acceptance_rate: number;
  online_hours: number;
}

function formatCurrency(amount: number): string {
  return `₡${Math.round(amount || 0).toLocaleString()}`;
}

function formatWeekRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  return `${s.toLocaleDateString('es-CR', opts)} - ${e.toLocaleDateString('es-CR', opts)}`;
}

function TrendIndicator({ current, previous, suffix = '' }: { current: number; previous: number; suffix?: string }) {
  if (!previous || previous === 0) return null;
  const diff = current - previous;
  const pct = Math.round((diff / previous) * 100);
  if (Math.abs(pct) < 1) return null;
  const isUp = diff > 0;
  return (
    <span className={`flex items-center gap-0.5 text-[10px] font-medium ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
      {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {isUp ? '+' : ''}{pct}%{suffix}
    </span>
  );
}

export default function DriverReports() {
  const { user } = useAuthStore();
  const [driver, setDriver] = useState<Driver | null>(null);
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);

  const maxEarnings = reports.length > 0 ? Math.max(...reports.map(r => r.net_earnings || 0), 1) : 1;

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      // Fetch driver
      const { data: driverData } = await supabase.from('drivers').select('*').eq('user_id', user.id).single();
      if (driverData) setDriver(driverData);

      // Generate current week report
      try {
        await supabase.rpc('generate_driver_weekly_report', { p_driver_id: driverData?.id || user.id });
      } catch {}

      // Fetch weekly history
      try {
        const { data: historyData } = await supabase.rpc('get_driver_weekly_history', {
          p_driver_id: driverData?.id || user.id,
          p_limit: 12,
        });
        if (historyData) setReports(historyData as WeeklyReport[]);
      } catch {}
    } catch (err) {
      console.error('Error fetching reports:', err);
      toast.error('Error al cargar reportes');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          <p className="text-sm text-gray-400">Cargando reportes semanales...</p>
        </div>
      </div>
    );
  }

  const currentWeek = reports[0];
  const previousWeek = reports[1];

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-xl font-bold text-white">Reportes Semanales</h1>
        <p className="text-sm text-gray-400 mt-0.5">Resumen detallado de tu rendimiento</p>
      </motion.div>

      {/* Current Week Summary Card */}
      {currentWeek && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="glass-strong rounded-2xl p-5 border border-cyan-500/20"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-cyan-400" />
              <span className="text-sm font-semibold text-white">Esta Semana</span>
            </div>
            <span className="text-xs text-gray-500">
              {formatWeekRange(currentWeek.week_start, currentWeek.week_end)}
            </span>
          </div>

          {/* Net earnings highlight */}
          <div className="text-center py-3 mb-4">
            <p className="text-xs text-gray-400 mb-1">Ganancias netas</p>
            <p className="text-3xl font-bold text-white">{formatCurrency(currentWeek.net_earnings)}</p>
            <TrendIndicator current={currentWeek.net_earnings} previous={previousWeek?.net_earnings || 0} />
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="glass rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Car className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-[10px] text-gray-500">Viajes</span>
              </div>
              <p className="text-sm font-bold text-white">{currentWeek.total_rides}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-emerald-400 flex items-center gap-0.5"><CheckCircle2 className="w-2.5 h-2.5" />{currentWeek.completed_rides}</span>
                <span className="text-[10px] text-red-400 flex items-center gap-0.5"><XCircle className="w-2.5 h-2.5" />{currentWeek.cancelled_rides}</span>
              </div>
            </div>
            <div className="glass rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Target className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[10px] text-gray-500">Comision</span>
              </div>
              <p className="text-sm font-bold text-red-400">-{formatCurrency(currentWeek.total_commission)}</p>
              <TrendIndicator current={currentWeek.total_commission} previous={previousWeek?.total_commission || 0} />
            </div>
            <div className="glass rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[10px] text-gray-500">Propinas</span>
              </div>
              <p className="text-sm font-bold text-amber-400">+{formatCurrency(currentWeek.total_tips)}</p>
              <TrendIndicator current={currentWeek.total_tips} previous={previousWeek?.total_tips || 0} />
            </div>
            <div className="glass rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <RouteIcon className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-[10px] text-gray-500">Distancia</span>
              </div>
              <p className="text-sm font-bold text-white">{Math.round(currentWeek.total_distance)} km</p>
            </div>
            <div className="glass rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Star className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[10px] text-gray-500">Calificacion</span>
              </div>
              <p className="text-sm font-bold text-white flex items-center gap-1">
                <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                {(currentWeek.avg_rating || 0).toFixed(2)}
              </p>
              <TrendIndicator current={currentWeek.avg_rating} previous={previousWeek?.avg_rating || 0} />
            </div>
            <div className="glass rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Percent className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-[10px] text-gray-500">Aceptacion</span>
              </div>
              <p className="text-sm font-bold text-white">{currentWeek.acceptance_rate}%</p>
              <TrendIndicator current={currentWeek.acceptance_rate} previous={previousWeek?.acceptance_rate || 0} />
            </div>
          </div>

          {/* Online hours */}
          <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-[10px] text-gray-500">Horas en linea</span>
            </div>
            <span className="text-sm font-bold text-white">{(currentWeek.online_hours || 0).toFixed(1)}h</span>
          </div>
        </motion.div>
      )}

      {/* Earnings Chart */}
      {reports.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-2xl p-4"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-semibold text-white">Ganancias por Semana</span>
            </div>
          </div>
          <div className="flex items-end gap-2 h-32">
            {reports.slice(0, 10).reverse().map((report, i) => {
              const height = Math.max((report.net_earnings / maxEarnings) * 100, 4);
              const isCurrentWeek = i === reports.slice(0, 10).length - 1;
              return (
                <div key={report.week_start} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[8px] text-gray-500">₡{(report.net_earnings / 1000).toFixed(0)}k</span>
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${height}%` }}
                    transition={{ duration: 0.6, delay: i * 0.05 }}
                    className={`w-full rounded-t-md ${
                      isCurrentWeek
                        ? 'bg-gradient-to-t from-cyan-600 to-cyan-400'
                        : 'bg-gradient-to-t from-blue-600/60 to-cyan-500/60'
                    }`}
                    style={isCurrentWeek ? { boxShadow: '0 0 12px rgba(6,182,212,0.3)' } : {}}
                  />
                  <span className="text-[9px] text-gray-500">
                    {new Date(report.week_start).toLocaleDateString('es-CR', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Past Weeks List */}
      {reports.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <h2 className="text-sm font-semibold text-gray-400 flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4" />Historial Semanal
          </h2>
          <div className="space-y-2">
            {reports.slice(1).map((report) => {
              const prevReport = reports[reports.indexOf(report) + 1];
              const isExpanded = expandedWeek === report.week_start;
              return (
                <motion.div
                  key={report.week_start}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass rounded-2xl overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedWeek(isExpanded ? null : report.week_start)}
                    className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-cyan-400" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium text-white">
                          {formatWeekRange(report.week_start, report.week_end)}
                        </p>
                        <p className="text-[10px] text-gray-500">{report.total_rides} viajes &middot; {Math.round(report.total_distance)} km</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="text-sm font-bold text-white">{formatCurrency(report.net_earnings)}</p>
                        <TrendIndicator current={report.net_earnings} previous={prevReport?.net_earnings || 0} />
                      </div>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      className="px-4 pb-4 space-y-2"
                    >
                      <div className="h-px bg-white/5" />
                      <div className="grid grid-cols-3 gap-2 pt-2">
                        <div className="text-center">
                          <p className="text-[10px] text-gray-500">Bruto</p>
                          <p className="text-xs font-bold text-white">{formatCurrency(report.total_earnings)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] text-gray-500">Comision</p>
                          <p className="text-xs font-bold text-red-400">-{formatCurrency(report.total_commission)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] text-gray-500">Propinas</p>
                          <p className="text-xs font-bold text-amber-400">+{formatCurrency(report.total_tips)}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        <div className="text-center glass rounded-lg p-2">
                          <p className="text-[9px] text-gray-500">Completados</p>
                          <p className="text-xs font-bold text-emerald-400">{report.completed_rides}</p>
                        </div>
                        <div className="text-center glass rounded-lg p-2">
                          <p className="text-[9px] text-gray-500">Cancelados</p>
                          <p className="text-xs font-bold text-red-400">{report.cancelled_rides}</p>
                        </div>
                        <div className="text-center glass rounded-lg p-2">
                          <p className="text-[9px] text-gray-500">Calificacion</p>
                          <p className="text-xs font-bold text-white">{(report.avg_rating || 0).toFixed(1)}</p>
                        </div>
                        <div className="text-center glass rounded-lg p-2">
                          <p className="text-[9px] text-gray-500">Aceptacion</p>
                          <p className="text-xs font-bold text-white">{report.acceptance_rate}%</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] text-gray-500 flex items-center gap-1"><Clock className="w-3 h-3" />{(report.online_hours || 0).toFixed(1)}h en linea</span>
                        <span className="text-[10px] text-gray-500">{formatCurrency(report.total_distance > 0 ? report.net_earnings / report.total_distance : 0)}/km</span>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Empty state */}
      {!loading && reports.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-2xl p-8 text-center">
          <BarChart3 className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-500 font-medium">No hay datos de reportes aun</p>
          <p className="text-xs text-gray-600 mt-1">Los reportes se generan automaticamente cada semana</p>
        </motion.div>
      )}
    </div>
  );
}
