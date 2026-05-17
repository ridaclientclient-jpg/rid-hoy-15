'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Tag, Copy, Check, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

// ─── Types ──────────────────────────────────────────────────────
interface PromoCode {
  id: string;
  code: string;
  description: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  max_discount: number | null;
  min_ride_amount: number | null;
  valid_from: string;
  valid_until: string;
}

// ─── Helpers ────────────────────────────────────────────────────
function formatCRC(amount: number): string {
  return `₡${amount.toLocaleString('es-CR')}`;
}

function formatDiscount(promo: PromoCode): string {
  if (promo.discount_type === 'percentage') {
    return `${promo.discount_value}%`;
  }
  return formatCRC(promo.discount_value) + ' off';
}

function formatValidity(from: string, until: string): string {
  const startDate = new Date(from).toLocaleDateString('es-CR', { day: 'numeric', month: 'short' });
  const endDate = new Date(until).toLocaleDateString('es-CR', { day: 'numeric', month: 'short' });
  return `${startDate} – ${endDate}`;
}

// ─── Component ──────────────────────────────────────────────────
export default function ActivePromosBanner() {
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch active promos from Supabase
  useEffect(() => {
    const fetchPromos = async () => {
      try {
        const now = new Date().toISOString();

        const { data, error } = await supabase
          .from('promo_codes')
          .select(
            'id, code, description, discount_type, discount_value, max_discount, min_ride_amount, valid_from, valid_until'
          )
          .eq('is_active', true)
          .lte('valid_from', now)
          .gte('valid_until', now)
          .or('usage_limit.is.null,times_used.lt.usage_limit')
          .order('valid_until', { ascending: true });

        if (error) {
          console.error('[PromosBanner] Supabase error:', error);
          return;
        }

        setPromos((data as PromoCode[]) ?? []);
      } catch (err) {
        console.error('[PromosBanner] Fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPromos();
  }, []);

  // Copy promo code to clipboard
  const handleCopy = async (promo: PromoCode) => {
    try {
      await navigator.clipboard.writeText(promo.code);
      setCopiedId(promo.id);
      toast.success(`Codigo "${promo.code}" copiado al portapapeles`, {
        description: 'Pegalo al solicitar tu viaje para aplicar el descuento.',
        duration: 3000,
      });

      // Reset copied state after 2 seconds
      setTimeout(() => {
        setCopiedId(null);
      }, 2000);
    } catch {
      toast.error('No se pudo copiar el codigo', {
        description: 'Intenta copiarlo manualmente.',
      });
    }
  };

  // Scroll helpers
  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const amount = direction === 'left' ? -240 : 240;
    scrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
  };

  // Don't render anything while loading or if no active promos
  if (loading || promos.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="w-full"
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-cyan-500/15 flex items-center justify-center">
            <Tag className="w-4 h-4 text-cyan-400" />
          </div>
          <h3 className="text-sm font-semibold text-white">Promociones activas</h3>
          <span className="text-[10px] font-medium text-cyan-400 bg-cyan-500/15 px-2 py-0.5 rounded-full">
            {promos.length}
          </span>
        </div>

        {/* Scroll arrows (only on wider screens where cards overflow) */}
        <div className="hidden sm:flex items-center gap-1">
          <button
            onClick={() => scroll('left')}
            aria-label="Desplazar a la izquierda"
            className="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
          </button>
          <button
            onClick={() => scroll('right')}
            aria-label="Desplazar a la derecha"
            className="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scrollable cards */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4 snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {promos.map((promo) => {
          const isCopied = copiedId === promo.id;

          return (
            <motion.div
              key={promo.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: 0.05 }}
              className="snap-start flex-shrink-0 w-[260px] rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-white/[0.06] to-white/[0.02] backdrop-blur-xl overflow-hidden"
            >
              {/* Accent bar */}
              <div className="h-1 bg-gradient-to-r from-cyan-500 to-blue-500" />

              <div className="p-4">
                {/* Top row: badge + discount */}
                <div className="flex items-start justify-between mb-2">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-cyan-300 bg-cyan-500/15 px-2.5 py-1 rounded-lg border border-cyan-500/20">
                    <Tag className="w-3 h-3" />
                    {promo.code}
                  </span>
                  <span className="text-lg font-extrabold text-white leading-none">
                    {promo.discount_type === 'percentage' ? (
                      `${promo.discount_value}%`
                    ) : (
                      <span className="text-base">{formatCRC(promo.discount_value)}</span>
                    )}
                  </span>
                </div>

                {/* Description */}
                <p className="text-xs text-gray-300 leading-relaxed mb-3 line-clamp-2">
                  {promo.description}
                </p>

                {/* Meta info row */}
                <div className="flex items-center gap-3 text-[10px] text-gray-500 mb-3">
                  <span>Vence: {formatValidity(promo.valid_from, promo.valid_until)}</span>
                  {promo.min_ride_amount != null && promo.min_ride_amount > 0 && (
                    <>
                      <span className="text-gray-700">|</span>
                      <span>Min. {formatCRC(promo.min_ride_amount)}</span>
                    </>
                  )}
                  {promo.max_discount != null && promo.max_discount > 0 && promo.discount_type === 'percentage' && (
                    <>
                      <span className="text-gray-700">|</span>
                      <span>Max. {formatCRC(promo.max_discount)}</span>
                    </>
                  )}
                </div>

                {/* Copy button */}
                <button
                  onClick={() => handleCopy(promo)}
                  disabled={isCopied}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                    isCopied
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/25 hover:bg-cyan-500/25 active:scale-[0.97]'
                  }`}
                >
                  {isCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copiar
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
