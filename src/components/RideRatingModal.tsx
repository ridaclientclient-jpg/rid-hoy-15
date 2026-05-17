'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Star,
  X,
  CheckCircle2,
  DollarSign,
  Wallet,
  Banknote,
  Sparkles,
  MessageSquareHeart,
  HeartHandshake,
} from 'lucide-react';
import { toast } from 'sonner';

/* ─── Types ────────────────────────────────────────────────────── */

type TipMethod = 'cash' | 'wallet';

interface CategoryRating {
  cleanliness: number | null;
  punctuality: number | null;
  driving_style: number | null;
  communication: number | null;
  navigation: number | null;
  vehicle_condition: number | null;
}

interface RideRatingModalProps {
  open: boolean;
  onClose: () => void;
  rideId: string;
  driverName: string;
  driverId: string;
  userId: string;
  session?: string | null;
}

type FlowStage = 'rating' | 'details' | 'tip' | 'done';

/* ─── Constants ────────────────────────────────────────────────── */

const CATEGORIES: { key: keyof CategoryRating; label: string }[] = [
  { key: 'cleanliness', label: 'Limpieza' },
  { key: 'punctuality', label: 'Puntualidad' },
  { key: 'driving_style', label: 'Estilo de conducción' },
  { key: 'communication', label: 'Comunicación' },
  { key: 'navigation', label: 'Navegación' },
  { key: 'vehicle_condition', label: 'Estado del vehículo' },
];

const GOOD_TAGS = [
  'Amable',
  'Buen conversador',
  'Vehículo limpio',
  'Manejo seguro',
  'Llegó temprano',
  'Buena música',
  'Tuvo paciencia',
];

const BAD_TAGS = [
  'No respetó señales',
  'Manejo agresivo',
  'Vehículo sucio',
];

const TIP_PRESETS = [500, 1000, 1500, 2000, 3000];

const RATING_LABELS: Record<number, string> = {
  1: 'Malo',
  2: 'Regular',
  3: 'Bueno',
  4: 'Muy bueno',
  5: 'Excelente',
};

/* ─── Helpers ──────────────────────────────────────────────────── */

function formatCRC(amount: number): string {
  return `₡${amount.toLocaleString('es-CR')}`;
}

/* ─── Component ────────────────────────────────────────────────── */

export default function RideRatingModal({
  open,
  onClose,
  rideId,
  driverName,
  driverId,
  userId,
  session,
}: RideRatingModalProps) {
  // ── Flow state ──
  const [stage, setStage] = useState<FlowStage>('rating');

  // ── Rating state ──
  const [selectedRating, setSelectedRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [categoryRatings, setCategoryRatings] = useState<CategoryRating>({
    cleanliness: null,
    punctuality: null,
    driving_style: null,
    communication: null,
    navigation: null,
    vehicle_condition: null,
  });
  const [categoryHover, setCategoryHover] = useState<Record<string, number>>({});
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // ── Tip state ──
  const [tipAmount, setTipAmount] = useState<number>(1000);
  const [customTip, setCustomTip] = useState('');
  const [isCustomTip, setIsCustomTip] = useState(false);

  // ── Loading / submission state ──
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [isSubmittingTip, setIsSubmittingTip] = useState(false);
  const [tipSuccess, setTipSuccess] = useState(false);

  // ── Derived ──
  const displayRating = hoverRating || selectedRating;
  const effectiveTipAmount = isCustomTip
    ? parseFloat(customTip) || 0
    : tipAmount;

  // ── Reset when modal opens ──
  const resetState = useCallback(() => {
    setStage('rating');
    setSelectedRating(0);
    setHoverRating(0);
    setComment('');
    setCategoryRatings({
      cleanliness: null,
      punctuality: null,
      driving_style: null,
      communication: null,
      navigation: null,
      vehicle_condition: null,
    });
    setCategoryHover({});
    setSelectedTags([]);
    setTipAmount(1000);
    setCustomTip('');
    setIsCustomTip(false);
    setIsSubmittingRating(false);
    setIsSubmittingTip(false);
    setTipSuccess(false);
  }, []);

  // ── Handlers ──

  const handleSelectRating = (value: number) => {
    setSelectedRating(value);
    // Auto-advance to details after a brief moment if rating ≤ 3
    if (value <= 3 && value > 0) {
      setStage('details');
    }
  };

  const setCategory = (key: keyof CategoryRating, value: number) => {
    setCategoryRatings((prev) => ({ ...prev, [key]: value }));
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleBackToRating = () => {
    setStage('rating');
  };

  /* ── Submit rating ── */
  const handleSubmitRating = async () => {
    if (selectedRating === 0) {
      toast.error('Por favor selecciona una calificación');
      return;
    }

    setIsSubmittingRating(true);

    try {
      const payload: Record<string, unknown> = {
        ride_id: rideId,
        overall_rating: selectedRating,
        comment: comment.trim() || null,
        tags: selectedTags.length > 0 ? selectedTags : [],
      };

      // Include category ratings if any are set
      for (const cat of CATEGORIES) {
        if (categoryRatings[cat.key] !== null) {
          payload[cat.key] = categoryRatings[cat.key];
        }
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (session) {
        headers['Authorization'] = `Bearer ${session}`;
      }

      const res = await fetch('/api/rides/rating', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error('Rating API error:', data);
        // Fallback: try direct supabase insert
        const { supabase } = await import('@/lib/supabase');
        await supabase.from('reviews').insert({
          ride_id: rideId,
          reviewer_id: userId,
          reviewee_id: driverId,
          rating: selectedRating,
          comment: comment.trim() || null,
        });
        await supabase
          .from('rides')
          .update({ rider_rating: selectedRating })
          .eq('id', rideId);
      }

      toast.success('¡Gracias por tu calificación!');
      setStage('tip');
    } catch (err) {
      console.error('Submit rating error:', err);
      toast.error('Error al enviar calificación. Intenta de nuevo.');
    } finally {
      setIsSubmittingRating(false);
    }
  };

  /* ── Submit tip ── */
  const handleTip = async (method: TipMethod) => {
    if (effectiveTipAmount <= 0) {
      toast.error('Selecciona un monto de propina válido');
      return;
    }

    setIsSubmittingTip(true);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (session) {
        headers['Authorization'] = `Bearer ${session}`;
      }

      const res = await fetch('/api/rides/tip', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ride_id: rideId,
          amount: effectiveTipAmount,
          method,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // If wallet fails but cash is requested, just record it locally
        if (method === 'cash') {
          // Cash tip just needs to be noted, even if API fails we consider it recorded
          toast.success(
            `Propina de ${formatCRC(effectiveTipAmount)} registrada en efectivo`
          );
          setTipSuccess(true);
          return;
        }
        console.error('Tip API error:', data);
        toast.error(data.error || 'Error al procesar la propina');
        return;
      }

      const methodLabel = method === 'cash' ? 'en efectivo' : 'desde billetera';
      toast.success(
        `¡Propina de ${formatCRC(effectiveTipAmount)} ${methodLabel} enviada!`
      );
      setTipSuccess(true);
    } catch (err) {
      console.error('Submit tip error:', err);
      if (method === 'cash') {
        toast.success(
          `Propina de ${formatCRC(effectiveTipAmount)} registrada en efectivo`
        );
        setTipSuccess(true);
      } else {
        toast.error('Error al procesar la propina. Intenta de nuevo.');
      }
    } finally {
      setIsSubmittingTip(false);
    }
  };

  const handleSkipTip = () => {
    setTipSuccess(true);
  };

  const handleDone = () => {
    resetState();
    onClose();
  };

  const handleSkip = () => {
    resetState();
    onClose();
  };

  /* ── Star row component for categories ── */
  const CategoryStarRow = ({
    categoryKey,
    label,
  }: {
    categoryKey: keyof CategoryRating;
    label: string;
  }) => {
    const currentValue = categoryRatings[categoryKey];
    const hoverValue = categoryHover[categoryKey] || 0;
    const displayValue = hoverValue || currentValue || 0;

    return (
      <div className="flex items-center justify-between gap-3 py-1.5">
        <span className="text-sm text-gray-300 min-w-[140px]">{label}</span>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((star) => (
            <motion.button
              key={star}
              type="button"
              onClick={() => setCategory(categoryKey, star)}
              onMouseEnter={() =>
                setCategoryHover((prev) => ({ ...prev, [categoryKey]: star }))
              }
              onMouseLeave={() =>
                setCategoryHover((prev) => ({ ...prev, [categoryKey]: 0 }))
              }
              className="p-0.5 focus:outline-none"
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
            >
              <Star
                className={`w-5 h-5 transition-all duration-150 ${
                  star <= displayValue
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'text-gray-600 hover:text-gray-400'
                }`}
              />
            </motion.button>
          ))}
        </div>
        {currentValue !== null && hoverValue === 0 && (
          <motion.span
            className="text-xs text-yellow-400/70 w-16 text-right"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {RATING_LABELS[currentValue]}
          </motion.span>
        )}
        {currentValue === null && (
          <span className="text-xs text-gray-600 w-16 text-right">
            Opcional
          </span>
        )}
      </div>
    );
  };

  /* ── Render ── */

  return (
    <AnimatePresence onExitComplete={resetState}>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Overlay */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={stage === 'done' ? handleDone : handleSkip}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Modal Content */}
          <motion.div
            className="relative w-full max-w-md mx-4 mb-4 rounded-2xl glass-strong overflow-hidden"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            <div className="p-6">
              {/* Close button — hidden during 'done' stage */}
              {stage !== 'done' && (
                <button
                  onClick={handleSkip}
                  className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition-colors z-10"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              )}

              {/* ══════════════════════════════════════════════════
                  STAGE: RATING (overall stars + comment)
                  ══════════════════════════════════════════════════ */}
              {stage === 'rating' && (
                <motion.div
                  key="rating"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                >
                  {/* Header */}
                  <div className="text-center mb-6">
                    <motion.div
                      className="w-16 h-16 rounded-full bg-yellow-400/10 flex items-center justify-center mx-auto mb-4"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.15, type: 'spring', stiffness: 200 }}
                    >
                      <Star className="w-8 h-8 text-yellow-400" />
                    </motion.div>

                    <h2 className="text-xl font-bold text-white mb-1">
                      ¿Cómo fue tu viaje?
                    </h2>
                    <p className="text-sm text-gray-400">
                      Calificacion anonima — tu nombre no sera visible
                    </p>
                  </div>

                  {/* Overall Star Rating */}
                  <div className="flex justify-center gap-2 mb-4">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <motion.button
                        key={star}
                        type="button"
                        onClick={() => handleSelectRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="p-1 focus:outline-none transition-transform"
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <Star
                          className={`w-10 h-10 transition-all duration-200 ${
                            star <= displayRating
                              ? 'fill-yellow-400 text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]'
                              : 'text-gray-600 hover:text-gray-400'
                          }`}
                        />
                      </motion.button>
                    ))}
                  </div>

                  {/* Rating label */}
                  {displayRating > 0 && (
                    <motion.p
                      className="text-center text-sm text-yellow-400/80 mb-4"
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={displayRating}
                    >
                      {RATING_LABELS[displayRating]}
                    </motion.p>
                  )}

                  {/* Comment textarea */}
                  <div className="mb-5">
                    <textarea
                      value={comment}
                      onChange={(e) => {
                        if (e.target.value.length <= 300) {
                          setComment(e.target.value);
                        }
                      }}
                      placeholder="Deja un comentario (opcional)..."
                      className="w-full h-24 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all"
                    />
                    <p className="text-right text-xs text-gray-500 mt-1">
                      {comment.length}/300
                    </p>
                  </div>

                  {/* Submit Button — show for ratings > 3 (no detail step) */}
                  {selectedRating > 3 && (
                    <motion.button
                      type="button"
                      onClick={handleSubmitRating}
                      disabled={isSubmittingRating || selectedRating === 0}
                      className="w-full py-3 rounded-xl font-semibold text-white text-sm btn-neon disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none transition-all"
                      whileHover={
                        selectedRating > 0 && !isSubmittingRating
                          ? { scale: 1.02 }
                          : {}
                      }
                      whileTap={
                        selectedRating > 0 && !isSubmittingRating
                          ? { scale: 0.98 }
                          : {}
                      }
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      {isSubmittingRating ? (
                        <span className="flex items-center justify-center gap-2">
                          <motion.span
                            className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                            animate={{ rotate: 360 }}
                            transition={{
                              repeat: Infinity,
                              duration: 0.8,
                              ease: 'linear',
                            }}
                          />
                          Enviando...
                        </span>
                      ) : (
                        'Enviar calificación'
                      )}
                    </motion.button>
                  )}

                  {/* Hint for low ratings */}
                  {selectedRating > 0 && selectedRating <= 3 && (
                    <motion.p
                      className="text-center text-xs text-gray-500 mt-3"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      Cuéntanos más para mejorar la experiencia
                    </motion.p>
                  )}

                  {/* Skip link */}
                  <button
                    type="button"
                    onClick={handleSkip}
                    className="w-full mt-3 text-center text-sm text-gray-500 hover:text-gray-300 transition-colors py-1"
                  >
                    Omitir
                  </button>
                </motion.div>
              )}

              {/* ══════════════════════════════════════════════════
                  STAGE: DETAILS (categories + tags, shown if rating ≤ 3)
                  ══════════════════════════════════════════════════ */}
              {stage === 'details' && (
                <motion.div
                  key="details"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.25 }}
                >
                  {/* Header */}
                  <div className="text-center mb-5">
                    <motion.div
                      className="w-14 h-14 rounded-full bg-orange-400/10 flex items-center justify-center mx-auto mb-3"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                    >
                      <MessageSquareHeart className="w-7 h-7 text-orange-400" />
                    </motion.div>
                    <h2 className="text-lg font-bold text-white mb-1">
                      Ayúdanos a mejorar
                    </h2>
                    <p className="text-sm text-gray-400">
                      Califica cada aspecto (opcional)
                    </p>
                  </div>

                  {/* Selected overall rating summary */}
                  <div className="flex items-center justify-center gap-1.5 mb-5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-4 h-4 ${
                          star <= selectedRating
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-gray-600'
                        }`}
                      />
                    ))}
                    <span className="text-sm text-gray-400 ml-1.5">
                      {RATING_LABELS[selectedRating]}
                    </span>
                    <button
                      onClick={handleBackToRating}
                      className="ml-3 text-xs text-cyan-400 hover:text-cyan-300 underline underline-offset-2"
                    >
                      Cambiar
                    </button>
                  </div>

                  {/* Category ratings */}
                  <div className="bg-white/[0.03] rounded-xl border border-white/[0.06] p-3 mb-4 max-h-[220px] overflow-y-auto custom-scrollbar">
                    {CATEGORIES.map((cat) => (
                      <CategoryStarRow
                        key={cat.key}
                        categoryKey={cat.key}
                        label={cat.label}
                      />
                    ))}
                  </div>

                  {/* Quick tags */}
                  <div className="mb-5">
                    <p className="text-xs text-gray-500 mb-2.5 font-medium uppercase tracking-wider">
                      Etiquetas rápidas
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {/* Good tags */}
                      {GOOD_TAGS.map((tag) => {
                        const isSelected = selectedTags.includes(tag);
                        return (
                          <motion.button
                            key={tag}
                            type="button"
                            onClick={() => toggleTag(tag)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 ${
                              isSelected
                                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                                : 'bg-white/[0.03] border-white/[0.08] text-gray-400 hover:border-emerald-500/30 hover:text-emerald-300/70'
                            }`}
                            whileTap={{ scale: 0.95 }}
                          >
                            {isSelected && (
                              <CheckCircle2 className="w-3 h-3 inline mr-1 -mt-0.5" />
                            )}
                            {tag}
                          </motion.button>
                        );
                      })}
                      {/* Bad tags */}
                      {BAD_TAGS.map((tag) => {
                        const isSelected = selectedTags.includes(tag);
                        return (
                          <motion.button
                            key={tag}
                            type="button"
                            onClick={() => toggleTag(tag)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 ${
                              isSelected
                                ? 'bg-red-500/20 border-red-500/40 text-red-300'
                                : 'bg-white/[0.03] border-white/[0.08] text-gray-400 hover:border-red-500/30 hover:text-red-300/70'
                            }`}
                            whileTap={{ scale: 0.95 }}
                          >
                            {isSelected && (
                              <CheckCircle2 className="w-3 h-3 inline mr-1 -mt-0.5" />
                            )}
                            {tag}
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Comment textarea */}
                  <div className="mb-5">
                    <textarea
                      value={comment}
                      onChange={(e) => {
                        if (e.target.value.length <= 300) {
                          setComment(e.target.value);
                        }
                      }}
                      placeholder="Cuéntanos qué pasó (opcional)..."
                      className="w-full h-20 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all"
                    />
                    <p className="text-right text-xs text-gray-500 mt-1">
                      {comment.length}/300
                    </p>
                  </div>

                  {/* Submit button */}
                  <motion.button
                    type="button"
                    onClick={handleSubmitRating}
                    disabled={isSubmittingRating}
                    className="w-full py-3 rounded-xl font-semibold text-white text-sm btn-neon disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none transition-all"
                    whileHover={!isSubmittingRating ? { scale: 1.02 } : {}}
                    whileTap={!isSubmittingRating ? { scale: 0.98 } : {}}
                  >
                    {isSubmittingRating ? (
                      <span className="flex items-center justify-center gap-2">
                        <motion.span
                          className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                          animate={{ rotate: 360 }}
                          transition={{
                            repeat: Infinity,
                            duration: 0.8,
                            ease: 'linear',
                          }}
                        />
                        Enviando...
                      </span>
                    ) : (
                      'Enviar calificación'
                    )}
                  </motion.button>

                  {/* Skip link */}
                  <button
                    type="button"
                    onClick={handleSkip}
                    className="w-full mt-3 text-center text-sm text-gray-500 hover:text-gray-300 transition-colors py-1"
                  >
                    Omitir todo
                  </button>
                </motion.div>
              )}

              {/* ══════════════════════════════════════════════════
                  STAGE: TIP
                  ══════════════════════════════════════════════════ */}
              {stage === 'tip' && !tipSuccess && (
                <motion.div
                  key="tip"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* Header */}
                  <div className="text-center mb-5">
                    <motion.div
                      className="w-16 h-16 rounded-full bg-emerald-400/10 flex items-center justify-center mx-auto mb-4"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{
                        delay: 0.15,
                        type: 'spring',
                        stiffness: 200,
                      }}
                    >
                      <DollarSign className="w-8 h-8 text-emerald-400" />
                    </motion.div>

                    <h2 className="text-xl font-bold text-white mb-1">
                      Agregar propina para {driverName}?
                    </h2>
                    <p className="text-sm text-gray-400">
                      El 100% va directamente al conductor
                    </p>
                  </div>

                  {/* Quick tip amounts */}
                  <div className="grid grid-cols-5 gap-2 mb-3">
                    {TIP_PRESETS.map((amount) => (
                      <motion.button
                        key={amount}
                        type="button"
                        onClick={() => {
                          setTipAmount(amount);
                          setIsCustomTip(false);
                          setCustomTip('');
                        }}
                        className={`py-2.5 rounded-xl text-sm font-semibold border transition-all duration-200 ${
                          !isCustomTip && tipAmount === amount
                            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                            : 'bg-white/[0.03] border-white/[0.08] text-gray-300 hover:border-emerald-500/30'
                        }`}
                        whileTap={{ scale: 0.95 }}
                      >
                        {formatCRC(amount)}
                      </motion.button>
                    ))}
                  </div>

                  {/* Custom amount input */}
                  <div className="relative mb-5">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">
                      ₡
                    </span>
                    <input
                      type="number"
                      value={customTip}
                      onChange={(e) => {
                        setCustomTip(e.target.value);
                        setIsCustomTip(e.target.value.length > 0);
                      }}
                      onFocus={() => {
                        if (!isCustomTip) {
                          setIsCustomTip(true);
                          setCustomTip('');
                        }
                      }}
                      placeholder="Otro monto"
                      min={0}
                      step={100}
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>

                  {/* Tip action buttons */}
                  <div className="flex gap-2.5 mb-3">
                    {/* Cash tip */}
                    <motion.button
                      type="button"
                      onClick={() => handleTip('cash')}
                      disabled={isSubmittingTip || effectiveTipAmount <= 0}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm bg-white/[0.06] border border-white/[0.1] text-gray-200 hover:bg-white/[0.1] hover:border-white/[0.15] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      whileHover={
                        !isSubmittingTip && effectiveTipAmount > 0
                          ? { scale: 1.02 }
                          : {}
                      }
                      whileTap={
                        !isSubmittingTip && effectiveTipAmount > 0
                          ? { scale: 0.98 }
                          : {}
                      }
                    >
                      <Banknote className="w-4 h-4" />
                      Propinar en efectivo
                    </motion.button>

                    {/* Wallet tip */}
                    <motion.button
                      type="button"
                      onClick={() => handleTip('wallet')}
                      disabled={isSubmittingTip || effectiveTipAmount <= 0}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm btn-neon disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none transition-all"
                      whileHover={
                        !isSubmittingTip && effectiveTipAmount > 0
                          ? { scale: 1.02 }
                          : {}
                      }
                      whileTap={
                        !isSubmittingTip && effectiveTipAmount > 0
                          ? { scale: 0.98 }
                          : {}
                      }
                    >
                      {isSubmittingTip ? (
                        <motion.span
                          className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                          animate={{ rotate: 360 }}
                          transition={{
                            repeat: Infinity,
                            duration: 0.8,
                            ease: 'linear',
                          }}
                        />
                      ) : (
                        <Wallet className="w-4 h-4" />
                      )}
                      Propinar desde billetera
                    </motion.button>
                  </div>

                  {/* Skip tip */}
                  <button
                    type="button"
                    onClick={handleSkipTip}
                    className="w-full text-center text-sm text-gray-500 hover:text-gray-300 transition-colors py-1"
                  >
                    Omitir
                  </button>
                </motion.div>
              )}

              {/* ══════════════════════════════════════════════════
                  STAGE: DONE (success animation)
                  ══════════════════════════════════════════════════ */}
              {(stage === 'done' || tipSuccess) && (
                <motion.div
                  key="done"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                  className="text-center py-4"
                >
                  {/* Animated checkmark */}
                  <motion.div
                    className="relative w-20 h-20 mx-auto mb-5"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{
                      delay: 0.1,
                      type: 'spring',
                      stiffness: 200,
                      damping: 12,
                    }}
                  >
                    <motion.div
                      className="absolute inset-0 rounded-full bg-emerald-400/20"
                      animate={{
                        scale: [1, 1.4, 1],
                        opacity: [0.3, 0, 0.3],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                    />
                    <div className="relative w-20 h-20 rounded-full bg-emerald-400/15 flex items-center justify-center">
                      <motion.div
                        initial={{ scale: 0, rotate: -45 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{
                          delay: 0.3,
                          type: 'spring',
                          stiffness: 250,
                        }}
                      >
                        <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                      </motion.div>
                    </div>
                  </motion.div>

                  {/* Sparkles decoration */}
                  <motion.div
                    className="flex justify-center gap-3 mb-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                  >
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        initial={{ y: 0, opacity: 0 }}
                        animate={{
                          y: [0, -8, 0],
                          opacity: [0, 1, 0.6],
                        }}
                        transition={{
                          delay: 0.5 + i * 0.15,
                          duration: 1.5,
                          repeat: Infinity,
                          repeatDelay: 0.5,
                        }}
                      >
                        <Sparkles className="w-4 h-4 text-yellow-400/60" />
                      </motion.div>
                    ))}
                  </motion.div>

                  <motion.h2
                    className="text-xl font-bold text-white mb-2"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 }}
                  >
                    ¡Gracias por tu opinión!
                  </motion.h2>

                  <motion.p
                    className="text-sm text-gray-400 mb-2"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.45 }}
                  >
                    Tu calificación ayuda a mejorar el servicio
                  </motion.p>

                  {tipSuccess && effectiveTipAmount > 0 && (
                    <motion.p
                      className="text-sm text-emerald-400/80 mb-2 flex items-center justify-center gap-1.5"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.55 }}
                    >
                      <HeartHandshake className="w-4 h-4" />
                      Propina de {formatCRC(effectiveTipAmount)} enviada
                    </motion.p>
                  )}

                  <motion.p
                    className="text-xs text-gray-500 mb-6"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                  >
                    ¡Hasta tu próximo viaje! 🚗
                  </motion.p>

                  <motion.button
                    type="button"
                    onClick={handleDone}
                    className="w-full py-3 rounded-xl font-semibold text-white text-sm btn-neon transition-all"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.65 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Listo
                  </motion.button>
                </motion.div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
