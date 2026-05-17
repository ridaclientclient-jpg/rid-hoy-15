'use client';

import { Suspense } from 'react';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import {
  CheckCircle2, MapPin, Clock, DollarSign, Route as RouteIcon,
  Star, ChevronRight, TrendingUp, Award,
} from 'lucide-react';

interface RideData {
  id: string;
  origin: string;
  destination: string;
  origin_lat?: number;
  origin_lng?: number;
  dest_lat?: number;
  dest_lng?: number;
  price: number;
  distance?: number;
  duration?: number;
  driver_earnings?: number;
  commission_rate?: number;
  tip_amount?: number;
  ride_type?: string;
  payment_method?: string;
  created_at: string;
  updated_at: string;
  rider_id: string;
  rider_name?: string;
}

function RideSummary() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const [ride, setRide] = useState<RideData | null>(null);
  const [loading, setLoading] = useState(true);

  const rideId = searchParams.get('rideId');

  const fetchRide = useCallback(async () => {
    if (!rideId || !user?.id) { setLoading(false); return; }
    try {
      const { data, error } = await supabase
        .from('rides')
        .select('*')
        .eq('id', rideId)
        .single();

      if (error || !data) { setLoading(false); return; }

      // Fetch rider name
      let riderName = 'Pasajero';
      try {
        const { data: profile } = await supabase.from('profiles').select('name').eq('id', data.rider_id).single();
        if (profile) riderName = profile.name;
      } catch {}

      setRide({ ...data, rider_name: riderName });
    } catch (err) {
      console.error('Error fetching ride:', err);
    } finally {
      setLoading(false);
    }
  }, [rideId, user?.id]);

  useEffect(() => { fetchRide(); }, [fetchRide]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-120px)]">
        <div className="w-10 h-10 border-3 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!ride) {
    return (
      <div className="p-4 text-center space-y-4">
        <p className="text-gray-400">Viaje no encontrado</p>
        <button onClick={() => router.push('/driver/rides')} className="btn-neon text-white px-6 py-3 rounded-xl font-medium">Ir a Viajes</button>
      </div>
    );
  }

  const commissionRate = ride.commission_rate || 15;
  const grossEarnings = ride.price;
  const commission = Math.round(grossEarnings * commissionRate / 100);
  const tip = ride.tip_amount || 0;
  const netEarnings = (ride.driver_earnings || Math.round(grossEarnings * (1 - commissionRate / 100))) + tip;
  const actualDuration = ride.duration || 0;

  const rideTypeLabels: Record<string, string> = {
    standard: 'Estandar', premium: 'Premium', suv: 'SUV',
    moto: 'Moto', moto_express: 'Moto Express', grua: 'Grua', flete: 'Flete',
  };

  const paymentLabels: Record<string, string> = {
    cash: 'Efectivo', wallet: 'Billetera', card: 'Tarjeta', sinpe: 'SINPE',
  };

  return (
    <div className="p-4 space-y-4">
      {/* Success Header */}
      <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="text-center pt-6 pb-2">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
          className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4"
        >
          <CheckCircle2 className="w-10 h-10 text-emerald-400" />
        </motion.div>
        <h1 className="text-xl font-bold text-white">Viaje Completado!</h1>
        <p className="text-sm text-gray-400 mt-1">Resumen de tu viaje</p>
      </motion.div>

      {/* Net Earnings - Big Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass-strong rounded-2xl p-6 text-center border border-emerald-500/30"
      >
        <p className="text-xs text-gray-400 mb-1">Ganancia neta</p>
        <p className="text-4xl font-bold text-emerald-400">+₡{netEarnings.toLocaleString()}</p>
        {tip > 0 && (
          <p className="text-xs text-amber-400 mt-1 flex items-center justify-center gap-1">
            <DollarSign className="w-3 h-3" /> Incluye ₡{tip.toLocaleString()} de propina
          </p>
        )}
      </motion.div>

      {/* Route */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="glass rounded-2xl p-4 space-y-3"
      >
        <h3 className="text-sm font-semibold text-white flex items-center gap-2"><RouteIcon className="w-4 h-4 text-cyan-400" />Ruta</h3>
        <div className="space-y-2">
          <div className="flex items-start gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
            <div><p className="text-[10px] text-gray-500">Origen</p><p className="text-sm text-white">{ride.origin}</p></div>
          </div>
          <div className="border-l border-dashed border-gray-700 ml-1 h-3" />
          <div className="flex items-start gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
            <div><p className="text-[10px] text-gray-500">Destino</p><p className="text-sm text-white">{ride.destination}</p></div>
          </div>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <span className="text-xs text-gray-500">Pasajero:</span>
          <span className="text-xs text-white">{ride.rider_name}</span>
        </div>
      </motion.div>

      {/* Earnings Breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="glass rounded-2xl p-4 space-y-3"
      >
        <h3 className="text-sm font-semibold text-white flex items-center gap-2"><DollarSign className="w-4 h-4 text-emerald-400" />Desglose de ganancias</h3>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Tarifa del viaje</span>
            <span className="text-sm font-medium text-white">₡{grossEarnings.toLocaleString()}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Comision RIDA ({commissionRate}%)</span>
            <span className="text-sm font-medium text-red-400">-₡{commission.toLocaleString()}</span>
          </div>

          {tip > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Propina del pasajero</span>
              <span className="text-sm font-medium text-amber-400">+₡{tip.toLocaleString()}</span>
            </div>
          )}

          <div className="border-t border-white/10 pt-2 flex items-center justify-between">
            <span className="text-sm font-bold text-white">Tu ganancia</span>
            <span className="text-lg font-bold text-emerald-400">₡{netEarnings.toLocaleString()}</span>
          </div>
        </div>
      </motion.div>

      {/* Trip Details */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="glass rounded-2xl p-4 space-y-3"
      >
        <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Clock className="w-4 h-4 text-blue-400" />Detalles del viaje</h3>

        <div className="grid grid-cols-2 gap-3">
          <div className="glass rounded-xl p-3">
            <p className="text-[10px] text-gray-500">Distancia</p>
            <p className="text-base font-bold text-white">{ride.distance || 0} km</p>
          </div>
          <div className="glass rounded-xl p-3">
            <p className="text-[10px] text-gray-500">Duracion</p>
            <p className="text-base font-bold text-white">{actualDuration} min</p>
          </div>
          <div className="glass rounded-xl p-3">
            <p className="text-[10px] text-gray-500">Tipo de viaje</p>
            <p className="text-base font-bold text-white">{rideTypeLabels[ride.ride_type || 'standard'] || 'Estandar'}</p>
          </div>
          <div className="glass rounded-xl p-3">
            <p className="text-[10px] text-gray-500">Metodo de pago</p>
            <p className="text-base font-bold text-white">{paymentLabels[ride.payment_method || 'cash'] || 'Efectivo'}</p>
          </div>
        </div>

        <div className="text-center pt-1">
          <p className="text-[10px] text-gray-600">
            {new Date(ride.created_at).toLocaleDateString('es-CR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
          </p>
        </div>
      </motion.div>

      {/* Actions */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="space-y-3 pb-4"
      >
        <button
          onClick={() => router.push(`/driver/ride-rating?rideId=${ride.id}`)}
          className="w-full btn-neon text-white font-medium py-3.5 rounded-xl flex items-center justify-center gap-2"
        >
          <Star className="w-5 h-5" /> Calificar pasajero
        </button>
        <button
          onClick={() => router.push('/driver/rides')}
          className="w-full border border-white/10 text-gray-300 font-medium py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-white/5 transition-colors"
        >
          <ChevronRight className="w-4 h-4" /> Volver a viajes
        </button>
      </motion.div>
    </div>
  );
}

export default function RideSummaryPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-[calc(100vh-120px)]">
        <div className="w-10 h-10 border-3 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    }>
      <RideSummary />
    </Suspense>
  );
}
