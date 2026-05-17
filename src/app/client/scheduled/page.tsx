'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Clock, MapPin, Car, Navigation, Trash2, Edit3, ChevronRight, ArrowLeft, Loader2, AlertCircle, DollarSign, Wallet, CreditCard, Smartphone, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';

interface ScheduledRide {
  ride_id: string;
  origin: string;
  destination: string;
  price: number;
  scheduled_at: string;
  ride_type: string;
  payment_method: string;
  stops: any[];
  distance: number;
  duration: number;
  eta_minutes: number;
  created_at: string;
  status: string;
}

const RIDE_TYPE_LABELS: Record<string, string> = {
  standard: 'Economico',
  premium: 'Premium',
  suv: 'SUV',
  moto: 'Moto',
  moto_express: 'Moto Express',
  grua: 'Grua',
  flete: 'Flete',
};

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  wallet: 'Billetera',
  card: 'Tarjeta',
  sinpe: 'SINPE',
};

function formatScheduledDate(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const rideDate = new Date(d);
  rideDate.setHours(0, 0, 0, 0);

  let dateLabel = '';
  if (rideDate.getTime() === today.getTime()) {
    dateLabel = 'Hoy';
  } else if (rideDate.getTime() === tomorrow.getTime()) {
    dateLabel = 'Manana';
  } else {
    dateLabel = d.toLocaleDateString('es-CR', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  const time = d.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' });
  return `${dateLabel} a las ${time}`;
}

function getTimeUntil(dateStr: string): string {
  const now = new Date();
  const target = new Date(dateStr);
  const diff = target.getTime() - now.getTime();

  if (diff <= 0) return 'Iniciando...';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return `${days}d ${remHours}h`;
  }
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export default function ScheduledRidesPage() {
  const router = useRouter();
  const { user, session } = useAuthStore();
  const [rides, setRides] = useState<ScheduledRide[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelRideId, setCancelRideId] = useState<string | null>(null);
  const [rescheduleRideId, setRescheduleRideId] = useState<string | null>(null);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchRides = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/rides/scheduled', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (data.success) {
        setRides(data.rides || []);
      }
    } catch (err) {
      console.error('Error fetching scheduled rides:', err);
      toast.error('Error al cargar viajes programados');
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    fetchRides();
    // Refresh every 60 seconds
    const interval = setInterval(fetchRides, 60000);
    return () => clearInterval(interval);
  }, [fetchRides]);

  const handleCancel = async (rideId: string) => {
    if (!session?.access_token) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/rides/scheduled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: 'cancel', ride_id: rideId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'Viaje cancelado');
        setCancelRideId(null);
        fetchRides();
      } else {
        toast.error(data.error || 'Error al cancelar');
      }
    } catch {
      toast.error('Error de conexion');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReschedule = async (rideId: string) => {
    if (!session?.access_token || !newDate || !newTime) return;

    const scheduledAt = new Date(`${newDate}T${newTime}:00`);
    const minTime = new Date(Date.now() + 30 * 60000);
    if (scheduledAt < minTime) {
      toast.error('El viaje debe programarse con al menos 30 minutos de anticipacion');
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch('/api/rides/scheduled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          action: 'reschedule',
          ride_id: rideId,
          new_scheduled_at: scheduledAt.toISOString(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'Viaje reprogramado');
        setRescheduleRideId(null);
        setNewDate('');
        setNewTime('');
        fetchRides();
      } else {
        toast.error(data.error || data.message || 'Error al reprogramar');
      }
    } catch {
      toast.error('Error de conexion');
    } finally {
      setActionLoading(false);
    }
  };

  const PaymentIcon = ({ method }: { method: string }) => {
    if (method === 'wallet') return <Wallet className="w-3.5 h-3.5" />;
    if (method === 'card') return <CreditCard className="w-3.5 h-3.5" />;
    if (method === 'sinpe') return <Smartphone className="w-3.5 h-3.5" />;
    return <DollarSign className="w-3.5 h-3.5" />;
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
            <ArrowLeft className="w-4 h-4 text-gray-400" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">Viajes Programados</h1>
            <p className="text-xs text-gray-500">Cargando...</p>
          </div>
        </div>
        {[1, 2, 3].map(i => (
          <div key={i} className="glass rounded-2xl p-4 animate-pulse">
            <div className="h-4 bg-white/10 rounded w-1/3 mb-3" />
            <div className="h-3 bg-white/5 rounded w-2/3 mb-2" />
            <div className="h-3 bg-white/5 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => router.back()} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
          <ArrowLeft className="w-4 h-4 text-gray-400" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white">Viajes Programados</h1>
          <p className="text-xs text-gray-500">{rides.length} viaje{rides.length !== 1 ? 's' : ''} pendiente{rides.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => router.push('/client/ride?mode=schedule')}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs font-medium hover:opacity-90 transition-opacity"
        >
          + Nuevo
        </button>
      </div>

      {/* Empty State */}
      {!loading && rides.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-12"
        >
          <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-8 h-8 text-purple-400" />
          </div>
          <p className="text-white font-medium mb-1">Sin viajes programados</p>
          <p className="text-sm text-gray-500 mb-4">Programa tu proximo viaje y ahorra tiempo</p>
          <button
            onClick={() => router.push('/client/ride?mode=schedule')}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-medium"
          >
            Programar Viaje
          </button>
        </motion.div>
      )}

      {/* Scheduled Rides List */}
      <div className="space-y-3">
        {rides.map((ride, index) => (
          <motion.div
            key={ride.ride_id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="glass rounded-2xl p-4 border border-purple-500/10"
          >
            {/* Top: Time info */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-purple-500/15 flex items-center justify-center">
                  <Calendar className="w-4.5 h-4.5 text-purple-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{formatScheduledDate(ride.scheduled_at)}</p>
                  <p className="text-[10px] text-gray-500">Programado</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-purple-400">{getTimeUntil(ride.scheduled_at)}</p>
                <p className="text-[10px] text-gray-500">faltan</p>
              </div>
            </div>

            {/* Route */}
            <div className="bg-white/5 rounded-xl p-3 mb-3">
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center gap-0.5 mt-0.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <div className="w-0.5 h-6 bg-white/10" />
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <p className="text-xs text-gray-500">Origen</p>
                    <p className="text-sm text-white truncate">{ride.origin}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Destino</p>
                    <p className="text-sm text-white truncate">{ride.destination}</p>
                  </div>
                </div>
              </div>

              {/* Stops indicator */}
              {ride.stops && Array.isArray(ride.stops) && ride.stops.length > 0 && (
                <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-white/5">
                  <Navigation className="w-3 h-3 text-amber-400" />
                  <span className="text-[10px] text-gray-500">{ride.stops.length} parada{ride.stops.length > 1 ? 's' : ''} intermedia{ride.stops.length > 1 ? 's' : ''}</span>
                </div>
              )}
            </div>

            {/* Info Row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <Car className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-xs text-gray-400">{RIDE_TYPE_LABELS[ride.ride_type] || ride.ride_type}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <PaymentIcon method={ride.payment_method} />
                  <span className="text-xs text-gray-400">{PAYMENT_LABELS[ride.payment_method] || ride.payment_method}</span>
                </div>
                {ride.distance > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Navigation className="w-3 h-3 text-gray-500" />
                    <span className="text-xs text-gray-500">{ride.distance.toFixed(1)} km</span>
                  </div>
                )}
              </div>
              <span className="text-sm font-bold text-emerald-400">₡{ride.price.toLocaleString()}</span>
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-3 pt-3 border-t border-white/5">
              <button
                onClick={() => {
                  setRescheduleRideId(ride.ride_id);
                  const d = new Date(ride.scheduled_at);
                  setNewDate(`${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`);
                  setNewTime(`${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`);
                }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-blue-500/10 text-blue-400 text-xs font-medium hover:bg-blue-500/20 transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Reprogramar
              </button>
              <button
                onClick={() => setCancelRideId(ride.ride_id)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Cancelar
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Cancel Confirmation Modal */}
      <AnimatePresence>
        {cancelRideId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setCancelRideId(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-strong rounded-2xl p-6 w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-12 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-6 h-6 text-red-400" />
              </div>
              <h3 className="text-lg font-bold text-white text-center mb-2">Cancelar Viaje</h3>
              <p className="text-sm text-gray-400 text-center mb-6">
                Estas seguro de cancelar este viaje programado? Esta accion no se puede deshacer.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setCancelRideId(null)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 text-gray-300 text-sm font-medium hover:bg-white/10 transition-colors"
                >
                  No, mantener
                </button>
                <button
                  onClick={() => handleCancel(cancelRideId)}
                  disabled={actionLoading}
                  className="flex-1 py-2.5 rounded-xl bg-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Si, cancelar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reschedule Modal */}
      <AnimatePresence>
        {rescheduleRideId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => { setRescheduleRideId(null); setNewDate(''); setNewTime(''); }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-strong rounded-2xl p-6 w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center">
                  <Edit3 className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Reprogramar Viaje</h3>
                  <p className="text-[10px] text-gray-500">Selecciona nueva fecha y hora</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-400 mb-1.5 block">Nueva fecha</label>
                  <input
                    type="date"
                    value={newDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => { setNewDate(e.target.value); setNewTime(''); }}
                    className="w-full glass rounded-xl p-3 text-white bg-transparent text-sm outline-none focus:ring-1 focus:ring-blue-500/50 [color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-400 mb-1.5 block">Nueva hora</label>
                  <input
                    type="time"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="w-full glass rounded-xl p-3 text-white bg-transparent text-sm outline-none focus:ring-1 focus:ring-blue-500/50 [color-scheme:dark]"
                  />
                </div>

                {newDate && newTime && (
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-blue-400 shrink-0" />
                    <p className="text-xs text-blue-300">
                      Nuevo horario: {formatScheduledDate(`${newDate}T${newTime}:00`)}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => { setRescheduleRideId(null); setNewDate(''); setNewTime(''); }}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 text-gray-300 text-sm font-medium hover:bg-white/10 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleReschedule(rescheduleRideId)}
                  disabled={actionLoading || !newDate || !newTime}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Confirmar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
