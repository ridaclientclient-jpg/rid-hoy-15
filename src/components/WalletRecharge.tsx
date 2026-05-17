'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Smartphone, CreditCard, Plus, CheckCircle, Loader2, X,
  Wallet, ShieldCheck, AlertTriangle,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { toast } from 'sonner';

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */

type PaymentMethod = 'sinpe' | 'card';

type RechargeStep = 'form' | 'processing' | 'success' | 'error';

interface WalletRechargeProps {
  open: boolean;
  onClose: () => void;
  currentBalance: number;
  onRecharged: (newBalance: number) => void;
  session: { access_token: string } | null;
}

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════ */

const QUICK_AMOUNTS = [1000, 2000, 5000, 10000, 20000, 50000];

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */

function formatCRC(amount: number): string {
  return `₡${Math.round(amount).toLocaleString('es-CR')}`;
}

function formatPhone(val: string): string {
  const digits = val.replace(/\D/g, '').slice(0, 8);
  if (digits.length > 4) return digits.slice(0, 4) + '-' + digits.slice(4);
  return digits;
}

function formatAmount(val: string): string {
  const digits = val.replace(/\D/g, '').slice(0, 7);
  return digits;
}

/* ═══════════════════════════════════════════════════════════════
   SUCCESS ANIMATION
   ═══════════════════════════════════════════════════════════════ */

function SuccessAnimation({ amount, newBalance, onDone }: {
  amount: number;
  newBalance: number;
  onDone: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onDone, 3500);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-10 px-6 text-center"
    >
      {/* Animated checkmark circle */}
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.15 }}
        className="relative w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-green-400 flex items-center justify-center mb-6 shadow-xl shadow-emerald-500/30"
      >
        <CheckCircle className="w-10 h-10 text-white" />
        {/* Pulse ring */}
        <motion.div
          initial={{ scale: 1, opacity: 0.6 }}
          animate={{ scale: 1.8, opacity: 0 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
          className="absolute inset-0 rounded-full border-2 border-emerald-400"
        />
      </motion.div>

      <motion.h3
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-lg font-bold text-white mb-1"
      >
        Recarga exitosa
      </motion.h3>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="text-2xl font-extrabold text-emerald-400 mb-4"
      >
        +{formatCRC(amount)}
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55 }}
        className="glass-strong rounded-2xl px-6 py-3 w-full"
      >
        <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Nuevo saldo</p>
        <p className="text-xl font-extrabold text-white">{formatCRC(newBalance)}</p>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="text-[10px] text-gray-600 mt-4"
      >
        Cerrando automaticamente...
      </motion.p>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PROCESSING ANIMATION
   ═══════════════════════════════════════════════════════════════ */

function ProcessingAnimation() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center py-16 px-6 text-center"
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        className="w-16 h-16 rounded-full border-4 border-cyan-500/20 border-t-cyan-500 mb-6"
      >
        <div className="w-full h-full flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
        </div>
      </motion.div>
      <h3 className="text-sm font-semibold text-white mb-1">
        Procesando recarga...
      </h3>
      <p className="text-[10px] text-gray-500">
        Esto puede tomar unos segundos
      </p>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export function WalletRecharge({
  open,
  onClose,
  currentBalance,
  onRecharged,
  session,
}: WalletRechargeProps) {
  /* State */
  const [step, setStep] = useState<RechargeStep>('form');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('sinpe');
  const [amount, setAmount] = useState('');
  const [sinpePhone, setSinpePhone] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [processedAmount, setProcessedAmount] = useState(0);
  const [newBalance, setNewBalance] = useState(0);

  /* Reset form when opening */
  useEffect(() => {
    if (open) {
      setStep('form');
      setAmount('');
      setSinpePhone('');
      setCardNumber('');
      setCardExpiry('');
      setCardCvv('');
      setErrorMsg('');
      setProcessedAmount(0);
      setNewBalance(0);
    }
  }, [open]);

  /* ── Validate & Submit ───────────────────────────────────── */
  const handleSubmit = useCallback(async () => {
    const numericAmount = Number(formatAmount(amount));

    // Validation
    if (!numericAmount || numericAmount < 500) {
      setErrorMsg('El monto minimo de recarga es ₡500');
      toast.error('Monto minimo: ₡500');
      return;
    }
    if (numericAmount > 500000) {
      setErrorMsg('El monto maximo por recarga es ₡500,000');
      toast.error('Monto maximo: ₡500,000');
      return;
    }

    if (paymentMethod === 'sinpe') {
      const digits = sinpePhone.replace(/\D/g, '');
      if (digits.length < 8) {
        setErrorMsg('Ingresa un numero de telefono SINPE valido (8 digitos)');
        toast.error('Numero SINPE invalido');
        return;
      }
    }

    if (paymentMethod === 'card') {
      const digits = cardNumber.replace(/\D/g, '');
      if (digits.length < 13) {
        setErrorMsg('Numero de tarjeta invalido');
        toast.error('Tarjeta invalida');
        return;
      }
      if (cardExpiry.replace(/\D/g, '').length < 4) {
        setErrorMsg('Fecha de vencimiento invalida');
        toast.error('Vencimiento invalido');
        return;
      }
      if (cardCvv.replace(/\D/g, '').length < 3) {
        setErrorMsg('CVV invalido');
        toast.error('CVV invalido');
        return;
      }
    }

    setErrorMsg('');
    setStep('processing');

    try {
      const body: Record<string, unknown> = {
        amount: numericAmount,
        method: paymentMethod,
      };

      if (paymentMethod === 'sinpe') {
        body.phone = sinpePhone;
      }
      if (paymentMethod === 'card') {
        body.card_last_four = cardNumber.replace(/\D/g, '').slice(-4);
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const res = await fetch('/api/wallet/recharge', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al procesar la recarga');
      }

      const calculatedBalance = currentBalance + numericAmount;
      setProcessedAmount(numericAmount);
      setNewBalance(data.new_balance ?? calculatedBalance);
      setStep('success');

      toast.success(`Recarga de ${formatCRC(numericAmount)} exitosa`);

      // Notify parent after a short delay
      setTimeout(() => {
        onRecharged(data.new_balance ?? calculatedBalance);
      }, 800);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error de conexion. Intenta de nuevo.';
      setErrorMsg(message);
      toast.error(message);
      setStep('error');
    }
  }, [
    amount, paymentMethod, sinpePhone, cardNumber, cardExpiry, cardCvv,
    currentBalance, session, onRecharged,
  ]);

  /* ── Success auto-close ──────────────────────────────────── */
  const handleSuccessDone = useCallback(() => {
    onClose();
  }, [onClose]);

  /* ── Retry from error ────────────────────────────────────── */
  const handleRetry = useCallback(() => {
    setErrorMsg('');
    setStep('form');
  }, []);

  /* ── Quick amount selection ──────────────────────────────── */
  const handleQuickAmount = useCallback((quickAmount: number) => {
    setAmount(String(quickAmount));
    setErrorMsg('');
  }, []);

  /* ── Card number formatting ──────────────────────────────── */
  const handleCardNumberChange = useCallback((val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 16);
    setCardNumber(digits.replace(/(\d{4})(?=\d)/g, '$1 '));
  }, []);

  /* ── Card expiry formatting ──────────────────────────────── */
  const handleCardExpiryChange = useCallback((val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 3) {
      setCardExpiry(digits.slice(0, 2) + '/' + digits.slice(2));
    } else {
      setCardExpiry(digits);
    }
  }, []);

  /* ═══════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════ */
  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent
        side="bottom"
        className="!max-w-lg mx-auto !rounded-t-3xl !rounded-b-none glass-strong !bg-gray-950/95 backdrop-blur-xl border-t border-white/10 p-0 overflow-hidden"
        style={{ height: 'auto', maxHeight: '90vh' }}
      >
        {/* Custom drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* ── Success Step ─────────────────────────────────── */}
        {step === 'success' && (
          <SuccessAnimation
            amount={processedAmount}
            newBalance={newBalance}
            onDone={handleSuccessDone}
          />
        )}

        {/* ── Processing Step ─────────────────────────────── */}
        {step === 'processing' && <ProcessingAnimation />}

        {/* ── Error Step ──────────────────────────────────── */}
        {step === 'error' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-16 px-6 text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
              className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4"
            >
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </motion.div>
            <h3 className="text-sm font-semibold text-white mb-1">
              Recarga fallida
            </h3>
            <p className="text-xs text-gray-400 mb-6 max-w-[240px]">
              {errorMsg || 'Ocurrio un error inesperado'}
            </p>
            <button
              type="button"
              onClick={handleRetry}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-400 text-white text-sm font-semibold shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 transition-shadow"
            >
              Reintentar
            </button>
          </motion.div>
        )}

        {/* ── Form Step ───────────────────────────────────── */}
        {step === 'form' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          >
            <SheetHeader className="px-6 pt-2 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-emerald-400 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                  <Plus className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <SheetTitle className="text-base font-bold text-white text-left">
                    Recargar billetera
                  </SheetTitle>
                  <SheetDescription className="text-[10px] text-gray-500 text-left">
                    Saldo actual: {formatCRC(currentBalance)}
                  </SheetDescription>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                  aria-label="Cerrar"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            </SheetHeader>

            <div className="px-6 pb-6 space-y-5 overflow-y-auto max-h-[60vh]">
              {/* ── Payment method selector ──────────────── */}
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-2">
                  Metodo de pago
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {/* SINPE Móvil */}
                  <motion.button
                    type="button"
                    onClick={() => { setPaymentMethod('sinpe'); setErrorMsg(''); }}
                    whileTap={{ scale: 0.97 }}
                    className={`flex items-center gap-2.5 p-3.5 rounded-xl transition-all text-left ${
                      paymentMethod === 'sinpe'
                        ? 'glass-strong border-2 border-amber-500/50 shadow-lg shadow-amber-500/10'
                        : 'glass border border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      paymentMethod === 'sinpe'
                        ? 'bg-gradient-to-br from-amber-500 to-orange-400'
                        : 'bg-white/10'
                    }`}>
                      <Smartphone className="w-4 h-4 text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className={`text-xs font-semibold ${paymentMethod === 'sinpe' ? 'text-white' : 'text-gray-300'}`}>
                        SINPE Movil
                      </p>
                      <p className="text-[10px] text-gray-500">Recomendado</p>
                    </div>
                    {paymentMethod === 'sinpe' && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="ml-auto w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center"
                      >
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </motion.div>
                    )}
                  </motion.button>

                  {/* Tarjeta */}
                  <motion.button
                    type="button"
                    onClick={() => { setPaymentMethod('card'); setErrorMsg(''); }}
                    whileTap={{ scale: 0.97 }}
                    className={`flex items-center gap-2.5 p-3.5 rounded-xl transition-all text-left ${
                      paymentMethod === 'card'
                        ? 'glass-strong border-2 border-purple-500/50 shadow-lg shadow-purple-500/10'
                        : 'glass border border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      paymentMethod === 'card'
                        ? 'bg-gradient-to-br from-purple-500 to-violet-400'
                        : 'bg-white/10'
                    }`}>
                      <CreditCard className="w-4 h-4 text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className={`text-xs font-semibold ${paymentMethod === 'card' ? 'text-white' : 'text-gray-300'}`}>
                        Tarjeta
                      </p>
                      <p className="text-[10px] text-gray-500">Credito / debito</p>
                    </div>
                    {paymentMethod === 'card' && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="ml-auto w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center"
                      >
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </motion.div>
                    )}
                  </motion.button>
                </div>
              </div>

              {/* ── Quick amount buttons ──────────────────── */}
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-2">
                  Monto rapido
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {QUICK_AMOUNTS.map((quickAmount) => {
                    const isSelected = formatAmount(amount) === String(quickAmount);
                    return (
                      <motion.button
                        key={quickAmount}
                        type="button"
                        onClick={() => handleQuickAmount(quickAmount)}
                        whileTap={{ scale: 0.95 }}
                        className={`py-2.5 px-3 rounded-xl text-center transition-all font-semibold ${
                          isSelected
                            ? 'bg-gradient-to-r from-cyan-500 to-cyan-400 text-white shadow-lg shadow-cyan-500/20'
                            : 'glass border border-white/10 text-gray-300 hover:border-white/20 hover:bg-white/10'
                        }`}
                      >
                        <span className={`text-xs ${isSelected ? 'text-white' : ''}`}>
                          {formatCRC(quickAmount)}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* ── Custom amount input ───────────────────── */}
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-2">
                  Monto personalizado
                </p>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-500">
                    ₡
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={amount ? Number(formatAmount(amount)).toLocaleString('es-CR') : ''}
                    onChange={(e) => {
                      setAmount(formatAmount(e.target.value));
                      setErrorMsg('');
                    }}
                    placeholder="0"
                    className="w-full pl-8 pr-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-xl font-extrabold text-white placeholder:text-gray-700 outline-none focus:border-cyan-500/40 transition-colors text-right"
                  />
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <p className="text-[10px] text-gray-600">
                    Minimo ₡500 / Maximo ₡500,000
                  </p>
                  {amount && Number(formatAmount(amount)) >= 500 && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-[10px] text-emerald-400 font-medium"
                    >
                      Nuevo saldo: {formatCRC(currentBalance + Number(formatAmount(amount)))}
                    </motion.p>
                  )}
                </div>
              </div>

              {/* ── Method-specific inputs ────────────────── */}
              <AnimatePresence mode="wait">
                {paymentMethod === 'sinpe' && (
                  <motion.div
                    key="sinpe-input"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-2">
                      Numero SINPE Movil
                    </p>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 font-mono">
                        +506
                      </span>
                      <input
                        type="tel"
                        inputMode="numeric"
                        value={sinpePhone}
                        onChange={(e) => {
                          setSinpePhone(formatPhone(e.target.value));
                          setErrorMsg('');
                        }}
                        placeholder="8XXX-XXXX"
                        maxLength={9}
                        className="w-full pl-14 pr-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-gray-600 outline-none focus:border-amber-500/40 font-mono transition-colors"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 mt-2">
                      <ShieldCheck className="w-3 h-3 text-amber-400/60" />
                      <p className="text-[10px] text-gray-600">
                        El numero debe estar registrado en tu banco
                      </p>
                    </div>
                  </motion.div>
                )}

                {paymentMethod === 'card' && (
                  <motion.div
                    key="card-input"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden space-y-3"
                  >
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-2">
                        Numero de tarjeta
                      </p>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={cardNumber}
                        onChange={(e) => {
                          handleCardNumberChange(e.target.value);
                          setErrorMsg('');
                        }}
                        placeholder="4242 4242 4242 4242"
                        maxLength={19}
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-gray-600 outline-none focus:border-purple-500/40 font-mono transition-colors"
                      />
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-2">
                          Vencimiento
                        </p>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={cardExpiry}
                          onChange={(e) => {
                            handleCardExpiryChange(e.target.value);
                            setErrorMsg('');
                          }}
                          placeholder="MM/AA"
                          maxLength={5}
                          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-gray-600 outline-none focus:border-purple-500/40 font-mono transition-colors"
                        />
                      </div>
                      <div className="w-28">
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-2">
                          CVV
                        </p>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={cardCvv}
                          onChange={(e) => {
                            setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4));
                            setErrorMsg('');
                          }}
                          placeholder="123"
                          maxLength={4}
                          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-gray-600 outline-none focus:border-purple-500/40 font-mono transition-colors"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Error message ─────────────────────────── */}
              <AnimatePresence>
                {errorMsg && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                      <p className="text-xs text-red-400">{errorMsg}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Submit button ─────────────────────────── */}
              <motion.button
                type="button"
                onClick={handleSubmit}
                whileHover={{ scale: 1.01, y: -1 }}
                whileTap={{ scale: 0.98 }}
                disabled={!amount || Number(formatAmount(amount)) < 500}
                className={`w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2.5 transition-all shadow-xl ${
                  !amount || Number(formatAmount(amount)) < 500
                    ? 'bg-white/5 text-gray-600 cursor-not-allowed shadow-none'
                    : paymentMethod === 'sinpe'
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-amber-500/30 hover:shadow-amber-500/50'
                      : 'bg-gradient-to-r from-purple-500 to-violet-500 text-white shadow-purple-500/30 hover:shadow-purple-500/50'
                }`}
              >
                {paymentMethod === 'sinpe' ? (
                  <>
                    <Smartphone className="w-4 h-4" />
                    Iniciar recarga SINPE
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    Pagar con tarjeta
                  </>
                )}
              </motion.button>

              {/* ── Security note ─────────────────────────── */}
              <div className="flex items-center justify-center gap-1.5 pb-2">
                <ShieldCheck className="w-3 h-3 text-gray-600" />
                <p className="text-[10px] text-gray-600">
                  Transaccion protegida y encriptada
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default WalletRecharge;
