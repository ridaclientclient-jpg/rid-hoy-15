'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { useDriverStore } from '@/store/driverStore';
import { supabase, type Driver, type Ride } from '@/lib/supabase';
import { toast } from 'sonner';
import GoogleMap from '@/components/GoogleMap';
import { loadGoogleMaps } from '@/lib/googleMaps';
import PlacesAutocomplete from '@/components/PlacesAutocomplete';
import { PinVerification } from '@/components/PinVerification';
import {
  Power, Star, Car, Clock, TrendingUp, ChevronRight,
  Shield, Trophy, Diamond, Target, Wallet,
  Navigation, BarChart3, Zap, Award, Eye, Bell, AlertTriangle, Coffee,
} from 'lucide-react';

// Level system
const LEVELS = [
  { name: 'Basico', icon: Zap, minTrips: 0, color: 'from-gray-500 to-gray-400', textColor: 'text-gray-300', bgColor: 'bg-gray-500/20' },
  { name: 'Bronce', icon: Award, minTrips: 20, color: 'from-amber-700 to-amber-600', textColor: 'text-amber-500', bgColor: 'bg-amber-500/20' },
  { name: 'Plata', icon: Shield, minTrips: 50, color: 'from-gray-300 to-gray-200', textColor: 'text-gray-200', bgColor: 'bg-gray-300/20' },
  { name: 'Oro', icon: Trophy, minTrips: 100, color: 'from-yellow-500 to-amber-400', textColor: 'text-yellow-400', bgColor: 'bg-yellow-500/20' },
  { name: 'Platino', icon: Diamond, minTrips: 200, color: 'from-cyan-400 to-blue-400', textColor: 'text-cyan-400', bgColor: 'bg-cyan-400/20' },
  { name: 'Diamante', icon: Diamond, minTrips: 500, color: 'from-purple-400 to-pink-400', textColor: 'text-purple-400', bgColor: 'bg-purple-400/20' },
];

function getDriverLevel(totalRides: number) {
  let level = LEVELS[0];
  for (const l of LEVELS) {
    if (totalRides >= l.minTrips) level = l;
  }
  return level;
}

function getNextLevel(totalRides: number) {
  for (const l of LEVELS) {
    if (totalRides < l.minTrips) return l;
  }
  return null;
}

// ─── Break Countdown Helper ────────────────────────────────────
function BreakCountdown({ targetTime }: { targetTime: string }) {
  const [timeLeft, setTimeLeft] = useState('');
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const target = new Date(targetTime).getTime();
    const totalMs = 30 * 60 * 1000; // 30 min assumed break
    const startMs = target - totalMs;

    const tick = () => {
      const now = Date.now();
      const diff = target - now;
      if (diff <= 0) {
        setTimeLeft('00:00');
        setProgress(100);
        return;
      }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
      const elapsed = now - startMs;
      setProgress(Math.min((elapsed / totalMs) * 100, 100));
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [targetTime]);

  return (
    <div>
      <p className="text-3xl font-bold text-amber-400 mb-2">{timeLeft}</p>
      <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500"
        />
      </div>
      <p className="text-[10px] text-gray-500 mt-1">Tiempo restante</p>
    </div>
  );
}

export default function DriverHome() {
  const router = useRouter();
  const { user, session } = useAuthStore();
  const driverStoreIsOnline = useDriverStore((s) => s.isOnline);
  const [isOnline, setIsOnline] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [todayTrips, setTodayTrips] = useState(0);
  const [showFullMap, setShowFullMap] = useState(false);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [showDestMode, setShowDestMode] = useState(false);
  const [destAddress, setDestAddress] = useState('');
  const [destCoords, setDestCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [destSetting, setDestSetting] = useState(false);
  const [metrics, setMetrics] = useState<any>(null);
  const locationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const watchIdRef = useRef<number | null>(null);

  // ─── Surge Zones on Map ────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const surgeOverlaysRef = useRef<any[]>([]);
  const [surgeZones, setSurgeZones] = useState<any[]>([]);

  // ─── Break Enforcement ─────────────────────────────
  const [showBreakModal, setShowBreakModal] = useState(false);
  const [breakUntilTime, setBreakUntilTime] = useState<string | null>(null);

  // ─── PIN Verification (Disabled for now as per user request) ───
  const [showPinVerify, setShowPinVerify] = useState(false);
  const [currentRide, setCurrentRide] = useState<Ride | null>(null);

  // ─── Sync isOnline with shared driverStore ──────────
  // Initialize from store so other panels see the same state
  useEffect(() => {
    if (driverStoreIsOnline && !isOnline) {
      setIsOnline(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync local isOnline back to the store whenever it changes
  useEffect(() => {
    useDriverStore.setState({ isOnline });
  }, [isOnline]);

  const level = getDriverLevel(driver?.total_rides || 0);
  const nextLevel = getNextLevel(driver?.total_rides || 0);
  const progressToNext = nextLevel
    ? ((driver?.total_rides || 0) / nextLevel.minTrips) * 100
    : 100;
  const rating = driver?.rating || 0;
  const dailyGoal = driver?.daily_goal || 50000;

  // Fetch driver data and today's earnings
  const fetchData = useCallback(async () => {
    if (!user?.id || !session?.access_token) return;
    try {
      const res = await fetch('/api/drivers/profile', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      const driverData = data.success ? data.driver : null;

      if (driverData) {
        setDriver(driverData);
        setIsOnline(driverData.status === 'online' || driverData.status === 'busy');
      }

      if (driverData?.id) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const { data: todayRides } = await supabase
          .from('rides')
          .select('driver_earnings, price')
          .eq('driver_id', driverData.id)
          .eq('status', 'completed')
          .gte('created_at', today.toISOString());

        if (todayRides && todayRides.length > 0) {
          const sum = todayRides.reduce((acc, r) => acc + (r.driver_earnings || Math.round(r.price * 0.85)), 0);
          setTodayEarnings(sum);
          setTodayTrips(todayRides.length);
        }
      }
    } catch (err) {
      console.error('Error fetching driver home data:', err);
    }
  }, [user?.id, session?.access_token]);

  useEffect(() => {
    fetchData();
    const refreshInterval = setInterval(fetchData, 60000);
    // Fetch driver metrics
    const fetchMetrics = async () => {
      if (!session?.access_token) return;
      try {
        const res = await fetch('/api/drivers/metrics', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await res.json();
        if (data.success) setMetrics(data);
      } catch { /* ignore */ }
    };
    fetchMetrics();
    const metricsInterval = setInterval(fetchMetrics, 120000);
    return () => { clearInterval(refreshInterval); clearInterval(metricsInterval); };
  }, [fetchData, session?.access_token]);

  // Get user GPS coordinates
  const getUserLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserCoords(coords);
      },
      () => {
        // GPS not available or denied
        setUserCoords({ lat: 9.9281, lng: -84.0907 });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // Send location to API
  const sendLocation = useCallback(async (lat: number, lng: number) => {
    if (!session?.access_token) return;
    try {
      await fetch('/api/drivers/update-location', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ latitude: lat, longitude: lng }),
      });
    } catch {
      // Silently fail - location updates are not critical
    }
  }, [session?.access_token]);

  // Start GPS tracking when online
  useEffect(() => {
    if (isOnline) {
      getUserLocation();

      // Watch position for continuous tracking
      if (navigator.geolocation) {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            const { latitude, longitude } = pos.coords;
            setUserCoords({ lat: latitude, lng: longitude });
            sendLocation(latitude, longitude);
          },
          () => {},
          { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
        );
      }

      // Also send location every 10 seconds as backup
      locationIntervalRef.current = setInterval(() => {
        if (userCoords) {
          sendLocation(userCoords.lat, userCoords.lng);
        }
      }, 10000);
    } else {
      // Stop tracking when offline
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
        locationIntervalRef.current = null;
      }
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
        locationIntervalRef.current = null;
      }
    };
  }, [isOnline, getUserLocation, sendLocation, userCoords]);

  // ─── Fetch Surge Zones ──────────────────────────────
  useEffect(() => {
    if (!isOnline) {
      setSurgeZones([]);
      return;
    }
    const fetchZones = async () => {
      try {
        const { data } = await supabase
          .from('location_areas')
          .select('id, name, coordinates, surge_multiplier')
          .eq('area_type', 'surge_zone')
          .eq('is_active', true)
          .gt('surge_multiplier', 1);
        setSurgeZones(data || []);
      } catch { /* ignore */ }
    };
    fetchZones();
    const iv = setInterval(fetchZones, 30000);
    return () => clearInterval(iv);
  }, [isOnline]);

  // ─── Break Enforcement Check ────────────────────────
  const checkBreakStatus = useCallback(async () => {
    if (!user?.id || !session?.access_token) return false;
    try {
      const res = await fetch('/api/drivers/profile', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      const driver = data.success ? data.driver : null;
      if (driver?.break_until) {
        const breakTime = new Date(driver.break_until);
        if (breakTime > new Date()) {
          setBreakUntilTime(driver.break_until);
          setShowBreakModal(true);
          return true;
        }
      }
      setBreakUntilTime(null);
      setShowBreakModal(false);
      return false;
    } catch {
      return false;
    }
  }, [user?.id, session?.access_token]);

  // Real-time subscription for new rides
  useEffect(() => {
    if (!driver?.id) return;

    const channel = supabase
      .channel(`driver-rides-${driver.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rides',
          filter: `driver_id=eq.${driver.id}`,
        },
        (payload) => {
          console.log('[Realtime] Ride update received:', payload.new);
          const newRide = payload.new as Ride;
          if (['assigned', 'arriving', 'started'].includes(newRide.status)) {
            setCurrentRide(newRide);
            if (newRide.status === 'assigned') {
              toast.success('¡Nuevo viaje asignado!', {
                description: `De ${newRide.origin} a ${newRide.destination}`,
                duration: 10000,
              });
              // Vibrate or play sound if possible in future APK
            }
          } else {
            setCurrentRide(null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [driver?.id]);

  // Fetch driver's active ride (Polling fallback)
  useEffect(() => {
    if (!driver?.id) return;
    const fetchActiveRide = async () => {
      const { data } = await supabase
        .from('rides')
        .select('*')
        .eq('driver_id', driver.id)
        .in('status', ['assigned', 'arriving', 'started'])
        .order('created_at', { ascending: false })
        .limit(1);
      if (data && data.length > 0) {
        setCurrentRide(data[0] as Ride);
      } else {
        setCurrentRide(null);
      }
    };
    fetchActiveRide();
    const interval = setInterval(fetchActiveRide, 15000);
    return () => clearInterval(interval);
  }, [driver?.id]);

  // Auto-show PIN logic removed (as per user request)
  useEffect(() => {
    if (currentRide?.status === 'assigned' || currentRide?.status === 'arriving') {
      setShowPinVerify(false); // Force false
    }
  }, [currentRide?.status, currentRide?.id]);

  // Toggle online/offline via API
  const handleToggleOnline = useCallback(async () => {
    if (!session?.access_token) return;

    // Check break enforcement before going online
    if (!isOnline) {
      const onBreak = await checkBreakStatus();
      if (onBreak) {
        toast.error('Debes completar tu descanso antes de conectarte');
        return;
      }
    }

    setIsToggling(true);

    const newStatus = isOnline ? 'offline' : 'online';
    const lat = userCoords?.lat;
    const lng = userCoords?.lng;

    try {
      const res = await fetch('/api/drivers/toggle-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          status: newStatus,
          latitude: lat,
          longitude: lng,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setIsOnline(!isOnline);
        if (!isOnline) {
          toast.success('Estas en linea! Recibiras solicitudes de viaje.');
          // Immediately send current location
          if (lat && lng) sendLocation(lat, lng);
        } else {
          toast.success('Has pasado a fuera de linea.');
        }
      } else {
        toast.error(data.error || 'Error al cambiar estado. Intenta de nuevo.');
      }
    } catch {
      toast.error('Error de conexion. Verifica tu internet.');
    } finally {
      setIsToggling(false);
    }
  }, [isOnline, session?.access_token, userCoords, sendLocation, checkBreakStatus]);

  // Open Google Maps navigation
  const openNavigation = useCallback(() => {
    if (userCoords) {
      window.open(`https://www.google.com/maps/dir/?api=1&origin=${userCoords.lat},${userCoords.lng}`, '_blank');
    } else {
      window.open('https://www.google.com/maps', '_blank');
    }
  }, [userCoords]);

  // Report incident
  const reportIncident = useCallback(() => {
    router.push('/driver/support');
  }, [router]);

  // Set destination for destination mode
  const handleSetDestination = useCallback(async () => {
    if (!session?.access_token || !destCoords) return;
    setDestSetting(true);
    try {
      const res = await fetch('/api/drivers/destination-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ enabled: true, destLat: destCoords.lat, destLng: destCoords.lng, destinationAddress: destAddress }),
      });
      const data = await res.json();
      if (data.success) toast.success(data.message);
      else toast.error(data.error || 'Error al activar destino');
    } catch { toast.error('Error de conexion'); }
    finally { setDestSetting(false); setShowDestMode(false); }
  }, [session?.access_token, destCoords, destAddress]);

  // Disable destination mode
  const handleDisableDest = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const res = await fetch('/api/drivers/destination-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ enabled: false }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Modo destino desactivado');
        setDestAddress('');
        setDestCoords(null);
        if (driver) setDriver({ ...driver, destination_mode: false } as any);
      }
    } catch { /* ignore */ }
  }, [session?.access_token, driver]);

  // ─── Map Loaded Callback ────────────────────────────
  const handleMapLoaded = useCallback((map: any) => {
    mapInstanceRef.current = map;
  }, []);

  // ─── Draw Surge Zones on Map ────────────────────────
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || surgeZones.length === 0) return;

    const cleanup = () => {
      surgeOverlaysRef.current.forEach(o => { try { o.setMap(null); } catch {} });
      surgeOverlaysRef.current = [];
    };
    cleanup();

    loadGoogleMaps().then(() => {
      if (!mapInstanceRef.current) return;

      surgeZones.forEach(zone => {
        const mult = parseFloat(zone.surge_multiplier) || 1;
        if (mult <= 1) return;

        let coords: number[][] = [];
        try {
          const parsed = typeof zone.coordinates === 'string' ? JSON.parse(zone.coordinates) : zone.coordinates;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          coords = parsed.map((c: any) => Array.isArray(c) ? [Number(c[0]), Number(c[1])] : [Number(c.lat), Number(c.lng)]);
        } catch { return; }
        if (coords.length < 3) return;

        const center = {
          lat: coords.reduce((s, c) => s + c[0], 0) / coords.length,
          lng: coords.reduce((s, c) => s + c[1], 0) / coords.length,
        };

        // Color by multiplier intensity (Didi style)
        const color = mult >= 2.5 ? '#ef4444' : mult >= 2.0 ? '#f97316' : mult >= 1.5 ? '#eab308' : '#22c55e';

        // Draw semi-transparent polygon
        const polygon = new google.maps.Polygon({
          paths: coords.map(c => ({ lat: c[0], lng: c[1] })),
          strokeColor: color,
          strokeOpacity: 0.5,
          strokeWeight: 2,
          fillColor: color,
          fillOpacity: 0.12,
          map: mapInstanceRef.current,
          zIndex: 50,
        });
        surgeOverlaysRef.current.push(polygon);

        // Add multiplier label badge
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="28" viewBox="0 0 64 28"><defs><filter id="ds"><feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="#000" flood-opacity="0.4"/></filter></defs><rect rx="14" width="64" height="28" fill="${color}" fill-opacity="0.92" filter="url(#ds)"/><text x="32" y="19" text-anchor="middle" font-size="13" font-weight="bold" fill="#fff" font-family="system-ui,sans-serif">⚡${mult}X</text></svg>`;

        const label = new google.maps.Marker({
          position: center,
          map: mapInstanceRef.current,
          icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
            scaledSize: new google.maps.Size(64, 28),
          },
          zIndex: 100,
          clickable: false,
        });
        surgeOverlaysRef.current.push(label);
      });
    });

    return cleanup;
  }, [surgeZones]);

  return (
    <div className="pb-24">
      {/* ═══ UBER-STYLE FULL MAP ═══ */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative"
      >
        <div className={`${showFullMap ? 'h-[85vh]' : 'h-[340px]'} rounded-b-3xl overflow-hidden relative transition-all duration-500`}>
          <GoogleMap
            center={userCoords || { lat: 9.9281, lng: -84.0907 }}
            zoom={14}
            showUserLocation={true}
            className="w-full h-full"
            onMapLoaded={handleMapLoaded}
          />
          {/* Smooth bottom gradient - taller, more subtle */}
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#0a0e1a] via-[#0a0e1a]/40 to-transparent pointer-events-none" />
        </div>

        {/* ── Floating elements ON the map ── */}

        {/* Online status badge top-left - clean pill with backdrop blur */}
        <div className="absolute top-4 left-4 z-10">
          <div className={`rounded-full px-3 py-1.5 flex items-center gap-2 backdrop-blur-md bg-black/40 border ${isOnline ? 'border-emerald-500/20' : 'border-white/[0.06]'}`}>
            <div className="relative">
              <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-gray-500'}`} />
              {isOnline && (
                <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-400 animate-ping opacity-40" />
              )}
            </div>
            <span className={`text-[11px] font-medium ${isOnline ? 'text-emerald-400' : 'text-gray-400'}`}>
              {isOnline ? 'En linea' : 'Desconectado'}
            </span>
          </div>
        </div>

        {/* Level badge + expand button top-right - compact pill */}
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full backdrop-blur-md bg-black/40 border border-white/[0.06]">
            <level.icon className={`w-3 h-3 ${level.textColor}`} />
            <span className={`text-[10px] font-semibold ${level.textColor}`}>{level.name}</span>
          </div>
          <button
            onClick={() => setShowFullMap(!showFullMap)}
            className="w-8 h-8 rounded-full backdrop-blur-md bg-black/40 border border-white/[0.06] flex items-center justify-center hover:bg-white/10 transition-colors"
          >
            <Eye className="w-3.5 h-3.5 text-gray-300" />
          </button>
        </div>

        {/* ═══ UBER-STYLE GO-ONLINE BUTTON (floating on map) ═══ */}
        <div className="absolute bottom-8 inset-x-4 z-10">
          {/* Surge banner on map (only when online + surge active) */}
          <AnimatePresence>
            {isOnline && surgeZones.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="mb-3"
              >
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {surgeZones.map(zone => {
                    const mult = parseFloat(zone.surge_multiplier) || 1;
                    const bgColor = mult >= 2.5 ? 'bg-red-500' : mult >= 2.0 ? 'bg-orange-500' : mult >= 1.5 ? 'bg-amber-500' : 'bg-emerald-500';
                    return (
                      <div key={zone.id} className={`flex-shrink-0 ${bgColor} rounded-full px-3 py-1.5 flex items-center gap-1.5`} style={{ boxShadow: `0 4px 16px ${mult >= 2.5 ? '#ef444450' : mult >= 2.0 ? '#f9731650' : mult >= 1.5 ? '#eab30850' : '#22c55e50'}` }}>
                        <Zap className="w-3 h-3 text-white" />
                        <span className="text-xs font-bold text-white">{mult}X</span>
                        <span className="text-[10px] text-white/80 hidden sm:inline">{zone.name}</span>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Searching animation (online, no ride) */}
          <AnimatePresence>
            {isOnline && !currentRide && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mb-2 flex items-center justify-center gap-2"
              >
                <div className="flex items-center gap-1">
                  <motion.div className="w-1.5 h-1.5 rounded-full bg-emerald-400" animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0 }} />
                  <motion.div className="w-1.5 h-1.5 rounded-full bg-emerald-400" animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }} />
                  <motion.div className="w-1.5 h-1.5 rounded-full bg-emerald-400" animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }} />
                </div>
                <span className="text-[11px] text-gray-400 font-medium">Buscando viajes...</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* THE UBER-STYLE GO-ONLINE BUTTON */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleToggleOnline}
            disabled={isToggling}
            className={`w-full py-6 rounded-full font-semibold text-[16px] flex items-center justify-center gap-3 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${
              isOnline
                ? 'bg-emerald-500 text-white shadow-[0_8px_32px_rgba(34,197,94,0.3)]'
                : 'bg-[#0a0e1a] text-white shadow-[0_4px_20px_rgba(0,0,0,0.4)] border border-white/[0.08]'
            }`}
          >
            {isToggling ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : isOnline ? (
              <>
                <div className="relative">
                  <div className="w-2.5 h-2.5 rounded-full bg-white/90" />
                  <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-white animate-ping opacity-30" />
                </div>
                Desconectarse
              </>
            ) : (
              <>
                <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
                  <Power className="w-4 h-4 text-white" />
                </div>
                Conectarse
              </>
            )}
          </motion.button>
          {/* Status text below button */}
          <p className="text-center text-[11px] text-gray-500 mt-2.5 font-medium">
            {isOnline ? 'Estas conectado, recibiendo viajes' : 'Conectarse para recibir viajes'}
          </p>
        </div>
      </motion.div>

      {/* ═══ CONTENT BELOW MAP ═══ */}
      <div className="px-4 -mt-1 space-y-3">

        {/* ── UBER-STYLE EARNINGS CARD (minimal, dark) ── */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <div className="rounded-2xl bg-[#111827] border border-white/[0.06] p-5">
            {/* Top row: greeting + rating */}
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-[13px] text-gray-400 font-medium">
                  Hola, {user?.name?.split(' ')[0] || 'Conductor'}
                </p>
              </div>
              <div className="flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded-full">
                <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                <span className="text-[11px] font-semibold text-amber-400">{rating > 0 ? rating.toFixed(2) : '\u2014'}</span>
              </div>
            </div>

            {/* Earnings number */}
            <div>
              <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider mb-0.5">Ganancias de hoy</p>
              <p className="text-[28px] font-bold text-white leading-tight tracking-tight">
                ₡{Math.round(todayEarnings).toLocaleString()}
              </p>
              {/* Daily goal progress bar - thinner, subtle */}
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-gray-500">Objetivo ₡{Math.round(dailyGoal).toLocaleString()}</span>
                  <span className="text-[10px] text-gray-400 font-medium">{Math.round(Math.min((todayEarnings / dailyGoal) * 100, 100))}%</span>
                </div>
                <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((todayEarnings / dailyGoal) * 100, 100)}%` }}
                    transition={{ duration: 1, delay: 0.4 }}
                    className="h-full rounded-full bg-emerald-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── STATS ROW (3 cards - clean, no icon boxes) ── */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="grid grid-cols-3 gap-2.5"
        >
          <div className="rounded-2xl bg-[#111827] border border-white/[0.04] p-3.5 text-center">
            <p className="text-[20px] font-bold text-white">{todayTrips}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">Viajes hoy</p>
          </div>
          <div className="rounded-2xl bg-[#111827] border border-white/[0.04] p-3.5 text-center">
            <p className="text-[20px] font-bold text-white">
              ₡{(driver?.total_earnings || 0) >= 1000000
                ? `${((driver?.total_earnings || 0) / 1000000).toFixed(1)}M`
                : `${Math.round((driver?.total_earnings || 0) / 1000)}k`}
            </p>
            <p className="text-[10px] text-gray-500 mt-0.5">Total ganado</p>
          </div>
          <div className="rounded-2xl bg-[#111827] border border-white/[0.04] p-3.5 text-center">
            <p className="text-[20px] font-bold text-white">{driver?.work_hours_today || 0}h</p>
            <p className="text-[10px] text-gray-500 mt-0.5">Horas hoy</p>
          </div>
        </motion.div>

        {/* ── PROMOTIONAL BANNER (kept as-is) ── */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
        >
          <div className="rounded-2xl overflow-hidden relative bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 p-4 cursor-pointer active:scale-[0.98] transition-transform" onClick={() => router.push('/driver/earnings')}>
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjEpIi8+PC9zdmc+')] opacity-50" />
            <div className="relative flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-white/25 flex items-center justify-center flex-shrink-0">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">Gana mas en hora pico</p>
                <p className="text-[11px] text-white/80 mt-0.5">Conectate en zonas con surge y multiplica tus ganancias</p>
              </div>
              <ChevronRight className="w-5 h-5 text-white/70 flex-shrink-0" />
            </div>
          </div>
        </motion.div>

        {/* ── LEVEL PROGRESS (minimal, simpler) ── */}
        {nextLevel && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="rounded-2xl bg-[#111827] border border-white/[0.04] p-4">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2.5">
                  <nextLevel.icon className={`w-4 h-4 ${nextLevel.textColor}`} />
                  <div>
                    <p className="text-[11px] text-gray-500">Proximo nivel</p>
                    <p className={`text-xs font-semibold ${nextLevel.textColor}`}>{nextLevel.name}</p>
                  </div>
                </div>
                <span className="text-xs text-gray-300 font-medium">{driver?.total_rides || 0} / {nextLevel.minTrips}</span>
              </div>
              <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(progressToNext, 100)}%` }}
                  transition={{ duration: 1, delay: 0.4 }}
                  className={`h-full rounded-full bg-gradient-to-r ${nextLevel.color}`}
                />
              </div>
              <button
                onClick={() => router.push('/driver/rewards')}
                className="mt-3 w-full py-2 rounded-xl bg-white/[0.04] text-[11px] text-gray-400 font-medium hover:bg-white/[0.06] transition-colors flex items-center justify-center gap-1.5"
              >
                <Trophy className="w-3.5 h-3.5 text-gray-500" />
                Ver beneficios del nivel
              </button>
            </div>
          </motion.div>
        )}

        {/* Destination Mode Active */}
        <AnimatePresence>
          {(driver as any)?.destination_mode && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 0 }} className="rounded-2xl bg-cyan-500/[0.08] border border-cyan-500/20 p-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                    <Target className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-cyan-300">Modo Destino Activo</p>
                    <p className="text-[10px] text-gray-500 truncate max-w-[180px]">{(driver as any)?.destination_address || 'Destino configurado'}</p>
                  </div>
                </div>
                <button onClick={handleDisableDest} className="text-[10px] text-red-400 hover:underline shrink-0 px-2 py-1 rounded-lg hover:bg-red-500/10 transition-colors">
                  Desactivar
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Performance Metrics Card - clean, no icon header */}
        {metrics && (
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }} className="rounded-2xl bg-[#111827] border border-white/[0.04] p-4">
            <p className="text-xs font-semibold text-gray-300 mb-3">Tu rendimiento</p>
            <div className="grid grid-cols-4 gap-1.5">
              <div className="rounded-xl bg-white/[0.03] p-2.5 text-center">
                <p className="text-sm font-semibold text-white">{metrics.today.acceptance_rate}%</p>
                <p className="text-[9px] text-gray-500">Aceptacion</p>
              </div>
              <div className="rounded-xl bg-white/[0.03] p-2.5 text-center">
                <p className="text-sm font-semibold text-amber-400">{metrics.today.rating > 0 ? metrics.today.rating : '\u2014'}</p>
                <p className="text-[9px] text-gray-500">Rating hoy</p>
              </div>
              <div className="rounded-xl bg-white/[0.03] p-2.5 text-center">
                <p className="text-sm font-semibold text-white">{metrics.today.avg_duration_min || 0}<span className="text-[9px] text-gray-500">m</span></p>
                <p className="text-[9px] text-gray-500">Prom. viaje</p>
              </div>
              <div className="rounded-xl bg-white/[0.03] p-2.5 text-center">
                <p className="text-sm font-semibold text-white">{metrics.weekly.active_days}</p>
                <p className="text-[9px] text-gray-500">Dias activos</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── QUICK ACTIONS (monochrome icons, subtle cards) ── */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="grid grid-cols-4 gap-2">
          <button onClick={() => router.push('/driver/earnings')} className="rounded-2xl bg-[#111827] border border-white/[0.04] p-3 flex flex-col items-center gap-2 hover:bg-white/[0.04] transition-all active:scale-95">
            <BarChart3 className="w-5 h-5 text-gray-400" />
            <span className="text-[10px] text-gray-400 font-medium">Ganancias</span>
          </button>
          <button onClick={() => router.push('/driver/rides')} className="rounded-2xl bg-[#111827] border border-white/[0.04] p-3 flex flex-col items-center gap-2 hover:bg-white/[0.04] transition-all active:scale-95">
            <Car className="w-5 h-5 text-gray-400" />
            <span className="text-[10px] text-gray-400 font-medium">Viajes</span>
          </button>
          <button onClick={openNavigation} className="rounded-2xl bg-[#111827] border border-white/[0.04] p-3 flex flex-col items-center gap-2 hover:bg-white/[0.04] transition-all active:scale-95">
            <Navigation className="w-5 h-5 text-gray-400" />
            <span className="text-[10px] text-gray-400 font-medium">Navegar</span>
          </button>
          <button
            onClick={() => setShowDestMode(!showDestMode)}
            className={`rounded-2xl bg-[#111827] border border-white/[0.04] p-3 flex flex-col items-center gap-2 hover:bg-white/[0.04] transition-all active:scale-95 ${showDestMode ? 'ring-1 ring-emerald-500/30 bg-emerald-500/[0.04]' : ''}`}
          >
            <Target className={`w-5 h-5 ${showDestMode ? 'text-emerald-400' : 'text-gray-400'}`} />
            <span className={`text-[10px] font-medium ${showDestMode ? 'text-emerald-400' : 'text-gray-400'}`}>Destino</span>
          </button>
        </motion.div>

        {/* Destination Mode Panel */}
        <AnimatePresence>
          {showDestMode && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="rounded-2xl bg-white/[0.04] border border-white/[0.06] p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-semibold text-white">Configurar destino</span>
                </div>
                <p className="text-[10px] text-gray-400">Solo recibiras viajes que vayan en la direccion de tu destino (radio 5km)</p>
                <PlacesAutocomplete
                  value={destAddress}
                  onChange={(val, _pId, lat, lng) => { setDestAddress(val); if (lat && lng) setDestCoords({ lat, lng }); }}
                  placeholder="Ingresa tu destino"
                  dotColor="bg-cyan-400"
                  userLocation={userCoords}
                  searchRadius={30000}
                />
                <div className="flex gap-2">
                  <button onClick={() => setShowDestMode(false)} className="flex-1 py-2.5 rounded-xl bg-white/[0.05] text-gray-300 text-xs font-medium hover:bg-white/[0.08] transition-colors">
                    Cancelar
                  </button>
                  <button onClick={handleSetDestination} disabled={!destAddress || !destCoords || destSetting} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-xs font-medium disabled:opacity-40">
                    {destSetting ? 'Activando...' : 'Activar destino'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── SAFETY BANNER ── */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl bg-emerald-500/[0.06] border border-emerald-500/15 p-3.5"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
              <Shield className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-white">Tu seguridad es primero</p>
              <p className="text-[10px] text-gray-400">Boton SOS disponible en cada viaje activo</p>
            </div>
          </div>
        </motion.div>

        {/* Active Ride - PIN UI Removed as per user request */}
      </div>

      {/* Break Enforcement Modal */}
      <AnimatePresence>
        {showBreakModal && breakUntilTime && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-strong rounded-2xl p-6 max-w-sm w-full text-center"
            >
              <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
                <Coffee className="w-8 h-8 text-amber-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Descanso obligatorio</h3>
              <p className="text-sm text-gray-400 mb-4">
                Por tu seguridad, necesitas completar tu descanso antes de conectarte de nuevo.
              </p>
              <BreakCountdown targetTime={breakUntilTime} />
              <p className="text-[10px] text-gray-500 mt-3">
                El descanso es obligatorio por normativa de seguridad vial
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
