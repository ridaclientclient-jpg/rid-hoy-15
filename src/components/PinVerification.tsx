'use client';

import { useReducer, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Lock, X, Loader2, CheckCircle, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

// ── Types ───────────────────────────────────────────────────────────────────

interface Session {
  access_token: string;
}

interface PinVerificationProps {
  rideId: string;
  session: Session | null;
  onVerified: () => void;
  onSkip: () => void;
}

type PinStatus = 'idle' | 'verifying' | 'success' | 'error';

interface PinState {
  pin: string[];
  status: PinStatus;
  attempts: number;
  errorMsg: string;
}

type PinAction =
  | { type: 'SET_DIGIT'; index: number; value: string }
  | { type: 'CLEAR_DIGIT'; index: number }
  | { type: 'CLEAR_DIGIT_PREV'; index: number }
  | { type: 'SET_PIN'; pin: string[] }
  | { type: 'SET_STATUS'; status: PinStatus }
  | { type: 'SET_ERROR'; msg: string }
  | { type: 'INCREMENT_ATTEMPTS' }
  | { type: 'RESET_ALL' };

const MAX_ATTEMPTS = 3;
const API_ENDPOINT = '/api/rides/verify-pin';

// ── Reducer ─────────────────────────────────────────────────────────────────

const initialPinState: PinState = {
  pin: ['', '', '', ''],
  status: 'idle',
  attempts: 0,
  errorMsg: '',
};

function pinReducer(state: PinState, action: PinAction): PinState {
  switch (action.type) {
    case 'SET_DIGIT': {
      const newPin = [...state.pin];
      newPin[action.index] = action.value;
      return { ...state, pin: newPin, errorMsg: '' };
    }
    case 'CLEAR_DIGIT': {
      const newPin = [...state.pin];
      newPin[action.index] = '';
      return { ...state, pin: newPin };
    }
    case 'CLEAR_DIGIT_PREV': {
      const newPin = [...state.pin];
      newPin[action.index] = '';
      newPin[action.index - 1] = '';
      return { ...state, pin: newPin };
    }
    case 'SET_PIN':
      return { ...state, pin: action.pin };
    case 'SET_STATUS':
      return { ...state, status: action.status };
    case 'SET_ERROR':
      return { ...state, errorMsg: action.msg };
    case 'INCREMENT_ATTEMPTS':
      return { ...state, attempts: state.attempts + 1 };
    case 'RESET_ALL':
      return { ...initialPinState };
    default:
      return state;
  }
}

// ── Animation Variants ──────────────────────────────────────────────────────

const shakeVariant = {
  initial: { x: 0 },
  shake: {
    x: [0, -12, 12, -8, 8, -4, 4, 0],
    transition: { duration: 0.5 },
  },
};

const digitPopVariant = {
  initial: { scale: 0.8, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  pop: {
    scale: [1, 1.3, 1],
    transition: { duration: 0.15 },
  },
};

const successCheckVariant = {
  hidden: { scale: 0, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 200,
      damping: 15,
      delay: 0.1,
    },
  },
};

const successCircleVariant = {
  hidden: { scale: 0, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: { type: 'spring', stiffness: 150, damping: 12 },
  },
};

const successRingVariant = {
  hidden: { scale: 0.8, opacity: 0 },
  visible: {
    scale: [0.8, 1.3, 1],
    opacity: [0, 0.4, 0],
    transition: { duration: 0.8, ease: 'easeOut' },
  },
};

// ── Main Component ──────────────────────────────────────────────────────────

export function PinVerification({
  rideId,
  session,
  onVerified,
  onSkip,
}: PinVerificationProps) {
  const [state, dispatch] = useReducer(pinReducer, initialPinState);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // NOTE: Parent should pass key={rideId} to reset state on ride change.

  // ── Auto-focus first input on mount ─────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  // ── Submit PIN ───────────────────────────────────────────────────────────
  async function submitPin(pinValue: string, currentAttempts: number) {
    if (pinValue.length !== 4) return;
    if (currentAttempts >= MAX_ATTEMPTS) {
      toast.error('Maximo de intentos alcanzado', {
        description: 'Se ha notificado al pasajero.',
      });
      return;
    }
    if (!session?.access_token) {
      toast.error('Sesion no disponible');
      return;
    }

    dispatch({ type: 'SET_STATUS', status: 'verifying' });
    dispatch({ type: 'SET_ERROR', msg: '' });

    try {
      const res = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          ride_id: rideId,
          pin: pinValue,
        }),
      });

      const data = await res.json();

      if (res.ok && data.valid) {
        dispatch({ type: 'SET_STATUS', status: 'success' });
        toast.success('PIN verificado', {
          description: 'El viaje ha iniciado correctamente.',
        });
        setTimeout(() => {
          onVerified();
        }, 1800);
      } else {
        const newAttempts = currentAttempts + 1;
        dispatch({ type: 'INCREMENT_ATTEMPTS' });
        dispatch({ type: 'SET_STATUS', status: 'error' });
        dispatch({
          type: 'SET_ERROR',
          msg:
            data.error ||
            `PIN incorrecto. Intento ${newAttempts} de ${MAX_ATTEMPTS}.`,
        });

        // Shake animation
        containerRef.current?.classList.add('animate-shake');
        setTimeout(
          () => containerRef.current?.classList.remove('animate-shake'),
          600
        );

        // Clear input after shake
        setTimeout(() => {
          dispatch({ type: 'SET_PIN', pin: ['', '', '', ''] });
          dispatch({ type: 'SET_STATUS', status: 'idle' });
          if (newAttempts >= MAX_ATTEMPTS) {
            toast.error('Maximo de intentos alcanzado', {
              description:
                'Se ha notificado al pasajero que proporciona el PIN directamente.',
              duration: 6000,
            });
            dispatch({
              type: 'SET_ERROR',
              msg: 'Se han agotado los intentos. Se ha notificado al pasajero.',
            });
          } else {
            inputRefs.current[0]?.focus();
          }
        }, 1000);
      }
    } catch (err: any) {
      console.error('[PinVerification] Error:', err);
      dispatch({ type: 'SET_STATUS', status: 'error' });
      dispatch({
        type: 'SET_ERROR',
        msg: 'Error de conexion. Verifica tu red e intenta de nuevo.',
      });
      toast.error('Error de verificacion', {
        description: err?.message || 'No se pudo verificar el PIN.',
      });

      setTimeout(() => {
        dispatch({ type: 'SET_PIN', pin: ['', '', '', ''] });
        dispatch({ type: 'SET_STATUS', status: 'idle' });
        dispatch({ type: 'SET_ERROR', msg: '' });
        inputRefs.current[0]?.focus();
      }, 1500);
    }
  }

  // ── Input Handler ────────────────────────────────────────────────────────
  function handleDigitInput(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1);

    if (!digit && value === '') {
      dispatch({ type: 'CLEAR_DIGIT', index });
      if (index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
      return;
    }

    if (!digit) return;

    dispatch({ type: 'SET_DIGIT', index, value: digit });

    // Animate the digit pop
    const digitEl = inputRefs.current[index]?.parentElement;
    if (digitEl) {
      digitEl.classList.add('scale-110');
      setTimeout(() => digitEl.classList.remove('scale-110'), 150);
    }

    // Auto-focus next box
    if (index < 3) {
      setTimeout(() => inputRefs.current[index + 1]?.focus(), 50);
    }

    // Auto-submit when all 4 digits entered
    if (index === 3) {
      const newPin = [...state.pin];
      newPin[index] = digit;
      const completePin = newPin.join('');
      setTimeout(() => submitPin(completePin, state.attempts), 300);
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (state.pin[index]) {
        dispatch({ type: 'CLEAR_DIGIT', index });
      } else if (index > 0) {
        dispatch({ type: 'CLEAR_DIGIT_PREV', index });
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData('text')
      .replace(/\D/g, '')
      .slice(0, 4);
    if (pasted.length === 0) return;

    const newPin = ['', '', '', ''];
    for (let i = 0; i < pasted.length; i++) {
      newPin[i] = pasted[i];
    }
    dispatch({ type: 'SET_PIN', pin: newPin });

    const focusIdx = Math.min(pasted.length, 3);
    setTimeout(() => inputRefs.current[focusIdx]?.focus(), 50);

    if (pasted.length === 4) {
      setTimeout(() => submitPin(pasted, state.attempts), 300);
    }
  }

  function handleNoPin() {
    toast.info('Solicitud enviada', {
      description:
        'Se ha abierto el chat con el pasajero para que comparta el PIN.',
      duration: 4000,
    });
    onSkip();
  }

  // ── Success Screen ───────────────────────────────────────────────────────
  if (state.status === 'success') {
    return (
      <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-strong rounded-2xl p-8 flex flex-col items-center"
        >
          <div className="relative w-28 h-28 flex items-center justify-center mb-4">
            <motion.div
              variants={successRingVariant}
              initial="hidden"
              animate="visible"
              className="absolute inset-0 rounded-full bg-emerald-500/20"
            />
            <motion.div
              variants={successCircleVariant}
              initial="hidden"
              animate="visible"
              className="absolute inset-2 rounded-full bg-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center"
            >
              <motion.div
                variants={successCheckVariant}
                initial="hidden"
                animate="visible"
              >
                <CheckCircle
                  className="w-14 h-14 text-emerald-400"
                  strokeWidth={1.5}
                />
              </motion.div>
            </motion.div>
          </div>

          <motion.h3
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-xl font-bold text-white mb-1"
          >
            PIN Verificado
          </motion.h3>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="text-sm text-gray-400"
          >
            Iniciando viaje...
          </motion.p>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="flex gap-1.5 mt-4"
          >
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  delay: i * 0.2,
                }}
              />
            ))}
          </motion.div>
        </motion.div>
      </div>
    );
  }

  // ── Main PIN Screen ──────────────────────────────────────────────────────
  const isMaxAttempts = state.attempts >= MAX_ATTEMPTS;

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        ref={containerRef}
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="glass-strong rounded-2xl p-6 max-w-sm w-full"
      >
        {/* Close button */}
        <button
          onClick={onSkip}
          className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center">
          {/* Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{
              type: 'spring',
              stiffness: 200,
              damping: 15,
              delay: 0.1,
            }}
            className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4"
          >
            <Shield className="w-8 h-8 text-emerald-400" />
          </motion.div>

          {/* Title */}
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg font-bold text-white mb-1"
          >
            Verificar PIN del Pasajero
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-sm text-gray-400 mb-6"
          >
            Ingresa el PIN de 4 digitos proporcionado por el pasajero
          </motion.p>

          {/* PIN Digits */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={
              state.status === 'error'
                ? 'shake'
                : { opacity: 1, y: 0 }
            }
            transition={{ delay: 0.35 }}
            className="flex justify-center gap-3 mb-4"
            variants={shakeVariant}
            key={`pin-group-${state.attempts}`}
          >
            {state.pin.map((digit, index) => (
              <motion.div
                key={`digit-${index}-${state.attempts}`}
                variants={digitPopVariant}
                initial="initial"
                animate={digit ? 'pop' : 'animate'}
                className="relative"
              >
                <input
                  ref={(el) => {
                    inputRefs.current[index] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleDigitInput(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={index === 0 ? handlePaste : undefined}
                  readOnly={state.status === 'verifying' || isMaxAttempts}
                  aria-label={`Digito ${index + 1} del PIN`}
                  className={`
                    w-14 h-16 sm:w-16 sm:h-18
                    text-center text-2xl sm:text-3xl font-bold
                    rounded-xl border-2
                    bg-white/5
                    transition-all duration-200
                    focus:outline-none
                    ${
                      state.status === 'error'
                        ? 'border-red-500/50 text-red-400 bg-red-500/10'
                        : state.status === 'verifying'
                          ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/5'
                          : digit
                            ? 'border-emerald-500/40 text-white bg-white/10'
                            : 'border-white/10 text-white placeholder:text-gray-600 focus:border-emerald-500/50 focus:bg-white/10'
                    }
                    ${isMaxAttempts ? 'opacity-40 cursor-not-allowed' : ''}
                  `}
                  style={{ caretColor: 'transparent' }}
                />
                {/* Active indicator dot */}
                {state.status === 'idle' && !digit && !isMaxAttempts && (
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
                    <motion.div
                      animate={{ opacity: [0.3, 0.8, 0.3] }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        delay: index * 0.15,
                      }}
                      className="w-1 h-1 rounded-full bg-gray-500"
                    />
                  </div>
                )}
              </motion.div>
            ))}
          </motion.div>

          {/* Error Message */}
          <AnimatePresence mode="wait">
            {state.errorMsg && (
              <motion.div
                key={`error-${state.attempts}`}
                initial={{ opacity: 0, y: -5, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: 5, height: 0 }}
                className="overflow-hidden"
              >
                <div
                  className={`text-xs px-3 py-2 rounded-lg mb-4 flex items-center gap-1.5 ${
                    isMaxAttempts
                      ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                      : 'bg-red-500/15 text-red-400 border border-red-500/20'
                  }`}
                >
                  <X className="w-3 h-3 shrink-0" />
                  <span>{state.errorMsg}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Verifying spinner */}
          <AnimatePresence>
            {state.status === 'verifying' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-center gap-2 text-sm text-emerald-400 mb-4"
              >
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verificando...</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Attempts Counter */}
          {!isMaxAttempts && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="flex items-center justify-center gap-1.5 mb-4"
            >
              <Lock className="w-3.5 h-3.5 text-gray-600" />
              <span className="text-xs text-gray-600">
                Intento {state.attempts} de {MAX_ATTEMPTS}
              </span>
              <div className="flex gap-1 ml-2">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full transition-colors ${
                      i < state.attempts
                        ? 'bg-red-400'
                        : i === state.attempts && state.status === 'error'
                          ? 'bg-red-400/50'
                          : 'bg-gray-700'
                    }`}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* Max attempts notice */}
          {isMaxAttempts && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-4"
            >
              <p className="text-xs text-amber-400 text-center">
                Se ha notificado al pasajero. Por favor espera a que comparta el
                PIN a traves del chat.
              </p>
            </motion.div>
          )}

          {/* No tengo el PIN */}
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleNoPin}
            className="text-sm text-gray-400 hover:text-emerald-400 transition-colors flex items-center gap-1.5 mx-auto"
          >
            <MessageCircle className="w-4 h-4" />
            No tengo el PIN — Contactar pasajero
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}

export default PinVerification;
