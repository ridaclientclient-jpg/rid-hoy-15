'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Gift, Copy, Share2, Users, Clock, CheckCircle2,
  MessageCircle, Smartphone, Link2, ChevronRight,
  ArrowLeft, Sparkles, TrendingUp, UserPlus,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useReferralStore } from '@/store/referralStore';
import { toast } from 'sonner';

type TabKey = 'pending' | 'completed' | 'all';

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pendiente', color: 'text-yellow-400', bg: 'bg-yellow-500/15 border-yellow-500/30' },
  registered: { label: 'Registrado', color: 'text-blue-400', bg: 'bg-blue-500/15 border-blue-500/30' },
  first_ride_completed: { label: 'Viaje completado', color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/30' },
  rewarded: { label: 'Premiado', color: 'text-cyan-400', bg: 'bg-cyan-500/15 border-cyan-500/30' },
  expired: { label: 'Expirado', color: 'text-gray-400', bg: 'bg-gray-500/15 border-gray-500/30' },
};

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } },
};

export default function ReferralPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const {
    myCode,
    referrals,
    totalEarned,
    pendingCount,
    completedCount,
    rewardedCount,
    isLoading,
    fetchMyReferralData,
    generateCode,
    shareCode,
  } = useReferralStore();

  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [copied, setCopied] = useState(false);
  const [codeLoading, setCodeLoading] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchMyReferralData(user.id);
    }
  }, [user?.id, fetchMyReferralData]);

  const handleGenerateCode = async () => {
    if (!user?.id) return;
    setCodeLoading(true);
    const code = await generateCode(user.id);
    setCodeLoading(false);
    if (code) {
      toast.success('Codigo generado exitosamente!');
    } else {
      toast.error('No se pudo generar el codigo. Intenta de nuevo.');
    }
  };

  const handleCopy = async () => {
    if (!myCode) return;
    try {
      await navigator.clipboard.writeText(myCode);
      setCopied(true);
      toast.success('Codigo copiado al portapapeles');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('No se pudo copiar');
    }
  };

  const handleShareWhatsApp = () => {
    if (!myCode) return;
    const text = `Unete a RIDA! Usa mi codigo ${myCode} y gana ₡1,500 en tu primer viaje. Descarga la app ahora.`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleShareSMS = () => {
    if (!myCode) return;
    const text = `Unete a RIDA! Usa mi codigo ${myCode} y gana ₡1,500 en tu primer viaje.`;
    window.open(`sms:?body=${encodeURIComponent(text)}`, '_blank');
  };

  const handleShareGeneric = async () => {
    if (!myCode) return;
    await shareCode(myCode);
    toast.success('Compartiendo codigo...');
  };

  const filteredReferrals = referrals.filter((r) => {
    if (activeTab === 'pending') return r.status === 'pending' || r.status === 'registered';
    if (activeTab === 'completed') return r.status === 'first_ride_completed' || r.status === 'rewarded';
    return true;
  });

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-CR', { day: '2-digit', month: 'short' });
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="px-4 py-6 space-y-6"
    >
      {/* Back button */}
      <motion.div variants={itemVariants} className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="p-2 rounded-xl hover:bg-white/5 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <h1 className="text-xl font-bold text-white">Invitar Amigos</h1>
      </motion.div>

      {/* ─── Hero Card ─── */}
      <motion.div
        variants={itemVariants}
        className="relative overflow-hidden rounded-2xl p-6"
        style={{
          background: 'linear-gradient(135deg, #0f4c75 0%, #06b6d4 50%, #10b981 100%)',
        }}
      >
        {/* Decorative circles */}
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-white/5" />

        <div className="relative z-10 flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0 backdrop-blur-sm">
            <Gift className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-white">Invita amigos, gana premios</h2>
            <p className="text-sm text-white/80 mt-1">
              Gana <span className="font-bold text-white">₡3,000</span> por cada amigo que complete su primer viaje
            </p>
            <div className="mt-2 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
              <span className="text-xs text-white/90 font-medium">
                Tu amigo tambien gana ₡1,500
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ─── My Referral Code ─── */}
      <motion.div variants={itemVariants} className="glass-strong rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <UserPlus className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-semibold text-white">Mi Codigo de Invitacion</span>
        </div>

        {myCode ? (
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-white/5 border border-cyan-500/30 rounded-xl px-4 py-3 text-center">
              <span className="text-xl sm:text-2xl font-mono font-bold tracking-widest text-cyan-400 glow-text">
                {myCode}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-center py-3">
            <p className="text-sm text-gray-400 mb-3">Genera tu codigo unico para invitar amigos</p>
          </div>
        )}

        <div className="flex gap-2 mt-3">
          {myCode ? (
            <>
              <button
                type="button"
                onClick={handleCopy}
                className="flex-1 flex items-center justify-center gap-2 bg-white/5 border border-white/10 rounded-xl py-2.5 text-sm text-white hover:bg-white/10 transition-colors"
              >
                {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copiado!' : 'Copiar'}
              </button>
              <button
                type="button"
                onClick={handleShareGeneric}
                className="flex-1 flex items-center justify-center gap-2 btn-neon rounded-xl py-2.5 text-sm text-white"
              >
                <Share2 className="w-4 h-4" />
                Compartir
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleGenerateCode}
              disabled={codeLoading}
              className="w-full flex items-center justify-center gap-2 btn-neon rounded-xl py-2.5 text-sm text-white disabled:opacity-50"
            >
              {codeLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {codeLoading ? 'Generando...' : 'Generar Codigo'}
            </button>
          )}
        </div>
      </motion.div>

      {/* ─── Share Options ─── */}
      {myCode && (
        <motion.div variants={itemVariants} className="glass-strong rounded-2xl p-5">
          <span className="text-sm font-semibold text-white mb-3 block">Compartir via</span>
          <div className="grid grid-cols-3 gap-3">
            {/* WhatsApp */}
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-green-500/10 border border-green-500/20 hover:bg-green-500/20 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-green-400" />
              </div>
              <span className="text-xs text-green-400 font-medium">WhatsApp</span>
            </button>

            {/* SMS */}
            <button
              type="button"
              onClick={handleShareSMS}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-blue-400" />
              </div>
              <span className="text-xs text-blue-400 font-medium">SMS</span>
            </button>

            {/* Copy */}
            <button
              type="button"
              onClick={handleCopy}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                <Link2 className="w-5 h-5 text-gray-300" />
              </div>
              <span className="text-xs text-gray-300 font-medium">Copiar</span>
            </button>
          </div>
        </motion.div>
      )}

      {/* ─── Stats Row ─── */}
      <motion.div variants={itemVariants} className="grid grid-cols-3 gap-3">
        <div className="glass-strong rounded-xl p-3 text-center">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/15 flex items-center justify-center mx-auto mb-2">
            <Users className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-lg font-bold text-white">{referrals.length}</p>
          <p className="text-[10px] text-gray-500 mt-0.5">Total invitados</p>
        </div>
        <div className="glass-strong rounded-xl p-3 text-center">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center mx-auto mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-lg font-bold text-white">₡{totalEarned.toLocaleString()}</p>
          <p className="text-[10px] text-gray-500 mt-0.5">Ganancias</p>
        </div>
        <div className="glass-strong rounded-xl p-3 text-center">
          <div className="w-8 h-8 rounded-lg bg-yellow-500/15 flex items-center justify-center mx-auto mb-2">
            <Clock className="w-4 h-4 text-yellow-400" />
          </div>
          <p className="text-lg font-bold text-white">{pendingCount}</p>
          <p className="text-[10px] text-gray-500 mt-0.5">Pendientes</p>
        </div>
      </motion.div>

      {/* ─── My Referrals List ─── */}
      <motion.div variants={itemVariants} className="glass-strong rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold text-white">Mis Invitaciones</span>
          <span className="text-xs text-gray-500">{referrals.length} total</span>
        </div>

        {/* Tabs */}
        <div className="flex bg-white/5 rounded-xl p-1 mb-4">
          {([
            { key: 'pending' as TabKey, label: 'Pendientes', count: pendingCount },
            { key: 'completed' as TabKey, label: 'Completados', count: completedCount },
            { key: 'all' as TabKey, label: 'Todos', count: referrals.length },
          ]).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`relative flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${
                activeTab === tab.key ? 'text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {activeTab === tab.key && (
                <motion.div
                  layoutId="referral-tab-active"
                  className="absolute inset-0 bg-white/10 rounded-lg"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10">{tab.label}</span>
              {tab.count > 0 && (
                <span className="relative z-10 ml-1 text-[10px] text-gray-400">({tab.count})</span>
              )}
            </button>
          ))}
        </div>

        {/* Referral List */}
        <div className="max-h-80 overflow-y-auto space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
            </div>
          ) : filteredReferrals.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3">
                <Users className="w-6 h-6 text-gray-600" />
              </div>
              <p className="text-sm text-gray-500">
                {activeTab === 'pending'
                  ? 'No hay invitaciones pendientes'
                  : activeTab === 'completed'
                    ? 'No hay invitaciones completadas'
                    : 'Aun no has invitado a nadie'}
              </p>
              {activeTab === 'all' && (
                <p className="text-xs text-gray-600 mt-1">
                  Comparte tu codigo para empezar a ganar premios
                </p>
              )}
            </div>
          ) : (
            filteredReferrals.map((ref, i) => {
              const status = statusConfig[ref.status] || statusConfig.pending;
              const initials = ref.referred_name?.charAt(0)?.toUpperCase() || '?';

              return (
                <motion.div
                  key={ref.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/3 hover:bg-white/5 transition-colors"
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                    {ref.referred_avatar ? (
                      <img
                        src={ref.referred_avatar}
                        alt={ref.referred_name || ''}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      initials
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">
                      {ref.referred_name || 'Esperando registro...'}
                    </p>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      {formatDate(ref.created_at)}
                    </p>
                  </div>

                  {/* Status + Reward */}
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${status.bg} ${status.color}`}>
                      {status.label}
                    </span>
                    {ref.status === 'rewarded' && (
                      <span className="text-[10px] text-emerald-400 font-semibold">
                        +₡{ref.referrer_reward_amount?.toLocaleString()}
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </motion.div>

      {/* ─── How it Works ─── */}
      <motion.div variants={itemVariants} className="glass-strong rounded-2xl p-5">
        <span className="text-sm font-semibold text-white mb-4 block">Como funciona</span>
        <div className="space-y-3">
          {[
            { step: '1', title: 'Genera tu codigo', desc: 'Crea tu codigo de invitacion unico', icon: Link2 },
            { step: '2', title: 'Comparte con amigos', desc: 'Envialo por WhatsApp, SMS o copialo', icon: Share2 },
            { step: '3', title: 'Tu amigo se registra', desc: 'Usa tu codigo al crear su cuenta', icon: UserPlus },
            { step: '4', title: 'Completa su primer viaje', desc: 'Ambos reciben su bono automaticamente', icon: CheckCircle2 },
          ].map((item) => (
            <div key={item.step} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-cyan-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                <item.icon className="w-4 h-4 text-cyan-400" />
              </div>
              <div>
                <p className="text-sm text-white font-medium">{item.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Bottom spacer for nav */}
      <div className="h-4" />
    </motion.div>
  );
}
