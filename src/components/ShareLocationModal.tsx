'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Share2, Copy, Check, Phone, MessageCircle, Link, Shield, Clock, Users, Eye, EyeOff, Send } from 'lucide-react';
import { useLocationShareStore } from '@/store/locationShareStore';
import { toast } from 'sonner';

interface ShareLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  rideId: string;
  riderName: string;
  driverName?: string;
  driverPhone?: string;
  vehicleInfo?: string;
  origin: string;
  destination: string;
}

export default function ShareLocationModal({
  isOpen,
  onClose,
  rideId,
  riderName,
  driverName,
  driverPhone,
  vehicleInfo,
  origin,
  destination,
}: ShareLocationModalProps) {
  const { shares, isCreating, createShare, fetchShares, cancelShare, getShareUrl } = useLocationShareStore();
  const [contactPhone, setContactPhone] = useState('');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'share' | 'active'>('share');

  // Fetch existing shares when modal opens
  useEffect(() => {
    if (isOpen && rideId) {
      fetchShares(rideId);
    }
  }, [isOpen, rideId, fetchShares]);

  const handleCreateShare = async () => {
    const token = await createShare({
      rideId,
      riderName,
      driverName,
      driverPhone,
      vehicleInfo,
      origin,
      destination,
    });

    if (token) {
      toast.success('Ubicacion compartida exitosamente');
      setActiveTab('active');
    } else {
      toast.error('No se pudo compartir la ubicacion');
    }
  };

  const handleCopyLink = (token: string) => {
    const url = getShareUrl(token);
    navigator.clipboard.writeText(url).then(() => {
      setCopiedToken(token);
      toast.success('Link copiado al portapapeles');
      setTimeout(() => setCopiedToken(null), 2000);
    }).catch(() => {
      toast.error('No se pudo copiar el link');
    });
  };

  const handleWhatsAppShare = (token: string) => {
    const url = getShareUrl(token);
    const text = `Estoy en viaje con RIDA. Puedes ver mi ubicacion en tiempo real aqui: ${url}`;
    const phone = contactPhone.replace(/\D/g, '');
    const waUrl = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  };

  const handleSMSShare = (token: string) => {
    const url = getShareUrl(token);
    const text = `Estoy en viaje con RIDA. Ve mi ubicacion en tiempo real: ${url}`;
    const phone = contactPhone.replace(/\D/g, '');
    if (phone && typeof navigator !== 'undefined') {
      window.location.href = `sms:${phone}?body=${encodeURIComponent(text)}`;
    } else {
      toast.error('Ingresa un numero de telefono');
    }
  };

  const activeShares = shares.filter(s => s.status === 'active');

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-0 sm:p-6"
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="glass-strong rounded-t-3xl sm:rounded-2xl p-6 w-full sm:max-w-md max-h-[85vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                  <Share2 className="w-4 h-4 text-cyan-400" />
                </div>
                <h3 className="text-base font-bold text-white">Compartir mi ubicacion</h3>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/10 text-gray-400 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Security notice */}
            <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 mb-4">
              <Shield className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
              <p className="text-[11px] text-blue-300 leading-relaxed">
                Tu ubicacion se comparte en tiempo real solo con las personas que elijas.
                Se detiene automaticamente al finalizar el viaje o al expirar el tiempo.
              </p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setActiveTab('share')}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'share'
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : 'bg-white/5 text-gray-400 hover:text-white border border-transparent'
                }`}
              >
                <Send className="w-3.5 h-3.5 mx-auto mb-1" />
                Compartir
              </button>
              <button
                onClick={() => setActiveTab('active')}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all relative ${
                  activeTab === 'active'
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : 'bg-white/5 text-gray-400 hover:text-white border border-transparent'
                }`}
              >
                <Eye className="w-3.5 h-3.5 mx-auto mb-1" />
                Activos
                {activeShares.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-cyan-500 text-[9px] text-white flex items-center justify-center font-bold">
                    {activeShares.length}
                  </span>
                )}
              </button>
            </div>

            {activeTab === 'share' ? (
              <div className="space-y-3">
                {/* Contact phone input */}
                <div>
                  <label className="text-xs font-medium text-gray-400 mb-1.5 block">
                    Numero de contacto (opcional)
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type="tel"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="506 8888 8888"
                      className="w-full glass rounded-xl pl-10 pr-4 py-3 text-white text-sm outline-none focus:ring-1 focus:ring-cyan-500/50 placeholder-gray-600"
                    />
                  </div>
                </div>

                {/* Create share button */}
                <button
                  onClick={handleCreateShare}
                  disabled={isCreating}
                  className="w-full btn-neon text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isCreating ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Share2 className="w-4 h-4" />
                  )}
                  {isCreating ? 'Generando enlace...' : 'Compartir ubicacion en vivo'}
                </button>

                {/* Quick share options after creating */}
                {activeShares.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-white/5">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
                      Opciones para el ultimo enlace:
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleWhatsAppShare(activeShares[0].share_token)}
                        className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-500/15 border border-green-500/30 text-green-400 hover:bg-green-500/25 transition-all text-xs font-medium"
                      >
                        <MessageCircle className="w-4 h-4" />
                        WhatsApp
                      </button>
                      <button
                        onClick={() => handleCopyLink(activeShares[0].share_token)}
                        className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:bg-white/10 transition-all text-xs font-medium"
                      >
                        {copiedToken === activeShares[0].share_token ? (
                          <>
                            <Check className="w-4 h-4 text-emerald-400" />
                            <span className="text-emerald-400">Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            Copiar link
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => handleSMSShare(activeShares[0].share_token)}
                        className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 hover:bg-blue-500/25 transition-all text-xs font-medium"
                      >
                        <Phone className="w-4 h-4" />
                        SMS
                      </button>
                      <button
                        onClick={() => {
                          const url = getShareUrl(activeShares[0].share_token);
                          if (navigator.share) {
                            navigator.share({ title: 'Mi viaje RIDA', text: 'Ve mi ubicacion en tiempo real', url });
                          } else {
                            handleCopyLink(activeShares[0].share_token);
                          }
                        }}
                        className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 hover:bg-purple-500/25 transition-all text-xs font-medium"
                      >
                        <Link className="w-4 h-4" />
                        Mas opciones
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Active shares list */
              <div className="space-y-2">
                {activeShares.length === 0 ? (
                  <div className="text-center py-6">
                    <EyeOff className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No hay ubicaciones compartidas activas</p>
                  </div>
                ) : (
                  activeShares.map((share) => (
                    <div
                      key={share.id}
                      className="p-3 glass rounded-xl border border-cyan-500/10"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="text-[11px] font-semibold text-emerald-400">Activo</span>
                        </div>
                        <div className="flex items-center gap-1 text-gray-500">
                          <Clock className="w-3 h-3" />
                          <span className="text-[10px]">
                            Expira: {new Date(share.expires_at).toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                      <p className="text-[11px] text-gray-400 mb-2 truncate">
                        {share.origin} → {share.destination}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleCopyLink(share.share_token)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-all text-xs text-gray-300"
                        >
                          {copiedToken === share.share_token ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          {copiedToken === share.share_token ? 'Copiado!' : 'Copiar link'}
                        </button>
                        <button
                          onClick={() => {
                            cancelShare(share.id);
                            toast.success('Se dejo de compartir la ubicacion');
                          }}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 transition-all text-xs text-red-400"
                        >
                          <X className="w-3.5 h-3.5" />
                          Detener
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
