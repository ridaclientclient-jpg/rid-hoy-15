'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Snowflake,
  Thermometer,
  Flame,
  Volume2,
  VolumeX,
  MessageCircle,
  MessageSquare,
  MessageCircleMore,
  Dog,
  Cigarette,
  ChevronDown,
  ChevronUp,
  Settings,
  Music,
  Save,
  Loader2,
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RiderSession {
  access_token: string
}

export interface RiderPreferencesData {
  temperatura: 'frio' | 'normal' | 'caliente'
  musica: string
  nivelConversacion: 'silencio' | 'soloNecesario' | 'normal' | 'charlatan'
  mascotas: boolean
  fumar: boolean
}

interface RiderPreferencesProps {
  session: RiderSession | null
  collapsed?: boolean
  onToggle?: () => void
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TEMPERATURA_OPTIONS = [
  { value: 'frio' as const, label: 'Frío', icon: Snowflake, color: 'from-blue-400 to-cyan-400' },
  { value: 'normal' as const, label: 'Normal', icon: Thermometer, color: 'from-emerald-400 to-teal-400' },
  { value: 'caliente' as const, label: 'Caliente', icon: Flame, color: 'from-orange-400 to-red-400' },
]

const MUSICA_OPTIONS = [
  { value: 'ninguna', label: 'Ninguna', emoji: '🔇' },
  { value: 'relajante', label: 'Relajante', emoji: '🧘' },
  { value: 'pop', label: 'Pop', emoji: '🎤' },
  { value: 'rock', label: 'Rock', emoji: '🎸' },
  { value: 'reggaeton', label: 'Reggaetón', emoji: '🎶' },
  { value: 'cualquiera', label: 'Cualquiera', emoji: '🎲' },
]

const CONVERSACION_OPTIONS = [
  {
    value: 'silencio' as const,
    label: 'Silencio',
    description: 'Prefiero no hablar',
    icon: VolumeX,
  },
  {
    value: 'soloNecesario' as const,
    label: 'Solo si necesario',
    description: 'Direcciones únicamente',
    icon: MessageSquare,
  },
  {
    value: 'normal' as const,
    label: 'Conversación normal',
    description: 'Charla casual',
    icon: MessageCircle,
  },
  {
    value: 'charlatan' as const,
    label: 'Soy charlatán',
    description: '¡Me encanta platicar!',
    icon: MessageCircleMore,
  },
]

const DEFAULT_PREFERENCES: RiderPreferencesData = {
  temperatura: 'normal',
  musica: 'cualquiera',
  nivelConversacion: 'normal',
  mascotas: false,
  fumar: false,
}

const DEBOUNCE_MS = 800

// ─── Helper: API Calls ───────────────────────────────────────────────────────

function getHeaders(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Temperature selector – 3 toggle buttons */
function TemperaturaSelector({
  value,
  onChange,
}: {
  value: RiderPreferencesData['temperatura']
  onChange: (v: RiderPreferencesData['temperatura']) => void
}) {
  return (
    <div className="flex gap-2">
      {TEMPERATURA_OPTIONS.map((opt) => {
        const Icon = opt.icon
        const isSelected = value === opt.value
        return (
          <motion.button
            key={opt.value}
            whileTap={{ scale: 0.95 }}
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex flex-1 flex-col items-center gap-1.5 rounded-xl px-3 py-3 text-xs font-medium transition-all duration-200',
              isSelected
                ? 'glass-strong border border-white/20 text-white shadow-lg'
                : 'glass border border-white/5 text-white/50 hover:text-white/80 hover:border-white/10'
            )}
          >
            <div
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-300',
                isSelected
                  ? `bg-gradient-to-br ${opt.color} shadow-md`
                  : 'bg-white/5'
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            {opt.label}
          </motion.button>
        )
      })}
    </div>
  )
}

/** Music selector – horizontal scroll chips */
function MusicaSelector({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <ScrollArea className="w-full whitespace-nowrap">
      <div className="flex gap-2 pb-2">
        {MUSICA_OPTIONS.map((opt) => {
          const isSelected = value === opt.value
          return (
            <motion.button
              key={opt.value}
              whileTap={{ scale: 0.93 }}
              onClick={() => onChange(opt.value)}
              className={cn(
                'inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200',
                isSelected
                  ? 'glass-strong border border-white/20 text-white shadow-md'
                  : 'glass border border-white/5 text-white/50 hover:text-white/80 hover:border-white/10'
              )}
            >
              <span className="text-base leading-none">{opt.emoji}</span>
              {opt.label}
            </motion.button>
          )
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  )
}

/** Conversation level – 4 options with icons */
function ConversacionSelector({
  value,
  onChange,
}: {
  value: RiderPreferencesData['nivelConversacion']
  onChange: (v: RiderPreferencesData['nivelConversacion']) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {CONVERSACION_OPTIONS.map((opt) => {
        const Icon = opt.icon
        const isSelected = value === opt.value
        return (
          <motion.button
            key={opt.value}
            whileTap={{ scale: 0.95 }}
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex items-start gap-3 rounded-xl px-3 py-3 text-left transition-all duration-200',
              isSelected
                ? 'glass-strong border border-white/20 text-white shadow-lg'
                : 'glass border border-white/5 text-white/50 hover:text-white/80 hover:border-white/10'
            )}
          >
            <div
              className={cn(
                'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-300',
                isSelected
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-white/5 text-white/40'
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold leading-tight">{opt.label}</p>
              <p
                className={cn(
                  'mt-0.5 text-[11px] leading-tight',
                  isSelected ? 'text-white/60' : 'text-white/30'
                )}
              >
                {opt.description}
              </p>
            </div>
          </motion.button>
        )
      })}
    </div>
  )
}

/** Toggle row with label + Switch */
function ToggleRow({
  icon: Icon,
  label,
  checked,
  onChange,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between rounded-xl glass border border-white/5 px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-white/50">
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-sm font-medium text-white/80">{label}</span>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        className="data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-white/10 border-white/10"
      />
    </div>
  )
}

/** Section header */
function SectionHeader({
  icon: Icon,
  title,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
}) {
  return (
    <div className="mb-2.5 flex items-center gap-2">
      <Icon className="h-4 w-4 text-white/40" />
      <h4 className="text-xs font-semibold uppercase tracking-wider text-white/40">
        {title}
      </h4>
    </div>
  )
}

// ─── Save Indicator ──────────────────────────────────────────────────────────

function SaveIndicator({ saving }: { saving: boolean }) {
  return (
    <AnimatePresence mode="wait">
      {saving ? (
        <motion.div
          key="saving"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          className="flex items-center gap-1.5 text-[11px] text-white/40"
        >
          <Loader2 className="h-3 w-3 animate-spin" />
          Guardando...
        </motion.div>
      ) : (
        <motion.div
          key="saved"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          className="flex items-center gap-1.5 text-[11px] text-emerald-400/70"
        >
          <Save className="h-3 w-3" />
          Guardado
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function RiderPreferences({
  session,
  collapsed: collapsedProp = true,
  onToggle,
}: RiderPreferencesProps) {
  const [isCollapsed, setIsCollapsed] = useState(collapsedProp)
  const [preferences, setPreferences] = useState<RiderPreferencesData>(DEFAULT_PREFERENCES)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync collapsed state with prop
  useEffect(() => {
    setIsCollapsed(collapsedProp)
  }, [collapsedProp])

  // ─── Fetch preferences on mount ─────────────────────────────────────────
  useEffect(() => {
    if (!session?.access_token) {
      setLoading(false)
      return
    }

    let cancelled = false

    async function fetchPreferences() {
      try {
        const res = await fetch('/api/preferences', {
          headers: getHeaders(session.access_token),
        })
        if (res.ok && !cancelled) {
          const data = await res.json()
          setPreferences((prev) => ({
            ...prev,
            ...data,
          }))
        }
      } catch {
        // Silently fail – use defaults
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchPreferences()
    return () => {
      cancelled = true
    }
  }, [session?.access_token])

  // ─── Save with debounce ─────────────────────────────────────────────────
  const savePreferences = useCallback(
    (data: RiderPreferencesData) => {
      if (!session?.access_token) return

      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }

      setSaving(true)
      debounceRef.current = setTimeout(async () => {
        try {
          await fetch('/api/preferences', {
            method: 'PUT',
            headers: getHeaders(session.access_token),
            body: JSON.stringify(data),
          })
        } catch {
          // Silently fail
        } finally {
          setSaving(false)
        }
      }, DEBOUNCE_MS)
    },
    [session?.access_token]
  )

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  // ─── Handlers ───────────────────────────────────────────────────────────
  const updatePreference = <K extends keyof RiderPreferencesData>(
    key: K,
    value: RiderPreferencesData[K]
  ) => {
    setPreferences((prev) => {
      const next = { ...prev, [key]: value }
      savePreferences(next)
      return next
    })
  }

  const handleToggle = () => {
    setIsCollapsed((prev) => !prev)
    onToggle?.()
  }

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <motion.div
      layout
      className="w-full overflow-hidden rounded-2xl glass-strong border border-white/10"
    >
      {/* Header – always visible */}
      <motion.button
        layout="position"
        onClick={handleToggle}
        className="flex w-full items-center justify-between px-4 py-3.5 text-left"
        whileTap={{ scale: 0.99 }}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/20">
            <Settings className="h-4 w-4 text-purple-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">
              Mis preferencias
            </h3>
            <p className="text-[11px] text-white/40">
              Configura tu experiencia de viaje
            </p>
          </div>
        </div>
        <motion.div
          animate={{ rotate: isCollapsed ? 0 : 180 }}
          transition={{ duration: 0.25 }}
        >
          <ChevronDown className="h-5 w-5 text-white/40" />
        </motion.div>
      </motion.button>

      {/* Collapsible content */}
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          >
            <div className="overflow-hidden">
              <div className="space-y-5 px-4 pb-4">
                {/* Divider */}
                <div className="h-px w-full bg-white/5" />

                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-white/30" />
                    <span className="ml-2 text-xs text-white/30">
                      Cargando preferencias...
                    </span>
                  </div>
                ) : (
                  <>
                    {/* Temperatura */}
                    <div>
                      <SectionHeader icon={Thermometer} title="Temperatura" />
                      <TemperaturaSelector
                        value={preferences.temperatura}
                        onChange={(v) => updatePreference('temperatura', v)}
                      />
                    </div>

                    {/* Musica */}
                    <div>
                      <SectionHeader icon={Music} title="Música" />
                      <MusicaSelector
                        value={preferences.musica}
                        onChange={(v) => updatePreference('musica', v)}
                      />
                    </div>

                    {/* Nivel de conversación */}
                    <div>
                      <SectionHeader
                        icon={MessageCircle}
                        title="Nivel de conversación"
                      />
                      <ConversacionSelector
                        value={preferences.nivelConversacion}
                        onChange={(v) => updatePreference('nivelConversacion', v)}
                      />
                    </div>

                    {/* Toggles */}
                    <div className="space-y-2">
                      <SectionHeader icon={Dog} title="Extras" />
                      <ToggleRow
                        icon={Dog}
                        label="¿Permitir mascotas?"
                        checked={preferences.mascotas}
                        onChange={(v) => updatePreference('mascotas', v)}
                      />
                      <ToggleRow
                        icon={Cigarette}
                        label="¿Permitir fumar?"
                        checked={preferences.fumar}
                        onChange={(v) => updatePreference('fumar', v)}
                      />
                    </div>

                    {/* Save indicator */}
                    <div className="flex items-center justify-end pt-1">
                      <SaveIndicator saving={saving} />
                    </div>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Re-exports ──────────────────────────────────────────────────────────────

export { RiderPreferences as default }
