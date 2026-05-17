'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Banknote, Wallet, CreditCard, Smartphone,
  Check, AlertTriangle, ChevronDown, ChevronUp, Loader2,
} from 'lucide-react';
import { supabase, type Wallet as WalletType } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';

export type PaymentMethod = 'cash' | 'wallet' | 'card' | 'sinpe';

export interface PaymentOption {
  id: PaymentMethod;
  label: string;
  desc: string;
  icon: React.ElementType;
  color: string;
  gradient: string;
}

export const PAYMENT_OPTIONS: PaymentOption[] = [
  { id: 'cash', label: 'Efectivo', desc: 'Paga en efectivo al conductor', icon: Banknote, color: 'text-emerald-400', gradient: 'from-emerald-600 to-green-500' },
  { id: 'wallet', label: 'Billetera RIDA', desc: 'Pago con saldo de tu billetera', icon: Wallet, color: 'text-cyan-400', gradient: 'from-blue-600 to-cyan-500' },
  { id: 'card', label: 'Tarjeta', desc: 'Credito o debito (Visa, Mastercard)', icon: CreditCard, color: 'text-purple-400', gradient: 'from-purple-600 to-violet-500' },
  { id: 'sinpe', label: 'SINPE Movil', desc: 'Transferencia instantanea SINPE', icon: Smartphone, color: 'text-amber-400', gradient: 'from-amber-600 to-orange-500' },
];

/* ─── Card Input Sub-form ─────────────────────────────────── */
function CardInput({ cardNumber, setCardNumber, cardExpiry, setCardExpiry, cardCvv, setCardCvv }: {
  cardNumber: string; setCardNumber: (v: string) => void;
  cardExpiry: string; setCardExpiry: (v: string) => void;
  cardCvv: string; setCardCvv: (v: string) => void;
}) {
  const formatCardNumber = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  const formatExpiry = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 3) return digits.slice(0, 2) + '/' + digits.slice(2);
    return digits;
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div className="space-y-3 pt-3 mt-3 border-t border-white/10">
        <div>
          <label className="text-[10px] text-gray-500 uppercase tracking-wider">Numero de tarjeta</label>
          <input
            type="text"
            value={cardNumber}
            onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
            placeholder="4242 4242 4242 4242"
            maxLength={19}
            className="w-full mt-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-gray-600 outline-none focus:border-purple-500/40 font-mono"
          />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-[10px] text-gray-500 uppercase tracking-wider">Vencimiento</label>
            <input
              type="text"
              value={cardExpiry}
              onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
              placeholder="MM/AA"
              maxLength={5}
              className="w-full mt-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-gray-600 outline-none focus:border-purple-500/40 font-mono"
            />
          </div>
          <div className="w-24">
            <label className="text-[10px] text-gray-500 uppercase tracking-wider">CVV</label>
            <input
              type="text"
              value={cardCvv}
              onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="123"
              maxLength={4}
              className="w-full mt-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-gray-600 outline-none focus:border-purple-500/40 font-mono"
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── SINPE Phone Input ───────────────────────────────────── */
function SinpeInput({ sinpePhone, setSinpePhone }: {
  sinpePhone: string; setSinpePhone: (v: string) => void;
}) {
  const formatPhone = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 8);
    if (digits.length > 4) return digits.slice(0, 4) + '-' + digits.slice(4);
    return digits;
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div className="pt-3 mt-3 border-t border-white/10">
        <label className="text-[10px] text-gray-500 uppercase tracking-wider">Numero SINPE</label>
        <div className="relative mt-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">+506</span>
          <input
            type="text"
            value={sinpePhone}
            onChange={(e) => setSinpePhone(formatPhone(e.target.value))}
            placeholder="8XXX-XXXX"
            maxLength={9}
            className="w-full pl-12 pr-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-gray-600 outline-none focus:border-amber-500/40 font-mono"
          />
        </div>
        <p className="text-[10px] text-gray-600 mt-1">
          Asegurate de que el numero este registrado en tu banco
        </p>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */
interface PaymentMethodSelectorProps {
  selected: PaymentMethod;
  onChange: (method: PaymentMethod, extra?: { cardLastFour?: string; sinpePhone?: string }) => void;
  estimatedPrice?: number;
}

export default function PaymentMethodSelector({ selected, onChange, estimatedPrice }: PaymentMethodSelectorProps) {
  const user = useAuthStore((s) => s.user);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [sinpePhone, setSinpePhone] = useState('');
  const [expanded, setExpanded] = useState(false);

  /* Fetch wallet balance */
  useEffect(() => {
    if (!user?.id) return;
    async function fetchWallet() {
      try {
        const { data } = await supabase
          .from('wallets')
          .select('balance')
          .eq('user_id', user.id)
          .single();
        if (data) setWalletBalance(data.balance);
      } catch {
        /* wallet might not exist yet */
      }
    }
    fetchWallet();
  }, [user?.id]);

  const handleSelect = (method: PaymentMethod) => {
    setExpanded(method !== selected || !expanded);

    if (method === selected) return;

    /* Validate wallet balance */
    if (method === 'wallet' && estimatedPrice && walletBalance !== null && walletBalance < estimatedPrice) {
      toast.error(`Saldo insuficiente. Tienes ₡${walletBalance?.toLocaleString()}, necesitas ₡${estimatedPrice.toLocaleString()}`);
      return;
    }

    const extra: { cardLastFour?: string; sinpePhone?: string } = {};

    if (method === 'card') {
      const digits = cardNumber.replace(/\D/g, '');
      if (digits.length < 12) {
        /* Allow selection but warn they need to add card */
      }
      extra.cardLastFour = digits.length >= 4 ? digits.slice(-4) : undefined;
    }

    if (method === 'sinpe') {
      const digits = sinpePhone.replace(/\D/g, '');
      if (digits.length < 8) {
        toast.error('Ingresa un numero de telefono SINPE valido');
        return;
      }
      extra.sinpePhone = sinpePhone;
    }

    onChange(method, extra);
  };

  const getOptionLabel = (option: PaymentOption) => {
    if (option.id === 'wallet' && walletBalance !== null) {
      return `Billetera RIDA — ₡${walletBalance.toLocaleString()}`;
    }
    return option.label;
  };

  const getOptionDesc = (option: PaymentOption) => {
    if (option.id === 'wallet' && estimatedPrice && walletBalance !== null) {
      if (walletBalance < estimatedPrice) {
        return `Saldo insuficiente — Recarga ₡${(estimatedPrice - walletBalance).toLocaleString()} mas`;
      }
      return `Saldo suficiente para este viaje`;
    }
    if (option.id === 'card' && selected === 'card' && cardNumber.replace(/\D/g, '').length >= 12) {
      return `**** **** **** ${cardNumber.replace(/\D/g, '').slice(-4)}`;
    }
    if (option.id === 'sinpe' && selected === 'sinpe' && sinpePhone.replace(/\D/g, '').length >= 8) {
      return `+506 ${sinpePhone}`;
    }
    return option.desc;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-400">Metodo de pago</p>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-[10px] text-gray-500 flex items-center gap-0.5 hover:text-gray-400 transition-colors"
        >
          {expanded ? 'Ver menos' : 'Ver todos'}
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {PAYMENT_OPTIONS.map((option) => {
          const isSelected = selected === option.id;
          const Icon = option.icon;
          const isWalletLow = option.id === 'wallet' && estimatedPrice && walletBalance !== null && walletBalance < estimatedPrice;

          return (
            <motion.button
              key={option.id}
              type="button"
              onClick={() => handleSelect(option.id)}
              whileTap={{ scale: 0.97 }}
              className={`relative flex items-center gap-2.5 p-3 rounded-xl transition-all text-left ${
                isSelected
                  ? 'glass-strong border-cyan-500/50 glow-cyan'
                  : 'glass hover:bg-white/10'
              } ${isWalletLow && !isSelected ? 'opacity-60' : ''}`}
            >
              {/* Check mark */}
              {isSelected && (
                <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-cyan-500 flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 text-white" />
                </div>
              )}

              {/* Icon */}
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  isSelected
                    ? `bg-gradient-to-br ${option.gradient}`
                    : 'bg-white/10'
                }`}
              >
                <Icon className="w-4 h-4 text-white" />
              </div>

              {/* Label + Desc */}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white truncate">{getOptionLabel(option)}</p>
                <p className={`text-[10px] mt-0.5 truncate ${
                  isWalletLow ? 'text-red-400' : 'text-gray-500'
                }`}>
                  {getOptionDesc(option)}
                </p>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Expanded forms */}
      {selected === 'card' && (
        <CardInput
          cardNumber={cardNumber}
          setCardNumber={setCardNumber}
          cardExpiry={cardExpiry}
          setCardExpiry={setCardExpiry}
          cardCvv={cardCvv}
          setCardCvv={setCardCvv}
        />
      )}

      {selected === 'sinpe' && (
        <SinpeInput sinpePhone={sinpePhone} setSinpePhone={setSinpePhone} />
      )}

      {/* Wallet low balance warning */}
      {selected === 'wallet' && estimatedPrice && walletBalance !== null && walletBalance < estimatedPrice && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] text-red-400 font-medium">Saldo insuficiente</p>
            <p className="text-[10px] text-red-400/70">
              Necesitas ₡{(estimatedPrice - walletBalance).toLocaleString()} mas. Recarga tu billetera.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Helper: get payment method label ────────────────────── */
export function getPaymentLabel(method: PaymentMethod): string {
  switch (method) {
    case 'cash': return 'Efectivo';
    case 'wallet': return 'Billetera RIDA';
    case 'card': return 'Tarjeta';
    case 'sinpe': return 'SINPE Movil';
    default: return 'Efectivo';
  }
}

export function getPaymentIcon(method: PaymentMethod): React.ElementType {
  switch (method) {
    case 'cash': return Banknote;
    case 'wallet': return Wallet;
    case 'card': return CreditCard;
    case 'sinpe': return Smartphone;
    default: return Banknote;
  }
}
