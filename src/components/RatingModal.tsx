'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, MessageSquare, X, CheckCircle2, Store, Truck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

interface RatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  deliveryId: string;
  vendorId?: string;
  courierId?: string;
  vendorName?: string;
  courierName?: string;
}

export default function RatingModal({
  isOpen,
  onClose,
  deliveryId,
  vendorId,
  courierId,
  vendorName = 'Restaurante',
  courierName = 'Repartidor',
}: RatingModalProps) {
  const [vendorRating, setVendorRating] = useState(0);
  const [courierRating, setCourierRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async () => {
    if (vendorRating === 0 || courierRating === 0) {
      toast.error('Por favor, califica ambos servicios');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No auth');

      const { error } = await supabase.from('ratings').insert({
        delivery_id: deliveryId,
        customer_id: user.id,
        vendor_id: vendorId,
        courier_id: courierId,
        vendor_rating: vendorRating,
        courier_rating: courierRating,
        comment: comment.trim() || null,
      });

      if (error) {
        if (error.code === '23505') {
          toast.error('Ya has calificado este pedido');
          onClose();
          return;
        }
        throw error;
      }

      setIsSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      console.error('Rating error:', err);
      toast.error('Error al guardar calificacion');
    } finally {
      setLoading(false);
    }
  };

  const StarSelector = ({ value, onChange, label, icon: Icon }: any) => (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-gray-400">
        <Icon className="w-4 h-4" />
        <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <motion.button
            key={star}
            whileTap={{ scale: 0.8 }}
            onClick={() => onChange(star)}
            className="focus:outline-none"
          >
            <Star
              className={`w-9 h-9 transition-colors ${
                star <= value ? 'fill-amber-400 text-amber-400' : 'text-white/10'
              }`}
            />
          </motion.button>
        ))}
      </div>
    </div>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={onClose}
          />
          
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-md bg-[#0c1018] rounded-[2.5rem] border border-white/10 overflow-hidden shadow-2xl"
          >
            {isSuccess ? (
              <div className="p-12 text-center space-y-4">
                <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                </div>
                <h3 className="text-xl font-bold text-white">¡Muchas gracias!</h3>
                <p className="text-gray-500 text-sm">Tu feedback ayuda a mejorar la comunidad Rid@.</p>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="p-6 pb-0 flex justify-between items-center">
                  <h3 className="text-xl font-black text-white">Califica tu experiencia</h3>
                  <button onClick={onClose} className="p-2 rounded-full bg-white/5 text-gray-500">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 space-y-8">
                  {/* Vendor Rating */}
                  <StarSelector 
                    value={vendorRating} 
                    onChange={setVendorRating} 
                    label={`¿Qué tal la comida de ${vendorName}?`}
                    icon={Store}
                  />

                  {/* Courier Rating */}
                  <StarSelector 
                    value={courierRating} 
                    onChange={setCourierRating} 
                    label={`¿Cómo fue el servicio de ${courierName}?`}
                    icon={Truck}
                  />

                  {/* Comment */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-gray-400">
                      <MessageSquare className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">¿Algo que agregar? (Opcional)</span>
                    </div>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Escribe tu comentario aquí..."
                      className="w-full h-24 bg-white/5 border border-white/10 rounded-2xl p-4 text-white text-sm focus:outline-none focus:border-orange-500/50 transition-colors resize-none"
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    onClick={handleSubmit}
                    disabled={loading || vendorRating === 0 || courierRating === 0}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold text-sm shadow-lg shadow-orange-500/20 disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      'Enviar Calificación'
                    )}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
