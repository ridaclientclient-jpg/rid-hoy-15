'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { MapPin, Navigation, Car, Phone, Clock, Shield, AlertTriangle, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';

interface TokenShareData {
  share_id: string;
  ride_id: string;
  rider_name: string;
  driver_name: string;
  driver_phone: string;
  vehicle_info: string;
  origin: string;
  destination: string;
  status: string;
  location: {
    lat: number;
    lng: number;
    speed: number | null;
    heading: number | null;
    recorded_at: string;
  } | null;
  total_points: number;
  expires_at: string;
}

interface CodeShareData {
  id: string;
  origin: string;
  destination: string;
  status: string;
  driver_name: string;
  driver_vehicle: string;
  driver_rating: number;
  price: number;
  ride_type: string;
  distance: number;
  duration: number;
  driver_id?: string;
}

const STATUS_LABELS: Record<string, string> = {
  searching: 'Buscando conductor',
  assigned: 'Conductor asignado',
  arriving: 'Conductor en camino',
  started: 'En viaje',
  completed: 'Viaje completado',
  cancelled: 'Viaje cancelado',
  active: 'En vivo',
};

export default function TrackPage() {
  const params = useParams();
  const code = params.code as string;

  // Token-based share state (richer)
  const [tokenData, setTokenData] = useState<TokenShareData | null>(null);
  // Code-based share state (fallback)
  const [codeData, setCodeData] = useState<CodeShareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Try token-based API first
  const fetchTokenData = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch(`/api/tracking/share?token=${code}`);
      if (res.ok) {
        const data: TokenShareData = await res.json();
        setTokenData(data);
        setLastUpdate(new Date());
        return true;
      }
    } catch {
      // Fall through to code-based lookup
    }
    return false;
  }, [code]);

  // Fallback: code-based lookup via location_shares
  const fetchCodeData = useCallback(async () => {
    try {
      const { data: share } = await supabase
        .from('location_shares')
        .select('ride_id, is_active, expires_at')
        .eq('share_code', code)
        .eq('is_active', true)
        .single();

      if (!share) return false;
      if (new Date(share.expires_at) < new Date()) {
        setError('Este enlace ha expirado');
        return true; // Don't try again
      }

      const rideId = share.ride_id;
      if (!rideId) return false;

      const { data: rideData } = await supabase
        .from('rides')
        .select('*')
        .eq('id', rideId)
        .single();

      if (!rideData) return false;

      let driverName = 'Conductor';
      let driverVehicle = '';
      let driverRating = 0;

      if (rideData.driver_id) {
        const { data: driver } = await supabase
          .from('drivers')
          .select('user_id, rating, vehicles(model, color)')
          .eq('id', rideData.driver_id)
          .single();

        if (driver) {
          driverRating = driver.rating || 0;
          driverVehicle = driver.vehicles ? `${driver.vehicles.model} ${driver.vehicles.color}` : '';
          const { data: profile } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', driver.user_id)
            .single();
          if (profile) driverName = profile.name;
        }
      }

      setCodeData({
        id: rideData.id,
        origin: rideData.origin,
        destination: rideData.destination,
        status: rideData.status,
        driver_name: driverName,
        driver_vehicle: driverVehicle,
        driver_rating: driverRating,
        price: rideData.price,
        ride_type: rideData.ride_type || 'standard',
        distance: rideData.distance,
        duration: rideData.duration,
        driver_id: rideData.driver_id,
      });
      return true;
    } catch {
      return false;
    }
  }, [code]);

  // Initial load: try token first, then code
  useEffect(() => {
    const init = async () => {
      const tokenOk = await fetchTokenData();
      if (!tokenOk) {
        const codeOk = await fetchCodeData();
        if (!codeOk && !error) {
          setError('Enlace no valido o expirado');
        }
      }
      setLoading(false);
    };
    init();
  }, [fetchTokenData, fetchCodeData, error]);

  // Polling for token-based data
  useEffect(() => {
    if (!tokenData) return;
    const interval = setInterval(fetchTokenData, 5000);
    return () => clearInterval(interval);
  }, [tokenData, fetchTokenData]);

  // Realtime for code-based data
  useEffect(() => {
    if (!codeData) return;
    const channel = supabase
      .channel(`track-${code}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'rides',
      }, () => {
        fetchCodeData();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [code, codeData, fetchCodeData]);

  const getTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const seconds = Math.floor(diff / 1000);
    if (seconds < 10) return 'Ahora mismo';
    if (seconds < 60) return `Hace ${seconds} seg`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `Hace ${minutes} min`;
    return `Hace ${Math.floor(minutes / 60)} h`;
  };

  // ─── Loading ───
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a0f1a] to-[#0d1526] flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-cyan-500/10 flex items-center justify-center mx-auto animate-pulse">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          </div>
          <p className="text-sm text-gray-400">Cargando seguimiento...</p>
        </div>
      </div>
    );
  }

  // ─── Error ───
  if (error || (!tokenData && !codeData)) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a0f1a] to-[#0d1526] flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
            <XCircle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-lg font-bold text-white">Enlace no disponible</h2>
          <p className="text-sm text-gray-400">{error || 'Enlace no valido'}</p>
        </div>
      </div>
    );
  }

  // ─── Token-based view (richer: live GPS, map, speed) ───
  if (tokenData) {
    const speedKmh = tokenData.location?.speed ? Math.round(tokenData.location.speed * 3.6) : 0;
    const isExpired = tokenData.status !== 'active';
    const isActive = !isExpired;

    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a0f1a] to-[#0d1526]">
        {/* Header */}
        <div className="p-4 border-b border-white/5">
          <div className="max-w-md mx-auto flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <Navigation className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-sm font-bold text-white">RIDA — Seguimiento en vivo</h1>
              <p className="text-[10px] text-gray-500">
                {lastUpdate ? `Actualizado ${getTimeAgo(lastUpdate.toISOString())}` : ''}
              </p>
            </div>
            {isExpired ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-500/10 border border-gray-500/20">
                <CheckCircle className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-[10px] font-semibold text-gray-400">Finalizado</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-semibold text-emerald-400">En vivo</span>
              </div>
            )}
          </div>
        </div>

        {/* Map */}
        <div className="max-w-md mx-auto p-4">
          <div className="relative rounded-2xl overflow-hidden bg-[#0d1526] border border-white/5" style={{ height: '300px' }}>
            {tokenData.location ? (
              <>
                <iframe
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  src={`https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || ''}&q=${tokenData.location.lat},${tokenData.location.lng}&zoom=16&maptype=roadmap`}
                  title="Ubicacion en tiempo real"
                />
                {!isExpired && (
                  <div className="absolute top-3 left-3 glass-strong rounded-lg px-3 py-1.5 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] text-white font-semibold">
                      {speedKmh > 0 ? `${speedKmh} km/h` : 'En movimiento'}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center space-y-2">
                  <MapPin className="w-8 h-8 text-gray-600 mx-auto" />
                  <p className="text-xs text-gray-500">
                    {isExpired ? 'Viaje finalizado' : 'Esperando señal GPS...'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Trip Info */}
        <div className="max-w-md mx-auto px-4 pb-8 space-y-3">
          {tokenData.driver_name && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-2xl glass border border-white/5"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white font-bold text-lg">
                  {tokenData.driver_name.charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">{tokenData.driver_name}</p>
                  {tokenData.vehicle_info && (
                    <p className="text-xs text-gray-400">{tokenData.vehicle_info}</p>
                  )}
                </div>
                {tokenData.driver_phone && (
                  <a
                    href={`tel:${tokenData.driver_phone}`}
                    className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center hover:bg-emerald-500/30 transition-all"
                  >
                    <Phone className="w-4 h-4 text-emerald-400" />
                  </a>
                )}
              </div>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-4 rounded-2xl glass border border-white/5"
          >
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center mt-1">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <div className="w-0.5 h-6 bg-white/10" />
                <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Origen</p>
                  <p className="text-sm text-white">{tokenData.origin}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Destino</p>
                  <p className="text-sm text-white">{tokenData.destination}</p>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-4 rounded-2xl glass border border-white/5"
          >
            <div className="flex items-center gap-2 mb-3">
              <Car className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-semibold text-white">Datos del viaje</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <p className="text-lg font-bold text-white">{tokenData.total_points}</p>
                <p className="text-[10px] text-gray-500">Puntos GPS</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-white">{speedKmh}</p>
                <p className="text-[10px] text-gray-500">km/h</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-white">
                  {tokenData.location ? getTimeAgo(tokenData.location.recorded_at) : '--'}
                </p>
                <p className="text-[10px] text-gray-500">Ultima senal</p>
              </div>
            </div>
          </motion.div>

          <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-500/5 border border-blue-500/10">
            <Shield className="w-4 h-4 text-blue-400/60 mt-0.5 shrink-0" />
            <p className="text-[10px] text-gray-500 leading-relaxed">
              Este enlace es privado y temporal. La ubicacion se actualiza automaticamente.
              RIDA protege la privacidad de todos los usuarios.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Code-based view (fallback: ride status tracking) ───
  if (codeData) {
    const isActive = ['assigned', 'arriving', 'started'].includes(codeData.status);

    return (
      <div className="min-h-screen bg-[#0a0f1a]">
        {/* Header */}
        <div className="glass-strong p-4 border-b border-white/5">
          <div className="max-w-lg mx-auto flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-lg font-bold text-white">RIDA - Seguimiento en Vivo</h1>
              <p className="text-[10px] text-gray-500">Seguridad en cada viaje</p>
            </div>
            {isActive && (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                En vivo
              </span>
            )}
          </div>
        </div>

        <div className="max-w-lg mx-auto p-4 space-y-4">
          {/* Status */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-2xl p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-gray-500 uppercase tracking-wider">Estado del viaje</span>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                isActive ? 'bg-emerald-500/20 text-emerald-400' :
                codeData.status === 'completed' ? 'bg-blue-500/20 text-blue-400' :
                'bg-gray-500/20 text-gray-400'
              }`}>
                {STATUS_LABELS[codeData.status] || codeData.status}
              </span>
            </div>

            {/* Route */}
            <div className="bg-white/5 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center gap-1 mt-0.5">
                  <div className="w-3 h-3 rounded-full bg-emerald-400" />
                  <div className="w-0.5 h-8 bg-white/10" />
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                </div>
                <div className="flex-1 space-y-4">
                  <div>
                    <p className="text-[10px] text-gray-500">Origen</p>
                    <p className="text-sm text-white">{codeData.origin}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500">Destino</p>
                    <p className="text-sm text-white">{codeData.destination}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Ride info */}
            <div className="grid grid-cols-2 gap-3 mt-3">
              {codeData.distance > 0 && (
                <div className="bg-white/5 rounded-lg p-2 text-center">
                  <Navigation className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
                  <p className="text-sm font-bold text-white">{codeData.distance.toFixed(1)} km</p>
                  <p className="text-[10px] text-gray-500">Distancia</p>
                </div>
              )}
              {codeData.duration > 0 && (
                <div className="bg-white/5 rounded-lg p-2 text-center">
                  <Clock className="w-4 h-4 text-amber-400 mx-auto mb-1" />
                  <p className="text-sm font-bold text-white">{codeData.duration} min</p>
                  <p className="text-[10px] text-gray-500">Duracion est.</p>
                </div>
              )}
            </div>
          </motion.div>

          {/* Driver Info */}
          {codeData.driver_id && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass rounded-2xl p-4"
            >
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Conductor</p>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center">
                  <Car className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">{codeData.driver_name}</p>
                  {codeData.driver_vehicle && <p className="text-xs text-gray-400">{codeData.driver_vehicle}</p>}
                  {codeData.driver_rating > 0 && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-yellow-400 text-xs">&#9733;</span>
                      <span className="text-xs text-gray-300">{codeData.driver_rating.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* Safety Note */}
          <div className="glass rounded-xl p-3 border border-emerald-500/20">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              <p className="text-xs text-gray-400">
                Este enlace se actualiza en tiempo real. Si detectas alguna situacion de emergencia,
                llama al 911 inmediatamente.
              </p>
            </div>
          </div>

          {/* RIDA branding */}
          <div className="text-center pt-4">
            <p className="text-xs text-gray-600">Powered by <span className="font-bold text-cyan-600">RIDA</span> Supreme System</p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
