'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Phone, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';

// ─── Types ──────────────────────────────────────────────────────
interface TripInsuranceBannerProps {
  rideId: string;
}

interface InsuranceSettings {
  provider: string;
  phone: string;
  coverage: string;
  link: string;
}

// ─── Defaults ───────────────────────────────────────────────────
const DEFAULTS: InsuranceSettings = {
  provider: 'INS Seguros Costa Rica',
  phone: '800-800-8000',
  coverage:
    'Cobertura de accidentes personales hasta ₡10,000,000',
  link: '',
};

const SETTINGS_KEYS: Record<keyof InsuranceSettings, string> = {
  provider: 'insurance_provider',
  phone: 'insurance_phone',
  coverage: 'insurance_coverage',
  link: 'insurance_link',
};

// ─── Component ──────────────────────────────────────────────────
export default function TripInsuranceBanner({ rideId }: TripInsuranceBannerProps) {
  const [expanded, setExpanded] = useState(false);
  const [settings, setSettings] = useState<InsuranceSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  // Fetch insurance settings from the settings table
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const keys = Object.values(SETTINGS_KEYS);

        const { data, error } = await supabase
          .from('settings')
          .select('key, value')
          .in('key', keys);

        if (error) {
          console.error('[TripInsuranceBanner] Supabase error:', error);
          return;
        }

        // Map the returned rows into our settings object
        const map = new Map<string, string>();
        (data ?? []).forEach((row) => {
          map.set(row.key, row.value);
        });

        setSettings({
          provider: map.get(SETTINGS_KEYS.provider) ?? DEFAULTS.provider,
          phone: map.get(SETTINGS_KEYS.phone) ?? DEFAULTS.phone,
          coverage: map.get(SETTINGS_KEYS.coverage) ?? DEFAULTS.coverage,
          link: map.get(SETTINGS_KEYS.link) ?? DEFAULTS.link,
        });
      } catch (err) {
        console.error('[TripInsuranceBanner] Fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [rideId]);

  // ─── Handlers ─────────────────────────────────────────────────
  const handleCall = () => {
    // Strip any non-digit characters (keeps leading + if present)
    const digits = settings.phone.replace(/[^\d+]/g, '');
    window.open(`tel:${digits}`, '_self');
  };

  const handleToggle = () => {
    setExpanded((prev) => !prev);
  };

  // ─── Loading skeleton ────────────────────────────────────────
  if (loading) {
    return (
      <div className="w-full rounded-2xl border border-white/[0.06] bg-white/[0.04] backdrop-blur-xl p-4 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/10" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-40 rounded bg-white/10" />
            <div className="h-2.5 w-56 rounded bg-white/5" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="w-full rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-white/[0.07] to-white/[0.02] backdrop-blur-xl overflow-hidden"
    >
      {/* ── Accent bar ─────────────────────────────────────────── */}
      <div className="h-1 bg-gradient-to-r from-emerald-500 to-green-500" />

      <div className="p-3.5">
        {/* ── Collapsed summary row (always visible) ──────────── */}
        <button
          type="button"
          onClick={handleToggle}
          aria-expanded={expanded}
          aria-label={expanded ? 'Ocultar detalles del seguro' : 'Mostrar detalles del seguro'}
          className="w-full flex items-center gap-3 text-left"
        >
          {/* Shield icon */}
          <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
            <Shield className="w-4.5 h-4.5 text-emerald-400" />
          </div>

          {/* Text content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-emerald-400 tracking-wide uppercase">
                Seguro del viaje
              </span>
              <span className="text-[10px] font-medium text-emerald-300/60 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                Activo
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5 truncate">
              {settings.provider}
            </p>
          </div>

          {/* Chevron */}
          <div className="flex-shrink-0 w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
            {expanded ? (
              <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            )}
          </div>
        </button>

        {/* ── Expanded details ─────────────────────────────────── */}
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              key="details"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="pt-3 mt-3 border-t border-white/[0.06] space-y-3">
                {/* Provider name */}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-0.5">
                    Aseguradora
                  </p>
                  <p className="text-sm font-semibold text-white">
                    {settings.provider}
                  </p>
                </div>

                {/* Coverage text */}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-0.5">
                    Cobertura
                  </p>
                  <p className="text-xs text-gray-300 leading-relaxed">
                    {settings.coverage}
                  </p>
                </div>

                {/* Ride ID reference */}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-0.5">
                    Viaje
                  </p>
                  <p className="text-xs text-gray-400 font-mono tracking-tight">
                    #{rideId.slice(0, 8)}
                  </p>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 pt-1">
                  {/* Call button */}
                  <button
                    type="button"
                    onClick={handleCall}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 hover:bg-emerald-500/25 active:scale-[0.97] transition-all duration-200"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    Llamar {settings.phone}
                  </button>

                  {/* Policy link button (only render if link exists) */}
                  {settings.link && (
                    <a
                      href={settings.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 active:scale-[0.97] transition-all duration-200"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Poliza
                    </a>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
