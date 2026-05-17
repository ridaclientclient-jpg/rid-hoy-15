'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Snowflake, Thermometer, Sun,
  VolumeX, Volume1, Volume2,
  MicOff, Minus, Music, MusicOff, Headphones,
  MapPin, Phone,
  Bell, Tag, Wallet, Mail,
  Languages, Loader2, Check, Globe,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import {
  useClientPreferencesStore,
  type ClientPreferences,
  type TemperaturePreference,
  type ConversationLevel,
  type MusicPreference,
} from '@/store/clientPreferencesStore';

/* ─── Animation variants ──────────────────────────────────── */

const fadeInUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.06 } },
};

/* ─── Option chip config types ────────────────────────────── */

interface OptionConfig<V = string> {
  value: V;
  label: string;
  icon: typeof Snowflake;
}

const TEMPERATURE_OPTIONS: OptionConfig<TemperaturePreference>[] = [
  { value: 'cold', label: 'Frio', icon: Snowflake },
  { value: 'neutral', label: 'Neutral', icon: Thermometer },
  { value: 'warm', label: 'Calido', icon: Sun },
];

const CONVERSATION_OPTIONS: OptionConfig<ConversationLevel>[] = [
  { value: 'quiet', label: 'Silencio', icon: VolumeX },
  { value: 'neutral', label: 'Neutral', icon: Volume1 },
  { value: 'chatty', label: 'Conversador', icon: Volume2 },
];

const MUSIC_OPTIONS: OptionConfig<MusicPreference>[] = [
  { value: 'no_music', label: 'Sin musica', icon: VolumeX },
  { value: 'no_preference', label: 'Sin preferencia', icon: Minus },
  { value: 'soft_music', label: 'Musica suave', icon: Music },
  { value: 'my_music', label: 'Mi musica', icon: Headphones },
];

const LANGUAGE_OPTIONS: OptionConfig<string>[] = [
  { value: 'es', label: 'Espanol', icon: Globe },
  { value: 'en', label: 'English', icon: Globe },
];

/* ─── Reusable: Section heading ──────────────────────────── */

function SectionHeading({ icon: Icon, title }: { icon: typeof Snowflake; title: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <div className="w-8 h-8 rounded-lg bg-cyan-500/15 flex items-center justify-center">
        <Icon className="w-4 h-4 text-cyan-400" />
      </div>
      <h2 className="text-sm font-semibold text-white">{title}</h2>
    </div>
  );
}

/* ─── Reusable: Option chips row ─────────────────────────── */

function OptionChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: OptionConfig<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-2 flex-wrap">
      {options.map((opt) => {
        const isActive = value === opt.value;
        const OptIcon = opt.icon;
        return (
          <button
            type="button"
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 ${
              isActive
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                : 'bg-white/5 text-gray-400 border border-white/[0.06] hover:bg-white/[0.08] hover:text-gray-300'
            }`}
          >
            {OptIcon && <OptIcon className="w-3.5 h-3.5" />}
            {opt.label}
            {isActive && <Check className="w-3 h-3 ml-0.5" />}
          </button>
        );
      })}
    </div>
  );
}

/* ─── Reusable: Toggle row ───────────────────────────────── */

function ToggleRow({
  icon: Icon,
  label,
  description,
  checked,
  onToggle,
}: {
  icon: typeof Snowflake;
  label: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-3 group">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center shrink-0 group-hover:bg-white/[0.08] transition-colors">
          <Icon className="w-4 h-4 text-gray-400" />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-white truncate">{label}</p>
          <p className="text-[11px] text-gray-500 leading-tight">{description}</p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onToggle}
        className={`relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 ml-3 ${
          checked ? 'bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.3)]' : 'bg-white/10'
        }`}
      >
        <motion.span
          className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md"
          animate={{ x: checked ? 20 : 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      </button>
    </div>
  );
}

/* ─── Glass section wrapper ──────────────────────────────── */

function GlassSection({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      variants={fadeInUp}
      initial="initial"
      animate="animate"
      transition={{ delay }}
      className="glass rounded-2xl p-4 space-y-1"
    >
      {children}
    </motion.div>
  );
}

/* ═════════════════════════════════════════════════════════════
   MAIN PAGE
   ═════════════════════════════════════════════════════════════ */

export default function ClientPreferencesPage() {
  const { user } = useAuthStore();
  const { preferences, isLoading, fetchPreferences, updatePreference } =
    useClientPreferencesStore();

  /* ── Load preferences on mount ── */
  useEffect(() => {
    if (user?.id) {
      fetchPreferences(user.id);
    }
  }, [user?.id, fetchPreferences]);

  /* ── Helper: update a single pref ── */
  const handleUpdate = (key: keyof ClientPreferences, value: ClientPreferences[keyof ClientPreferences]) => {
    if (user?.id && preferences) {
      updatePreference(user.id, key, value);
    }
  };

  /* ── Loading state ── */
  if (isLoading && !preferences) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          <span className="text-xs text-gray-500">Cargando preferencias...</span>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      variants={stagger}
      initial="initial"
      animate="animate"
      className="p-4 space-y-4"
    >
      {/* ── Header ── */}
      <motion.div variants={fadeInUp} className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center">
          <Languages className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Preferencias</h1>
          <p className="text-xs text-gray-500">Personaliza tu experiencia de viaje</p>
        </div>
      </motion.div>

      {/* ──────────────── VIAJE ──────────────── */}
      <GlassSection delay={0.05}>
        <SectionHeading icon={Snowflake} title="Viaje" />

        {/* Temperature */}
        <div className="mb-4">
          <p className="text-xs text-gray-400 mb-2">Temperatura del auto</p>
          <OptionChips
            options={TEMPERATURE_OPTIONS}
            value={preferences?.temperature_preference ?? 'neutral'}
            onChange={(v) => handleUpdate('temperature_preference', v)}
          />
        </div>

        {/* Conversation level */}
        <div className="mb-4">
          <p className="text-xs text-gray-400 mb-2">Nivel de conversacion</p>
          <OptionChips
            options={CONVERSATION_OPTIONS}
            value={preferences?.conversation_level ?? 'neutral'}
            onChange={(v) => handleUpdate('conversation_level', v)}
          />
        </div>

        {/* Music preference */}
        <div>
          <p className="text-xs text-gray-400 mb-2">Musica</p>
          <OptionChips
            options={MUSIC_OPTIONS}
            value={preferences?.music_preference ?? 'no_preference'}
            onChange={(v) => handleUpdate('music_preference', v)}
          />
        </div>
      </GlassSection>

      {/* ──────────────── PRIVACIDAD ──────────────── */}
      <GlassSection delay={0.12}>
        <SectionHeading icon={MapPin} title="Privacidad" />
        <div className="divide-y divide-white/5">
          <ToggleRow
            icon={MapPin}
            label="Compartir ubicacion en vivo"
            description="El conductor ve tu ubicacion durante el viaje"
            checked={preferences?.share_live_location ?? false}
            onToggle={() => handleUpdate('share_live_location', !preferences?.share_live_location)}
          />
          <ToggleRow
            icon={Phone}
            label="Mostrar telefono al conductor"
            description="Tu numero sera visible para el conductor asignado"
            checked={preferences?.show_phone_to_driver ?? false}
            onToggle={() => handleUpdate('show_phone_to_driver', !preferences?.show_phone_to_driver)}
          />
        </div>
      </GlassSection>

      {/* ──────────────── NOTIFICACIONES ──────────────── */}
      <GlassSection delay={0.19}>
        <SectionHeading icon={Bell} title="Notificaciones" />
        <div className="divide-y divide-white/5">
          <ToggleRow
            icon={Bell}
            label="Actualizaciones de viaje"
            description="Estado del viaje, asignacion y llegadas"
            checked={preferences?.push_ride_updates ?? true}
            onToggle={() => handleUpdate('push_ride_updates', !preferences?.push_ride_updates)}
          />
          <ToggleRow
            icon={Tag}
            label="Promociones y ofertas"
            description="Descuentos, cupones y novedades"
            checked={preferences?.push_promotions ?? true}
            onToggle={() => handleUpdate('push_promotions', !preferences?.push_promotions)}
          />
          <ToggleRow
            icon={Wallet}
            label="Pagos"
            description="Confirmaciones y reembolsos"
            checked={preferences?.push_payment ?? true}
            onToggle={() => handleUpdate('push_payment', !preferences?.push_payment)}
          />
          <ToggleRow
            icon={Mail}
            label="Recibos por email"
            description="Enviar comprobante de pago a tu correo"
            checked={preferences?.email_receipts ?? true}
            onToggle={() => handleUpdate('email_receipts', !preferences?.email_receipts)}
          />
        </div>
      </GlassSection>

      {/* ──────────────── IDIOMA ──────────────── */}
      <GlassSection delay={0.26}>
        <SectionHeading icon={Languages} title="Idioma" />
        <OptionChips
          options={LANGUAGE_OPTIONS}
          value={preferences?.language ?? 'es'}
          onChange={(v) => handleUpdate('language', v)}
        />
      </GlassSection>

      {/* ── Bottom spacing ── */}
      <div className="h-4" />
    </motion.div>
  );
}
