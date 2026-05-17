'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Download, MapPin, Clock, Car, Receipt, Wallet, CreditCard, Banknote, Smartphone, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import Link from 'next/link';

interface ReceiptData {
  id: string;
  status: string;
  origin: string;
  destination: string;
  price: number;
  distance?: number;
  duration?: number;
  ride_type?: string;
  surge_multiplier: number;
  commission_rate: number;
  driver_earnings?: number;
  created_at: string;
  driver_name?: string;
  driver_vehicle?: string;
  driver_plate?: string;
  base_fare?: number;
  distance_fare?: number;
  payment_method?: string;
}

export default function ReceiptPage() {
  return (
    <Suspense fallback={<div className="p-4 flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 text-cyan-400 animate-spin" /></div>}>
      <ReceiptContent />
    </Suspense>
  );
}

function ReceiptContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rideId = searchParams.get('ride');

  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!rideId) { router.replace('/client/history'); return; }
    fetchReceipt(rideId);
  }, [rideId]);

  const fetchReceipt = async (id: string) => {
    try {
      const { data: ride, error } = await supabase.from('rides').select('*').eq('id', id).single();
      if (error || !ride) { toast.error('Viaje no encontrado'); router.replace('/client/history'); return; }

      let driverName: string | undefined;
      let driverVehicle: string | undefined;
      let driverPlate: string | undefined;

      if (ride.driver_id) {
        const { data: d } = await supabase.from('drivers').select('profiles(name), vehicles(model, color, plate)').eq('id', ride.driver_id).single();
        if (d) {
          driverName = (d as any).profiles?.name;
          driverVehicle = (d as any).vehicles ? `${(d as any).vehicles.model} ${(d as any).vehicles.color}` : undefined;
          driverPlate = (d as any).vehicles?.plate;
        }
      }

      // Calculate fare breakdown
      const commissionRate = ride.commission_rate || 15;
      const baseFare = Math.round(ride.price * 0.2);
      const distanceFare = ride.price - baseFare;
      const commission = Math.round(ride.price * commissionRate / 100);
      const driverEarnings = ride.price - commission;

      setReceipt({
        ...ride,
        driver_name: driverName,
        driver_vehicle: driverVehicle,
        driver_plate: driverPlate,
        base_fare: baseFare,
        distance_fare: distanceFare,
        driver_earnings: driverEarnings,
        payment_method: ride.payment_method || 'efectivo',
      });
    } catch {
      toast.error('Error al cargar recibo');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadPDF = () => {
    toast.success('Generando PDF...');
    // Generate a simple text receipt for download
    if (!receipt) return;
    const lines = [
      '========================================',
      '        RIDA SUPREME - RECIBO         ',
      '========================================',
      '',
      `Fecha: ${new Date(receipt.created_at).toLocaleDateString('es-CR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
      `ID: ${receipt.id.substring(0, 8).toUpperCase()}`,
      `Estado: ${receipt.status === 'completed' ? 'Completado' : receipt.status}`,
      '',
      '--- Ruta ---',
      `Origen: ${receipt.origin}`,
      `Destino: ${receipt.destination}`,
      receipt.distance ? `Distancia: ${receipt.distance} km` : '',
      receipt.duration ? `Duracion: ${receipt.duration} min` : '',
      '',
      '--- Conductor ---',
      receipt.driver_name ? `Nombre: ${receipt.driver_name}` : '',
      receipt.driver_vehicle ? `Vehiculo: ${receipt.driver_vehicle}` : '',
      receipt.driver_plate ? `Placa: ${receipt.driver_plate}` : '',
      '',
      '--- Desglose de Precio ---',
      `Tarifa base:         ₡${(receipt.base_fare || 0).toLocaleString()}`,
      `Tarifa por distancia: ₡${(receipt.distance_fare || 0).toLocaleString()}`,
      receipt.surge_multiplier && receipt.surge_multiplier > 1 ? `Multiplicador demanda: x${receipt.surge_multiplier}` : '',
      '----------------------------------------',
      `TOTAL:               ₡${receipt.price.toLocaleString()}`,
      '',
      'Metodo de pago: ' + (receipt.payment_method === 'efectivo' ? 'Efectivo' : receipt.payment_method === 'sinpe' ? 'SINPE' : receipt.payment_method === 'tarjeta' ? 'Tarjeta' : 'Efectivo'),
      '',
      'Gracias por viajar con RIDA SUPREME!',
      '========================================',
    ].filter(l => l !== '');

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RIDA-Recibo-${receipt.id.substring(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Recibo descargado');
  };

  if (isLoading) {
    return <div className="p-4 flex items-center justify-center min-h-[60vh]"><div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" /></div>;
  }

  if (!receipt) return null;

  const typeLabels: Record<string, string> = { standard: 'Economico', premium: 'Premium', suv: 'SUV', moto: 'Moto', moto_express: 'Moto Express', grua: 'Grua', flete: 'Flete' };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-white/5 transition-colors">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <h1 className="text-lg font-bold text-white">Recibo</h1>
      </div>

      {/* Receipt Card */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-strong rounded-2xl overflow-hidden">
        {/* RIDA Header */}
        <div className="bg-gradient-to-r from-cyan-600 to-blue-600 p-4 text-center">
          <p className="text-xs text-cyan-200 uppercase tracking-widest">RIDA SUPREME</p>
          <p className="text-2xl font-bold text-white mt-1">₡{receipt.price.toLocaleString()}</p>
          <p className="text-xs text-cyan-200 mt-1">
            {new Date(receipt.created_at).toLocaleDateString('es-CR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>

        {/* Ride Info */}
        <div className="p-4 space-y-4">
          {/* Status */}
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${receipt.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
              {receipt.status === 'completed' ? 'Completado' : 'Cancelado'}
            </span>
            <span className="text-xs text-gray-500">#{receipt.id.substring(0, 8).toUpperCase()}</span>
          </div>

          {/* Route */}
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center mt-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <div className="w-0.5 h-8 bg-white/10" />
              <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <p className="text-xs text-gray-500">Recogida</p>
                <p className="text-sm text-white">{receipt.origin}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Destino</p>
                <p className="text-sm text-white">{receipt.destination}</p>
              </div>
            </div>
          </div>

          {/* Trip details */}
          {receipt.distance && (
            <div className="flex gap-4 text-center">
              <div className="flex-1 glass rounded-xl p-2">
                <p className="text-sm font-bold text-white">{receipt.distance} km</p>
                <p className="text-[10px] text-gray-500">Distancia</p>
              </div>
              <div className="flex-1 glass rounded-xl p-2">
                <p className="text-sm font-bold text-white">{receipt.duration} min</p>
                <p className="text-[10px] text-gray-500">Duracion</p>
              </div>
              <div className="flex-1 glass rounded-xl p-2">
                <p className="text-sm font-bold text-white">{typeLabels[receipt.ride_type || 'standard'] || 'Standard'}</p>
                <p className="text-[10px] text-gray-500">Tipo</p>
              </div>
            </div>
          )}

          {/* Driver */}
          {receipt.driver_name && (
            <div className="glass rounded-xl p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white font-bold">
                {receipt.driver_name.charAt(0)}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-white">{receipt.driver_name}</p>
                <p className="text-xs text-gray-500">{receipt.driver_vehicle}{receipt.driver_plate ? ` • ${receipt.driver_plate}` : ''}</p>
              </div>
            </div>
          )}

          {/* Price Breakdown */}
          <div>
            <p className="text-xs font-semibold text-gray-400 mb-2">Desglose del precio</p>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-400">Tarifa base</span>
                <span className="text-sm text-white">₡{(receipt.base_fare || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-400">Tarifa por distancia</span>
                <span className="text-sm text-white">₡{(receipt.distance_fare || 0).toLocaleString()}</span>
              </div>
              {receipt.surge_multiplier && receipt.surge_multiplier > 1 && (
                <div className="flex justify-between">
                  <span className="text-sm text-amber-400">Multiplicador demanda</span>
                  <span className="text-sm text-amber-400">x{receipt.surge_multiplier}</span>
                </div>
              )}
              <div className="border-t border-white/10 pt-2 flex justify-between">
                <span className="text-base font-bold text-white">Total</span>
                <span className="text-base font-bold text-white">₡{receipt.price.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Payment Method */}
          <div className="glass rounded-xl p-3 flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              receipt.payment_method === 'sinpe' ? 'bg-blue-500/20' : receipt.payment_method === 'tarjeta' ? 'bg-purple-500/20' : 'bg-emerald-500/20'
            }`}
            >
              {receipt.payment_method === 'sinpe' && <Smartphone className="w-4 h-4 text-blue-400" />}
              {receipt.payment_method === 'tarjeta' && <CreditCard className="w-4 h-4 text-purple-400" />}
              {(!receipt.payment_method || receipt.payment_method === 'efectivo') && <Banknote className="w-4 h-4 text-emerald-400" />}
            </div>
            <div className="flex-1">
              <p className="text-sm text-white">{receipt.payment_method === 'efectivo' ? 'Efectivo' : receipt.payment_method === 'sinpe' ? 'SINPE' : receipt.payment_method === 'tarjeta' ? 'Tarjeta' : 'Efectivo'}</p>
              <p className="text-xs text-gray-500">{
                receipt.payment_method === 'efectivo' ? 'Pago en efectivo al conductor' :
                receipt.payment_method === 'sinpe' ? 'Transferencia SINPE instantanea' :
                'Pago con tarjeta de debito/credito'
              }</p>
            </div>
            <span className="text-sm font-bold text-white">{'\u20A1'}{receipt.price.toLocaleString()}</span>
          </div>
        </div>
      </motion.div>

      {/* Actions */}
      <div className="space-y-2">
        <button onClick={handleDownloadPDF} className="w-full glass rounded-xl p-3.5 flex items-center gap-3 hover:bg-white/5 transition-colors">
          <Download className="w-5 h-5 text-cyan-400" />
          <span className="text-sm font-medium text-white">Descargar recibo</span>
        </button>

        <button onClick={() => router.push(`/client/ride/details?ride=${receipt.id}`)} className="w-full glass rounded-xl p-3.5 flex items-center gap-3 hover:bg-white/5 transition-colors">
          <Receipt className="w-5 h-5 text-gray-400" />
          <span className="text-sm text-white">Ver detalles del viaje</span>
        </button>
      </div>
    </div>
  );
}
