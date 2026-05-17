'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, MapPin, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { playNotificationBeep } from '@/lib/notificationService';

interface SOSButtonProps {
  /** Optional ride_id to associate with the SOS */
  rideId?: string;
  /** Additional className */
  className?: string;
  /** Compact mode for inline use */
  compact?: boolean;
}

export default function SOSButton({ rideId, className = '', compact = false }: SOSButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isActivating, setIsActivating] = useState(false);

  const activateSOS = async () => {
    setIsActivating(true);

    try {
      // Get current GPS position
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Geolocalizacion no disponible'));
          return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000,
        });
      });

      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;

      // Call SOS API
      const { supabase } = await import('@/lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();

      const res = await fetch('/api/sos/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({
          ride_id: rideId || null,
          latitude,
          longitude,
        }),
      });

      const data = await res.json();

      if (data.success) {
        // Play SOS alarm sound (cannot be muted - critical)
        playNotificationBeep('sos');
        setTimeout(() => playNotificationBeep('sos'), 700); // Repeat alarm

        toast.error('SOS ACTIVADO - Ayuda en camino', {
          duration: 10000,
          description: 'Los administradores han sido notificados con tu ubicacion.',
        });
      } else {
        throw new Error(data.error || 'Error al activar SOS');
      }
    } catch (err: any) {
      console.error('[SOS] Error:', err);
      toast.error('Error al activar SOS', {
        description: err?.message || 'Verifica tu conexion GPS e intenta de nuevo.',
      });
    } finally {
      setIsActivating(false);
      setShowConfirm(false);
    }
  };

  if (compact) {
    return (
      <>
        <button
          onClick={() => setShowConfirm(true)}
          className={`bg-red-500/20 border border-red-500/30 text-red-400 font-medium px-4 py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-red-500/30 transition-colors ${className}`}
        >
          <AlertTriangle className="w-5 h-5" />
          SOS
        </button>

        <AnimatePresence>
          {showConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-6"
              onClick={() => setShowConfirm(false)}
            >
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                className="bg-slate-900 border border-red-500/30 rounded-2xl p-6 max-w-sm w-full"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle className="w-8 h-8 text-red-500" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">Activar SOS?</h3>
                  <p className="text-sm text-gray-400 mb-1">Esto alertara inmediatamente a los administradores</p>
                  <p className="text-xs text-gray-500 mb-6 flex items-center justify-center gap-1">
                    <MapPin className="w-3 h-3" />
                    Tu ubicacion GPS sera compartida
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowConfirm(false)}
                      className="flex-1 py-3 rounded-xl border border-white/10 text-gray-300 hover:bg-white/5 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={activateSOS}
                      disabled={isActivating}
                      className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isActivating ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Activando...</>
                      ) : (
                        'ACTIVAR SOS'
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className={`bg-red-500/20 border border-red-500/30 text-red-400 font-medium px-4 py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-red-500/30 transition-colors ${className}`}
      >
        <AlertTriangle className="w-5 h-5" />
        SOS
      </button>

      <AnimatePresence>
        {showConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-6"
            onClick={() => setShowConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-slate-900 border border-red-500/30 rounded-2xl p-6 max-w-sm w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Activar SOS?</h3>
                <p className="text-sm text-gray-400 mb-1">Esto alertara inmediatamente a los administradores</p>
                <p className="text-xs text-gray-500 mb-6 flex items-center justify-center gap-1">
                  <MapPin className="w-3 h-3" />
                  Tu ubicacion GPS sera compartida
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowConfirm(false)}
                    className="flex-1 py-3 rounded-xl border border-white/10 text-gray-300 hover:bg-white/5 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={activateSOS}
                    disabled={isActivating}
                    className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isActivating ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Activando...</>
                    ) : (
                      'ACTIVAR SOS'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
