'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import {
  ArrowLeft, AlertTriangle, UserX, MapPin, Clock, Shield,
  Car, Wallet, MessageSquare, ChevronRight, MoreHorizontal,
  X as XIcon, Loader2, Star, Navigation,
} from 'lucide-react';

// Didi-style predefined problem options
const PROBLEM_CATEGORIES = [
  {
    title: 'Problemas con el pasajero',
    problems: [
      { id: 'wrong_address', label: 'Direccion incorrecta', icon: MapPin },
      { id: 'no_show', label: 'Pasajero no se presento', icon: UserX },
      { id: 'late_passenger', label: 'Pasajero tarda mucho', icon: Clock },
      { id: 'rude_passenger', label: 'Pasajero grosero', icon: MessageSquare },
      { id: 'wrong_payment', label: 'Problema con el pago', icon: Wallet },
    ],
  },
  {
    title: 'Problemas con el viaje',
    problems: [
      { id: 'accepted_error', label: 'Acepte el viaje por error', icon: AlertTriangle },
      { id: 'unsafe_pickup', label: 'Punto de partida poco seguro', icon: Shield },
      { id: 'route_issue', label: 'Problema con la ruta', icon: Navigation },
      { id: 'vehicle_issue', label: 'Problema con el vehiculo', icon: Car },
    ],
  },
  {
    title: 'Otro',
    problems: [
      { id: 'other', label: 'Otro problema', icon: MoreHorizontal },
    ],
  },
];

export default function ReportProblem() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, session } = useAuthStore();
  const [selectedProblem, setSelectedProblem] = useState<string | null>(null);
  const [customReason, setCustomReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rideId, setRideId] = useState<string | null>(null);
  const [riderName, setRiderName] = useState<string>('Pasajero');
  const [riderRating, setRiderRating] = useState<number>(5.0);
  const [ridePrice, setRidePrice] = useState<number>(0);
  const [rideType, setRideType] = useState<string>('Estandar');

  useEffect(() => {
    const id = searchParams.get('rideId');
    if (id) {
      setRideId(id);
      supabase.from('rides').select('*').eq('id', id).single().then(({ data }) => {
        if (data) {
          setRidePrice(data.price || 0);
          const typeLabels: Record<string, string> = {
            standard: 'Estandar', premium: 'Premium', suv: 'SUV',
            moto: 'Moto', moto_express: 'Moto Express', grua: 'Grua', flete: 'Flete',
          };
          setRideType(typeLabels[data.ride_type || 'standard'] || 'Estandar');
          if (data.rider_id) {
            supabase.from('profiles').select('name').eq('id', data.rider_id).single().then(({ data: profile }) => {
              if (profile) setRiderName(profile.name);
            });
            supabase.from('reviews').select('rating').eq('reviewee_id', data.rider_id).then(({ data: reviews }) => {
              if (reviews && reviews.length > 0) {
                const avg = reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length;
                setRiderRating(Math.round(avg * 10) / 10);
              }
            });
          }
        }
      });
    }
  }, [searchParams]);

  const handleSubmit = useCallback(async () => {
    if (!selectedProblem) {
      toast.error('Selecciona un problema');
      return;
    }
    if (selectedProblem === 'other' && !customReason.trim()) {
      toast.error('Describe el problema');
      return;
    }
    setIsSubmitting(true);
    try {
      const reason = selectedProblem === 'other' ? customReason.trim() : selectedProblem;
      if (rideId && session?.access_token) {
        const res = await fetch('/api/rides/update-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ ride_id: rideId, new_status: 'cancelled', cancel_reason: reason }),
        });
        const data = await res.json();
        if (data.success) {
          toast.success('Problema reportado correctamente');
          router.push('/driver/rides');
        } else {
          toast.error(data.error || 'Error al reportar problema');
        }
      } else {
        toast.success('Problema reportado');
        router.back();
      }
    } catch {
      toast.error('Error de conexion');
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedProblem, customReason, rideId, session?.access_token, router]);

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-white/5 transition-colors">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <h1 className="text-lg font-bold text-white">Reportar problema</h1>
      </div>

      {/* Trip Info Bar (Didi pattern) */}
      {rideId && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/5 rounded-2xl p-3 flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white font-bold text-sm">
              {riderName.charAt(0)}
            </div>
            <div>
              <p className="text-sm font-medium text-white">{riderName}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="flex items-center gap-0.5">
                  <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                  <span className="text-xs text-gray-400">{riderRating.toFixed(2)}</span>
                </div>
                <span className="text-xs text-gray-600">|</span>
                <span className="text-xs text-gray-400">{rideType}</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-base font-bold text-amber-400">₡{ridePrice.toLocaleString()}</p>
          </div>
        </motion.div>
      )}

      {/* Problem Categories (Didi pattern) */}
      {PROBLEM_CATEGORIES.map((category, catIdx) => (
        <motion.div
          key={category.title}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: catIdx * 0.05 }}
        >
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">
            {category.title}
          </p>
          <div className="space-y-1.5">
            {category.problems.map((problem) => {
              const isSelected = selectedProblem === problem.id;
              return (
                <button
                  key={problem.id}
                  onClick={() => setSelectedProblem(problem.id)}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-xl transition-all ${
                    isSelected
                      ? 'bg-red-500/15 border border-red-500/30'
                      : 'bg-white/5 border border-transparent hover:bg-white/8'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isSelected ? 'bg-red-500/20' : 'bg-white/5'
                  }`}>
                    {isSelected ? (
                      <XIcon className="w-4 h-4 text-red-400" />
                    ) : (
                      <problem.icon className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                  <span className={`text-sm font-medium ${
                    isSelected ? 'text-red-400' : 'text-white'
                  }`}>
                    {problem.label}
                  </span>
                  <ChevronRight className={`w-4 h-4 ml-auto ${
                    isSelected ? 'text-red-400' : 'text-gray-600'
                  }`} />
                </button>
              );
            })}
          </div>
        </motion.div>
      ))}

      {/* Custom reason for "other" */}
      {selectedProblem === 'other' && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="overflow-hidden"
        >
          <textarea
            value={customReason}
            onChange={(e) => setCustomReason(e.target.value)}
            placeholder="Describe el problema..."
            maxLength={500}
            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white placeholder-gray-500 outline-none focus:border-red-500/50 resize-none h-24"
          />
        </motion.div>
      )}

      {/* Submit Button */}
      <motion.button
        onClick={handleSubmit}
        disabled={!selectedProblem || isSubmitting}
        className={`w-full font-bold py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all ${
          selectedProblem
            ? 'bg-gradient-to-r from-red-600 to-red-500 text-white shadow-lg shadow-red-500/20'
            : 'bg-gray-700 text-gray-500'
        }`}
        whileTap={selectedProblem ? { scale: 0.98 } : undefined}
      >
        {isSubmitting ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <AlertTriangle className="w-5 h-5" />
        )}
        Reportar problema
      </motion.button>

      {/* Safety Notice */}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-4">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-amber-400 shrink-0" />
          <p className="text-[10px] text-amber-400">
            Si estas en una situacion de emergencia, usa el boton SOS en lugar de reportar.
          </p>
        </div>
      </div>
    </div>
  );
}
