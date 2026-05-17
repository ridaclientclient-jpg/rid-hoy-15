'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Clock, Star, Car, ChevronRight, Receipt,
  HandCoins, CircleDot, Square, Shield, Phone,
  MessageSquare, CheckCircle2, XCircle, Info, AlertTriangle,
  DollarSign, Route, Navigation
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRideStore } from '@/store/rideStore';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import GoogleMap from '@/components/GoogleMap';
import SOSButton from '@/components/SOSButton';

const rideTypeNames: Record<string, string> = {
  standard: 'Economico',
  premium: 'Premium',
  suv: 'SUV',
  moto: 'Moto',
  moto_express: 'Moto Express',
  grua: 'Grua',
  flete: 'Carro de Carga (Flete)',
};

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: any }> = {
  searching: { label: 'Buscando conductor', color: 'text-amber-400', bgColor: 'bg-amber-500/20', icon: Clock },
  assigned: { label: 'Asignado', color: 'text-blue-400', bgColor: 'bg-blue-500/20', icon: CheckCircle2 },
  arriving: { label: 'Conductor en camino', color: 'text-cyan-400', bgColor: 'bg-cyan-500/20', icon: Navigation },
  started: { label: 'En viaje', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20', icon: Car },
  completed: { label: 'Completado', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20', icon: CheckCircle2 },
  cancelled: { label: 'Cancelado', color: 'text-red-400', bgColor: 'bg-red-500/20', icon: XCircle },
};

interface RideDetails {
  id: string;
  rider_id: string;
  driver_id?: string;
  status: string;
  origin: string;
  origin_lat?: number;
  origin_lng?: number;
  destination: string;
  dest_lat?: number;
  dest_lng?: number;
  price: number;
  distance?: number;
  duration?: number;
  surge_multiplier: number;
  commission_rate: number;
  driver_earnings?: number;
  rider_rating?: number;
  driver_rating?: number;
  review?: string;
  is_third_party: boolean;
  payment_method?: string;
  payment_status?: string;
  card_last_four?: string;
  sinpe_phone?: string;
  ride_type?: string;
  stops?: any;
  created_at: string;
  updated_at: string;
  // Joined data
  driver_name?: string;
  driver_phone?: string;
  driver_avatar?: string;
  driver_vehicle?: string;
  driver_rating?: number;
}

export default function RideDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const rideId = params?.id as string;
  const { currentRide } = useRideStore();
  const { user } = useAuthStore();
  const [ride, setRide] = useState<RideDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [rated, setRated] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!rideId) return;

    // If this is the current active ride, use it from store
    if (currentRide && currentRide.id === rideId) {
      const r = currentRide as any;
      setRide({
        id: r.id,
        rider_id: r.rider_id,
        driver_id: r.driver_id,
        status: r.status,
        origin: r.origin,
        origin_lat: r.origin_lat,
        origin_lng: r.origin_lng,
        destination: r.destination,
        dest_lat: r.dest_lat,
        dest_lng: r.dest_lng,
        price: r.price,
        distance: r.distance,
        duration: r.duration,
        surge_multiplier: r.surge_multiplier || 1,
        commission_rate: r.commission_rate || 15,
        driver_earnings: r.driver_earnings,
        rider_rating: r.rider_rating,
        driver_rating: r.driver_rating || r.driver_rating,
        review: r.review,
        is_third_party: r.is_third_party || false,
        ride_type: r.ride_type,
        payment_method: r.payment_method,
        payment_status: r.payment_status,
        card_last_four: r.card_last_four,
        sinpe_phone: r.sinpe_phone,
        stops: r.stops,
        created_at: r.created_at,
        updated_at: r.updated_at,
        driver_name: r.driver_name,
        driver_phone: r.driver_phone,
        driver_avatar: r.driver_avatar,
        driver_vehicle: r.driver_vehicle,
      });
      setLoading(false);
      return;
    }

    // Fetch from Supabase
    async function fetchRide() {
      try {
        const { data, error } = await supabase
          .from('rides')
          .select('*')
          .eq('id', rideId)
          .single();

        if (error || !data) {
          toast.error('Viaje no encontrado');
          setLoading(false);
          return;
        }

        // Try to get driver info
        let driverName = 'Conductor';
        let driverPhone = '';
        let driverAvatar = '';
        let driverVehicle = '';
        let driverRating = 0;
        if (data.driver_id) {
          try {
            const { data: driverData } = await supabase
              .from('drivers')
              .select('rating, profiles(name, phone, avatar_url), vehicles(model, color, plate)')
              .eq('id', data.driver_id)
              .single();
            if (driverData) {
              const p = (driverData as any).profiles;
              if (p) {
                driverName = p.name || 'Conductor';
                driverPhone = p.phone || '';
                driverAvatar = p.avatar_url || '';
              }
              driverRating = (driverData as any).rating || 0;
              const vList = (driverData as any).vehicles;
              const v = Array.isArray(vList) ? vList[0] : vList;
              if (v) driverVehicle = `${v.color || ''} ${v.model || ''} - ${v.plate || ''}`.trim();
            }
          } catch {
            // driver join failed, use default
          }
        }

        setRide({
          ...data,
          driver_name: driverName,
          driver_phone: driverPhone,
          driver_avatar: driverAvatar,
          driver_vehicle: driverVehicle,
          driver_rating: driverRating,
        });
      } catch {
        toast.error('Error al cargar detalles del viaje');
      } finally {
        setLoading(false);
      }
    }
    fetchRide();
  }, [rideId, currentRide]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-CR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const submitRating = async () => {
    if (!ride || rating === 0 || !user) return;
    setIsSubmitting(true);
    try {
      // Keep existing rides.rider_rating update
      await supabase
        .from('rides')
        .update({ rider_rating: rating })
        .eq('id', ride.id);

      // Also insert into reviews table
      await supabase.from('reviews').insert({
        ride_id: ride.id,
        reviewer_id: user.id,
        reviewee_id: ride.driver_id,
        rating: rating,
        comment: reviewComment.trim() || null,
      });

      setRated(true);
      setShowRating(false);
      toast.success('Calificacion enviada! Gracias por tu opinion.');
    } catch {
      toast.error('Error al enviar calificacion');
    } finally {
      setIsSubmitting(false);
    }
  };

  const stopsParsed = (() => {
    if (!ride?.stops) return [];
    if (typeof ride.stops === 'string') {
      try { return JSON.parse(ride.stops); } catch { return []; }
    }
    return Array.isArray(ride.stops) ? ride.stops : [];
  })();

  // Build map markers
  const mapMarkers: { lat: number; lng: number; label: string; color: string }[] = [];
  if (ride?.origin_lat && ride?.origin_lng) {
    mapMarkers.push({ lat: ride.origin_lat, lng: ride.origin_lng, label: 'A', color: '#10b981' });
  }
  stopsParsed.forEach((s: any, i: number) => {
    if (s.lat && s.lng) {
      mapMarkers.push({ lat: s.lat, lng: s.lng, label: String.fromCharCode(67 + i), color: '#f59e0b' });
    }
  });
  if (ride?.dest_lat && ride?.dest_lng) {
    mapMarkers.push({ lat: ride.dest_lat, lng: ride.dest_lng, label: 'B', color: '#ef4444' });
  }

  if (loading) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Cargando detalles...</p>
        </div>
      </div>
    );
  }

  if (!ride) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <div className="text-center">
          <MapPin className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Viaje no encontrado</p>
          <button onClick={() => router.back()} className="mt-3 text-xs text-cyan-400 hover:underline">
            Volver
          </button>
        </div>
      </div>
    );
  }

  const status = statusConfig[ride.status] || statusConfig.cancelled;
  const StatusIcon = status.icon;
  const rideTypeName = rideTypeNames[ride.ride_type || ''] || 'Economico';
  const isActive = ['searching', 'assigned', 'arriving', 'started'].includes(ride.status);

  return (
    <div className="min-h-[calc(100vh-120px)] space-y-0">
      {/* Map Section */}
      {(ride.origin_lat && ride.dest_lat) ? (
        <div className="relative" style={{ height: '200px' }}>
          <GoogleMap
            center={{ lat: ride.origin_lat, lng: ride.origin_lng }}
            zoom={13}
            markers={mapMarkers}
            showRoute={
              ride.origin_lat && ride.origin_lng && ride.dest_lat && ride.dest_lng
                ? { origin: { lat: ride.origin_lat, lng: ride.origin_lng }, destination: { lat: ride.dest_lat, lng: ride.dest_lng } }
                : undefined
            }
            showDirections={!!(ride.origin_lat && ride.dest_lat)}
            showUserLocation={false}
            className="absolute inset-0"
            height="100%"
          />
          {/* Status Badge overlay */}
          <div className="absolute top-3 left-3 z-10">
            <div className={`glass-strong rounded-full px-3 py-1.5 flex items-center gap-2 border ${isActive ? 'border-cyan-500/30' : ''}`}>
              <StatusIcon className={`w-3.5 h-3.5 ${status.color} ${isActive ? 'animate-pulse' : ''}`} />
              <span className={`text-xs font-medium ${status.color}`}>{status.label}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="h-48 glass flex items-center justify-center">
          <MapPin className="w-10 h-10 text-gray-600" />
        </div>
      )}

      {/* Ride Summary Card */}
      <div className="p-4 space-y-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          {/* Ride Type + Driver */}
          <div className="flex items-center justify-between mb-1">
            <div>
              <p className="text-base font-bold text-white">
                Viaje {rideTypeName} {ride.driver_name ? `con ${ride.driver_name.toUpperCase()}` : ''}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{formatDate(ride.created_at)}</p>
            </div>
            {ride.driver_name ? (
              ride.driver_avatar ? (
                <img src={ride.driver_avatar} alt={ride.driver_name} className="w-10 h-10 rounded-full object-cover border-2 border-white/10" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white font-bold text-sm">
                  {ride.driver_name.charAt(0)}
                </div>
              )
            ) : null}
          </div>

          {/* Fare + Status */}
          <div className="flex items-center gap-3 mt-3">
            <p className="text-2xl font-bold text-white">
              ₡{Number(ride.price).toLocaleString()}
            </p>
            <div className={`text-xs font-medium px-2.5 py-1 rounded-full ${status.bgColor} ${status.color}`}>
              {status.label}
            </div>
          </div>
        </motion.div>

        {/* Driver Card (if assigned) */}
        {ride.driver_name && ride.status !== 'searching' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="glass rounded-xl p-3 flex items-center gap-3"
          >
            {ride.driver_avatar ? (
              <img src={ride.driver_avatar} alt={ride.driver_name} className="w-11 h-11 rounded-full object-cover border-2 border-white/10 shrink-0" />
            ) : (
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                {ride.driver_name.charAt(0)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">{ride.driver_name}</p>
              {ride.driver_vehicle && (
                <p className="text-xs text-gray-400 truncate">{ride.driver_vehicle}</p>
              )}
              {ride.driver_rating && (
                <div className="flex items-center gap-1 mt-0.5">
                  <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                  <span className="text-xs text-amber-400">{ride.driver_rating}</span>
                </div>
              )}
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => {
                  if (ride?.driver_phone) {
                    window.open(`tel:${ride.driver_phone}`, '_self');
                  } else {
                    window.open('https://wa.me/50687838329?text=' + encodeURIComponent('Hola, necesito comunicarme con mi conductor del viaje ' + ride.id.slice(0, 8).toUpperCase()), '_blank');
                  }
                }}
                className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center hover:bg-emerald-500/30 transition-colors"
              >
                <Phone className="w-4 h-4 text-emerald-400" />
              </button>
              <button
                type="button"
                onClick={() => {
                  const msg = isActive
                    ? 'Hola, tengo una consulta sobre mi viaje activo ' + ride.id.slice(0, 8).toUpperCase()
                    : 'Hola, tengo una consulta sobre mi viaje ' + ride.id.slice(0, 8).toUpperCase();
                  window.open('https://wa.me/50687838329?text=' + encodeURIComponent(msg), '_blank');
                }}
                className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center hover:bg-blue-500/30 transition-colors"
              >
                <MessageSquare className="w-4 h-4 text-blue-400" />
              </button>
            </div>
          </motion.div>
        )}

        {/* Receipt Button */}
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          onClick={() => router.push(`/client/ride/receipt?ride=${ride.id}`)}
          className="w-full glass rounded-xl p-3 flex items-center gap-3 hover:bg-white/5 transition-colors"
        >
          <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center">
            <Receipt className="w-4 h-4 text-gray-400" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-medium text-white">Recibo</p>
            <p className="text-xs text-gray-500">Ver comprobante del viaje</p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </motion.button>

        {/* Trip Details List */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass rounded-xl divide-y divide-white/5"
        >
          {/* Origin */}
          <div className="flex items-start gap-3 p-3.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
              <CircleDot className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Punto de partida</p>
              <p className="text-sm text-white mt-0.5 break-words">{ride.origin}</p>
            </div>
          </div>

          {/* Intermediate Stops */}
          {stopsParsed.map((stop: any, i: number) => (
            <div key={i} className="flex items-start gap-3 p-3.5">
              <div className="w-9 h-9 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
                <div className="w-4 h-4 rounded-full bg-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Parada {i + 1}</p>
                <p className="text-sm text-white mt-0.5 break-words">{stop.address}</p>
              </div>
            </div>
          ))}

          {/* Destination */}
          <div className="flex items-start gap-3 p-3.5">
            <div className="w-9 h-9 rounded-lg bg-red-500/20 flex items-center justify-center shrink-0">
              <Square className="w-4 h-4 text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Destino</p>
              <p className="text-sm text-white mt-0.5 break-words">{ride.destination}</p>
            </div>
          </div>

          {/* Extra Charges */}
          <div className="flex items-start gap-3 p-3.5">
            <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
              <HandCoins className="w-4 h-4 text-gray-400" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Cargos extra</p>
              <p className="text-sm text-gray-400 mt-0.5">
                {ride.surge_multiplier && ride.surge_multiplier > 1
                  ? `Multiplicador de demanda: x${ride.surge_multiplier}`
                  : 'No se agregaron cargos extra'}
              </p>
            </div>
          </div>

          {/* Distance & Duration */}
          {ride.distance && (
            <div className="flex items-start gap-3 p-3.5">
              <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                <Route className="w-4 h-4 text-gray-400" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Distancia y tiempo</p>
                <p className="text-sm text-gray-400 mt-0.5">
                  {Number(ride.distance).toFixed(1)} km
                  {ride.duration ? ` - ~${ride.duration} min` : ''}
                </p>
              </div>
            </div>
          )}

          {/* Fare Breakdown */}
          <div className="flex items-start gap-3 p-3.5">
            <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
              <DollarSign className="w-4 h-4 text-gray-400" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Desglose de precio</p>
              <div className="text-xs text-gray-400 mt-1 space-y-0.5">
                <div className="flex justify-between">
                  <span>Tipo de viaje</span>
                  <span className="text-white">{rideTypeName}</span>
                </div>
                <div className="flex justify-between">
                  <span>Metodo de pago</span>
                  <span className="text-white">{ride.payment_method === 'cash' ? 'Efectivo' : ride.payment_method === 'wallet' ? 'Billetera RIDA' : ride.payment_method === 'card' ? `Tarjeta ****${ride.card_last_four || '****'}` : ride.payment_method === 'sinpe' ? `SINPE ${ride.sinpe_phone || ''}` : 'Efectivo'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="text-white">₡{Number(ride.price).toLocaleString()}</span>
                </div>
                {ride.surge_multiplier && ride.surge_multiplier > 1 && (
                  <div className="flex justify-between text-amber-400">
                    <span>Demanda (x{ride.surge_multiplier})</span>
                    <span>+₡{Math.round(Number(ride.price) * (ride.surge_multiplier - 1)).toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Rating */}
          <div className="flex items-start gap-3 p-3.5">
            <div className="w-9 h-9 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
              <Star className="w-4 h-4 text-amber-400" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Calificacion</p>
              {ride.driver_rating ? (
                <div className="flex items-center gap-1 mt-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`w-4 h-4 ${i < (ride.driver_rating || 0) ? 'text-amber-400 fill-amber-400' : 'text-gray-600'}`}
                    />
                  ))}
                  <span className="text-xs text-gray-400 ml-1">{ride.driver_rating}</span>
                </div>
              ) : (
                <p className="text-sm text-gray-500 mt-0.5">
                  {ride.status === 'completed' && !rated
                    ? 'Sin calificacion'
                    : ride.status === 'cancelled'
                    ? 'Viaje cancelado - sin calificacion'
                    : 'Calificacion pendiente al finalizar'}
                </p>
              )}
            </div>
          </div>
        </motion.div>

        {/* Rate Driver Button (completed rides) */}
        {ride.status === 'completed' && !rated && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            onClick={() => setShowRating(true)}
            className="w-full flex items-center gap-3 glass rounded-xl p-3 hover:bg-white/5 transition-colors"
          >
            <Star className="w-4 h-4 text-amber-400" />
            <span className="text-sm text-white font-medium">Calificar conductor</span>
            <ChevronRight className="w-4 h-4 text-gray-600 ml-auto" />
          </motion.button>
        )}

        {/* SOS Button (active rides) */}
        {isActive && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <SOSButton rideId={ride.id} className="w-full" />
          </motion.div>
        )}

        {/* Info badges */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="flex items-center gap-2"
        >
          <div className="flex-1 glass rounded-lg px-3 py-2 flex items-center gap-2">
            <Info className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-[10px] text-gray-500">ID: {ride.id.slice(0, 8).toUpperCase()}</span>
          </div>
          {ride.is_third_party && (
            <div className="glass rounded-lg px-3 py-2 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[10px] text-amber-400">Viaje de tercero</span>
            </div>
          )}
        </motion.div>
      </div>

      {/* Rating Modal */}
      <AnimatePresence>
        {showRating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-end justify-center z-50"
          >
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className="glass-strong rounded-t-3xl p-6 w-full max-w-md space-y-4"
            >
              <h3 className="text-lg font-bold text-white text-center">
                Como fue tu viaje?
              </h3>
              <p className="text-sm text-gray-400 text-center">
                Calificacion anonima
              </p>
              <div className="flex items-center justify-center gap-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setRating(i + 1)}
                    className="transition-transform hover:scale-110"
                  >
                    <Star
                      className={`w-10 h-10 transition-colors ${
                        i < rating ? 'text-amber-400 fill-amber-400' : 'text-gray-600'
                      }`}
                    />
                  </button>
                ))}
              </div>
              {/* Comment textarea */}
              <div className="space-y-1.5">
                <textarea
                  value={reviewComment}
                  onChange={(e) => {
                    if (e.target.value.length <= 300) setReviewComment(e.target.value);
                  }}
                  placeholder="Deja un comentario (opcional)..."
                  maxLength={300}
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-cyan-500/50 transition-colors"
                />
                <p className="text-[10px] text-gray-500 text-right">
                  {reviewComment.length}/300
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowRating(false)}
                  className="flex-1 border border-white/10 text-gray-300 py-3 rounded-xl text-sm font-medium"
                >
                  Mas tarde
                </button>
                <button
                  onClick={submitRating}
                  disabled={rating === 0 || isSubmitting}
                  className="flex-1 btn-neon text-white py-3 rounded-xl text-sm font-medium disabled:opacity-50"
                >
                  {isSubmitting ? 'Enviando...' : 'Enviar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
