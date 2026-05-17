'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { MapPin, Star, ChevronRight, Car, Package, Loader2 } from 'lucide-react';
import { useRideStore } from '@/store/rideStore';
import { useAuthStore } from '@/store/authStore';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';

const rideTypeNames: Record<string, string> = {
  standard: 'Economico',
  premium: 'Premium',
  suv: 'SUV',
  moto: 'Moto',
  moto_express: 'Moto Express',
  grua: 'Grua',
  flete: 'Flete',
};

const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  completed: { label: 'Completado', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20' },
  delivered: { label: 'Entregado', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20' },
  cancelled: { label: 'Cancelado', color: 'text-red-400', bgColor: 'bg-red-500/20' },
  searching: { label: 'Buscando', color: 'text-amber-400', bgColor: 'bg-amber-500/20' },
  pending: { label: 'Pendiente', color: 'text-amber-400', bgColor: 'bg-amber-500/20' },
  assigned: { label: 'Asignado', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
  picked_up: { label: 'Recogido', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
  in_transit: { label: 'En camino', color: 'text-purple-400', bgColor: 'bg-purple-500/20' },
  arriving: { label: 'En camino', color: 'text-cyan-400', bgColor: 'bg-cyan-500/20' },
  started: { label: 'En viaje', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20' },
};

export default function ClientHistory() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { rideHistory, fetchRideHistory } = useRideStore();
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (user?.id) {
      const fetchData = async () => {
        try {
          await fetchRideHistory(user.id);
          const { data: delData } = await supabase
            .from('deliveries')
            .select('*, vendors(store_name)')
            .eq('customer_id', user.id)
            .order('created_at', { ascending: false });
          
          if (!cancelled && delData) setDeliveries(delData);
        } catch (err) {
          console.error('History fetch error:', err);
        } finally {
          if (!cancelled) setLoading(false);
        }
      };
      fetchData();
    }
    return () => { cancelled = true; };
  }, [user?.id, fetchRideHistory]);

  const combinedHistory = useMemo(() => {
    const rides = rideHistory.map(r => ({ ...r, hType: 'ride' }));
    const dels = deliveries.map(d => ({ ...d, hType: 'delivery' }));
    return [...rides, ...dels].sort((a: any, b: any) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [rideHistory, deliveries]);

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <h1 className="text-xl font-bold text-white">Historial</h1>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 pb-20 space-y-4">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-xl font-bold text-white">Tu Historial</h1>
        <p className="text-sm text-gray-400 mt-1">{combinedHistory.length} actividades</p>
      </motion.div>

      <div className="space-y-3">
        {combinedHistory.map((item: any, i: number) => {
          const isRide = item.hType === 'ride';
          const sc = statusConfig[item.status] || statusConfig.completed;
          const typeName = isRide ? (rideTypeNames[item.ride_type || ''] || 'Economico') : 'Pedido Market';
          
          return (
            <motion.button
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => router.push(isRide ? `/client/ride/${item.id}` : `/client/market/tracking/${item.id}`)}
              className="w-full glass rounded-xl p-4 text-left hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sc.bgColor} ${sc.color} uppercase`}>
                    {sc.label}
                  </span>
                  <div className="flex items-center gap-1.5 bg-white/5 px-2 py-0.5 rounded-full">
                    {isRide ? <Car className="w-3 h-3 text-gray-400" /> : <Package className="w-3 h-3 text-gray-400" />}
                    <span className="text-[10px] text-gray-400 font-medium">{typeName}</span>
                  </div>
                </div>
                <span className="text-[11px] text-gray-500 font-medium">
                  {new Date(item.created_at).toLocaleDateString('es-CR', { day: 'numeric', month: 'short' })}
                </span>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 mb-1">
                    <MapPin className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />
                    <p className="text-sm text-white truncate font-medium">
                      {isRide ? item.destination : item.delivery_address}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 truncate ml-5">
                    {isRide ? `Desde: ${item.origin}` : `De: ${item.vendors?.store_name || 'Tienda'}`}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-white">
                    ₡{(Number(item.total) || Number(item.price)).toLocaleString()}
                  </p>
                  <div className="flex items-center justify-end gap-1 mt-1">
                    <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                    <span className="text-[10px] font-bold text-amber-400">
                      {isRide ? (item.driver_rating || '5.0') : (item.courier_rating || '5.0')}
                    </span>
                  </div>
                </div>
              </div>
            </motion.button>
          );
        })}

        {combinedHistory.length === 0 && (
          <div className="text-center py-12 glass rounded-2xl border-dashed border-white/10">
            <Clock className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No tienes actividad reciente</p>
          </div>
        )}
      </div>
    </div>
  );
}
