'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { supabase, type Courier } from '@/lib/supabase';
import { toast } from 'sonner';
import {
  Wallet as WalletIcon, TrendingUp, Clock, ChevronRight,
  Calendar, CreditCard, Banknote, Loader2, Target,
  Gift, ArrowUpCircle, ArrowDownCircle, RefreshCw,
  Package, Star,
} from 'lucide-react';

interface WeeklyDay {
  day: string;
  amount: number;
  color: string;
}

interface TxDisplay {
  id: string;
  desc: string;
  amount: number;
  time: string;
  type: 'delivery' | 'withdraw';
}

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Ahora';
  if (diffMins < 60) return `Hace ${diffMins}m`;
  if (diffHours < 24) return `Hace ${diffHours}h`;
  if (diffDays === 1) return 'Ayer';
  return `Hace ${diffDays} dias`;
}

function formatCurrency(amount: number): string {
  return `₡${Math.round(amount).toLocaleString()}`;
}

// Hardcoded weekly data for initial display
const HARDCODED_WEEKLY: WeeklyDay[] = [
  { day: 'Lun', amount: 12500, color: 'from-purple-600 to-orange-500' },
  { day: 'Mar', amount: 18300, color: 'from-purple-600 to-orange-500' },
  { day: 'Mie', amount: 9800, color: 'from-purple-600 to-orange-500' },
  { day: 'Jue', amount: 22100, color: 'from-purple-600 to-orange-500' },
  { day: 'Vie', amount: 15600, color: 'from-purple-600 to-orange-500' },
  { day: 'Sab', amount: 28000, color: 'from-purple-600 to-orange-500' },
  { day: 'Dom', amount: 8200, color: 'from-purple-600 to-orange-500' },
];

export default function CourierEarnings() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [totalDeliveries, setTotalDeliveries] = useState(0);
  const [todayDeliveries, setTodayDeliveries] = useState(0);
  const [weeklyData, setWeeklyData] = useState<WeeklyDay[]>(HARDCODED_WEEKLY);
  const [totalWeekly, setTotalWeekly] = useState(0);
  const [rating, setRating] = useState(0);

  const maxAmount = Math.max(...weeklyData.map(d => d.amount), 1);
  const dailyGoal = 50000;

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);

    try {
      const { data: courier } = await supabase
        .from('couriers')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (courier) {
        setTotalEarnings(courier.total_earnings || 0);
        setTotalDeliveries(courier.total_deliveries || 0);
        setRating(courier.rating || 0);
      }

      // Try to get real weekly data
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      sevenDaysAgo.setHours(0, 0, 0, 0);

      const { data: recentDeliveries } = await supabase
        .from('deliveries')
        .select('delivery_fee, total, created_at')
        .eq('courier_id', courier?.id || user.id)
        .in('status', ['delivered'])
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: true });

      if (recentDeliveries && recentDeliveries.length > 0) {
        const weekMap: Record<string, number> = {};
        const today = new Date();
        for (let i = 6; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(d.getDate() - i);
          const key = d.toISOString().slice(0, 10);
          weekMap[key] = 0;
        }

        let todaySum = 0;
        let weekSum = 0;
        let todayCount = 0;
        const todayStr = today.toISOString().slice(0, 10);

        for (const delivery of recentDeliveries) {
          const deliveryDate = new Date(delivery.created_at);
          const dateKey = deliveryDate.toISOString().slice(0, 10);
          const earnings = delivery.delivery_fee || delivery.total * 0.2;
          if (weekMap.hasOwnProperty(dateKey)) {
            weekMap[dateKey] += earnings;
          }
          if (dateKey === todayStr) {
            todaySum += earnings;
            todayCount++;
          }
          weekSum += earnings;
        }

        setTodayEarnings(todaySum);
        setTodayDeliveries(todayCount);
        setTotalWeekly(weekSum);

        const builtWeeklyData: WeeklyDay[] = Object.entries(weekMap).map(([dateKey, amount]) => {
          const d = new Date(dateKey + 'T12:00:00');
          return {
            day: DAY_NAMES[d.getDay()],
            amount,
            color: 'from-purple-600 to-orange-500',
          };
        });
        setWeeklyData(builtWeeklyData);
      } else {
        // Use hardcoded data
        setTotalWeekly(HARDCODED_WEEKLY.reduce((acc, d) => acc + d.amount, 0));
      }
    } catch (err) {
      console.error('Error fetching earnings data:', err);
      toast.error('Error al cargar datos de ganancias');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
          <p className="text-sm text-gray-400">Cargando ganancias...</p>
        </div>
      </div>
    );
  }

  const goalPercent = Math.min((todayEarnings / dailyGoal) * 100, 100);

  // Recent transactions (sample based on deliveries for now)
  const recentTransactions: TxDisplay[] = [
    { id: '1', desc: 'Entrega #4821 - Mall San Pedro', amount: 2500, time: 'Hace 2h', type: 'delivery' },
    { id: '2', desc: 'Entrega #4820 - Multiplaza', amount: 3200, time: 'Hace 4h', type: 'delivery' },
    { id: '3', desc: 'Retiro a banco', amount: -15000, time: 'Ayer', type: 'withdraw' },
    { id: '4', desc: 'Entrega #4819 - Hospital Calderon', amount: 1800, time: 'Ayer', type: 'delivery' },
    { id: '5', desc: 'Entrega #4818 - C.C. La Union', amount: 2100, time: 'Hace 2 dias', type: 'delivery' },
  ];

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-xl font-bold text-white">Ganancias</h1>
        <p className="text-sm text-gray-400 mt-0.5">Resumen de tus ingresos</p>
      </motion.div>

      {/* Today's Earnings Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="glass rounded-2xl p-5"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400">Ingresos de hoy</p>
            <p className="text-3xl font-bold text-white mt-1">{formatCurrency(todayEarnings)}</p>
          </div>
          <div className="flex items-center gap-1 text-gray-400">
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>
        {/* Daily Goal */}
        <div className="mt-3 pt-3 border-t border-white/5">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <Target className="w-3 h-3 text-orange-400" />
              <span className="text-xs text-gray-400">Objetivo</span>
            </div>
            <span className="text-xs text-gray-300">{formatCurrency(dailyGoal)}</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-2">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${goalPercent}%` }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="h-2 rounded-full bg-gradient-to-r from-orange-500 to-amber-400"
            />
          </div>
          <p className="text-[10px] text-gray-500 mt-1">{Math.round(goalPercent)}% completado</p>
        </div>
      </motion.div>

      {/* Wallet + Bonuses Row */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="grid grid-cols-2 gap-3"
      >
        {/* Wallet */}
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <WalletIcon className="w-4 h-4 text-orange-400" />
            <span className="text-xs text-gray-500">Saldo disponible</span>
          </div>
          <p className="text-lg font-bold text-white">{formatCurrency(totalEarnings)}</p>
          <button
            onClick={() => toast.info('Funcion de retiro proximamente')}
            className="mt-2 w-full py-1.5 rounded-lg bg-white/5 text-[10px] text-gray-300 font-medium hover:bg-white/10 transition-colors"
          >
            Retirar
          </button>
        </div>
        {/* Bonuses */}
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Gift className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-gray-500">Bonificaciones</span>
          </div>
          <p className="text-lg font-bold text-white">{formatCurrency(0)}</p>
          <div className="flex items-center gap-1 mt-2 text-orange-400">
            <ChevronRight className="w-3 h-3" />
            <span className="text-[10px] font-medium">Ver mas</span>
          </div>
        </div>
      </motion.div>

      {/* Stats Row */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-3 gap-2"
      >
        <div className="glass rounded-xl p-3 text-center">
          <TrendingUp className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
          <p className="text-sm font-bold text-white">20%</p>
          <p className="text-[10px] text-gray-500">Comision</p>
        </div>
        <div className="glass rounded-xl p-3 text-center">
          <Star className="w-4 h-4 text-amber-400 mx-auto mb-1" />
          <p className="text-sm font-bold text-white">{rating > 0 ? rating.toFixed(2) : '5.00'}</p>
          <p className="text-[10px] text-gray-500">Calificacion</p>
        </div>
        <div className="glass rounded-xl p-3 text-center">
          <CreditCard className="w-4 h-4 text-orange-400 mx-auto mb-1" />
          <p className="text-sm font-bold text-white">{formatCurrency(totalWeekly)}</p>
          <p className="text-[10px] text-gray-500">Esta semana</p>
        </div>
      </motion.div>

      {/* Weekly Chart */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.13 }}
        className="glass rounded-2xl p-4"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-orange-400" />
            <span className="text-sm font-semibold text-white">Esta Semana</span>
          </div>
          <span className="text-xs text-gray-500">{formatCurrency(totalWeekly)}</span>
        </div>
        {weeklyData.length > 0 ? (
          <div className="flex items-end gap-2 h-28">
            {weeklyData.map((data, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[9px] text-gray-500">₡{(data.amount / 1000).toFixed(0)}k</span>
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${(data.amount / maxAmount) * 100}%` }}
                  transition={{ duration: 0.6, delay: i * 0.08 }}
                  className={`w-full rounded-t-lg bg-gradient-to-t ${data.color} opacity-80 hover:opacity-100 transition-opacity cursor-pointer`}
                />
                <span className="text-[10px] text-gray-400 font-medium">{data.day}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-28 text-gray-500 text-sm">
            Sin entregas esta semana
          </div>
        )}
      </motion.div>

      {/* Total Stats */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.16 }}
        className="grid grid-cols-2 gap-3"
      >
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-4 h-4 text-orange-400" />
            <span className="text-xs text-gray-500">Total entregas</span>
          </div>
          <p className="text-2xl font-bold text-white">{totalDeliveries}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Banknote className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-gray-500">Total ganado</span>
          </div>
          <p className="text-2xl font-bold text-white">
            {totalEarnings >= 1000000
              ? `₡${(totalEarnings / 1000000).toFixed(1)}M`
              : formatCurrency(totalEarnings)}
          </p>
        </div>
      </motion.div>

      {/* Recent Transactions */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-400">Transacciones Recientes</h2>
          <button onClick={() => { fetchData(); toast.info('Datos actualizados'); }} className="p-1 rounded-lg hover:bg-white/5">
            <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
          </button>
        </div>
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {recentTransactions.map((tx) => (
            <div key={tx.id} className="glass rounded-xl p-3 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tx.type === 'delivery' ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                {tx.type === 'delivery' ? (
                  <ArrowUpCircle className="w-5 h-5 text-emerald-400" />
                ) : (
                  <ArrowDownCircle className="w-5 h-5 text-red-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{tx.desc}</p>
                <p className="text-xs text-gray-500">{tx.time}</p>
              </div>
              <p className={`text-sm font-semibold ${tx.amount > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {tx.amount > 0 ? '+' : ''}{formatCurrency(Math.abs(tx.amount))}
              </p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
