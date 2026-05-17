'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, MapPin, Package, Phone, Star, 
  Bike, Car, Truck, Clock, CheckCircle2, Navigation
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import { 
  HelpCircle, MessageSquare, ChevronRight, UtensilsCrossed, 
  Store as StoreIcon, ShieldCheck
} from 'lucide-react';
import RatingModal from '@/components/RatingModal';

// Reusing same map styling for consistency
import GoogleMap from '@/components/GoogleMap';

const vehicleIcons: Record<string, any> = {
  moto: Bike,
  bici: Bike,
  carro: Car,
  default: Truck,
};

const vehicleLabels: Record<string, string> = {
  moto: 'Motocicleta',
  bici: 'Bicicleta',
  carro: 'Automovil',
};

const statusConfig: Record<string, { label: string, desc: string, step: number }> = {
  pending: { label: 'Buscando Repartidor', desc: 'Esperando a que un repartidor acepte tu pedido.', step: 0 },
  assigned: { label: 'Repartidor Asignado', desc: 'El repartidor va de camino a la tienda.', step: 1 },
  picked_up: { label: 'Preparando Pedido', desc: 'El restaurante esta preparando tu comida.', step: 2 },
  in_transit: { label: 'En Camino', desc: 'Tu pedido va en camino a tu ubicacion.', step: 3 },
  delivered: { label: 'Entregado', desc: 'Tu pedido ha sido entregado exitosamente.', step: 4 },
  cancelled: { label: 'Cancelado', desc: 'Tu pedido fue cancelado.', step: -1 },
};

const STEPS = [
  { icon: Package, label: 'Pedido' },
  { icon: StoreIcon, label: 'Tienda' },
  { icon: UtensilsCrossed, label: 'Prep' },
  { icon: Bike, label: 'Camino' },
  { icon: ShieldCheck, label: 'Listo' }
];

export default function DeliveryTrackingPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { user } = useAuthStore();
  
  const [delivery, setDelivery] = useState<any>(null);
  const [vendor, setVendor] = useState<any>(null);
  const [courier, setCourier] = useState<any>(null);
  
  const [loading, setLoading] = useState(true);
  const [isRatingOpen, setIsRatingOpen] = useState(false);
  const [hasRated, setHasRated] = useState(false);
  
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    const fetchDeliveryData = async () => {
      try {
        // Fetch Delivery
        const { data: del, error: delErr } = await supabase
          .from('deliveries')
          .select('*')
          .eq('id', params.id)
          .single();
          
        if (delErr) throw delErr;
        setDelivery(del);
        
        // Fetch Vendor
        if (del?.vendor_id) {
          const { data: ven } = await supabase
            .from('vendors')
            .select('*, profiles(name)')
            .eq('id', del.vendor_id)
            .single();
          if (ven) setVendor(ven);
        }
        
        // Fetch Courier
        if (del?.courier_id) {
          const { data: cour } = await supabase
            .from('couriers')
            .select('*, profiles(name, phone, avatar_url)')
            .eq('id', del.courier_id)
            .single();
            
          if (cour) setCourier(cour);
        }
        
        // Check if already rated
        const { data: rat } = await supabase
          .from('ratings')
          .select('id')
          .eq('delivery_id', params.id)
          .maybeSingle();
        
        if (rat) setHasRated(true);
        
      } catch (error) {
        console.error('Error fetching tracking data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDeliveryData();
    interval = setInterval(fetchDeliveryData, 5000);
    return () => clearInterval(interval);
  }, [params.id]);

  // Trigger rating modal when delivered
  useEffect(() => {
    if (delivery?.status === 'delivered' && !hasRated) {
      const timer = setTimeout(() => {
        setIsRatingOpen(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [delivery?.status, hasRated]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center h-[100vh]">
        <div className="w-12 h-12 rounded-full border-4 border-orange-500 border-t-transparent animate-spin mx-auto mb-4" />
        <p className="text-white font-medium">Buscando tu pedido...</p>
      </div>
    );
  }

  if (!delivery) {
    return (
      <div className="p-4 text-center">
        <p className="text-white">Pedido no encontrado.</p>
        <button onClick={() => router.push('/client/market')} className="mt-4 text-orange-400">Volver al Market</button>
      </div>
    );
  }

  const VIcon = courier ? (vehicleIcons[courier.vehicle_type] || vehicleIcons.default) : Truck;
  const statusInfo = statusConfig[delivery.status] || statusConfig.pending;

  // Render Map Coordinates
  const mapCenter = courier?.current_lat && courier?.current_lng 
    ? { lat: courier.current_lat, lng: courier.current_lng }
    : delivery.delivery_lat && delivery.delivery_lng
      ? { lat: delivery.delivery_lat, lng: delivery.delivery_lng }
      : { lat: 9.9281, lng: -84.0907 };
      
  const mapMarkers = [];
  if (delivery.pickup_lat && delivery.pickup_lng) {
    mapMarkers.push({
      position: { lat: delivery.pickup_lat, lng: delivery.pickup_lng },
      type: 'pickup' as const,
      color: '#f59e0b',
      title: vendor?.store_name || 'Tienda'
    });
  }
  if (delivery.delivery_lat && delivery.delivery_lng) {
    mapMarkers.push({
      position: { lat: delivery.delivery_lat, lng: delivery.delivery_lng },
      type: 'dropoff' as const,
      color: '#ef4444',
      title: 'Destino'
    });
  }
  if (courier?.current_lat && courier?.current_lng && delivery.status !== 'delivered' && delivery.status !== 'cancelled') {
    mapMarkers.push({
      position: { lat: courier.current_lat, lng: courier.current_lng },
      type: 'courier' as const,
      color: '#10b981',
      title: 'Repartidor'
    });
  }

  return (
    <div className="flex flex-col h-screen bg-rida-dark relative">
      {/* Map Background */}
      <div className="absolute inset-0 z-0">
        <GoogleMap
          center={mapCenter}
          zoom={14}
          markers={mapMarkers}
          showUserLocation={false}
          className="w-full h-[60vh]"
        />
        {/* Gradient overlay */}
        <div className="absolute bottom-0 w-full h-32 bg-gradient-to-t from-rida-dark to-transparent z-10" />
      </div>

      {/* Header Back Button & Help */}
      <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between">
        <button
          onClick={() => router.push('/client/market')}
          className="w-10 h-10 rounded-full bg-rida-dark/80 backdrop-blur border border-white/10 flex items-center justify-center text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        
        <button
          onClick={() => toast.info('Centro de ayuda en camino')}
          className="px-4 py-2 rounded-full bg-white/10 backdrop-blur border border-white/10 flex items-center gap-2 text-white text-sm font-medium"
        >
          <HelpCircle className="w-4 h-4" />
          Ayuda
        </button>
      </div>

      {/* Bottom Sheet */}
      <motion.div 
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="absolute bottom-0 left-0 right-0 z-20 glass-strong border-t border-white/10 rounded-t-3xl shadow-[0_-8px_30px_rgba(0,0,0,0.4)] pb-8 pt-2"
      >
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-4" />
        
        <div className="px-5">
          {/* Progress Bar */}
          <div className="flex items-center justify-between mb-6 px-2">
            {STEPS.map((step, idx) => {
              const isActive = statusInfo.step >= idx;
              const isCurrent = statusInfo.step === idx;
              return (
                <div key={idx} className="flex flex-col items-center gap-1.5 flex-1 relative">
                  {/* Line */}
                  {idx < STEPS.length - 1 && (
                    <div className={`absolute left-[60%] right-[-40%] top-4 h-0.5 ${statusInfo.step > idx ? 'bg-orange-500' : 'bg-white/10'}`} />
                  )}
                  
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    isCurrent ? 'bg-orange-500 text-white scale-110 shadow-[0_0_15px_rgba(249,115,22,0.5)]' :
                    isActive ? 'bg-orange-500/20 text-orange-400' : 'bg-white/5 text-gray-600'
                  }`}>
                    <step.icon className="w-4 h-4" />
                  </div>
                  <span className={`text-[9px] font-bold uppercase tracking-wider ${isActive ? 'text-orange-400' : 'text-gray-600'}`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold text-white">{statusInfo.label}</h2>
                {delivery.status !== 'delivered' && (
                  <div className="flex items-center gap-1 bg-orange-500/20 px-2 py-0.5 rounded-full">
                    <Clock className="w-3 h-3 text-orange-400" />
                    <span className="text-[10px] font-bold text-orange-400">8:45 PM</span>
                  </div>
                )}
              </div>
              <p className="text-sm text-gray-400 mt-0.5">{statusInfo.desc}</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-orange-500/20 flex items-center justify-center">
              <Package className="w-6 h-6 text-orange-400" />
            </div>
          </div>

          {/* Courier Info */}
          {courier ? (
            <div className="glass bg-white/[0.03] rounded-2xl p-4 mb-4">
              <div className="flex items-center gap-4">
                {/* Courier Avatar */}
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-xl font-bold text-white shadow-lg shadow-orange-500/20 flex-shrink-0 overflow-hidden">
                  {courier.profiles?.avatar_url ? (
                    <img src={courier.profiles.avatar_url} alt={courier.profiles?.name} className="w-full h-full object-cover" />
                  ) : (
                    courier.profiles?.name?.charAt(0) || 'R'
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-white truncate">{courier.profiles?.name || 'Repartidor'}</h3>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1 text-sm font-medium text-amber-400">
                      <Star className="w-3.5 h-3.5 fill-amber-400" />
                      {courier.rating ? Number(courier.rating).toFixed(1) : '5.0'}
                    </span>
                    <span className="text-gray-600">•</span>
                    <span className="text-sm text-gray-400">{courier.total_deliveries || 0} entregas</span>
                  </div>
                </div>
                
                {courier.profiles?.phone && (
                  <a
                    href={`tel:${courier.profiles.phone}`}
                    className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                  >
                    <Phone className="w-5 h-5" />
                  </a>
                )}
              </div>

              {/* Vehicle Specs */}
              <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/15 flex items-center justify-center text-orange-400">
                    <VIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {courier.vehicle_color || ''} {courier.vehicle_model || vehicleLabels[courier.vehicle_type] || courier.vehicle_type}
                    </p>
                    <p className="text-xs text-gray-500 font-mono mt-0.5 border border-white/10 px-1.5 py-0.5 rounded inline-block bg-white/5">
                      {courier.vehicle_plate || 'SIN PLACA'}
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={() => toast.info('Chat integrado proximamente')}
                  className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:bg-white/10 transition-colors"
                >
                  <MessageSquare className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="glass bg-white/[0.03] rounded-2xl p-6 mb-4 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full border-2 border-orange-500/20 border-t-orange-500 animate-spin mb-3" />
              <p className="text-sm font-bold text-white">Asignando Repartidor...</p>
              <p className="text-xs text-gray-500 mt-1">Buscando al repartidor mas cercano a la tienda.</p>
            </div>
          )}

          {/* Order Details */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                <Navigation className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500">Recoger en</p>
                <p className="text-sm text-white truncate">{vendor?.store_name || delivery.pickup_address || 'Tienda'}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                <MapPin className="w-4 h-4 text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500">Entregar a</p>
                <p className="text-sm text-white truncate">{delivery.delivery_address}</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Rating Modal */}
      <RatingModal
        isOpen={isRatingOpen}
        onClose={() => {
          setIsRatingOpen(false);
          setHasRated(true);
        }}
        deliveryId={params.id}
        vendorId={delivery?.vendor_id}
        courierId={delivery?.courier_id}
        vendorName={vendor?.store_name}
        courierName={courier?.profiles?.name}
      />
    </div>
  );
}
