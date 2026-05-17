'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Car, Crown, Truck, Bike, Zap, Clock, Navigation, Tag } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */

export interface FareOption {
  type: string;
  name: string;
  price: number;
  duration: number;   // minutes
  eta: number;        // minutes to pickup
  icon: string;       // key for icon mapping
}

interface FareCompareProps {
  originLat: number | null;
  originLng: number | null;
  destLat: number | null;
  destLng: number | null;
  selectedType: string;
  onSelect: (type: string) => void;
}

/* ═══════════════════════════════════════════════════════════════
   RIDE TYPE CONFIG
   ═══════════════════════════════════════════════════════════════ */

const RIDE_TYPES: Record<string, {
  label: string;
  icon: React.ElementType;
  gradient: string;
  color: string;
  multiplier: number;
  capacityLabel: string;
}> = {
  economico: {
    label: 'Economico',
    icon: Car,
    gradient: 'from-emerald-500 to-green-400',
    color: 'text-emerald-400',
    multiplier: 1.0,
    capacityLabel: '4 pasajeros',
  },
  premium: {
    label: 'Premium',
    icon: Crown,
    gradient: 'from-purple-500 to-violet-400',
    color: 'text-purple-400',
    multiplier: 2.0,
    capacityLabel: '4 pasajeros',
  },
  suv: {
    label: 'SUV',
    icon: Truck,
    gradient: 'from-amber-500 to-orange-400',
    color: 'text-amber-400',
    multiplier: 2.5,
    capacityLabel: '6 pasajeros',
  },
  moto: {
    label: 'Moto',
    icon: Bike,
    gradient: 'from-cyan-500 to-teal-400',
    color: 'text-cyan-400',
    multiplier: 0.6,
    capacityLabel: '1 pasajero',
  },
  moto_express: {
    label: 'Moto Express',
    icon: Zap,
    gradient: 'from-yellow-500 to-amber-400',
    color: 'text-yellow-400',
    multiplier: 0.5,
    capacityLabel: 'Paquetes',
  },
};

const RIDE_TYPE_KEYS = Object.keys(RIDE_TYPES);

/* ═══════════════════════════════════════════════════════════════
   FORMAT HELPERS
   ═══════════════════════════════════════════════════════════════ */

function formatCRC(amount: number): string {
  return `₡${Math.round(amount).toLocaleString('es-CR')}`;
}

function formatDuration(mins: number): string {
  if (mins < 1) return '<1 min';
  if (mins < 60) return `${Math.round(mins)} min`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/* ═══════════════════════════════════════════════════════════════
   SKELETON CARD
   ═══════════════════════════════════════════════════════════════ */

function SkeletonCard() {
  return (
    <div className="flex-shrink-0 w-[160px] sm:w-[180px] p-4 rounded-2xl glass-strong">
      <Skeleton className="w-10 h-10 rounded-xl mb-3 bg-white/10" />
      <Skeleton className="h-4 w-20 mb-1.5 bg-white/10" />
      <Skeleton className="h-6 w-24 mb-2 bg-white/10" />
      <Skeleton className="h-3 w-16 mb-1 bg-white/8" />
      <Skeleton className="h-3 w-14 bg-white/8" />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export default function FareCompare({
  originLat,
  originLng,
  destLat,
  destLng,
  selectedType,
  onSelect,
}: FareCompareProps) {
  const [fares, setFares] = useState<FareOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  /* ── Fetch fares ─────────────────────────────────────────── */
  const fetchFares = useCallback(async () => {
    if (!originLat || !originLng || !destLat || !destLng) {
      setFares([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        originLat: String(originLat),
        originLng: String(originLng),
        destLat: String(destLat),
        destLng: String(destLng),
      });

      const res = await fetch(`/api/rides/compare-fare?${params}`);
      if (!res.ok) {
        throw new Error('Error al obtener tarifas');
      }
      const data = await res.json();

      if (data.fares && Array.isArray(data.fares) && data.fares.length > 0) {
        setFares(data.fares);
      } else {
        // Fallback: generate estimated fares locally
        generateFallbackFares();
      }
    } catch {
      // On API failure, generate local estimates so UI is never empty
      generateFallbackFares();
    } finally {
      setIsLoading(false);
    }
  }, [originLat, originLng, destLat, destLng]);

  /* ── Fallback: calculate local estimates ─────────────────── */
  const generateFallbackFares = useCallback(() => {
    if (!originLat || !originLng || !destLat || !destLng) {
      setFares([]);
      return;
    }

    // Haversine distance
    const R = 6371;
    const dLat = ((destLat - originLat) * Math.PI) / 180;
    const dLng = ((destLng - originLng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((originLat * Math.PI) / 180) *
        Math.cos((destLat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const basePrice = 800 + distance * 650; // ~₡800 base + ₡650/km
    const baseDuration = distance * 3.2; // ~3.2 min/km in CR traffic
    const baseEta = 3 + Math.random() * 5;

    const fallbackFares: FareOption[] = RIDE_TYPE_KEYS.map((key) => {
      const config = RIDE_TYPES[key];
      return {
        type: key,
        name: config.label,
        price: Math.round(basePrice * config.multiplier),
        duration: key === 'moto' || key === 'moto_express'
          ? baseDuration * 0.6
          : baseDuration,
        eta: key === 'moto' || key === 'moto_express'
          ? baseEta * 0.7
          : baseEta,
        icon: key,
      };
    });

    setFares(fallbackFares);
  }, [originLat, originLng, destLat, destLng]);

  /* ── Debounced fetch on coord change ─────────────────────── */
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!originLat || !originLng || !destLat || !destLng) {
      setFares([]);
      return;
    }

    setIsLoading(true);
    debounceRef.current = setTimeout(() => {
      fetchFares();
    }, 800);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [originLat, originLng, destLat, destLng, fetchFares]);

  /* ── Determine cheapest fare ─────────────────────────────── */
  const cheapestType = fares.length > 0
    ? fares.reduce((min, f) => (f.price < min.price ? f : min), fares[0]).type
    : null;

  /* ── Empty state: no coords yet ─────────────────────────── */
  const hasCoords = originLat !== null && originLng !== null && destLat !== null && destLng !== null;

  /* ═══════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════ */
  return (
    <section className="w-full" aria-label="Comparar tarifas">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <Tag className="w-4 h-4 text-cyan-400" />
        <h3 className="text-sm font-semibold text-white">
          Comparar tarifas
        </h3>
        {fares.length > 0 && (
          <span className="text-[10px] text-gray-500 ml-auto">
            {fares.length} opciones
          </span>
        )}
      </div>

      {/* ── Horizontal scrollable card row ────────────────── */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* Loading skeletons */}
        {isLoading && (
          <AnimatePresence mode="wait">
            {RIDE_TYPE_KEYS.map((key) => (
              <motion.div
                key={`skeleton-${key}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ delay: RIDE_TYPE_KEYS.indexOf(key) * 0.05 }}
              >
                <SkeletonCard />
              </motion.div>
            ))}
          </AnimatePresence>
        )}

        {/* Fare cards */}
        {!isLoading && fares.length > 0 &&
          fares.map((fare, idx) => {
            const config = RIDE_TYPES[fare.type];
            if (!config) return null;
            const Icon = config.icon;
            const isSelected = selectedType === fare.type;
            const isCheapest = fare.type === cheapestType;

            return (
              <motion.button
                key={fare.type}
                type="button"
                onClick={() => onSelect(fare.type)}
                initial={{ opacity: 0, y: 16, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                  delay: idx * 0.06,
                  type: 'spring',
                  stiffness: 300,
                  damping: 24,
                }}
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.97 }}
                className={`
                  relative flex-shrink-0 w-[160px] sm:w-[180px] p-4 rounded-2xl
                  transition-all cursor-pointer text-left snap-start
                  ${isSelected
                    ? 'glass-strong border-2 border-cyan-500/60 glow-cyan'
                    : isCheapest
                      ? 'glass-strong border-2 border-emerald-500/50'
                      : 'glass-strong border border-white/10 hover:border-white/20'
                  }
                `}
                aria-pressed={isSelected}
                aria-label={`${config.label}: ${formatCRC(fare.price)}`}
              >
                {/* Cheapest badge */}
                {isCheapest && !isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-emerald-500/90 text-[9px] font-bold text-white shadow-lg shadow-emerald-500/30"
                  >
                    Mas economico
                  </motion.div>
                )}

                {/* Selected badge */}
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-cyan-500 flex items-center justify-center shadow-lg shadow-cyan-500/40"
                  >
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </motion.div>
                )}

                {/* Icon */}
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center mb-3 ${
                    isSelected
                      ? `bg-gradient-to-br ${config.gradient} shadow-lg`
                      : isCheapest
                        ? `bg-gradient-to-br ${config.gradient} opacity-70`
                        : 'bg-white/10'
                  }`}
                >
                  <Icon className={`w-5 h-5 text-white ${isSelected ? '' : 'opacity-80'}`} />
                </div>

                {/* Ride type name */}
                <p className={`text-xs font-bold mb-1 ${
                  isSelected ? 'text-white' : 'text-gray-300'
                }`}>
                  {config.label}
                </p>

                {/* Capacity */}
                <p className="text-[10px] text-gray-500 mb-2">
                  {config.capacityLabel}
                </p>

                {/* Price */}
                <p className={`text-lg font-extrabold mb-2 ${
                  isSelected ? 'text-cyan-400 glow-text' : isCheapest ? 'text-emerald-400' : 'text-white'
                }`}>
                  {formatCRC(fare.price)}
                </p>

                {/* Duration & ETA */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-gray-500" />
                    <span className="text-[10px] text-gray-400">
                      {formatDuration(fare.duration)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Navigation className="w-3 h-3 text-gray-500" />
                    <span className="text-[10px] text-gray-400">
                      {formatDuration(fare.eta)}
                    </span>
                  </div>
                </div>
              </motion.button>
            );
          })
        }

        {/* Empty state: no coordinates */}
        {!isLoading && !hasCoords && (
          <div className="flex-1 flex items-center justify-center py-6 min-w-full">
            <div className="text-center">
              <Navigation className="w-8 h-8 text-gray-600 mx-auto mb-2" />
              <p className="text-xs text-gray-500">
                Ingresa origen y destino para ver tarifas
              </p>
            </div>
          </div>
        )}

        {/* Error state with fallback */}
        {!isLoading && error && fares.length === 0 && hasCoords && (
          <div className="flex-1 flex items-center justify-center py-6 min-w-full">
            <div className="text-center">
              <p className="text-xs text-gray-500">
                {error}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Scroll indicators (desktop) ────────────────────── */}
      {fares.length > 0 && (
        <div className="hidden sm:flex items-center justify-center gap-1.5 mt-3">
          {RIDE_TYPE_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              className={`w-2 h-2 rounded-full transition-all ${
                selectedType === key
                  ? 'bg-cyan-400 w-5'
                  : 'bg-white/20 hover:bg-white/40'
              }`}
              aria-label={`Seleccionar ${RIDE_TYPES[key]?.label}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
