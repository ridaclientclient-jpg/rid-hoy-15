'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import {
  CheckCircle2,
  Wallet,
  Loader2,
  MapPin,
  Clock,
  Navigation,
  ArrowRight,
  Sparkles,
  Banknote,
  Smartphone,
  CreditCard,
  PartyPopper,
} from 'lucide-react';

/* ─── Confetti particle component ─────────────────────────────────── */
function ConfettiParticle({ delay, color, x }: { delay: number; color: string; x: number }) {
  return (
    <motion.div
      className="absolute w-2 h-2 rounded-full pointer-events-none"
      style={{
        backgroundColor: color,
        left: `${x}%`,
        top: '40%',
      }}
      initial={{ opacity: 0, y: 0, scale: 0, rotate: 0 }}
      animate={{
        opacity: [0, 1, 1, 0],
        y: [-20, -80, -140, -200],
        scale: [0, 1.2, 1, 0.5],
        rotate: [0, 180, 360, 540],
        x: [0, x > 50 ? 30 : -30, x > 50 ? -10 : 10, x > 50 ? 20 : -20],
      }}
      transition={{
        duration: 2.2,
        delay,
        ease: 'easeOut',
      }}
    />
  );
}

/* ─── Animated Checkmark SVG ──────────────────────────────────────── */
function AnimatedCheckmark({ size = 120 }: { size?: number }) {
  return (
    <div className="relative">
      {/* Green glow ring */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(16,185,129,0.25) 0%, transparent 70%)',
          transform: 'scale(2)',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0.8, 1] }}
        transition={{ duration: 1.5, repeat: Infinity, repeatType: 'reverse' }}
      />
      <motion.div
        className="absolute inset-0 rounded-full"
        initial={{ scale: 0.8, opacity: 0.5 }}
        animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.5, 0.2, 0.5] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        style={{ boxShadow: '0 0 60px rgba(16,185,129,0.4), 0 0 120px rgba(16,185,129,0.15)' }}
      />

      {/* Circle background */}
      <motion.div
        className="relative rounded-full flex items-center justify-center"
        style={{
          width: size,
          height: size,
          background: 'linear-gradient(135deg, #059669, #10b981)',
          boxShadow: '0 0 40px rgba(16,185,129,0.5), 0 8px 32px rgba(0,0,0,0.3)',
        }}
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
      >
        {/* Inner ring */}
        <motion.div
          className="absolute rounded-full border-2 border-emerald-300/40"
          style={{ width: size - 16, height: size - 16 }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 180, damping: 15, delay: 0.2 }}
        />

        {/* Checkmark */}
        <motion.svg
          width={size * 0.45}
          height={size * 0.45}
          viewBox="0 0 24 24"
          fill="none"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4, ease: 'easeOut' }}
        >
          <motion.path
            d="M5 13l4 4L19 7"
            stroke="white"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.5, delay: 0.4, ease: 'easeOut' }}
          />
        </motion.svg>
      </motion.div>
    </div>
  );
}

/* ─── Main Component ──────────────────────────────────────────────── */
export default function CollectPayment() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session } = useAuthStore();

  const [ride, setRide] = useState<any>(null);
  const [riderName, setRiderName] = useState('Pasajero');
  const [loading, setLoading] = useState(true);
  const [isCompleting, setIsCompleting] = useState(false);

  // Modal states
  const [showCashModal, setShowCashModal] = useState(false);
  const [showSuccessScreen, setShowSuccessScreen] = useState(false);
  const [alreadyPaid, setAlreadyPaid] = useState(false);

  const rideId = searchParams.get('rideId');

  const fetchRide = useCallback(async () => {
    if (!rideId) { setLoading(false); return; }
    try {
      const { data, error } = await supabase.from('rides').select('*').eq('id', rideId).single();
      if (error || !data) { setLoading(false); return; }
      setRide(data);

      // Fetch rider name
      const { data: profile } = await supabase.from('profiles').select('name').eq('id', data.rider_id).single();
      if (profile) setRiderName(profile.name);
    } catch (err) {
      console.error('Error fetching ride:', err);
    } finally {
      setLoading(false);
    }
  }, [rideId]);

  useEffect(() => { fetchRide(); }, [fetchRide]);

  const completeRide = useCallback(async () => {
    if (!ride || !session?.access_token) return;
    setIsCompleting(true);
    try {
      const res = await fetch('/api/rides/update-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ ride_id: ride.id, new_status: 'completed' }),
      });
      const data = await res.json();
      if (data.success) {
        return true;
      } else {
        toast.error(data.error || 'Error al procesar el pago');
        return false;
      }
    } catch {
      toast.error('Error de conexion');
      return false;
    } finally {
      setIsCompleting(false);
    }
  }, [ride, session?.access_token]);

  // Open cash modal
  const handleOpenCashModal = useCallback(() => {
    setShowCashModal(true);
  }, []);

  // Confirm cash collection
  const handleCollectCash = useCallback(async () => {
    const success = await completeRide();
    if (success) {
      toast.success('Efectivo cobrado correctamente');
      setShowCashModal(false);
      setShowSuccessScreen(true);
    }
  }, [completeRide]);

  // Passenger already paid
  const handleAlreadyPaid = useCallback(async () => {
    setAlreadyPaid(true);
    const success = await completeRide();
    if (success) {
      toast.success('Viaje completado');
      setShowCashModal(false);
      setShowSuccessScreen(true);
    } else {
      setAlreadyPaid(false);
    }
  }, [completeRide]);

  // Confirm non-cash payment
  const handleConfirmDigitalPayment = useCallback(async () => {
    const success = await completeRide();
    if (success) {
      toast.success('Viaje completado con exito');
      setShowSuccessScreen(true);
    }
  }, [completeRide]);

  // Navigate to rides
  const handleGoToRides = useCallback(() => {
    router.push('/driver/rides');
  }, [router]);

  // ─── Loading State ───
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-rida-dark">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Cargando viaje...</p>
        </div>
      </div>
    );
  }

  // ─── Not Found State ───
  if (!ride) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-rida-dark p-6 gap-4">
        <p className="text-gray-400">Viaje no encontrado</p>
        <button
          onClick={() => router.push('/driver/rides')}
          className="bg-gradient-to-r from-emerald-600 to-emerald-500 text-white px-6 py-3 rounded-xl font-medium"
        >
          Ir a Viajes
        </button>
      </div>
    );
  }

  const price = ride.price || 0;
  const commission = Math.round(price * ((ride.commission_rate || 15) / 100));
  const netEarnings = ride.driver_earnings || (price - commission);
  const isCash = ride.payment_method === 'cash';

  const paymentLabels: Record<string, string> = {
    cash: 'Efectivo',
    wallet: 'Billetera',
    card: 'Tarjeta',
    sinpe: 'SINPE',
  };

  const paymentIcons: Record<string, React.ReactNode> = {
    cash: <Banknote className="w-5 h-5" />,
    wallet: <Wallet className="w-5 h-5" />,
    card: <CreditCard className="w-5 h-5" />,
    sinpe: <Smartphone className="w-5 h-5" />,
  };

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '--';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '--';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const confettiColors = ['#10b981', '#06b6d4', '#f59e0b', '#ec4899', '#8b5cf6', '#ef4444', '#3b82f6'];

  // ══════════════════════════════════════════════════════════════════
  // SUCCESS SCREEN (shown after payment confirmation)
  // ══════════════════════════════════════════════════════════════════
  if (showSuccessScreen) {
    return (
      <motion.div
        className="fixed inset-0 flex flex-col items-center justify-center bg-rida-dark z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {/* Confetti */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {confettiColors.map((color, i) => (
            <ConfettiParticle
              key={i}
              delay={0.3 + i * 0.08}
              color={color}
              x={10 + (i * 12)}
            />
          ))}
        </div>

        <motion.div
          className="flex flex-col items-center gap-6 px-6"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 150 }}
        >
          {/* Big animated check */}
          <AnimatedCheckmark size={130} />

          {/* Title */}
          <motion.h1
            className="text-3xl font-bold text-white text-center"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            Viaje Completado
          </motion.h1>

          {/* Amount */}
          <motion.div
            className="text-center"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.7, type: 'spring', stiffness: 200 }}
          >
            <p className="text-5xl font-extrabold text-emerald-400">
              ₡{price.toLocaleString()}
            </p>
            <div className="flex items-center justify-center gap-1.5 mt-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-sm text-gray-400">
                Tu ganancia: <span className="text-emerald-400 font-semibold">+₡{netEarnings.toLocaleString()}</span>
              </span>
            </div>
          </motion.div>

          {/* Payment method badge */}
          <motion.div
            className="glass-strong rounded-full px-4 py-2 flex items-center gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            {paymentIcons[ride.payment_method] || <Wallet className="w-4 h-4 text-gray-400" />}
            <span className="text-sm font-medium text-gray-300">
              {paymentLabels[ride.payment_method] || ride.payment_method}
            </span>
          </motion.div>

          {/* Back button */}
          <motion.button
            onClick={handleGoToRides}
            className="mt-4 w-full max-w-xs font-bold text-white py-4 rounded-2xl text-lg flex items-center justify-center gap-2"
            style={{
              background: 'linear-gradient(135deg, #059669, #10b981)',
              boxShadow: '0 10px 30px rgba(16,185,129,0.3)',
            }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0 }}
            whileTap={{ scale: 0.97 }}
          >
            Volver a Viajes
          </motion.button>
        </motion.div>
      </motion.div>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // CASH PAYMENT MODAL (Didi-style full-screen overlay)
  // ══════════════════════════════════════════════════════════════════
  return (
    <div className="relative flex flex-col min-h-screen bg-rida-dark">
      {/* ── Header ──────────────────────────────────────────── */}
      <motion.div
        className="flex items-center gap-3 p-4"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <button
          onClick={() => router.push('/driver/rides')}
          className="p-2 rounded-xl hover:bg-white/5 transition-colors"
        >
          <Navigation className="w-5 h-5 text-white rotate-180" />
        </button>
        <div className="flex-1 text-center">
          <h1 className="text-base font-bold text-white">
            {isCash ? 'Cobrar Efectivo' : 'Confirmar Pago'}
          </h1>
        </div>
        <div className="w-9" />
      </motion.div>

      {/* ── Ride Summary Card ───────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center px-4 pb-6 overflow-y-auto">
        <motion.div
          className="w-full max-w-md space-y-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          {/* Passenger info */}
          <div className="glass-strong rounded-2xl p-4 flex items-center gap-4">
            <motion.div
              className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-600 to-cyan-500 flex items-center justify-center text-xl font-bold text-white shrink-0"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
            >
              {riderName.charAt(0)}
            </motion.div>
            <div className="min-w-0 flex-1">
              <p className="text-white font-semibold truncate">{riderName}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {paymentIcons[ride.payment_method] || <Wallet className="w-3.5 h-3.5 text-gray-400" />}
                <span className="text-xs text-gray-400">
                  {paymentLabels[ride.payment_method] || ride.payment_method}
                </span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-2xl font-bold text-white">₡{price.toLocaleString()}</p>
            </div>
          </div>

          {/* Route summary */}
          <div className="glass-strong rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-4 h-4 text-emerald-400" />
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Ruta del Viaje</p>
            </div>

            {/* Origin */}
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center mt-1">
                <div className="w-3 h-3 rounded-full bg-emerald-400 shrink-0" style={{ boxShadow: '0 0 8px rgba(16,185,129,0.5)' }} />
                <div className="w-0.5 h-10 bg-gradient-to-b from-emerald-400/50 to-red-400/50 my-0.5" />
                <div className="w-3 h-3 rounded-full bg-red-400 shrink-0" style={{ boxShadow: '0 0 8px rgba(239,68,68,0.5)' }} />
              </div>
              <div className="flex-1 space-y-6">
                <div className="min-w-0">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Origen</p>
                  <p className="text-sm text-white truncate">{ride.origin}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Destino</p>
                  <p className="text-sm text-white truncate">{ride.destination}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Ride details grid */}
          <div className="glass-strong rounded-2xl p-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/10 mx-auto mb-2">
                  <Navigation className="w-4.5 h-4.5 text-emerald-400" />
                </div>
                <p className="text-lg font-bold text-white">{ride.distance || 0}</p>
                <p className="text-[10px] text-gray-500">km</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-cyan-500/10 mx-auto mb-2">
                  <Clock className="w-4.5 h-4.5 text-cyan-400" />
                </div>
                <p className="text-lg font-bold text-white">{ride.duration || 0}</p>
                <p className="text-[10px] text-gray-500">min</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-500/10 mx-auto mb-2">
                  <Wallet className="w-4.5 h-4.5 text-amber-400" />
                </div>
                <p className="text-lg font-bold text-white">₡{price.toLocaleString()}</p>
                <p className="text-[10px] text-gray-500">total</p>
              </div>
            </div>
          </div>

          {/* Fare breakdown */}
          <div className="glass rounded-2xl p-4 space-y-2.5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Desglose</p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Tarifa del viaje</span>
              <span className="text-sm font-medium text-white">₡{price.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Comision RIDA ({ride.commission_rate || 15}%)</span>
              <span className="text-sm font-medium text-red-400">-₡{commission.toLocaleString()}</span>
            </div>
            <div className="border-t border-white/10 pt-2.5 flex items-center justify-between">
              <span className="text-sm font-semibold text-white">Tu ganancia neta</span>
              <span className="text-sm font-bold text-emerald-400">+₡{netEarnings.toLocaleString()}</span>
            </div>
          </div>

          {/* Date & time */}
          <div className="flex items-center justify-center gap-4 text-xs text-gray-500 py-2">
            <span>{formatDate(ride.created_at)}</span>
            <span className="w-1 h-1 rounded-full bg-gray-600" />
            <span>{formatTime(ride.created_at)}</span>
          </div>
        </motion.div>
      </div>

      {/* ── Bottom Action Buttons ───────────────────────────── */}
      <motion.div
        className="px-4 pb-6 pt-3 w-full max-w-md mx-auto"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        {isCash ? (
          /* ── Cash: Show modal trigger ── */
          <button
            onClick={handleOpenCashModal}
            className="w-full font-bold text-white py-4 rounded-2xl text-lg flex items-center justify-center gap-3"
            style={{
              background: 'linear-gradient(135deg, #059669, #10b981)',
              boxShadow: '0 10px 30px rgba(16,185,129,0.3)',
            }}
            whileTap={{ scale: 0.97 }}
          >
            <Banknote className="w-6 h-6" />
            Cobrar Efectivo
          </button>
        ) : (
          /* ── Digital: Confirm button ── */
          <div className="space-y-3">
            <div className="glass-strong rounded-2xl p-3 flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/15">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">Pago procesado automaticamente</p>
                <p className="text-xs text-gray-400">
                  {paymentLabels[ride.payment_method] || 'Pago digital'}
                </p>
              </div>
            </div>
            <button
              onClick={handleConfirmDigitalPayment}
              disabled={isCompleting}
              className="w-full font-bold text-white py-4 rounded-2xl text-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: 'linear-gradient(135deg, #059669, #10b981)',
                boxShadow: '0 10px 30px rgba(16,185,129,0.3)',
              }}
              whileTap={{ scale: 0.97 }}
            >
              {isCompleting ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-6 h-6" />
                  Confirmar Pago
                </>
              )}
            </button>
          </div>
        )}
      </motion.div>

      {/* ══════════════════════════════════════════════════════ */}
      {/* CASH PAYMENT MODAL — Full Screen Didi Style           */}
      {/* ══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showCashModal && (
          <motion.div
            className="fixed inset-0 z-50 flex flex-col items-center justify-center"
            style={{ backgroundColor: '#050912' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Ambient background glow */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'radial-gradient(circle at 50% 30%, rgba(16,185,129,0.12) 0%, transparent 60%)',
              }}
            />

            {/* Confetti particles */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {confettiColors.map((color, i) => (
                <ConfettiParticle
                  key={`modal-${i}`}
                  delay={0.5 + i * 0.1}
                  color={color}
                  x={8 + (i * 13)}
                />
              ))}
            </div>

            {/* Content */}
            <div className="relative flex flex-col items-center gap-6 px-6 w-full max-w-sm">
              {/* Close hint */}
              <motion.button
                onClick={() => setShowCashModal(false)}
                className="absolute top-0 right-0 p-2 text-gray-500 hover:text-white transition-colors"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
              >
                <span className="text-xs">Cerrar</span>
              </motion.button>

              {/* Animated Checkmark */}
              <AnimatedCheckmark size={130} />

              {/* Viaje Completado title */}
              <motion.div
                className="text-center"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, type: 'spring', stiffness: 150 }}
              >
                <div className="flex items-center justify-center gap-2 mb-1">
                  <PartyPopper className="w-5 h-5 text-amber-400" />
                  <h2 className="text-2xl font-bold text-white">Viaje Completado</h2>
                  <PartyPopper className="w-5 h-5 text-amber-400" />
                </div>
                <p className="text-sm text-gray-400">Ride finalizado con exito</p>
              </motion.div>

              {/* Amount to collect */}
              <motion.div
                className="text-center glass-strong rounded-3xl px-8 py-6 w-full"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.65, type: 'spring', stiffness: 200 }}
                style={{
                  boxShadow: '0 0 40px rgba(16,185,129,0.08), inset 0 1px 0 rgba(255,255,255,0.05)',
                }}
              >
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Banknote className="w-5 h-5 text-amber-400" />
                  <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                    Cobrale al pasajero
                  </span>
                </div>
                <p className="text-5xl font-extrabold text-white mt-2">
                  ₡{price.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Ganancia neta: <span className="text-emerald-400 font-semibold">₡{netEarnings.toLocaleString()}</span>
                </p>
              </motion.div>

              {/* Primary CTA: Cobrar Efectivo */}
              <motion.button
                onClick={handleCollectCash}
                disabled={isCompleting}
                className="w-full font-bold text-white py-4 rounded-2xl text-lg flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: 'linear-gradient(135deg, #059669, #10b981)',
                  boxShadow: '0 10px 40px rgba(16,185,129,0.35)',
                }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                whileTap={{ scale: 0.97 }}
                whileHover={{ boxShadow: '0 14px 50px rgba(16,185,129,0.45)' }}
              >
                {isCompleting ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <>
                    <Banknote className="w-6 h-6" />
                    Cobrar Efectivo
                  </>
                )}
              </motion.button>

              {/* Secondary: Pasajero ya pago */}
              <motion.button
                onClick={handleAlreadyPaid}
                disabled={isCompleting || alreadyPaid}
                className="w-full font-semibold text-gray-400 hover:text-white py-3.5 rounded-2xl text-base flex items-center justify-center gap-2 border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
                whileTap={{ scale: 0.97 }}
              >
                {alreadyPaid ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    Pasajero ya pago
                  </>
                )}
              </motion.button>

              {/* Warning text */}
              <motion.p
                className="text-[10px] text-gray-600 text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.0 }}
              >
                Asegurate de recibir el monto exacto antes de confirmar
              </motion.p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
