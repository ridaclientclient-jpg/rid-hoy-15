'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { supabase, type Driver, type Ride, type Wallet, type Transaction } from '@/lib/supabase';
import { toast } from 'sonner';
import {
  Wallet as WalletIcon, TrendingUp, Clock, ChevronRight, ArrowDownCircle,
  Info, Calendar, CreditCard, Banknote, Loader2, Target,
  Gift, Flag, Zap, BarChart3, ArrowUpCircle, RefreshCw,
  X, Send, Smartphone, Shield, Users, ChevronDown, ChevronUp,
  Route as RouteIcon, Star, AlertTriangle,
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
  type: 'ride' | 'withdraw' | 'transfer';
}

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];

const ACHIEVEMENT_TABS = [
  { id: 'rides', label: 'Viajes', icon: CreditCard },
  { id: 'demand', label: 'Demanda', icon: Zap },
  { id: 'performance', label: 'Rendimiento', icon: BarChart3 },
];

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

// ═══ Feature 9: Per-Ride Breakdown Component ═══
function RideBreakdown({ driverId }: { driverId?: string }) {
  const [rides, setRides] = useState<any[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!driverId) { setLoadingDetail(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('rides')
          .select('*')
          .eq('driver_id', driverId)
          .eq('status', 'completed')
          .order('completed_at', { ascending: false })
          .limit(20);
        if (!cancelled) { setRides(data || []); }
      } catch {} finally { if (!cancelled) setLoadingDetail(false); }
    })();
    return () => { cancelled = true; };
  }, [driverId]);

  if (loadingDetail) {
    return <div className="flex items-center justify-center py-4"><Loader2 className="w-5 h-5 text-cyan-400 animate-spin" /></div>;
  }

  if (!rides.length) {
    return (
      <div className="glass rounded-2xl p-5 text-center">
        <RouteIcon className="w-8 h-8 text-gray-600 mx-auto mb-2" />
        <p className="text-xs text-gray-500">No hay viajes completados con detalle aun</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-96 overflow-y-auto">
      {rides.map((ride) => {
        const fare = ride.price || 0;
        const commission = ride.commission_rate ? Math.round(fare * ride.commission_rate) : Math.round(fare * 0.15);
        const tip = ride.tip_amount || 0;
        const surgeBonus = ride.surge_multiplier && ride.surge_multiplier > 1
          ? Math.round(fare * (ride.surge_multiplier - 1))
          : 0;
        const netEarnings = fare - commission + tip + surgeBonus;
        const isExpanded = expandedId === ride.id;

        return (
          <div key={ride.id} className="glass rounded-xl overflow-hidden">
            <button
              onClick={() => setExpandedId(isExpanded ? null : ride.id)}
              className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
                  <CreditCard className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-left min-w-0">
                  <p className="text-xs text-white truncate">{ride.origin} → {ride.destination}</p>
                  <p className="text-[10px] text-gray-500">
                    {ride.completed_at
                      ? new Date(ride.completed_at).toLocaleDateString('es-CR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })
                      : new Date(ride.updated_at || ride.created_at).toLocaleDateString('es-CR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })
                    }
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-bold text-emerald-400">{formatCurrency(netEarnings)}</span>
                {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-500" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-500" />}
              </div>
            </button>

            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                className="px-3 pb-3"
              >
                <div className="h-px bg-white/5 mb-2" />
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">Tarifa del viaje</span>
                    <span className="text-white font-medium">+{formatCurrency(fare)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">Comision ({Math.round((commission / Math.max(fare, 1)) * 100)}%)</span>
                    <span className="text-red-400 font-medium">-{formatCurrency(commission)}</span>
                  </div>
                  {tip > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">Propina</span>
                      <span className="text-amber-400 font-medium">+{formatCurrency(tip)}</span>
                    </div>
                  )}
                  {surgeBonus > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">Bonus surge ({ride.surge_multiplier}x)</span>
                      <span className="text-orange-400 font-medium">+{formatCurrency(surgeBonus)}</span>
                    </div>
                  )}
                  <div className="h-px bg-white/5 my-1" />
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-emerald-400 font-semibold">Ganancia neta</span>
                    <span className="text-emerald-400 font-bold">{formatCurrency(netEarnings)}</span>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ═══ Period Detail Types ═══
interface PeriodSummary {
  total_rides: number;
  total_earnings: number;
  total_earnings_formatted: string;
  total_tips: number;
  total_tips_formatted: string;
  total_distance_km: number;
  avg_daily_earnings: number;
  avg_daily_earnings_formatted: string;
  avg_fare: number;
  avg_fare_formatted: string;
}

interface DailyRPC {
  date: string;
  rides: number;
  earnings: number;
  tips: number;
  distance: number;
  avg_fare: number;
}

interface PeriodDetailData {
  summary: PeriodSummary;
  daily: DailyRPC[];
}

type PeriodKey = 'today' | 'week' | 'month' | 'year';

const PERIOD_OPTIONS: { id: PeriodKey; label: string }[] = [
  { id: 'today', label: 'Hoy' },
  { id: 'week', label: 'Semana' },
  { id: 'month', label: 'Mes' },
  { id: 'year', label: 'Ano' },
];

const RPC_DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
const RPC_MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export default function DriverEarnings() {
  const { user, session } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [driverData, setDriverData] = useState<Driver | null>(null);
  const [hasWithdrawnToday, setHasWithdrawnToday] = useState(false);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [totalWeekly, setTotalWeekly] = useState(0);
  const [weeklyData, setWeeklyData] = useState<WeeklyDay[]>([]);
  const [workHours, setWorkHours] = useState(0);
  const [transactions, setTransactions] = useState<TxDisplay[]>([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [bonuses, setBonuses] = useState(0);
  const [activeTab, setActiveTab] = useState('rides');
  const [walletId, setWalletId] = useState<string | null>(null);

  // ─── Modal States ─────────────────────────────────
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);

  // ─── Withdraw Form ────────────────────────────────
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawLoading, setWithdrawLoading] = useState(false);

  // ─── Transfer Form ────────────────────────────────
  const [transferPhone, setTransferPhone] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);

  // ─── Queue State ──────────────────────────────────
  const [queueInfo, setQueueInfo] = useState<{
    position: number;
    status: 'queued' | 'processing';
    amount: number;
    queueId: string;
  } | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  // ─── Period Detail State (RPC) ─────────────────────
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodKey>('week');
  const [periodData, setPeriodData] = useState<PeriodDetailData | null>(null);
  const [periodLoading, setPeriodLoading] = useState(false);
  const [periodError, setPeriodError] = useState<string | null>(null);

  // ─── Fetch Period Detail from RPC ──────────────────
  useEffect(() => {
    if (!session?.access_token) return;
    let cancelled = false;
    (async () => {
      setPeriodLoading(true);
      setPeriodError(null);
      try {
        const res = await fetch(`/api/drivers/earnings-detail?period=${selectedPeriod}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          throw new Error(errData?.error || `Error ${res.status}`);
        }
        const json = await res.json();
        if (!cancelled) setPeriodData(json);
      } catch (err: any) {
        if (!cancelled) setPeriodError(err?.message || 'Error al cargar detalles del periodo');
      } finally {
        if (!cancelled) setPeriodLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [session?.access_token, selectedPeriod]);

  const maxAmount = Math.max(...weeklyData.map(d => d.amount), 1);
  const maxHours = 12;
  const dailyGoal = driverData?.daily_goal || 50000;

  // Real stats from driver data
  const accepted = driverData?.accepted_rides || 0;
  const rejected = driverData?.rejected_rides || 0;
  const totalAR = accepted + rejected;
  const acceptanceRate = totalAR > 0 ? Math.round((accepted / totalAR) * 100) : 0;
  const cancels = driverData?.cancelled_rides || 0;
  const totalRides = driverData?.total_rides || 0;
  const cancellationRate = (cancels > 0 && totalRides > 0) ? Math.round((cancels / totalRides) * 100) : 0;
  const driverRating = driverData?.rating || 0;
  const todayDayName = ['Dom','Lun','Mar','Mie','Jue','Vie','Sab'][new Date().getDay()];
  const totalTripsToday = weeklyData.find(d => d.day === todayDayName && d.amount > 0) ? 1 : 0;

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);

    try {
      const { data: driver } = await supabase
        .from('drivers')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (driver) {
        setTotalEarnings(driver.total_earnings || 0);
        setWorkHours(driver.work_hours_today || 0);
        setDriverData(driver);
      }

      // Fetch or auto-create wallet
      let { data: wallet, error: walletErr } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (walletErr || !wallet) {
        const { data: newWallet } = await supabase
          .from('wallets')
          .upsert({
            user_id: user.id,
            balance: 0,
            total_earnings: 0,
            total_withdrawn: 0,
          }, { onConflict: 'user_id' })
          .select()
          .single();
        wallet = newWallet;
      }

      if (wallet) {
        setWalletBalance(wallet.balance || 0);
        setBonuses(0); // Bonos reales deben venir de la DB cuando se implementen
        setWalletId(wallet.id);
      }

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      sevenDaysAgo.setHours(0, 0, 0, 0);

      const { data: recentRides } = await supabase
        .from('rides')
        .select('*')
        .eq('driver_id', driver?.id || user.id)
        .in('status', ['completed'])
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: true });

      const rides = recentRides || [];

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
      const todayStr = today.toISOString().slice(0, 10);

      for (const ride of rides) {
        const rideDate = new Date(ride.created_at);
        const dateKey = rideDate.toISOString().slice(0, 10);
        const earnings = ride.driver_earnings || ride.price * 0.85;
        if (weekMap.hasOwnProperty(dateKey)) {
          weekMap[dateKey] += earnings;
        }
        if (dateKey === todayStr) {
          todaySum += earnings;
        }
        weekSum += earnings;
      }

      setTodayEarnings(todaySum);
      setTotalWeekly(weekSum);

      const builtWeeklyData: WeeklyDay[] = Object.entries(weekMap).map(([dateKey, amount]) => {
        const d = new Date(dateKey + 'T12:00:00');
        return {
          day: DAY_NAMES[d.getDay()],
          amount,
          color: 'from-blue-600 to-cyan-500',
        };
      });
      setWeeklyData(builtWeeklyData);

      const { data: todayWithdrawals } = await supabase
        .from('transactions')
        .select('id')
        .eq('type', 'withdrawal')
        .gte('created_at', new Date(todayStr + 'T00:00:00').toISOString())
        .limit(1);
      setHasWithdrawnToday((todayWithdrawals?.length || 0) > 0);

      if (wallet) {
        const { data: txData } = await supabase
          .from('transactions')
          .select('*')
          .eq('wallet_id', wallet.id)
          .order('created_at', { ascending: false })
          .limit(20);

        if (txData && txData.length > 0) {
          const mapped: TxDisplay[] = txData.map((tx: Transaction) => ({
            id: tx.id,
            desc: tx.description || (tx.type === 'withdrawal' ? 'Retiro a banco' : tx.type === 'debit' ? 'Transferencia enviada' : `Viaje ${tx.ride_id?.slice(0, 8) || ''}`),
            amount: (tx.type === 'withdrawal' || tx.type === 'debit') ? -Math.abs(tx.amount) : tx.amount,
            time: formatRelativeTime(tx.created_at),
            type: tx.type === 'withdrawal' ? 'withdraw' : tx.type === 'debit' ? 'transfer' : 'ride',
          }));
          setTransactions(mapped);
        }
      }
    } catch (err) {
      console.error('Error fetching earnings data:', err);
      toast.error('Error al cargar datos de ganancias');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ─── Queue Functions ──────────────────────────────
  const checkQueueStatus = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data: myEntry } = await supabase
        .from('withdrawal_queue')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['queued', 'processing'])
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!myEntry) {
        // Check if recently completed or failed
        const { data: latestEntry } = await supabase
          .from('withdrawal_queue')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (latestEntry && latestEntry.status === 'completed' && !hasWithdrawnToday) {
          fetchData();
        } else if (latestEntry && latestEntry.status === 'failed') {
          toast.error('Retiro fallido: ' + (latestEntry.error_message || 'Intenta de nuevo'));
          fetchData();
        }
        setQueueInfo(null);
        return;
      }

      if (myEntry.status === 'processing') {
        setQueueInfo({ position: 0, status: 'processing', amount: myEntry.amount, queueId: myEntry.id });
      } else {
        // Count how many are ahead in queue
        const { count: queuedAhead } = await supabase
          .from('withdrawal_queue')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'queued')
          .lt('created_at', myEntry.created_at);
        const { count: processingCount } = await supabase
          .from('withdrawal_queue')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'processing');
        const position = (queuedAhead || 0) + (processingCount || 0) + 1;
        setQueueInfo({ position, status: 'queued', amount: myEntry.amount, queueId: myEntry.id });
      }
    } catch (err) {
      console.error('Queue check error:', err);
    }
  }, [user?.id, hasWithdrawnToday, fetchData]);

  const processNextInQueue = useCallback(async () => {
    try {
      // Check if something is already being processed
      const { data: currentProcessing } = await supabase
        .from('withdrawal_queue')
        .select('id')
        .eq('status', 'processing')
        .limit(1)
        .maybeSingle();
      if (currentProcessing) return; // Someone is already processing

      // Get next queued item (FIFO)
      const { data: nextItem } = await supabase
        .from('withdrawal_queue')
        .select('*')
        .eq('status', 'queued')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!nextItem) return; // Queue is empty

      // Atomically claim it (optimistic lock — prevents race conditions)
      const { data: claimed, error: claimErr } = await supabase
        .from('withdrawal_queue')
        .update({ status: 'processing' })
        .eq('id', nextItem.id)
        .eq('status', 'queued')
        .select()
        .single();
      if (claimErr || !claimed) return; // Someone else claimed it

      const isCurrentUser = claimed.user_id === user?.id;

      try {
        // Get wallet for this withdrawal
        const { data: wallet } = await supabase
          .from('wallets')
          .select('*')
          .eq('id', claimed.wallet_id)
          .single();

        if (!wallet || wallet.balance < claimed.amount) {
          await supabase
            .from('withdrawal_queue')
            .update({
              status: 'failed',
              error_message: !wallet ? 'Billetera no encontrada' : 'Saldo insuficiente',
              processed_at: new Date().toISOString(),
            })
            .eq('id', claimed.id);
          if (isCurrentUser) {
            toast.error('No se pudo procesar: saldo insuficiente');
            setQueueInfo(null);
            fetchData();
          }
          return;
        }

        // Check daily limit for this wallet
        const todayStr = new Date().toISOString().slice(0, 10);
        const { data: todayTx } = await supabase
          .from('transactions')
          .select('id')
          .eq('wallet_id', claimed.wallet_id)
          .eq('type', 'withdrawal')
          .gte('created_at', todayStr + 'T00:00:00')
          .limit(1);
        if (todayTx && todayTx.length > 0) {
          await supabase
            .from('withdrawal_queue')
            .update({
              status: 'failed',
              error_message: 'Ya existe un retiro hoy',
              processed_at: new Date().toISOString(),
            })
            .eq('id', claimed.id);
          if (isCurrentUser) {
            toast.error('Ya tienes un retiro procesado hoy');
            setQueueInfo(null);
          }
          return;
        }

        // Create withdrawal transaction
        const { error: txErr } = await supabase
          .from('transactions')
          .insert({
            wallet_id: claimed.wallet_id,
            amount: claimed.amount,
            type: 'withdrawal',
            status: 'processing',
            description: 'Retiro a banco - ' + formatCurrency(claimed.amount) + ' (24h)',
          });
        if (txErr) throw txErr;

        // Update wallet balance
        const { error: updateErr } = await supabase
          .from('wallets')
          .update({
            balance: wallet.balance - claimed.amount,
            total_withdrawn: (wallet.total_withdrawn || 0) + claimed.amount,
          })
          .eq('id', claimed.wallet_id);
        if (updateErr) throw updateErr;

        // Mark as completed in queue
        await supabase
          .from('withdrawal_queue')
          .update({
            status: 'completed',
            processed_at: new Date().toISOString(),
          })
          .eq('id', claimed.id);

        if (isCurrentUser) {
          toast.success('Retiro de ' + formatCurrency(claimed.amount) + ' procesado exitosamente');
          setQueueInfo(null);
          setHasWithdrawnToday(true);
          setWalletBalance(wallet.balance - claimed.amount);
          fetchData();
        }
      } catch (err: any) {
        const msg = err?.message || 'Error desconocido';
        await supabase
          .from('withdrawal_queue')
          .update({
            status: 'failed',
            error_message: msg,
            processed_at: new Date().toISOString(),
          })
          .eq('id', claimed.id);
        if (isCurrentUser) {
          toast.error('Error al procesar retiro. Intenta de nuevo.');
          setQueueInfo(null);
          fetchData();
        }
      }
    } catch (err) {
      console.error('Queue processing error:', err);
    }
  }, [user?.id, fetchData]);

  // ─── Queue Polling ────────────────────────────────
  useEffect(() => {
    checkQueueStatus();
    const interval = setInterval(() => {
      checkQueueStatus();
      processNextInQueue();
    }, 10000);
    return () => clearInterval(interval);
  }, [checkQueueStatus, processNextInQueue]);

  // ─── Withdraw Handler (Queue-based) ──────────────
  const handleWithdraw = async () => {
    const amount = parseInt(withdrawAmount);
    if (!amount || amount < 10000) {
      toast.error('El monto minimo de retiro es ₡10,000');
      return;
    }
    if (amount > walletBalance) {
      toast.error('Monto mayor al saldo disponible');
      return;
    }
    if (hasWithdrawnToday) {
      toast.error('Ya realizaste un retiro hoy. Puedes retirar de nuevo manana.');
      return;
    }
    if (queueInfo) {
      toast.error('Ya tienes un retiro en fila. Espera a que se procese.');
      return;
    }
    if (!walletId) {
      toast.error('No se encontro la billetera');
      return;
    }

    setWithdrawLoading(true);
    try {
      // Add to withdrawal queue instead of processing directly
      const { error: queueErr } = await supabase
        .from('withdrawal_queue')
        .insert({
          wallet_id: walletId,
          user_id: user!.id,
          amount: amount,
          status: 'queued',
        });
      if (queueErr) throw queueErr;

      setShowWithdraw(false);
      setWithdrawAmount('');
      toast.info('Retiro agregado a la fila. Procesando...');

      // Check queue position and try to process
      await checkQueueStatus();
      await processNextInQueue();
    } catch (err: any) {
      console.error('Queue error:', err);
      toast.error('Error al agregar a la fila. Intenta de nuevo.');
    } finally {
      setWithdrawLoading(false);
    }
  };

  // ─── Cancel Queue Entry ───────────────────────────
  const handleCancelQueue = async () => {
    if (!queueInfo || queueInfo.status !== 'queued') return;
    setCancelLoading(true);
    try {
      const { error } = await supabase
        .from('withdrawal_queue')
        .update({
          status: 'cancelled',
          processed_at: new Date().toISOString(),
        })
        .eq('id', queueInfo.queueId)
        .eq('status', 'queued');
      if (error) throw error;
      setQueueInfo(null);
      toast.info('Retiro cancelado de la fila');
    } catch (err) {
      toast.error('Error al cancelar. Intenta de nuevo.');
    } finally {
      setCancelLoading(false);
    }
  };

  // ─── Transfer Handler ─────────────────────────────
  const handleTransfer = async () => {
    const amount = parseInt(transferAmount);
    const phone = transferPhone.trim();

    if (!phone || phone.length < 8) {
      toast.error('Ingresa un numero de telefono valido (8+ digitos)');
      return;
    }
    if (!amount || amount < 500) {
      toast.error('El monto minimo de transferencia es ₡500');
      return;
    }
    if (amount > walletBalance) {
      toast.error('Saldo insuficiente para esta transferencia');
      return;
    }
    if (!walletId) {
      toast.error('No se encontro la billetera');
      return;
    }

    setTransferLoading(true);
    try {
      const { data: wallet } = await supabase
        .from('wallets')
        .select('*')
        .eq('id', walletId)
        .single();
      if (!wallet) throw new Error('Billetera no encontrada');

      // Create debit transaction for sender
      const { error: txErr } = await supabase
        .from('transactions')
        .insert({
          wallet_id: walletId,
          amount: amount,
          type: 'debit',
          status: 'completed',
          description: `Transferencia SINPE al ${phone} - ${formatCurrency(amount)}`,
        });
      if (txErr) throw txErr;

      // Deduct from wallet
      const { error: updateErr } = await supabase
        .from('wallets')
        .update({ balance: wallet.balance - amount })
        .eq('id', walletId);
      if (updateErr) throw updateErr;

      setWalletBalance(wallet.balance - amount);
      setShowTransfer(false);
      setTransferPhone('');
      setTransferAmount('');
      toast.success(`Transferencia de ${formatCurrency(amount)} enviada al ${phone}`);
      fetchData();
    } catch (err: any) {
      console.error('Transfer error:', err);
      toast.error('Error al procesar la transferencia. Intenta de nuevo.');
    } finally {
      setTransferLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          <p className="text-sm text-gray-400">Cargando ganancias...</p>
        </div>
      </div>
    );
  }

  const goalPercent = Math.min((todayEarnings / dailyGoal) * 100, 100);

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-xl font-bold text-white">Ganancias</h1>
        <p className="text-sm text-gray-400 mt-0.5">Resumen de tus ingresos</p>
      </motion.div>

      {/* ═══ Detalles del Periodo (RPC) ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.03 }}
        className="glass-strong rounded-2xl p-4 space-y-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-semibold text-white">Detalles del Periodo</span>
          </div>
          {periodLoading && <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />}
        </div>

        {/* Period Selector Buttons */}
        <div className="flex gap-1.5">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setSelectedPeriod(opt.id)}
              disabled={periodLoading}
              className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${
                selectedPeriod === opt.id
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-transparent'
              } disabled:opacity-50`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Error State */}
        {periodError && !periodLoading && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-red-400 font-medium">Error al cargar detalles</p>
              <p className="text-[10px] text-gray-500 mt-0.5">{periodError}</p>
            </div>
          </div>
        )}

        {/* Success State */}
        {periodData && !periodError && (
          <>
            {/* Summary Cards Grid */}
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2.5 rounded-xl bg-white/5">
                <p className="text-[10px] text-gray-500 mb-0.5">Total viajes</p>
                <p className="text-sm font-bold text-white">{periodData.summary.total_rides}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-500/10">
                <p className="text-[10px] text-gray-500 mb-0.5">Ganancia total</p>
                <p className="text-sm font-bold text-emerald-400">{periodData.summary.total_earnings_formatted}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-500/10">
                <p className="text-[10px] text-gray-500 mb-0.5">Total propinas</p>
                <p className="text-sm font-bold text-amber-400">{periodData.summary.total_tips_formatted}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-white/5">
                <p className="text-[10px] text-gray-500 mb-0.5">Distancia total</p>
                <p className="text-sm font-bold text-white">{periodData.summary.total_distance_km}<span className="text-[10px] text-gray-500 ml-0.5">km</span></p>
              </div>
              <div className="p-2.5 rounded-xl bg-white/5">
                <p className="text-[10px] text-gray-500 mb-0.5">Promedio diario</p>
                <p className="text-sm font-bold text-cyan-400">{periodData.summary.avg_daily_earnings_formatted}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-white/5">
                <p className="text-[10px] text-gray-500 mb-0.5">Tarifa promedio</p>
                <p className="text-sm font-bold text-purple-400">{periodData.summary.avg_fare_formatted}</p>
              </div>
            </div>

            {/* Daily Bar Chart */}
            {periodData.daily.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-xs text-gray-400">
                    Ganancias por dia ({PERIOD_OPTIONS.find(p => p.id === selectedPeriod)?.label})
                  </span>
                </div>
                <div className="flex items-end gap-1.5 h-28 overflow-x-auto pb-1">
                  {(() => {
                    const maxDaily = Math.max(...periodData.daily.map(d => d.earnings), 1);
                    return periodData.daily.map((d, i) => {
                      const dateObj = new Date(d.date + 'T12:00:00');
                      const label = selectedPeriod === 'year'
                        ? RPC_MONTH_NAMES[dateObj.getMonth()]
                        : RPC_DAY_NAMES[dateObj.getDay()];
                      const dayNum = dateObj.getDate();
                      const heightPct = Math.max((d.earnings / maxDaily) * 100, 3);
                      return (
                        <div key={d.date} className="flex-1 flex flex-col items-center gap-1 min-w-[28px]">
                          <span className="text-[8px] text-gray-600">{d.earnings > 0 ? `₡${(d.earnings / 1000).toFixed(0)}k` : ''}</span>
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: `${heightPct}%` }}
                            transition={{ duration: 0.5, delay: i * 0.04 }}
                            className="w-full rounded-t-md bg-gradient-to-t from-cyan-600 to-emerald-400 opacity-80 hover:opacity-100 transition-opacity cursor-pointer"
                            title={`${dayNum} ${selectedPeriod === 'year' ? RPC_MONTH_NAMES[dateObj.getMonth()] : ''}: ${d.rides} viajes - ₡${Math.round(d.earnings).toLocaleString()}`}
                          />
                          <span className="text-[9px] text-gray-500 font-medium">{selectedPeriod === 'today' ? `${dayNum}` : label}</span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}

            {periodData.daily.length === 0 && (
              <p className="text-xs text-gray-500 text-center py-3">Sin datos para este periodo</p>
            )}
          </>
        )}
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
              <Target className="w-3 h-3 text-cyan-400" />
              <span className="text-xs text-gray-400">Objetivo</span>
            </div>
            <span className="text-xs text-gray-300">{formatCurrency(dailyGoal)}</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-2">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${goalPercent}%` }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="h-2 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500"
            />
          </div>
          <p className="text-[10px] text-gray-500 mt-1">{Math.round(goalPercent)}% completado</p>
        </div>
      </motion.div>

      {/* Wallet Balance Card — Major upgrade */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="glass rounded-2xl p-5 border border-cyan-500/10"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <WalletIcon className="w-5 h-5 text-cyan-400" />
            <span className="text-sm font-semibold text-white">Billetera RIDA</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Activa
          </div>
        </div>

        {/* Balance Display */}
        <div className="text-center py-3">
          <p className="text-xs text-gray-400 mb-1">Saldo disponible</p>
          <p className="text-4xl font-bold text-white">{formatCurrency(walletBalance)}</p>
        </div>

        {/* Action Buttons — 2 columns */}
        <div className="grid grid-cols-2 gap-3 mt-2">
          {/* Retirar */}
          <button
            type="button"
            onClick={() => setShowWithdraw(true)}
            className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center group-hover:scale-110 transition-transform">
              <ArrowUpCircle className="w-5 h-5 text-blue-400" />
            </div>
            <span className="text-xs font-medium text-gray-300">Retirar</span>
          </button>

          {/* Transferir */}
          <button
            type="button"
            onClick={() => setShowTransfer(true)}
            className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Send className="w-5 h-5 text-purple-400" />
            </div>
            <span className="text-xs font-medium text-gray-300">Transferir</span>
          </button>
        </div>

        {/* Quick info */}
        <div className="flex items-center justify-center gap-1.5 mt-3 text-[10px] text-gray-500">
          <Info className="w-3 h-3" />
          Min. ₡10,000 &middot; 1 retiro/dia &middot; Sistema de fila &middot; 24h
        </div>
      </motion.div>

      {/* Queue Status Banner */}
      <AnimatePresence>
        {queueInfo && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`rounded-2xl p-4 border ${
              queueInfo.status === 'processing'
                ? 'bg-cyan-500/10 border-cyan-500/30'
                : 'bg-amber-500/10 border-amber-500/30'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                queueInfo.status === 'processing'
                  ? 'bg-cyan-500/20'
                  : 'bg-amber-500/20'
              }`}>
                {queueInfo.status === 'processing' ? (
                  <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
                ) : (
                  <Users className="w-6 h-6 text-amber-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                {queueInfo.status === 'processing' ? (
                  <>
                    <p className="text-sm font-semibold text-white">Procesando retiro</p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatCurrency(queueInfo.amount)} — Tu retiro se esta procesando ahora</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-white">
                      Retiro en fila
                      <span className="ml-2 text-cyan-400 font-bold">#{queueInfo.position}</span>
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatCurrency(queueInfo.amount)}
                      {queueInfo.position === 1
                        ? ' — Eres el siguiente'
                        : ' — ' + (queueInfo.position - 1) + ' persona(s) adelante'
                      }
                    </p>
                  </>
                )}
              </div>
              {queueInfo.status === 'queued' && (
                <button
                  type="button"
                  onClick={handleCancelQueue}
                  disabled={cancelLoading}
                  className="px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 text-xs font-medium hover:bg-red-500/25 transition-colors disabled:opacity-50 shrink-0"
                >
                  {cancelLoading ? '...' : 'Salir'}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bonuses + Stats Row */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-3 gap-2"
      >
        <div className="glass rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Gift className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-[10px] text-gray-500">Bonos</span>
          </div>
          <p className="text-sm font-bold text-white">{formatCurrency(bonuses)}</p>
        </div>
        <div className="glass rounded-xl p-3 text-center">
          <TrendingUp className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
          <p className="text-sm font-bold text-white">15%</p>
          <p className="text-[10px] text-gray-500">Comision</p>
        </div>
        <div className="glass rounded-xl p-3 text-center">
          <Clock className="w-4 h-4 text-amber-400 mx-auto mb-1" />
          <p className="text-sm font-bold text-white">{workHours}h</p>
          <div className="mt-1 w-full bg-white/10 rounded-full h-1">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 h-1 rounded-full transition-all" style={{ width: `${(workHours / maxHours) * 100}%` }} />
          </div>
          <p className="text-[9px] text-gray-600 mt-0.5">de {maxHours}h</p>
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
            <Calendar className="w-4 h-4 text-cyan-400" />
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
            Sin viajes esta semana
          </div>
        )}
      </motion.div>

      {/* Achievements Section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.16 }}
        className="glass rounded-2xl p-4"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Flag className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-semibold text-white">Logros</span>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-500" />
        </div>
        {/* Tabs */}
        <div className="flex gap-1 mb-4">
          {ACHIEVEMENT_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                activeTab === tab.id ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
        {/* Tab Content */}
        <div className="min-h-[80px]">
          {activeTab === 'rides' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/5">
                <span className="text-xs text-gray-300">Viajes completados hoy</span>
                <span className="text-xs font-bold text-white">{totalTripsToday}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/5">
                <span className="text-xs text-gray-300">Viajes esta semana</span>
                <span className="text-xs font-bold text-white">{weeklyData.filter(d => d.amount > 0).length}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/5">
                <span className="text-xs text-gray-300">Aceptacion de viajes</span>
                <span className={`text-xs font-bold ${acceptanceRate >= 80 ? 'text-emerald-400' : acceptanceRate >= 50 ? 'text-amber-400' : 'text-red-400'}`}>{acceptanceRate}%</span>
              </div>
            </div>
          )}
          {activeTab === 'demand' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/5">
                <span className="text-xs text-gray-300">Viajes aceptados</span>
                <span className="text-xs font-bold text-emerald-400">{driverData?.accepted_rides || 0}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/5">
                <span className="text-xs text-gray-300">Viajes rechazados</span>
                <span className="text-xs font-bold text-amber-400">{driverData?.rejected_rides || 0}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/5">
                <span className="text-xs text-gray-300">Viajes cancelados</span>
                <span className="text-xs font-bold text-red-400">{driverData?.cancelled_rides || 0}</span>
              </div>
            </div>
          )}
          {activeTab === 'performance' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/5">
                <span className="text-xs text-gray-300">Calificacion promedio</span>
                <div className="flex items-center gap-1">
                  <Star className="w-3 h-3 text-amber-400" />
                  <span className="text-xs font-bold text-white">{driverRating > 0 ? driverRating.toFixed(2) : 'N/A'}</span>
                </div>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/5">
                <span className="text-xs text-gray-300">Tasa de cancelacion</span>
                <span className={`text-xs font-bold ${cancellationRate <= 5 ? 'text-emerald-400' : cancellationRate <= 15 ? 'text-amber-400' : 'text-red-400'}`}>{cancellationRate}%</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/5">
                <span className="text-xs text-gray-300">Total de viajes</span>
                <span className="text-xs font-bold text-white">{driverData?.total_rides || 0}</span>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* ═══ Feature 9: Per-ride breakdown ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.22 }}
      >
        <h2 className="text-sm font-semibold text-gray-400 flex items-center gap-2 mb-3">
          <RouteIcon className="w-4 h-4" />
          Detalles por viaje
        </h2>
        <RideBreakdown driverId={driverData?.id} />
      </motion.div>

      {/* Recent Transactions */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-400">Transacciones Recientes</h2>
          <button onClick={() => { fetchData(); toast.info('Datos actualizados'); }} className="p-1 rounded-lg hover:bg-white/5">
            <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
          </button>
        </div>
        {transactions.length > 0 ? (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {transactions.map((tx) => (
              <div key={tx.id} className="glass rounded-xl p-3 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  tx.type === 'ride' ? 'bg-emerald-500/20' :
                  tx.type === 'transfer' ? 'bg-purple-500/20' :
                  'bg-red-500/20'
                }`}>
                  {tx.type === 'ride' ? (
                    <ArrowUpCircle className="w-5 h-5 text-emerald-400" />
                  ) : tx.type === 'transfer' ? (
                    <Send className="w-5 h-5 text-purple-400" />
                  ) : (
                    <ArrowDownCircle className="w-5 h-5 text-red-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{tx.desc}</p>
                  <p className="text-xs text-gray-500">{tx.time}</p>
                </div>
                <p className={`text-sm font-semibold ${
                  tx.type === 'ride' ? 'text-emerald-400' :
                  tx.type === 'transfer' ? 'text-purple-400' :
                  'text-red-400'
                }`}>
                  {tx.type === 'ride' ? '+' : ''}{formatCurrency(Math.abs(tx.amount))}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 text-sm">
            Sin transacciones recientes
          </div>
        )}
      </motion.div>

      {/* ═══════════════════════════════════════════════ */}
      {/* MODALS */}
      {/* ═══════════════════════════════════════════════ */}

      {/* ─── WITHDRAW MODAL ─────────────────────────── */}
      <AnimatePresence>
        {showWithdraw && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-4"
            onClick={() => setShowWithdraw(false)}
          >
            <motion.div
              initial={{ y: 300, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 300, opacity: 0 }}
              transition={{ type: 'spring', damping: 25 }}
              className="glass-strong rounded-2xl p-5 w-full max-w-sm space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <ArrowUpCircle className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Retirar Ganancias</h3>
                    <p className="text-[10px] text-gray-500">Disponible: {formatCurrency(walletBalance)}</p>
                  </div>
                </div>
                <button type="button" onClick={() => setShowWithdraw(false)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Queue Status / Already Withdrawn Today */}
              {queueInfo ? (
                <div className="text-center py-4">
                  {queueInfo.status === 'processing' ? (
                    <>
                      <Loader2 className="w-10 h-10 text-cyan-400 mx-auto mb-3 animate-spin" />
                      <p className="text-sm font-medium text-white">Procesando tu retiro...</p>
                      <p className="text-xs text-gray-400 mt-1">Monto: {formatCurrency(queueInfo.amount)}</p>
                      <p className="text-xs text-cyan-400 mt-2 font-medium">Tu retiro se esta procesando ahora</p>
                    </>
                  ) : (
                    <>
                      <Users className="w-10 h-10 text-amber-400 mx-auto mb-3" />
                      <p className="text-sm font-medium text-white">Posicion en la fila</p>
                      <p className="text-3xl font-bold text-cyan-400 mt-1">#{queueInfo.position}</p>
                      <p className="text-xs text-gray-400 mt-1">Monto: {formatCurrency(queueInfo.amount)}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {queueInfo.position === 1
                          ? 'Eres el siguiente en ser procesado'
                          : 'Espera estimada: ~' + ((queueInfo.position - 1) * 30) + ' segundos'
                        }
                      </p>
                      <button
                        type="button"
                        onClick={handleCancelQueue}
                        disabled={cancelLoading}
                        className="mt-3 px-4 py-2 rounded-xl bg-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/30 transition-colors disabled:opacity-50"
                      >
                        {cancelLoading ? 'Cancelando...' : 'Cancelar retiro'}
                      </button>
                    </>
                  )}
                </div>
              ) : hasWithdrawnToday ? (
                <div className="text-center py-6">
                  <Info className="w-10 h-10 text-amber-400 mx-auto mb-3" />
                  <p className="text-sm font-medium text-white">Ya retiraste hoy</p>
                  <p className="text-xs text-gray-400 mt-1">Puedes realizar otro retiro manana. Maximo 1 retiro por dia.</p>
                </div>
              ) : (
                <>
                  {/* Amount Input */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-400 block">Monto a retirar</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 font-medium">₡</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        placeholder="0"
                        max={walletBalance}
                        className="w-full glass rounded-xl p-3 pl-8 text-white text-lg font-bold bg-transparent outline-none focus:ring-1 focus:ring-blue-500/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                    {/* Quick percent buttons */}
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: '25%', pct: 0.25 },
                        { label: '50%', pct: 0.5 },
                        { label: 'Todo', pct: 1 },
                      ].map(btn => (
                        <button
                          key={btn.label}
                          type="button"
                          onClick={() => setWithdrawAmount(String(Math.floor(walletBalance * btn.pct)))}
                          className={`py-2 rounded-xl text-xs font-medium transition-all ${
                            withdrawAmount === String(Math.floor(walletBalance * btn.pct))
                              ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                              : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          {btn.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">Monto a retirar</span>
                      <span className="text-white font-medium">{withdrawAmount ? formatCurrency(parseInt(withdrawAmount)) : '—'}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">Saldo restante</span>
                      <span className="text-white font-medium">
                        {withdrawAmount ? formatCurrency(walletBalance - parseInt(withdrawAmount)) : formatCurrency(walletBalance)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">Tiempo estimado</span>
                      <span className="text-amber-400 font-medium">24 horas</span>
                    </div>
                  </div>

                  {/* Warning */}
                  {withdrawAmount && parseInt(withdrawAmount) > walletBalance && (
                    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
                      <Info className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                      <p className="text-[11px] text-red-400">El monto excede tu saldo disponible</p>
                    </div>
                  )}

                  {/* Withdraw Button */}
                  <button
                    type="button"
                    onClick={handleWithdraw}
                    disabled={withdrawLoading || !withdrawAmount || parseInt(withdrawAmount) < 10000 || parseInt(withdrawAmount) > walletBalance}
                    className="w-full btn-neon text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
                  >
                    {withdrawLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Banknote className="w-4 h-4" />
                        Retirar {withdrawAmount ? formatCurrency(parseInt(withdrawAmount)) : ''}
                      </>
                    )}
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── TRANSFER MODAL ─────────────────────────── */}
      <AnimatePresence>
        {showTransfer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-4"
            onClick={() => setShowTransfer(false)}
          >
            <motion.div
              initial={{ y: 300, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 300, opacity: 0 }}
              transition={{ type: 'spring', damping: 25 }}
              className="glass-strong rounded-2xl p-5 w-full max-w-sm space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                    <Send className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Transferir</h3>
                    <p className="text-[10px] text-gray-500">Disponible: {formatCurrency(walletBalance)}</p>
                  </div>
                </div>
                <button type="button" onClick={() => setShowTransfer(false)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* SINPE Label */}
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20">
                <Smartphone className="w-4 h-4 text-purple-400" />
                <div>
                  <p className="text-xs font-medium text-purple-300">Transferencia SINPE Movil</p>
                  <p className="text-[10px] text-gray-500">Envia dinero a cualquier numero de telefono</p>
                </div>
              </div>

              {/* Phone Input */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-400 block">Numero de destino</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">+506</span>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={transferPhone}
                    onChange={(e) => setTransferPhone(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    placeholder="8XXX XXXX"
                    className="w-full glass rounded-xl p-3 pl-14 text-white text-sm bg-transparent outline-none focus:ring-1 focus:ring-purple-500/50"
                  />
                </div>
              </div>

              {/* Amount Input */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-400 block">Monto a transferir</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 font-medium">₡</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    placeholder="0"
                    className="w-full glass rounded-xl p-3 pl-8 text-white text-lg font-bold bg-transparent outline-none focus:ring-1 focus:ring-purple-500/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                {/* Quick Amounts */}
                <div className="grid grid-cols-4 gap-2">
                  {[1000, 5000, 10000, 25000].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setTransferAmount(String(amt))}
                      className={`py-2 rounded-xl text-xs font-medium transition-all ${
                        transferAmount === String(amt)
                          ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20'
                          : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {(amt / 1000)}k
                    </button>
                  ))}
                </div>
              </div>

              {/* Summary */}
              {transferAmount && (
                <div className="flex items-center justify-between text-xs glass rounded-lg px-3 py-2">
                  <span className="text-gray-500">Total a enviar</span>
                  <span className="text-white font-bold">{formatCurrency(parseInt(transferAmount))}</span>
                </div>
              )}

              {/* Warning */}
              {transferAmount && parseInt(transferAmount) > walletBalance && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
                  <Info className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-red-400">Saldo insuficiente para esta transferencia</p>
                </div>
              )}

              {/* Transfer Button */}
              <button
                type="button"
                onClick={handleTransfer}
                disabled={transferLoading || !transferPhone || !transferAmount || parseInt(transferAmount) < 500 || parseInt(transferAmount) > walletBalance}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
              >
                {transferLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Transferir {transferAmount ? formatCurrency(parseInt(transferAmount)) : ''}
                  </>
                )}
              </button>

              {/* Security Note */}
              <div className="flex items-start gap-2 p-2 rounded-lg bg-purple-500/5">
                <Shield className="w-3.5 h-3.5 text-purple-400 mt-0.5 shrink-0" />
                <p className="text-[10px] text-gray-500 leading-relaxed">
                  Las transferencias SINPE son inmediatas. Verifica el numero antes de enviar.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
