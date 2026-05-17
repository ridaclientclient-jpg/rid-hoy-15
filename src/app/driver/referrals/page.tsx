'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { supabase, type Driver } from '@/lib/supabase';
import { toast } from 'sonner';
import {
  Users, Gift, Copy, Check, Loader2, ChevronRight, Star,
  UserPlus, Trophy, Clock, TrendingUp, Share2, DollarSign,
} from 'lucide-react';

interface ReferralStats {
  driver_id: string;
  total_invited: number;
  total_completed: number;
  total_earned: number;
  total_pending: number;
  referral_code?: string;
}

interface ReferralReward {
  id: string;
  referrer_driver_id: string;
  referred_driver_id: string;
  referred_driver_name?: string;
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  completed_rides: number;
  created_at: string;
  reward_paid_at?: string;
}

function formatCurrency(amount: number): string {
  return `₡${Math.round(amount || 0).toLocaleString()}`;
}

export default function DriverReferrals() {
  const { user } = useAuthStore();
  const [driver, setDriver] = useState<Driver | null>(null);
  const [referralCode, setReferralCode] = useState('');
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [rewards, setRewards] = useState<ReferralReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [loadingCode, setLoadingCode] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      // Fetch driver
      const { data: driverData } = await supabase.from('drivers').select('*').eq('user_id', user.id).single();
      if (driverData) setDriver(driverData);

      const driverId = driverData?.id || user.id;

      // Check if driver has referral code, if not generate one
      try {
        const { data: codeData } = await supabase.rpc('assign_referral_code_to_driver', { p_driver_id: driverId });
        if (codeData) setReferralCode(codeData);
      } catch {
        // Code might already exist, try fetching from stats
      }

      // Fetch referral stats
      try {
        const { data: statsData } = await supabase
          .from('driver_referral_stats')
          .select('*')
          .eq('driver_id', driverId)
          .maybeSingle();
        if (statsData) {
          setStats(statsData as ReferralStats);
          if (statsData.referral_code && !referralCode) setReferralCode(statsData.referral_code);
        }
      } catch {}

      // If still no code, use a fallback based on driver id
      if (!referralCode) {
        setReferralCode(driverId.slice(0, 8).toUpperCase());
      }

      // Fetch referral rewards
      try {
        const { data: rewardsData } = await supabase
          .from('driver_referral_rewards')
          .select('*')
          .eq('referrer_driver_id', driverId)
          .order('created_at', { ascending: false });
        if (rewardsData) {
          const enriched = await Promise.all(
            (rewardsData as any[]).map(async (reward) => {
              try {
                const { data: referredDriver } = await supabase
                  .from('drivers')
                  .select('user_id')
                  .eq('id', reward.referred_driver_id)
                  .maybeSingle();
                if (referredDriver) {
                  const { data: profile } = await supabase
                    .from('profiles')
                    .select('name')
                    .eq('id', referredDriver.user_id)
                    .maybeSingle();
                  return { ...reward, referred_driver_name: profile?.name || 'Conductor' };
                }
              } catch {}
              return { ...reward, referred_driver_name: 'Conductor' };
            })
          );
          setRewards(enriched as ReferralReward[]);
        }
      } catch {}
    } catch (err) {
      console.error('Error fetching referral data:', err);
      toast.error('Error al cargar datos de referidos');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCopyCode = useCallback(() => {
    if (!referralCode) return;
    navigator.clipboard.writeText(referralCode).then(() => {
      setCopied(true);
      toast.success('Codigo copiado al portapapeles');
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      toast.error('No se pudo copiar');
    });
  }, [referralCode]);

  const handleShare = useCallback(async () => {
    if (!referralCode) return;
    const text = `Unete a RIDA como conductor! Usa mi codigo de referido: ${referralCode} y gana ₡5,000 extra despues de 5 viajes completados.`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Invitacion RIDA', text });
        return;
      } catch {}
    }
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Mensaje copiado para compartir');
    }).catch(() => {
      toast.error('No se pudo copiar');
    });
  }, [referralCode]);

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          <p className="text-sm text-gray-400">Cargando referidos...</p>
        </div>
      </div>
    );
  }

  const completedRewards = rewards.filter(r => r.status === 'completed');
  const pendingRewards = rewards.filter(r => r.status === 'pending');
  const totalEarnedAmount = completedRewards.reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-xl font-bold text-white">Referidos</h1>
        <p className="text-sm text-gray-400 mt-0.5">Invita conductores y gana dinero</p>
      </motion.div>

      {/* Referral Code Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="glass-strong rounded-2xl p-5 border border-cyan-500/20 text-center"
      >
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center mx-auto mb-3">
          <Users className="w-8 h-8 text-cyan-400" />
        </div>
        <p className="text-sm font-semibold text-white mb-1">Tu codigo de referido</p>
        <p className="text-xs text-gray-400 mb-4">Comparte este codigo con otros conductores</p>

        <div className="flex items-center gap-2 justify-center mb-4">
          <div className="glass-strong rounded-xl px-6 py-3 bg-white/5">
            <span className="text-2xl font-bold text-cyan-400 tracking-widest">{referralCode}</span>
          </div>
        </div>

        <div className="flex gap-2 justify-center">
          <button
            onClick={handleCopyCode}
            className="flex items-center gap-2 bg-cyan-500/15 text-cyan-400 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-cyan-500/25 transition-colors"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copiado!' : 'Copiar'}
          </button>
          <button
            onClick={handleShare}
            className="flex items-center gap-2 bg-purple-500/15 text-purple-400 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-purple-500/25 transition-colors"
          >
            <Share2 className="w-4 h-4" />
            Compartir
          </button>
        </div>
      </motion.div>

      {/* Reward Info Banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 rounded-2xl p-4"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0 mt-0.5">
            <Gift className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-emerald-300">Gana ₡5,000 por cada referido</p>
            <p className="text-xs text-gray-400 mt-1">
              Recibiras ₡5,000 cuando tu referido complete 5 viajes. Sin limite de referidos!
            </p>
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 gap-3"
      >
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <UserPlus className="w-4 h-4 text-cyan-400" />
            <span className="text-xs text-gray-500">Total invitados</span>
          </div>
          <p className="text-2xl font-bold text-white">{stats?.total_invited || rewards.length}</p>
        </div>
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Trophy className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-gray-500">Completados</span>
          </div>
          <p className="text-2xl font-bold text-emerald-400">{stats?.total_completed || completedRewards.length}</p>
        </div>
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <DollarSign className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-gray-500">Ganado</span>
          </div>
          <p className="text-2xl font-bold text-amber-400">{formatCurrency(totalEarnedAmount)}</p>
        </div>
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Clock className="w-4 h-4 text-orange-400" />
            <span className="text-xs text-gray-500">Pendiente</span>
          </div>
          <p className="text-2xl font-bold text-orange-400">{stats?.total_pending || pendingRewards.length}</p>
        </div>
      </motion.div>

      {/* Referred Drivers List */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <h2 className="text-sm font-semibold text-gray-400 flex items-center gap-2 mb-3">
          <Users className="w-4 h-4" />
          Conductores referidos
          {rewards.length > 0 && (
            <span className="text-[10px] bg-white/10 text-gray-400 px-2 py-0.5 rounded-full">{rewards.length}</span>
          )}
        </h2>

        {rewards.length === 0 ? (
          <div className="glass rounded-2xl p-8 text-center">
            <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500 font-medium">Aun no has referido a nadie</p>
            <p className="text-xs text-gray-600 mt-1">Comparte tu codigo para empezar a ganar</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {rewards.map((reward) => (
              <motion.div
                key={reward.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="glass rounded-2xl p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
                    {reward.referred_driver_name?.charAt(0) || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{reward.referred_driver_name}</p>
                    <p className="text-[10px] text-gray-500">
                      {reward.completed_rides}/5 viajes completados
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    {reward.status === 'completed' ? (
                      <>
                        <span className="text-sm font-bold text-emerald-400">+{formatCurrency(reward.amount)}</span>
                        <div className="flex items-center gap-0.5 justify-end mt-0.5">
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-[10px] text-emerald-400">Pagado</span>
                        </div>
                      </>
                    ) : reward.status === 'pending' ? (
                      <>
                        <span className="text-sm font-bold text-orange-400">{formatCurrency(reward.amount)}</span>
                        <div className="flex items-center gap-0.5 justify-end mt-0.5">
                          <Clock className="w-3 h-3 text-orange-400" />
                          <span className="text-[10px] text-orange-400">{reward.completed_rides}/5</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <span className="text-sm font-bold text-gray-500">{formatCurrency(reward.amount)}</span>
                        <div className="flex items-center gap-0.5 justify-end mt-0.5">
                          <XIcon className="w-3 h-3 text-gray-500" />
                          <span className="text-[10px] text-gray-500">Inactivo</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Progress bar for pending */}
                {reward.status === 'pending' && (
                  <div className="mt-3">
                    <div className="w-full bg-white/5 rounded-full h-1.5">
                      <motion.div
                        className="h-1.5 rounded-full bg-gradient-to-r from-orange-500 to-cyan-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${(reward.completed_rides / 5) * 100}%` }}
                        transition={{ duration: 0.8 }}
                      />
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1">
                      Falta{5 - reward.completed_rides !== 1 ? 'n' : ''} {5 - reward.completed_rides} viaje{5 - reward.completed_rides !== 1 ? 's' : ''} para desbloquear
                    </p>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}

// Need XIcon for failed status
function XIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
  );
}
