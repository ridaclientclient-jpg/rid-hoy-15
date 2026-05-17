'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DollarSign, ShoppingCart, ShieldAlert, Wallet, Users,
  ArrowLeft, ChevronRight, Search, Eye, X, Save, RefreshCw,
  CheckCircle2, XCircle, AlertTriangle, Ban, Snowflake,
  Store, Truck, User, Clock, Percent, Calculator,
  ChevronDown, Loader2, Shield, TrendingUp, Filter
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';

// ─── Types ──────────────────────────────────────────────────────────
type TabKey = 'commissions' | 'orders' | 'antifraud' | 'withdrawals' | 'users';

// ─── Tab Config ─────────────────────────────────────────────────────
const tabs: { key: TabKey; label: string; icon: typeof DollarSign; activeBg: string; activeText: string; activeBorder: string }[] = [
  { key: 'commissions', label: 'Comisiones', icon: Percent, activeBg: 'bg-orange-500/15', activeText: 'text-orange-400', activeBorder: 'border-orange-500/30' },
  { key: 'orders', label: 'Pedidos', icon: ShoppingCart, activeBg: 'bg-purple-500/15', activeText: 'text-purple-400', activeBorder: 'border-purple-500/30' },
  { key: 'antifraud', label: 'Anti-Fraude', icon: ShieldAlert, activeBg: 'bg-red-500/15', activeText: 'text-red-400', activeBorder: 'border-red-500/30' },
  { key: 'withdrawals', label: 'Retiros', icon: Wallet, activeBg: 'bg-cyan-500/15', activeText: 'text-cyan-400', activeBorder: 'border-cyan-500/30' },
  { key: 'users', label: 'Usuarios', icon: Users, activeBg: 'bg-blue-500/15', activeText: 'text-blue-400', activeBorder: 'border-blue-500/30' },
];

// ─── Helpers ────────────────────────────────────────────────────────
const fmt = (n: number) => `₡${Math.round(n).toLocaleString()}`;
const fmtDate = (d: string) => {
  const dt = new Date(d);
  return dt.toLocaleDateString('es-CR', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
    ' ' + dt.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' });
};

const riskColors: Record<string, string> = {
  low: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  medium: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  high: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
  critical: 'bg-red-500/15 text-red-400 border-red-500/20',
};
const riskLabels: Record<string, string> = { low: 'Bajo', medium: 'Medio', high: 'Alto', critical: 'Critico' };

const userTypeColors: Record<string, string> = {
  client: 'bg-cyan-500/15 text-cyan-400', vendor: 'bg-orange-500/15 text-orange-400',
  courier: 'bg-purple-500/15 text-purple-400', driver: 'bg-blue-500/15 text-blue-400',
};
const userTypeLabels: Record<string, string> = {
  client: 'Cliente', vendor: 'Negocio', courier: 'Carrier', driver: 'Conductor',
};
const userTypeIcons: Record<string, typeof Users> = {
  client: Users, vendor: Store, courier: Truck, driver: User,
};

const earningStatusColors: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-400', released: 'bg-emerald-500/15 text-emerald-400',
  frozen: 'bg-blue-500/15 text-blue-400', blocked: 'bg-red-500/15 text-red-400',
};
const earningStatusLabels: Record<string, string> = {
  pending: 'Pendiente', released: 'Liberado', frozen: 'Congelado', blocked: 'Bloqueado',
};

const withdrawalStatusColors: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-400', processing: 'bg-blue-500/15 text-blue-400',
  completed: 'bg-emerald-500/15 text-emerald-400', failed: 'bg-red-500/15 text-red-400',
  rejected: 'bg-red-500/15 text-red-400', cancelled: 'bg-gray-500/15 text-gray-400',
};
const withdrawalStatusLabels: Record<string, string> = {
  pending: 'Pendiente', processing: 'Procesando', completed: 'Completado',
  failed: 'Fallido', rejected: 'Rechazado', cancelled: 'Cancelado',
};

// ─── Slider Color Map (full class names for Tailwind purge safety) ──
const sliderColorMap: Record<string, { border: string; text: string; accent: string; thumb: string; bg: string }> = {
  orange: {
    border: 'border-orange-500/20',
    text: 'text-orange-400',
    accent: '[&::-webkit-slider-thumb]:bg-orange-500 [&::-moz-range-thumb]:bg-orange-500',
    thumb: 'accent-orange-500',
    bg: 'bg-orange-500/15',
  },
  purple: {
    border: 'border-purple-500/20',
    text: 'text-purple-400',
    accent: '[&::-webkit-slider-thumb]:bg-purple-500 [&::-moz-range-thumb]:bg-purple-500',
    thumb: 'accent-purple-500',
    bg: 'bg-purple-500/15',
  },
  red: {
    border: 'border-red-500/20',
    text: 'text-red-400',
    accent: '[&::-webkit-slider-thumb]:bg-red-500 [&::-moz-range-thumb]:bg-red-500',
    thumb: 'accent-red-500',
    bg: 'bg-red-500/15',
  },
  cyan: {
    border: 'border-cyan-500/20',
    text: 'text-cyan-400',
    accent: '[&::-webkit-slider-thumb]:bg-cyan-500 [&::-moz-range-thumb]:bg-cyan-500',
    thumb: 'accent-cyan-500',
    bg: 'bg-cyan-500/15',
  },
  blue: {
    border: 'border-blue-500/20',
    text: 'text-blue-400',
    accent: '[&::-webkit-slider-thumb]:bg-blue-500 [&::-moz-range-thumb]:bg-blue-500',
    thumb: 'accent-blue-500',
    bg: 'bg-blue-500/15',
  },
};

// ─── SliderCard (defined OUTSIDE any component to avoid re-creation) ──
const SliderCard = React.memo(function SliderCard({
  title, desc, value, onChange, min, max, step, color, suffix,
}: {
  title: string; desc: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number; color: string; suffix?: string;
}) {
  const cm = sliderColorMap[color] || sliderColorMap.orange;
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className={`glass rounded-2xl p-5 ${cm.border} transition-colors duration-200`}>
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <span className={`text-xl font-bold ${cm.text} tabular-nums transition-colors duration-150`}>{value}{suffix || ''}</span>
      </div>
      <p className="text-[10px] text-gray-500 mb-4">{desc}</p>
      <div className="relative">
        {/* Track background */}
        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${color === 'orange' ? 'from-orange-600 to-orange-400' : color === 'purple' ? 'from-purple-600 to-purple-400' : color === 'red' ? 'from-red-600 to-red-400' : color === 'cyan' ? 'from-cyan-600 to-cyan-400' : 'from-blue-600 to-blue-400'} transition-all duration-75`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          style={{ margin: 0 }}
        />
      </div>
      <div className="flex justify-between mt-1 text-[10px] text-gray-600">
        <span>{min}{suffix || ''}</span><span>{max}{suffix || ''}</span>
      </div>
    </div>
  );
});


// ─── Skeleton ───────────────────────────────────────────────────────
function Skeleton() {
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
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-white/5 rounded-xl" />)}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// TAB 1: COMMISSIONS / PRICES
// ═══════════════════════════════════════════════════════════════════════
function CommissionsTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Marketplace
  const [marketComm, setMarketComm] = useState(15);
  const [marketMinWithdraw, setMarketMinWithdraw] = useState(10000);
  const [marketReleaseHours, setMarketReleaseHours] = useState(48);

  // Carrier
  const [carrierComm, setCarrierComm] = useState(20);
  const [carrierMinWithdraw, setCarrierMinWithdraw] = useState(5000);
  const [carrierMaxPerDay, setCarrierMaxPerDay] = useState(1);
  const [carrierReleaseHours, setCarrierReleaseHours] = useState(48);
  const [carrierMaxSpeed, setCarrierMaxSpeed] = useState(120);
  const [carrierFreezeScore, setCarrierFreezeScore] = useState(70);
  const [carrierMaxDistPickup, setCarrierMaxDistPickup] = useState(2);
  const [carrierMinDeliveryFee, setCarrierMinDeliveryFee] = useState(500);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const { data: settings, error } = await supabase.from('settings').select('key, value');
      if (!error && settings) {
        const get = (key: string, fallback: number) =>
          Number(settings.find((s: any) => s.key === key)?.value ?? fallback);
        setMarketComm(get('marketplace_commission_pct', 15));
        setMarketMinWithdraw(get('marketplace_min_withdrawal', 10000));
        setMarketReleaseHours(get('withdrawal_delay_hours', 48));
        setCarrierComm(get('carrier_commission_rate', 20));
        setCarrierMinWithdraw(get('carrier_min_withdrawal_amount', 5000));
        setCarrierMaxPerDay(get('carrier_max_withdrawals_per_day', 1));
        setCarrierReleaseHours(get('carrier_fund_release_hours', 48));
        setCarrierMaxSpeed(get('carrier_max_speed_kmh', 120));
        setCarrierFreezeScore(get('carrier_auto_freeze_fraud_score', 70));
        setCarrierMaxDistPickup(get('carrier_max_distance_from_pickup_km', 2));
        setCarrierMinDeliveryFee(get('carrier_min_delivery_fee', 500));
      }
    } catch (err) { console.error(err); }
    setLoading(false);
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = [
        { key: 'marketplace_commission_pct', value: String(marketComm) },
        { key: 'marketplace_min_withdrawal', value: String(marketMinWithdraw) },
        { key: 'withdrawal_delay_hours', value: String(marketReleaseHours) },
        { key: 'carrier_commission_rate', value: String(carrierComm) },
        { key: 'carrier_min_withdrawal_amount', value: String(carrierMinWithdraw) },
        { key: 'carrier_max_withdrawals_per_day', value: String(carrierMaxPerDay) },
        { key: 'carrier_fund_release_hours', value: String(carrierReleaseHours) },
        { key: 'carrier_max_speed_kmh', value: String(carrierMaxSpeed) },
        { key: 'carrier_auto_freeze_fraud_score', value: String(carrierFreezeScore) },
        { key: 'carrier_max_distance_from_pickup_km', value: String(carrierMaxDistPickup) },
        { key: 'carrier_min_delivery_fee', value: String(carrierMinDeliveryFee) },
      ];
      for (const s of data) {
        await supabase.from('settings').upsert(s, { onConflict: 'key' });
      }
      toast.success('Configuracion guardada correctamente', {
        description: `Marketplace: ${marketComm}% | Carrier: ${carrierComm}%`,
      });
    } catch (err) {
      console.error(err);
      toast.error('Error al guardar la configuracion');
    }
    setSaving(false);
  };

  if (loading) return <Skeleton />;

  // SliderCard is now defined outside the component (see above) — no more re-render flicker

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Comision Marketplace', value: `${marketComm}%`, color: 'orange', icon: Store },
          { label: 'Comision Carrier', value: `${carrierComm}%`, color: 'purple', icon: Truck },
          { label: 'Liberacion Marketplace', value: `${marketReleaseHours}h`, color: 'cyan', icon: Clock },
          { label: 'Liberacion Carrier', value: `${carrierReleaseHours}h`, color: 'blue', icon: Clock },
        ].map((s) => {
          const cm = sliderColorMap[s.color] || sliderColorMap.orange;
          return (
          <div key={s.label} className={`glass rounded-2xl p-4 ${cm.border}`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${cm.bg} flex items-center justify-center`}>
                <s.icon className={`w-5 h-5 ${cm.text}`} />
              </div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">{s.label}</p>
                <p className={`text-lg font-bold ${cm.text}`}>{s.value}</p>
              </div>
            </div>
          </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Marketplace Commissions */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Store className="w-5 h-5 text-orange-400" /> Comisiones Marketplace
          </h3>
          <SliderCard title="Comision Marketplace" desc="Porcentaje que RIDA cobra por pedido" value={marketComm}
            onChange={setMarketComm} min={0} max={100} step={1} color="orange" suffix="%" />
          <SliderCard title="Monto Minimo Retiro" desc="Minimo para que negocios retiren" value={marketMinWithdraw}
            onChange={setMarketMinWithdraw} min={1000} max={100000} step={1000} color="orange" />

          {/* Example */}
          <div className="glass rounded-2xl p-4 border border-orange-500/15">
            <p className="text-xs font-medium text-orange-400 mb-2 flex items-center gap-1.5">
              <Calculator className="w-3.5 h-3.5" /> Ejemplo: Pedido de ₡10,000
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-orange-500/10 rounded-lg p-3">
                <p className="text-[10px] text-orange-300">RIDA ({marketComm}%)</p>
                <p className="text-base font-bold text-orange-400">{fmt(10000 * marketComm / 100)}</p>
              </div>
              <div className="bg-emerald-500/10 rounded-lg p-3">
                <p className="text-[10px] text-emerald-300">Negocio recibe</p>
                <p className="text-base font-bold text-emerald-400">{fmt(10000 * (100 - marketComm) / 100)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Carrier Commissions */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Truck className="w-5 h-5 text-purple-400" /> Comisiones Carriers
          </h3>
          <SliderCard title="Comision Carrier" desc="Porcentaje que RIDA retiene al carrier" value={carrierComm}
            onChange={setCarrierComm} min={0} max={100} step={1} color="purple" suffix="%" />
          <SliderCard title="Minimo por Entrega" desc="Tarifa minima por entrega" value={carrierMinDeliveryFee}
            onChange={setCarrierMinDeliveryFee} min={100} max={5000} step={100} color="purple" />
          <SliderCard title="Monto Minimo Retiro" desc="Minimo para que carriers retiren" value={carrierMinWithdraw}
            onChange={setCarrierMinWithdraw} min={1000} max={50000} step={500} color="purple" />
          <SliderCard title="Retiros por Dia" desc="Maximo de retiros permitidos por dia" value={carrierMaxPerDay}
            onChange={setCarrierMaxPerDay} min={1} max={5} step={1} color="purple" />
        </div>
      </div>

      {/* Anti-Fraud Config */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Shield className="w-5 h-5 text-red-400" /> Umbrales Anti-Fraude Carrier
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SliderCard title="Score Auto-Freeze" desc="Puntaje que congela wallet automaticamente" value={carrierFreezeScore}
            onChange={setCarrierFreezeScore} min={30} max={100} step={5} color="red" />
          <SliderCard title="Velocidad Maxima" desc="Velocidad maxima permitida (km/h)" value={carrierMaxSpeed}
            onChange={setCarrierMaxSpeed} min={60} max={200} step={10} color="red" suffix=" km/h" />
          <SliderCard title="Distancia Max Pickup" desc="Distancia maxima permitida del pickup (km)" value={carrierMaxDistPickup}
            onChange={setCarrierMaxDistPickup} min={0.5} max={10} step={0.5} color="red" suffix=" km" />
        </div>
      </div>

      {/* Save */}
      <motion.button onClick={handleSave} disabled={saving}
        className="w-full py-3.5 rounded-xl btn-neon text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
        whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
        {saving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Guardando...</>
          : <><Save className="w-4 h-4" /> Guardar Todos los Cambios</>}
      </motion.button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// TAB 2: PEDIDOS
// ═══════════════════════════════════════════════════════════════════════
function OrdersTab() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('deliveries')
        .select('*, profiles(name, phone), vendors(store_name)')
        .order('created_at', { ascending: false })
        .limit(100);
      if (!error && data) setOrders(data);
    } catch (err) { console.error(err); }
    setLoading(false);
  }, []);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const filtered = useMemo(() => {
    return orders.filter((o: any) => {
      const matchFilter = filter === 'all' || o.status === filter;
      const q = search.toLowerCase();
      const matchSearch = !q ||
        (o.profiles as any)?.name?.toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q);
      return matchFilter && matchSearch;
    });
  }, [orders, filter, search]);

  const handleStatusChange = async (id: string, newStatus: string) => {
    const { error } = await supabase.from('deliveries').update({ status: newStatus }).eq('id', id);
    if (error) { toast.error('Error al cambiar estado'); return; }
    setOrders((prev) => prev.map((o: any) => o.id === id ? { ...o, status: newStatus } : o));
    if (selected?.id === id) setSelected({ ...selected, status: newStatus });
    toast.success(`Pedido actualizado a: ${newStatus}`);
  };

  const shortId = (id: string) => '#' + id.slice(-6).toUpperCase();

  const statusCfg: Record<string, { label: string; color: string }> = {
    pending: { label: 'Pendiente', color: 'amber' }, accepted: { label: 'Aceptado', color: 'blue' },
    picked_up: { label: 'Recogido', color: 'purple' }, in_transit: { label: 'En Camino', color: 'cyan' },
    delivered: { label: 'Entregado', color: 'emerald' }, under_review: { label: 'En Revision', color: 'orange' },
    cancelled: { label: 'Cancelado', color: 'red' },
  };
  const statusColor: Record<string, string> = {
    amber: 'bg-amber-500/15 text-amber-400', blue: 'bg-blue-500/15 text-blue-400',
    purple: 'bg-purple-500/15 text-purple-400', cyan: 'bg-cyan-500/15 text-cyan-400',
    emerald: 'bg-emerald-500/15 text-emerald-400', orange: 'bg-orange-500/15 text-orange-400',
    red: 'bg-red-500/15 text-red-400',
  };

  if (loading) return <Skeleton />;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', count: orders.length, numClass: 'text-gray-400' },
          { label: 'En Revision', count: orders.filter((o: any) => o.status === 'under_review').length, numClass: 'text-orange-400' },
          { label: 'Entregados', count: orders.filter((o: any) => o.status === 'delivered').length, numClass: 'text-emerald-400' },
          { label: 'Cancelados', count: orders.filter((o: any) => o.status === 'cancelled').length, numClass: 'text-red-400' },
        ].map((s) => (
          <div key={s.label} className="glass rounded-xl p-3">
            <p className="text-[10px] text-gray-500 uppercase">{s.label}</p>
            <p className={`text-xl font-bold ${s.numClass}`}>{s.count}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input type="text" placeholder="Buscar por ID o nombre..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-purple-500/50" />
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          {['all', 'pending', 'under_review', 'delivered', 'cancelled'].map((s) => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${filter === s ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30' : 'bg-white/5 text-gray-400 border border-transparent hover:bg-white/10'}`}>
              {s === 'all' ? 'Todos' : statusCfg[s]?.label || s}
            </button>
          ))}
        </div>
      </div>

      {/* Orders List */}
      <div className="glass rounded-2xl overflow-hidden divide-y divide-white/5">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <ShoppingCart className="w-12 h-12 text-gray-700 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No se encontraron pedidos</p>
          </div>
        ) : filtered.map((order: any, i: number) => {
          const cfg = statusCfg[order.status] || { label: order.status, color: 'gray' };
          const profile = order.profiles as any;
          const vendor = order.vendors as any;
          return (
            <motion.div key={order.id} className="p-4 hover:bg-white/[0.03] transition-colors"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.02, 0.2) }}>
              <div className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-purple-400">{shortId(order.id)}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColor[cfg.color]}`}>
                      {cfg.label}
                    </span>
                    {order.carrier_fraud_score > 30 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/15 text-red-400">
                        Fraude: {order.carrier_fraud_score}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-white truncate">{profile?.name || 'Sin nombre'}</p>
                  <div className="flex items-center gap-3 mt-0.5 text-[10px] text-gray-500">
                    {vendor?.store_name && <span className="flex items-center gap-1"><Store className="w-3 h-3" />{vendor.store_name}</span>}
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{fmtDate(order.created_at)}</span>
                    {order.total && <span className="text-emerald-400 font-medium">{fmt(order.total)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="relative" onClick={(e) => e.stopPropagation()}>
                    <select value={order.status}
                      onChange={(e) => handleStatusChange(order.id, e.target.value)}
                      className={`appearance-none text-[10px] font-medium px-2.5 py-1.5 rounded-lg border pr-7 cursor-pointer focus:outline-none bg-white/5 ${statusColor[cfg.color]}`}>
                      {Object.entries(statusCfg).map(([k, v]) => <option key={k} value={k} className="bg-gray-900">{v.label}</option>)}
                    </select>
                    <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
                  </div>
                  <motion.button onClick={() => setSelected(order)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 transition-colors"
                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Eye className="w-3.5 h-3.5" />
                  </motion.button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selected && (
          <motion.div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelected(null)}>
            <motion.div className="glass-strong rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-5 border-b border-white/10">
                <h3 className="text-lg font-bold text-white">{shortId(selected.id)}</h3>
                <button onClick={() => setSelected(null)} className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="glass rounded-xl p-3">
                    <p className="text-[10px] text-gray-500">Estado</p>
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${statusColor[(statusCfg[selected.status] || { color: 'gray' }).color]}`}>
                      {(statusCfg[selected.status] || { label: selected.status }).label}
                    </span>
                  </div>
                  {selected.total && (
                    <div className="glass rounded-xl p-3">
                      <p className="text-[10px] text-gray-500">Total</p>
                      <p className="text-lg font-bold text-emerald-400 mt-1">{fmt(selected.total)}</p>
                    </div>
                  )}
                  {selected.carrier_fraud_score > 0 && (
                    <div className="glass rounded-xl p-3">
                      <p className="text-[10px] text-gray-500">Fraud Score Carrier</p>
                      <p className={`text-lg font-bold mt-1 ${selected.carrier_fraud_score >= 70 ? 'text-red-400' : selected.carrier_fraud_score >= 30 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {selected.carrier_fraud_score}/100
                      </p>
                    </div>
                  )}
                  <div className="glass rounded-xl p-3">
                    <p className="text-[10px] text-gray-500">Fecha</p>
                    <p className="text-sm text-white mt-1">{fmtDate(selected.created_at)}</p>
                  </div>
                </div>
                <div className="glass rounded-xl p-3">
                  <p className="text-[10px] text-gray-500">Cliente</p>
                  <p className="text-sm text-white">{(selected.profiles as any)?.name || 'N/A'}</p>
                  <p className="text-[11px] text-gray-400">{(selected.profiles as any)?.phone || ''}</p>
                </div>
                {selected.pickup_address && (
                  <div className="glass rounded-xl p-3">
                    <p className="text-[10px] text-gray-500">Direccion de Entrega</p>
                    <p className="text-sm text-white">{selected.pickup_address}</p>
                  </div>
                )}
                {selected.carrier_fraud_flags && (selected.carrier_fraud_flags as any[]).length > 0 && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                    <p className="text-xs font-medium text-red-400 mb-2 flex items-center gap-1.5"><ShieldAlert className="w-3.5 h-3.5" /> Flags de Fraude</p>
                    <div className="space-y-1">
                      {(selected.carrier_fraud_flags as any[]).map((f: any, i: number) => (
                        <p key={i} className="text-[11px] text-gray-300">- {f.message || f.code}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// TAB 3: ANTI-FRAUD
// ═══════════════════════════════════════════════════════════════════════
function AntiFraudTab() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [filterRisk, setFilterRisk] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedAlert, setSelectedAlert] = useState<any>(null);
  const [actionNotes, setActionNotes] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [alertRes, statsRes] = await Promise.all([
        supabase.from('fraud_alerts').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.rpc('get_carrier_fraud_stats'),
      ]);
      if (!alertRes.error && alertRes.data) setAlerts(alertRes.data);
      if (!statsRes.error && statsRes.data) setStats(statsRes.data);
    } catch (err) { console.error(err); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    return alerts.filter((a: any) => {
      const matchType = filterType === 'all' || a.entity_type === filterType;
      const matchRisk = filterRisk === 'all' || a.severity === filterRisk;
      const q = search.toLowerCase();
      const matchSearch = !q || a.description?.toLowerCase().includes(q) || a.alert_type?.toLowerCase().includes(q);
      return matchType && matchRisk && matchSearch;
    });
  }, [alerts, filterType, filterRisk, search]);

  const handleResolve = async (alertId: string, action: string) => {
    const { error } = await supabase.rpc('resolve_fraud_alert', {
      p_alert_id: alertId, p_action: action, p_notes: actionNotes || `Admin: ${action}`,
    });
    if (error) { toast.error('Error: ' + error.message); return; }
    toast.success(`Alerta ${action === 'approved' ? 'aprobada' : action === 'blocked' ? 'bloqueada' : 'puesta en revision'}`);
    setSelectedAlert(null); setActionNotes('');
    load();
  };

  const handleCarrierReview = async (alertId: string, action: string) => {
    const { error } = await supabase.rpc('admin_review_carrier_fraud', {
      p_alert_id: alertId, p_action: action, p_notes: actionNotes || `Admin: ${action}`,
    });
    if (error) { toast.error('Error: ' + error.message); return; }
    toast.success(`Accion "${action}" aplicada correctamente`);
    setSelectedAlert(null); setActionNotes('');
    load();
  };

  if (loading) return <Skeleton />;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="glass rounded-xl p-3 border border-red-500/20">
          <p className="text-[10px] text-gray-500 uppercase">Alertas Pendientes</p>
          <p className="text-xl font-bold text-red-400">{alerts.filter((a: any) => a.status === 'pending').length}</p>
        </div>
        <div className="glass rounded-xl p-3 border border-amber-500/20">
          <p className="text-[10px] text-gray-500 uppercase">En Revision</p>
          <p className="text-xl font-bold text-amber-400">{alerts.filter((a: any) => a.status === 'under_review').length}</p>
        </div>
        <div className="glass rounded-xl p-3 border border-blue-500/20">
          <p className="text-[10px] text-gray-500 uppercase">Wallets Congeladas</p>
          <p className="text-xl font-bold text-blue-400">{stats?.blocked_carriers || 0}</p>
        </div>
        <div className="glass rounded-xl p-3 border border-purple-500/20">
          <p className="text-[10px] text-gray-500 uppercase">Fondos Congelados</p>
          <p className="text-xl font-bold text-purple-400">{stats?.total_frozen_amount ? fmt(stats.total_frozen_amount) : '₡0'}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input type="text" placeholder="Buscar alertas..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-red-500/50" />
        </div>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none">
          <option value="all">Todos los tipos</option>
          <option value="client">Clientes</option>
          <option value="vendor">Negocios</option>
          <option value="carrier">Carriers</option>
          <option value="delivery">Entregas</option>
        </select>
        <select value={filterRisk} onChange={(e) => setFilterRisk(e.target.value)}
          className="px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none">
          <option value="all">Todos los riesgos</option>
          <option value="low">Bajo</option>
          <option value="medium">Medio</option>
          <option value="high">Alto</option>
          <option value="critical">Critico</option>
        </select>
      </div>

      {/* Alerts List */}
      <div className="glass rounded-2xl overflow-hidden divide-y divide-white/5">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <ShieldAlert className="w-12 h-12 text-gray-700 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Sin alertas con los filtros actuales</p>
          </div>
        ) : filtered.map((alert: any, i: number) => {
          const isCarrier = alert.alert_type?.includes('carrier') || alert.entity_type === 'delivery';
          const Icon = isCarrier ? Truck : (userTypeIcons[alert.entity_type] || Users);
          const typeColor = isCarrier ? 'purple' : alert.entity_type || 'gray';
          return (
            <motion.div key={alert.id} className="p-4 hover:bg-white/[0.03] transition-colors cursor-pointer"
              onClick={() => { setSelectedAlert(alert); setActionNotes(''); }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.02, 0.2) }}>
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl ${userTypeColors[typeColor] || 'bg-gray-500/15'} flex items-center justify-center flex-shrink-0`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium border ${riskColors[alert.severity] || riskColors.medium}`}>
                      {riskLabels[alert.severity] || alert.severity}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] ${userTypeColors[typeColor]}`}>
                      {isCarrier ? 'Carrier' : userTypeLabels[typeColor] || typeColor}
                    </span>
                    {alert.status === 'pending' && <span className="px-1.5 py-0.5 rounded text-[9px] bg-red-500/15 text-red-400">Pendiente</span>}
                  </div>
                  <p className="text-sm text-white truncate mt-1">{alert.description || alert.alert_type}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{fmtDate(alert.created_at)}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-sm font-bold ${alert.risk_score >= 70 ? 'text-red-400' : alert.risk_score >= 30 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {alert.risk_score || 0} pts
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedAlert && (
          <motion.div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedAlert(null)}>
            <motion.div className="glass-strong rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-5 border-b border-white/10">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-red-400" /> Detalle de Alerta
                </h3>
                <button onClick={() => setSelectedAlert(null)} className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="glass rounded-xl p-3">
                    <p className="text-[10px] text-gray-500">Tipo</p>
                    <p className="text-sm text-white mt-1">{selectedAlert.alert_type}</p>
                  </div>
                  <div className="glass rounded-xl p-3">
                    <p className="text-[10px] text-gray-500">Severidad</p>
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium border ${riskColors[selectedAlert.severity]}`}>
                      {riskLabels[selectedAlert.severity]}
                    </span>
                  </div>
                  <div className="glass rounded-xl p-3">
                    <p className="text-[10px] text-gray-500">Score</p>
                    <p className="text-sm font-bold text-amber-400 mt-1">{selectedAlert.risk_score} pts</p>
                  </div>
                  <div className="glass rounded-xl p-3">
                    <p className="text-[10px] text-gray-500">Fecha</p>
                    <p className="text-sm text-white mt-1">{fmtDate(selectedAlert.created_at)}</p>
                  </div>
                </div>
                {selectedAlert.description && (
                  <div className="glass rounded-xl p-3">
                    <p className="text-[10px] text-gray-500">Descripcion</p>
                    <p className="text-sm text-gray-300 mt-1">{selectedAlert.description}</p>
                  </div>
                )}
                {selectedAlert.metadata && (
                  <div className="glass rounded-xl p-3">
                    <p className="text-[10px] text-gray-500">Metadata</p>
                    <pre className="text-xs text-gray-400 mt-1 overflow-x-auto">{JSON.stringify(selectedAlert.metadata, null, 2)}</pre>
                  </div>
                )}
                <div>
                  <p className="text-[10px] text-gray-500 mb-1">Notas</p>
                  <textarea value={actionNotes} onChange={(e) => setActionNotes(e.target.value)}
                    placeholder="Agregar notas sobre la accion..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-red-500/50 resize-none h-20" />
                </div>

                {/* Actions */}
                {selectedAlert.status === 'pending' && (
                  <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => handleResolve(selectedAlert.id, 'approved')}
                      className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-medium hover:bg-emerald-500/25 transition-colors">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Aprobar
                    </button>
                    <button onClick={() => handleResolve(selectedAlert.id, 'under_review')}
                      className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-medium hover:bg-amber-500/25 transition-colors">
                      <Eye className="w-3.5 h-3.5" /> Revision
                    </button>
                    <button onClick={() => handleResolve(selectedAlert.id, 'blocked')}
                      className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-medium hover:bg-red-500/25 transition-colors">
                      <Ban className="w-3.5 h-3.5" /> Bloquear
                    </button>
                  </div>
                )}

                {/* Carrier-specific actions */}
                {selectedAlert.status === 'pending' && selectedAlert.alert_type?.includes('carrier') && (
                  <div>
                    <p className="text-[10px] text-gray-500 mb-2 uppercase">Acciones Carrier Especificas</p>
                    <div className="grid grid-cols-3 gap-2">
                      <button onClick={() => handleCarrierReview(selectedAlert.id, 'approve')}
                        className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-medium hover:bg-emerald-500/25 transition-colors">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Liberar
                      </button>
                      <button onClick={() => handleCarrierReview(selectedAlert.id, 'reject')}
                        className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-medium hover:bg-amber-500/25 transition-colors">
                        <AlertTriangle className="w-3.5 h-3.5" /> Observar
                      </button>
                      <button onClick={() => handleCarrierReview(selectedAlert.id, 'block')}
                        className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-medium hover:bg-red-500/25 transition-colors">
                        <Ban className="w-3.5 h-3.5" /> Bloquear
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// TAB 4: RETIROS
// ═══════════════════════════════════════════════════════════════════════
function WithdrawalsTab() {
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [processing, setProcessing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Load carrier withdrawals
      const { data: cw } = await supabase.from('carrier_withdrawals')
        .select('*, profiles(name, phone)')
        .order('created_at', { ascending: false }).limit(100);
      // Load vendor withdrawals
      const { data: vw } = await supabase.from('vendor_transactions')
        .select('*').eq('type', 'withdrawal').order('created_at', { ascending: false }).limit(100);
      const all = [
        ...(cw || []).map((w: any) => ({ ...w, user_type: 'carrier', user_name: w.profiles?.name })),
        ...(vw || []).map((w: any) => ({ ...w, user_type: 'vendor' })),
      ];
      all.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setWithdrawals(all);
    } catch (err) { console.error(err); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (id: string, type: string) => {
    setProcessing(id);
    try {
      if (type === 'carrier') {
        await supabase.rpc('admin_process_carrier_withdrawal', { p_withdrawal_id: id, p_approved: true });
      } else {
        await supabase.from('vendor_transactions').update({ status: 'completed' }).eq('id', id);
      }
      toast.success('Retiro aprobado correctamente');
      load();
    } catch (err: any) {
      toast.error('Error: ' + (err.message || 'Error al procesar'));
    }
    setProcessing(null);
  };

  const handleReject = async (id: string, type: string) => {
    setProcessing(id);
    try {
      if (type === 'carrier') {
        await supabase.rpc('admin_process_carrier_withdrawal', { p_withdrawal_id: id, p_approved: false, p_notes: 'Rechazado por admin' });
      } else {
        await supabase.from('vendor_transactions').update({ status: 'failed' }).eq('id', id);
      }
      toast.success('Retiro rechazado');
      load();
    } catch (err: any) {
      toast.error('Error: ' + (err.message || 'Error al procesar'));
    }
    setProcessing(null);
  };

  const filtered = filter === 'all' ? withdrawals : withdrawals.filter((w: any) => w.status === filter);

  if (loading) return <Skeleton />;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', count: withdrawals.length, numClass: 'text-gray-400' },
          { label: 'Pendientes', count: withdrawals.filter((w: any) => w.status === 'pending').length, numClass: 'text-amber-400' },
          { label: 'Completados', count: withdrawals.filter((w: any) => w.status === 'completed').length, numClass: 'text-emerald-400' },
          { label: 'Monto Total', value: fmt(withdrawals.filter((w: any) => w.status === 'completed').reduce((s: number, w: any) => s + Number(w.amount || w.net_amount || 0), 0)), numClass: 'text-cyan-400' },
        ].map((s) => (
          <div key={s.label} className="glass rounded-xl p-3">
            <p className="text-[10px] text-gray-500 uppercase">{s.label}</p>
            <p className={`text-lg font-bold ${s.numClass}`}>{s.value || s.count || 0}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 overflow-x-auto">
        {['all', 'pending', 'processing', 'completed', 'failed', 'rejected'].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${filter === s ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30' : 'bg-white/5 text-gray-400 border border-transparent hover:bg-white/10'}`}>
            {s === 'all' ? 'Todos' : withdrawalStatusLabels[s] || s}
          </button>
        ))}
      </div>

      {/* Withdrawals List */}
      <div className="glass rounded-2xl overflow-hidden divide-y divide-white/5">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <Wallet className="w-12 h-12 text-gray-700 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No hay retiros</p>
          </div>
        ) : filtered.map((w: any, i: number) => {
          const isProcessing = processing === w.id;
          return (
            <motion.div key={w.id} className="p-4"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.02, 0.2) }}>
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl ${w.user_type === 'carrier' ? 'bg-purple-500/15' : 'bg-orange-500/15'} flex items-center justify-center flex-shrink-0`}>
                  {w.user_type === 'carrier' ? <Truck className="w-5 h-5 text-purple-400" /> : <Store className="w-5 h-5 text-orange-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-white font-medium">{w.user_name || 'Usuario'}</p>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] ${w.user_type === 'carrier' ? userTypeColors.courier : userTypeColors.vendor}`}>
                      {w.user_type === 'carrier' ? 'Carrier' : 'Negocio'}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${withdrawalStatusColors[w.status]}`}>
                      {withdrawalStatusLabels[w.status]}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-[10px] text-gray-500">
                    <span className="text-emerald-400 font-medium">{fmt(w.amount || w.net_amount || 0)}</span>
                    <span>{w.withdrawal_method || 'sinpe'}</span>
                    <span>{fmtDate(w.created_at)}</span>
                  </div>
                </div>
                {w.status === 'pending' && (
                  <div className="flex gap-2 flex-shrink-0">
                    <motion.button onClick={() => handleApprove(w.id, w.user_type)} disabled={isProcessing}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors disabled:opacity-50 flex items-center gap-1"
                      whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                      Aprobar
                    </motion.button>
                    <motion.button onClick={() => handleReject(w.id, w.user_type)} disabled={isProcessing}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors disabled:opacity-50 flex items-center gap-1"
                      whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      <XCircle className="w-3 h-3" /> Rechazar
                    </motion.button>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// TAB 5: USUARIOS
// ═══════════════════════════════════════════════════════════════════════
function UsersTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [filterRole, setFilterRole] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setFetchError('No hay sesion activa');
        setLoading(false);
        return;
      }

      const res = await fetch('/api/admin/marketplace-users', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      const result = await res.json();

      if (!res.ok) {
        setFetchError(result.error || 'Error del servidor');
        setLoading(false);
        return;
      }

      setUsers(result.users || []);
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : 'Error de conexion');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const filtered = useMemo(() => {
    return users.filter((u: any) => {
      const matchRole = filterRole === 'all' || u.role === filterRole;
      const q = search.toLowerCase();
      const matchSearch = !q || (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q) || (u.phone || '').includes(q);
      return matchRole && matchSearch;
    });
  }, [users, filterRole, search]);

  const updateRole = async (userId: string, newRole: string) => {
    setUpdatingId(userId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { toast.error('No hay sesion'); return; }

      const res = await fetch('/api/admin/marketplace-users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ userId, role: newRole })
      });
      const result = await res.json();
      if (!res.ok) { toast.error(result.error || 'Error'); return; }

      setUsers((prev) => prev.map((u: any) => u.id === userId ? { ...u, role: newRole } : u));
      if (selectedUser?.id === userId) setSelectedUser({ ...selectedUser, role: newRole });
      toast.success(`Rol cambiado a: ${newRole}`);
    } catch { toast.error('Error de conexion'); }
    finally { setUpdatingId(null); }
  };

  const toggleActive = async (userId: string, isActive: boolean) => {
    setUpdatingId(userId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { toast.error('No hay sesion'); return; }

      const res = await fetch('/api/admin/marketplace-users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ userId, is_active: !isActive })
      });
      const result = await res.json();
      if (!res.ok) { toast.error(result.error || 'Error'); return; }

      setUsers((prev) => prev.map((u: any) => u.id === userId ? { ...u, is_active: !isActive } : u));
      if (selectedUser?.id === userId) setSelectedUser({ ...selectedUser, is_active: !isActive });
      toast.success(isActive ? 'Usuario desactivado' : 'Usuario activado');
    } catch { toast.error('Error de conexion'); }
    finally { setUpdatingId(null); }
  };

  const roleColors: Record<string, string> = {
    client: 'bg-cyan-500/15 text-cyan-400', driver: 'bg-blue-500/15 text-blue-400',
    vendor: 'bg-orange-500/15 text-orange-400', courier: 'bg-purple-500/15 text-purple-400',
    admin: 'bg-red-500/15 text-red-400', super_admin: 'bg-red-500/15 text-red-400',
  };
  const roleLabels: Record<string, string> = {
    client: 'Cliente', driver: 'Conductor', vendor: 'Negocio', courier: 'Carrier',
    admin: 'Admin', super_admin: 'Super Admin',
  };

  const getIcon = (role: string) => {
    const Icon = userTypeIcons[role] || Users;
    return <Icon className="w-5 h-5" />;
  };

  if (loading) return <Skeleton />;

  return (
    <div className="space-y-4">
      {/* Error Banner */}
      {fetchError && (
        <div className="rounded-xl p-4 border border-red-500/30 bg-red-500/10">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-400">Error al cargar usuarios</p>
              <p className="text-xs text-red-400/70 mt-1">{fetchError}</p>
              <button onClick={loadUsers}
                className="mt-2 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-xs hover:bg-red-500/30 transition-all flex items-center gap-1.5">
                <RefreshCw className="w-3 h-3" /> Reintentar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {['client', 'driver', 'vendor', 'courier', 'admin', 'super_admin'].map((role) => {
          const count = users.filter((u: any) => u.role === role).length;
          if (role === 'super_admin' && count === 0) return null;
          return (
            <button key={role} onClick={() => setFilterRole(filterRole === role ? 'all' : role)}
              className={`glass rounded-xl p-3 text-left transition-all ${filterRole === role ? 'border border-white/10 bg-white/5' : 'border border-transparent'}`}>
              <p className="text-[10px] text-gray-500 uppercase">{roleLabels[role] || role}</p>
              <p className={`text-xl font-bold ${roleColors[role]?.split(' ')[1] || 'text-gray-400'}`}>{count}</p>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input type="text" placeholder="Buscar por nombre, email o telefono..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50" />
        </div>
        <button onClick={loadUsers} disabled={loading}
          className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-blue-400 hover:border-blue-500/30 transition-all disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Users List */}
      <div className="glass rounded-2xl overflow-hidden divide-y divide-white/5">
        {filtered.length === 0 && !fetchError ? (
          <div className="text-center py-16">
            <Users className="w-12 h-12 text-gray-700 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No se encontraron usuarios</p>
          </div>
        ) : filtered.map((userItem: any, i: number) => {
          const isUpdating = updatingId === userItem.id;
          return (
            <motion.div key={userItem.id} className="p-4 hover:bg-white/[0.03] transition-colors"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.02, 0.15) }}>
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl ${roleColors[userItem.role] || 'bg-gray-500/15'} flex items-center justify-center flex-shrink-0`}>
                  {getIcon(userItem.role)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-white font-medium truncate">{userItem.name || 'Sin nombre'}</p>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] ${roleColors[userItem.role] || 'bg-gray-500/15 text-gray-400'}`}>
                      {roleLabels[userItem.role] || userItem.role}
                    </span>
                    {userItem.is_active === false && <span className="px-1.5 py-0.5 rounded text-[9px] bg-red-500/15 text-red-400">Inactivo</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-[10px] text-gray-500">
                    <span>{userItem.email || ''}</span>
                    {userItem.phone && <span>{userItem.phone}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="relative" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                    <select value={userItem.role}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateRole(userItem.id, e.target.value)}
                      disabled={isUpdating}
                      className={`appearance-none text-[10px] font-medium px-2.5 py-1.5 rounded-lg border pr-7 cursor-pointer focus:outline-none bg-white/5 ${roleColors[userItem.role] || 'bg-gray-500/15 text-gray-400'} disabled:opacity-50`}>
                      {Object.entries(roleLabels).map(([k, v]) => <option key={k} value={k} className="bg-gray-900">{v}</option>)}
                    </select>
                    <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
                  </div>
                  <motion.button onClick={() => toggleActive(userItem.id, userItem.is_active)}
                    disabled={isUpdating}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${userItem.is_active !== false ? 'text-red-400 bg-red-500/10 hover:bg-red-500/20' : 'text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20'}`}
                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    {isUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> :
                      userItem.is_active !== false ? <><Ban className="w-3.5 h-3.5 inline mr-1" />Bloquear</> : <><CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />Activar</>}
                  </motion.button>
                  <motion.button onClick={() => setSelectedUser(userItem)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 transition-colors"
                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Eye className="w-3.5 h-3.5" />
                  </motion.button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* User Detail Modal */}
      <AnimatePresence>
        {selectedUser && (
          <motion.div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedUser(null)}>
            <motion.div className="glass-strong rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-5 border-b border-white/10">
                <h3 className="text-lg font-bold text-white">Detalle de Usuario</h3>
                <button onClick={() => setSelectedUser(null)} className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="glass rounded-xl p-3">
                    <p className="text-[10px] text-gray-500">Nombre</p>
                    <p className="text-sm text-white mt-1">{selectedUser.name || 'N/A'}</p>
                  </div>
                  <div className="glass rounded-xl p-3">
                    <p className="text-[10px] text-gray-500">Rol</p>
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${roleColors[selectedUser.role] || 'bg-gray-500/15 text-gray-400'}`}>
                      {roleLabels[selectedUser.role] || selectedUser.role}
                    </span>
                  </div>
                  <div className="glass rounded-xl p-3">
                    <p className="text-[10px] text-gray-500">Email</p>
                    <p className="text-sm text-white mt-1 break-all">{selectedUser.email || 'N/A'}</p>
                  </div>
                  <div className="glass rounded-xl p-3">
                    <p className="text-[10px] text-gray-500">Telefono</p>
                    <p className="text-sm text-white mt-1">{selectedUser.phone || 'N/A'}</p>
                  </div>
                  <div className="glass rounded-xl p-3">
                    <p className="text-[10px] text-gray-500">Estado</p>
                    <p className={`text-sm mt-1 font-medium ${selectedUser.is_active !== false ? 'text-emerald-400' : 'text-red-400'}`}>
                      {selectedUser.is_active !== false ? 'Activo' : 'Inactivo'}
                    </p>
                  </div>
                  <div className="glass rounded-xl p-3">
                    <p className="text-[10px] text-gray-500">Verificado</p>
                    <p className={`text-sm mt-1 font-medium ${selectedUser.is_verified ? 'text-emerald-400' : 'text-gray-400'}`}>
                      {selectedUser.is_verified ? 'Si' : 'No'}
                    </p>
                  </div>
                </div>
                <div className="glass rounded-xl p-3">
                  <p className="text-[10px] text-gray-500">ID</p>
                  <p className="text-xs text-gray-400 mt-1 font-mono break-all">{selectedUser.id}</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════
export default function MarketplaceControlPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('commissions');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/20 to-purple-500/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-orange-400" />
            </div>
            Control Marketplace
          </h1>
          <p className="text-gray-400 mt-1">Comisiones, pedidos, anti-fraude, retiros y usuarios</p>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/admin" className="hover:text-white transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Panel
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-white font-medium">Control Marketplace</span>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap border ${
                isActive
                  ? `${tab.activeBg} ${tab.activeText} ${tab.activeBorder}`
                  : 'bg-white/5 text-gray-400 border-transparent hover:text-white hover:bg-white/10'
              }`}>
              <Icon className={`w-4 h-4 ${isActive ? tab.activeText : ''}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
          {activeTab === 'commissions' && <CommissionsTab />}
          {activeTab === 'orders' && <OrdersTab />}
          {activeTab === 'antifraud' && <AntiFraudTab />}
          {activeTab === 'withdrawals' && <WithdrawalsTab />}
          {activeTab === 'users' && <UsersTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
