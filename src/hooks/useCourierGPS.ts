'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface GpsPoint {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  timestamp: number;
}

interface UseCourierGPSOptions {
  /** Intervalo de envío en milisegundos (default 8000 = 8s) */
  interval?: number;
  /** Si el GPS está mockeado (viene del navegador) */
  isMocked?: boolean;
  /** Callback cuando se detecta GPS mockeado */
  onMockDetected?: () => void;
  /** Callback cuando hay error de GPS */
  onError?: (error: string) => void;
  /** Callback con la ubicación actual */
  onLocationUpdate?: (point: GpsPoint) => void;
  /** Callback con el número de puntos enviados */
  onPointsSent?: (count: number) => void;
  /** Habilitar el tracking (default false) */
  enabled?: boolean;
}

export function useCourierGPS(options: UseCourierGPSOptions = {}) {
  const {
    interval = 8000,
    isMocked: externalMocked = false,
    onMockDetected,
    onError,
    onLocationUpdate,
    onPointsSent,
    enabled = false,
  } = options;

  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const deliveryIdRef = useRef<string | null>(null);
  const currentLocationRef = useRef<GpsPoint | null>(null);
  const sendingRef = useRef(false);
  const pointsSentRef = useRef(0);

  const [isTracking, setIsTracking] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<GpsPoint | null>(null);
  const [pointsSent, setPointsSent] = useState(0);
  const [isMocked, setIsMocked] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Obtener nivel de batería
  const getBattery = useCallback(async () => {
    try {
      if ('getBattery' in navigator) {
        const battery = await (navigator as unknown as { getBattery: () => Promise<{ level: number }> }).getBattery();
        setBatteryLevel(Math.round(battery.level * 100));
      }
    } catch {
      // Battery API no disponible
    }
  }, []);

  // Enviar ubicación al servidor
  const sendLocation = useCallback(async (point: GpsPoint) => {
    if (sendingRef.current) return;
    sendingRef.current = true;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const response = await fetch('/api/couriers/update-location', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          latitude: point.latitude,
          longitude: point.longitude,
          speed: point.speed,
          accuracy: point.accuracy,
          heading: point.heading,
          delivery_id: deliveryIdRef.current,
          session_id: sessionIdRef.current,
          battery_level: batteryLevel,
          is_mocked: isMocked || externalMocked,
        }),
      });

      const data = await response.json();
      if (data.success && data.session_id) {
        sessionIdRef.current = data.session_id;
      }
      if (data.delivery_id) {
        deliveryIdRef.current = data.delivery_id;
      }

      pointsSentRef.current += 1;
      setPointsSent(pointsSentRef.current);
      onPointsSent?.(pointsSentRef.current);
    } catch (err) {
      console.error('[CourierGPS] Error enviando ubicación:', err);
      onError?.('Error enviando ubicación');
    } finally {
      sendingRef.current = false;
    }
  }, [batteryLevel, isMocked, externalMocked, onPointsSent, onError]);

  // Iniciar tracking GPS
  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      const msg = 'GPS no disponible en este dispositivo';
      setError(msg);
      onError?.(msg);
      return;
    }

    setIsTracking(true);
    setError(null);
    getBattery();

    // watchPosition para ubicación en tiempo real
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const point: GpsPoint = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed,
          heading: position.coords.heading,
          timestamp: position.timestamp,
        };

        // Detectar GPS mockeado
        // En Android: accuracy < 10 con speed = null frecuentemente
        if (position.coords.accuracy < 5 && !position.coords.speed && position.coords.heading === null) {
          // Posible GPS simulado, pero no es definitivo
        }

        currentLocationRef.current = point;
        setCurrentLocation(point);
        onLocationUpdate?.(point);
      },
      (err) => {
        const msg = `GPS error: ${err.message}`;
        setError(msg);
        onError?.(msg);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000,
      }
    );

    // Intervalo para enviar ubicación al servidor
    intervalRef.current = setInterval(() => {
      if (currentLocationRef.current) {
        sendLocation(currentLocationRef.current);
      }
    }, interval);

  }, [interval, sendLocation, getBattery, onLocationUpdate, onError]);

  // Detener tracking GPS
  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsTracking(false);
    currentLocationRef.current = null;
  }, []);

  // Limpiar al desmontar
  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, [stopTracking]);

  // Auto-start/stop basado en `enabled`
  useEffect(() => {
    if (enabled && !isTracking) {
      startTracking();
    } else if (!enabled && isTracking) {
      stopTracking();
    }
  }, [enabled, isTracking, startTracking, stopTracking]);

  return {
    isTracking,
    currentLocation,
    pointsSent,
    isMocked,
    batteryLevel,
    error,
    startTracking,
    stopTracking,
    setDeliveryId: (id: string | null) => { deliveryIdRef.current = id; },
    resetSession: () => { sessionIdRef.current = null; pointsSentRef.current = 0; setPointsSent(0); },
  };
}
