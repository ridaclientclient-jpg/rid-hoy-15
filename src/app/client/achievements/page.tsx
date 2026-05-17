'use client';

import { motion } from 'framer-motion';
import {
  Trophy,
  Star,
  Medal,
  Award,
  Crown,
  Clock,
  Moon,
  Target,
  Users,
  Heart,
  ThumbsUp,
  Zap,
  Loader2,
  Lock,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import { useState, useEffect, useCallback } from 'react';

// ─── Types ──────────────────────────────────────────
interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  gradient: string;
  glowColor: string;
  threshold: number;
  metricKey: string;
}

interface AchievementState {
  def: AchievementDef;
  unlocked: boolean;
  progress: number;
  earnedDate?: string;
}

// ─── Achievement Definitions ───────────────────────
const ACHIEVEMENT_DEFS: AchievementDef[] = [
  {
    id: 'primer_viaje',
    title: 'Primer Viaje',
    description: 'Completa tu primer viaje',
    icon: Zap,
    gradient: 'from-emerald-500 to-cyan-400',
    glowColor: 'shadow-emerald-500/40',
    threshold: 1,
    metricKey: 'completedRides',
  },
  {
    id: 'viajero_frecuente',
    title: 'Viajero Frecuente',
    description: 'Completa 10 viajes',
    icon: Star,
    gradient: 'from-amber-400 to-orange-500',
    glowColor: 'shadow-amber-500/40',
    threshold: 10,
    metricKey: 'completedRides',
  },
  {
    id: 'explorador',
    title: 'Explorador',
    description: 'Completa 50 viajes',
    icon: Trophy,
    gradient: 'from-purple-500 to-pink-500',
    glowColor: 'shadow-purple-500/40',
    threshold: 50,
    metricKey: 'completedRides',
  },
  {
    id: 'critico_constructivo',
    title: 'Critico Constructivo',
    description: 'Deja 5 calificaciones',
    icon: ThumbsUp,
    gradient: 'from-blue-400 to-indigo-500',
    glowColor: 'shadow-blue-500/40',
    threshold: 5,
    metricKey: 'ratingsGiven',
  },
  {
    id: 'generoso',
    title: 'Generoso',
    description: 'Da 3 propinas',
    icon: Heart,
    gradient: 'from-pink-500 to-rose-500',
    glowColor: 'shadow-pink-500/40',
    threshold: 3,
    metricKey: 'tipsGiven',
  },
  {
    id: 'social',
    title: 'Social',
    description: 'Divide 3 tarifas',
    icon: Users,
    gradient: 'from-teal-400 to-emerald-500',
    glowColor: 'shadow-teal-500/40',
    threshold: 3,
    metricKey: 'faresSplit',
  },
  {
    id: 'puntual',
    title: 'Puntual',
    description: 'Nunca canceles en 10 viajes',
    icon: Clock,
    gradient: 'from-cyan-400 to-blue-500',
    glowColor: 'shadow-cyan-500/40',
    threshold: 10,
    metricKey: 'punctualRides',
  },
  {
    id: 'nocturno',
    title: 'Nocturno',
    description: 'Completa un viaje despues de las 10pm',
    icon: Moon,
    gradient: 'from-indigo-500 to-violet-600',
    glowColor: 'shadow-indigo-500/40',
    threshold: 1,
    metricKey: 'nightRides',
  },
  {
    id: 'maratonista',
    title: 'Maratonista',
    description: 'Recorre 100km en total',
    icon: Medal,
    gradient: 'from-orange-400 to-red-500',
    glowColor: 'shadow-orange-500/40',
    threshold: 100,
    metricKey: 'totalDistance',
  },
  {
    id: 'vip',
    title: 'VIP',
    description: 'Gasta ₡100,000 en total',
    icon: Crown,
    gradient: 'from-yellow-400 to-amber-500',
    glowColor: 'shadow-yellow-500/40',
    threshold: 100000,
    metricKey: 'totalSpent',
  },
];

// ─── Helpers ───────────────────────────────────────
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-CR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ─── Container animation variants ──────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 300, damping: 25 },
  },
};

// ─── Component ─────────────────────────────────────
export default function ClientAchievements() {
  const { user } = useAuthStore();
  const [achievements, setAchievements] = useState<AchievementState[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAchievements = useCallback(async (userId: string) => {
    try {
      // Fetch all rides for this user
      const { data: rides, error: ridesError } = await supabase
        .from('rides')
        .select('*')
        .eq('rider_id', userId);

      const ridesList = rides || [];

      // Compute metrics from ride history
      const completedRides = ridesList.filter(r => r.status === 'completed');
      const completedCount = completedRides.length;

      // Ratings given (rides where rider left a driver_rating)
      const ratingsGiven = completedRides.filter(
        r => r.driver_rating != null && r.driver_rating > 0,
      ).length;

      // Tips given (rides with tip_amount field, fallback: check transactions)
      let tipsGiven = 0;
      const { data: tipTx } = await supabase
        .from('transactions')
        .select('id')
        .eq('wallet_id', userId)
        .like('description', '%propina%');
      tipsGiven = tipTx?.length || 0;

      // Fares split (check split_fare_records if they exist)
      let faresSplit = 0;
      try {
        const { count: splitCount } = await supabase
          .from('fare_splits')
          .select('*', { count: 'exact', head: true })
          .eq('initiator_id', userId);
        faresSplit = splitCount || 0;
      } catch {
        // Table may not exist
      }

      // Punctual: last 10 rides have no cancellations
      const lastTenRides = [...ridesList]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10);
      const hasCancelInLast10 = lastTenRides.some(r => r.status === 'cancelled');
      const punctualRides = hasCancelInLast10 ? 0 : (lastTenRides.length >= 10 ? 10 : lastTenRides.filter(r => r.status === 'completed').length);

      // Night rides: completed rides created after 10pm local
      const nightRides = completedRides.filter(r => {
        const date = new Date(r.created_at);
        return date.getHours() >= 22 || date.getHours() < 5;
      }).length;

      // Total distance
      const totalDistance = completedRides.reduce((sum, r) => sum + (r.distance || 0), 0);

      // Total spent
      const totalSpent = completedRides.reduce((sum, r) => sum + (r.price || 0), 0);

      const metrics: Record<string, number> = {
        completedRides: completedCount,
        ratingsGiven,
        tipsGiven,
        faresSplit,
        punctualRides,
        nightRides,
        totalDistance: Math.round(totalDistance * 10) / 10,
        totalSpent: Math.round(totalSpent),
      };

      // Check for existing user_achievements records
      let existingAchievements: Record<string, string> = {};
      try {
        const { data: ua } = await supabase
          .from('user_achievements')
          .select('achievement_id, earned_at')
          .eq('user_id', userId);
        if (ua) {
          ua.forEach((row: { achievement_id: string; earned_at: string }) => {
            existingAchievements[row.achievement_id] = row.earned_at;
          });
        }
      } catch {
        // Table may not exist yet
      }

      // Build achievement states
      const states: AchievementState[] = ACHIEVEMENT_DEFS.map(def => {
        const value = metrics[def.metricKey] || 0;
        const unlocked = value >= def.threshold;
        const progress = Math.min(value / def.threshold, 1);
        const earnedDate = existingAchievements[def.id];

        // Auto-unlock: if metrics meet threshold but no record, create one
        if (unlocked && !earnedDate) {
          try {
            supabase
              .from('user_achievements')
              .upsert(
                {
                  user_id: userId,
                  achievement_id: def.id,
                  earned_at: new Date().toISOString(),
                },
                { onConflict: 'user_id,achievement_id' },
              )
              .then();
          } catch {
            // Ignore
          }
        }

        return {
          def,
          unlocked: unlocked || !!earnedDate,
          progress,
          earnedDate: earnedDate || (unlocked ? new Date().toISOString() : undefined),
        };
      });

      setAchievements(states);
    } catch (err) {
      console.error('Achievements fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.id) {
      fetchAchievements(user.id);
    }
  }, [user?.id, fetchAchievements]);

  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const totalCount = achievements.length;

  // ─── Loading State ─────────────────────────────────
  if (loading) {
    return (
      <div className="p-4 space-y-6">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-xl font-bold text-white">Logros</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Desbloquea logros usando RIDA
        </p>
      </motion.div>

      {/* Summary Banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="bg-gradient-to-br from-amber-500/20 via-orange-500/10 to-transparent glass-strong rounded-2xl p-5 border border-amber-500/20"
      >
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Award className="w-8 h-8 text-white" />
            </div>
            {/* Badge count */}
            <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center text-xs font-bold text-white border-2 border-[#0a0e1a]">
              {unlockedCount}
            </div>
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-white">
              {unlockedCount}/{totalCount} Logros
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              {unlockedCount === totalCount
                ? 'Has desbloqueado todos los logros. Eres un maestro RIDA!'
                : unlockedCount === 0
                  ? 'Completa viajes para desbloquear tu primer logro'
                  : `Sigue asi! Te faltan ${totalCount - unlockedCount} logros`}
            </p>
            {/* Progress bar */}
            <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(unlockedCount / totalCount) * 100}%` }}
                transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Unlocked Section */}
      {unlockedCount > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <h3 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-2">
            <Trophy className="w-4 h-4" />
            Desbloqueados ({unlockedCount})
          </h3>
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-2 gap-3"
          >
            {achievements
              .filter(a => a.unlocked)
              .map((ach, i) => {
                const Icon = ach.def.icon;
                return (
                  <motion.div
                    key={ach.def.id}
                    variants={cardVariants}
                    className="glass-strong rounded-2xl p-4 relative overflow-hidden group"
                  >
                    {/* Background glow */}
                    <div
                      className={`absolute inset-0 bg-gradient-to-br ${ach.def.gradient} opacity-5 group-hover:opacity-10 transition-opacity`}
                    />

                    <div className="relative z-10">
                      {/* Icon */}
                      <div
                        className={`w-12 h-12 rounded-xl bg-gradient-to-br ${ach.def.gradient} flex items-center justify-center shadow-lg ${ach.def.glowColor} mb-3`}
                      >
                        <Icon className="w-6 h-6 text-white" />
                      </div>

                      {/* Text */}
                      <h4 className="text-sm font-bold text-white leading-tight">
                        {ach.def.title}
                      </h4>
                      <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">
                        {ach.def.description}
                      </p>

                      {/* Earned date */}
                      {ach.earnedDate && (
                        <div className="flex items-center gap-1 mt-2">
                          <div className="w-1 h-1 rounded-full bg-emerald-400" />
                          <span className="text-[9px] text-emerald-400/80">
                            {formatDate(ach.earnedDate)}
                          </span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
          </motion.div>
        </motion.div>
      )}

      {/* Locked Section */}
      {unlockedCount < totalCount && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 + unlockedCount * 0.04 }}
        >
          <h3 className="text-sm font-semibold text-gray-500 mb-3 flex items-center gap-2">
            <Lock className="w-4 h-4" />
            Por desbloquear ({totalCount - unlockedCount})
          </h3>
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-2.5"
          >
            {achievements
              .filter(a => !a.unlocked)
              .map((ach) => {
                const Icon = ach.def.icon;
                const progressPct = Math.round(ach.progress * 100);
                const metricLabels: Record<string, string> = {
                  completedRides: `${ach.progress * ach.def.threshold}/${ach.def.threshold} viajes`,
                  ratingsGiven: `${ach.progress * ach.def.threshold}/${ach.def.threshold} calificaciones`,
                  tipsGiven: `${ach.progress * ach.def.threshold}/${ach.def.threshold} propinas`,
                  faresSplit: `${ach.progress * ach.def.threshold}/${ach.def.threshold} tarifas divididas`,
                  punctualRides: `${ach.progress * ach.def.threshold}/${ach.def.threshold} viajes sin cancelar`,
                  nightRides: `${ach.progress * ach.def.threshold}/${ach.def.threshold} viajes nocturnos`,
                  totalDistance: `${Math.round(ach.progress * ach.def.threshold)}/100 km`,
                  totalSpent: `₡${Math.round(ach.progress * ach.def.threshold).toLocaleString('es-CR')}/₡100,000`,
                };

                return (
                  <motion.div
                    key={ach.def.id}
                    variants={cardVariants}
                    className="glass rounded-xl p-3.5 opacity-60 hover:opacity-80 transition-opacity"
                  >
                    <div className="flex items-center gap-3">
                      {/* Locked icon */}
                      <div
                        className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0`}
                      >
                        <Icon className="w-5 h-5 text-gray-600" />
                      </div>

                      {/* Text + progress */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium text-gray-400">
                            {ach.def.title}
                          </h4>
                          {progressPct > 0 && (
                            <span className="text-[10px] text-cyan-400/70 font-medium">
                              {progressPct}%
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-600 mt-0.5">
                          {ach.def.description}
                        </p>

                        {/* Progress bar */}
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${progressPct}%` }}
                              transition={{ duration: 0.6, ease: 'easeOut' }}
                              className="h-full rounded-full bg-gradient-to-r from-cyan-500/40 to-blue-500/40"
                            />
                          </div>
                          <span className="text-[9px] text-gray-600 shrink-0">
                            {metricLabels[ach.def.metricKey] || `${progressPct}%`}
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
          </motion.div>
        </motion.div>
      )}

      {/* All achievements unlocked celebration */}
      {unlockedCount === totalCount && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, type: 'spring', stiffness: 200 }}
          className="glass-strong rounded-2xl p-6 text-center border border-amber-500/20"
        >
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-amber-500/30">
            <Crown className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-lg font-bold text-white">Maestro RIDA</h3>
          <p className="text-xs text-gray-400 mt-1">
            Has desbloqueado todos los logros disponibles. Eres un usuario legendario!
          </p>
        </motion.div>
      )}
    </div>
  );
}
