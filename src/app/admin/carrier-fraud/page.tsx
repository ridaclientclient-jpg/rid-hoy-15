'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import {
  ShieldAlert, Shield, Truck, Activity, Navigation, Clock,
  AlertTriangle, CheckCircle2, XCircle, Ban, MapPin,
  Package, Loader2, ChevronDown, ChevronUp, Satellite,
  TrendingUp, Users, Eye,
} from 'lucide-react';

interface FraudDelivery {
  id: string;
  status: string;
  payment_status: string;
  review_status: string;
  subtotal: number;
  delivery_fee: number;
  total: number;
  carrier_distance_meters: number;
  carrier_max_speed_kmh: number;
  carrier_avg_speed_kmh: number;
  carrier_duration_minutes: number;
  carrier_gps_points: number;
  carrier_route_score: number;
  carrier_fraud_flags: string[];
  carrier_picked_up_at: string;
  carrier_delivered_at: string;
  created_at: string;
  courier_name: string;
  courier_phone: string;
  vehicle_type: string;
  courier_status: string;
  customer_name: string;
  vendor_name: string;
  reviewer_name: string;
  courier_risk_score: number;
}

interface FraudDashboard {
  total_carriers: number;
  online_now: number;
  suspended: number;
  high_risk: number;
  frozen_withdrawals: number;
  flagged_deliveries_today: number;
  zero_movement_deliveries: number;
  total_gps_points_today: number;
  avg_route_score: number;
}

export default function AdminCarrierFraud() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'flagged' | 'review'>('dashboard');
  const [dashboard, setDashboard] = useState<FraudDashboard | null>(null);
  const [deliveries, setDeliveries] = useState<FraudDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDelivery, setSelectedDelivery] = useState<FraudDelivery | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const fetchDashboard = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_carrier_fraud_dashboard');
    if (!error && data) setDashboard(data);
  }, []);

  const fetchDeliveries = useCallback(async () => {
    setLoading(true);
    const minScore = activeTab === 'review' ? 25 : 50;
    const { data, error } = await supabase.rpc('get_suspicious_carrier_deliveries', {
      p_limit: 100,
      p_min_score: minScore,
    });
    if (!error && data) {
      let filtered = data as FraudDelivery[];
      if (filterStatus !== 'all') {
        filtered = filtered.filter(d => d.review_status === filterStatus);
      }
      setDeliveries(filtered);
    }
    setLoading(false);
  }, [activeTab, filterStatus]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);
  useEffect(() => { fetchDeliveries(); }, [fetchDeliveries]);

  const handleReview = async (deliveryId: string, action: 'approve' | 'reject' | 'block_carrier') => {
    if (!user?.id) return;
    setActionLoading(deliveryId);
    try {
      const { data, error } = await supabase.rpc('admin_review_carrier_delivery', {
        p_delivery_id: deliveryId,
        p_action: action,
        p_reviewer_id: user.id,
      });
      if (error) {
        toast.error('Error: ' + error.message);
        return;
      }
      const actionMessages = {
        approve: 'Entrega aprobada — pago liberado',
        reject: 'Entrega rechazada — pago retenido',
        block_carrier: 'Carrier bloqueado y suspendido',
      };
      toast.success(actionMessages[action]);
      setSelectedDelivery(null);
      fetchDeliveries();
      fetchDashboard();
    } catch {
      toast.error('Error de conexion');
    } finally {
      setActionLoading(null);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-red-400';
    if (score >= 50) return 'text-amber-400';
    return 'text-emerald-400';
  };
  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-red-500/20 border-red-500/30';
    if (score >= 50) return 'bg-amber-500/20 border-amber-500/30';
    return 'bg-emerald-500/20 border-emerald-500/30';
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Anti-Fraude Carriers</h1>
            <p className="text-sm text-gray-400">Monitoreo de entregas y validaciones GPS</p>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="flex gap-2">
        {[
          { key: 'dashboard', label: 'Dashboard', icon: Activity },
          { key: 'flagged', label: 'Sospechosas', icon: ShieldAlert },
          { key: 'review', label: 'En Revision', icon: Eye },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key as typeof activeTab); setSelectedDelivery(null); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                : 'glass text-gray-400 hover:bg-white/5'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </motion.div>

      {/* Dashboard */}
      {activeTab === 'dashboard' && dashboard && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Carriers Online', value: dashboard.online_now, icon: Truck, color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
              { label: 'Entregas Sospechosas Hoy', value: dashboard.flagged_deliveries_today, icon: ShieldAlert, color: 'text-red-400', bg: 'bg-red-500/20' },
              { label: 'Sin Movimiento', value: dashboard.zero_movement_deliveries, icon: Navigation, color: 'text-amber-400', bg: 'bg-amber-500/20' },
              { label: 'Score Promedio Ruta', value: `${dashboard.avg_route_score}%`, icon: Activity, color: parseFloat(String(dashboard.avg_route_score)) >= 80 ? 'text-emerald-400' : 'text-amber-400', bg: parseFloat(String(dashboard.avg_route_score)) >= 80 ? 'bg-emerald-500/20' : 'bg-amber-500/20' },
              { label: 'Carriers Suspendidos', value: dashboard.suspended, icon: Ban, color: 'text-red-400', bg: 'bg-red-500/20' },
              { label: 'High Risk', value: dashboard.high_risk, icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/20' },
              { label: 'Retiros Congelados', value: dashboard.frozen_withdrawals, icon: Shield, color: 'text-amber-400', bg: 'bg-amber-500/20' },
              { label: 'Puntos GPS Hoy', value: dashboard.total_gps_points_today.toLocaleString(), icon: Satellite, color: 'text-blue-400', bg: 'bg-blue-500/20' },
            ].map((kpi, i) => (
              <motion.div
                key={kpi.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.03 }}
                className="glass rounded-xl p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`w-8 h-8 rounded-lg ${kpi.bg} flex items-center justify-center`}>
                    <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                  </div>
                </div>
                <p className="text-2xl font-bold text-white">{kpi.value}</p>
                <p className="text-xs text-gray-500 mt-1">{kpi.label}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Flagged / Review Deliveries */}
      {(activeTab === 'flagged' || activeTab === 'review') && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {/* Filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500">Filtrar:</span>
            {[
              { key: 'all', label: 'Todas' },
              { key: 'under_review', label: 'En Revision' },
              { key: 'flagged', label: 'Marcadas' },
              { key: 'blocked', label: 'Bloqueadas' },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setFilterStatus(f.key)}
                className={`text-xs px-3 py-1.5 rounded-lg transition-all ${
                  filterStatus === f.key
                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                    : 'glass text-gray-500 hover:text-gray-300'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-orange-400 animate-spin" />
            </div>
          ) : deliveries.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <p className="text-sm text-gray-400">No hay entregas sospechosas</p>
            </div>
          ) : (
            <div className="space-y-3">
              {deliveries.map((d, i) => (
                <motion.div
                  key={d.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className={`glass rounded-xl p-4 border cursor-pointer hover:bg-white/5 transition-colors ${getScoreBg(d.carrier_route_score)}`}
                  onClick={() => setSelectedDelivery(selectedDelivery?.id === d.id ? null : d)}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                        <Truck className="w-5 h-5 text-orange-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{d.courier_name}</p>
                        <p className="text-xs text-gray-500">{d.vehicle_type?.toUpperCase()} • {d.courier_phone}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-lg font-bold ${getScoreColor(d.carrier_route_score)}`}>
                        {d.carrier_route_score}%
                      </span>
                      <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${selectedDelivery?.id === d.id ? 'rotate-180' : ''}`} />
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    <div className="text-center">
                      <p className="text-xs text-gray-500">Distancia</p>
                      <p className="text-sm font-medium text-white">
                        {d.carrier_distance_meters >= 1000
                          ? `${(d.carrier_distance_meters / 1000).toFixed(1)}km`
                          : `${Math.round(d.carrier_distance_meters)}m`}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500">Vel. Max</p>
                      <p className={`text-sm font-medium ${d.carrier_max_speed_kmh > 120 ? 'text-red-400' : 'text-white'}`}>
                        {d.carrier_max_speed_kmh} km/h
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500">Duracion</p>
                      <p className={`text-sm font-medium ${d.carrier_duration_minutes < 3 ? 'text-red-400' : 'text-white'}`}>
                        {d.carrier_duration_minutes} min
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500">GPS Pts</p>
                      <p className={`text-sm font-medium ${d.carrier_gps_points < 5 ? 'text-red-400' : 'text-white'}`}>
                        {d.carrier_gps_points}
                      </p>
                    </div>
                  </div>

                  {/* Flags */}
                  {d.carrier_fraud_flags && d.carrier_fraud_flags.length > 0 && (
                    <div className="space-y-1 mb-3">
                      {d.carrier_fraud_flags.map((flag, fi) => (
                        <div key={fi} className="flex items-start gap-1.5">
                          <AlertTriangle className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />
                          <p className="text-xs text-red-400/90">{flag}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Route Score Bar */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-gray-500">Score de Ruta</span>
                      <span className={`text-[10px] font-medium ${getScoreColor(d.carrier_route_score)}`}>
                        {d.carrier_route_score >= 80 ? 'Excelente' : d.carrier_route_score >= 50 ? 'Regular' : 'Sospechoso'}
                      </span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${d.carrier_route_score}%` }}
                        transition={{ duration: 0.5, delay: i * 0.05 }}
                        className={`h-full rounded-full ${
                          d.carrier_route_score >= 80 ? 'bg-emerald-500' :
                          d.carrier_route_score >= 50 ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex items-center justify-between text-[10px] text-gray-500">
                    <div className="flex items-center gap-3">
                      <span>#{d.id.slice(0, 8)}</span>
                      <span>{d.vendor_name}</span>
                      <span>{formatDate(d.created_at)}</span>
                    </div>
                    <span className="font-medium">₡{d.delivery_fee.toLocaleString()}</span>
                  </div>

                  {/* Expanded Actions */}
                  <AnimatePresence>
                    {selectedDelivery?.id === d.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="pt-3 mt-3 border-t border-white/10 space-y-3">
                          {/* Customer info */}
                          <div className="flex items-center gap-2 text-xs">
                            <Package className="w-3 h-3 text-gray-500" />
                            <span className="text-gray-500">Cliente:</span>
                            <span className="text-white">{d.customer_name}</span>
                          </div>

                          {d.carrier_risk_score > 0 && (
                            <div className="flex items-center gap-2 text-xs">
                              <AlertTriangle className="w-3 h-3 text-red-400" />
                              <span className="text-gray-500">Risk Score del carrier:</span>
                              <span className="text-red-400 font-medium">{d.carrier_risk_score}/100</span>
                            </div>
                          )}

                          {d.reviewer_name && (
                            <div className="flex items-center gap-2 text-xs">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              <span className="text-gray-500">Revisado por:</span>
                              <span className="text-white">{d.reviewer_name}</span>
                            </div>
                          )}

                          {/* Action buttons */}
                          {d.review_status !== 'approved' && d.review_status !== 'blocked' && (
                            <div className="flex gap-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleReview(d.id, 'approve'); }}
                                disabled={actionLoading === d.id}
                                className="flex-1 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-medium py-2 rounded-lg flex items-center justify-center gap-1.5 hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
                              >
                                {actionLoading === d.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                                Aprobar
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleReview(d.id, 'reject'); }}
                                disabled={actionLoading === d.id}
                                className="flex-1 bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-medium py-2 rounded-lg flex items-center justify-center gap-1.5 hover:bg-amber-500/30 transition-colors disabled:opacity-50"
                              >
                                {actionLoading === d.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                                Rechazar
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleReview(d.id, 'block_carrier'); }}
                                disabled={actionLoading === d.id}
                                className="flex-1 bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-medium py-2 rounded-lg flex items-center justify-center gap-1.5 hover:bg-red-500/30 transition-colors disabled:opacity-50"
                              >
                                {actionLoading === d.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Ban className="w-3 h-3" />}
                                Bloquear
                              </button>
                            </div>
                          )}

                          {d.review_status === 'approved' && (
                            <div className="bg-emerald-500/10 rounded-lg p-2 text-center">
                              <p className="text-xs text-emerald-400 font-medium">Entrega aprobada por {d.reviewer_name}</p>
                            </div>
                          )}

                          {d.review_status === 'blocked' && (
                            <div className="bg-red-500/10 rounded-lg p-2 text-center">
                              <p className="text-xs text-red-400 font-medium">Entrega bloqueada</p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-CR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
