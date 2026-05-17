'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  Settings as SettingsIcon, Shield, Globe, Key, Server,
  Save, Info, AlertTriangle, Zap, X, RotateCcw, Trash2,
  Eye, EyeOff, Copy, CheckCircle2, Clock, Cpu, Loader2,
  ChevronRight, ArrowLeft
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

interface SystemSetting {
  id: string;
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  icon: React.ElementType;
  warning?: boolean;
}

function TrendingUp(props: React.SVGProps<SVGSVGElement> & { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" />
    </svg>
  );
}

interface ApiKey {
  name: string;
  key: string;
  value: string;
  masked: string;
}

const apiKeyConfig: { name: string; key: string; placeholder: string }[] = [
  { name: 'Google Maps API', key: 'google_maps_api_key', placeholder: 'SU_CLAVE_AQUI' },
  { name: 'Supabase URL', key: 'supabase_url', placeholder: 'https://su-proyecto.supabase.co' },
  { name: 'Stripe Secret Key', key: 'stripe_secret_key', placeholder: 'sk_test_...' },
  { name: 'WebSocket Server', key: 'websocket_server', placeholder: 'wss://...' },
];

const settingDefaults: SystemSetting[] = [
  { id: 'maintenance', key: 'system_maintenance', label: 'Modo mantenimiento', description: 'Desactiva el sistema para los usuarios finales', enabled: false, icon: AlertTriangle, warning: true },
  { id: 'registration', key: 'registration_open', label: 'Registro abierto', description: 'Permite el registro de nuevos usuarios', enabled: true, icon: Globe },
  { id: 'auto_assign', key: 'auto_assign', label: 'Asignación automática', description: 'Asigna viajes automáticamente al conductor más cercano', enabled: true, icon: Zap },
  { id: 'surge', key: 'surge_pricing', label: 'Precios dinámicos (Surge)', description: 'Activa multiplicadores de precio por alta demanda', enabled: true, icon: TrendingUp },
  { id: 'sos', key: 'sos_enabled', label: 'Sistema SOS', description: 'Activa el botón de emergencia SOS para pasajeros', enabled: true, icon: Shield },
];

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 animate-pulse">
      {/* System Settings skeleton */}
      <div className="xl:col-span-2 space-y-4">
        <div className="glass rounded-2xl p-6">
          <div className="h-5 w-48 rounded bg-white/5 mb-5" />
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/5" />
                  <div className="space-y-1.5">
                    <div className="h-4 w-32 rounded bg-white/5" />
                    <div className="h-3 w-48 rounded bg-white/5" />
                  </div>
                </div>
                <div className="w-14 h-7 rounded-full bg-white/5" />
              </div>
            ))}
          </div>
        </div>
        {/* API Keys skeleton */}
        <div className="glass rounded-2xl p-6">
          <div className="h-5 w-24 rounded bg-white/5 mb-5" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white/5 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="h-4 w-32 rounded bg-white/5" />
                  <div className="flex gap-1">
                    <div className="w-8 h-8 rounded-lg bg-white/5" />
                    <div className="w-8 h-8 rounded-lg bg-white/5" />
                  </div>
                </div>
                <div className="h-8 w-full rounded-lg bg-white/5" />
              </div>
            ))}
          </div>
        </div>
        {/* Save button skeleton */}
        <div className="h-12 w-full rounded-xl bg-white/5" />
      </div>
      {/* Right panel skeleton */}
      <div className="space-y-4">
        <div className="glass rounded-2xl p-5">
          <div className="h-5 w-40 rounded bg-white/5 mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
                <div className="w-8 h-8 rounded-lg bg-white/5" />
                <div className="space-y-1">
                  <div className="h-3 w-16 rounded bg-white/5" />
                  <div className="h-4 w-24 rounded bg-white/5" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="h-5 w-32 rounded bg-white/5 mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between bg-white/5 rounded-xl p-3">
                <div className="h-4 w-32 rounded bg-white/5" />
                <div className="h-5 w-6 rounded bg-white/5" />
              </div>
            ))}
          </div>
        </div>
        <div className="glass rounded-2xl p-5 border border-red-500/20">
          <div className="h-5 w-28 rounded bg-white/5 mb-3" />
          <div className="h-3 w-48 rounded bg-white/5 mb-4" />
          <div className="space-y-2">
            <div className="h-10 w-full rounded-xl bg-white/5" />
            <div className="h-10 w-full rounded-xl bg-white/5" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SystemSetting[]>(settingDefaults);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showRestartModal, setShowRestartModal] = useState(false);
  const [showCacheModal, setShowCacheModal] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      const keys = settingDefaults.map((s) => s.key);
      const apiKeyKeys = apiKeyConfig.map((c) => c.key);
      const allKeys = [...keys, ...apiKeyKeys];
      const { data, error } = await supabase
        .from('settings')
        .select('key, value, type')
        .in('key', allKeys);

      if (error) throw error;

      const dbMap = new Map<string, boolean>();
      for (const row of data ?? []) {
        if (row.type === 'boolean') {
          dbMap.set(row.key, row.value === 'true');
        }
      }

      setSettings((prev) =>
        prev.map((s) => {
          if (dbMap.has(s.key)) {
            return { ...s, enabled: dbMap.get(s.key)! };
          }
          return s;
        })
      );

      // Load API keys from settings table
      const apiKeyRows = (data ?? []).filter(r => r.type === 'api_key');
      const loadedKeys: ApiKey[] = apiKeyConfig.map(cfg => {
        const found = apiKeyRows.find(r => r.key === cfg.key);
        const val = found ? found.value : '';
        return {
          name: cfg.name,
          key: cfg.key,
          value: val,
          masked: val ? `${val.slice(0, 4)}${'*'.repeat(Math.max(0, val.length - 4))}` : 'No configurado',
        };
      });
      setApiKeys(loadedKeys);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      toast.error(`Error al cargar configuración: ${message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const upsertSetting = async (key: string, value: boolean) => {
    const { error } = await supabase
      .from('settings')
      .upsert(
        { key, value: value.toString(), type: 'boolean' },
        { onConflict: 'key' }
      );

    if (error) throw error;
  };

  const toggleSetting = async (id: string) => {
    const setting = settings.find((s) => s.id === id);
    if (!setting) return;

    const newValue = !setting.enabled;

    setSettings((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: newValue } : s))
    );

    try {
      await upsertSetting(setting.key, newValue);
      if (setting.warning && !newValue) {
        toast.warning(`${setting.label} desactivado — el sistema estará en mantenimiento`);
      } else {
        toast.success(`${setting.label} ${newValue ? 'activado' : 'desactivado'}`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      toast.error(`Error al guardar: ${message}`);
      setSettings((prev) =>
        prev.map((s) => (s.id === id ? { ...s, enabled: !newValue } : s))
      );
    }
  };

  const toggleKeyVisibility = (name: string) => {
    setRevealedKeys((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const copyKey = async (key: ApiKey) => {
    if (!key.value) {
      toast.error(`${key.name} no esta configurado`);
      return;
    }
    await navigator.clipboard.writeText(key.value);
    setCopiedKey(key.name);
    toast.success(`${key.name} copiado al portapapeles`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const rows = settings.map((s) => ({
        key: s.key,
        value: s.enabled.toString(),
        type: 'boolean' as const,
      }));

      const { error } = await supabase
        .from('settings')
        .upsert(rows, { onConflict: 'key' });

      if (error) throw error;

      toast.success('Configuración del sistema actualizada');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      toast.error(`Error al guardar configuración: ${message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/admin" className="hover:text-white transition-colors flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" />
            Panel
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-white font-medium">Configuración</span>
        </div>
        <h1 className="text-3xl font-bold text-white">Configuración</h1>
        <p className="text-gray-400 mt-1">Ajustes globales del sistema RIDA</p>
      </div>

      {/* Loading */}
      {loading && <LoadingSkeleton />}

      {!loading && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* System Settings */}
          <div className="xl:col-span-2 space-y-4">
            <motion.div
              className="glass rounded-2xl p-6"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-5">
                <SettingsIcon className="w-5 h-5 text-cyan-400" />
                Configuración del Sistema
              </h3>
              <div className="space-y-4">
                {settings.map((setting, i) => {
                  const Icon = setting.icon;
                  return (
                    <motion.div
                      key={setting.id}
                      className={`flex items-center justify-between p-4 rounded-xl transition-all ${
                        setting.enabled ? 'bg-white/5' : 'bg-white/[0.02]'
                      }`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          setting.warning && setting.enabled ? 'bg-red-500/20' :
                          setting.enabled ? 'bg-cyan-500/10' : 'bg-white/5'
                        }`}>
                          <Icon className={`w-5 h-5 ${
                            setting.warning && setting.enabled ? 'text-red-400' :
                            setting.enabled ? 'text-cyan-400' : 'text-gray-500'
                          }`} />
                        </div>
                        <div>
                          <h4 className={`text-sm font-medium ${setting.enabled ? 'text-white' : 'text-gray-500'}`}>{setting.label}</h4>
                          <p className="text-xs text-gray-500 mt-0.5">{setting.description}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => toggleSetting(setting.id)}
                        className={`relative w-14 h-7 rounded-full transition-colors duration-300 flex-shrink-0 ${
                          setting.enabled
                            ? setting.warning ? 'bg-red-500' : 'bg-cyan-500'
                            : 'bg-white/10'
                        }`}
                      >
                        <motion.div
                          className="absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md"
                          animate={{ left: setting.enabled ? 'calc(100% - 26px)' : '2px' }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        />
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>

            {/* API Keys */}
            <motion.div
              className="glass rounded-2xl p-6"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-5">
                <Key className="w-5 h-5 text-amber-400" />
                API Keys
              </h3>
              <div className="space-y-3">
                {apiKeys.length > 0 ? apiKeys.map((key, i) => (
                  <motion.div
                    key={key.key}
                    className="bg-white/5 rounded-xl p-4"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + i * 0.05 }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-white">{key.name}</p>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => toggleKeyVisibility(key.name)}
                          className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                        >
                          {revealedKeys[key.name] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => copyKey(key)}
                          className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all"
                        >
                          {copiedKey === key.name ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="px-3 py-2 bg-black/30 rounded-lg font-mono text-xs">
                      <span className={key.value ? 'text-gray-400' : 'text-gray-600 italic'}>{revealedKeys[key.name] ? (key.value || 'No configurado') : key.masked}</span>
                    </div>
                  </motion.div>
                )) : (
                  <p className="text-sm text-gray-500 text-center py-4">Cargando API keys...</p>
                )}
              </div>
            </motion.div>

            {/* Save */}
            <motion.button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full py-3.5 rounded-xl btn-neon text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              {isSaving ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
              ) : (
                <><Save className="w-4 h-4" /> Guardar Configuración</>
              )}
            </motion.button>
          </div>

          {/* Right Panel */}
          <div className="space-y-4">
            {/* System Info */}
            <motion.div
              className="glass rounded-2xl p-5"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                <Server className="w-5 h-5 text-cyan-400" />
                Información del Sistema
              </h3>
              <div className="space-y-3">
                {[
                  { label: 'Versión', value: '1.0.0', icon: Cpu },
                  { label: 'Última actualización', value: '2026-04-15', icon: Clock },
                  { label: 'Estado', value: 'Online', icon: Globe, valueClass: 'text-emerald-400' },
                  { label: 'Uptime', value: '99.97%', icon: Zap, valueClass: 'text-cyan-400' },
                  { label: 'Servidor', value: 'Costa Rica (CR)', icon: Server },
                ].map((info, i) => (
                  <motion.div
                    key={i}
                    className="flex items-center gap-3 bg-white/5 rounded-xl p-3"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.05 }}
                  >
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                      <info.icon className="w-4 h-4 text-gray-400" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">{info.label}</p>
                      <p className={`text-sm font-medium ${info.valueClass || 'text-white'}`}>{info.value}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Quick Stats */}
            <motion.div
              className="glass rounded-2xl p-5"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                <Info className="w-5 h-5 text-blue-400" />
                Resumen Rápido
              </h3>
              <div className="space-y-3">
                {[
                  { label: 'Reportes pendientes', value: settings.filter(s => s.warning).length.toString(), color: 'text-amber-400' },
                  { label: 'APIs configuradas', value: apiKeys.filter(k => k.value).length.toString(), color: 'text-cyan-400' },
                  { label: 'Módulos activos', value: settings.filter(s => s.enabled).length.toString(), color: 'text-emerald-400' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between bg-white/5 rounded-xl p-3">
                    <span className="text-sm text-gray-400">{item.label}</span>
                    <span className={`text-lg font-bold ${item.color}`}>{item.value}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Danger Zone */}
            <motion.div
              className="glass rounded-2xl p-5 border border-red-500/20"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <h3 className="text-lg font-semibold text-red-400 flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5" />
                Zona de Peligro
              </h3>
              <p className="text-xs text-gray-500 mb-4">Acciones críticas que afectan el sistema</p>
              <div className="space-y-2">
                <button
                  onClick={() => setShowRestartModal(true)}
                  className="w-full py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reiniciar Servidor
                </button>
                <button
                  onClick={() => setShowCacheModal(true)}
                  className="w-full py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Limpiar Caché
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      )}

      {/* Restart Server Modal */}
      <AnimatePresence>
        {showRestartModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/60" onClick={() => setShowRestartModal(false)} />
            <motion.div
              className="relative glass-strong rounded-2xl p-6 w-full max-w-sm z-10"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">Reiniciar Servidor</h2>
                <button
                  type="button"
                  onClick={() => setShowRestartModal(false)}
                  className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-start gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-300">
                    El reinicio del servidor debe gestionarse a traves del proveedor de hosting (Vercel, AWS, etc.).
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Esta accion no puede ejecutarse desde el panel de administracion por razones de seguridad.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowRestartModal(false)}
                className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm font-medium hover:bg-white/10 transition-all"
              >
                Entendido
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Clear Cache Modal */}
      <AnimatePresence>
        {showCacheModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/60" onClick={() => setShowCacheModal(false)} />
            <motion.div
              className="relative glass-strong rounded-2xl p-6 w-full max-w-sm z-10"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">Limpiar Caché</h2>
                <button
                  type="button"
                  onClick={() => setShowCacheModal(false)}
                  className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-start gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-300">
                    Se limpiara el almacenamiento local y de sesion del navegador. La pagina se recargara automaticamente.
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Es posible que debas iniciar sesion nuevamente.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowCacheModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-sm font-medium hover:bg-white/10 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.clear();
                    sessionStorage.clear();
                    toast.success('Caché limpiado correctamente');
                    setShowCacheModal(false);
                    setTimeout(() => window.location.reload(), 500);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/30 transition-all"
                >
                  Limpiar y recargar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
