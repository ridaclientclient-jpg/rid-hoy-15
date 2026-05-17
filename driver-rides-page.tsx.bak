'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { supabase, type Driver, type Ride } from '@/lib/supabase';
import { toast } from 'sonner';
import {
  Power, PowerOff, MapPin, Clock, Star, Car, Navigation, AlertTriangle,
  Phone, MessageSquare, CheckCircle2, X as XIcon, ArrowRight,
  ChevronRight, History, User, Loader2, Volume2, VolumeX, Timer,
  DollarSign, Route as RouteIcon, Zap, Calendar, Flame, TrendingUp,
} from 'lucide-react';
import GoogleMap from '@/components/GoogleMap';
import RideChat, { ChatToggleButton } from '@/components/RideChat';
import type { RealtimeChannel } from '@supabase/supabase-js';

const statusLabels: Record<string, string> = {
  assigned: 'Asignado',
  arriving: 'En camino al punto',
  started: 'En viaje',
  completed: 'Completado',
  cancelled: 'Cancelado',
};

const statusColors: Record<string, string> = {
  assigned: 'bg-amber-500/20 text-amber-400',
  arriving: 'bg-blue-500/20 text-blue-400',
  started: 'bg-cyan-500/20 text-cyan-400',
  completed: 'bg-emerald-500/20 text-emerald-400',
  cancelled: 'bg-red-500/20 text-red-400',
};

const statusActions: Record<string, { label: string; nextStatus: string }> = {
  assigned: { label: 'En camino al punto', nextStatus: 'arriving' },
  arriving: { label: 'Iniciar Viaje', nextStatus: 'started' },
  started: { label: 'Completar Viaje', nextStatus: 'completed' },
};

interface IncomingRide {
  id: string;
  rider_id: string;
  rider_name?: string;
  origin: string;
  destination: string;
  origin_lat?: number;
  origin_lng?: number;
  dest_lat?: number;
  dest_lng?: number;
  price: number;
  distance?: number;
  duration?: number;
  ride_type?: string;
  payment_method?: string;
  distance_km?: number;
  surge_multiplier?: number;
}

interface CompletedRide {
  id: string;
  rider_id: string;
  rider_name?: string;
  origin: string;
  destination: string;
  price: number;
  driver_earnings?: number;
  completed_at: string;
  has_rated: boolean;
}

interface SurgeZone {
  id: string;
  name: string;
  multiplier: number;
  reason: string;
  is_active: boolean;
  expires_at: string;
}

interface ScheduledRide {
  id: string;
  origin: string;
  destination: string;
  price: number;
  ride_type?: string;
  scheduled_at: string;
  distance?: number;
}

const ACCEPT_TIMEOUT = 15; // seconds

function playIncomingSound() {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    // Two-tone notification
    [800, 1000, 800, 1000].forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.value = freq;
      gain.gain.value = 0.25;
      osc.start(audioCtx.currentTime + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + i * 0.15 + 0.12);
      osc.stop(audioCtx.currentTime + i * 0.15 + 0.15);
    });
  } catch {}
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function DriverRides() {
  const router = useRouter();
  const { user, session } = useAuthStore();
  const [driver, setDriver] = useState<Driver | null>(null);
  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  const [riderProfile, setRiderProfile] = useState<{ name: string; phone: string; rating: number } | null>(null);
  const [incomingRide, setIncomingRide] = useState<IncomingRide | null>(null);
  const [countdown, setCountdown] = useState(ACCEPT_TIMEOUT);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showMap, setShowMap] = useState(true);
  const [completedRides, setCompletedRides] = useState<CompletedRide[]>([]);
  const [loadingCompleted, setLoadingCompleted] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const searchChannelRef = useRef<RealtimeChannel | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const watchIdRef = useRef<number | null>(null);

  // Feature 4: Surge zones
  const [surgeZones, setSurgeZones] = useState<SurgeZone[]>([]);

  // Feature 5: Scheduled rides + Tab system
  const [scheduledRides, setScheduledRides] = useState<ScheduledRide[]>([]);
  const [loadingScheduled, setLoadingScheduled] = useState(false);
  const [activeTab, setActiveTab] = useState<'current' | 'scheduled'>('current');

  // Fetch driver
  const fetchDriver = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data } = await supabase.from('drivers').select('*').eq('user_id', user.id).single();
      if (data) { setDriver(data); setIsOnline(data.status === 'online' || data.status === 'busy'); }
    } catch (err) { console.error('Error fetching driver:', err); }
  }, [user?.id]);

  // Fetch rider profile
  const fetchRiderProfile = useCallback(async (riderId: string) => {
    try {
      const { data } = await supabase.from('profiles').select('name, phone').eq('id', riderId).single();
      if (data) {
        const { data: reviews } = await supabase.from('reviews').select('rating').eq('reviewee_id', riderId);
        const avg = reviews && reviews.length > 0 ? reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length : 0;
        setRiderProfile({ name: data.name, phone: data.phone || '', rating: Math.round(avg * 10) / 10 });
      }
    } catch {}
  }, []);

  // Fetch active ride
  const fetchActiveRide = useCallback(async () => {
    if (!driver?.id) return;
    try {
      const { data } = await supabase
        .from('rides')
        .select('*')
        .eq('driver_id', driver.id)
        .in('status', ['assigned', 'arriving', 'started'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) { setActiveRide(data); if (data.rider_id) fetchRiderProfile(data.rider_id); }
      else { setActiveRide(null); setRiderProfile(null); }
    } catch (err) { console.error('Error fetching active ride:', err); }
  }, [driver?.id, fetchRiderProfile]);

  // Fetch completed rides
  const fetchCompletedRides = useCallback(async () => {
    if (!driver?.id) return;
    setLoadingCompleted(true);
    try {
      const { data: ridesData } = await supabase
        .from('rides')
        .select('id, rider_id, origin, destination, price, driver_earnings, distance, duration, updated_at')
        .eq('driver_id', driver.id)
        .eq('status', 'completed')
        .order('updated_at', { ascending: false })
        .limit(15);

      if (!ridesData?.length) { setCompletedRides([]); setLoadingCompleted(false); return; }

      const rideIds = ridesData.map((r) => r.id);
      const { data: existingReviews } = await supabase.from('reviews').select('ride_id').eq('reviewer_id', user?.id || '').in('ride_id', rideIds);
      const ratedIds = new Set(existingReviews?.map((r) => r.ride_id) || []);

      const riderIds = [...new Set(ridesData.map((r) => r.rider_id))];
      const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', riderIds);
      const nameMap = new Map(profiles?.map((p: any) => [p.id, p.name]) || []);

      setCompletedRides(ridesData.map((r: any) => ({
        id: r.id, rider_id: r.rider_id, rider_name: nameMap.get(r.rider_id),
        origin: r.origin, destination: r.destination, price: r.price,
        driver_earnings: r.driver_earnings, completed_at: r.updated_at, has_rated: ratedIds.has(r.id),
      })));
    } catch {} finally { setLoadingCompleted(false); }
  }, [driver?.id, user?.id]);

  // Feature 4: Fetch surge zones
  const fetchSurgeZones = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('surge_zones')
        .select('*')
        .eq('is_active', true)
        .gte('expires_at', new Date().toISOString());
      setSurgeZones(data || []);
    } catch { setSurgeZones([]); }
  }, []);

  // Feature 5: Fetch scheduled rides
  const fetchScheduledRides = useCallback(async () => {
    if (!driver?.id) return;
    setLoadingScheduled(true);
    try {
      const { data } = await supabase
        .from('rides')
        .select('*')
        .eq('driver_id', driver.id)
        .eq('status', 'scheduled')
        .order('scheduled_at', { ascending: true });
      setScheduledRides((data || []) as ScheduledRide[]);
    } catch { setScheduledRides([]); }
    finally { setLoadingScheduled(false); }
  }, [driver?.id]);

  // Initial load
  useEffect(() => { fetchDriver(); }, [fetchDriver]);
  useEffect(() => {
    if (driver?.id) { fetchActiveRide(); fetchCompletedRides(); fetchScheduledRides(); }
  }, [driver?.id, fetchActiveRide, fetchCompletedRides, fetchScheduledRides]);

  // Fetch surge zones when online
  useEffect(() => {
    if (!isOnline) { setSurgeZones([]); return; }
    fetchSurgeZones();
    const interval = setInterval(fetchSurgeZones, 30000);
    return () => clearInterval(interval);
  }, [isOnline, fetchSurgeZones]);

  // GPS tracking
  useEffect(() => {
    if (!isOnline || activeRide) return;
    if (!navigator.geolocation) return;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserCoords({ lat: latitude, lng: longitude });
        if (session?.access_token) {
          fetch('/api/drivers/update-location', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ latitude, longitude }),
          }).catch(() => {});
        }
      }, () => {}, { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );
    return () => { if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; } };
  }, [isOnline, activeRide, session?.access_token]);

  // Countdown timer for incoming ride
  useEffect(() => {
    if (!incomingRide) {
      if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
      return;
    }
    setCountdown(ACCEPT_TIMEOUT);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Time expired - auto dismiss
          if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
          setIncomingRide(null);
          handleRejectRide();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; } };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingRide?.id]);

  // Subscribe to rides assigned to this driver (status updates)
  useEffect(() => {
    if (!driver?.id) return;
    const channel = supabase
      .channel(`driver-my-rides-${driver.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rides', filter: `driver_id=eq.${driver.id}` },
        (payload: any) => {
          const ride = payload.new as Ride;
          if (!ride) return;
          if (ride.status === 'assigned' && !activeRide && !incomingRide) {
            if (soundEnabled) playIncomingSound();
            setActiveRide(ride);
            if (ride.rider_id) fetchRiderProfile(ride.rider_id);
          } else if (ride.status === 'completed' || ride.status === 'cancelled') {
            if (activeRide?.id === ride.id) {
              if (ride.status === 'completed') {
                const earnings = ride.driver_earnings || Math.round(ride.price * 0.85);
                toast.success(`Viaje completado! +₡${earnings.toLocaleString()}`);
                router.push(`/driver/ride-summary?rideId=${ride.id}`);
              } else { toast.info('Viaje cancelado'); }
              setActiveRide(null); setRiderProfile(null);
              fetchCompletedRides(); fetchDriver();
            }
          } else if (['assigned', 'arriving', 'started'].includes(ride.status)) {
            setActiveRide(ride);
          }
        }
      )
      .subscribe();
    channelRef.current = channel;
    return () => { if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; } };
  }, [driver?.id, activeRide, incomingRide, fetchRiderProfile, fetchCompletedRides, fetchDriver, router, soundEnabled]);

  // Subscribe to NEW rides in 'searching' status (incoming ride requests)
  useEffect(() => {
    if (!isOnline || activeRide || incomingRide) return;

    const channel = supabase
      .channel(`driver-searching-rides-${Date.now()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rides', filter: `status=eq.searching` },
        async (payload: any) => {
          const ride = payload.new;
          if (!ride || !userCoords) return;

          // Check distance to ride origin
          const distKm = ride.origin_lat && ride.origin_lng
            ? haversineKm(userCoords.lat, userCoords.lng, ride.origin_lat, ride.origin_lng)
            : 999;

          if (distKm > 30) return; // Too far

          // Don't show if already showing this ride
          if (incomingRide?.id === ride.id) return;

          // Fetch rider name
          let riderName = 'Pasajero';
          try {
            const { data: profile } = await supabase.from('profiles').select('name').eq('id', ride.rider_id).single();
            if (profile) riderName = profile.name;
          } catch {}

          setIncomingRide({
            id: ride.id, rider_id: ride.rider_id, rider_name: riderName,
            origin: ride.origin, destination: ride.destination,
            origin_lat: ride.origin_lat, origin_lng: ride.origin_lng,
            dest_lat: ride.dest_lat, dest_lng: ride.dest_lng,
            price: ride.price, distance: ride.distance, duration: ride.duration,
            ride_type: ride.ride_type, payment_method: ride.payment_method,
            distance_km: Math.round(distKm * 10) / 10,
            surge_multiplier: ride.surge_multiplier,
          });

          if (soundEnabled) playIncomingSound();
          toast.success('Nuevo viaje disponible!', { duration: 3000 });
        }
      )
      .subscribe();
    searchChannelRef.current = channel;

    // Also fetch any existing searching rides
    if (userCoords) {
      supabase.from('rides')
        .select('id, rider_id, origin, destination, origin_lat, origin_lng, dest_lat, dest_lng, price, distance, duration, ride_type, payment_method, created_at, surge_multiplier')
        .eq('status', 'searching')
        .gte('created_at', new Date(Date.now() - 60000).toISOString())
        .limit(3)
        .then(async ({ data }) => {
          if (!data?.length || activeRide || incomingRide) return;
          for (const ride of data) {
            if (!ride.origin_lat || !ride.origin_lng) continue;
            const dist = haversineKm(userCoords.lat, userCoords.lng, ride.origin_lat, ride.origin_lng);
            if (dist > 30) continue;
            let riderName = 'Pasajero';
            try {
              const { data: profile } = await supabase.from('profiles').select('name').eq('id', ride.rider_id).single();
              if (profile) riderName = profile.name;
            } catch {}
            setIncomingRide({
              id: ride.id, rider_id: ride.rider_id, rider_name: riderName,
              origin: ride.origin, destination: ride.destination,
              origin_lat: ride.origin_lat, origin_lng: ride.origin_lng,
              dest_lat: ride.dest_lat, dest_lng: ride.dest_lng,
              price: ride.price, distance: ride.distance, duration: ride.duration,
              ride_type: ride.ride_type, payment_method: ride.payment_method,
              distance_km: Math.round(dist * 10) / 10,
              surge_multiplier: ride.surge_multiplier,
            });
            if (soundEnabled) playIncomingSound();
            break; // Show only one at a time
          }
        }).catch(() => {});
    }

    return () => {
      if (searchChannelRef.current) { supabase.removeChannel(searchChannelRef.current); searchChannelRef.current = null; }
    };
  }, [isOnline, activeRide, incomingRide, userCoords, soundEnabled]);

  // Toggle online/offline
  const handleToggleOnline = useCallback(async () => {
    if (!session?.access_token) return;
    setIsToggling(true);
    try {
      const res = await fetch('/api/drivers/toggle-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ status: isOnline ? 'offline' : 'online', latitude: userCoords?.lat, longitude: userCoords?.lng }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsOnline(!isOnline);
        toast.success(isOnline ? 'Fuera de linea' : 'En linea! Recibiras solicitudes.');
        if (!isOnline) fetchDriver();
      } else { toast.error(data.error || 'Error al cambiar estado'); }
    } catch { toast.error('Error de conexion'); }
    finally { setIsToggling(false); }
  }, [isOnline, session?.access_token, userCoords, fetchDriver]);

  // Accept incoming ride
  const handleAcceptRide = useCallback(async () => {
    if (!incomingRide || !session?.access_token) return;
    setIsAccepting(true);
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }

    try {
      const res = await fetch('/api/rides/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ ride_id: incomingRide.id }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        toast.success('Viaje aceptado!');
        setIncomingRide(null);
        // Reload to pick up the active ride via Realtime or manual fetch
        fetchActiveRide();
        fetchDriver();
      } else {
        toast.error(data.message || data.error || 'Viaje no disponible');
        setIncomingRide(null);
      }
    } catch {
      toast.error('Error de conexion');
      setIncomingRide(null);
    } finally { setIsAccepting(false); }
  }, [incomingRide, session?.access_token, fetchActiveRide, fetchDriver]);

  // Reject incoming ride (just dismiss + update counter)
  const handleRejectRide = useCallback(() => {
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    setIncomingRide(null);
    // Update rejected count
    if (driver?.id) {
      supabase.from('drivers').update({ rejected_rides: (driver.rejected_rides || 0) + 1 }).eq('id', driver.id).then(() => fetchDriver()).catch(() => {});
    }
  }, [driver?.id, fetchDriver]);

  // Update ride status
  const handleUpdateStatus = useCallback(async (newStatus: string) => {
    if (!activeRide || !session?.access_token) return;
    setIsUpdating(true);
    try {
      const res = await fetch('/api/rides/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ ride_id: activeRide.id, new_status: newStatus }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const labels: Record<string, string> = { arriving: 'En camino al punto de recogida', started: 'Viaje iniciado!' };
        toast.success(labels[newStatus] || `Estado: ${newStatus}`);
        if (newStatus === 'arriving' || newStatus === 'started') {
          setActiveRide((prev) => prev ? { ...prev, status: newStatus as any } : null);
        }
        if (newStatus === 'completed') {
          const earnings = activeRide.driver_earnings || Math.round(activeRide.price * 0.85);
          toast.success(`Ganaste ₡${earnings.toLocaleString()}!`);
          setTimeout(() => router.push(`/driver/ride-summary?rideId=${activeRide.id}`), 1000);
          setActiveRide(null); setRiderProfile(null); fetchCompletedRides(); fetchDriver();
        }
      } else { toast.error(data.error || 'Error al actualizar estado'); }
    } catch { toast.error('Error de conexion'); }
    finally { setIsUpdating(false); }
  }, [activeRide, session?.access_token, router, fetchCompletedRides, fetchDriver]);

  // Cancel ride
  const handleCancelRide = useCallback(async (reason: string) => {
    if (!activeRide || !session?.access_token) return;
    setShowCancelModal(false);
    try {
      const res = await fetch('/api/rides/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ ride_id: activeRide.id, new_status: 'cancelled' }),
      });
      const data = await res.json();
      if (res.ok && data.success) { toast.info('Viaje cancelado'); setActiveRide(null); setRiderProfile(null); fetchDriver(); }
      else { toast.error(data.error || 'Error al cancelar'); }
    } catch { toast.error('Error de conexion'); }
  }, [activeRide, session?.access_token, fetchDriver]);

  // SOS
  const handleSOS = useCallback(async () => {
    if (!session?.access_token || !activeRide) return;
    if (!window.confirm('Activar alerta de emergencia SOS? Se notificara al administrador.')) return;
    try {
      const res = await fetch('/api/sos/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ ride_id: activeRide.id, latitude: userCoords?.lat || 9.9281, longitude: userCoords?.lng || -84.0907 }),
      });
      const data = await res.json();
      if (res.ok && data.success) toast.error('SOS ACTIVADO - Ayuda en camino!', { duration: 10000 });
      else toast.error(data.error || 'Error al activar SOS');
    } catch { toast.error('Error de conexion - Llama al 911'); }
  }, [session?.access_token, activeRide, userCoords]);

  const handleCall = useCallback(() => {
    if (riderProfile?.phone) window.open(`tel:${riderProfile.phone}`, '_self');
    else toast.info('Telefono no disponible');
  }, [riderProfile]);

  const handleNavigate = useCallback(() => {
    if (!activeRide) return;
    const lat = activeRide.status === 'started' ? activeRide.dest_lat : activeRide.origin_lat;
    const lng = activeRide.status === 'started' ? activeRide.dest_lng : activeRide.origin_lng;
    if (lat && lng) window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
    else window.open(`https://www.google.com/maps/search/${encodeURIComponent((activeRide.status === 'started' ? activeRide.destination : activeRide.origin) + ', Costa Rica')}`, '_blank');
  }, [activeRide]);

  // Map markers
  const mapMarkers: { lat: number; lng: number; label: string; color: string }[] = [];
  const rideToShow = incomingRide || activeRide;
  if (rideToShow?.origin_lat && rideToShow?.origin_lng) mapMarkers.push({ lat: rideToShow.origin_lat, lng: rideToShow.origin_lng, label: 'A', color: '#10b981' });
  if (rideToShow?.dest_lat && rideToShow?.dest_lng) mapMarkers.push({ lat: rideToShow.dest_lat, lng: rideToShow.dest_lng, label: 'B', color: '#ef4444' });
  const showRoute = rideToShow?.origin_lat && rideToShow?.origin_lng && rideToShow?.dest_lat && rideToShow?.dest_lng
    ? { origin: { lat: rideToShow.origin_lat, lng: rideToShow.origin_lng }, destination: { lat: rideToShow.dest_lat, lng: rideToShow.dest_lng } } : undefined;
  const currentAction = activeRide ? statusActions[activeRide.status] : null;
  const countdownProgress = (countdown / ACCEPT_TIMEOUT) * 100;

  // Determine if incoming ride has surge
  const incomingRideHasSurge = incomingRide && incomingRide.surge_multiplier && incomingRide.surge_multiplier > 1;

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {/* Map */}
      <div className="relative shrink-0" style={{ height: showMap ? (incomingRide ? '30%' : '45%') : '0', transition: 'height 0.3s ease' }}>
        {showMap && (
          <GoogleMap markers={mapMarkers} showRoute={showRoute} showDirections={!!showRoute} showUserLocation={true} className="absolute inset-0" height="100%" />
        )}
        <button onClick={() => setShowMap((s) => !s)} className="absolute bottom-3 right-3 z-10 glass-strong rounded-xl px-3 py-2 text-xs text-gray-300 hover:text-white transition-colors flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5" /> {showMap ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Viajes</h1>
            <p className="text-sm text-gray-400 mt-1">{activeRide ? 'Tienes un viaje activo' : incomingRide ? 'Tienes una solicitud!' : isOnline ? 'Buscando solicitudes...' : 'Conectate para recibir viajes'}</p>
          </div>
          <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-2 rounded-xl glass hover:bg-white/5 transition-colors">
            {soundEnabled ? <Volume2 className="w-4 h-4 text-gray-400" /> : <VolumeX className="w-4 h-4 text-gray-500" />}
          </button>
        </motion.div>

        {/* Online Toggle */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <button onClick={handleToggleOnline} disabled={isToggling || !!activeRide || !!incomingRide} className="w-full flex items-center gap-4 glass rounded-2xl p-4 disabled:opacity-50">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${isOnline ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
              {isOnline ? <Power className="w-7 h-7 text-emerald-400" /> : <PowerOff className="w-7 h-7 text-red-400" />}
            </div>
            <div className="text-left flex-1">
              <p className="text-lg font-semibold text-white">{isOnline ? 'En Linea' : 'Fuera de Linea'}</p>
              <p className="text-xs text-gray-400">{activeRide ? 'Viaje activo' : incomingRide ? 'Revisando solicitud...' : isOnline ? 'Recibiendo solicitudes' : 'No recibiras solicitudes'}</p>
            </div>
            {isToggling ? <Loader2 className="w-5 h-5 text-gray-400 animate-spin" /> : (
              <div className={`w-12 h-7 rounded-full transition-colors flex items-center ${isOnline ? 'bg-emerald-500 justify-end' : 'bg-gray-600 justify-start'}`}>
                <motion.div className="w-5 h-5 rounded-full bg-white mx-1" layout transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
              </div>
            )}
          </button>
        </motion.div>

        {/* Feature 4: Surge Pricing Banner */}
        <AnimatePresence>
          {surgeZones.length > 0 && isOnline && !activeRide && !incomingRide && (
            <motion.div
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -10, height: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-gradient-to-r from-orange-500/15 via-red-500/15 to-orange-500/15 border border-orange-500/30 rounded-2xl p-3.5 space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center animate-pulse">
                    <Flame className="w-4.5 h-4.5 text-orange-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-orange-300">Alta demanda en tu zona</p>
                    <p className="text-[10px] text-orange-400/70">Tarifas multiplicadas por demanda</p>
                  </div>
                  <span className="text-xs font-bold text-orange-400 bg-orange-500/20 px-2 py-0.5 rounded-full">
                    {surgeZones.length} {surgeZones.length === 1 ? 'zona' : 'zonas'}
                  </span>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {surgeZones.slice(0, 4).map((zone) => (
                    <div key={zone.id} className="flex-shrink-0 glass rounded-xl px-3 py-2 min-w-[140px]">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <Zap className="w-3 h-3 text-orange-400" />
                        <span className="text-xs font-bold text-orange-300">{zone.multiplier}x</span>
                        <span className="text-[10px] text-gray-400 truncate">{zone.name}</span>
                      </div>
                      {zone.reason && <p className="text-[10px] text-gray-500 truncate">{zone.reason}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active/Incoming rides always show regardless of tab */}
        {/* ==================== INCOMING RIDE (Uber-style) ==================== */}
        <AnimatePresence>
          {incomingRide && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -30 }}
              transition={{ type: 'spring', damping: 20 }}
              className={`glass-strong rounded-2xl overflow-hidden ${incomingRideHasSurge ? 'border-2 border-orange-500/40' : 'border-2 border-emerald-500/40'}`}
            >
              {/* Surge badge */}
              {incomingRideHasSurge && (
                <div className="bg-gradient-to-r from-orange-500/20 to-red-500/20 px-4 py-2 flex items-center gap-2">
                  <Flame className="w-4 h-4 text-orange-400 animate-pulse" />
                  <span className="text-xs font-bold text-orange-300">Tarifa surge {incomingRide.surge_multiplier}x</span>
                  <span className="text-[10px] text-gray-400 ml-auto">Ganancia multiplicada</span>
                </div>
              )}

              {/* Countdown bar */}
              <div className="h-1.5 bg-gray-800">
                <motion.div
                  className={`h-full ${countdown > 5 ? 'bg-emerald-500' : countdown > 3 ? 'bg-amber-500' : 'bg-red-500'}`}
                  initial={{ width: '100%' }}
                  animate={{ width: `${countdownProgress}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>

              <div className="p-5 space-y-4">
                {/* Timer and Price */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${countdown > 5 ? 'bg-emerald-500/20 animate-pulse' : countdown > 3 ? 'bg-amber-500/20 animate-pulse' : 'bg-red-500/20 animate-pulse'}`}>
                      <Timer className={`w-6 h-6 ${countdown > 5 ? 'text-emerald-400' : countdown > 3 ? 'text-amber-400' : 'text-red-400'}`} />
                    </div>
                    <div>
                      <p className={`text-2xl font-bold ${countdown > 5 ? 'text-emerald-400' : countdown > 3 ? 'text-amber-400' : 'text-red-400'}`}>
                        {countdown}s
                      </p>
                      <p className="text-[10px] text-gray-500">Tiempo restante</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-white">₡{incomingRide.price.toLocaleString()}</p>
                    {incomingRide.distance && <p className="text-xs text-gray-400">{incomingRide.distance} km</p>}
                    {incomingRideHasSurge && (
                      <div className="flex items-center gap-1 justify-end mt-0.5">
                        <Flame className="w-3 h-3 text-orange-400" />
                        <span className="text-[10px] font-semibold text-orange-400">+{Math.round((incomingRide.surge_multiplier! - 1) * 100)}% bonus surge</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Rider info */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm">
                    {incomingRide.rider_name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{incomingRide.rider_name || 'Pasajero'}</p>
                    <p className="text-xs text-gray-400">{incomingRide.payment_method === 'cash' ? 'Pago en efectivo' : incomingRide.payment_method === 'wallet' ? 'Pago con billetera' : 'Pago en efectivo'}</p>
                  </div>
                  {incomingRide.distance_km && (
                    <div className="ml-auto text-right">
                      <p className="text-xs text-gray-500">Distancia</p>
                      <p className="text-sm font-medium text-cyan-400">{incomingRide.distance_km} km</p>
                    </div>
                  )}
                </div>

                {/* Route */}
                <div className="space-y-2">
                  <div className="flex items-start gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500">Origen</p>
                      <p className="text-sm text-white">{incomingRide.origin}</p>
                    </div>
                  </div>
                  <div className="border-l border-dashed border-gray-600 ml-1 h-2" />
                  <div className="flex items-start gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500">Destino</p>
                      <p className="text-sm text-white">{incomingRide.destination}</p>
                    </div>
                  </div>
                </div>

                {/* Accept / Reject buttons */}
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={handleRejectRide}
                    className="flex-1 border border-red-500/30 text-red-400 font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-red-500/10 transition-colors text-base"
                  >
                    <XIcon className="w-5 h-5" /> Rechazar
                  </button>
                  <button
                    onClick={handleAcceptRide}
                    disabled={isAccepting}
                    className={`flex-[2] text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50 text-base transition-colors ${incomingRideHasSurge ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}
                    style={{ boxShadow: incomingRideHasSurge ? '0 0 30px rgba(249, 115, 22, 0.4)' : '0 0 30px rgba(16, 185, 129, 0.4)' }}
                  >
                    {isAccepting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                    Aceptar Viaje
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ==================== ACTIVE RIDE ==================== */}
        <AnimatePresence>
          {activeRide && !incomingRide && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="glass-strong rounded-2xl p-5 space-y-4 border border-cyan-500/30 glow-cyan">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-cyan-400">Viaje Activo</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[activeRide.status] || ''}`}>{statusLabels[activeRide.status] || activeRide.status}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white font-bold text-sm">{riderProfile?.name?.charAt(0) || '?'}</div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{riderProfile?.name || 'Pasajero'}</p>
                  <p className="text-xs text-gray-400">{riderProfile?.phone || 'Sin telefono'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={handleCall} className="p-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 transition-colors"><Phone className="w-4 h-4 text-emerald-400" /></button>
                  <button onClick={() => setShowChat(true)} className="p-2 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 transition-colors"><MessageSquare className="w-4 h-4 text-blue-400" /></button>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-start gap-3"><div className="w-2.5 h-2.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" /><div><p className="text-xs text-gray-500">Origen</p><p className="text-sm text-white">{activeRide.origin}</p></div></div>
                <div className="flex items-start gap-3"><div className="w-2.5 h-2.5 rounded-full bg-red-400 mt-1.5 shrink-0" /><div><p className="text-xs text-gray-500">Destino</p><p className="text-sm text-white">{activeRide.destination}</p></div></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="glass rounded-xl p-2 text-center"><p className="text-xs text-gray-500">Precio</p><p className="text-sm font-bold text-white">₡{activeRide.price.toLocaleString()}</p></div>
                <div className="glass rounded-xl p-2 text-center"><p className="text-xs text-gray-500">Distancia</p><p className="text-sm font-bold text-white">{activeRide.distance || 0} km</p></div>
                <div className="glass rounded-xl p-2 text-center"><p className="text-xs text-gray-500">Pasajero</p><p className="text-sm font-bold text-white flex items-center justify-center gap-1"><Star className="w-3 h-3 text-amber-400 fill-amber-400" />{riderProfile?.rating && riderProfile.rating > 0 ? riderProfile.rating.toFixed(1) : '\u2014'}</p></div>
              </div>
              <div className="flex gap-3">
                {currentAction ? (
                  <button onClick={() => handleUpdateStatus(currentAction.nextStatus)} disabled={isUpdating} className="flex-1 bg-emerald-500 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-emerald-600 transition-colors disabled:opacity-50">
                    {isUpdating ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                    {currentAction.label} {currentAction.nextStatus !== 'completed' && <ArrowRight className="w-4 h-4" />}
                  </button>
                ) : null}
                <button onClick={handleSOS} className="bg-red-500/20 border border-red-500/30 text-red-400 font-medium px-4 py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-red-500/30 transition-colors"><AlertTriangle className="w-5 h-5" /></button>
              </div>
              <div className="flex gap-2">
                <button onClick={handleNavigate} className="flex-1 border border-white/10 text-gray-300 font-medium py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-white/5 transition-colors">
                  <Navigation className="w-4 h-4" /> {activeRide.status === 'started' ? 'Navegar al destino' : 'Navegar al origen'}
                </button>
                {(activeRide.status === 'assigned' || activeRide.status === 'arriving') && (
                  <button onClick={() => setShowCancelModal(true)} className="border border-red-500/30 text-red-400 font-medium px-4 py-2.5 rounded-xl hover:bg-red-500/10 transition-colors"><XIcon className="w-4 h-4" /></button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Feature 5: Tab System — only show when no active/incoming ride */}
        {!activeRide && !incomingRide && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }}>
            <div className="flex gap-1 p-1 glass rounded-xl">
              <button
                onClick={() => setActiveTab('current')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === 'current' ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                <Car className="w-3.5 h-3.5" />
                En Curso
              </button>
              <button
                onClick={() => setActiveTab('scheduled')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === 'scheduled' ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                Programados
                {scheduledRides.length > 0 && (
                  <span className="text-[10px] bg-cyan-500/30 text-cyan-300 px-1.5 rounded-full">{scheduledRides.length}</span>
                )}
              </button>
            </div>
          </motion.div>
        )}

        {/* ==================== SCHEDULED RIDES TAB ==================== */}
        {activeTab === 'scheduled' && !activeRide && !incomingRide && (
          <div className="space-y-3">
            {loadingScheduled && <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 text-cyan-400 animate-spin" /></div>}
            {!loadingScheduled && scheduledRides.length === 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-2xl p-8 text-center">
                <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-500 font-medium">No tienes viajes programados</p>
                <p className="text-xs text-gray-600 mt-1">Los viajes agendados por pasajeros aparecen aqui</p>
              </motion.div>
            )}
            {scheduledRides.map((sr) => (
              <motion.div key={sr.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-4 space-y-3 border border-cyan-500/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/15 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                      <p className="text-xs text-cyan-400 font-semibold">
                        {new Date(sr.scheduled_at).toLocaleDateString('es-CR', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </p>
                      <p className="text-sm font-bold text-white">
                        {new Date(sr.scheduled_at).toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit', hour12: true })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-bold text-emerald-400">₡{sr.price.toLocaleString()}</span>
                    {sr.ride_type && <p className="text-[10px] text-gray-500">{sr.ride_type}</p>}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-start gap-2.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                    <p className="text-xs text-gray-300 truncate">{sr.origin}</p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <div className="w-2 h-2 rounded-full bg-red-400 mt-1.5 shrink-0" />
                    <p className="text-xs text-gray-300 truncate">{sr.destination}</p>
                  </div>
                </div>
                {sr.distance && (
                  <div className="flex items-center gap-3 pt-1 border-t border-white/5">
                    <span className="text-[10px] text-gray-500 flex items-center gap-1"><RouteIcon className="w-3 h-3" />{sr.distance} km</span>
                    <span className="text-[10px] text-gray-500 flex items-center gap-1"><DollarSign className="w-3 h-3" />₡{Math.round(sr.price / (sr.distance || 1))}/km</span>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}

        {/* ==================== CURRENT TAB CONTENT ==================== */}
        {activeTab === 'current' && !activeRide && !incomingRide && (
          <>
            {/* Waiting state */}
            {isOnline && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-2xl p-8 text-center">
                <div className="relative inline-block mb-4">
                  <Car className="w-14 h-14 text-cyan-500/30 mx-auto" />
                  <div className="absolute inset-0 flex items-center justify-center"><div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" /></div>
                </div>
                <p className="text-sm text-gray-400 font-medium">Esperando solicitudes de viaje</p>
                <p className="text-xs text-gray-600 mt-1">Cuando un pasajero solicite un viaje cerca de tu ubicacion, aparecer aqui con un temporizador para que aceptes o rechaces</p>
              </motion.div>
            )}

            {!isOnline && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-2xl p-8 text-center">
                <PowerOff className="w-14 h-14 text-gray-600 mx-auto mb-4" />
                <p className="text-sm text-gray-500 font-medium">Conectate para recibir solicitudes</p>
              </motion.div>
            )}

            {/* Completed rides */}
            <div className="mt-4">
              <h2 className="text-sm font-semibold text-gray-400 flex items-center gap-2 mb-3"><History className="w-4 h-4" />Viajes completados</h2>
              {loadingCompleted && <div className="flex items-center justify-center py-4"><Loader2 className="w-6 h-6 text-emerald-500 animate-spin" /></div>}
              {!loadingCompleted && completedRides.length === 0 && (
                <div className="glass rounded-2xl p-6 text-center"><Car className="w-10 h-10 text-gray-600 mx-auto mb-2" /><p className="text-xs text-gray-500">No tienes viajes completados aun</p></div>
              )}
              {completedRides.map((cr) => (
                <motion.div key={cr.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-4 space-y-2 mb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center text-white text-xs font-bold">{cr.rider_name?.charAt(0) || <User className="w-3.5 h-3.5" />}</div>
                      <div><p className="text-sm font-medium text-white">{cr.rider_name || 'Pasajero'}</p><p className="text-[10px] text-gray-500">{new Date(cr.completed_at).toLocaleDateString('es-CR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}</p></div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-emerald-400">₡{cr.price.toLocaleString()}</span>
                      {cr.driver_earnings && <p className="text-[10px] text-gray-500">Ganaste: ₡{cr.driver_earnings.toLocaleString()}</p>}
                    </div>
                  </div>
                  <div className="flex items-start gap-2 text-xs text-gray-400"><MapPin className="w-3 h-3 mt-0.5 shrink-0 text-emerald-400" /><span className="truncate">{cr.origin} → {cr.destination}</span></div>
                  <div className="flex items-center justify-between pt-1">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${cr.has_rated ? 'bg-gray-500/20 text-gray-400' : 'bg-amber-500/20 text-amber-400'}`}>{cr.has_rated ? 'Calificado' : 'Sin calificar'}</span>
                    {!cr.has_rated && (
                      <button onClick={() => router.push(`/driver/ride-rating?rideId=${cr.id}`)} className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300"><Star className="w-3.5 h-3.5" />Calificar<ChevronRight className="w-3 h-3" /></button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Cancel Modal */}
      <AnimatePresence>
        {showCancelModal && (
          <>
            <motion.div className="fixed inset-0 bg-black/60 z-[60]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCancelModal(false)} />
            <motion.div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-[#0d1117] border-t border-white/10 rounded-t-3xl p-6 z-[70]" initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }} transition={{ type: 'spring', damping: 25 }}>
              <div className="w-10 h-1 rounded-full bg-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-white mb-4">Cancelar Viaje</h3>
              {['Pasajero no se presento', 'No puedo llegar al punto', 'Pasajero no responde', 'Problema con el vehiculo', 'Trafico severo', 'Otro motivo'].map((reason) => (
                <button key={reason} onClick={() => handleCancelRide(reason)} className="w-full text-left px-4 py-3 rounded-xl glass hover:bg-white/5 text-sm text-gray-300 transition-colors">{reason}</button>
              ))}
              <button onClick={() => setShowCancelModal(false)} className="w-full mt-3 py-3 rounded-xl text-sm text-gray-400">Volver</button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Ride Chat */}
      {activeRide && activeRide.status !== 'completed' && (
        <>
          <div className="fixed bottom-20 right-3 z-40"><ChatToggleButton onClick={() => setShowChat(!showChat)} /></div>
          <RideChat rideId={activeRide.id} currentUserRole='driver' currentUserId={user?.id || ''} otherUserName={riderProfile?.name || 'Pasajero'} isOpen={showChat} onClose={() => setShowChat(false)} />
        </>
      )}
    </div>
  );
}
