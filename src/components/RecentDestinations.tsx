'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock, MapPin, ChevronRight, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useRecentDestinationsStore } from '@/store/recentDestinationsStore';

interface RecentDestinationsProps {
  onSelect: (address: string, lat: number | null, lng: number | null) => void;
  targetLabel?: string;
}

export default function RecentDestinations({ onSelect, targetLabel }: RecentDestinationsProps) {
  const { user } = useAuthStore();
  const { destinations, isLoading, fetchRecentDestinations } = useRecentDestinationsStore();

  useEffect(() => {
    if (user?.id) {
      fetchRecentDestinations(user.id);
    }
  }, [user?.id, fetchRecentDestinations]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-400">
          {targetLabel ? `Direcciones Recientes — ${targetLabel}` : 'Direcciones Recientes'}
        </h2>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && destinations.length === 0 && (
        <div className="glass rounded-xl p-4 text-center">
          <Clock className="w-8 h-8 text-gray-600 mx-auto mb-2" />
          <p className="text-xs text-gray-500">No tienes direcciones recientes</p>
          <p className="text-[10px] text-gray-600 mt-1">
            Tus destinos aparecen aqui despues de solicitar un viaje
          </p>
        </div>
      )}

      {/* Destinations list */}
      {!isLoading && destinations.length > 0 && (
        <div className="space-y-2">
          {destinations.map((dest) => (
            <button
              key={dest.id}
              onClick={() => onSelect(dest.address, dest.lat, dest.lng)}
              className="w-full glass rounded-xl p-3 flex items-center gap-3 hover:bg-white/10 transition-colors cursor-pointer text-left"
            >
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-cyan-500/10 shrink-0">
                <Clock className="w-4 h-4 text-cyan-400" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{dest.address}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <MapPin className="w-3 h-3 text-gray-500 shrink-0" />
                  <p className="text-xs text-gray-500">{dest.ride_count} viaje{dest.ride_count !== 1 ? 's' : ''}</p>
                </div>
              </div>

              <ChevronRight className="w-4 h-4 text-gray-600 shrink-0" />
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
}
