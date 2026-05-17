'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldAlert, ArrowLeft, ChevronRight, RefreshCw, Search, Eye, X,
  CheckCircle2, XCircle, AlertTriangle, Ban, Snowflake, Unlock,
  Users, Store, Truck, Car, Shield, Zap, TrendingUp, Clock,
  ChevronDown, ScanSearch, FileWarning, Activity, Play, Pause, ToggleLeft, ToggleRight
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import type { FraudAlert, FraudRule, FraudDashboard, FraudUserScore } from '@/lib/supabase';

// ── Skeleton ──────────────────────────────────────────────────────
function FraudLoadingSkeleton() {
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

// ── Helpers ───────────────────────────────────────────────────────
const riskColors: Record<string, string> = {
  low: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  medium: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  high: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
  critical: 'bg-red-500/15 text-red-400 border-red-500/20',
};

const riskLabels: Record<string, string> = {
  low: 'Bajo',
  medium: 'Medio',
  high: 'Alto',
  critical: 'Critico',
};

const statusColors: Record<string, string> = {
  active: 'bg-red-500/15 text-red-400',
  under_review: 'bg-amber-500/15 text-amber-400',
  approved: 'bg-emerald-500/15 text-emerald-400',
  dismissed: 'bg-gray-500/15 text-gray-400',
  blocked: 'bg-red-500/15 text-red-400',
};

const statusLabels: Record<string, string> = {
  active: 'Activa',
  under_review: 'Revision',
  approved: 'Aprobada',
  dismissed: 'Descartada',
  blocked: 'Bloqueada',
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

const scoreStatusColors: Record<string, string> = {
  normal: 'text-emerald-400',
  suspicious: 'text-amber-400',
  high_risk: 'text-orange-400',
  blocked: 'text-red-400',
};

const scoreStatusLabels: Record<string, string> = {
  normal: 'Normal',
  suspicious: 'Sospechoso',
  high_risk: 'Alto Riesgo',
  blocked: 'Bloqueado',
};

// ── Page ──────────────────────────────────────────────────────────
export default function AntiFraudPage() {
  const [dashboard, setDashboard] = useState<FraudDashboard | null>(null);
  const [alerts, setAlerts] = useState<FraudAlert[]>([]);
  const [rules, setRules] = useState<FraudRule[]>([]);
  const [topRisks, setTopRisks] = useState<FraudUserScore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  // Filters
  const [filterType, setFilterType] = useState<string>('all');
  const [filterRisk, setFilterRisk] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('active');
  const [search, setSearch] = useState('');

  // Detail modal
  const [selectedAlert, setSelectedAlert] = useState<FraudAlert | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [showTopRisks, setShowTopRisks] = useState(false);

  const formatColones = (val: number) => `₡${Math.round(val).toLocaleString()}`;

  // ── Load Data ──────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [dashRes, alertRes, rulesRes, topRes] = await Promise.all([
        supabase.rpc('get_fraud_dashboard'),
        supabase.rpc('get_fraud_alerts', {
          p_user_type: filterType === 'all' ? null : filterType,
          p_risk_level: filterRisk === 'all' ? null : filterRisk,
          p_status: filterStatus === 'all' ? null : filterStatus,
          p_limit: 100,
        }),
        supabase.rpc('get_fraud_rules'),
        supabase.rpc('get_top_risk_users', { p_limit: 20 }),
      ]);

      if (dashRes.data) setDashboard(dashRes.data as FraudDashboard);
      if (alertRes.data) setAlerts(alertRes.data as FraudAlert[]);
      if (rulesRes.data) setRules(rulesRes.data as FraudRule[]);
      if (topRes.data) setTopRisks(topRes.data as FraudUserScore[]);
    } catch (err) {
      console.error('Error loading fraud data:', err);
    }
    setIsLoading(false);
  }, [filterType, filterRisk, filterStatus]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Actions ────────────────────────────────────────────────────
  const handleResolve = async (alertId: string, action: string, notes: string) => {
    const { error } = await supabase.rpc('resolve_fraud_alert', {
      p_alert_id: alertId,
      p_action: action,
      p_notes: notes,
    });
    if (error) {
      toast.error('Error al procesar accion: ' + error.message);
      return;
    }
    toast.success(`Alerta ${statusLabels[action]?.toLowerCase() || action}`);
    setSelectedAlert(null);
    loadAll();
  };

  const handleToggleFreeze = async (userId: string, userType: string, frozen: boolean) => {
    const { error } = await supabase.rpc('toggle_withdrawal_freeze', {
      p_user_id: userId,
      p_user_type: userType,
      p_freeze: !frozen,
    });
    if (error) {
      toast.error('Error: ' + error.message);
      return;
    }
    toast.success(frozen ? 'Retiros desbloqueados' : 'Retiros congelados');
    loadAll();
  };

  const handleScan = async () => {
    setScanning(true);
    const { data, error } = await supabase.rpc('run_fraud_scan_all');
    setScanning(false);
    if (error) {
      toast.error('Error en escaneo: ' + error.message);
      return;
    }
    const result = data as any;
    toast.success(`Escaneo completado: ${result.users_scanned} usuarios analizados, ${result.new_alerts} alertas nuevas`);
    loadAll();
  };

  const handleToggleRule = async (ruleId: string, active: boolean) => {
    const { error } = await supabase.rpc('toggle_fraud_rule', { p_rule_id: ruleId, p_active: !active });
    if (error) {
      toast.error('Error: ' + error.message);
      return;
    }
    toast.success(active ? 'Regla desactivada' : 'Regla activada');
    loadAll();
  };

  // ── Filtered alerts ────────────────────────────────────────────
  const filteredAlerts = alerts.filter((a) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      a.user_name?.toLowerCase().includes(q) ||
      a.user_email?.toLowerCase().includes(q) ||
      a.alert_type?.toLowerCase().includes(q) ||
      a.description?.toLowerCase().includes(q)
    );
  });

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-red-400" />
            Anti-Fraude
          </h1>
          <p className="text-gray-400 mt-1">Sistema de deteccion y prevencion de fraude</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleScan} disabled={scanning}
            className="px-4 py-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/25 transition-colors disabled:opacity-50 flex items-center gap-2">
            {scanning ? <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" /> : <ScanSearch className="w-4 h-4" />}
            {scanning ? 'Escaneando...' : 'Escanear Todo'}
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
        <span className="text-white font-medium">Anti-Fraude</span>
      </div>

      {isLoading ? <FraudLoadingSkeleton /> : dashboard && (
        <>
          {/* ═══ STATS ═══ */}
          <motion.div className="grid grid-cols-2 sm:grid-cols-4 gap-4"
            initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
            <div className="glass rounded-2xl p-4 border border-red-500/20">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center mb-3">
                <FileWarning className="w-5 h-5 text-red-400" />
              </div>
              <p className="text-[11px] text-gray-500 uppercase tracking-wider">Alertas Activas</p>
              <p className="text-2xl font-bold text-red-400">{dashboard.active_alerts}</p>
            </div>
            <div className="glass rounded-2xl p-4 border border-amber-500/20">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center mb-3">
                <Eye className="w-5 h-5 text-amber-400" />
              </div>
              <p className="text-[11px] text-gray-500 uppercase tracking-wider">En Revision</p>
              <p className="text-2xl font-bold text-amber-400">{dashboard.under_review}</p>
            </div>
            <div className="glass rounded-2xl p-4 border border-blue-500/20">
              <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center mb-3">
                <Snowflake className="w-5 h-5 text-blue-400" />
              </div>
              <p className="text-[11px] text-gray-500 uppercase tracking-wider">Retiros Congelados</p>
              <p className="text-2xl font-bold text-blue-400">{dashboard.frozen_withdrawals}</p>
            </div>
            <div className="glass rounded-2xl p-4 border border-purple-500/20">
              <div className="w-10 h-10 rounded-xl bg-purple-500/15 flex items-center justify-center mb-3">
                <TrendingUp className="w-5 h-5 text-purple-400" />
              </div>
              <p className="text-[11px] text-gray-500 uppercase tracking-wider">Usuarios de Riesgo</p>
              <p className="text-2xl font-bold text-purple-400">{dashboard.high_risk_users + dashboard.suspicious_users}</p>
            </div>
          </motion.div>

          {/* ═══ QUICK STATS BY TYPE ═══ */}
          <motion.div className="grid grid-cols-2 sm:grid-cols-4 gap-3"
            initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            {[
              { label: 'Clientes', count: dashboard.client_high_risk, color: 'cyan', icon: Users },
              { label: 'Negocios', count: dashboard.vendor_high_risk, color: 'orange', icon: Store },
              { label: 'Riders', count: dashboard.courier_high_risk, color: 'purple', icon: Truck },
              { label: 'Conductores', count: dashboard.driver_high_risk, color: 'blue', icon: Car },
            ].map((t) => (
              <button key={t.label} onClick={() => setFilterType(t.label === 'Clientes' ? 'client' : t.label === 'Negocios' ? 'vendor' : t.label === 'Riders' ? 'courier' : 'driver')}
                className={`glass rounded-xl p-3 text-left transition-all hover:bg-white/5 ${filterType === (t.label === 'Clientes' ? 'client' : t.label === 'Negocios' ? 'vendor' : t.label === 'Riders' ? 'courier' : 'driver') ? 'border border-white/10' : 'border border-transparent'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <t.icon className={`w-4 h-4 text-${t.color}-400`} />
                  <span className="text-[11px] text-gray-500">{t.label}</span>
                </div>
                <p className={`text-lg font-bold text-${t.color}-400`}>{t.count}</p>
              </button>
            ))}
          </motion.div>

          {/* ═══ FILTERS + SEARCH ═══ */}
          <motion.div className="glass rounded-2xl p-4 relative z-50"
            initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <div className="flex flex-wrap gap-3">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input type="text" placeholder="Buscar por nombre, email, tipo..."
                  value={search} onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-red-500/50" />
              </div>

              {/* User Type */}
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-red-500/50">
                <option value="all">Todos los tipos</option>
                <option value="client">Clientes</option>
                <option value="vendor">Negocios</option>
                <option value="courier">Riders</option>
                <option value="driver">Conductores</option>
              </select>

              {/* Risk Level */}
              <select value={filterRisk} onChange={(e) => setFilterRisk(e.target.value)}
                className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-red-500/50">
                <option value="all">Todos los riesgos</option>
                <option value="low">Bajo</option>
                <option value="medium">Medio</option>
                <option value="high">Alto</option>
                <option value="critical">Critico</option>
              </select>

              {/* Status */}
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-red-500/50">
                <option value="all">Todos los estados</option>
                <option value="active">Activas</option>
                <option value="under_review">En Revision</option>
                <option value="approved">Aprobadas</option>
                <option value="dismissed">Descartadas</option>
                <option value="blocked">Bloqueadas</option>
              </select>
            </div>
          </motion.div>

          {/* ═══ ALERTS LIST ═══ */}
          <motion.div className="glass rounded-2xl overflow-hidden"
            initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-red-400" />
                Alertas ({filteredAlerts.length})
              </h3>
              <div className="flex gap-2">
                <button onClick={() => { setShowTopRisks(!showTopRisks); setShowRules(false); }}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${showTopRisks ? 'bg-purple-500/20 text-purple-400' : 'bg-white/5 text-gray-400 hover:text-white'}`}>
                  Top Riesgo
                </button>
                <button onClick={() => { setShowRules(!showRules); setShowTopRisks(false); }}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${showRules ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/5 text-gray-400 hover:text-white'}`}>
                  Reglas
                </button>
              </div>
            </div>

            {filteredAlerts.length === 0 && !showRules && !showTopRisks ? (
              <div className="text-center py-16">
                <ShieldAlert className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                <p className="text-sm text-gray-500">No hay alertas con los filtros actuales</p>
                <p className="text-xs text-gray-600 mt-1">Las alertas se generan automaticamente al detectar actividad sospechosa</p>
              </div>
            ) : showRules ? (
              /* ═══ RULES VIEW ═══ */
              <div className="p-4 space-y-2 max-h-[600px] overflow-y-auto">
                <p className="text-xs text-gray-500 mb-3">{rules.length} reglas configuradas. {rules.filter(r => r.is_active).length} activas.</p>
                {rules.map((rule) => {
                  const Icon = userTypeIcons[rule.user_type] || Users;
                  return (
                    <div key={rule.id} className="flex items-center justify-between bg-white/[0.03] rounded-xl p-3 hover:bg-white/[0.05] transition-colors">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`w-8 h-8 rounded-lg ${userTypeColors[rule.user_type]} flex items-center justify-center flex-shrink-0`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm text-white font-medium truncate">{rule.name}</p>
                          <p className="text-[10px] text-gray-500 truncate">{rule.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                        <span className="text-xs text-amber-400 font-medium">+{rule.points}pts</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] ${userTypeColors[rule.user_type]}`}>
                          {userTypeLabels[rule.user_type]}
                        </span>
                        <button onClick={() => handleToggleRule(rule.id, rule.is_active)}
                          className="text-gray-500 hover:text-white transition-colors">
                          {rule.is_active ? <ToggleRight className="w-5 h-5 text-emerald-400" /> : <ToggleLeft className="w-5 h-5 text-gray-600" />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : showTopRisks ? (
              /* ═══ TOP RISK USERS VIEW ═══ */
              <div className="p-4 space-y-2 max-h-[600px] overflow-y-auto">
                <p className="text-xs text-gray-500 mb-3">Usuarios con mayor puntaje de riesgo</p>
                {topRisks.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-xs text-gray-500">No hay usuarios con puntaje de riesgo</p>
                  </div>
                ) : topRisks.map((u, i) => {
                  const Icon = userTypeIcons[u.user_type] || Users;
                  return (
                    <div key={u.user_id + u.user_type} className="flex items-center gap-3 bg-white/[0.03] rounded-xl p-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${i < 3 ? 'bg-red-500/20 text-red-400' : 'bg-white/5 text-gray-400'}`}>
                        #{i + 1}
                      </div>
                      <div className={`w-8 h-8 rounded-lg ${userTypeColors[u.user_type]} flex items-center justify-center flex-shrink-0`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-white font-medium truncate">{u.user_name || 'N/A'}</p>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] ${userTypeColors[u.user_type]}`}>
                            {userTypeLabels[u.user_type]}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-500 truncate">{u.user_email || ''}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 rounded-full bg-white/10 overflow-hidden">
                            <div className={`h-full rounded-full ${u.risk_score > 60 ? 'bg-red-500' : u.risk_score > 30 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                              style={{ width: `${u.risk_score}%` }} />
                          </div>
                          <span className={`text-sm font-bold ${scoreStatusColors[u.status]}`}>{u.risk_score}</span>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className={`text-[9px] ${scoreStatusColors[u.status]}`}>{scoreStatusLabels[u.status]}</span>
                          {u.withdrawals_frozen && <Snowflake className="w-3 h-3 text-blue-400" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* ═══ ALERTS TABLE ═══ */
              <div className="divide-y divide-white/5">
                {filteredAlerts.map((alert) => {
                  const Icon = userTypeIcons[alert.user_type] || Users;
                  return (
                    <motion.div key={alert.id}
                      className="p-4 hover:bg-white/[0.03] transition-colors cursor-pointer"
                      onClick={() => setSelectedAlert(alert)}
                      whileHover={{ backgroundColor: 'rgba(255,255,255,0.03)' }}>
                      <div className="flex items-center gap-4">
                        {/* Avatar + Type */}
                        <div className={`w-10 h-10 rounded-xl ${userTypeColors[alert.user_type]} flex items-center justify-center flex-shrink-0`}>
                          <Icon className="w-5 h-5" />
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-white truncate">{alert.user_name || 'N/A'}</p>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium border ${riskColors[alert.risk_level]}`}>
                              {riskLabels[alert.risk_level]}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${userTypeColors[alert.user_type]}`}>
                              {userTypeLabels[alert.user_type]}
                            </span>
                            {alert.withdrawals_frozen && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-blue-500/15 text-blue-400">
                                <Snowflake className="w-3 h-3 inline mr-0.5" /> Congelado
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 truncate mt-0.5">{alert.description || alert.alert_type}</p>
                          <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-600">
                            {alert.user_email && <span>{alert.user_email}</span>}
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(alert.created_at).toLocaleDateString('es-CR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>

                        {/* Score + Status */}
                        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-2 rounded-full bg-white/10 overflow-hidden">
                              <div className={`h-full rounded-full ${
                                (alert.user_risk_score || 0) > 60 ? 'bg-red-500' :
                                (alert.user_risk_score || 0) > 30 ? 'bg-amber-500' : 'bg-emerald-500'
                              }`} style={{ width: `${Math.min(100, alert.user_risk_score || 0)}%` }} />
                            </div>
                            <span className={`text-xs font-bold ${scoreStatusColors[alert.user_status || 'normal']}`}>
                              {alert.user_risk_score || 0}
                            </span>
                          </div>
                          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-medium ${statusColors[alert.status]}`}>
                            {statusLabels[alert.status]}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>

          {/* ═══ ALERT DETAIL MODAL ═══ */}
          <AnimatePresence>
            {selectedAlert && (
              <motion.div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setSelectedAlert(null)}>
                <motion.div className="glass-strong rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
                  initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}>

                  {/* Modal Header */}
                  <div className="flex items-center justify-between p-5 border-b border-white/10">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <FileWarning className="w-5 h-5 text-red-400" />
                      Detalle de Alerta
                    </h3>
                    <button onClick={() => setSelectedAlert(null)} className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="p-5 space-y-5">
                    {/* User Info */}
                    <div className="bg-white/[0.03] rounded-xl p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`w-12 h-12 rounded-xl ${userTypeColors[selectedAlert.user_type]} flex items-center justify-center`}>
                          {(userTypeIcons[selectedAlert.user_type] || Users)({ className: 'w-6 h-6' })}
                        </div>
                        <div>
                          <p className="text-base font-semibold text-white">{selectedAlert.user_name || 'N/A'}</p>
                          <p className="text-xs text-gray-500">{selectedAlert.user_email || ''}</p>
                        </div>
                        <div className="ml-auto text-right">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${userTypeColors[selectedAlert.user_type]}`}>
                            {userTypeLabels[selectedAlert.user_type]}
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {selectedAlert.user_phone && (
                          <div className="bg-white/5 rounded-lg px-3 py-2">
                            <span className="text-gray-500">Telefono</span>
                            <p className="text-white font-medium">{selectedAlert.user_phone}</p>
                          </div>
                        )}
                        <div className="bg-white/5 rounded-lg px-3 py-2">
                          <span className="text-gray-500">Puntaje</span>
                          <p className={`font-bold ${scoreStatusColors[selectedAlert.user_status || 'normal']}`}>
                            {selectedAlert.user_risk_score || 0}/100 — {scoreStatusLabels[selectedAlert.user_status || 'normal']}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Alert Details */}
                    <div className="space-y-3">
                      <div className="bg-white/[0.03] rounded-xl p-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-[10px] text-gray-500 mb-1">Tipo</p>
                            <p className="text-sm text-white">{selectedAlert.rule_name || selectedAlert.alert_type}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-500 mb-1">Nivel de Riesgo</p>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium border ${riskColors[selectedAlert.risk_level]}`}>
                              {riskLabels[selectedAlert.risk_level]}
                            </span>
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-500 mb-1">Estado</p>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[selectedAlert.status]}`}>
                              {statusLabels[selectedAlert.status]}
                            </span>
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-500 mb-1">Puntos</p>
                            <p className="text-sm font-bold text-amber-400">+{selectedAlert.risk_score} pts</p>
                          </div>
                        </div>
                      </div>

                      {selectedAlert.description && (
                        <div className="bg-white/[0.03] rounded-xl p-4">
                          <p className="text-[10px] text-gray-500 mb-1">Descripcion</p>
                          <p className="text-sm text-gray-300">{selectedAlert.description}</p>
                        </div>
                      )}

                      {selectedAlert.withdrawals_frozen && (
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
                          <p className="text-xs text-blue-400 flex items-center gap-1.5">
                            <Snowflake className="w-3.5 h-3.5" />
                            Los retiros de este usuario estan congelados
                          </p>
                        </div>
                      )}

                      <div className="bg-white/[0.03] rounded-xl p-4">
                        <p className="text-[10px] text-gray-500 mb-1">Fecha</p>
                        <p className="text-sm text-gray-300">
                          {new Date(selectedAlert.created_at).toLocaleString('es-CR')}
                        </p>
                      </div>

                      {selectedAlert.resolution_notes && (
                        <div className="bg-white/[0.03] rounded-xl p-4">
                          <p className="text-[10px] text-gray-500 mb-1">Notas de Resolucion</p>
                          <p className="text-sm text-gray-300">{selectedAlert.resolution_notes}</p>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    {selectedAlert.status === 'active' || selectedAlert.status === 'under_review' ? (
                      <div className="space-y-2">
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider">Acciones</p>
                        <div className="grid grid-cols-2 gap-2">
                          <button onClick={() => handleResolve(selectedAlert.id, 'approved', 'Revisado y aprobado manualmente')}
                            className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-sm font-medium hover:bg-emerald-500/25 transition-colors">
                            <CheckCircle2 className="w-4 h-4" /> Aprobar
                          </button>
                          <button onClick={() => handleResolve(selectedAlert.id, 'under_review', 'Puesto en revision por admin')}
                            className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 text-sm font-medium hover:bg-amber-500/25 transition-colors">
                            <Eye className="w-4 h-4" /> Revision
                          </button>
                          <button onClick={() => handleResolve(selectedAlert.id, 'dismissed', 'Alerta descartada por admin')}
                            className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gray-500/15 border border-gray-500/30 text-gray-400 text-sm font-medium hover:bg-gray-500/25 transition-colors">
                            <XCircle className="w-4 h-4" /> Descartar
                          </button>
                          <button onClick={() => handleResolve(selectedAlert.id, 'blocked', 'Usuario bloqueado por fraude')}
                            className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/25 transition-colors">
                            <Ban className="w-4 h-4" /> Bloquear
                          </button>
                        </div>

                        {/* Withdrawal freeze/unfreeze */}
                        <button
                          onClick={() => handleToggleFreeze(selectedAlert.user_id, selectedAlert.user_type, selectedAlert.withdrawals_frozen)}
                          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                            selectedAlert.withdrawals_frozen
                              ? 'bg-blue-500/15 border border-blue-500/30 text-blue-400 hover:bg-blue-500/25'
                              : 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/25'
                          }`}>
                          {selectedAlert.withdrawals_frozen
                            ? <><Unlock className="w-4 h-4" /> Descongelar Retiros</>
                            : <><Snowflake className="w-4 h-4" /> Congelar Retiros</>
                          }
                        </button>
                      </div>
                    ) : (
                      <div className="text-center py-3">
                        <p className="text-xs text-gray-500">
                          Alerta {statusLabels[selectedAlert.status]?.toLowerCase()} el {selectedAlert.resolved_at ? new Date(selectedAlert.resolved_at).toLocaleDateString('es-CR') : 'N/A'}
                        </p>
                      </div>
                    )}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
