'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Star, MapPin, CheckCircle2, Loader2, User,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';

interface RideInfo {
  id: string;
  rider_id: string;
  origin: string;
  destination: string;
  price: number;
  rider_name?: string;
}

export default function DriverRideRatingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
        </div>
      }
    >
      <DriverRideRatingContent />
    </Suspense>
  );
}

function DriverRideRatingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rideId = searchParams.get('rideId');
  const { user } = useAuthStore();

  const [ride, setRide] = useState<RideInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRating, setSelectedRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [alreadyRated, setAlreadyRated] = useState(false);

  useEffect(() => {
    if (!rideId) {
      router.replace('/driver/rides');
      return;
    }
    fetchRideAndCheckRating();
  }, [rideId]);

  const fetchRideAndCheckRating = async () => {
    try {
      // Fetch ride info
      const { data: rideData, error: rideError } = await supabase
        .from('rides')
        .select('*')
        .eq('id', rideId)
        .single();

      if (rideError || !rideData) {
        toast.error('Viaje no encontrado');
        router.replace('/driver/rides');
        return;
      }

      // Fetch rider info
      let riderName: string | undefined;
      if (rideData.rider_id) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', rideData.rider_id)
          .single();

        if (profileData) {
          riderName = (profileData as any).name;
        }
      }

      setRide({
        id: rideData.id,
        rider_id: rideData.rider_id,
        origin: rideData.origin,
        destination: rideData.destination,
        price: rideData.price,
        rider_name: riderName,
      });

      // Check if driver already rated this ride
      if (user) {
        const { data: existingReview } = await supabase
          .from('reviews')
          .select('id')
          .eq('ride_id', rideId)
          .eq('reviewer_id', user.id)
          .maybeSingle();

        if (existingReview) {
          setAlreadyRated(true);
        }
      }
    } catch {
      toast.error('Error al cargar el viaje');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!ride || !user || selectedRating === 0) return;
    setIsSubmitting(true);

    try {
      // Update driver_rating on rides table
      await supabase
        .from('rides')
        .update({ driver_rating: selectedRating })
        .eq('id', ride.id);

      // Insert into reviews table (reviewer=driver, reviewee=rider)
      const { error } = await supabase.from('reviews').insert({
        ride_id: ride.id,
        reviewer_id: user.id,
        reviewee_id: ride.rider_id,
        rating: selectedRating,
        comment: reviewComment.trim() || null,
      });

      if (error) throw error;

      toast.success('Calificacion enviada al pasajero!');
      router.replace('/driver/rides');
    } catch {
      toast.error('Error al enviar calificacion');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  if (!ride) return null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-xl hover:bg-white/5 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <h1 className="text-lg font-bold text-white">Calificar pasajero</h1>
      </div>

      {alreadyRated ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass rounded-2xl p-8 text-center"
        >
          <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-white mb-2">
            Ya calificaste este viaje
          </h2>
          <p className="text-sm text-gray-400 mb-4">
            Tu calificacion fue enviada anteriormente.
          </p>
          <button
            onClick={() => router.replace('/driver/rides')}
            className="bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-medium py-2.5 px-6 rounded-xl hover:bg-emerald-500/30 transition-colors"
          >
            Volver a viajes
          </button>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Ride summary card */}
          <div className="glass rounded-2xl p-4 space-y-3">
            {/* Rider info - anonymous */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center text-white text-lg font-bold">
                <User className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Pasajero</p>
                <p className="text-xs text-gray-400">
                  {'\u20A1'}{ride.price.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Route */}
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center mt-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <div className="w-0.5 h-8 bg-white/10" />
                <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
              </div>
              <div className="flex-1 space-y-3">
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
          </div>

          {/* Rating card */}
          <div className="glass rounded-2xl p-5 space-y-4">
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-300 mb-1">
                Como fue tu pasajero?
              </p>
              <p className="text-xs text-gray-500">
                Calificacion anonima
              </p>
            </div>

            {/* Star selector */}
            <div className="flex items-center justify-center gap-3">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  onClick={() => setSelectedRating(s)}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    className={`w-12 h-12 transition-colors ${
                      s <= selectedRating
                        ? 'text-emerald-400 fill-emerald-400'
                        : 'text-gray-600'
                    }`}
                  />
                </button>
              ))}
            </div>

            {selectedRating > 0 && (
              <p className="text-center text-sm text-emerald-400 font-medium">
                {selectedRating === 5 && 'Excelente pasajero!'}
                {selectedRating === 4 && 'Buen pasajero'}
                {selectedRating === 3 && 'Normal'}
                {selectedRating === 2 && 'Malo'}
                {selectedRating === 1 && 'Muy malo'}
              </p>
            )}

            {/* Comment textarea */}
            <div className="space-y-1.5">
              <textarea
                value={reviewComment}
                onChange={(e) => {
                  if (e.target.value.length <= 300) setReviewComment(e.target.value);
                }}
                placeholder="Deja un comentario sobre el pasajero (opcional)..."
                maxLength={300}
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-emerald-500/50 transition-colors"
              />
              <p className="text-[10px] text-gray-500 text-right">
                {reviewComment.length}/300
              </p>
            </div>

            {/* Submit button */}
            <button
              onClick={handleSubmit}
              disabled={selectedRating === 0 || isSubmitting}
              className="w-full bg-emerald-500 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-emerald-600 transition-colors disabled:opacity-40"
              style={{
                boxShadow: selectedRating > 0
                  ? '0 0 20px rgba(16, 185, 129, 0.3)'
                  : 'none',
              }}
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Star className="w-4 h-4" />
              )}
              {isSubmitting ? 'Enviando...' : 'Enviar calificacion'}
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
