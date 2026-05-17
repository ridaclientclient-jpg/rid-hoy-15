'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, Timer, UserX, DollarSign, CalendarX, Car, Truck, CreditCard, AlertTriangle, MessageCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

interface CancelReason {
  id: string;
  reason: string;
  icon: string;
}

interface CancelRideModalProps {
  open: boolean;
  onClose: () => void;
  rideId: string;
  onCanceled?: () => void;
  createdAt?: string; // to check free cancel window
}

const ICON_MAP: Record<string, any> = {
  'clock': Clock,
  'timer': Timer,
  'user-x': UserX,
  'dollar-sign': DollarSign,
  'calendar-x': CalendarX,
  'car': Car,
  'truck': Truck,
  'credit-card': CreditCard,
  'alert-triangle': AlertTriangle,
  'message-circle': MessageCircle,
  'x-circle': X,
};

export default function CancelRideModal({
  open,
  onClose,
  rideId,
  onCanceled,
  createdAt,
}: CancelRideModalProps) {
  const [reasons, setReasons] = useState<CancelReason[]>([]);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [otherText, setOtherText] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [isLoadingReasons, setIsLoadingReasons] = useState(true);
  const [freeCancelMinutes, setFreeCancelMinutes] = useState(2);

  useEffect(() => {
    if (open) {
      // Reset state
      setSelectedReason(null);
      setOtherText('');

      // Fetch cancel reasons from DB
      (async () => {
        setIsLoadingReasons(true);
        try {
          const { data } = await supabase
            .from('cancel_reasons')
            .select('id, reason, icon')
            .eq('is_active', true)
            .order('sort_order');
          if (data) setReasons(data);
        } catch {
          // Fallback reasons
          setReasons([
            { id: '1', reason: 'Cambie de planes', icon: 'calendar-x' },
            { id: '2', reason: 'Tiempo de espera demasiado largo', icon: 'timer' },
            { id: '3', reason: 'Otro motivo', icon: 'message-circle' },
          ]);
        } finally {
          setIsLoadingReasons(false);
        }
      })();

      // Fetch free cancel minutes from settings
      (async () => {
        try {
          const { data } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'ride_cancel_free_minutes')
            .single();
          if (data?.value) setFreeCancelMinutes(parseInt(data.value));
        } catch {
          // default 2
        }
      })();
    }
  }, [open]);

  const isFreeCancel = createdAt
    ? (Date.now() - new Date(createdAt).getTime()) < freeCancelMinutes * 60 * 1000
    : false;

  const handleCancel = async () => {
    if (!selectedReason) {
      toast.error('Selecciona un motivo de cancelacion');
      return;
    }

    if (selectedReason === 'other' && !otherText.trim()) {
      toast.error('Describe el motivo de tu cancelacion');
      return;
    }

    setIsCancelling(true);
    try {
      const { error } = await supabase
        .from('rides')
        .update({
          status: 'cancelled',
          cancel_reason_id: selectedReason !== 'other' ? selectedReason : null,
          cancel_reason_text: selectedReason === 'other' ? otherText.trim() : null,
        })
        .eq('id', rideId);

      if (error) throw error;

      toast.success(isFreeCancel ? 'Viaje cancelado sin cargo' : 'Viaje cancelado');
      onCanceled?.();
      onClose();
    } catch (err) {
      console.error('Cancel ride error:', err);
      toast.error('Error al cancelar viaje. Intenta de nuevo.');
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            className="relative w-full max-w-md mx-4 mb-4 rounded-2xl glass-strong overflow-hidden"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                  <X className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Cancelar viaje</h2>
                  <p className="text-xs text-gray-400">Selecciona el motivo</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/5 transition-colors"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {/* Free cancel notice */}
            {isFreeCancel && (
              <div className="mx-5 mb-3 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <p className="text-xs text-emerald-400">
                  Sin cargo: estas dentro de los {freeCancelMinutes} minutos de la solicitud
                </p>
              </div>
            )}

            {/* Reasons List */}
            <div className="px-5 pb-3 max-h-[50vh] overflow-y-auto">
              {isLoadingReasons ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
                </div>
              ) : (
                <div className="space-y-2">
                  {reasons.map((reason) => {
                    const IconComp = ICON_MAP[reason.icon] || MessageCircle;
                    const isSelected = selectedReason === reason.id;

                    return (
                      <motion.button
                        key={reason.id}
                        type="button"
                        onClick={() => {
                          setSelectedReason(reason.id);
                          if (reason.reason !== 'Otro motivo') setOtherText('');
                        }}
                        className={`w-full flex items-center gap-3 p-3.5 rounded-xl transition-all text-left ${
                          isSelected
                            ? 'bg-red-500/10 border border-red-500/30'
                            : 'bg-white/3 border border-transparent hover:bg-white/5'
                        }`}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-red-500/20' : 'bg-white/5'
                        }`}>
                          <IconComp className={`w-4 h-4 ${isSelected ? 'text-red-400' : 'text-gray-500'}`} />
                        </div>
                        <span className={`text-sm flex-1 ${isSelected ? 'text-white font-medium' : 'text-gray-300'}`}>
                          {reason.reason}
                        </span>
                        {isSelected && (
                          <motion.div
                            className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center shrink-0"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                          >
                            <div className="w-2 h-2 rounded-full bg-white" />
                          </motion.div>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              )}

              {/* Other reason text input */}
              {selectedReason === 'other' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-3"
                >
                  <textarea
                    value={otherText}
                    onChange={(e) => setOtherText(e.target.value)}
                    placeholder="Describe el motivo de tu cancelacion..."
                    maxLength={200}
                    rows={2}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-red-500/50 transition-colors"
                  />
                  <p className="text-right text-[10px] text-gray-500 mt-1">{otherText.length}/200</p>
                </motion.div>
              )}
            </div>

            {/* Actions */}
            <div className="p-5 pt-3 space-y-2 border-t border-white/5">
              <button
                type="button"
                onClick={handleCancel}
                disabled={isCancelling || !selectedReason}
                className="w-full py-3 rounded-xl font-semibold text-sm bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isCancelling ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Cancelando viaje...
                  </span>
                ) : (
                  'Cancelar viaje'
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={isCancelling}
                className="w-full py-3 rounded-xl text-sm text-gray-400 hover:text-white transition-colors"
              >
                Regresar
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
