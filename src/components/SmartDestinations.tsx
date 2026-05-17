'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  Heart,
  Star,
  Briefcase,
  Home,
  MapPin,
  BookmarkPlus,
  X,
  Loader2,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DestinationItem {
  id: string;
  address: string;
  lat: number;
  lng: number;
  destination_type: 'recent' | 'favorite' | 'work' | 'home';
  label?: string;
  typical_price?: number; // ₡ CRC
}

interface SmartDestinationsProps {
  session: { access_token: string } | null;
  currentLat?: number;
  currentLng?: number;
  onSelect: (address: string, lat: number, lng: number, type: string) => void;
  targetField: 'origin' | 'destination';
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const MAX_ADDRESS = 30;
const truncate = (s: string, max = MAX_ADDRESS) =>
  s.length > max ? s.slice(0, max).trimEnd() + '…' : s;

const formatCRC = (amount: number) =>
  `₡${amount.toLocaleString('es-CR')}`;

/* ------------------------------------------------------------------ */
/*  Style map per destination type                                      */
/* ------------------------------------------------------------------ */

const TYPE_CONFIG: Record<
  DestinationItem['destination_type'],
  {
    icon: React.ElementType;
    bg: string;
    iconColor: string;
    ring: string;
    badge: string;
    label: string;
  }
> = {
  recent: {
    icon: Clock,
    bg: 'bg-zinc-800/70',
    iconColor: 'text-zinc-400',
    ring: 'ring-zinc-700/50',
    badge: 'bg-zinc-700/60 text-zinc-300',
    label: 'Reciente',
  },
  favorite: {
    icon: Heart,
    bg: 'bg-purple-500/10',
    iconColor: 'text-purple-400',
    ring: 'ring-purple-500/20',
    badge: 'bg-purple-500/15 text-purple-300',
    label: 'Favorito',
  },
  work: {
    icon: Briefcase,
    bg: 'bg-amber-500/10',
    iconColor: 'text-amber-400',
    ring: 'ring-amber-500/20',
    badge: 'bg-amber-500/15 text-amber-300',
    label: 'Trabajo',
  },
  home: {
    icon: Home,
    bg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-400',
    ring: 'ring-emerald-500/20',
    badge: 'bg-emerald-500/15 text-emerald-300',
    label: 'Casa',
  },
};

/* ------------------------------------------------------------------ */
/*  Framer variants                                                    */
/* ------------------------------------------------------------------ */

const rowVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 400, damping: 26 },
  },
};

const modalOverlay = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const modalPanel = {
  hidden: { y: '100%', opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: 'spring', stiffness: 300, damping: 30 },
  },
  exit: { y: '100%', opacity: 0 },
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function SmartDestinations({
  session,
  currentLat,
  currentLng,
  onSelect,
  targetField,
}: SmartDestinationsProps) {
  const [destinations, setDestinations] = useState<DestinationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [labelInput, setLabelInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* -------------------------------------------------------------- */
  /*  Fetch favorites on mount                                        */
  /* -------------------------------------------------------------- */
  const fetchDestinations = useCallback(async () => {
    if (!session?.access_token) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/routes/favorites', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setDestinations(Array.isArray(data) ? data : data.destinations ?? []);
      }
    } catch {
      // silently fail — user still sees empty state
    } finally {
      setIsLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    fetchDestinations();
  }, [fetchDestinations]);

  /* -------------------------------------------------------------- */
  /*  Auto‑focus label input when modal opens                         */
  /* -------------------------------------------------------------- */
  useEffect(() => {
    if (showSaveModal) {
      setTimeout(() => inputRef.current?.focus(), 350);
    }
  }, [showSaveModal]);

  /* -------------------------------------------------------------- */
  /*  Save favorite                                                   */
  /* -------------------------------------------------------------- */
  const handleSaveFavorite = async () => {
    if (!session?.access_token || !currentLat || !currentLng) return;

    setIsSaving(true);
    try {
      const res = await fetch('/api/routes/favorites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          label: labelInput.trim() || undefined,
          destination_type: 'favorite',
          dest_lat: currentLat,
          dest_lng: currentLng,
          origin_lat: currentLat, // fallback: user's current pos as origin
          origin_lng: currentLng,
        }),
      });

      if (res.ok) {
        // Re-fetch the list to include the new favorite
        await fetchDestinations();
        setShowSaveModal(false);
        setLabelInput('');
      }
    } catch {
      // silent fail
    } finally {
      setIsSaving(false);
    }
  };

  /* -------------------------------------------------------------- */
  /*  Reset modal state                                               */
  /* -------------------------------------------------------------- */
  const closeSaveModal = () => {
    setShowSaveModal(false);
    setLabelInput('');
  };

  /* -------------------------------------------------------------- */
  /*  Render: loading skeletons                                       */
  /* -------------------------------------------------------------- */
  const renderSkeletons = () =>
    Array.from({ length: 4 }).map((_, i) => (
      <div
        key={`skel-${i}`}
        className="shrink-0 w-[152px] h-[100px] rounded-2xl bg-zinc-800/60 animate-pulse"
      />
    ));

  /* -------------------------------------------------------------- */
  /*  Render: empty state                                             */
  /* -------------------------------------------------------------- */
  const renderEmpty = () => (
    <div className="w-full flex items-center gap-3 py-4 px-1">
      <div className="flex items-center gap-2 text-zinc-500 text-sm">
        <Sparkles className="w-4 h-4" />
        <span>Tus destinos aparecerán aquí</span>
      </div>
    </div>
  );

  /* -------------------------------------------------------------- */
  /*  Render: destination card                                        */
  /* -------------------------------------------------------------- */
  const renderCard = (dest: DestinationItem, index: number) => {
    const cfg = TYPE_CONFIG[dest.destination_type];
    const Icon = cfg.icon;
    const isFavorite = dest.destination_type === 'favorite';

    return (
      <motion.button
        key={dest.id}
        variants={cardVariants}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.97 }}
        onClick={() =>
          onSelect(dest.address, dest.lat, dest.lng, dest.destination_type)
        }
        className={`
          shrink-0 w-[152px] rounded-2xl p-3.5 text-left
          border border-white/[0.06] ring-1 ${cfg.ring}
          backdrop-blur-sm ${cfg.bg}
          transition-colors hover:border-white/[0.12] hover:bg-white/[0.06]
          cursor-pointer group flex flex-col justify-between gap-2
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50
        `}
        aria-label={`Seleccionar destino: ${dest.address}`}
      >
        {/* Top: icon + type badge */}
        <div className="flex items-center justify-between">
          <div
            className={`
              w-9 h-9 rounded-xl flex items-center justify-center
              ${cfg.badge}
            `}
          >
            <Icon className="w-4.5 h-4.5" />
          </div>
          {isFavorite && dest.label && (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-400/80">
              {dest.label}
            </span>
          )}
        </div>

        {/* Middle: address */}
        <p className="text-[13px] font-medium text-zinc-100 leading-snug line-clamp-2 min-h-[2.25rem]">
          {truncate(dest.address)}
        </p>

        {/* Bottom: price or label */}
        <div className="flex items-center justify-between">
          {isFavorite && dest.typical_price != null ? (
            <span className="text-xs font-semibold text-purple-300">
              {formatCRC(dest.typical_price)}
            </span>
          ) : (
            <span className="text-[11px] text-zinc-500">{cfg.label}</span>
          )}
          <ChevronRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
        </div>
      </motion.button>
    );
  };

  /* -------------------------------------------------------------- */
  /*  Render: save‑favorite mini form modal                           */
  /* -------------------------------------------------------------- */
  const renderSaveModal = () => (
    <AnimatePresence>
      {showSaveModal && (
        <motion.div
          key="save-overlay"
          variants={modalOverlay}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end justify-center"
          onClick={closeSaveModal}
        >
          <motion.div
            key="save-panel"
            variants={modalPanel}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="
              w-full max-w-md rounded-t-3xl bg-zinc-900 border-t border-white/10
              p-5 space-y-4 shadow-2xl
            "
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-500/15 flex items-center justify-center">
                  <BookmarkPlus className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-100">
                    Guardar como favorito
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Etiqueta este destino para encontrarlo rápido
                  </p>
                </div>
              </div>
              <button
                onClick={closeSaveModal}
                className="p-2 rounded-xl hover:bg-white/10 transition-colors"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>

            {/* Preset quick‑pick chips */}
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'Casa', icon: Home },
                { value: 'Trabajo', icon: Briefcase },
                { value: 'Gym', icon: Star },
              ].map((preset) => {
                const PresetIcon = preset.icon;
                const active = labelInput.trim() === preset.value;
                return (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setLabelInput(preset.value)}
                    className={`
                      flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                      transition-colors border
                      ${
                        active
                          ? 'bg-purple-500/15 border-purple-500/40 text-purple-300'
                          : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10 hover:text-zinc-200'
                      }
                    `}
                  >
                    <PresetIcon className="w-3.5 h-3.5" />
                    {preset.value}
                  </button>
                );
              })}
            </div>

            {/* Label input */}
            <div>
              <label className="text-xs font-medium text-zinc-400 mb-1.5 block">
                Nombre (opcional)
              </label>
              <input
                ref={inputRef}
                type="text"
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                placeholder="Ej: Casa de mamá, Oficina central…"
                maxLength={50}
                className="
                  w-full bg-white/[0.06] border border-white/10 rounded-xl
                  px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600
                  focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20
                  transition-all
                "
              />
            </div>

            {/* Field indicator */}
            <div className="flex items-center gap-2 text-[11px] text-zinc-500">
              <MapPin className="w-3.5 h-3.5" />
              <span>
                Se guardará como{' '}
                <span className="font-medium text-zinc-300">
                  {targetField === 'origin' ? 'origen' : 'destino'}
                </span>
              </span>
              {currentLat != null && currentLng != null && (
                <>
                  <span className="text-zinc-700">•</span>
                  <span>
                    {currentLat.toFixed(4)}, {currentLng.toFixed(4)}
                  </span>
                </>
              )}
            </div>

            {/* Save button */}
            <button
              onClick={handleSaveFavorite}
              disabled={isSaving || !currentLat || !currentLng}
              className="
                w-full bg-gradient-to-r from-purple-600 to-purple-500
                hover:from-purple-500 hover:to-purple-400
                text-white font-semibold py-3 rounded-xl
                flex items-center justify-center gap-2
                text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed
                shadow-lg shadow-purple-500/20
              "
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Guardando…
                </>
              ) : (
                <>
                  <BookmarkPlus className="w-4 h-4" />
                  Guardar favorito
                </>
              )}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  /* -------------------------------------------------------------- */
  /*  Main render                                                     */
  /* -------------------------------------------------------------- */
  return (
    <section aria-label="Destinos inteligentes" className="w-full">
      {/* Section header */}
      <motion.div
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.35 }}
        className="flex items-center justify-between mb-3 px-1"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <h2 className="text-sm font-semibold text-zinc-300">
            Destinos rápidos
          </h2>
        </div>

        <button
          onClick={() => setShowSaveModal(true)}
          className="
            flex items-center gap-1.5 px-3 py-1.5 rounded-lg
            bg-purple-500/10 text-purple-400 text-xs font-medium
            hover:bg-purple-500/20 active:bg-purple-500/25
            transition-colors
          "
          aria-label="Guardar destino como favorito"
        >
          <BookmarkPlus className="w-3.5 h-3.5" />
          Guardar como favorito
        </button>
      </motion.div>

      {/* Scrollable row */}
      {isLoading ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide"
        >
          {renderSkeletons()}
        </motion.div>
      ) : destinations.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
        >
          {renderEmpty()}
        </motion.div>
      ) : (
        <motion.div
          ref={scrollRef}
          variants={rowVariants}
          initial="hidden"
          animate="visible"
          className="
            flex gap-3 overflow-x-auto pb-2
            scrollbar-hide
            [scrollbar-width:none] [&::-webkit-scrollbar]:hidden
          "
        >
          {destinations.map((dest, i) => renderCard(dest, i))}

          {/* Tail fade indicator */}
          <div
            aria-hidden
            className="
              shrink-0 w-8 pointer-events-none
              bg-gradient-to-r from-transparent to-zinc-950/80
              self-stretch rounded-r-lg
            "
          />
        </motion.div>
      )}

      {/* Save‑favorite modal */}
      {renderSaveModal()}
    </section>
  );
}
