'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, MapPin, Clock, Star, Phone, Shield, AlertTriangle, Package, FileText, ChevronRight, Eye, EyeOff, Loader2, Headphones, Banknote, Smartphone, CreditCard } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import GoogleMap from '@/components/GoogleMap';

interface RideDetail {
  id: string;
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
  ride_type?: string;
  surge_multiplier?: number;
  commission_rate?: number;
  driver_earnings?: number;
  rider_rating?: number;
  driver_rating?: number;
  review?: string;
  is_third_party?: boolean;
  created_at: string;
  driver_name?: string;
  driver_phone?: string;
  driver_vehicle?: string;
  driver_rating_val?: number;
  driver_plate?: string;
  payment_method?: string;
}

function getStatusConfig(status: string) {
  switch (status) {
    case 'completed': return { label: 'Completado', color: 'bg-emerald-500/20 text-emerald-400' };
    case 'cancelled': return { label: 'Cancelado', color: 'bg-red-500/20 text-red-400' };
    case 'started': return { label: 'En curso', color: 'bg-cyan-500/20 text-cyan-400' };
    default: return { label: status, color: 'bg-gray-500/20 text-gray-400' };
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('es-CR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' });
}

export default function RideDetailsPage() {
  return (
    <Suspense fallback={<div className="p-4 flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 text-cyan-400 animate-spin" /></div>}>
      <RideDetailsContent />
    </Suspense>
  );
}

function RideDetailsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rideId = searchParams.get('ride');
  const { user } = useAuthStore();

  const [ride, setRide] = useState<RideDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isHidden, setIsHidden] = useState(false);
  const [ratingValue, setRatingValue] = useState(0);
  const [isRating, setIsRating] = useState(false);
  const [reviewComment, setReviewComment] = useState('');

  useEffect(() => {
    if (!rideId) { router.replace('/client/history'); return; }
    fetchRideDetail(rideId);
  }, [rideId]);

  const fetchRideDetail = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('rides')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        toast.error('Viaje no encontrado');
        router.replace('/client/history');
        return;
      }

      // Fetch driver info if exists
      let driverName: string | undefined;
      let driverPhone: string | undefined;
      let driverVehicle: string | undefined;
      let driverRating: number | undefined;
      let driverPlate: string | undefined;

      if (data.driver_id) {
        const { data: driverData } = await supabase
          .from('drivers')
          .select('id, rating, profiles(name, phone), vehicles(model, color, plate)')
          .eq('id', data.driver_id)
          .single();

        if (driverData) {
          driverName = (driverData as any).profiles?.name;
          driverPhone = (driverData as any).profiles?.phone;
          driverRating = (driverData as any).rating;
          driverVehicle = (driverData as any).vehicles
            ? `${(driverData as any).vehicles.model} ${(driverData as any).vehicles.color}`
            : undefined;
          driverPlate = (driverData as any).vehicles?.plate;
        }
      }

      setRide({
        ...data,
        driver_name: driverName,
        driver_phone: driverPhone,
        driver_vehicle: driverVehicle,
        driver_rating_val: driverRating,
        driver_plate: driverPlate,
        payment_method: data.payment_method || 'efectivo',
      });
      setRatingValue(data.rider_rating || 0);
    } catch {
      toast.error('Error al cargar viaje');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRate = async () => {
    if (!rideId || ratingValue === 0 || !ride || !user) return;
    setIsRating(true);
    try {
      // Keep existing rides.rider_rating update
      const { error } = await supabase.from('rides').update({ rider_rating: ratingValue }).eq('id', rideId);
      if (error) throw error;

      // Also insert into reviews table
      await supabase.from('reviews').insert({
        ride_id: rideId,
        reviewer_id: user.id,
        reviewee_id: ride.driver_id,
        rating: ratingValue,
        comment: reviewComment.trim() || null,
      });

      toast.success('Calificacion enviada!');
      setRide(prev => prev ? { ...prev, rider_rating: ratingValue } : prev);
    } catch {
      toast.error('Error al enviar calificacion');
    } finally {
      setIsRating(false);
    }
  };

  if (isLoading) {
    return <div className="p-4 flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 text-cyan-400 animate-spin" /></div>;
  }

  if (!ride) return null;

  const statusCfg = getStatusConfig(ride.status);
  const mapCenter = ride.origin_lat && ride.origin_lng ? { lat: ride.origin_lat, lng: ride.origin_lng } : { lat: 9.7489, lng: -83.7534 };
  const mapMarkers = [
    ...(ride.origin_lat && ride.origin_lng ? [{ lat: ride.origin_lat, lng: ride.origin_lng, label: 'A', color: '#10b981' }] : []),
    ...(ride.dest_lat && ride.dest_lng ? [{ lat: ride.dest_lat, lng: ride.dest_lng, label: 'B', color: '#ef4444' }] : []),
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-white/5 transition-colors">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <h1 className="text-lg font-bold text-white">Detalles del viaje</h1>
      </div>

      {/* Map */}
      <div className="h-44 rounded-2xl overflow-hidden">
        <GoogleMap center={mapCenter} zoom={13} markers={mapMarkers} showRoute={ride.origin_lat && ride.origin_lng && ride.dest_lat && ride.dest_lng ? { origin: { lat: ride.origin_lat, lng: ride.origin_lng }, destination: { lat: ride.dest_lat, lng: ride.dest_lng } } : undefined} showDirections={!!(ride.origin_lat && ride.dest_lat)} showUserLocation={false} className="w-full h-full" />
      </div>

      {/* Status and Date */}
      <div className="glass rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusCfg.color}`}>{statusCfg.label}</span>
          <div className="text-right">
            <p className="text-xs text-gray-400">{formatDate(ride.created_at)}</p>
            <p className="text-[10px] text-gray-500">{formatTime(ride.created_at)}</p>
          </div>
        </div>

        {/* Route */}
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-center mt-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <div className="w-0.5 h-10 bg-white/10" />
            <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
          </div>
          <div className="flex-1 space-y-4">
            <div>
              <p className="text-xs text-gray-500">Recogida</p>
              <p className="text-sm text-white">{ride.origin}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Destino</p>
              <p className="text-sm text-white">{ride.destination}</p>
            </div>
          </div>
        </div>

        {/* Price */}
        <div className="flex items-center justify-between pt-2 border-t border-white/5">
          <div>
            <p className="text-xs text-gray-500">Total</p>
            <p className="text-xl font-bold text-white">{'\u20A1'}{ride.price.toLocaleString()}</p>
          </div>
          <div className="flex items-center gap-2">
            {ride.distance && (
              <div className="text-right">
                <p className="text-xs text-gray-500">{ride.distance} km</p>
                <p className="text-xs text-gray-500">{ride.duration} min</p>
              </div>
            )}
            {/* Payment Method */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg ${
              ride.payment_method === 'sinpe' ? 'bg-blue-500/15' : ride.payment_method === 'tarjeta' ? 'bg-purple-500/15' : 'bg-emerald-500/15'
            }`}>
              {ride.payment_method === 'efectivo' && <Banknote className="w-3.5 h-3.5 text-emerald-400" />}
              {ride.payment_method === 'sinpe' && <Smartphone className="w-3.5 h-3.5 text-blue-400" />}
              {ride.payment_method === 'tarjeta' && <CreditCard className="w-3.5 h-3.5 text-purple-400" />}
              <span className={`text-xs font-medium ${
                ride.payment_method === 'sinpe' ? 'text-blue-400' : ride.payment_method === 'tarjeta' ? 'text-purple-400' : 'text-emerald-400'
              }`}>{
                ride.payment_method === 'efectivo' ? 'Efectivo' : ride.payment_method === 'sinpe' ? 'SINPE' : 'Tarjeta'
              }</span>
            </div>
          </div>
        </div>
      </div>

      {/* Driver Info */}
      {ride.driver_name && (
        <div className="glass rounded-2xl p-4">
          <p className="text-xs font-semibold text-gray-400 mb-3">Conductor</p>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white text-lg font-bold">
              {ride.driver_name.charAt(0)}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">{ride.driver_name}</p>
              {ride.driver_vehicle && <p className="text-xs text-gray-400">{ride.driver_vehicle}</p>}
              {ride.driver_plate && <p className="text-xs text-gray-500">Placa: {ride.driver_plate}</p>}
              {ride.driver_rating_val && (
                <div className="flex items-center gap-1 mt-0.5">
                  <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                  <span className="text-xs text-amber-400">{ride.driver_rating_val.toFixed(1)}</span>
                </div>
              )}
            </div>
            {ride.driver_phone && (
              <button onClick={() => toast.info(`Llamando a ${ride.driver_name}...`)} className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center hover:bg-emerald-500/30">
                <Phone className="w-4 h-4 text-emerald-400" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Rating (if completed) */}
      {ride.status === 'completed' && (
        <div className="glass rounded-2xl p-4">
          <p className="text-xs font-semibold text-gray-400 mb-3">Tu calificacion</p>
          {ride.rider_rating ? (
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} className={`w-5 h-5 ${s <= ride.rider_rating! ? 'text-amber-400 fill-amber-400' : 'text-gray-600'}`} />
                ))}
              </div>
              <span className="text-sm text-amber-400 font-medium">{ride.rider_rating}/5</span>
            </div>
          ) : (
            <div>
              <p className="text-xs text-gray-500 mb-2">Califica este viaje</p>
              <div className="flex gap-2 mb-3">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button key={s} onClick={() => setRatingValue(s)} className="transition-transform hover:scale-110">
                    <Star className={`w-7 h-7 ${s <= ratingValue ? 'text-amber-400 fill-amber-400' : 'text-gray-600'}`} />
                  </button>
                ))}
              </div>
              {/* Comment textarea */}
              <div className="space-y-1.5 mb-3">
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
              <button onClick={handleRate} disabled={ratingValue === 0 || isRating} className="btn-neon text-white text-sm py-2 px-6 rounded-xl disabled:opacity-40">
                {isRating ? 'Enviando...' : 'Enviar calificacion'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="glass rounded-2xl overflow-hidden">
        <p className="text-xs font-semibold text-gray-400 p-4 pb-2">Opciones</p>

        <button onClick={() => router.push(`/client/ride/receipt?ride=${ride.id}`)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors">
          <FileText className="w-4 h-4 text-cyan-400" />
          <span className="text-sm text-white flex-1 text-left">Recibo</span>
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </button>

        <button onClick={() => { setIsHidden(!isHidden); toast.success(isHidden ? 'Viaje visible' : 'Viaje oculto'); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors">
          {isHidden ? <Eye className="w-4 h-4 text-gray-400" /> : <EyeOff className="w-4 h-4 text-gray-400" />}
          <span className="text-sm text-white flex-1 text-left">{isHidden ? 'Mostrar viaje' : 'Ocultar este viaje'}</span>
        </button>

        <button onClick={() => router.push('/client/support')} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors">
          <Headphones className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-white flex-1 text-left">Soporte</span>
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      {/* Help & Safety */}
      <div className="glass rounded-2xl overflow-hidden">
        <p className="text-xs font-semibold text-gray-400 p-4 pb-2">Ayuda y seguridad</p>

        <button onClick={() => router.push(`/client/support?topic=lost_item&ride=${ride.id}`)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors">
          <Package className="w-4 h-4 text-amber-400" />
          <span className="text-sm text-white flex-1 text-left">Encontre un objeto perdido</span>
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </button>

        <button onClick={() => router.push('/client/report')} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <span className="text-sm text-white flex-1 text-left">Reportar un problema de seguridad</span>
        </button>

        <button onClick={() => router.push('/client/support')} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors">
          <Shield className="w-4 h-4 text-emerald-400" />
          <span className="text-sm text-white flex-1 text-left">Soporte al usuario</span>
        </button>
      </div>
    </div>
  );
}
