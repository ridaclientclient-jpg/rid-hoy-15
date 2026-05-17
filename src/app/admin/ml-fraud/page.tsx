'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, ArrowLeft, ChevronRight, RefreshCw, Search, X,
  CheckCircle2, XCircle, AlertTriangle, Ban, Snowflake,
  Users, Store, Truck, Car, TrendingUp, Clock, Activity,
  ScanSearch, Zap, BarChart3, Eye, Database, Target,
  Sparkles, ArrowUpRight, ArrowDownRight,
  ChevronDown, FileWarning, ShieldAlert, Bot, GitBranch,
  Timer, MapPin, DollarSign, Gauge, LineChart, PieChart
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import type {
  MLAnomalyAlert, MLModelWeight, MLDashboard, MLTopAnomalyUser,
  MLLearningStats, MLAnomalyTimelineItem, MLAnomalyDistributionItem,
  MLUserProfile
} from '@/lib/supabase';

// ── Skeleton ──────────────────────────────────────────────────
function MLLoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glass rounded-2xl p-4">
            <div className="w-10 h-10 rounded-xl bg-white/5 mb-3" />
            <div className="h-3 w-24 bg-white/5 rounded mb-2" />
            <div className="h-6 w-16 bg-white/5 rounded" />
          </div>
        ))}
      </div>
      <div className="glass rounded-2xl p-6">
        <div className="h-5 w-48 bg-white/5 rounded mb-4" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 bg-white/5 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────
const severityColors: Record<string, string> = {
  low: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  medium: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  high: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
  critical: 'bg-red-500/15 text-red-400 border-red-500/20',
};

const severityLabels: Record<string, string> = {
  low: 'Bajo',
  medium: 'Medio',
  high: 'Alto',
  critical: 'Critico',
};

const statusColorsML: Record<string, string> = {
  active: 'bg-red-500/15 text-red-400',
  under_review: 'bg-amber-500/15 text-amber-400',
  confirmed_fraud: 'bg-red-500/25 text-red-300',
  false_positive: 'bg-emerald-500/15 text-emerald-400',
  escalated: 'bg-purple-500/15 text-purple-400',
};

const statusLabelsML: Record<string, string> = {
  active: 'Activa',
  under_review: 'Revision',
  confirmed_fraud: 'Fraude Confirmado',
  false_positive: 'Falso Positivo',
  escalated: 'Escalado',
};

const userTypeColors: Record<string, string> = {
  client: 'bg-cyan-500/15 text-cyan-400',
  vendor: 'bg-orange-500/15 text-orange-400',
  courier: 'bg-purple-500/15 text-purple-400',
  driver: 'bg-blue-500/15 text-blue-400',
};

const userTypeLabels: Record<string, string> = {
  client: 'Cliente',
  vendor: 'Negocio',
  courier: 'Rider',
  driver: 'Conductor',
};

const userTypeIcons: Record<string, typeof Users> = {
  client: Users,
  vendor: Store,
  courier: Truck,
  driver: Car,
};

const anomalyTypeLabels: Record<string, string> = {
  frequency_spike: 'Pico de Frecuencia',
  amount_anomaly: 'Monto Anomaloo',
  unusual_location: 'Ubicacion Inusual',
  unusual_time: 'Horario Inusual',
  route_deviation: 'Desviacion de Ruta',
  velocity_anomaly: 'Velocidad Anomala',
  withdrawal_anomaly: 'Retiro Anomalo',
  behavioral_shift: 'Cambio Comportamiento',
  composite_anomaly: 'Anomalia Compuesta',
};

const anomalyTypeIcons: Record<string, typeof Zap> = {
  frequency_spike: Activity,
  amount_anomaly: DollarSign,
  unusual_location: MapPin,
  unusual_time: Timer,
  route_deviation: MapPin,
  velocity_anomaly: Gauge,
  withdrawal_anomaly: DollarSign,
  behavioral_shift: GitBranch,
  composite_anomaly: AlertTriangle,
};

const patternTypeLabels: Record<string, string> = {
  order_frequency: 'Frecuencia de Pedidos',
  order_amount: 'Monto de Pedidos',
  order_location: 'Ubicacion de Pedidos',
  order_time: 'Horario de Pedidos',
  ride_route: 'Rutas de Viajes',
  withdrawal_pattern: 'Patron de Retiros',
  payment_pattern: 'Patron de Pagos',
  new_account_velocity: 'Velocidad Cuenta Nueva',
  carrier_route: 'Rutas Carrier',
};

type TabType = 'alerts' | 'profiles' | 'model' | 'timeline';

// ── Simple Bar Chart Component (no external deps) ─────────────
function MiniBarChart({ data, maxVal }: { data: number[]; maxVal: number }) {
  return (
    <div className="flex items-end gap-1 h-12">
      {data.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-sm transition-all duration-300"
          style={{
            height: maxVal > 0 ? `${(v / maxVal) * 100}%` : '0%',
            backgroundColor: v > 0
              ? v > (maxVal * 0.7) ? 'rgb(239 68 68 / 0.6)'
                : v > (maxVal * 0.4) ? 'rgb(249 115 22 / 0.6)'
                : 'rgb(34 197 94 / 0.6)'
              : 'rgb(255 255 255 / 0.05)',
          }}
        />
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────
export default function MLAntiFraudPage() {
  const [dashboard, setDashboard] = useState<MLDashboard | null>(null);
  const [alerts, setAlerts] = useState<MLAnomalyAlert[]>([]);
  const [weights, setWeights] = useState<MLModelWeight[]>([]);
  const [topUsers, setTopUsers] = useState<MLTopAnomalyUser[]>([]);
  const [learningStats, setLearningStats] = useState<MLLearningStats | null>(null);
  const [timeline, setTimeline] = useState<MLAnomalyTimelineItem[]>([]);
  const [distribution, setDistribution] = useState<MLAnomalyDistributionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  // Tabs
  const [activeTab, setActiveTab] = useState<TabType>('alerts');

  // Filters
  const [filterType, setFilterType] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('active');
  const [search, setSearch] = useState('');

  // Detail
  const [selectedAlert, setSelectedAlert] = useState<MLAnomalyAlert | null>(null);
  const [selectedUser, setSelectedUser] = useState<MLTopAnomalyUser | null>(null);
  const [userProfile, setUserProfile] = useState<MLUserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [feedbackNotes, setFeedbackNotes] = useState('');

  // ── Load Data ──────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [dashRes, alertRes, weightRes, topRes, learnRes, tlRes, distRes] = await Promise.all([
        supabase.rpc('ml_get_dashboard'),
        supabase.rpc('ml_get_anomaly_alerts', {
          p_user_type: filterType === 'all' ? null : filterType,
          p_severity: filterSeverity === 'all' ? null : filterSeverity,
          p_status: filterStatus === 'all' ? null : filterStatus,
          p_limit: 100,
        }),
        supabase.rpc('ml_get_model_weights'),
        supabase.rpc('ml_get_top_anomaly_users', { p_limit: 20 }),
        supabase.rpc('ml_get_learning_stats'),
        supabase.rpc('ml_anomaly_timeline_chart', { p_days: 14 }),
        supabase.rpc('ml_get_anomaly_distribution'),
      ]);

      if (dashRes.data) setDashboard(dashRes.data as MLDashboard);
      if (alertRes.data) setAlerts(alertRes.data as MLAnomalyAlert[]);
      if (weightRes.data) setWeights(weightRes.data as MLModelWeight[]);
      if (topRes.data) setTopUsers(topRes.data as MLTopAnomalyUser[]);
      if (learnRes.data) setLearningStats(learnRes.data as MLLearningStats);
      if (tlRes.data) setTimeline((tlRes.data as unknown as { timeline: MLAnomalyTimelineItem[] })?.timeline || []);
      if (distRes.data) setDistribution(distRes.data as MLAnomalyDistributionItem[]);
    } catch (err) {
      console.error('Error loading ML data:', err);
    }
    setIsLoading(false);
  }, [filterType, filterSeverity, filterStatus]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Load user profile ──────────────────────────────────────
  const loadUserProfile = async (userId: string, userType: string) => {
    setLoadingProfile(true);
    const { data, error } = await supabase.rpc('ml_get_user_profile', {
      p_user_id: userId,
      p_user_type: userType,
    });
    if (!error && data) setUserProfile(data as MLUserProfile);
    setLoadingProfile(false);
  };

  // ── Handle feedback ────────────────────────────────────────
  const handleFeedback = async (alertId: string, action: string, notes: string) => {
    const { data, error } = await supabase.rpc('ml_feedback', {
      p_alert_id: alertId,
      p_action: action,
      p_notes: notes,
    });
    if (error) {
      toast.error('Error: ' + error.message);
      return;
    }
    const result = data as any;
    if (action === 'confirmed_fraud') {
      toast.success('Fraude confirmado — modelo ajustado');
    } else {
      toast.success('Falso positivo descartado — modelo ajustado');
    }
    setSelectedAlert(null);
    setFeedbackNotes('');
    loadAll();
  };

  // ── Scan ───────────────────────────────────────────────────
  const handleScan = async () => {
    setScanning(true);
    const { data, error } = await supabase.rpc('ml_scan_all_recent');
    setScanning(false);
    if (error) {
      toast.error('Error en escaneo ML: ' + error.message);
      return;
    }
    const result = data as any;
    toast.success(`Escaneo ML: ${result.users_scanned} perfiles actualizados, ${result.new_anomalies} anomalias nuevas`);
    loadAll();
  };

  // ── Filtered alerts ────────────────────────────────────────
  const filteredAlerts = alerts.filter((a) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      a.user_name?.toLowerCase().includes(q) ||
      a.user_email?.toLowerCase().includes(q) ||
      a.anomaly_type?.toLowerCase().includes(q) ||
      a.description?.toLowerCase().includes(q)
    );
  });

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Brain className="w-8 h-8 text-purple-400" />
            ML Anti-Fraude
          </h1>
          <p className="text-gray-400 mt-1">Sistema de aprendizaje automatico para deteccion de fraude</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleScan} disabled={scanning}
            className="px-4 py-2.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 text-sm font-medium hover:bg-purple-500/25 transition-colors disabled:opacity-50 flex items-center gap-2">
            {scanning ? <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" /> : <ScanSearch className="w-4 h-4" />}
            {scanning ? 'Analizando...' : 'Escanear ML'}
          </button>
          <button onClick={loadAll}
            className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-sm font-medium hover:text-white hover:bg-white/10 transition-colors flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Actualizar
          </button>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/admin" className="hover:text-white transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Panel
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-white font-medium">ML Anti-Fraude</span>
      </div>

      {isLoading ? <MLLoadingSkeleton /> : dashboard && (
        <>
          {/* ═══ STATS CARDS ═══ */}
          <motion.div className="grid grid-cols-2 sm:grid-cols-4 gap-4"
            initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
            <div className="glass rounded-2xl p-4 border border-purple-500/20">
              <div className="w-10 h-10 rounded-xl bg-purple-500/15 flex items-center justify-center mb-3">
                <Database className="w-5 h-5 text-purple-400" />
              </div>
              <p className="text-[11px] text-gray-500 uppercase tracking-wider">Eventos Rastreados</p>
              <p className="text-2xl font-bold text-purple-400">{dashboard.total_events_tracked.toLocaleString()}</p>
            </div>
            <div className="glass rounded-2xl p-4 border border-red-500/20">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center mb-3">
                <FileWarning className="w-5 h-5 text-red-400" />
              </div>
              <p className="text-[11px] text-gray-500 uppercase tracking-wider">Alertas ML Activas</p>
              <p className="text-2xl font-bold text-red-400">{dashboard.active_ml_alerts}</p>
            </div>
            <div className="glass rounded-2xl p-4 border border-cyan-500/20">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/15 flex items-center justify-center mb-3">
                <Target className="w-5 h-5 text-cyan-400" />
              </div>
              <p className="text-[11px] text-gray-500 uppercase tracking-wider">Confianza del Modelo</p>
              <p className="text-2xl font-bold text-cyan-400">{(dashboard.avg_model_confidence * 100).toFixed(0)}%</p>
            </div>
            <div className="glass rounded-2xl p-4 border border-amber-500/20">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center mb-3">
                <Sparkles className="w-5 h-5 text-amber-400" />
              </div>
              <p className="text-[11px] text-gray-500 uppercase tracking-wider">Ajustes de Aprendizaje</p>
              <p className="text-2xl font-bold text-amber-400">{dashboard.total_learning_adjustments}</p>
            </div>
          </motion.div>

          {/* ═══ SECONDARY STATS ═══ */}
          <motion.div className="grid grid-cols-2 sm:grid-cols-4 gap-3"
            initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            {[
              { label: 'Anomalias Hoy', val: dashboard.anomalies_today, icon: Activity, iconClass: 'text-red-400', numClass: 'text-red-400' },
              { label: 'Tasa Anomalia Global', val: dashboard.global_anomaly_rate + '%', icon: Gauge, iconClass: 'text-orange-400', numClass: 'text-orange-400' },
              { label: 'Usuarios Perfilados', val: dashboard.users_with_sufficient_data, icon: Users, iconClass: 'text-cyan-400', numClass: 'text-cyan-400' },
              { label: 'Fraudes Confirmados', val: dashboard.confirmed_fraud, icon: ShieldAlert, iconClass: 'text-red-400', numClass: 'text-red-400' },
            ].map((s) => (
              <div key={s.label} className="glass rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <s.icon className={`w-4 h-4 ${s.iconClass}`} />
                  <span className="text-[11px] text-gray-500">{s.label}</span>
                </div>
                <p className={`text-lg font-bold ${s.numClass}`}>{s.val}</p>
              </div>
            ))}
          </motion.div>

          {/* ═══ TABS ═══ */}
          <motion.div className="glass rounded-2xl p-1.5 flex gap-1 relative z-50"
            initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            {([
              { id: 'alerts' as TabType, label: 'Alertas ML', icon: FileWarning, count: dashboard.active_ml_alerts },
              { id: 'profiles' as TabType, label: 'Perfiles', icon: Users, count: topUsers.length },
              { id: 'model' as TabType, label: 'Modelo IA', icon: Brain, count: weights.length },
              { id: 'timeline' as TabType, label: 'Timeline', icon: LineChart, count: timeline.length },
            ]).map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}>
                <tab.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded-md ${
                  activeTab === tab.id ? 'bg-purple-500/20 text-purple-300' : 'bg-white/5 text-gray-500'
                }`}>{tab.count}</span>
              </button>
            ))}
          </motion.div>

          {/* ═══ TAB: ALERTAS ML ═══ */}
          {activeTab === 'alerts' && (
            <motion.div className="space-y-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {/* Filters */}
              <div className="glass rounded-2xl p-4 relative z-50">
                <div className="flex flex-wrap gap-3">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input type="text" placeholder="Buscar por nombre, email, tipo..."
                      value={search} onChange={(e) => setSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-purple-500/50" />
                  </div>
                  <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500/50">
                    <option value="all">Todos los tipos</option>
                    <option value="client">Clientes</option>
                    <option value="vendor">Negocios</option>
                    <option value="courier">Riders</option>
                    <option value="driver">Conductores</option>
                  </select>
                  <select value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500/50">
                    <option value="all">Todas las severidades</option>
                    <option value="critical">Critico</option>
                    <option value="high">Alto</option>
                    <option value="medium">Medio</option>
                    <option value="low">Bajo</option>
                  </select>
                  <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500/50">
                    <option value="all">Todos los estados</option>
                    <option value="active">Activas</option>
                    <option value="under_review">En Revision</option>
                    <option value="confirmed_fraud">Confirmados</option>
                    <option value="false_positive">Falsos Positivos</option>
                  </select>
                </div>
              </div>

              {/* Alerts list */}
              <div className="glass rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-white/5">
                  <h3 className="text-base font-semibold text-white flex items-center gap-2">
                    <Bot className="w-4 h-4 text-purple-400" />
                    Alertas de Anomalia ({filteredAlerts.length})
                  </h3>
                </div>

                {filteredAlerts.length === 0 ? (
                  <div className="text-center py-16">
                    <Brain className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">No hay alertas ML con los filtros actuales</p>
                    <p className="text-xs text-gray-600 mt-1">El modelo aprende con cada evento registrado</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {filteredAlerts.map((alert) => {
                      const Icon = anomalyTypeIcons[alert.anomaly_type] || AlertTriangle;
                      const UserTypeIcon = userTypeIcons[alert.user_type] || Users;
                      return (
                        <motion.div key={alert.id}
                          className="p-4 hover:bg-white/[0.03] transition-colors cursor-pointer"
                          onClick={() => setSelectedAlert(alert)}
                          whileHover={{ backgroundColor: 'rgba(255,255,255,0.03)' }}>
                          <div className="flex items-center gap-4">
                            {/* Anomaly type icon */}
                            <div className={`w-10 h-10 rounded-xl ${severityColors[alert.severity]} flex items-center justify-center flex-shrink-0`}>
                              <Icon className="w-5 h-5" />
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-medium text-white truncate">{alert.user_name || 'N/A'}</p>
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium border ${severityColors[alert.severity]}`}>
                                  {severityLabels[alert.severity]}
                                </span>
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-purple-500/15 text-purple-400">
                                  {anomalyTypeLabels[alert.anomaly_type] || alert.anomaly_type}
                                </span>
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${userTypeColors[alert.user_type]}`}>
                                  {userTypeLabels[alert.user_type]}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 truncate mt-0.5">{alert.description}</p>
                              <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-600">
                                {alert.z_score != null && (
                                  <span className="flex items-center gap-1">
                                    <Gauge className="w-3 h-3" />
                                    Z-Score: {Number(alert.z_score).toFixed(2)}
                                  </span>
                                )}
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {new Date(alert.created_at).toLocaleDateString('es-CR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            </div>

                            {/* Status */}
                            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-medium ${statusColorsML[alert.status]}`}>
                                {statusLabelsML[alert.status]}
                              </span>
                              {alert.expected_value != null && alert.actual_value != null && (
                                <div className="text-[9px] text-gray-600">
                                  Esperado: ₡{Math.round(Number(alert.expected_value)).toLocaleString()}
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ═══ TAB: PERFILES DE COMPORTAMIENTO ═══ */}
          {activeTab === 'profiles' && (
            <motion.div className="space-y-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="glass rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-white/5">
                  <h3 className="text-base font-semibold text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-purple-400" />
                    Top Usuarios con Anomalias ({topUsers.length})
                  </h3>
                </div>

                {topUsers.length === 0 ? (
                  <div className="text-center py-16">
                    <Users className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">No hay datos suficientes aun</p>
                    <p className="text-xs text-gray-600 mt-1">El sistema necesita mas eventos para generar perfiles</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {topUsers.map((user) => {
                      const UserTypeIcon = userTypeIcons[user.user_type] || Users;
                      return (
                        <div key={user.user_id + user.user_type}
                          className="p-4 hover:bg-white/[0.03] transition-colors cursor-pointer"
                          onClick={() => {
                            setSelectedUser(user);
                            loadUserProfile(user.user_id, user.user_type);
                          }}>
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-xl ${userTypeColors[user.user_type]} flex items-center justify-center flex-shrink-0`}>
                              <UserTypeIcon className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-white truncate">{user.user_name || 'N/A'}</p>
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${userTypeColors[user.user_type]}`}>
                                  {userTypeLabels[user.user_type]}
                                </span>
                              </div>
                              <div className="grid grid-cols-3 gap-3 mt-1 text-[10px]">
                                <div>
                                  <span className="text-gray-500">Eventos: </span>
                                  <span className="text-gray-300">{user.total_events}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Anomalias: </span>
                                  <span className="text-red-400">{user.anomaly_count}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Confianza: </span>
                                  <span className="text-cyan-400">{(user.model_confidence * 100).toFixed(0)}%</span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-2 rounded-full bg-white/10 overflow-hidden">
                                  <div className={`h-full rounded-full ${
                                    user.anomaly_rate > 50 ? 'bg-red-500' :
                                    user.anomaly_rate > 20 ? 'bg-amber-500' : 'bg-emerald-500'
                                  }`} style={{ width: `${Math.min(100, user.anomaly_rate)}%` }} />
                                </div>
                                <span className="text-xs font-bold text-amber-400">{user.anomaly_rate}%</span>
                              </div>
                              <span className="text-[9px] text-gray-500">tasa anomalia</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ═══ TAB: MODELO IA ═══ */}
          {activeTab === 'model' && (
            <motion.div className="space-y-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {/* Weights */}
              <div className="glass rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-white/5">
                  <h3 className="text-base font-semibold text-white flex items-center gap-2">
                    <Brain className="w-4 h-4 text-purple-400" />
                    Pesos del Modelo y Precisión
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">Cada patron tiene un peso que se ajusta automaticamente con feedback del admin</p>
                </div>
                <div className="divide-y divide-white/5">
                  {weights.map((w) => (
                    <div key={w.id} className="p-4 hover:bg-white/[0.03] transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            w.precision_rate > 0.7 ? 'bg-emerald-500/15 text-emerald-400' :
                            w.precision_rate > 0.3 ? 'bg-amber-500/15 text-amber-400' :
                            'bg-gray-500/15 text-gray-400'
                          }`}>
                            {w.is_active ? <Zap className="w-4 h-4" /> : <X className="w-4 h-4" />}
                          </div>
                          <div>
                            <p className="text-sm text-white font-medium">{patternTypeLabels[w.pattern_type] || w.pattern_type}</p>
                            <p className="text-[10px] text-gray-500">
                              Threshold: {w.effective_threshold.toFixed(2)} (base: {w.base_threshold.toFixed(2)} x peso: {w.weight.toFixed(3)})
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-bold ${
                            w.precision_rate > 0.7 ? 'text-emerald-400' :
                            w.precision_rate > 0.3 ? 'text-amber-400' : 'text-gray-400'
                          }`}>
                            {w.total_detections > 0 ? (w.precision_rate * 100).toFixed(0) : 'N/A'}%
                          </p>
                          <p className="text-[9px] text-gray-500">precision</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-[10px]">
                        <div className="bg-white/[0.03] rounded-lg px-2 py-1.5">
                          <span className="text-gray-500">Detecciones</span>
                          <p className="text-white font-medium">{w.total_detections}</p>
                        </div>
                        <div className="bg-white/[0.03] rounded-lg px-2 py-1.5">
                          <span className="text-gray-500">Confirmados</span>
                          <p className="text-red-400 font-medium">{w.confirmed_fraud}</p>
                        </div>
                        <div className="bg-white/[0.03] rounded-lg px-2 py-1.5">
                          <span className="text-gray-500">Falsos +</span>
                          <p className="text-emerald-400 font-medium">{w.confirmed_false_positive}</p>
                        </div>
                        <div className="bg-white/[0.03] rounded-lg px-2 py-1.5">
                          <span className="text-gray-500">Ajustes</span>
                          <p className="text-cyan-400 font-medium">{w.adjustment_count}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Learning Log */}
              {learningStats && learningStats.recent_adjustments.length > 0 && (
                <div className="glass rounded-2xl overflow-hidden">
                  <div className="p-4 border-b border-white/5">
                    <h3 className="text-base font-semibold text-white flex items-center gap-2">
                      <GitBranch className="w-4 h-4 text-amber-400" />
                      Historial de Aprendizaje
                    </h3>
                  </div>
                  <div className="divide-y divide-white/5 max-h-[400px] overflow-y-auto">
                    {learningStats.recent_adjustments.map((log) => (
                      <div key={log.id} className="p-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                            log.feedback_action === 'confirmed_fraud' ? 'bg-red-500/15 text-red-400' : 'bg-emerald-500/15 text-emerald-400'
                          }`}>
                            {log.feedback_action === 'confirmed_fraud'
                              ? <ArrowUpRight className="w-3.5 h-3.5" />
                              : <ArrowDownRight className="w-3.5 h-3.5" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-xs text-white font-medium">{patternTypeLabels[log.pattern_type] || log.pattern_type}</p>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                                log.feedback_action === 'confirmed_fraud'
                                  ? 'bg-red-500/15 text-red-400'
                                  : 'bg-emerald-500/15 text-emerald-400'
                              }`}>
                                {log.feedback_action === 'confirmed_fraud' ? 'Fraude' : 'Falso +'}
                              </span>
                            </div>
                            <p className="text-[10px] text-gray-500">
                              Peso: {log.old_weight.toFixed(3)} → {log.new_weight.toFixed(3)}
                              {log.new_weight > log.old_weight ? ' (+mas sensible)' : ' (-menos sensible)'}
                            </p>
                          </div>
                          <span className="text-[9px] text-gray-600">
                            {new Date(log.created_at).toLocaleDateString('es-CR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ═══ TAB: TIMELINE ═══ */}
          {activeTab === 'timeline' && (
            <motion.div className="space-y-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {/* Chart */}
              <div className="glass rounded-2xl p-5">
                <h3 className="text-base font-semibold text-white flex items-center gap-2 mb-4">
                  <LineChart className="w-4 h-4 text-purple-400" />
                  Timeline de Anomalias (14 dias)
                </h3>
                {timeline.length > 0 ? (
                  <div className="space-y-1">
                    {timeline.map((day, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-[10px] text-gray-500 w-16 flex-shrink-0 text-right">
                          {new Date(day.date + 'T12:00:00').toLocaleDateString('es-CR', { day: '2-digit', month: 'short' })}
                        </span>
                        <div className="flex-1 h-6 flex gap-0.5 items-end">
                          {day.anomalies > 0 ? (
                            <>
                              {day.critical > 0 && (
                                <div className="h-full bg-red-500/70 rounded-sm flex items-center justify-center px-1"
                                  style={{ width: `${Math.max(4, (day.critical / Math.max(1, day.anomalies)) * 100)}%` }}>
                                  <span className="text-[8px] text-white font-bold">{day.critical}</span>
                                </div>
                              )}
                              {day.high > 0 && (
                                <div className="h-full bg-orange-500/70 rounded-sm flex items-center justify-center px-1"
                                  style={{ width: `${Math.max(4, (day.high / Math.max(1, day.anomalies)) * 100)}%` }}>
                                  <span className="text-[8px] text-white font-bold">{day.high}</span>
                                </div>
                              )}
                              {day.medium > 0 && (
                                <div className="h-full bg-amber-500/50 rounded-sm flex items-center justify-center px-1"
                                  style={{ width: `${Math.max(4, (day.medium / Math.max(1, day.anomalies)) * 100)}%` }}>
                                  <span className="text-[8px] text-white font-bold">{day.medium}</span>
                                </div>
                              )}
                              {day.low > 0 && (
                                <div className="h-full bg-emerald-500/50 rounded-sm flex items-center justify-center px-1"
                                  style={{ width: `${Math.max(4, (day.low / Math.max(1, day.anomalies)) * 100)}%` }}>
                                  <span className="text-[8px] text-white font-bold">{day.low}</span>
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="h-full bg-white/5 rounded-sm w-full" />
                          )}
                        </div>
                        <span className="text-[10px] text-gray-400 w-6 flex-shrink-0">{day.anomalies}</span>
                      </div>
                    ))}
                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/5">
                      <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-red-500/70" /><span className="text-[9px] text-gray-500">Critico</span></div>
                      <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-orange-500/70" /><span className="text-[9px] text-gray-500">Alto</span></div>
                      <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-amber-500/50" /><span className="text-[9px] text-gray-500">Medio</span></div>
                      <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-emerald-500/50" /><span className="text-[9px] text-gray-500">Bajo</span></div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-8">No hay datos de timeline</p>
                )}
              </div>

              {/* Distribution */}
              {distribution.length > 0 && (
                <div className="glass rounded-2xl p-5">
                  <h3 className="text-base font-semibold text-white flex items-center gap-2 mb-4">
                    <PieChart className="w-4 h-4 text-purple-400" />
                    Distribucion por Tipo de Anomalia
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {distribution.map((d) => (
                      <div key={d.type} className="bg-white/[0.03] rounded-xl p-3 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-purple-500/15 flex items-center justify-center flex-shrink-0">
                          {(anomalyTypeIcons[d.type] || AlertTriangle)({ className: 'w-5 h-5 text-purple-400' })}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white font-medium">{d.label}</p>
                          <div className="w-full h-1.5 rounded-full bg-white/10 mt-1 overflow-hidden">
                            <div className="h-full rounded-full bg-purple-500/70 transition-all"
                              style={{ width: `${Math.max(2, (d.count / Math.max(1, distribution[0]?.count || 1)) * 100)}%` }} />
                          </div>
                        </div>
                        <span className="text-sm font-bold text-purple-400">{d.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </>
      )}

      {/* ═══ ALERT DETAIL MODAL ═══ */}
      <AnimatePresence>
        {selectedAlert && (
          <motion.div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => { setSelectedAlert(null); setFeedbackNotes(''); }}>
            <motion.div className="glass-strong rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}>

              <div className="flex items-center justify-between p-5 border-b border-white/10">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Bot className="w-5 h-5 text-purple-400" />
                  Detalle de Anomalia ML
                </h3>
                <button onClick={() => { setSelectedAlert(null); setFeedbackNotes(''); }}
                  className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-5">
                {/* User info */}
                <div className="bg-white/[0.03] rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-12 h-12 rounded-xl ${userTypeColors[selectedAlert.user_type]} flex items-center justify-center`}>
                      {(userTypeIcons[selectedAlert.user_type] || Users)({ className: 'w-6 h-6' })}
                    </div>
                    <div>
                      <p className="text-base font-semibold text-white">{selectedAlert.user_name || 'N/A'}</p>
                      <p className="text-xs text-gray-500">{selectedAlert.user_email || ''}</p>
                    </div>
                    <div className="ml-auto">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${userTypeColors[selectedAlert.user_type]}`}>
                        {userTypeLabels[selectedAlert.user_type]}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Anomaly details */}
                <div className="space-y-3">
                  <div className="bg-white/[0.03] rounded-xl p-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] text-gray-500 mb-1">Tipo de Anomalia</p>
                        <div className="flex items-center gap-2">
                          {(anomalyTypeIcons[selectedAlert.anomaly_type] || AlertTriangle)({ className: 'w-4 h-4 text-purple-400' })}
                          <span className="text-sm text-white">{anomalyTypeLabels[selectedAlert.anomaly_type]}</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 mb-1">Severidad</p>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium border ${severityColors[selectedAlert.severity]}`}>
                          {severityLabels[selectedAlert.severity]}
                        </span>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 mb-1">Z-Score</p>
                        <p className="text-sm font-bold text-purple-400">
                          {selectedAlert.z_score != null ? Number(selectedAlert.z_score).toFixed(2) : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 mb-1">Estado</p>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColorsML[selectedAlert.status]}`}>
                          {statusLabelsML[selectedAlert.status]}
                        </span>
                      </div>
                    </div>
                  </div>

                  {selectedAlert.expected_value != null && selectedAlert.actual_value != null && (
                    <div className="bg-white/[0.03] rounded-xl p-4">
                      <p className="text-[10px] text-gray-500 mb-2">Comparacion de Valores</p>
                      <div className="flex items-center justify-between">
                        <div className="text-center">
                          <p className="text-[9px] text-gray-500">Esperado</p>
                          <p className="text-sm font-bold text-emerald-400">₡{Math.round(Number(selectedAlert.expected_value)).toLocaleString()}</p>
                        </div>
                        <ArrowUpRight className="w-5 h-5 text-red-400" />
                        <div className="text-center">
                          <p className="text-[9px] text-gray-500">Actual</p>
                          <p className="text-sm font-bold text-red-400">₡{Math.round(Number(selectedAlert.actual_value)).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedAlert.description && (
                    <div className="bg-white/[0.03] rounded-xl p-4">
                      <p className="text-[10px] text-gray-500 mb-1">Descripcion del ML</p>
                      <p className="text-sm text-gray-300">{selectedAlert.description}</p>
                    </div>
                  )}

                  <div className="bg-white/[0.03] rounded-xl p-4">
                    <p className="text-[10px] text-gray-500 mb-1">Detectado</p>
                    <p className="text-sm text-gray-300">
                      {new Date(selectedAlert.created_at).toLocaleString('es-CR')}
                    </p>
                  </div>
                </div>

                {/* Feedback actions */}
                {selectedAlert.status === 'active' || selectedAlert.status === 'under_review' ? (
                  <div className="space-y-3">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Aprendizaje — Tu feedback ajusta el modelo automaticamente</p>

                    <textarea
                      value={feedbackNotes}
                      onChange={(e) => setFeedbackNotes(e.target.value)}
                      placeholder="Notas opcionales sobre esta alerta..."
                      className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-purple-500/50 resize-none"
                      rows={2}
                    />

                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => handleFeedback(selectedAlert.id, 'confirmed_fraud', feedbackNotes)}
                        className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/25 transition-colors">
                        <CheckCircle2 className="w-4 h-4" /> Confirmar Fraude
                      </button>
                      <button onClick={() => handleFeedback(selectedAlert.id, 'false_positive', feedbackNotes)}
                        className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-sm font-medium hover:bg-emerald-500/25 transition-colors">
                        <XCircle className="w-4 h-4" /> Falso Positivo
                      </button>
                    </div>

                    <p className="text-[9px] text-gray-600 text-center">
                      Confirmar = modelo se hace mas sensible | Descartar = modelo se hace menos sensible
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-3">
                    <p className="text-xs text-gray-500">
                      Alerta {statusLabelsML[selectedAlert.status]?.toLowerCase()} el {selectedAlert.resolved_at ? new Date(selectedAlert.resolved_at).toLocaleDateString('es-CR') : 'N/A'}
                    </p>
                    {selectedAlert.admin_feedback && (
                      <p className="text-[10px] text-gray-600 mt-1">
                        Feedback: {selectedAlert.admin_feedback}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ USER PROFILE MODAL ═══ */}
      <AnimatePresence>
        {selectedUser && (
          <motion.div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => { setSelectedUser(null); setUserProfile(null); }}>
            <motion.div className="glass-strong rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}>

              <div className="flex items-center justify-between p-5 border-b border-white/10">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  {(userTypeIcons[selectedUser.user_type] || Users)({ className: 'w-5 h-5 text-purple-400' })}
                  Perfil de Comportamiento
                </h3>
                <button onClick={() => { setSelectedUser(null); setUserProfile(null); }}
                  className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {/* User header */}
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl ${userTypeColors[selectedUser.user_type]} flex items-center justify-center`}>
                    {(userTypeIcons[selectedUser.user_type] || Users)({ className: 'w-6 h-6' })}
                  </div>
                  <div>
                    <p className="text-base font-semibold text-white">{selectedUser.user_name || 'N/A'}</p>
                    <p className="text-xs text-gray-500">{selectedUser.user_email || ''}</p>
                  </div>
                </div>

                {loadingProfile ? (
                  <div className="animate-pulse space-y-3">
                    <div className="h-20 bg-white/5 rounded-xl" />
                    <div className="h-40 bg-white/5 rounded-xl" />
                  </div>
                ) : userProfile?.profile ? (
                  <>
                    {/* Profile stats */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-white/[0.03] rounded-xl p-3 text-center">
                        <p className="text-[9px] text-gray-500">Frecuencia/Dia</p>
                        <p className="text-sm font-bold text-cyan-400">{userProfile.profile.avg_orders_per_day.toFixed(1)}</p>
                        <p className="text-[9px] text-gray-600">σ {userProfile.profile.std_dev_orders.toFixed(1)}</p>
                      </div>
                      <div className="bg-white/[0.03] rounded-xl p-3 text-center">
                        <p className="text-[9px] text-gray-500">Monto Promedio</p>
                        <p className="text-sm font-bold text-emerald-400">₡{Math.round(userProfile.profile.avg_order_amount).toLocaleString()}</p>
                        <p className="text-[9px] text-gray-600">σ ₡{Math.round(userProfile.profile.std_dev_amount).toLocaleString()}</p>
                      </div>
                      <div className="bg-white/[0.03] rounded-xl p-3 text-center">
                        <p className="text-[9px] text-gray-500">Confianza</p>
                        <p className="text-sm font-bold text-purple-400">{(userProfile.profile.model_confidence * 100).toFixed(0)}%</p>
                        <p className="text-[9px] text-gray-600">v{userProfile.profile.profile_version}</p>
                      </div>
                    </div>

                    {/* Hourly distribution */}
                    {Object.keys(userProfile.profile.hourly_distribution).length > 0 && (
                      <div className="bg-white/[0.03] rounded-xl p-4">
                        <p className="text-[10px] text-gray-500 mb-2">Distribucion Horaria (actividad por hora)</p>
                        <MiniBarChart
                          data={Array.from({ length: 24 }, (_, i) =>
                            Number(userProfile.profile.hourly_distribution[i?.toString()] || 0)
                          )}
                          maxVal={Math.max(...Object.values(userProfile.profile.hourly_distribution).map(Number), 1)}
                        />
                        <div className="flex justify-between mt-1">
                          <span className="text-[8px] text-gray-600">0:00</span>
                          <span className="text-[8px] text-gray-600">12:00</span>
                          <span className="text-[8px] text-gray-600">23:00</span>
                        </div>
                      </div>
                    )}

                    {/* Top locations */}
                    {userProfile.profile.top_locations.length > 0 && (
                      <div className="bg-white/[0.03] rounded-xl p-4">
                        <p className="text-[10px] text-gray-500 mb-2">Ubicaciones Frecuentes</p>
                        <div className="space-y-1.5">
                          {userProfile.profile.top_locations.slice(0, 5).map((loc, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <MapPin className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                              <span className="text-xs text-gray-300 flex-1 truncate">{loc.zone}</span>
                              <span className="text-[9px] text-gray-500">{loc.pct}%</span>
                              <div className="w-12 h-1.5 rounded-full bg-white/10 overflow-hidden">
                                <div className="h-full rounded-full bg-cyan-500/70" style={{ width: `${loc.pct}%` }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Anomaly stats */}
                    <div className="bg-white/[0.03] rounded-xl p-4">
                      <p className="text-[10px] text-gray-500 mb-2">Estadisticas de Anomalia</p>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="text-lg font-bold text-white">{userProfile.anomaly_stats.total_events}</p>
                          <p className="text-[9px] text-gray-500">Total Eventos</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold text-red-400">{userProfile.anomaly_stats.anomalies_detected}</p>
                          <p className="text-[9px] text-gray-500">Anomalias</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold text-amber-400">{userProfile.anomaly_stats.anomaly_rate}%</p>
                          <p className="text-[9px] text-gray-500">Tasa</p>
                        </div>
                      </div>
                    </div>

                    {/* Recent events with anomalies */}
                    {userProfile.recent_events.length > 0 && (
                      <div className="bg-white/[0.03] rounded-xl p-4">
                        <p className="text-[10px] text-gray-500 mb-2">Eventos Recientes (con anomalias marcadas)</p>
                        <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                          {userProfile.recent_events.slice(0, 15).map((evt) => (
                            <div key={evt.id} className={`flex items-center gap-2 p-1.5 rounded-lg ${
                              evt.is_anomaly ? 'bg-red-500/10 border border-red-500/20' : 'bg-white/[0.02]'
                            }`}>
                              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                evt.is_anomaly
                                  ? evt.anomaly_severity === 'critical' ? 'bg-red-500' :
                                    evt.anomaly_severity === 'high' ? 'bg-orange-500' :
                                    evt.anomaly_severity === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'
                                  : 'bg-gray-600'
                              }`} />
                              <span className="text-[10px] text-gray-400 flex-1 truncate">
                                {evt.event_type}
                                {evt.amount ? ` ₡${Math.round(evt.amount).toLocaleString()}` : ''}
                                {evt.location_zone ? ` — ${evt.location_zone}` : ''}
                              </span>
                              {evt.is_anomaly && (
                                <span className={`text-[8px] px-1 py-0.5 rounded ${
                                  severityColors[evt.anomaly_severity || 'medium']
                                }`}>
                                  {evt.anomaly_severity || '?'}
                                </span>
                              )}
                              <span className="text-[8px] text-gray-600">
                                {new Date(evt.created_at).toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-8">No se pudo cargar el perfil</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
