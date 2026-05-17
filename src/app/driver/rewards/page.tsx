'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { supabase, type Driver } from '@/lib/supabase';
import {
  Zap, Award, Shield, Trophy, Diamond, Star, Car,
  Wallet, Target, ChevronUp, Lock, CheckCircle2,
  Lightbulb, TrendingUp, Loader2, CircleDollarSign,
  Rocket, Timer, Heart, ThumbsUp, ThumbsDown, MapPin, Sparkles,
  ChevronDown, X, AlertTriangle,
} from 'lucide-react';

// ─── Level System ─────────────────────────────────────
const LEVELS = [
  { name: 'Basico', icon: Zap, minTrips: 0, color: 'from-gray-500 to-gray-400', textColor: 'text-gray-300', bgColor: 'bg-gray-500/20', borderGlow: '' },
  { name: 'Bronce', icon: Award, minTrips: 20, color: 'from-amber-700 to-amber-600', textColor: 'text-amber-500', bgColor: 'bg-amber-500/20', borderGlow: 'shadow-amber-600/20' },
  { name: 'Plata', icon: Shield, minTrips: 50, color: 'from-gray-300 to-gray-200', textColor: 'text-gray-200', bgColor: 'bg-gray-300/20', borderGlow: 'shadow-gray-300/20' },
  { name: 'Oro', icon: Trophy, minTrips: 100, color: 'from-yellow-500 to-amber-400', textColor: 'text-yellow-400', bgColor: 'bg-yellow-500/20', borderGlow: 'shadow-yellow-500/20' },
  { name: 'Platino', icon: Diamond, minTrips: 200, color: 'from-cyan-400 to-blue-400', textColor: 'text-cyan-400', bgColor: 'bg-cyan-400/20', borderGlow: 'shadow-cyan-400/20' },
  { name: 'Diamante', icon: Diamond, minTrips: 500, color: 'from-purple-400 to-pink-400', textColor: 'text-purple-400', bgColor: 'bg-purple-400/20', borderGlow: 'shadow-purple-400/20' },
];

// Map name to icon
const LEVEL_ICON_MAP: Record<string, typeof Zap> = {
  'Basico': Zap,
  'Bronce': Award,
  'Plata': Shield,
  'Oro': Trophy,
  'Platino': Diamond,
  'Diamante': Diamond,
};

// Map name to visual style
const LEVEL_STYLE_MAP: Record<string, { color: string; textColor: string; bgColor: string; borderGlow: string }> = {
  'Basico':   { color: 'from-gray-500 to-gray-400', textColor: 'text-gray-300', bgColor: 'bg-gray-500/20', borderGlow: '' },
  'Bronce':   { color: 'from-amber-700 to-amber-600', textColor: 'text-amber-500', bgColor: 'bg-amber-500/20', borderGlow: 'shadow-amber-600/20' },
  'Plata':    { color: 'from-gray-300 to-gray-200', textColor: 'text-gray-200', bgColor: 'bg-gray-300/20', borderGlow: 'shadow-gray-300/20' },
  'Oro':      { color: 'from-yellow-500 to-amber-400', textColor: 'text-yellow-400', bgColor: 'bg-yellow-500/20', borderGlow: 'shadow-yellow-500/20' },
  'Platino':  { color: 'from-cyan-400 to-blue-400', textColor: 'text-cyan-400', bgColor: 'bg-cyan-400/20', borderGlow: 'shadow-cyan-400/20' },
  'Diamante': { color: 'from-purple-400 to-pink-400', textColor: 'text-purple-400', bgColor: 'bg-purple-400/20', borderGlow: 'shadow-purple-400/20' },
};

// Benefits per level (fallback values)
const LEVEL_BENEFITS = [
  { commissionDiscount: 0, bonusPerRide: 0, priorityMatching: false, priorityLevel: 0 },
  { commissionDiscount: 1, bonusPerRide: 100, priorityMatching: false, priorityLevel: 0 },
  { commissionDiscount: 2, bonusPerRide: 250, priorityMatching: false, priorityLevel: 1 },
  { commissionDiscount: 3, bonusPerRide: 500, priorityMatching: true, priorityLevel: 2 },
  { commissionDiscount: 5, bonusPerRide: 750, priorityMatching: true, priorityLevel: 3 },
  { commissionDiscount: 7, bonusPerRide: 1000, priorityMatching: true, priorityLevel: 4 },
];

// Supabase reward level type (matches unified schema)
interface RewardLevel {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  sort_order: number;
  min_rides: number;
  min_rating: number;
  max_cancellation_rate: number;
  min_acceptance_rate: number;
  bonus_per_ride: number;
  commission_discount: number;
  priority_matching: boolean;
  priority_level: number;
  icon?: string;
  color?: string;
  created_at: string;
  updated_at?: string;
}

// Tips data
const LEVEL_UP_TIPS = [
  {
    icon: Star,
    text: 'Mantén tu calificación arriba de 4.85',
    color: 'text-amber-400',
    description: 'Saluda al subir cada pasajero y despídete amablemente al llegar. Mantén tu vehículo limpio, con buen olor y cómodo. Sé puntual: llega al punto de recogida antes de la hora estimada. Ofrece pequeños detalles como cargar el teléfono o ajustar el aire acondicionado. Conduce de forma suave, sin frenadas bruscas ni aceleraciones fuertes. Un pasajero satisfecho siempre te dará 5 estrellas.',
  },
  {
    icon: Car,
    text: 'Completa más viajes para subir de nivel',
    color: 'text-cyan-400',
    description: 'Mantente conectado el mayor tiempo posible durante tus horas de conducción. Acepta viajes de forma activa en lugar de esperar los más largos. Los viajes cortos también cuentan para tu total, así que no los rechaces. Establece una meta diaria de viajes: por ejemplo, 8-12 viajes al día te ayudará a subir de nivel rápidamente. Revisa tu progreso en esta pantalla para mantenerte motivado.',
  },
  {
    icon: ThumbsUp,
    text: 'Evita cancelaciones para mantener tu progreso',
    color: 'text-emerald-400',
    description: 'Solo acepta viajes que realmente puedas completar. Antes de aceptar, revisa la dirección de destino y asegúrate de que está en tu zona. Si no puedes completar un viaje, es mejor no aceptarlo desde el principio. Planifica tus pausas y descansos fuera de las horas pico para no tener que cancelar. Las cancelaciones frecuentes afectan tu nivel y pueden reducir la cantidad de viajes que recibes.',
  },
  {
    icon: Timer,
    text: 'Conduce en horarios pico para más solicitudes',
    color: 'text-blue-400',
    description: 'Los horarios con mayor demanda son: de 6:00 a 9:00 AM (horas de entrada al trabajo), de 12:00 a 2:00 PM (hora de almuerzo) y de 4:00 a 8:00 PM (salida del trabajo). Los viernes y sábados por la noche también hay alta demanda. Los días festivos y eventos especiales generan picos extra de solicitudes. Conectar durante estos horarios te garantiza más viajes en menos tiempo.',
  },
  {
    icon: Heart,
    text: 'Mantén una buena actitud con los pasajeros',
    color: 'text-pink-400',
    description: 'Sonríe y saluda siempre, la primera impresión cuenta mucho. Pregunta si el pasajero tiene preferencia de temperatura o música. Ayuda con equipaje o paquetes cuando sea necesario. Mantén conversaciones respetuosas y no invadas la privacidad del pasajero. No uses el celular mientras conduces, esto genera confianza. Un buen trato se traduce directamente en mejores calificaciones y más propinas.',
  },
  {
    icon: MapPin,
    text: 'Conduce en zonas de alta demanda',
    color: 'text-orange-400',
    description: 'Posiciónate cerca de centros comerciales, zonas de oficinas, hospitales, universidades y aeropuertos. Las áreas cercanas a bares y restaurantes tienen alta demanda en horarios nocturnos. Los hoteles y terminales de transporte son puntos constantes de solicitud. Mantente atento a eventos deportivos, conciertos o ferias que generen movimiento extra. Conocer las zonas más activas de tu ciudad te dará una ventaja para recibir más viajes.',
  },
];

function getLevelStyle(levelName: string) {
  return LEVEL_STYLE_MAP[levelName] || LEVEL_STYLE_MAP['Basico']!;
}

function getLevelIndex(levelName: string) {
  return LEVELS.findIndex(l => l.name === levelName);
}

function getLevelBenefits(levelName: string, dbLevels: RewardLevel[]) {
  if (dbLevels.length > 0) {
    const match = dbLevels.find(l => l.name === levelName && l.is_active);
    if (match) {
      return {
        commissionDiscount: match.commission_discount || 0,
        bonusPerRide: match.bonus_per_ride || 0,
        priorityMatching: match.priority_matching || false,
        priorityLevel: match.priority_level || 0,
      };
    }
  }
  const idx = getLevelIndex(levelName);
  return LEVEL_BENEFITS[idx >= 0 ? idx : 0];
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

export default function DriverRewards() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [dbLevels, setDbLevels] = useState<RewardLevel[]>([]);
  const [expandedTip, setExpandedTip] = useState<number | null>(null);
  const [expandedLevel, setExpandedLevel] = useState<number | null>(null);
  const [levelNotification, setLevelNotification] = useState<{ type: 'up' | 'down'; from: string; to: string } | null>(null);

  const totalRides = driver?.total_rides || 0;
  const rating = driver?.rating || 0;
  const totalEarnings = driver?.total_earnings || 0;

  // Use DB-level from driver record (auto-calculated by trigger), fallback to trips-based
  const _fallbackIdx = (() => { let idx = 0; for (let i = 0; i < LEVELS.length; i++) { if (totalRides >= LEVELS[i].minTrips) idx = i; } return idx; })();
  const currentLevelName = driver?.reward_level || LEVELS[_fallbackIdx].name;
  const currentLevelIndex = getLevelIndex(currentLevelName);
  const currentLevel = LEVELS[currentLevelIndex >= 0 ? currentLevelIndex : 0];
  const currentStyle = getLevelStyle(currentLevelName);
  const currentBenefits = getLevelBenefits(currentLevelName, dbLevels);

  const nextLevel = (() => {
    // Try from DB levels first
    if (dbLevels.length > 0) {
      const nl = dbLevels.find(l => l.is_active && l.min_rides > totalRides);
      if (nl) return LEVELS.find(l => l.name === nl.name) || null;
    }
    // Fallback
    for (const l of LEVELS) { if (totalRides < l.minTrips) return l; }
    return null;
  })();

  const progressPercent = nextLevel
    ? ((totalRides - currentLevel.minTrips) / (nextLevel.minTrips - currentLevel.minTrips)) * 100
    : 100;
  const tripsToNext = nextLevel ? nextLevel.minTrips - totalRides : 0;

  // Detect level change and show notification
  useEffect(() => {
    if (driver?.previous_level && driver?.reward_level && driver.previous_level !== driver.reward_level) {
      const isUp = getLevelIndex(driver.reward_level) > getLevelIndex(driver.previous_level);
      setLevelNotification({ type: isUp ? 'up' : 'down', from: driver.previous_level, to: driver.reward_level });
      const timer = setTimeout(() => setLevelNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [driver?.reward_level, driver?.previous_level]);

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      // Fetch driver data
      const { data: driverData } = await supabase
        .from('drivers')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (driverData) setDriver(driverData);

      // Fetch reward levels from Supabase (unified schema)
      const { data: levelsData } = await supabase
        .from('reward_levels')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (levelsData && levelsData.length > 0) {
        setDbLevels(levelsData);
      }
    } catch (err) {
      console.error('Error fetching rewards data:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          <p className="text-sm text-gray-400">Cargando premios...</p>
        </div>
      </div>
    );
  }

  const CurrentLevelIcon = currentLevel.icon;

  // Use precalculated rates from DB (calculated by trigger)
  const acceptanceRate = driver?.acceptance_rate || 0;
  const cancellationRate = driver?.cancellation_rate || 0;

  // Get next level DB data for criteria display
  const nextDbLevel = (() => {
    if (dbLevels.length === 0) return null;
    const curSort = dbLevels.find(l => l.name === currentLevelName)?.sort_order ?? -1;
    return dbLevels.find(l => l.is_active && l.sort_order > curSort) || null;
  })();

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="p-4 space-y-4"
    >
      {/* ─── Level Change Notification ────────── */}
      <AnimatePresence>
        {levelNotification && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-4 left-4 right-4 z-50 p-4 rounded-2xl border shadow-2xl ${
              levelNotification.type === 'up'
                ? 'bg-gradient-to-r from-emerald-900/90 to-emerald-800/90 border-emerald-500/30'
                : 'bg-gradient-to-r from-amber-900/90 to-red-900/90 border-amber-500/30'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                levelNotification.type === 'up'
                  ? 'bg-emerald-500/20'
                  : 'bg-amber-500/20'
              }`}>
                {levelNotification.type === 'up'
                  ? <TrendingUp className="w-5 h-5 text-emerald-400" />
                  : <TrendingUp className="w-5 h-5 text-amber-400 rotate-180" />
                }
              </div>
              <div>
                <p className={`text-sm font-bold ${levelNotification.type === 'up' ? 'text-emerald-300' : 'text-amber-300'}`}>
                  {levelNotification.type === 'up' ? 'Subiste de nivel!' : 'Tu nivel bajó'}
                </p>
                <p className="text-xs text-gray-300">
                  {levelNotification.from} → <span className="font-bold text-white">{levelNotification.to}</span>
                </p>
              </div>
              <button
                onClick={() => setLevelNotification(null)}
                className="ml-auto p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* ─── Page Header ─────────────────────────────── */}
      <motion.div variants={item}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-600 to-purple-600 flex items-center justify-center">
            <Trophy className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Premios & Niveles</h1>
            <p className="text-xs text-gray-400">Gana beneficios por tu rendimiento</p>
          </div>
        </div>
      </motion.div>

      {/* ─── A) Current Level Card ───────────────────── */}
      <motion.div
        variants={item}
        className={`relative overflow-hidden rounded-2xl border ${
          currentLevel.borderGlow
            ? `border-white/10 shadow-lg ${currentLevel.borderGlow}`
            : 'border-white/10'
        }`}
      >
        {/* Gradient background */}
        <div className={`absolute inset-0 bg-gradient-to-br ${currentLevel.color} opacity-15`} />
        <div className="relative p-5">
          {/* Level badge + icon */}
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${currentLevel.color} flex items-center justify-center shadow-lg`}>
              <CurrentLevelIcon className="w-7 h-7 text-white" />
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Tu nivel actual</p>
              <p className={`text-2xl font-extrabold ${currentLevel.textColor}`}>{currentLevel.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">{totalRides} viajes completados</p>
            </div>
          </div>

          {/* Progress bar to next level */}
          {nextLevel ? (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-gray-400">Progreso a {nextLevel.name}</span>
                <span className="text-xs font-bold text-white">
                  {tripsToNext > 0 ? `${tripsToNext} viajes restantes` : 'Nivel máximo'}
                </span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(progressPercent, 100)}%` }}
                  transition={{ duration: 1.2, delay: 0.3, ease: 'easeOut' }}
                  className={`h-3 rounded-full bg-gradient-to-r ${nextLevel.color} relative`}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent" />
                </motion.div>
              </div>
              <p className="text-[10px] text-gray-500 mt-1">
                {totalRides} / {nextLevel.minTrips} viajes
              </p>
            </div>
          ) : (
            <div className="mb-4 p-3 rounded-xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-bold text-purple-300">Has alcanzado el nivel máximo</span>
              </div>
            </div>
          )}

          {/* Current benefits preview - commission hidden from driver view */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/5 rounded-xl p-2.5 text-center">
              <CircleDollarSign className="w-3.5 h-3.5 text-amber-400 mx-auto mb-1" />
              <p className="text-sm font-bold text-white">+₡{currentBenefits.bonusPerRide}</p>
              <p className="text-[9px] text-gray-500">Bono/viaje</p>
            </div>
            <div className="bg-white/5 rounded-xl p-2.5 text-center">
              <Rocket className={`w-3.5 h-3.5 mx-auto mb-1 ${currentBenefits.priorityMatching ? 'text-cyan-400' : 'text-gray-500'}`} />
              <p className={`text-sm font-bold ${currentBenefits.priorityMatching ? 'text-white' : 'text-gray-500'}`}>
                {currentBenefits.priorityMatching ? 'Si' : 'No'}
              </p>
              <p className="text-[9px] text-gray-500">Prioridad</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ─── D) Stats Summary (6 metrics) ───────────── */}
      <motion.div variants={item} className="grid grid-cols-3 gap-2">
        <div className="glass rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Car className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[9px] text-gray-500">Viajes</span>
          </div>
          <p className="text-lg font-bold text-white">{totalRides}</p>
        </div>
        <div className="glass rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            <span className="text-[9px] text-gray-500">Rating</span>
          </div>
          <p className="text-lg font-bold text-white">{rating > 0 ? rating.toFixed(2) : '\u2014'}</p>
        </div>
        <div className="glass rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <ThumbsUp className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[9px] text-gray-500">Aceptación</span>
          </div>
          <p className={`text-lg font-bold ${acceptanceRate >= 70 ? 'text-emerald-400' : acceptanceRate >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
            {acceptanceRate > 0 ? `${acceptanceRate.toFixed(0)}%` : '\u2014'}
          </p>
        </div>
        <div className="glass rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <ThumbsDown className="w-3.5 h-3.5 text-red-400" />
            <span className="text-[9px] text-gray-500">Cancelación</span>
          </div>
          <p className={`text-lg font-bold ${cancellationRate <= 10 ? 'text-emerald-400' : cancellationRate <= 20 ? 'text-amber-400' : 'text-red-400'}`}>
            {cancellationRate > 0 ? `${cancellationRate.toFixed(0)}%` : '\u2014'}
          </p>
        </div>
        <div className="glass rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Wallet className="w-3.5 h-3.5 text-violet-400" />
            <span className="text-[9px] text-gray-500">Ganancias</span>
          </div>
          <p className="text-sm font-bold text-white">
            ₡{totalEarnings >= 1000000
              ? `${(totalEarnings / 1000000).toFixed(1)}M`
              : `${Math.round(totalEarnings / 1000)}k`}
          </p>
        </div>
        <div className="glass rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <ChevronUp className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-[9px] text-gray-500">Para subir</span>
          </div>
          <p className="text-lg font-bold text-white">
            {tripsToNext > 0 ? tripsToNext : '\u2014'}
          </p>
        </div>
      </motion.div>

      {/* ─── D2) Next Level Requirements ──────────── */}
      {nextDbLevel && (
        <motion.div variants={item} className="glass rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/20 to-cyan-500/20 flex items-center justify-center">
              <Target className="w-4 h-4 text-amber-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-bold text-white">Requisitos para {nextDbLevel.name}</h2>
              <p className="text-[10px] text-gray-500">Debes cumplir todos los criterios</p>
            </div>
          </div>
          <div className="space-y-2">
            {/* Viajes */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/5">
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-md flex items-center justify-center ${totalRides >= nextDbLevel.min_rides ? 'bg-emerald-500/20' : 'bg-white/5'}`}>
                  <CheckCircle2 className={`w-3.5 h-3.5 ${totalRides >= nextDbLevel.min_rides ? 'text-emerald-400' : 'text-gray-500'}`} />
                </div>
                <span className="text-xs text-gray-300">Viajes completados</span>
              </div>
              <div className="text-right">
                <span className={`text-xs font-bold ${totalRides >= nextDbLevel.min_rides ? 'text-emerald-400' : 'text-white'}`}>
                  {totalRides} / {nextDbLevel.min_rides}
                </span>
              </div>
            </div>
            {/* Rating */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/5">
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-md flex items-center justify-center ${rating >= nextDbLevel.min_rating ? 'bg-emerald-500/20' : 'bg-white/5'}`}>
                  <CheckCircle2 className={`w-3.5 h-3.5 ${rating >= nextDbLevel.min_rating ? 'text-emerald-400' : 'text-gray-500'}`} />
                </div>
                <span className="text-xs text-gray-300">Rating mínimo</span>
              </div>
              <span className={`text-xs font-bold ${rating >= nextDbLevel.min_rating ? 'text-emerald-400' : 'text-white'}`}>
                {rating.toFixed(2)} / {nextDbLevel.min_rating.toFixed(2)}
              </span>
            </div>
            {/* Cancelación */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/5">
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-md flex items-center justify-center ${cancellationRate <= nextDbLevel.max_cancellation_rate ? 'bg-emerald-500/20' : 'bg-white/5'}`}>
                  <CheckCircle2 className={`w-3.5 h-3.5 ${cancellationRate <= nextDbLevel.max_cancellation_rate ? 'text-emerald-400' : 'text-gray-500'}`} />
                </div>
                <span className="text-xs text-gray-300">Cancelación máx.</span>
              </div>
              <span className={`text-xs font-bold ${cancellationRate <= nextDbLevel.max_cancellation_rate ? 'text-emerald-400' : 'text-white'}`}>
                {cancellationRate.toFixed(0)}% / {nextDbLevel.max_cancellation_rate.toFixed(0)}%
              </span>
            </div>
            {/* Aceptación */}
            {nextDbLevel.min_acceptance_rate > 0 && (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/5">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center ${acceptanceRate >= nextDbLevel.min_acceptance_rate ? 'bg-emerald-500/20' : 'bg-white/5'}`}>
                    <CheckCircle2 className={`w-3.5 h-3.5 ${acceptanceRate >= nextDbLevel.min_acceptance_rate ? 'text-emerald-400' : 'text-gray-500'}`} />
                  </div>
                  <span className="text-xs text-gray-300">Aceptación mín.</span>
                </div>
                <span className={`text-xs font-bold ${acceptanceRate >= nextDbLevel.min_acceptance_rate ? 'text-emerald-400' : 'text-white'}`}>
                  {acceptanceRate.toFixed(0)}% / {nextDbLevel.min_acceptance_rate.toFixed(0)}%
                </span>
              </div>
            )}
            {/* Warning if any criteria not met */}
            {(
              totalRides < nextDbLevel.min_rides ||
              rating < nextDbLevel.min_rating ||
              cancellationRate > nextDbLevel.max_cancellation_rate ||
              acceptanceRate < nextDbLevel.min_acceptance_rate
            ) && (
              <div className="mt-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                  <p className="text-[10px] text-amber-300/90">
                    Debes cumplir los criterios en verde para subir a {nextDbLevel.name}
                  </p>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* ─── C) Level Benefits Detail ────────────────── */}
      <motion.div variants={item} className="glass rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${currentLevel.color} flex items-center justify-center`}>
            <CurrentLevelIcon className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-bold text-white">Beneficios: {currentLevel.name}</h2>
            <p className="text-[10px] text-gray-500">Tu nivel actual otorga estos beneficios</p>
          </div>
        </div>
        <div className="space-y-2.5">
          {/* Bonus per ride */}
          <div
            className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 cursor-default"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
                <CircleDollarSign className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-white">Bono por viaje</p>
                <p className="text-[10px] text-gray-500">Por cada viaje completado ganas un extra</p>
              </div>
            </div>
            <span className={`text-sm font-bold ${currentBenefits.bonusPerRide > 0 ? 'text-amber-400' : 'text-gray-400'}`}>
              {currentBenefits.bonusPerRide > 0 ? `+₡${currentBenefits.bonusPerRide}` : '—'}
            </span>
          </div>
          {/* Priority matching */}
          <div
            className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 cursor-default"
          >
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${currentBenefits.priorityMatching ? 'bg-cyan-500/15' : 'bg-white/5'}`}>
                <Rocket className={`w-4 h-4 ${currentBenefits.priorityMatching ? 'text-cyan-400' : 'text-gray-500'}`} />
              </div>
              <div>
                <p className="text-xs font-medium text-white">Preferencia en matching</p>
                <p className="text-[10px] text-gray-500">Recibe solicitudes antes que otros conductores</p>
              </div>
            </div>
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${
              currentBenefits.priorityMatching
                ? 'bg-cyan-500/20 text-cyan-400'
                : 'bg-white/5 text-gray-500'
            }`}>
              {currentBenefits.priorityMatching ? 'Activo' : 'Inactivo'}
            </span>
          </div>
        </div>
        {/* Next level motivation */}
        {nextLevel && (
          <div className="mt-3 p-3 rounded-xl bg-gradient-to-r from-amber-500/10 to-cyan-500/10 border border-white/10">
            <div className="flex items-center gap-2 mb-1.5">
              <ChevronUp className="w-3.5 h-3.5 text-amber-400" />
              <p className="text-[11px] font-bold text-amber-300">Sube a {nextLevel.name}</p>
            </div>
            {(() => {
              const nextBenefits = getLevelBenefits(nextLevel.name, dbLevels);
              return (
                <div className="flex items-center gap-3 ml-5.5">
                  {nextBenefits.bonusPerRide > 0 && (
                    <span className="text-[10px] text-amber-400/80">+₡{nextBenefits.bonusPerRide}/viaje</span>
                  )}
                  {nextBenefits.priorityMatching && (
                    <span className="text-[10px] text-cyan-400/80">Prioridad activa</span>
                  )}
                  <span className="text-[10px] text-gray-500">faltan {tripsToNext} viajes</span>
                </div>
              );
            })()}
          </div>
        )}
      </motion.div>

      {/* ─── B) All Levels Ladder ────────────────────── */}
      <motion.div variants={item} className="glass rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-bold text-white">Todos los Niveles</span>
        </div>
        <p className="text-[10px] text-gray-500 mb-4">Toca un nivel para ver sus beneficios completos</p>

        <div className="relative">
          {/* Vertical line connecting levels */}
          <div className="absolute left-5 top-6 bottom-6 w-0.5 bg-white/10" />

          <div className="space-y-1">
            {LEVELS.map((level, index) => {
              const isCurrentLevel = index === currentLevelIndex;
              const isCompleted = index < currentLevelIndex;
              const isLocked = index > currentLevelIndex;
              const LevelIcon = level.icon;
              const levelBenefits = getLevelBenefits(level.name, dbLevels);
              const isLevelOpen = expandedLevel === index;
              const hasBenefits = levelBenefits.bonusPerRide > 0 || levelBenefits.priorityMatching;

              return (
                <motion.div
                  key={level.name}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + index * 0.08 }}
                >
                  <button
                    onClick={() => setExpandedLevel(isLevelOpen ? null : index)}
                    className={`relative w-full flex items-start gap-3 p-3 rounded-xl transition-all text-left ${
                      isLevelOpen
                        ? `bg-gradient-to-r ${level.bgColor} border border-white/15 shadow-lg`
                        : isCurrentLevel
                          ? `bg-gradient-to-r ${level.bgColor} border border-white/10 shadow-lg ${level.borderGlow || ''}`
                          : isCompleted
                            ? 'opacity-70 hover:opacity-100'
                            : isLocked
                              ? 'opacity-40'
                              : 'hover:bg-white/5'
                    }`}
                  >
                    {/* Level icon circle */}
                    <div className={`relative z-10 w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      isCurrentLevel && !isLevelOpen
                        ? `bg-gradient-to-br ${level.color} shadow-lg`
                        : isCompleted
                          ? 'bg-emerald-500/20'
                          : isLocked
                            ? 'bg-white/5'
                            : isLevelOpen
                              ? `bg-gradient-to-br ${level.color} shadow-lg`
                              : 'bg-white/10'
                    }`}>
                      {isCompleted ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      ) : isLocked ? (
                        <Lock className="w-4 h-4 text-gray-500" />
                      ) : (
                        <LevelIcon className="w-5 h-5 text-white" />
                      )}
                    </div>

                    {/* Level info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-bold ${
                          isCurrentLevel || isLevelOpen
                            ? level.textColor
                            : isLocked
                              ? 'text-gray-500'
                              : 'text-gray-300'
                        }`}>
                          {level.name}
                        </p>
                        {isCurrentLevel && (
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-gradient-to-r ${level.color} text-white`}>
                            ACTUAL
                          </span>
                        )}
                        {isCompleted && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                            COMPLETADO
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        {level.minTrips === 0 ? 'Nivel inicial' : `${level.minTrips} viajes mínimo`}
                      </p>

                      {/* Mini benefits preview */}
                      {!isLevelOpen && (
                        <div className="flex items-center gap-3 mt-1.5">
                          {hasBenefits ? (
                            <>
                              {levelBenefits.bonusPerRide > 0 && (
                                <span className={`text-[10px] font-medium ${isLocked ? 'text-gray-600' : 'text-amber-400'}`}>
                                  +₡{levelBenefits.bonusPerRide}/viaje
                                </span>
                              )}
                              {levelBenefits.priorityMatching && (
                                <span className={`text-[10px] font-medium ${isLocked ? 'text-gray-600' : 'text-cyan-400'}`}>
                                  Prioridad
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-[10px] text-gray-600">Sin beneficios especiales</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Expand indicator */}
                    <div className="flex-shrink-0 pt-2">
                      {isCurrentLevel && !isLevelOpen && (
                        <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${level.color} animate-pulse`} />
                      )}
                      {!isCurrentLevel && !isCompleted && !isLocked && (
                        <ChevronDown className={`w-3.5 h-3.5 text-gray-500`} />
                      )}
                      {isLocked && (
                        <ChevronDown className={`w-3.5 h-3.5 text-gray-600`} />
                      )}
                      <motion.div
                        animate={{ rotate: isLevelOpen ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        {isLevelOpen && (
                          <ChevronDown className={`w-3.5 h-3.5 ${level.textColor}`} />
                        )}
                      </motion.div>
                    </div>
                  </button>

                  {/* Expanded details */}
                  <motion.div
                    initial={false}
                    animate={{
                      height: isLevelOpen ? 'auto' : 0,
                      opacity: isLevelOpen ? 1 : 0,
                    }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="pl-16 pr-2 pt-1 pb-2">
                      <div className="space-y-2">
                        {/* Bono por viaje */}
                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/5">
                          <div className="flex items-center gap-2">
                            <CircleDollarSign className={`w-3.5 h-3.5 ${levelBenefits.bonusPerRide > 0 ? 'text-amber-400' : 'text-gray-500'}`} />
                            <div>
                              <p className="text-[11px] font-medium text-gray-200">Bono por viaje</p>
                              <p className="text-[9px] text-gray-500">Ganancia extra por cada viaje completado</p>
                            </div>
                          </div>
                          <span className={`text-xs font-bold ${levelBenefits.bonusPerRide > 0 ? 'text-amber-400' : 'text-gray-500'}`}>
                            {levelBenefits.bonusPerRide > 0 ? `+₡${levelBenefits.bonusPerRide}` : '—'}
                          </span>
                        </div>
                        {/* Prioridad */}
                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/5">
                          <div className="flex items-center gap-2">
                            <Rocket className={`w-3.5 h-3.5 ${levelBenefits.priorityMatching ? 'text-cyan-400' : 'text-gray-500'}`} />
                            <div>
                              <p className="text-[11px] font-medium text-gray-200">Preferencia en matching</p>
                              <p className="text-[9px] text-gray-500">Recibes solicitudes antes que otros</p>
                            </div>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            levelBenefits.priorityMatching
                              ? 'bg-cyan-500/20 text-cyan-400'
                              : 'bg-white/5 text-gray-500'
                          }`}>
                            {levelBenefits.priorityMatching ? 'Activo' : 'Inactivo'}
                          </span>
                        </div>
                        {/* Status message */}
                        {isLocked && (
                          <p className="text-[10px] text-gray-500 flex items-center gap-1.5">
                            <Lock className="w-3 h-3" />
                            Necesitas {level.minTrips - totalRides} viajes más para desbloquear
                          </p>
                        )}
                        {isCurrentLevel && (
                          <p className="text-[10px] text-gray-400 flex items-center gap-1.5">
                            <Sparkles className="w-3 h-3" />
                            Estás en este nivel — sigue completando viajes
                          </p>
                        )}
                        {isCompleted && (
                          <p className="text-[10px] text-emerald-400/70 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3 h-3" />
                            Nivel alcanzado — los beneficios están activos
                          </p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* ─── E) Tips to Level Up ─────────────────────── */}
      <motion.div variants={item} className="glass rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-bold text-white">Tips para Subir de Nivel</span>
        </div>
        <p className="text-[10px] text-gray-500 mb-3">Toca cada tip para ver cómo lograrlo</p>
        <div className="space-y-2">
          {LEVEL_UP_TIPS.map((tip, index) => {
            const isOpen = expandedTip === index;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + index * 0.06 }}
              >
                <button
                  onClick={() => setExpandedTip(isOpen ? null : index)}
                  className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl transition-colors text-left ${
                    isOpen
                      ? 'bg-white/10 border border-white/15'
                      : 'bg-white/5 hover:bg-white/8'
                  }`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isOpen ? 'bg-white/10' : 'bg-white/5'
                  }`}>
                    <tip.icon className={`w-3.5 h-3.5 ${tip.color}`} />
                  </div>
                  <p className={`flex-1 text-xs font-medium ${isOpen ? 'text-white' : 'text-gray-300'}`}>{tip.text}</p>
                  <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 transition-colors ${isOpen ? 'text-gray-300' : 'text-gray-600'}`} />
                  </motion.div>
                </button>
                <motion.div
                  initial={false}
                  animate={{
                    height: isOpen ? 'auto' : 0,
                    opacity: isOpen ? 1 : 0,
                  }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <div className="px-3 pt-1.5 pb-1">
                    <div className="flex gap-2">
                      <div className="w-px flex-shrink-0 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
                      <p className="text-[11px] leading-relaxed text-gray-400">
                        {tip.description}
                      </p>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* ─── Bottom spacing ──────────────────────────── */}
      <div className="h-4" />
    </motion.div>
  );
}
