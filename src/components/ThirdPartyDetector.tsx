'use client';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, MapPin, X, Navigation } from 'lucide-react';
import { toast } from 'sonner';
import { calculateDistance } from '@/lib/googleMaps';
import { playNotificationBeep } from '@/lib/notificationService';

interface ThirdPartyDetectorProps {
  /** Active ride with driver location and route */
  rideId: string;
  /** Driver current coordinates */
  driverLat: number | undefined;
  driverLng: number | undefined;
  /** Ride route checkpoints (origin and destination coords) */
  routeOriginLat?: number;
  routeOriginLng?: number;
  routeDestLat?: number;
  routeDestLng?: number;
  /** Threshold in meters (default 500) */
  thresholdMeters?: number;
}

/**
 * Detects when driver deviates from the expected route.
 * Shows a mandatory warning popup when deviation exceeds threshold.
 * Creates a report and marks the ride as third-party.
 */
export default function ThirdPartyDetector({
  rideId,
  driverLat,
  driverLng,
  routeOriginLat,
  routeOriginLng,
  routeDestLat,
  routeDestLng,
  thresholdMeters = 500,
}: ThirdPartyDetectorProps) {
  const [isOffRoute, setIsOffRoute] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [hasReported, setHasReported] = useState(false);

  const checkDeviation = useCallback(() => {
    if (!driverLat || !driverLng || !routeOriginLat || !routeOriginLng || !routeDestLat || !routeDestLng) return;
    if (dismissed || isOffRoute) return;

    // Calculate distance from driver to the line between origin and destination
    // Simplified: check if driver is more than threshold away from BOTH origin and destination line
    // More sophisticated: check perpendicular distance to route line
    const distToOrigin = calculateDistance(driverLat, driverLng, routeOriginLat, routeOriginLng);
    const distToDest = calculateDistance(driverLat, driverLng, routeDestLat, routeDestLng);
    const totalDist = calculateDistance(routeOriginLat, routeOriginLng, routeDestLat, routeDestLng);

    // Check if driver is between origin and destination but too far from the route line
    // Using a simplified perpendicular distance approximation
    // If total distance is 0, use direct distance check
    if (totalDist === 0) {
      if (distToOrigin * 1000 > thresholdMeters) {
        triggerAlert();
      }
      return;
    }

    // Calculate perpendicular distance from driver to the route line
    // Using the cross product formula
    const distFromRoute = perpendicularDistanceMeters(
      driverLat, driverLng,
      routeOriginLat, routeOriginLng,
      routeDestLat, routeDestLng
    );

    if (distFromRoute > thresholdMeters) {
      triggerAlert();
    }
  }, [driverLat, driverLng, routeOriginLat, routeOriginLng, routeDestLat, routeDestLng, thresholdMeters, dismissed, isOffRoute]);

  const triggerAlert = () => {
    setIsOffRoute(true);
    playNotificationBeep('warning');
    createThirdPartyReport();
  };

  const createThirdPartyReport = async () => {
    if (hasReported) return;
    setHasReported(true);

    try {
      // Mark ride as third-party
      const { supabase } = await import('@/lib/supabase');
      await supabase
        .from('rides')
        .update({ is_third_party: true })
        .eq('id', rideId);

      // Create automatic report
      const { data: { session } } = await supabase.auth.getSession();
      await fetch('/api/reports/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({
          ride_id: rideId,
          type: 'incident',
          description: `Alerta automatica: El conductor se desvio mas de ${thresholdMeters}m de la ruta esperada. Posible viaje realizado por un tercero. Ubicacion del conductor: ${driverLat?.toFixed(4)}, ${driverLng?.toFixed(4)}`,
        }),
      });

      toast.warning('Desviacion de ruta detectada', {
        duration: 8000,
        description: 'Se ha generado un reporte automatico. Los administradores han sido notificados.',
      });
    } catch (err) {
      console.error('[ThirdParty] Report error:', err);
    }
  };

  // Check periodically when driver location updates
  useEffect(() => {
    if (!driverLat || !driverLng) return;
    checkDeviation();
  }, [driverLat, driverLng, checkDeviation]);

  const handleDismiss = () => {
    setDismissed(true);
  };

  return (
    <AnimatePresence>
      {isOffRoute && !dismissed && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-24 left-4 right-4 max-w-md mx-auto z-[90] p-4"
        >
          <div className="bg-amber-900/90 border border-amber-500/40 rounded-2xl p-4 backdrop-blur-lg">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-amber-200">Desviacion de ruta detectada</h4>
                <p className="text-xs text-amber-300/70 mt-1">
                  El conductor se ha alejado mas de {thresholdMeters}m de la ruta esperada. Esto puede indicar un viaje realizado por un tercero.
                </p>
                <p className="text-xs text-amber-400/60 mt-1 flex items-center gap-1">
                  <Navigation className="w-3 h-3" />
                  Reporte automatico enviado a administradores
                </p>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleDismiss}
                    className="flex-1 py-2 rounded-lg bg-amber-500/20 text-amber-200 text-xs font-medium hover:bg-amber-500/30 transition-colors"
                  >
                    Entendido
                  </button>
                  <button
                    onClick={() => {
                      toast.info('Usa el boton SOS en caso de emergencia');
                      handleDismiss();
                    }}
                    className="flex-1 py-2 rounded-lg bg-red-500/20 text-red-300 text-xs font-medium hover:bg-red-500/30 transition-colors"
                  >
                    Necesito ayuda
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Calculate perpendicular distance in meters from a point to a line defined by two points.
 * All coordinates in decimal degrees.
 */
function perpendicularDistanceMeters(
  pointLat: number, pointLng: number,
  lineStartLat: number, lineStartLng: number,
  lineEndLat: number, lineEndLng: number
): number {
  // Convert to approximate meters
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos(((pointLat + lineStartLat + lineEndLat) / 3) * Math.PI / 180);

  // Line in meters
  const x0 = pointLng * mPerDegLng;
  const y0 = pointLat * mPerDegLat;
  const x1 = lineStartLng * mPerDegLng;
  const y1 = lineStartLat * mPerDegLat;
  const x2 = lineEndLng * mPerDegLng;
  const y2 = lineEndLat * mPerDegLat;

  // Line length squared
  const lineLenSq = (x2 - x1) ** 2 + (y2 - y1) ** 2;

  if (lineLenSq === 0) {
    return Math.sqrt((x0 - x1) ** 2 + (y0 - y1) ** 2);
  }

  // Project point onto line, clamped to segment
  let t = ((x0 - x1) * (x2 - x1) + (y0 - y1) * (y2 - y1)) / lineLenSq;
  t = Math.max(0, Math.min(1, t));

  const projX = x1 + t * (x2 - x1);
  const projY = y1 + t * (y2 - y1);

  return Math.sqrt((x0 - projX) ** 2 + (y0 - projY) ** 2);
}
