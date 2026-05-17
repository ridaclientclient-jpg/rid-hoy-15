'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DollarSign, TrendingUp, Zap, Save, Info, Percent,
  Calculator, Wallet, TrendingDown, RefreshCw, ArrowLeft, ChevronRight,
  ShoppingCart, Users, Clock, CheckCircle2, XCircle, AlertTriangle,
  ArrowDownCircle, Layers, Shield, Timer, Eye, X, ChevronDown
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import type { WithdrawalRequest } from '@/lib/supabase';

function PricingLoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="glass rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/5" />
              <div>
                <div className="h-3 w-28 bg-white/5 rounded mb-1" />
                <div className="h-5 w-20 bg-white/5 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="h-5 w-36 bg-white/5 rounded mb-1" />
                  <div className="h-3 w-48 bg-white/5 rounded" />
                </div>
                <div className="h-8 w-20 bg-white/5 rounded" />
              </div>
              <div className="h-2 w-full bg-white/5 rounded-full" />
              <div className="flex justify-between mt-2">
                <div className="h-3 w-12 bg-white/5 rounded" />
                <div className="h-3 w-14 bg-white/5 rounded" />
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-4">
          <div className="glass rounded-2xl p-5">
            <div className="h-5 w-32 bg-white/5 rounded mb-1" />
            <div className="h-3 w-40 bg-white/5 rounded mb-4" />
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-3 w-20 bg-white/5 rounded" />
                  <div className="flex-1 h-3 bg-white/5 rounded-full" />
                  <div className="h-3 w-6 bg-white/5 rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type ZoneRideCount = { zone: string; count: number };

export default function PricingPage() {
  const [basePrice, setBasePrice] = useState(1500);
  const [pricePerKm, setPricePerKm] = useState(500);
  const [pricePerMin, setPricePerMin] = useState(50);
  const [commission, setCommission] = useState(15);
  const [baseFee, setBaseFee] = useState(200);
  const [surgeEnabled, setSurgeEnabled] = useState(true);
  const [surgeMultiplier, setSurgeMultiplier] = useState(1.5);
  const [surgeThreshold, setSurgeThreshold] = useState(5);
  const [surgeNightMultiplier, setSurgeNightMultiplier] = useState(1.3);
  const [surgeNightStart, setSurgeNightStart] = useState(22);
  const [surgeNightEnd, setSurgeNightEnd] = useState(6);
  const [surgeWeatherMultiplier, setSurgeWeatherMultiplier] = useState(1.2);
  const [surgeMaxMultiplier, setSurgeMaxMultiplier] = useState(3.0);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Marketplace commission
  const [marketComm, setMarketComm] = useState(15);
  const [minWithdrawal, setMinWithdrawal] = useState(10000);
  const [withdrawalStep, setWithdrawalStep] = useState(10000);
  const [withdrawalDelay, setWithdrawalDelay] = useState(48);
  const [batchSize, setBatchSize] = useState(5);

  // Commission stats
  const [totalCommission, setTotalCommission] = useState(0);
  const [totalDriverEarnings, setTotalDriverEarnings] = useState(0);
  const [totalRidesCompleted, setTotalRidesCompleted] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);

  // Marketplace stats
  const [rawVendorEarnings, setRawVendorEarnings] = useState(0);
  const [totalVendorEarnings, setTotalVendorEarnings] = useState(0);
  const [totalMarketDeliveries, setTotalMarketDeliveries] = useState(0);
  const [marketStatsLoading, setMarketStatsLoading] = useState(true);

  // Derive totalMarketCommission from rawVendorEarnings + marketComm (no useEffect re-trigger)
  const totalMarketCommission = useMemo(() => {
    if (rawVendorEarnings > 0 && marketComm > 0 && marketComm < 100) {
      return Math.round(rawVendorEarnings * marketComm / (100 - marketComm));
    }
    return 0;
  }, [rawVendorEarnings, marketComm]);

  // Real zone ride data
  const [zoneRideCounts, setZoneRideCounts] = useState<ZoneRideCount[]>([]);
  const [zoneDataLoading, setZoneDataLoading] = useState(true);

  // Withdrawal queue
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [withdrawalsLoading, setWithdrawalsLoading] = useState(true);
  const [showQueue, setShowQueue] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'rides' | 'marketplace'>('rides');

  const formatColones = (val: number) => `₡${Math.round(val).toLocaleString()}`;

  // ── Load settings from DB on mount ──────────────────────────────

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: settings, error } = await supabase
        .from('settings')
        .select('key, value');

      if (!error && settings) {
        const get = (key: string, fallback: number) =>
          Number(settings.find((s: any) => s.key === key)?.value ?? fallback);

        setBasePrice(get('base_price', 1500));
        setPricePerKm(get('price_per_km', 500));
        setPricePerMin(get('price_per_min', 50));
        setSurgeEnabled(get('surge_enabled', 1) === 1);
        setSurgeMultiplier(get('surge_multiplier', 1.5));
        setSurgeThreshold(get('surge_threshold', 5));
        setSurgeNightMultiplier(get('surge_night_multiplier', 1.3));
        setSurgeNightStart(get('surge_night_start', 22));
        setSurgeNightEnd(get('surge_night_end', 6));
        setSurgeWeatherMultiplier(get('surge_weather_multiplier', 1.2));
        setSurgeMaxMultiplier(get('surge_max_multiplier', 3.0));
        setCommission(get('commission_percentage', 15));
        setBaseFee(get('base_fee', 200));

        // Marketplace settings
        setMarketComm(get('marketplace_commission_pct', 15));
        setMinWithdrawal(get('marketplace_min_withdrawal', 10000));
        setWithdrawalStep(get('withdrawal_step', 10000));
        setWithdrawalDelay(get('withdrawal_delay_hours', 48));
        setBatchSize(get('withdrawals_per_batch', 5));
      }
    } catch (err) {
      console.error('Error loading settings:', err);
    }
    setIsLoading(false);
  }, []);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const { data: rides, error } = await supabase
        .from('rides')
        .select('price, commission, driver_earnings')
        .eq('status', 'completed');

      if (!error && rides) {
        setTotalRidesCompleted(rides.length);
        setTotalCommission(rides.reduce((sum, r) => sum + (Number(r.commission) || 0), 0));
        setTotalDriverEarnings(rides.reduce((sum, r) => sum + (Number(r.driver_earnings) || 0), 0));
      }
    } catch (err) {
      console.error('Error loading commission stats:', err);
    }
    setStatsLoading(false);
  }, []);

  const loadMarketStats = useCallback(async () => {
    setMarketStatsLoading(true);
    try {
      const { data: txns, error } = await supabase
        .from('vendor_transactions')
        .select('amount, type');

      if (!error && txns) {
        const earnings = txns.filter((t: any) => t.type === 'earning');
        const total = earnings.reduce((sum, t: any) => sum + (Number(t.amount) || 0), 0);
        setRawVendorEarnings(total);
        setTotalVendorEarnings(total);
        setTotalMarketDeliveries(earnings.length);
      }
    } catch (err) {
      console.error('Error loading market stats:', err);
    }
    setMarketStatsLoading(false);
  }, []);

  const loadWithdrawals = useCallback(async () => {
    setWithdrawalsLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_withdrawal_queue');
      if (!error && data) {
        setWithdrawals(data as WithdrawalRequest[]);
      }
    } catch (err) {
      console.error('Error loading withdrawals:', err);
    }
    setWithdrawalsLoading(false);
  }, []);

  const loadZoneData = useCallback(async () => {
    setZoneDataLoading(true);
    try {
      const { data, error } = await supabase
        .from('rides')
        .select('origin_zone')
        .not('origin_zone', 'is', null);

      if (!error && data) {
        const counts: Record<string, number> = {};
        data.forEach((r: any) => {
          const zone = r.origin_zone;
          if (zone) {
            counts[zone] = (counts[zone] || 0) + 1;
          }
        });
        const sorted = Object.entries(counts)
          .map(([zone, count]) => ({ zone, count }))
          .sort((a, b) => b.count - a.count);
        setZoneRideCounts(sorted);
      }
    } catch (err) {
      console.error('Error loading zone data:', err);
    }
    setZoneDataLoading(false);
  }, []);

  useEffect(() => {
    loadSettings();
    loadStats();
    loadMarketStats();
    loadWithdrawals();
    loadZoneData();
  }, [loadSettings, loadStats, loadMarketStats, loadWithdrawals, loadZoneData]);

  // ── Calculate estimates ─────────────────────────────────────────

  const estimatedFare = (km: number, min: number) => {
    return Math.round(basePrice + km * pricePerKm + min * pricePerMin);
  };

  const estimatedCommission = (km: number, min: number) => {
    const fare = estimatedFare(km, min);
    return Math.round(fare * commission / 100) + baseFee;
  };

  const estimatedDriverEarning = (km: number, min: number) => {
    const fare = estimatedFare(km, min);
    const comm = estimatedCommission(km, min);
    return Math.max(0, fare - comm);
  };

  // ── Save settings to DB ─────────────────────────────────────────

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const settingsData = [
        { key: 'base_price', value: String(basePrice) },
        { key: 'price_per_km', value: String(pricePerKm) },
        { key: 'price_per_min', value: String(pricePerMin) },
        { key: 'surge_enabled', value: surgeEnabled ? '1' : '0' },
        { key: 'surge_multiplier', value: String(surgeMultiplier) },
        { key: 'surge_threshold', value: String(surgeThreshold) },
        { key: 'surge_night_multiplier', value: String(surgeNightMultiplier) },
        { key: 'surge_night_start', value: String(surgeNightStart) },
        { key: 'surge_night_end', value: String(surgeNightEnd) },
        { key: 'surge_weather_multiplier', value: String(surgeWeatherMultiplier) },
        { key: 'surge_max_multiplier', value: String(surgeMaxMultiplier) },
        { key: 'commission_percentage', value: String(commission) },
        { key: 'base_fee', value: String(baseFee) },
        { key: 'marketplace_commission_pct', value: String(marketComm) },
        { key: 'marketplace_min_withdrawal', value: String(minWithdrawal) },
        { key: 'withdrawal_step', value: String(withdrawalStep) },
        { key: 'withdrawal_delay_hours', value: String(withdrawalDelay) },
        { key: 'withdrawals_per_batch', value: String(batchSize) },
      ];

      for (const setting of settingsData) {
        await supabase
          .from('settings')
          .upsert(setting, { onConflict: 'key' });
      }

      toast.success('Configuracion guardada correctamente', {
        description: `Comision RIDA: ${commission}% + Comision Marketplace: ${marketComm}%`,
      });
    } catch (err) {
      console.error('Error saving settings:', err);
      toast.error('Error al guardar la configuracion');
    }
    setIsSaving(false);
  };

  // ── Process withdrawals ────────────────────────────────────────

  const handleProcessBatch = async () => {
    setProcessing(true);
    try {
      const { data, error } = await supabase.rpc('process_next_withdrawals', { p_count: batchSize });
      if (error) throw error;
      const result = data as any;
      toast.success(`Lote procesado: ${result.processed} retiros completados`);
      await loadWithdrawals();
    } catch (err: any) {
      console.error('Error processing batch:', err);
      toast.error('Error al procesar lote');
    }
    setProcessing(false);
  };

  const queuedCount = withdrawals.filter(w => w.status === 'queued').length;
  const processingCount = withdrawals.filter(w => w.status === 'processing').length;
  const totalInQueue = withdrawals.filter(w => ['queued', 'processing'].includes(w.status))
    .reduce((sum, w) => sum + Number(w.amount), 0);

  // ── Render ──────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-white">Configuracion de Precios</h1>
          <p className="text-gray-400 mt-1">Ajusta las tarifas, comisiones y sistema de retiros</p>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
        <Link href="/admin" className="hover:text-white transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          Panel
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-white font-medium">Precios y Tarifas</span>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('rides')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            activeTab === 'rides'
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
              : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-transparent'
          }`}
        >
          <span className="flex items-center gap-2">
            <Zap className="w-4 h-4" /> Viajes
          </span>
        </button>
        <button
          onClick={() => setActiveTab('marketplace')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            activeTab === 'marketplace'
              ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
              : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-transparent'
          }`}
        >
          <span className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" /> Marketplace
          </span>
        </button>
      </div>

      {isLoading ? (
        <PricingLoadingSkeleton />
      ) : activeTab === 'rides' ? (
        /* ═══════════════════ RIDES TAB ═══════════════════ */
        <>
          {/* Commission Stats Banner */}
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-3 gap-4"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="glass rounded-2xl p-4 border border-amber-500/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-[11px] text-gray-500 uppercase tracking-wider">Comision Total</p>
                  <p className="text-lg font-bold text-amber-400">
                    {statsLoading ? '...' : formatColones(totalCommission)}
                  </p>
                </div>
              </div>
            </div>
            <div className="glass rounded-2xl p-4 border border-emerald-500/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-[11px] text-gray-500 uppercase tracking-wider">Ganancias Conductores</p>
                  <p className="text-lg font-bold text-emerald-400">
                    {statsLoading ? '...' : formatColones(totalDriverEarnings)}
                  </p>
                </div>
              </div>
            </div>
            <div className="glass rounded-2xl p-4 border border-cyan-500/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/15 flex items-center justify-center">
                  <Calculator className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <p className="text-[11px] text-gray-500 uppercase tracking-wider">Viajes Completados</p>
                  <p className="text-lg font-bold text-cyan-400">
                    {statsLoading ? '...' : totalRidesCompleted.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Pricing Controls */}
            <div className="xl:col-span-2 space-y-4">
              {/* Base Price */}
              <motion.div className="glass rounded-2xl p-6" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-cyan-400" />
                      Precio Base
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">Tarifa minima por iniciar un viaje</p>
                  </div>
                  <div className="text-2xl font-bold text-cyan-400">{formatColones(basePrice)}</div>
                </div>
                <input type="range" min={500} max={5000} step={100} value={basePrice}
                  onChange={(e) => setBasePrice(Number(e.target.value))}
                  className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-cyan-500" />
                <div className="flex justify-between mt-2 text-xs text-gray-500">
                  <span>₡500</span><span>₡5,000</span>
                </div>
              </motion.div>

              {/* Price per KM */}
              <motion.div className="glass rounded-2xl p-6" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-cyan-400" />
                      Precio por Kilometro
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">Costo adicional por cada KM recorrido</p>
                  </div>
                  <div className="text-2xl font-bold text-cyan-400">{formatColones(pricePerKm)}</div>
                </div>
                <input type="range" min={100} max={2000} step={50} value={pricePerKm}
                  onChange={(e) => setPricePerKm(Number(e.target.value))}
                  className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-cyan-500" />
                <div className="flex justify-between mt-2 text-xs text-gray-500">
                  <span>₡100</span><span>₡2,000</span>
                </div>
              </motion.div>

              {/* Price per Minute */}
              <motion.div className="glass rounded-2xl p-6" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-cyan-400" />
                      Precio por Minuto
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">Costo por minuto de espera o trafico</p>
                  </div>
                  <div className="text-2xl font-bold text-cyan-400">{formatColones(pricePerMin)}</div>
                </div>
                <input type="range" min={10} max={200} step={10} value={pricePerMin}
                  onChange={(e) => setPricePerMin(Number(e.target.value))}
                  className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-cyan-500" />
                <div className="flex justify-between mt-2 text-xs text-gray-500">
                  <span>₡10</span><span>₡200</span>
                </div>
              </motion.div>

              {/* Commission Section */}
              <motion.div className="glass rounded-2xl p-6 border border-amber-500/20" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <div className="flex items-center gap-2 mb-4">
                  <Percent className="w-5 h-5 text-amber-400" />
                  <h3 className="text-lg font-semibold text-white">Comision de RIDA</h3>
                </div>
                <p className="text-xs text-gray-500 mb-5">Porcentaje + cuota fija que retiene la plataforma por cada viaje completado. El conductor recibe el resto.</p>

                <div className="mb-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-medium text-gray-300">Porcentaje de comision</p>
                      <p className="text-[10px] text-gray-600">Se aplica sobre el precio total del viaje</p>
                    </div>
                    <div className="text-2xl font-bold text-amber-400">{commission}%</div>
                  </div>
                  <input type="range" min={5} max={40} step={1} value={commission}
                    onChange={(e) => setCommission(Number(e.target.value))}
                    className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-amber-500" />
                  <div className="flex justify-between mt-2 text-xs text-gray-500">
                    <span>5%</span><span>40%</span>
                  </div>
                </div>

                <div className="mb-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-medium text-gray-300">Cuota fija por viaje</p>
                      <p className="text-[10px] text-gray-600">Se suma al porcentaje (costo operacional)</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-500">₡</span>
                      <input type="number" min={0} max={2000} step={50} value={baseFee}
                        onChange={(e) => setBaseFee(Math.max(0, Number(e.target.value)))}
                        className="w-24 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-right text-base font-bold text-amber-400 focus:outline-none focus:border-amber-500" />
                    </div>
                  </div>
                  <input type="range" min={0} max={2000} step={50} value={baseFee}
                    onChange={(e) => setBaseFee(Number(e.target.value))}
                    className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-amber-500" />
                  <div className="flex justify-between mt-2 text-xs text-gray-500">
                    <span>₡0</span><span>₡2,000</span>
                  </div>
                </div>

                <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-4">
                  <p className="text-xs font-medium text-amber-400 mb-2 flex items-center gap-1.5">
                    <Calculator className="w-3.5 h-3.5" />
                    Formula de comision
                  </p>
                  <div className="text-xs text-gray-400 space-y-1">
                    <p><span className="text-gray-300">Comision</span> = (Precio del viaje x {commission}%) + ₡{baseFee}</p>
                    <p><span className="text-gray-300">Ganancia conductor</span> = Precio del viaje - Comision</p>
                  </div>
                </div>
              </motion.div>

              {/* ═════ SURGE PRICING SECTION ═════ */}
              <motion.div className="glass rounded-2xl p-6 border border-amber-500/20" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                {/* Header with toggle */}
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <Zap className="w-5 h-5 text-amber-400" />
                      Precios Dinamicos (Surge)
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">Multiplicadores de precio por alta demanda, horario y clima</p>
                  </div>
                  <button type="button" onClick={() => setSurgeEnabled(!surgeEnabled)}
                    className={`relative w-14 h-7 rounded-full transition-colors duration-300 ${surgeEnabled ? 'bg-amber-500' : 'bg-white/10'}`}>
                    <motion.div className="absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md"
                      animate={{ left: surgeEnabled ? 'calc(100% - 26px)' : '2px' }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
                  </button>
                </div>

                <AnimatePresence>
                  {surgeEnabled && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      {/* 1. Surge Multiplier */}
                      <div className="mb-6">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="text-sm font-medium text-gray-300 flex items-center gap-1.5">
                              <TrendingUp className="w-4 h-4 text-amber-400" />
                              Multiplicador por Alta Demanda
                            </p>
                            <p className="text-[10px] text-gray-600">Se aplica cuando hay mas solicitudes que conductores disponibles</p>
                          </div>
                          <div className="text-2xl font-bold text-amber-400">{surgeMultiplier.toFixed(1)}x</div>
                        </div>
                        <input type="range" min={10} max={surgeMaxMultiplier * 10} step={1} value={Math.round(surgeMultiplier * 10)}
                          onChange={(e) => setSurgeMultiplier(Number(e.target.value) / 10)}
                          className="w-full h-3 bg-white/10 rounded-full appearance-none cursor-pointer accent-amber-500" />
                        <div className="flex justify-between mt-2 text-xs text-gray-500">
                          <span>1.0x (normal)</span>
                          <span>1.5x</span>
                          <span>2.0x</span>
                          <span>{surgeMaxMultiplier.toFixed(1)}x (max)</span>
                        </div>
                      </div>

                      {/* 2. Demand Threshold */}
                      <div className="mb-6">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="text-sm font-medium text-gray-300 flex items-center gap-1.5">
                              <Users className="w-4 h-4 text-cyan-400" />
                              Umbral de Activacion
                            </p>
                            <p className="text-[10px] text-gray-600">Cantidad de solicitudes sin atender para activar surge</p>
                          </div>
                          <div className="text-2xl font-bold text-cyan-400">{surgeThreshold}</div>
                        </div>
                        <input type="range" min={2} max={20} step={1} value={surgeThreshold}
                          onChange={(e) => setSurgeThreshold(Number(e.target.value))}
                          className="w-full h-3 bg-white/10 rounded-full appearance-none cursor-pointer accent-cyan-500" />
                        <div className="flex justify-between mt-2 text-xs text-gray-500">
                          <span>2 solicitudes</span>
                          <span>10</span>
                          <span>20 solicitudes</span>
                        </div>
                      </div>

                      {/* 3. Night Surcharge */}
                      <div className="mb-6">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="text-sm font-medium text-gray-300 flex items-center gap-1.5">
                              <Clock className="w-4 h-4 text-purple-400" />
                              Recargo Nocturno
                            </p>
                            <p className="text-[10px] text-gray-600">Multiplicador extra durante horas de la noche</p>
                          </div>
                          <div className="text-2xl font-bold text-purple-400">{surgeNightMultiplier.toFixed(1)}x</div>
                        </div>
                        <input type="range" min={10} max={30} step={1} value={Math.round(surgeNightMultiplier * 10)}
                          onChange={(e) => setSurgeNightMultiplier(Number(e.target.value) / 10)}
                          className="w-full h-3 bg-white/10 rounded-full appearance-none cursor-pointer accent-purple-500" />
                        <div className="flex justify-between mt-2 text-xs text-gray-500">
                          <span>1.0x (sin recargo)</span>
                          <span>1.5x</span>
                          <span>2.0x</span>
                          <span>3.0x</span>
                        </div>

                        {/* Night Schedule */}
                        <div className="mt-4 grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-gray-400 mb-2">Hora de inicio</p>
                            <div className="flex items-center gap-2">
                              <input type="range" min={18} max={23} step={1} value={surgeNightStart}
                                onChange={(e) => setSurgeNightStart(Number(e.target.value))}
                                className="flex-1 h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-purple-500" />
                              <span className="text-sm font-bold text-purple-400 w-10 text-right">{surgeNightStart}:00</span>
                            </div>
                            <div className="flex justify-between mt-1 text-[10px] text-gray-600">
                              <span>18:00</span><span>23:00</span>
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400 mb-2">Hora de fin</p>
                            <div className="flex items-center gap-2">
                              <input type="range" min={4} max={10} step={1} value={surgeNightEnd}
                                onChange={(e) => setSurgeNightEnd(Number(e.target.value))}
                                className="flex-1 h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-purple-500" />
                              <span className="text-sm font-bold text-purple-400 w-10 text-right">{surgeNightEnd}:00</span>
                            </div>
                            <div className="flex justify-between mt-1 text-[10px] text-gray-600">
                              <span>04:00</span><span>10:00</span>
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 bg-purple-500/10 border border-purple-500/20 rounded-lg px-3 py-2">
                          <p className="text-[10px] text-purple-300 text-center">
                            Recargo nocturno activo de {surgeNightStart}:00 a {surgeNightEnd}:00
                          </p>
                        </div>
                      </div>

                      {/* 4. Weather Surcharge */}
                      <div className="mb-6">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="text-sm font-medium text-gray-300 flex items-center gap-1.5">
                              <AlertTriangle className="w-4 h-4 text-blue-400" />
                              Recargo por Clima Adverso
                            </p>
                            <p className="text-[10px] text-gray-600">Multiplicador para lluvia fuerte o condiciones peligrosas</p>
                          </div>
                          <div className="text-2xl font-bold text-blue-400">{surgeWeatherMultiplier.toFixed(1)}x</div>
                        </div>
                        <input type="range" min={10} max={25} step={1} value={Math.round(surgeWeatherMultiplier * 10)}
                          onChange={(e) => setSurgeWeatherMultiplier(Number(e.target.value) / 10)}
                          className="w-full h-3 bg-white/10 rounded-full appearance-none cursor-pointer accent-blue-500" />
                        <div className="flex justify-between mt-2 text-xs text-gray-500">
                          <span>1.0x (sin recargo)</span>
                          <span>1.5x</span>
                          <span>2.0x</span>
                          <span>2.5x</span>
                        </div>
                      </div>

                      {/* 5. Max Multiplier Cap */}
                      <div className="mb-6">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="text-sm font-medium text-gray-300 flex items-center gap-1.5">
                              <Shield className="w-4 h-4 text-red-400" />
                              Multiplicador Maximo Permitido
                            </p>
                            <p className="text-[10px] text-gray-600">Limite superior para proteger al cliente de precios excesivos</p>
                          </div>
                          <div className="text-2xl font-bold text-red-400">{surgeMaxMultiplier.toFixed(1)}x</div>
                        </div>
                        <input type="range" min={15} max={50} step={5} value={Math.round(surgeMaxMultiplier * 10)}
                          onChange={(e) => setSurgeMaxMultiplier(Number(e.target.value) / 10)}
                          className="w-full h-3 bg-white/10 rounded-full appearance-none cursor-pointer accent-red-500" />
                        <div className="flex justify-between mt-2 text-xs text-gray-500">
                          <span>1.5x</span>
                          <span>2.5x</span>
                          <span>3.5x</span>
                          <span>5.0x</span>
                        </div>
                      </div>

                      {/* Live Example */}
                      <div className="bg-gradient-to-br from-amber-500/5 to-purple-500/5 border border-amber-500/20 rounded-xl p-4">
                        <p className="text-xs font-medium text-amber-400 mb-3 flex items-center gap-1.5">
                          <Calculator className="w-3.5 h-3.5" />
                          Ejemplo en Vivo - Viaje de 10km / 20min
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="bg-black/20 rounded-lg p-3 text-center">
                            <p className="text-[10px] text-gray-500 mb-1">Precio Normal</p>
                            <p className="text-base font-bold text-white">{formatColones(estimatedFare(10, 20))}</p>
                          </div>
                          <div className="bg-amber-500/10 rounded-lg p-3 text-center">
                            <p className="text-[10px] text-amber-300 mb-1">Con Surge ({surgeMultiplier.toFixed(1)}x)</p>
                            <p className="text-base font-bold text-amber-400">{formatColones(estimatedFare(10, 20) * surgeMultiplier)}</p>
                          </div>
                          <div className="bg-purple-500/10 rounded-lg p-3 text-center">
                            <p className="text-[10px] text-purple-300 mb-1">Nocturno ({surgeNightMultiplier.toFixed(1)}x)</p>
                            <p className="text-base font-bold text-purple-400">{formatColones(estimatedFare(10, 20) * surgeNightMultiplier)}</p>
                          </div>
                          <div className="bg-red-500/10 rounded-lg p-3 text-center">
                            <p className="text-[10px] text-red-300 mb-1">Maximo ({surgeMaxMultiplier.toFixed(1)}x)</p>
                            <p className="text-base font-bold text-red-400">{formatColones(estimatedFare(10, 20) * surgeMaxMultiplier)}</p>
                          </div>
                        </div>
                        <div className="mt-3 bg-black/20 rounded-lg p-3">
                          <p className="text-[10px] text-gray-500 mb-1">Peor escenario: Surge + Nocturno + Clima</p>
                          <p className="text-lg font-bold text-red-400 text-center">
                            {formatColones(estimatedFare(10, 20) * surgeMultiplier * surgeNightMultiplier * surgeWeatherMultiplier)}
                            <span className="text-[10px] text-gray-500 ml-2">
                              ({surgeMultiplier.toFixed(1)}x x {surgeNightMultiplier.toFixed(1)}x x {surgeWeatherMultiplier.toFixed(1)}x)
                            </span>
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {!surgeEnabled && (
                  <div className="bg-white/5 rounded-xl p-4 text-center">
                    <p className="text-xs text-gray-500">
                      Los precios dinamicos estan desactivados. Todos los viajes usan la tarifa base.
                    </p>
                  </div>
                )}
              </motion.div>

              {/* Save Button */}
              <motion.button type="button" onClick={handleSave} disabled={isSaving}
                className="w-full py-3.5 rounded-xl btn-neon text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
                {isSaving ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Guardando...</>
                ) : (
                  <><Save className="w-4 h-4" /> Guardar Cambios</>
                )}
              </motion.button>
            </div>

            {/* Right Panel */}
            <div className="space-y-4">
              {/* Zone Data */}
              <motion.div className="glass rounded-2xl p-5" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-400" />
                  Demanda por Zona
                </h3>
                <p className="text-xs text-gray-500 mb-4">Viajes agrupados por zona de origen</p>
                {zoneDataLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-4 h-4 border-2 border-white/20 border-t-cyan-400 rounded-full animate-spin" />
                  </div>
                ) : zoneRideCounts.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-xs text-gray-500">No hay datos de viajes por zona aun.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {zoneRideCounts.map((z) => {
                      const maxCount = zoneRideCounts[0]?.count || 1;
                      const pct = Math.round((z.count / maxCount) * 100);
                      let barColor = 'bg-emerald-500';
                      if (pct >= 75) barColor = 'bg-red-500';
                      else if (pct >= 50) barColor = 'bg-orange-500';
                      else if (pct >= 25) barColor = 'bg-amber-500';
                      return (
                        <div key={z.zone} className="flex items-center gap-3">
                          <span className="text-[11px] text-gray-400 w-24 truncate" title={z.zone}>{z.zone}</span>
                          <div className="flex-1 h-3 rounded-full bg-white/5 overflow-hidden">
                            <motion.div className={`h-full rounded-full ${barColor}`}
                              initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.5, delay: 0.1 }} />
                          </div>
                          <span className="text-[11px] font-semibold text-gray-300 w-8 text-right">{z.count}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>

              {/* Fare Estimates */}
              <motion.div className="glass rounded-2xl p-5" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
                  <Info className="w-5 h-5 text-cyan-400" />
                  Desglose por Viaje
                </h3>
                <p className="text-xs text-gray-500 mb-4">Comision y ganancia estimada con la configuracion actual</p>
                <div className="space-y-3">
                  {[
                    { label: 'Corto', km: 5, min: 10 },
                    { label: 'Medio', km: 10, min: 22 },
                    { label: 'Largo', km: 20, min: 40 },
                    { label: 'Aeropuerto', km: 25, min: 35 },
                  ].map((est) => {
                    const fare = estimatedFare(est.km, est.min);
                    const comm = estimatedCommission(est.km, est.min);
                    const driver = estimatedDriverEarning(est.km, est.min);
                    const driverPct = fare > 0 ? Math.round((driver / fare) * 100) : 0;
                    return (
                      <div key={est.label} className="bg-white/5 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-medium text-gray-300">{est.label}</p>
                            <p className="text-[10px] text-gray-600">{est.km} km / {est.min} min</p>
                          </div>
                          <p className="text-sm font-bold text-white">{formatColones(fare)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                            <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.round(((comm / fare) * 100) || 0)}%` }} />
                          </div>
                          <div className="h-2 w-px bg-white/10" />
                          <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${driverPct}%` }} />
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-amber-400 flex items-center gap-1"><TrendingDown className="w-3 h-3" /> RIDA: {formatColones(comm)}</span>
                          <span className="text-emerald-400 flex items-center gap-1"><Wallet className="w-3 h-3" /> Conductor: {formatColones(driver)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>

              {/* Refresh Stats */}
              <motion.button type="button" onClick={() => { loadStats(); loadZoneData(); }}
                className="w-full glass rounded-xl p-3 text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-colors flex items-center justify-center gap-2"
                whileTap={{ scale: 0.98 }}>
                <RefreshCw className="w-3.5 h-3.5" /> Actualizar estadisticas
              </motion.button>
            </div>
          </div>
        </>
      ) : (
        /* ═══════════════════ MARKETPLACE TAB ═══════════════════ */
        <>
          {/* Marketplace Stats */}
          <motion.div className="grid grid-cols-1 sm:grid-cols-3 gap-4" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
            <div className="glass rounded-2xl p-4 border border-orange-500/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/15 flex items-center justify-center">
                  <ShoppingCart className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <p className="text-[11px] text-gray-500 uppercase tracking-wider">Comision Marketplace</p>
                  <p className="text-lg font-bold text-orange-400">
                    {marketStatsLoading ? '...' : formatColones(totalMarketCommission)}
                  </p>
                </div>
              </div>
            </div>
            <div className="glass rounded-2xl p-4 border border-emerald-500/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                  <Layers className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-[11px] text-gray-500 uppercase tracking-wider">Ganancias Negocios</p>
                  <p className="text-lg font-bold text-emerald-400">
                    {marketStatsLoading ? '...' : formatColones(totalVendorEarnings)}
                  </p>
                </div>
              </div>
            </div>
            <div className="glass rounded-2xl p-4 border border-purple-500/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/15 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-[11px] text-gray-500 uppercase tracking-wider">Pedidos Completados</p>
                  <p className="text-lg font-bold text-purple-400">
                    {marketStatsLoading ? '...' : totalMarketDeliveries.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 space-y-4 relative z-10">

              {/* ═══ MARKETPLACE COMMISSION SLIDER ═══ */}
              <div className="glass rounded-2xl p-6 border border-orange-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <ShoppingCart className="w-5 h-5 text-orange-400" />
                  <h3 className="text-lg font-semibold text-white">Comision de Marketplace</h3>
                </div>
                <p className="text-xs text-gray-500 mb-5">
                  Porcentaje que la plataforma cobra a cada negocio por pedido completado.
                  El pago se divide automaticamente: comision para RIDA + el resto para el negocio.
                </p>

                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-medium text-gray-300">Porcentaje de comision</p>
                      <p className="text-[10px] text-gray-600">Se aplica automaticamente al completar cada pedido</p>
                    </div>
                    <div className="text-3xl font-bold text-orange-400">{marketComm}%</div>
                  </div>
                  <input type="range" min={0} max={100} step={1} value={marketComm}
                    onChange={(e) => setMarketComm(Number(e.target.value))}
                    className="w-full h-3 bg-white/10 rounded-full cursor-pointer accent-orange-500" />
                  <div className="flex justify-between mt-2 text-xs text-gray-500">
                    <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
                  </div>
                </div>

                {/* Live Example */}
                <div className="bg-orange-500/5 border border-orange-500/15 rounded-xl p-4">
                  <p className="text-xs font-medium text-orange-400 mb-3 flex items-center gap-1.5">
                    <Calculator className="w-3.5 h-3.5" />
                    Ejemplo con pedido de ₡10,000
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-black/20 rounded-lg p-3">
                      <p className="text-[10px] text-gray-500 mb-1">Total del pedido</p>
                      <p className="text-lg font-bold text-white">₡10,000</p>
                    </div>
                    <div className="bg-orange-500/10 rounded-lg p-3">
                      <p className="text-[10px] text-orange-300 mb-1">RIDA ({marketComm}%)</p>
                      <p className="text-lg font-bold text-orange-400">₡{(10000 * marketComm / 100).toLocaleString()}</p>
                    </div>
                    <div className="bg-emerald-500/10 rounded-lg p-3 col-span-2">
                      <p className="text-[10px] text-emerald-300 mb-1">Negocio recibe</p>
                      <p className="text-lg font-bold text-emerald-400">₡{(10000 * (100 - marketComm) / 100).toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                {/* Payment Methods Explanation */}
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-cyan-500/5 border border-cyan-500/15 rounded-xl p-3">
                    <p className="text-xs font-medium text-cyan-400 flex items-center gap-1.5 mb-1">
                      <Shield className="w-3 h-3" /> Pago con Tarjeta
                    </p>
                    <p className="text-[10px] text-gray-400">
                      La comision se divide automaticamente al completar el pedido.
                      La plataforma retiene su porcentaje y el resto va a la billetera del negocio.
                    </p>
                  </div>
                  <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-3">
                    <p className="text-xs font-medium text-amber-400 flex items-center gap-1.5 mb-1">
                      <DollarSign className="w-3 h-3" /> Pago en Efectivo
                    </p>
                    <p className="text-[10px] text-gray-400">
                      Si el repartidor cobra en efectivo, el sistema registra la comision pendiente del negocio.
                      El repartidor retiene el envio y la comision del negocio queda como deuda.
                    </p>
                  </div>
                </div>
              </div>

              {/* ═══ WITHDRAWAL QUEUE CONFIG ═══ */}
              <div className="glass rounded-2xl p-6 border border-purple-500/20">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Timer className="w-5 h-5 text-purple-400" />
                    <h3 className="text-lg font-semibold text-white">Sistema de Retiros</h3>
                  </div>
                  <button
                    onClick={() => { setShowQueue(!showQueue); if (!showQueue) loadWithdrawals(); }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-500/15 text-purple-400 hover:bg-purple-500/25 transition-colors flex items-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Ver Fila de Retiros
                    <span className={`transition-transform ${showQueue ? 'rotate-180' : ''}`}>
                      <ChevronDown className="w-3 h-3" />
                    </span>
                  </button>
                </div>
                <p className="text-xs text-gray-500 mb-5">
                  Los repartidores pueden retirar su dinero de envios pagados con tarjeta despues de 48 horas.
                  Se usa un sistema de fila para evitar que todos retiren al mismo tiempo por seguridad.
                </p>

                {/* Minimum Withdrawal */}
                <div className="mb-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-medium text-gray-300">Monto minimo de retiro</p>
                      <p className="text-[10px] text-gray-600">El repartidor debe tener al menos este monto disponible</p>
                    </div>
                    <div className="text-xl font-bold text-purple-400">{formatColones(minWithdrawal)}</div>
                  </div>
                  <input type="range" min={1000} max={100000} step={1000} value={minWithdrawal}
                    onChange={(e) => setMinWithdrawal(Number(e.target.value))}
                    className="w-full h-2 bg-white/10 rounded-full cursor-pointer accent-purple-500" />
                  <div className="flex justify-between mt-2 text-xs text-gray-500">
                    <span>₡1,000</span><span>₡100,000</span>
                  </div>
                </div>

                {/* Step (multiples) */}
                <div className="mb-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-medium text-gray-300">Multiplos de retiro</p>
                      <p className="text-[10px] text-gray-600">Solo se permiten montos que sean multiplos de este valor</p>
                    </div>
                    <div className="text-xl font-bold text-purple-400">{formatColones(withdrawalStep)}</div>
                  </div>
                  <input type="range" min={1000} max={50000} step={1000} value={withdrawalStep}
                    onChange={(e) => setWithdrawalStep(Number(e.target.value))}
                    className="w-full h-2 bg-white/10 rounded-full cursor-pointer accent-purple-500" />
                  <div className="flex justify-between mt-2 text-xs text-gray-500">
                    <span>₡1,000</span><span>₡50,000</span>
                  </div>
                </div>

                {/* Delay Hours */}
                <div className="mb-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-medium text-gray-300">Tiempo de espera para retiro</p>
                      <p className="text-[10px] text-gray-600">Horas antes de que el retiro sea procesable</p>
                    </div>
                    <div className="text-xl font-bold text-purple-400">{withdrawalDelay}h</div>
                  </div>
                  <input type="range" min={1} max={168} step={1} value={withdrawalDelay}
                    onChange={(e) => setWithdrawalDelay(Number(e.target.value))}
                    className="w-full h-2 bg-white/10 rounded-full cursor-pointer accent-purple-500" />
                  <div className="flex justify-between mt-2 text-xs text-gray-500">
                    <span>1h</span><span>72h</span><span>168h (7d)</span>
                  </div>
                </div>

                {/* Batch Size */}
                <div className="mb-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-medium text-gray-300">Retiros por lote</p>
                      <p className="text-[10px] text-gray-600">Cuantos retiros se procesan juntos al ejecutar un lote</p>
                    </div>
                    <div className="text-xl font-bold text-purple-400">{batchSize}</div>
                  </div>
                  <input type="range" min={1} max={20} step={1} value={batchSize}
                    onChange={(e) => setBatchSize(Number(e.target.value))}
                    className="w-full h-2 bg-white/10 rounded-full cursor-pointer accent-purple-500" />
                  <div className="flex justify-between mt-2 text-xs text-gray-500">
                    <span>1</span><span>20</span>
                  </div>
                </div>

                {/* Queue Summary */}
                <div className="bg-purple-500/5 border border-purple-500/15 rounded-xl p-4 mb-4">
                  <p className="text-xs font-medium text-purple-400 mb-2 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" /> Resumen de Fila
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-[10px] text-gray-500">En fila</p>
                      <p className="text-base font-bold text-amber-400">{queuedCount}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500">Procesando</p>
                      <p className="text-base font-bold text-cyan-400">{processingCount}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500">Total en fila</p>
                      <p className="text-base font-bold text-purple-400">{formatColones(totalInQueue)}</p>
                    </div>
                  </div>
                </div>

                {/* Process Batch Button */}
                <button type="button" onClick={handleProcessBatch} disabled={processing || queuedCount === 0}
                  className="w-full py-3 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-400 font-semibold text-sm disabled:opacity-40 hover:bg-purple-500/30 transition-colors flex items-center justify-center gap-2">
                  {processing ? (
                    <><div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" /> Procesando...</>
                  ) : (
                    <><ArrowDownCircle className="w-4 h-4" /> Procesar Siguiente Lote ({batchSize} retiros)</>
                  )}
                </button>
              </div>

              {/* ═══ WITHDRAWAL QUEUE TABLE ═══ */}
              <AnimatePresence>
                {showQueue && (
                  <motion.div className="glass rounded-2xl p-6 border border-purple-500/10"
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base font-semibold text-white flex items-center gap-2">
                        <Layers className="w-4 h-4 text-purple-400" />
                        Fila de Retiros de Repartidores
                      </h3>
                      <button type="button" onClick={() => loadWithdrawals()}
                        className="p-2 rounded-lg hover:bg-white/5 transition-colors text-gray-400 hover:text-white">
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>

                    {withdrawalsLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <div className="w-5 h-5 border-2 border-white/20 border-t-purple-400 rounded-full animate-spin" />
                      </div>
                    ) : withdrawals.length === 0 ? (
                      <div className="text-center py-12">
                        <Layers className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                        <p className="text-sm text-gray-500">No hay retiros en la fila</p>
                        <p className="text-xs text-gray-600 mt-1">Los retiros aparecen aqui cuando los repartidores solicitan retirar fondos.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-[11px] text-gray-500 uppercase tracking-wider border-b border-white/5">
                              <th className="pb-3 pr-3">#</th>
                              <th className="pb-3 pr-3">Repartidor</th>
                              <th className="pb-3 pr-3">Monto</th>
                              <th className="pb-3 pr-3">Estado</th>
                              <th className="pb-3 pr-3">Solicitado</th>
                              <th className="pb-3 pr-3">Procesable</th>
                              <th className="pb-3">Procesado</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {withdrawals.map((w, i) => (
                              <tr key={w.id} className="hover:bg-white/[0.03] transition-colors">
                                <td className="py-3 pr-3 text-gray-500">{w.queue_position || i + 1}</td>
                                <td className="py-3 pr-3">
                                  <div>
                                    <p className="text-white font-medium">{w.courier_name || 'N/A'}</p>
                                    <p className="text-[10px] text-gray-500">{w.courier_phone || ''}</p>
                                  </div>
                                </td>
                                <td className="py-3 pr-3 font-semibold text-white">{formatColones(Number(w.amount))}</td>
                                <td className="py-3 pr-3">
                                  <span className={`px-2 py-0.5 rounded-lg text-[10px] font-medium ${
                                    w.status === 'completed' ? 'bg-emerald-500/15 text-emerald-400' :
                                    w.status === 'queued' ? 'bg-amber-500/15 text-amber-400' :
                                    w.status === 'processing' ? 'bg-cyan-500/15 text-cyan-400' :
                                    w.status === 'cancelled' ? 'bg-red-500/15 text-red-400' :
                                    'bg-gray-500/15 text-gray-400'
                                  }`}>
                                    {w.status === 'queued' ? 'En fila' :
                                     w.status === 'processing' ? 'Procesando' :
                                     w.status === 'completed' ? 'Completado' :
                                     w.status === 'cancelled' ? 'Cancelado' : w.status}
                                  </span>
                                </td>
                                <td className="py-3 pr-3 text-gray-400 text-xs">
                                  {new Date(w.requested_at).toLocaleDateString('es-CR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </td>
                                <td className="py-3 pr-3 text-xs">
                                  <span className={w.processable_at <= new Date().toISOString() ? 'text-emerald-400' : 'text-amber-400'}>
                                    {new Date(w.processable_at).toLocaleDateString('es-CR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </td>
                                <td className="py-3 text-gray-500 text-xs">
                                  {w.processed_at
                                    ? new Date(w.processed_at).toLocaleDateString('es-CR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                                    : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Save Button */}
              <motion.button type="button" onClick={handleSave} disabled={isSaving}
                className="w-full py-3.5 rounded-xl btn-neon text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                {isSaving ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Guardando...</>
                ) : (
                  <><Save className="w-4 h-4" /> Guardar Cambios</>
                )}
              </motion.button>
            </div>

            {/* Right Panel - Marketplace */}
            <div className="space-y-4">
              {/* How It Works */}
              <div className="glass rounded-2xl p-5">
                <h3 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
                  <Info className="w-4 h-4 text-cyan-400" />
                  Como Funciona
                </h3>
                <div className="space-y-3">
                  {[
                    { step: '1', title: 'Cliente pide', desc: 'El cliente hace un pedido y paga con tarjeta o efectivo', color: 'bg-cyan-500' },
                    { step: '2', title: 'Repartidor entrega', desc: 'El repartidor recoge y entrega el pedido al cliente', color: 'bg-blue-500' },
                    { step: '3', title: 'Comision automatica', desc: `Al completar, RIDA retiene ${marketComm}% y el ${(100 - marketComm)}% va al negocio`, color: 'bg-orange-500' },
                    { step: '4', title: 'Retiro en fila', desc: `Repartidor solicita retiro (min ${formatColones(minWithdrawal)}, multiplos de ${formatColones(withdrawalStep)})`, color: 'bg-purple-500' },
                    { step: '5', title: '48h despues', desc: 'Despues de la espera, el admin procesa la fila por lotes de ' + batchSize, color: 'bg-emerald-500' },
                  ].map((item) => (
                    <div key={item.step} className="flex gap-3">
                      <div className={`w-6 h-6 rounded-lg ${item.color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5`}>
                        {item.step}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-200">{item.title}</p>
                        <p className="text-[10px] text-gray-500 leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Commission Visual */}
              <div className="glass rounded-2xl p-5">
                <h3 className="text-base font-semibold text-white mb-1 flex items-center gap-2">
                  <Percent className="w-4 h-4 text-orange-400" />
                  Distribucion del Pago
                </h3>
                <p className="text-xs text-gray-500 mb-4">Cuando se completa un pedido de ₡10,000</p>

                {/* Visual bar */}
                <div className="h-8 rounded-xl overflow-hidden flex mb-3">
                  <div className="bg-gradient-to-r from-orange-500 to-orange-600 flex items-center justify-center transition-all duration-500"
                    style={{ width: `${marketComm}%` }}>
                    <span className="text-[10px] font-bold text-white">RIDA {marketComm}%</span>
                  </div>
                  <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 flex items-center justify-center flex-1">
                    <span className="text-[10px] font-bold text-white">Negocio {100 - marketComm}%</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-orange-500/10 rounded-lg p-2.5 text-center">
                    <p className="text-[10px] text-orange-300">Plataforma</p>
                    <p className="text-sm font-bold text-orange-400">₡{(10000 * marketComm / 100).toLocaleString()}</p>
                  </div>
                  <div className="bg-emerald-500/10 rounded-lg p-2.5 text-center">
                    <p className="text-[10px] text-emerald-300">Negocio</p>
                    <p className="text-sm font-bold text-emerald-400">₡{(10000 * (100 - marketComm) / 100).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Withdrawal Rules */}
              <div className="glass rounded-2xl p-5">
                <h3 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-purple-400" />
                  Reglas de Retiro
                </h3>
                <div className="space-y-2.5">
                  {[
                    { icon: '⏱', label: 'Espera', value: `${withdrawalDelay} horas` },
                    { icon: '💰', label: 'Minimo', value: formatColones(minWithdrawal) },
                    { icon: '📏', label: 'Multiplos de', value: formatColones(withdrawalStep) },
                    { icon: '📦', label: 'Lote', value: `${batchSize} retiros` },
                  ].map((rule) => (
                    <div key={rule.label} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
                      <span className="text-xs text-gray-400">{rule.icon} {rule.label}</span>
                      <span className="text-xs font-semibold text-white">{rule.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Refresh Stats */}
              <motion.button type="button" onClick={() => { loadMarketStats(); loadWithdrawals(); }}
                className="w-full glass rounded-xl p-3 text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-colors flex items-center justify-center gap-2"
                whileTap={{ scale: 0.98 }}>
                <RefreshCw className="w-3.5 h-3.5" /> Actualizar estadisticas
              </motion.button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
