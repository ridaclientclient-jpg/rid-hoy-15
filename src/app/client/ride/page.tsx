'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Navigation, Clock, Star, Phone, MessageSquare, Shield, AlertTriangle, X, Check, Car, Search, Bike, Truck, Package, Plus, CircleDot, Crosshair, Loader2, ChevronRight, FileText, Banknote, Wallet, CreditCard, Smartphone, MapPin, CheckCircle, Calendar, Info, Home, Briefcase, Dumbbell, UtensilsCrossed, ShoppingBag, GraduationCap, Heart, Tag } from 'lucide-react';
import { useRideStore } from '@/store/rideStore';
import { useAuthStore } from '@/store/authStore';
import { useFavoritePlacesStore } from '@/store/favoritePlacesStore';
import { toast } from 'sonner';
import PaymentMethodSelector, { getPaymentLabel, getPaymentIcon, type PaymentMethod } from '@/components/PaymentMethodSelector';
import GoogleMap, { type DraggablePinData } from '@/components/GoogleMap';
import PlacesAutocomplete from '@/components/PlacesAutocomplete';
import DraggableBottomSheet from '@/components/DraggableBottomSheet';
import { reverseGeocode } from '@/lib/googleMaps';
import { supabase } from '@/lib/supabase';
import RideChat, { ChatToggleButton } from '@/components/RideChat';
import SmartDestinations from '@/components/SmartDestinations';
import { RiderPreferences } from '@/components/RiderPreferences';
import FareCompare from '@/components/FareCompare';

interface CoordData {
  lat: number;
  lng: number;
}

interface Stop {
  id: string;
  address: string;
  coords: CoordData | null;
}

const STOP_LABELS = ['C', 'D', 'E', 'F', 'G', 'H'];
const STOP_COLORS = ['#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1'];

export default function ClientRide() {
  const router = useRouter();
  const { currentRide, createRide, cancelRide, completeRide, isCreating } = useRideStore();
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [originCoords, setOriginCoords] = useState<CoordData | null>(null);
  const [destCoords, setDestCoords] = useState<CoordData | null>(null);
  const [rideType, setRideType] = useState<string>('standard');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentExtra, setPaymentExtra] = useState<{ cardLastFour?: string; sinpePhone?: string }>({});
  const [showThirdParty, setShowThirdParty] = useState(false);
  const [stops, setStops] = useState<Stop[]>([]);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [userGPS, setUserGPS] = useState<{ lat: number; lng: number } | null>(null);
  const userGPSRef = useRef<{ lat: number; lng: number } | null>(null);
  const [showChat, setShowChat] = useState(false);

  // ─── Match Retry ─────────────────────────────────
  const [searchStartTime, setSearchStartTime] = useState<number | null>(null);
  const [matchRetries, setMatchRetries] = useState(0);
  const [retryingMatch, setRetryingMatch] = useState(false);

  useEffect(() => {
    if (currentRide?.status === 'searching' && !searchStartTime) {
      setSearchStartTime(Date.now());
    }
    if (currentRide?.status !== 'searching') {
      setSearchStartTime(null);
      setMatchRetries(0);
    }
  }, [currentRide?.status, searchStartTime]);

  // ─── Fare Estimate ─────────────────────────────────
  const [fareEstimate, setFareEstimate] = useState<{price: number; distance: number; duration: number; eta: number} | null>(null);
  const [fareLoading, setFareLoading] = useState(false);
  const [fareComparisons, setFareComparisons] = useState<Record<string, {price: number; priceFormatted: string; eta_min: number; duration: number}> | null>(null);

  useEffect(() => {
    if (originCoords && destCoords && !currentRide) {
      let cancelled = false;
      const timer = setTimeout(async () => {
        setFareLoading(true);
        try {
          // Fetch all ride type fares at once
          const res = await fetch(`/api/rides/compare-fare?originLat=${originCoords.lat}&originLng=${originCoords.lng}&destLat=${destCoords.lat}&destLng=${destCoords.lng}`);
          const data = await res.json();
          if (!cancelled && data.success && data.comparisons) {
            const compMap: Record<string, {price: number; priceFormatted: string; eta_min: number; duration: number}> = {};
            for (const comp of data.comparisons) {
              compMap[comp.type] = comp;
            }
            setFareComparisons(compMap);
            // Also set fareEstimate for the selected ride type
            const selected = compMap[rideType];
            if (selected) {
              setFareEstimate({
                price: selected.price,
                distance: 0,
                duration: selected.duration,
                eta: selected.eta_min,
              });
            }
          }
        } catch { /* ignore */ }
        if (!cancelled) setFareLoading(false);
      }, 500);
      return () => { cancelled = true; clearTimeout(timer); };
    } else if (!originCoords || !destCoords) {
      setFareEstimate(null);
      setFareComparisons(null);
    }
  }, [originCoords, destCoords, currentRide]);

  // Update fareEstimate when rideType changes (from cached comparisons)
  useEffect(() => {
    if (fareComparisons && fareComparisons[rideType]) {
      const sel = fareComparisons[rideType];
      setFareEstimate({
        price: sel.price,
        distance: 0,
        duration: sel.duration,
        eta: sel.eta_min,
      });
    }
  }, [rideType, fareComparisons]);

  // ─── Cancel with Fee ─────────────────────────────────
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelReasons] = useState([
    'Conductor no llega', 'Tiempo de espera largo',
    'Equivoque la direccion', 'Encontre otro transporte',
    'Precio muy alto', 'Otro',
  ]);
  const [isCancelling, setIsCancelling] = useState(false);

  const handleCancelWithFee = async () => {
    if (!currentRide) return;
    setIsCancelling(true);
    try {
      await cancelRide(currentRide.id, cancelReason || undefined);
      toast.success('Viaje cancelado');
      setShowCancelDialog(false);
      setCancelReason('');
    } catch (err: any) {
      toast.error(err?.message || 'Error al cancelar');
    } finally {
      setIsCancelling(false);
    }
  };

  // ─── Share Trip ─────────────────────────────────
  const [shareLoading, setShareLoading] = useState(false);
  const handleShareTrip = async () => {
    if (!currentRide || !session?.access_token) {
      toast.error('No se puede compartir en este momento');
      return;
    }
    setShareLoading(true);
    try {
      const res = await fetch('/api/rides/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ ride_id: currentRide.id }),
      });
      const data = await res.json();
      if (data.success) {
        if (navigator.share) {
          await navigator.share({ title: 'Compartir viaje RIDA', url: data.share_url });
        } else {
          await navigator.clipboard.writeText(data.share_url);
          toast.success('Enlace copiado al portapapeles');
        }
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        await navigator.clipboard.writeText(`${window.location.origin}/client/ride/${currentRide.id}`);
        toast.success('Enlace copiado');
      }
    } finally {
      setShareLoading(false);
    }
  };

  // ─── Promo Code ─────────────────────────────────
  const [promoCode, setPromoCode] = useState('');
  const [promoDiscount, setPromoDiscount] = useState<number>(0);
  const [promoValidating, setPromoValidating] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{
    id: string;
    code: string;
    discount_type: string;
    discount_value: number;
    max_discount: number | null;
  } | null>(null);

  const validatePromoCode = async () => {
    const trimmedCode = promoCode.trim().toUpperCase();
    if (!trimmedCode) {
      setPromoError('Ingresa un codigo de promocion');
      return;
    }

    setPromoValidating(true);
    setPromoError('');
    setPromoDiscount(0);
    setAppliedPromo(null);

    try {
      const { data: promo, error } = await supabase
        .from('promo_codes')
        .select('*')
        .eq('code', trimmedCode)
        .eq('is_active', true)
        .single();

      if (error || !promo) {
        setPromoError('Codigo de promocion no valido');
        return;
      }

      // Check date validity
      const now = new Date();
      const validFrom = new Date(promo.valid_from);
      const validUntil = new Date(promo.valid_until);
      if (now < validFrom || now > validUntil) {
        setPromoError('Este codigo ha expirado o aun no esta vigente');
        return;
      }

      // Check usage limit
      if (promo.usage_limit !== null && promo.times_used >= promo.usage_limit) {
        setPromoError('Este codigo ya alcanzo su limite de usos');
        return;
      }

      // Check min ride amount against REAL fare estimate
      const ridePrice = fareEstimate?.price || 0;
      if (promo.min_ride_amount && ridePrice < promo.min_ride_amount) {
        setPromoError(`El monto minimo del viaje es ₡${promo.min_ride_amount.toLocaleString()}`);
        return;
      }

      // Calculate discount based on real fare estimate price
      let discount = 0;
      if (promo.discount_type === 'percentage') {
        discount = Math.round(ridePrice * promo.discount_value / 100);
        if (promo.max_discount && discount > promo.max_discount) {
          discount = promo.max_discount;
        }
      } else {
        // fixed
        discount = promo.discount_value;
        if (promo.max_discount) {
          discount = Math.min(discount, promo.max_discount);
        }
      }

      // Ensure discount doesn't exceed the ride price
      if (discount > ridePrice && ridePrice > 0) {
        discount = ridePrice;
      }

      setPromoDiscount(discount);
      setAppliedPromo({
        id: promo.id,
        code: promo.code,
        discount_type: promo.discount_type,
        discount_value: promo.discount_value,
        max_discount: promo.max_discount,
      });
      toast.success(`Descuento de ₡${discount.toLocaleString()} aplicado!`);
    } catch {
      setPromoError('Error al validar el codigo. Intenta de nuevo.');
    } finally {
      setPromoValidating(false);
    }
  };

  const removePromo = () => {
    setPromoCode('');
    setPromoDiscount(0);
    setPromoError('');
    setAppliedPromo(null);
  };

  const recordPromoUsage = async (rideId: string) => {
    if (!appliedPromo) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      // Increment times_used
      await supabase.rpc('increment_times_used', { promo_id: appliedPromo.id }).catch(() => {
        // Fallback: manual increment
        supabase.from('promo_codes').select('times_used').eq('id', appliedPromo.id).single().then(({ data }) => {
          if (data) {
            supabase.from('promo_codes').update({ times_used: (data.times_used || 0) + 1 }).eq('id', appliedPromo.id);
          }
        });
      });
      // Insert usage record
      await supabase.from('promo_code_usage').insert({
        promo_code_id: appliedPromo.id,
        user_id: user?.id,
        ride_id: rideId,
        used_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Failed to record promo usage:', err);
    }
  };

  // ─── Drag Pin Precision Mode ─────────────────────────────────
  const [dragTarget, setDragTarget] = useState<'origin' | 'destination' | null>(null);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);

  // ─── Schedule Mode ─────────────────────────────────
  const searchParams = useSearchParams();
  const isScheduleMode = searchParams.get('mode') === 'schedule';
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');

  // ─── Favorite Places ─────────────────────────────────
  const { user, session } = useAuthStore();
  const { places, fetchPlaces, prefill, prefillTarget, clearPrefill } = useFavoritePlacesStore();
  const [showFavorites, setShowFavorites] = useState(false);
  const [favTarget, setFavTarget] = useState<'origin' | 'destination'>('origin');

  // Fetch favorite places when user is available
  useEffect(() => {
    if (user?.id) fetchPlaces(user.id);
  }, [user?.id, fetchPlaces]);

  // Handle prefill from store on mount
  useEffect(() => {
    if (prefill && prefillTarget) {
      if (prefillTarget === 'origin') {
        setOrigin(prefill.address);
        if (prefill.lat != null && prefill.lng != null) {
          setOriginCoords({ lat: prefill.lat, lng: prefill.lng });
        }
      } else {
        setDestination(prefill.address);
        if (prefill.lat != null && prefill.lng != null) {
          setDestCoords({ lat: prefill.lat, lng: prefill.lng });
        }
      }
      clearPrefill();
    }
  }, []);

  const FAV_ICONS: Record<string, any> = {
    home: Home, work: Briefcase, favorite: Heart, gym: Dumbbell,
    restaurant: UtensilsCrossed, shopping: ShoppingBag, school: GraduationCap, other: Star
  };

  // Compute the draggable pin data based on dragTarget
  const draggablePin: DraggablePinData | null = (() => {
    if (dragTarget === 'origin' && originCoords) {
      return { position: originCoords, color: '#10b981', label: 'A', title: 'Arrastra para ajustar punto de partida' };
    }
    if (dragTarget === 'destination' && destCoords) {
      return { position: destCoords, color: '#ef4444', label: 'B', title: 'Arrastra para ajustar destino' };
    }
    return null;
  })();

  // Handle pin drag end — reverse geocode and update address
  const handleDragPinEnd = useCallback(async (lat: number, lng: number) => {
    setIsReverseGeocoding(true);
    try {
      const address = await reverseGeocode(lat, lng);
      const displayAddress = address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

      if (dragTarget === 'origin') {
        setOrigin(displayAddress);
        setOriginCoords({ lat, lng });
        toast.success('Punto de partida ajustado');
      } else if (dragTarget === 'destination') {
        setDestination(displayAddress);
        setDestCoords({ lat, lng });
        toast.success('Destino ajustado');
      }
    } catch {
      toast.error('No se pudo obtener la direccion en esta posicion');
    } finally {
      setIsReverseGeocoding(false);
    }
  }, [dragTarget]);

  // Capture user GPS from map and keep it synced
  const handleMapUserLocation = useCallback((location: { lat: number; lng: number } | null) => {
    if (location) {
      setUserGPS(location);
      userGPSRef.current = location;
    }
  }, []);

  const handleOriginChange = (val: string, _placeId?: string, lat?: number, lng?: number) => {
    setOrigin(val);
    if (lat !== undefined && lng !== undefined) {
      setOriginCoords({ lat, lng });
    }
  };

  const handleDestinationChange = (val: string, _placeId?: string, lat?: number, lng?: number) => {
    setDestination(val);
    if (lat !== undefined && lng !== undefined) {
      setDestCoords({ lat, lng });
    }
  };

  // Use my location as origin
  const useMyLocation = async () => {
    if (!navigator.geolocation) {
      toast.error('GPS no disponible en este dispositivo');
      return;
    }
    setGettingLocation(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true, timeout: 15000, maximumAge: 60000
        });
      });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const address = await reverseGeocode(lat, lng);
      const displayAddress = address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      setOrigin(displayAddress);
      setOriginCoords({ lat, lng });
      toast.success('Ubicacion actual establecida');
    } catch {
      toast.error('No se pudo obtener tu ubicacion. Verifica que el GPS este habilitado.');
    } finally {
      setGettingLocation(false);
    }
  };

  // Add a new intermediate stop
  const addStop = () => {
    if (stops.length >= 6) {
      toast.error('Maximo 6 paradas intermedias');
      return;
    }
    setStops([...stops, { id: 'stop-' + Date.now(), address: '', coords: null }]);
  };

  // Update a stop's address and coords
  const updateStop = (stopId: string, address: string, _placeId?: string, lat?: number, lng?: number) => {
    setStops(stops.map(s => {
      if (s.id === stopId) {
        return {
          ...s,
          address,
          coords: lat !== undefined && lng !== undefined ? { lat, lng } : null,
        };
      }
      return s;
    }));
  };

  // Remove a stop
  const removeStop = (stopId: string) => {
    setStops(stops.filter(s => s.id !== stopId));
  };

  // Build marker array for the map — use currentRide data when active, local state when filling form
  const mapMarkers: { lat: number; lng: number; label: string; color: string }[] = [];
  const activeRideOrigin = currentRide?.origin_lat && currentRide?.origin_lng
    ? { lat: currentRide.origin_lat, lng: currentRide.origin_lng }
    : null;
  const activeRideDest = currentRide?.dest_lat && currentRide?.dest_lng
    ? { lat: currentRide.dest_lat, lng: currentRide.dest_lng }
    : null;
  const activeWaypoints = (currentRide?.stops || [])
    .filter((s: any) => s.lat && s.lng)
    .map((s: any) => ({ lat: s.lat, lng: s.lng }));

  const mapOrigin = currentRide ? activeRideOrigin : originCoords;
  const mapDest = currentRide ? activeRideDest : destCoords;
  const mapWaypoints = currentRide ? activeWaypoints : stops.filter(s => s.coords).map(s => ({ lat: s.coords!.lat, lng: s.coords!.lng }));

  if (mapOrigin) mapMarkers.push({ ...mapOrigin, label: 'A', color: '#10b981' });
  if (currentRide) {
    (currentRide.stops || []).forEach((stop: any, i: number) => {
      if (stop.lat && stop.lng) {
        mapMarkers.push({ lat: stop.lat, lng: stop.lng, label: STOP_LABELS[i], color: STOP_COLORS[i] });
      }
    });
  } else {
    stops.forEach((stop, i) => {
      if (stop.coords) {
        mapMarkers.push({ ...stop.coords, label: STOP_LABELS[i], color: STOP_COLORS[i] });
      }
    });
  }
  if (mapDest) mapMarkers.push({ ...mapDest, label: 'B', color: '#ef4444' });

  // ─── Schedule Helpers ─────────────────────────────────
  const getTodayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
  };

  const getMinTime = (date: string) => {
    if (date !== getTodayStr()) return undefined;
    const d = new Date();
    d.setMinutes(d.getMinutes() + 30);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const getQuickTimes = (date: string) => {
    const now = new Date();
    const baseTimes = ['06:00','06:30','07:00','07:30','08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30','19:00','19:30','20:00','20:30','21:00','21:30','22:00'];
    if (date !== getTodayStr()) return baseTimes;
    const minMinutes = now.getHours() * 60 + now.getMinutes() + 30;
    return baseTimes.filter(t => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m >= minMinutes;
    });
  };

  const handleRetryMatch = async () => {
    if (!currentRide || currentRide.status !== 'searching' || !session?.access_token) return;
    setRetryingMatch(true);
    try {
      const newRetry = matchRetries + 1;
      const expandedRadius = 5 + (newRetry * 3); // Start at 5km, expand by 3km each retry
      const res = await fetch('/api/rides/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ ride_id: currentRide.id, radius_km: expandedRadius }),
      });
      const data = await res.json();
      if (data.success) {
        setMatchRetries(newRetry);
        toast.success(`Buscando en radio de ${expandedRadius}km... (intento ${newRetry})`);
      } else {
        toast.error(data.error || 'Error al ampliar busqueda');
      }
    } catch (err: any) {
      toast.error('Error de conexion al ampliar busqueda');
    } finally {
      setRetryingMatch(false);
    }
  };

  const handleCreateRide = async () => {
    if (!origin || !destination) {
      toast.error('Selecciona origen y destino');
      return;
    }
    if (origin === destination) {
      toast.error('Origen y destino no pueden ser iguales');
      return;
    }
    // Check that all stops have addresses
    const emptyStop = stops.find(s => !s.address);
    if (emptyStop) {
      toast.error('Completa todas las paradas intermedias o eliminalas');
      return;
    }

    const stopsData = stops.map(s => ({
      address: s.address,
      lat: s.coords?.lat,
      lng: s.coords?.lng,
    }));

    try {
      const rideId = await createRide(
        origin, destination,
        originCoords?.lat, originCoords?.lng,
        destCoords?.lat, destCoords?.lng,
        rideType, stopsData,
        paymentMethod, paymentExtra
      );
      if (rideId) {
        toast.success('Viaje creado! Buscando conductor...');
        // Show third party popup after a delay
        setTimeout(() => setShowThirdParty(true), 2000);
        // Record promo code usage if applied
        if (appliedPromo) {
          await recordPromoUsage(rideId);
          removePromo();
        }
      } else {
        toast.error('No se pudo crear el viaje. Intenta de nuevo.');
      }
    } catch (error: any) {
      console.error('Ride creation failed:', error);
      toast.error('Error al crear viaje: ' + (error?.message || 'Intenta de nuevo'));
    }
  };

  const handleScheduleRide = async () => {
    if (!scheduleDate || !scheduleTime) {
      toast.error('Selecciona fecha y hora para programar');
      return;
    }
    const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}:00`);
    const minTime = new Date(Date.now() + 30 * 60000);
    if (scheduledAt < minTime) {
      toast.error('El viaje debe programarse con al menos 30 minutos de anticipacion');
      return;
    }
    if (!origin || !destination) {
      toast.error('Selecciona origen y destino');
      return;
    }
    if (origin === destination) {
      toast.error('Origen y destino no pueden ser iguales');
      return;
    }
    const emptyStop = stops.find(s => !s.address);
    if (emptyStop) {
      toast.error('Completa todas las paradas intermedias o eliminalas');
      return;
    }

    const stopsData = stops.map(s => ({
      address: s.address,
      lat: s.coords?.lat,
      lng: s.coords?.lng,
    }));

    try {
      const rideId = await createRide(
        origin, destination,
        originCoords?.lat, originCoords?.lng,
        destCoords?.lat, destCoords?.lng,
        rideType, stopsData,
        paymentMethod, paymentExtra,
        scheduledAt.toISOString()
      );
      if (rideId) {
        toast.success('Viaje programado correctamente!');
        // Record promo code usage if applied
        if (appliedPromo) {
          await recordPromoUsage(rideId);
          removePromo();
        }
        router.push('/client');
      } else {
        toast.error('No se pudo programar el viaje. Intenta de nuevo.');
      }
    } catch (error: any) {
      console.error('Schedule ride failed:', error);
      toast.error('Error al programar viaje: ' + (error?.message || 'Intenta de nuevo'));
    }
  };

  const rideTypes = [
    { id: 'standard', name: 'Economico', price: fareComparisons?.standard?.priceFormatted ?? '---', time: fareComparisons?.standard ? `${fareComparisons.standard.eta_min} min` : '---', desc: '4 pasajeros', icon: Car, color: 'from-blue-600 to-cyan-500' },
    { id: 'premium', name: 'Premium', price: fareComparisons?.premium?.priceFormatted ?? '---', time: fareComparisons?.premium ? `${fareComparisons.premium.eta_min} min` : '---', desc: '4 pasajeros', icon: Car, color: 'from-purple-600 to-pink-500' },
    { id: 'suv', name: 'SUV', price: fareComparisons?.suv?.priceFormatted ?? '---', time: fareComparisons?.suv ? `${fareComparisons.suv.eta_min} min` : '---', desc: '6 pasajeros', icon: Car, color: 'from-amber-600 to-orange-500' },
    { id: 'moto', name: 'Moto', price: fareComparisons?.moto?.priceFormatted ?? '---', time: fareComparisons?.moto ? `${fareComparisons.moto.eta_min} min` : '---', desc: '1 pasajero', icon: Bike, color: 'from-green-600 to-emerald-500' },
    { id: 'moto_express', name: 'Moto Express', price: fareComparisons?.express?.priceFormatted ?? '---', time: fareComparisons?.express ? `${fareComparisons.express.eta_min} min` : '---', desc: '1 pasajero - Envios', icon: Bike, color: 'from-red-600 to-rose-500' },
    { id: 'grua', name: 'Grua', price: fareComparisons?.xl?.priceFormatted ?? '---', time: fareComparisons?.xl ? `${fareComparisons.xl.eta_min} min` : '---', desc: 'Servicio de grua', icon: Truck, color: 'from-yellow-600 to-amber-500' },
    { id: 'flete', name: 'Carro de Carga (Flete)', price: fareComparisons?.comfort?.priceFormatted ?? '---', time: fareComparisons?.comfort ? `${fareComparisons.comfort.eta_min} min` : '---', desc: 'Carga pesada', icon: Package, color: 'from-indigo-600 to-violet-500' },
  ];

  return (
    <div className="relative h-[calc(100vh-120px)] flex flex-col overflow-hidden">
      {/* Google Map Area — full screen behind the sheet */}
      <div className="absolute inset-0">
        <GoogleMap
          center={mapOrigin && mapDest ? mapOrigin : undefined}
          zoom={mapOrigin && mapDest ? 13 : undefined}
          markers={mapMarkers}
          waypoints={mapWaypoints.length > 0 ? mapWaypoints : undefined}
          showRoute={
            mapOrigin && mapDest && !draggablePin
              ? { origin: mapOrigin, destination: mapDest }
              : undefined
          }
          showDirections={!!(mapOrigin && mapDest) && !draggablePin}
          showUserLocation={true}
          onUserLocation={handleMapUserLocation}
          draggablePin={draggablePin}
          onDragPinEnd={handleDragPinEnd}
          className="absolute inset-0"
          height="100%"
        />
      </div>

      {/* Ride Panel — Draggable Bottom Sheet */}
      <DraggableBottomSheet
        initialSnap="peek"
        minHeight={140}
        className="glass-strong rounded-t-3xl"
      >
        <div className="p-5 space-y-4">
        {!currentRide ? (
          <>
            {/* Location Inputs */}
            <div className="space-y-2">
              {/* Use My Location Button */}
              <button
                onClick={useMyLocation}
                disabled={gettingLocation}
                className="w-full flex items-center gap-2.5 p-2.5 rounded-xl glass hover:bg-white/10 transition-all text-left disabled:opacity-50"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
                  {gettingLocation ? (
                    <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                  ) : (
                    <Crosshair className="w-4 h-4 text-emerald-400" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-emerald-400">
                    {gettingLocation ? 'Obteniendo ubicacion...' : 'Mi ubicacion'}
                  </p>
                  <p className="text-[10px] text-white">Usar posicion actual como punto de partida</p>
                </div>
              </button>

              {/* Mis Lugares Toggle */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowFavorites(!showFavorites)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    showFavorites
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                      : 'bg-white/5 text-white hover:text-cyan-400 hover:bg-white/10 border border-white/5'
                  }`}
                >
                  <Star className={`w-3.5 h-3.5 ${showFavorites ? 'fill-cyan-400' : ''}`} />
                  Mis lugares
                </button>
                {showFavorites && (
                  <div className="flex items-center gap-1 ml-auto">
                    <button
                      type="button"
                      onClick={() => setFavTarget('origin')}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${
                        favTarget === 'origin'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'text-white hover:text-white'
                      }`}
                    >
                      Origen
                    </button>
                    <button
                      type="button"
                      onClick={() => setFavTarget('destination')}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${
                        favTarget === 'destination'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : 'text-white hover:text-white'
                      }`}
                    >
                      Destino
                    </button>
                  </div>
                )}
              </div>

              {/* Favorite Places Scrollable Row */}
              <AnimatePresence>
                {showFavorites && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {places.length > 0 ? (
                      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                        {places.map((place) => {
                          const FavIcon = FAV_ICONS[place.icon] || Star;
                          return (
                            <button
                              key={place.id}
                              type="button"
                              onClick={() => {
                                if (favTarget === 'origin') {
                                  setOrigin(place.address);
                                  if (place.lat != null && place.lng != null) {
                                    setOriginCoords({ lat: place.lat, lng: place.lng });
                                  }
                                } else {
                                  setDestination(place.address);
                                  if (place.lat != null && place.lng != null) {
                                    setDestCoords({ lat: place.lat, lng: place.lng });
                                  }
                                }
                                setShowFavorites(false);
                                toast.success(`${favTarget === 'origin' ? 'Origen' : 'Destino'} establecido: ${place.name}`);
                              }}
                              className="flex items-center gap-2 px-3 py-2 rounded-xl glass hover:bg-white/10 transition-all shrink-0 min-w-fit"
                            >
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                favTarget === 'origin' ? 'bg-emerald-500/20' : 'bg-red-500/20'
                              }`}>
                                <FavIcon className={`w-3.5 h-3.5 ${
                                  favTarget === 'origin' ? 'text-emerald-400' : 'text-red-400'
                                }`} />
                              </div>
                              <div className="text-left">
                                <p className="text-xs font-medium text-white leading-tight">{place.name}</p>
                                <p className="text-[10px] text-white leading-tight truncate max-w-[120px]">{place.address}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl glass">
                        <Star className="w-3.5 h-3.5 text-white" />
                        <p className="text-xs text-white">No tienes lugares guardados</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Smart Destinations — recent + favorite routes */}
              {!currentRide && (
                <SmartDestinations
                  session={session ? { access_token: session.access_token } : null}
                  currentLat={userGPS?.lat}
                  currentLng={userGPS?.lng}
                  targetField={favTarget || 'destination'}
                  onSelect={(address, lat, lng, type) => {
                    if (favTarget === 'origin') {
                      setOrigin(address);
                      setOriginCoords({ lat, lng });
                    } else {
                      setDestination(address);
                      setDestCoords({ lat, lng });
                    }
                    toast.success(`${favTarget === 'origin' ? 'Origen' : 'Destino'} establecido`);
                  }}
                />
              )}

              {/* Rider Preferences — collapsible */}
              {!currentRide && (
                <RiderPreferences session={session ? { access_token: session.access_token } : null} collapsed={true} />
              )}

              {/* Origin */}
              <div className="relative">
                <PlacesAutocomplete
                  value={origin}
                  onChange={handleOriginChange}
                  placeholder="O escribe una direccion de partida"
                  dotColor="bg-emerald-400"
                  userLocation={userGPS}
                  searchRadius={15000}
                />
                {/* Precision pin button — only show when origin has coords */}
                {originCoords && !currentRide && (
                  <button
                    type="button"
                    onClick={() => setDragTarget(dragTarget === 'origin' ? null : 'origin')}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all z-20 ${
                      dragTarget === 'origin'
                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                        : 'bg-white/5 text-white hover:text-emerald-400 hover:bg-emerald-500/10'
                    }`}
                    title="Precisar punto en el mapa"
                  >
                    <MapPin className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Intermediate Stops */}
              <AnimatePresence>
                {stops.map((stop, index) => (
                  <motion.div
                    key={stop.id}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="relative"
                  >
                    {/* Stop label + remove button */}
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: STOP_COLORS[index] }} />
                        <span className="text-[10px] font-bold text-white uppercase tracking-wider">
                          Parada {index + 1}
                        </span>
                      </div>
                      <button
                        onClick={() => removeStop(stop.id)}
                        className="ml-auto p-1 rounded-lg hover:bg-red-500/10 text-white hover:text-red-400 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <PlacesAutocomplete
                      value={stop.address}
                      onChange={(val, placeId, lat, lng) => updateStop(stop.id, val, placeId, lat, lng)}
                      placeholder={`Parada intermedia ${index + 1}`}
                      dotColor=""
                      userLocation={userGPS}
                      searchRadius={15000}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Add Stop Button */}
              {stops.length < 6 && (
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={addStop}
                  className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl border border-dashed border-white/10 text-white hover:text-cyan-400 hover:border-cyan-500/30 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-xs font-medium">Agregar parada</span>
                </motion.button>
              )}

              {/* Destination */}
              <div className="relative">
                <PlacesAutocomplete
                  value={destination}
                  onChange={handleDestinationChange}
                  placeholder="A donde vas?"
                  dotColor="bg-red-400"
                  userLocation={userGPS}
                  searchRadius={15000}
                />
                {/* Precision pin button — only show when destination has coords */}
                {destCoords && !currentRide && (
                  <button
                    type="button"
                    onClick={() => setDragTarget(dragTarget === 'destination' ? null : 'destination')}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all z-20 ${
                      dragTarget === 'destination'
                        ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                        : 'bg-white/5 text-white hover:text-red-400 hover:bg-red-500/10'
                    }`}
                    title="Precisar punto en el mapa"
                  >
                    <MapPin className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Stops summary */}
            {stops.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-white">
                <CircleDot className="w-3 h-3" />
                <span>{stops.length + 2} puntos en la ruta</span>
              </div>
            )}

            {/* Schedule Mode — Date/Time Picker */}
            {isScheduleMode && !currentRide && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-3"
              >
                {/* Schedule Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      <Calendar className="w-4 h-4 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-purple-300">Programar Viaje</p>
                      <p className="text-[10px] text-white">Selecciona fecha y hora</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push('/client/ride')}
                    className="text-[10px] text-cyan-400 hover:underline"
                  >
                    Pedir ahora
                  </button>
                </div>

                {/* Date Picker */}
                <div>
                  <label className="text-xs font-medium text-white mb-1.5 block">Fecha del viaje</label>
                  <input
                    type="date"
                    value={scheduleDate}
                    min={getTodayStr()}
                    onChange={(e) => { setScheduleDate(e.target.value); setScheduleTime(''); }}
                    className="w-full glass rounded-xl p-3 text-white bg-transparent text-sm outline-none focus:ring-1 focus:ring-purple-500/50 [color-scheme:dark]"
                  />
                  {/* Quick Date Buttons */}
                  <div className="flex gap-2 mt-2">
                    {[0, 1, 2, 3].map(offset => {
                      const d = new Date();
                      d.setDate(d.getDate() + offset);
                      const dateStr = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
                      const dayLabel = offset === 0 ? 'Hoy' : offset === 1 ? 'Manana' : d.toLocaleDateString('es-CR', { weekday: 'short', day: 'numeric' });
                      return (
                        <button
                          key={offset}
                          type="button"
                          onClick={() => { setScheduleDate(dateStr); setScheduleTime(''); }}
                          className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                            scheduleDate === dateStr
                              ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20'
                              : 'glass text-white hover:text-white hover:bg-white/10'
                          }`}
                        >
                          {dayLabel}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Time Picker — only show when date is selected */}
                {scheduleDate && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-2"
                  >
                    <label className="text-xs font-medium text-white mb-1.5 block">Hora del viaje</label>
                    <input
                      type="time"
                      value={scheduleTime}
                      min={getMinTime(scheduleDate)}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      className="w-full glass rounded-xl p-3 text-white bg-transparent text-sm outline-none focus:ring-1 focus:ring-purple-500/50 [color-scheme:dark]"
                    />
                    {/* Quick Time Slots */}
                    <div className="flex gap-1.5 flex-wrap">
                      {getQuickTimes(scheduleDate).map(time => (
                        <button
                          key={time}
                          type="button"
                          onClick={() => setScheduleTime(time)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            scheduleTime === time
                              ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20'
                              : 'glass text-white hover:text-white hover:bg-white/10'
                          }`}
                        >
                          {time}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Info Card — show when both date and time selected */}
                {scheduleDate && scheduleTime && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-start gap-2 p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20"
                  >
                    <Info className="w-3.5 h-3.5 text-purple-400 mt-0.5 shrink-0" />
                    <p className="text-[11px] text-white leading-relaxed">
                      Se buscara un conductor 15 minutos antes de la hora programada. Recibiras una notificacion cuando se asigne.
                    </p>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* Ride Types */}
            <div className="space-y-2">
              {rideTypes.map((type) => {
                const TypeIcon = type.icon;
                return (
                  <button
                    key={type.id}
                    onClick={() => setRideType(type.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                      rideType === type.id
                        ? 'glass-strong border-cyan-500/50 glow-cyan'
                        : 'glass hover:bg-white/10'
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        rideType === type.id
                          ? `bg-gradient-to-br ${type.color}`
                          : 'bg-white/10'
                      }`}
                    >
                      <TypeIcon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-semibold text-white">{type.name}</p>
                      <p className="text-xs text-white">
                        {type.desc} - {type.time} de espera
                      </p>
                    </div>
                    <p className="text-sm font-bold text-cyan-400">{type.price}</p>
                  </button>
                );
              })}
            </div>

            {/* Payment Method Selector */}
            <PaymentMethodSelector
              selected={paymentMethod}
              onChange={(method, extra) => {
                setPaymentMethod(method);
                if (extra) setPaymentExtra(extra);
              }}
              estimatedPrice={fareEstimate?.price ?? undefined}
            />

            {/* Promo Code */}
            <div className="space-y-2">
              {!appliedPromo ? (
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white" />
                    <input
                      type="text"
                      value={promoCode}
                      onChange={(e) => { setPromoCode(e.target.value); setPromoError(''); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') validatePromoCode(); }}
                      placeholder="Codigo de promocion"
                      className="w-full glass rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder-gray-500 bg-transparent outline-none focus:ring-1 focus:ring-emerald-500/50"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={validatePromoCode}
                    disabled={promoValidating || !promoCode.trim()}
                    className="px-4 py-2.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-sm font-medium hover:bg-emerald-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                  >
                    {promoValidating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Aplicar'
                    )}
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between glass rounded-lg px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-emerald-500/20 flex items-center justify-center">
                      <Tag className="w-3 h-3 text-emerald-400" />
                    </div>
                    <div>
                      <span className="text-xs font-medium text-emerald-400">{appliedPromo.code}</span>
                      <span className="text-[10px] text-white ml-1.5">
                        {appliedPromo.discount_type === 'percentage'
                          ? `${appliedPromo.discount_value}% dto.`
                          : `₡${appliedPromo.discount_value.toLocaleString()} dto.`
                        }
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-400">
                      -₡{promoDiscount.toLocaleString()}
                    </span>
                    <button
                      type="button"
                      onClick={removePromo}
                      className="p-1 rounded-md hover:bg-red-500/10 text-white hover:text-red-400 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
              {promoError && (
                <p className="text-[11px] text-red-400 pl-1">{promoError}</p>
              )}
            </div>

            {/* Fare Estimate Card — show when both coords available */}
            {fareEstimate && !currentRide && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass rounded-xl p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white">Precio estimado</span>
                  {fareLoading && <Loader2 className="w-3 h-3 text-white animate-spin" />}
                </div>
                <div className="flex items-end gap-1">
                  <span className="text-2xl font-bold text-white">
                    ₡{(fareEstimate.price - promoDiscount).toLocaleString()}
                  </span>
                  {promoDiscount > 0 && (
                    <span className="text-xs text-white line-through mb-1">
                      ₡{fareEstimate.price.toLocaleString()}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-[10px] text-white">Distancia</p>
                    <p className="text-xs font-medium text-white">{fareEstimate.distance} km</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-white">Duracion</p>
                    <p className="text-xs font-medium text-white">~{fareEstimate.duration} min</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-white">ETA conductor</p>
                    <p className="text-xs font-medium text-cyan-400">{fareEstimate.eta > 0 ? `~${fareEstimate.eta} min` : 'Calculando...'}</p>
                  </div>
                </div>
              </motion.div>
            )}
            {fareLoading && !fareEstimate && !currentRide && (
              <div className="glass rounded-xl p-3 flex items-center justify-center">
                <Loader2 className="w-4 h-4 text-white animate-spin mr-2" />
                <span className="text-xs text-white">Calculando tarifa...</span>
              </div>
            )}

            {/* Fare Compare — all ride types side by side */}
            {!currentRide && originCoords && destCoords && (
              <FareCompare
                originLat={originCoords.lat}
                originLng={originCoords.lng}
                destLat={destCoords.lat}
                destLng={destCoords.lng}
                selectedType={rideType}
                onSelect={setRideType}
              />
            )}

            {/* Selected payment summary */}
            <div className="flex items-center justify-between glass rounded-lg px-3 py-2">
              <span className="text-xs text-white">Pago seleccionado</span>
              <div className="flex items-center gap-1.5">
                {(() => {
                  const PIcon = getPaymentIcon(paymentMethod);
                  return <PIcon className="w-3.5 h-3.5 text-cyan-400" />;
                })()}
                <span className="text-xs font-medium text-white">{getPaymentLabel(paymentMethod)}</span>
              </div>
            </div>

            <button
              onClick={isScheduleMode ? handleScheduleRide : handleCreateRide}
              disabled={
                isCreating || !origin || !destination ||
                (isScheduleMode && (!scheduleDate || !scheduleTime))
              }
              className={`w-full text-white font-semibold py-4 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 text-lg ${
                isScheduleMode
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:shadow-lg hover:shadow-purple-500/25'
                  : 'btn-neon'
              }`}
            >
              {isCreating ? (
                <>
                  <Search className="w-5 h-5 animate-spin" />
                  {isScheduleMode ? 'Programando...' : 'Buscando conductor...'}
                </>
              ) : isScheduleMode ? (
                <>
                  <Calendar className="w-5 h-5" />
                  Programar Viaje
                </>
              ) : (
                <>
                  Pedir {rideTypes.find(t => t.id === rideType)?.name || 'Economico'}
                </>
              )}
            </button>
          </>
        ) : (
          <>
            {/* Active Ride Content */}
            {/* Status Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`w-3 h-3 rounded-full ${
                    currentRide.status === 'searching'
                      ? 'bg-amber-400 animate-pulse'
                      : currentRide.status === 'scheduled'
                      ? 'bg-purple-400'
                      : currentRide.status === 'assigned'
                      ? 'bg-blue-400 animate-pulse'
                      : currentRide.status === 'arriving'
                      ? 'bg-cyan-400 animate-pulse'
                      : currentRide.status === 'started'
                      ? 'bg-emerald-400 animate-pulse'
                      : 'bg-gray-400'
                  }`}
                />
                <div>
                  <span className="text-sm font-semibold text-white capitalize">
                    {currentRide.status === 'scheduled' && 'Viaje programado'}
                    {currentRide.status === 'searching' && 'Buscando conductor...'}
                    {currentRide.status === 'assigned' && 'Conductor asignado'}
                    {currentRide.status === 'arriving' && 'Conductor en camino'}
                    {currentRide.status === 'started' && 'Viaje en curso'}
                    {currentRide.status === 'completed' && 'Viaje completado'}
                  </span>
                  {currentRide.status === 'scheduled' && (currentRide as any).scheduled_at && (
                    <p className="text-[10px] text-purple-400 mt-0.5">
                      {new Date((currentRide as any).scheduled_at).toLocaleString('es-CR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              </div>
              {currentRide.status !== 'completed' && (
                <button
                  onClick={() => setShowCancelDialog(true)}
                  className="text-xs text-red-400 hover:underline"
                >
                  {currentRide.status === 'scheduled' ? 'Cancelar programacion' : 'Cancelar'}
                </button>
              )}
            </div>

            {/* Match Retry Banner */}
            {currentRide.status === 'searching' && searchStartTime && (Date.now() - searchStartTime > 30000) && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass rounded-2xl p-4 border border-amber-500/20"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Search className="w-4 h-4 text-amber-400 animate-pulse" />
                  <span className="text-xs font-semibold text-white">Tomando mas tiempo de lo esperado</span>
                </div>
                <p className="text-[10px] text-white mb-3">
                  Amplia el radio de busqueda para encontrar un conductor mas rapido
                </p>
                <button
                  type="button"
                  onClick={handleRetryMatch}
                  disabled={retryingMatch}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {retryingMatch ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Navigation className="w-4 h-4" />
                  )}
                  {matchRetries > 0
                    ? `Ampliar busqueda (${5 + (matchRetries + 1) * 3}km)`
                    : 'Ampliar area de busqueda'}
                </button>
                {matchRetries > 0 && (
                  <p className="text-[9px] text-white text-center mt-2">
                    Intentos de ampliacion: {matchRetries} &middot; Radio actual: {5 + matchRetries * 3}km
                  </p>
                )}
              </motion.div>
            )}

            {/* Scheduled Ride Info */}
            {currentRide.status === 'scheduled' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 glass rounded-xl border border-purple-500/20"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-medium text-purple-300">Detalle del viaje programado</span>
                </div>
                <p className="text-[11px] text-white leading-relaxed">
                  Tu viaje esta programado y se buscara un conductor 15 minutos antes de la hora indicada. Recibiras una notificacion cuando se asigne un conductor.
                </p>
              </motion.div>
            )}

            {/* Driver Info */}
            {currentRide.status !== 'searching' && currentRide.status !== 'scheduled' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 p-3 glass rounded-xl"
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white font-bold">
                  {currentRide.driver_name?.charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">
                    {currentRide.driver_name}
                  </p>
                  <p className="text-xs text-white">
                    {currentRide.driver_vehicle}
                  </p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                      <span className="text-xs text-amber-400">
                        {currentRide.driver_rating}
                      </span>
                    </div>
                    {(currentRide as any).driver_distance != null && (
                      <div className="flex items-center gap-1">
                        <Navigation className="w-3 h-3 text-cyan-400" />
                        <span className="text-xs text-cyan-400">
                          {(currentRide as any).driver_distance} km
                        </span>
                      </div>
                    )}
                    {(currentRide as any).driver_eta != null && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-emerald-400" />
                        <span className="text-xs text-emerald-400">
                          {(currentRide as any).driver_eta} min
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => toast.success('Llamando conductor...')}
                    className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center hover:bg-emerald-500/30"
                  >
                    <Phone className="w-4 h-4 text-emerald-400" />
                  </button>
                  <button
                    onClick={() => setShowChat(true)}
                    className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center hover:bg-blue-500/30"
                  >
                    <MessageSquare className="w-4 h-4 text-blue-400" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* Verification PIN Display */}
            {['assigned', 'arriving'].includes(currentRide.status) && (currentRide as any).verification_pin && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="bg-gradient-to-br from-emerald-500/15 to-cyan-500/10 border border-emerald-500/25 rounded-2xl p-4 text-center"
              >
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-semibold text-emerald-300">PIN de verificacion</span>
                </div>
                <p className="text-[10px] text-white mb-2">Comparte este PIN con tu conductor</p>
                <div className="flex justify-center gap-3">
                  {(currentRide as any).verification_pin.split('').map((digit: string, i: number) => (
                    <div key={i} className="w-12 h-14 rounded-xl bg-white/10 border border-emerald-500/30 flex items-center justify-center">
                      <span className="text-2xl font-bold text-white">{digit}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[9px] text-white mt-2">El conductor ingresara este PIN para confirmar el viaje</p>
              </motion.div>
            )}

            {/* Route Info */}
            <div className="space-y-2">
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center mt-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <div className="w-0.5 h-4 bg-white/10" />
                  {/* Show intermediate stops dots */}
                  {currentRide.stops && currentRide.stops.length > 0 && currentRide.stops.map((stop: any, i: number) => (
                    <div key={i} className="flex flex-col items-center">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: STOP_COLORS[i] }} />
                      <div className="w-0.5 h-4 bg-white/10" />
                    </div>
                  ))}
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <p className="text-xs text-white">Origen</p>
                    <p className="text-sm text-white">{currentRide.origin}</p>
                  </div>
                  {/* Show intermediate stops */}
                  {currentRide.stops && currentRide.stops.length > 0 && currentRide.stops.map((stop: any, i: number) => (
                    <div key={i}>
                      <p className="text-xs text-white">Parada {i + 1}</p>
                      <p className="text-sm text-white">{stop.address}</p>
                    </div>
                  ))}
                  <div>
                    <p className="text-xs text-white">Destino</p>
                    <p className="text-sm text-white">{currentRide.destination}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Price & Payment Method & Actions */}
            <div className="flex items-center justify-between pt-2">
              <div>
                <p className="text-xs text-white">Precio estimado</p>
                <p className="text-2xl font-bold text-white">
                  ₡{currentRide.price.toLocaleString()}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  {(() => {
                    const pMethod = (currentRide as any).payment_method || 'cash';
                    const PIcon = getPaymentIcon(pMethod as PaymentMethod);
                    return <PIcon className="w-3 h-3 text-white" />;
                  })()}
                  <span className="text-[10px] text-white">
                    Pago: {getPaymentLabel(((currentRide as any).payment_method || 'cash') as PaymentMethod)}
                  </span>
                </div>
              </div>
              {currentRide.status === 'started' && (
                <button
                  onClick={() => {
                    completeRide(currentRide.id);
                    toast.success('Viaje completado!');
                  }}
                  className="btn-neon text-white font-medium px-6 py-3 rounded-xl"
                >
                  Completar
                </button>
              )}
              {currentRide.status === 'completed' && (
                <button
                  onClick={() => router.push(`/client/ride/${currentRide.id}`)}
                  className="btn-neon text-white font-medium px-6 py-3 rounded-xl"
                >
                  <Check className="w-4 h-4 mr-1" /> Ver Detalles
                </button>
              )}
            </div>

            {/* View Details Button (non-completed rides) */}
            {currentRide.status !== 'completed' && currentRide.status !== 'searching' && (
              <button
                onClick={() => router.push(`/client/ride/${currentRide.id}`)}
                className="w-full flex items-center justify-center gap-2 glass rounded-xl p-2.5 text-white hover:text-white hover:bg-white/10 transition-all"
              >
                <FileText className="w-4 h-4" />
                <span className="text-xs font-medium">Ver detalles del viaje</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            )}

            {/* SOS Button */}
            {currentRide.status === 'started' && (
              <button
                onClick={() => {
                  toast.error(
                    'SOS ACTIVADO! Contactando emergencias...'
                  );
                }}
                className="w-full bg-red-500/20 border border-red-500/50 text-red-400 font-semibold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-red-500/30"
              >
                <Shield className="w-5 h-5" /> SOS Emergencia
              </button>
            )}

            {/* Share Trip Button */}
            {['assigned', 'arriving', 'started'].includes(currentRide.status) && (
              <button
                onClick={handleShareTrip}
                disabled={shareLoading}
                className="w-full flex items-center justify-center gap-2 glass rounded-xl p-2.5 text-cyan-400 hover:text-white hover:bg-white/10 transition-all"
              >
                {shareLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
                <span className="text-xs font-medium">Compartir viaje en vivo</span>
              </button>
            )}

            {/* Split Fare Button */}
            {['assigned', 'arriving', 'started'].includes(currentRide.status) && !(currentRide as any)?.is_split_fare && (
              <button
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({
                      title: 'Dividir viaje RIDA',
                      text: `Te invito a dividir el viaje. Costo: ₡${currentRide.price?.toLocaleString()}`,
                      url: `${window.location.origin}/client/ride/${currentRide.id}?split=true`,
                    }).catch(() => {});
                  } else {
                    navigator.clipboard.writeText(`${window.location.origin}/client/ride/${currentRide.id}?split=true`);
                    toast.success('Enlace para dividir viaje copiado');
                  }
                }}
                className="w-full flex items-center justify-center gap-2 glass rounded-xl p-2.5 text-purple-400 hover:text-white hover:bg-white/10 transition-all"
              >
                <Tag className="w-4 h-4" />
                <span className="text-xs font-medium">Dividir costo del viaje</span>
              </button>
            )}

            {/* Split fare indicator */}
            {(currentRide as any)?.is_split_fare && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-purple-500/10 border border-purple-500/20">
                <Tag className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-[11px] text-purple-300">Viaje dividido entre {(currentRide as any)?.split_total_users || 1} pasajeros</span>
              </div>
            )}
          </>
        )}
        </div>
      </DraggableBottomSheet>

      {/* Cancel Ride Dialog */}
      <AnimatePresence>
        {showCancelDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 flex items-end justify-center z-50 p-4"
            onClick={() => setShowCancelDialog(false)}
          >
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className="w-full max-w-md glass-strong rounded-2xl p-5 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-base font-bold text-white">Cancelar viaje</h3>
              <p className="text-xs text-white">
                Selecciona el motivo de cancelacion. Se puede aplicar una tarifa de cancelacion si el conductor ya fue asignado.
              </p>
              <div className="space-y-1.5">
                {cancelReasons.map((reason) => (
                  <button
                    key={reason}
                    onClick={() => setCancelReason(reason)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all ${
                      cancelReason === reason
                        ? 'bg-red-500/20 border border-red-500/40 text-red-400 font-medium'
                        : 'glass text-white hover:bg-white/10'
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowCancelDialog(false); setCancelReason(''); }}
                  className="flex-1 py-2.5 rounded-xl glass text-white text-sm font-medium hover:bg-white/10"
                >
                  Volver
                </button>
                <button
                  onClick={handleCancelWithFee}
                  disabled={isCancelling || !cancelReason}
                  className="flex-1 py-2.5 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 text-sm font-medium hover:bg-red-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isCancelling ? (
                    <span className="flex items-center justify-center gap-1">
                      <Loader2 className="w-4 h-4 animate-spin" /> Cancelando...
                    </span>
                  ) : (
                    'Confirmar cancelacion'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ride Chat — Floating Panel */}
      {currentRide && !['searching', 'scheduled', 'completed'].includes(currentRide.status) && (
        <>
          <div className="absolute bottom-4 right-4 z-40">
            <ChatToggleButton onClick={() => setShowChat(!showChat)} />
          </div>
          <RideChat
            rideId={currentRide.id}
            currentUserRole="client"
            currentUserId={user?.id || ''}
            otherUserName={currentRide.driver_name || 'Conductor'}
            isOpen={showChat}
            onClose={() => setShowChat(false)}
          />
        </>
      )}

      {/* Drag Precision Mode — Floating Controls */}
      <AnimatePresence>
        {dragTarget && !currentRide && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-4 left-4 right-4 z-30"
          >
            <div className="glass-strong rounded-2xl p-4 space-y-3 border border-cyan-500/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    dragTarget === 'origin' ? 'bg-emerald-500/20' : 'bg-red-500/20'
                  }`}>
                    <MapPin className={`w-4 h-4 ${dragTarget === 'origin' ? 'text-emerald-400' : 'text-red-400'}`} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">
                      Ajustando {dragTarget === 'origin' ? 'punto de partida' : 'destino'}
                    </p>
                    <p className="text-[10px] text-white">
                      {isReverseGeocoding ? 'Obteniendo direccion...' : 'Arrastra el pin al lugar exacto'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDragTarget(null)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-white/10 text-white hover:text-white hover:bg-white/5 transition-all text-sm"
                  >
                    <X className="w-4 h-4" />
                    Cerrar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      toast.success(`${dragTarget === 'origin' ? 'Punto de partida' : 'Destino'} confirmado en la posicion actual`);
                      setDragTarget(null);
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/30 transition-all text-sm font-medium"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Confirmar
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Third Party Popup */}
      <AnimatePresence>
        {showThirdParty && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 flex items-center justify-center z-50 p-6"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="glass-strong rounded-2xl p-6 max-w-sm w-full text-center space-y-4"
            >
              <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto" />
              <h3 className="text-lg font-bold text-white">Viaje de Tercero?</h3>
              <p className="text-sm text-white">
                Este viaje parece ser para otra persona. Usted es responsable
                por la persona que viaja.
              </p>
              <div className="space-y-2">
                <button
                  onClick={() => {
                    setShowThirdParty(false);
                    toast.success('Responsabilidad aceptada');
                  }}
                  className="w-full bg-amber-500/20 border border-amber-500/50 text-amber-400 font-medium py-3 rounded-xl"
                >
                  ACEPTO - Soy responsable
                </button>
                <button
                  onClick={() => {
                    setShowThirdParty(false);
                    if (currentRide) cancelRide(currentRide.id);
                    toast.info('Viaje cancelado');
                  }}
                  className="w-full border border-white/10 text-white py-3 rounded-xl"
                >
                  Cancelar viaje
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
