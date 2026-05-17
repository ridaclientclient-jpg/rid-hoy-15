'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Plus, X, Share2, UserPlus, Smartphone, Check } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

interface SplitFareModalProps {
  open: boolean;
  onClose: () => void;
  rideId: string;
  totalAmount: number;
  riderId: string;
}

interface Invitee {
  id: string;
  phone: string;
  name: string;
}

export default function SplitFareModal({
  open,
  onClose,
  rideId,
  totalAmount,
  riderId,
}: SplitFareModalProps) {
  const [invitees, setInvitees] = useState<Invitee[]>([]);
  const [phoneInput, setPhoneInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [splitCreated, setSplitCreated] = useState(false);
  const [maxPeople, setMaxPeople] = useState(5);

  // Fetch max split people from settings
  useEffect(() => {
    if (open) {
      resetState();
      (async () => {
        try {
          const { data } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'split_max_people')
            .single();
          if (data?.value) {
            const parsed = parseInt(data.value, 10);
            if (parsed > 0 && parsed <= 10) setMaxPeople(parsed);
          }
        } catch {
          // default 5
        }
      })();
    }
  }, [open]);

  const resetState = useCallback(() => {
    setInvitees([]);
    setPhoneInput('');
    setNameInput('');
    setIsSubmitting(false);
    setSplitCreated(false);
    setMaxPeople(5);
  }, []);

  // Format CRC currency
  const formatCRC = (amount: number): string => {
    return `₡${Math.round(amount).toLocaleString('es-CR')}`;
  };

  // Normalize Costa Rican phone number (8 digits, strip +506 / spaces / dashes)
  const normalizePhone = (raw: string): string => {
    const digits = raw.replace(/[^0-9]/g, '');
    // Strip Costa Rica country code if present
    if (digits.length === 11 && digits.startsWith('506')) {
      return digits.slice(3);
    }
    // Strip +506 (without the +)
    if (digits.length === 12 && digits.startsWith('506')) {
      return digits.slice(3);
    }
    return digits;
  };

  const isValidCRPhone = (phone: string): boolean => {
    return /^8\d{7}$/.test(phone);
  };

  const totalParticipants = invitees.length + 1;
  const splitPerPerson = totalParticipants > 0
    ? Math.round(totalAmount / totalParticipants)
    : totalAmount;
  const riderShare = totalAmount - splitPerPerson * invitees.length;

  const canAddMore = invitees.length < maxPeople;

  const handleAddInvitee = () => {
    const normalized = normalizePhone(phoneInput);

    if (!normalized) {
      toast.error('Ingresa un numero de telefono');
      return;
    }

    if (!isValidCRPhone(normalized)) {
      toast.error('Numero invalido. Debe ser un numero costarricense de 8 digitos (ej. 8XXX-XXXX)');
      return;
    }

    // Check duplicate
    if (invitees.some((inv) => inv.phone === normalized)) {
      toast.error('Este numero ya fue agregado');
      return;
    }

    const newInvitee: Invitee = {
      id: crypto.randomUUID(),
      phone: normalized,
      name: nameInput.trim(),
    };

    setInvitees((prev) => [...prev, newInvitee]);
    setPhoneInput('');
    setNameInput('');
    toast.success(`Agregado: ${formatPhoneDisplay(normalized)}`);
  };

  const handleRemoveInvitee = (id: string) => {
    setInvitees((prev) => prev.filter((inv) => inv.id !== id));
  };

  const formatPhoneDisplay = (phone: string): string => {
    if (phone.length === 8) {
      return `${phone.slice(0, 4)}-${phone.slice(4)}`;
    }
    return phone;
  };

  const handleCreateSplits = async () => {
    if (invitees.length === 0) {
      toast.error('Agrega al menos una persona para dividir el costo');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Insert ride_splits records for each invitee
      const splitRecords = invitees.map((inv) => ({
        ride_id: rideId,
        inviter_id: riderId,
        invitee_phone: inv.phone,
        invitee_name: inv.name || null,
        split_amount: splitPerPerson,
        status: 'pending',
      }));

      const { error: insertError } = await supabase
        .from('ride_splits')
        .insert(splitRecords);

      if (insertError) {
        console.error('Insert ride_splits error:', insertError);
        throw new Error('Error al crear las divisiones de costo');
      }

      // 2. Update rides.split_count
      const { error: updateError } = await supabase
        .from('rides')
        .update({ split_count: totalParticipants })
        .eq('id', rideId);

      if (updateError) {
        console.error('Update rides.split_count error:', updateError);
        // Non-critical, splits were created
        toast.warning('Divisiones creadas, pero no se actualizo el conteo');
      }

      setSplitCreated(true);
      toast.success('Costo dividido exitosamente');
    } catch (err) {
      console.error('Split fare error:', err);
      toast.error('Error al dividir el costo. Intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateWhatsAppMessage = (): string => {
    const lines: string[] = [
      `Hola! Te invito a dividir el costo de un viaje en RIDA SUPREME.`,
      ``,
      `Costo total del viaje: ${formatCRC(totalAmount)}`,
      `Personas: ${totalParticipants}`,
      `Tu parte: ${formatCRC(splitPerPerson)}`,
      ``,
    ];

    if (invitees.length > 1) {
      invitees.forEach((inv, idx) => {
        const nameDisplay = inv.name || formatPhoneDisplay(inv.phone);
        lines.push(`${idx + 1}. ${nameDisplay} - ${formatCRC(splitPerPerson)}`);
      });
      lines.push(`${invitees.length + 1}. Tu parte - ${formatCRC(riderShare)}`);
    }

    lines.push('');
    lines.push('Acepta la solicitud en la app para completar tu parte del pago.');

    return encodeURIComponent(lines.join('\n'));
  };

  const handleShareWhatsApp = () => {
    const message = generateWhatsAppMessage();
    // Open WhatsApp with all invitee phone numbers
    const phones = invitees.map((inv) => `506${inv.phone}`).join(',');
    const url = `https://wa.me/?text=${message}`;
    window.open(url, '_blank');
    toast.success('Mensaje de WhatsApp generado');
  };

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      resetState();
    }, 300);
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
          {/* Overlay */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={!isSubmitting ? handleClose : undefined}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* ─── MODAL CONTENT ─── */}
          <motion.div
            className="relative w-full max-w-md mx-4 mb-4 rounded-2xl glass-strong overflow-hidden"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            {/* ─── Header ─── */}
            <div className="flex items-center justify-between p-5 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                  <Users className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">
                    {splitCreated ? 'Costo dividido' : 'Dividir costo'}
                  </h2>
                  <p className="text-xs text-gray-400">
                    {splitCreated
                      ? 'Comparte los detalles'
                      : `Divide con hasta ${maxPeople} personas`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="p-2 rounded-lg hover:bg-white/5 transition-colors"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {/* ─── Summary Card ─── */}
            <div className="mx-5 mb-4 p-4 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-600/10 border border-cyan-500/20">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-300">Costo total del viaje</span>
                <span className="text-lg font-bold text-white">
                  {formatCRC(totalAmount)}
                </span>
              </div>

              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-400">
                  {totalParticipants} persona{totalParticipants !== 1 ? 's' : ''}
                </span>
                <span className="text-sm font-semibold text-cyan-400">
                  {formatCRC(splitPerPerson)} c/u
                </span>
              </div>

              {/* Visual split bar */}
              <div className="mt-3 flex gap-1 h-2 rounded-full overflow-hidden">
                <motion.div
                  className="bg-cyan-500 rounded-full"
                  initial={{ width: '0%' }}
                  animate={{
                    width: totalParticipants > 0
                      ? `${Math.max((1 / totalParticipants) * 100, 8)}%`
                      : '100%',
                  }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                />
                {invitees.map((inv, idx) => (
                  <motion.div
                    key={inv.id}
                    className="bg-blue-500 rounded-full"
                    initial={{ width: '0%' }}
                    animate={{
                      width: `${Math.max((1 / totalParticipants) * 100, 8)}%`,
                    }}
                    transition={{ delay: 0.4 + idx * 0.1, duration: 0.5 }}
                  />
                ))}
              </div>
            </div>

            {/* ─── NOT YET CREATED: Input Section ─── */}
            {!splitCreated && (
              <>
                {/* Add person form */}
                {canAddMore && (
                  <div className="px-5 mb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <UserPlus className="w-4 h-4 text-gray-400" />
                      <span className="text-xs font-medium text-gray-300">
                        Agregar persona ({invitees.length}/{maxPeople})
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 font-medium">
                          +506
                        </span>
                        <input
                          type="tel"
                          value={phoneInput}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 8);
                            setPhoneInput(val);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddInvitee();
                            }
                          }}
                          placeholder="8XXX-XXXX"
                          maxLength={8}
                          className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-3 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-cyan-500/50 transition-all"
                        />
                      </div>

                      <input
                        type="text"
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddInvitee();
                          }
                        }}
                        placeholder="Nombre (opcional)"
                        maxLength={50}
                        className="w-32 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-cyan-500/50 transition-all"
                      />

                      <motion.button
                        type="button"
                        onClick={handleAddInvitee}
                        whileTap={{ scale: 0.92 }}
                        className="w-10 h-10 shrink-0 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center hover:bg-cyan-500/30 transition-colors"
                      >
                        <Plus className="w-4 h-4 text-cyan-400" />
                      </motion.button>
                    </div>
                  </div>
                )}

                {/* Invitee list */}
                <div className="px-5 max-h-[35vh] overflow-y-auto">
                  {invitees.length === 0 ? (
                    <div className="text-center py-6">
                      <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3">
                        <Smartphone className="w-6 h-6 text-gray-500" />
                      </div>
                      <p className="text-sm text-gray-400 mb-1">
                        Sin personas agregadas
                      </p>
                      <p className="text-xs text-gray-500">
                        Ingresa un numero para comenzar a dividir el costo
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <AnimatePresence mode="popLayout">
                        {invitees.map((inv) => (
                          <motion.div
                            key={inv.id}
                            layout
                            initial={{ opacity: 0, x: -20, height: 0 }}
                            animate={{ opacity: 1, x: 0, height: 'auto' }}
                            exit={{ opacity: 0, x: 20, height: 0 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="flex items-center gap-3 p-3 rounded-xl bg-white/3 border border-white/5"
                          >
                            <div className="w-9 h-9 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
                              <Smartphone className="w-4 h-4 text-blue-400" />
                            </div>

                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-white truncate">
                                {inv.name || 'Sin nombre'}
                              </p>
                              <p className="text-xs text-gray-400">
                                {formatPhoneDisplay(inv.phone)}
                              </p>
                            </div>

                            <span className="text-sm font-semibold text-cyan-400 shrink-0">
                              {formatCRC(splitPerPerson)}
                            </span>

                            <button
                              type="button"
                              onClick={() => handleRemoveInvitee(inv.id)}
                              className="p-1.5 rounded-lg hover:bg-red-500/20 transition-colors shrink-0"
                            >
                              <X className="w-3.5 h-3.5 text-red-400" />
                            </button>
                          </motion.div>
                        ))}
                      </AnimatePresence>

                      {/* Rider share */}
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="flex items-center gap-3 p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/10 mt-2"
                      >
                        <div className="w-9 h-9 rounded-lg bg-cyan-500/15 flex items-center justify-center shrink-0">
                          <Check className="w-4 h-4 text-cyan-400" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">
                            Tu parte
                          </p>
                          <p className="text-xs text-gray-400">
                            Organizador del viaje
                          </p>
                        </div>

                        <span className="text-sm font-semibold text-cyan-400 shrink-0">
                          {formatCRC(riderShare)}
                        </span>
                      </motion.div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="p-5 pt-3 space-y-2 border-t border-white/5">
                  <motion.button
                    type="button"
                    onClick={handleCreateSplits}
                    disabled={isSubmitting || invitees.length === 0}
                    className="w-full py-3 rounded-xl font-semibold text-sm btn-neon disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none transition-all"
                    whileHover={invitees.length > 0 && !isSubmitting ? { scale: 1.02 } : {}}
                    whileTap={invitees.length > 0 && !isSubmitting ? { scale: 0.98 } : {}}
                  >
                    {isSubmitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <motion.span
                          className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                        />
                        Dividiendo costo...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <Users className="w-4 h-4" />
                        Dividir {formatCRC(totalAmount)} entre {totalParticipants}
                      </span>
                    )}
                  </motion.button>

                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={isSubmitting}
                    className="w-full py-3 rounded-xl text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </>
            )}

            {/* ─── SPLIT CREATED: Share Section ─── */}
            {splitCreated && (
              <>
                {/* Success list */}
                <div className="px-5 max-h-[35vh] overflow-y-auto mb-3">
                  <div className="space-y-2">
                    <AnimatePresence>
                      {invitees.map((inv) => (
                        <motion.div
                          key={inv.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.1 }}
                          className="flex items-center gap-3 p-3 rounded-xl bg-white/3 border border-white/5"
                        >
                          <div className="w-9 h-9 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
                            <Smartphone className="w-4 h-4 text-blue-400" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">
                              {inv.name || 'Sin nombre'}
                            </p>
                            <p className="text-xs text-gray-400">
                              {formatPhoneDisplay(inv.phone)} &middot; Pendiente
                            </p>
                          </div>

                          <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/20 shrink-0">
                            Pendiente
                          </span>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Share Actions */}
                <div className="p-5 pt-3 space-y-2 border-t border-white/5">
                  <motion.button
                    type="button"
                    onClick={handleShareWhatsApp}
                    className="w-full py-3 rounded-xl font-semibold text-sm bg-green-500/20 border border-green-500/30 text-green-400 hover:bg-green-500/30 transition-all flex items-center justify-center gap-2"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Share2 className="w-4 h-4" />
                    Compartir por WhatsApp
                  </motion.button>

                  <div className="flex items-center gap-2 text-center">
                    <div className="flex-1 h-px bg-white/5" />
                    <span className="text-[10px] text-gray-500 px-2">
                      Las invitaciones fueron enviadas
                    </span>
                    <div className="flex-1 h-px bg-white/5" />
                  </div>

                  <button
                    type="button"
                    onClick={handleClose}
                    className="w-full py-3 rounded-xl font-semibold text-sm btn-neon transition-all"
                  >
                    Listo
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
