'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { User, Mail, Phone, Shield, Star, CreditCard, FileText, HelpCircle, LogOut, ChevronRight, Camera, Bell, Lock, Loader2, X, Upload } from 'lucide-react';
import { EmergencyContacts } from '@/components/EmergencyContacts';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useState, useEffect, useCallback, useRef } from 'react';

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export default function ClientProfile() {
  const router = useRouter();
  const { user, session, logout } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [totalRides, setTotalRides] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [memberSince, setMemberSince] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const fetchProfileStats = useCallback(async (userId: string) => {
    try {
      // Query rides for count and average rating
      const { data: rideData, error: rideError } = await supabase
        .from('rides')
        .select('rider_rating')
        .eq('rider_id', userId)
        .eq('status', 'completed');

      if (!rideError && rideData) {
        setTotalRides(rideData.length);
        const ratedRides = rideData.filter(r => r.rider_rating != null);
        if (ratedRides.length > 0) {
          const avg = ratedRides.reduce((sum, r) => sum + (r.rider_rating || 0), 0) / ratedRides.length;
          setAvgRating(Math.round(avg * 10) / 10);
        }
      }

      // Query marketplace orders (deliveries)
      const { count: orderCount } = await supabase
        .from('deliveries')
        .select('*', { count: 'exact', head: true })
        .eq('customer_id', userId);
      
      setTotalOrders(orderCount || 0);

      // Get member since date from profiles
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('created_at')
        .eq('id', userId)
        .single();

      if (!profileError && profileData?.created_at) {
        const date = new Date(profileData.created_at);
        const month = MONTH_NAMES[date.getMonth()];
        const year = date.getFullYear();
        setMemberSince(`${month} ${year}`);
      }

      // Get avatar from profiles
      const { data: avatarData } = await supabase
        .from('profiles')
        .select('avatar')
        .eq('id', userId)
        .single();
      if (avatarData?.avatar) {
        setAvatarUrl(avatarData.avatar);
      }
    } catch (err) {
      console.error('Profile stats error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.id) {
      fetchProfileStats(user.id);
      setEditName(user.name || '');
      setEditPhone(user.phone || '');
    }
  }, [user?.id, user.name, user.phone, fetchProfileStats]);

  const handleUpdateProfile = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: editName,
          phone: editPhone
        })
        .eq('id', user.id);

      if (error) throw error;
      toast.success('Perfil actualizado correctamente');
      setIsEditing(false);
    } catch (err) {
      toast.error('Error al actualizar datos');
    } finally {
      setSaving(false);
    }
  };

  const menuItems = [
    { icon: CreditCard, label: 'Billetera', desc: 'Saldo y metodos de pago', href: '/client/wallet', color: 'text-emerald-400 bg-emerald-500/20' },
    { icon: FileText, label: 'Documentos', desc: 'Verificacion de identidad', href: '/client/verification', color: 'text-blue-400 bg-blue-500/20' },
    { icon: Bell, label: 'Notificaciones', desc: 'Configuracion de alertas', href: '/client/notifications', color: 'text-cyan-400 bg-cyan-500/20' },
    { icon: Lock, label: 'Seguridad', desc: 'Cambiar contrasena', href: '/client/security', color: 'text-amber-400 bg-amber-500/20' },
    { icon: FileText, label: 'Terminos', desc: 'Terminos y condiciones', href: '/client/terms', color: 'text-purple-400 bg-purple-500/20' },
    { icon: HelpCircle, label: 'Soporte', desc: 'Ayuda 24/7', href: '/client/support', color: 'text-pink-400 bg-pink-500/20' },
  ];

  if (loading) {
    return (
      <div className="p-4 space-y-6">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
        </div>
      </div>
    );
  }

  const handleAvatarUpload = async (file: File) => {
    if (!user?.id) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen no puede ser mayor a 5MB');
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Solo se permiten imagenes');
      return;
    }
    setIsUploadingAvatar(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
      const publicUrl = urlData.publicUrl + '?t=' + Date.now();
      setAvatarUrl(publicUrl);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar: publicUrl })
        .eq('id', user.id);
      if (updateError) throw updateError;

      toast.success('Foto de perfil actualizada');
      setShowAvatarModal(false);
    } catch (err: any) {
      toast.error('Error al subir foto: ' + (err?.message || 'Intenta de nuevo'));
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const openCamera = async () => {
    setShowAvatarModal(false);
    // Best approach: use hidden input with capture attribute (works on mobile & desktop)
    if (cameraInputRef.current) {
      cameraInputRef.current.click();
      return;
    }
    // Fallback: getUserMedia API
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 640 } });
      const video = document.createElement('video');
      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');
      await video.play();
      await new Promise(r => setTimeout(r, 500));
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d')?.drawImage(video, 0, 0);
      stream.getTracks().forEach(t => t.stop());
      const dataURL = canvas.toDataURL('image/jpeg', 0.85);
      const arr = dataURL.split(',');
      const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) u8arr[n] = bstr.charCodeAt(n);
      const blob = new Blob([u8arr], { type: mime });
      if (blob.size === 0) {
        toast.error('No se pudo capturar la foto. Intenta subir desde la galeria.');
        fileInputRef.current?.click();
        return;
      }
      const file = new File([blob], `avatar_${Date.now()}.jpg`, { type: 'image/jpeg' });
      await handleAvatarUpload(file);
    } catch (err) {
      console.error('Camera error:', err);
      toast.error('No se pudo acceder a la camara. Se abrira la galeria.');
      fileInputRef.current?.click();
    }
  };

  const displayRating = avgRating !== null ? avgRating.toFixed(1) : '--';

  return (
    <div className="p-4 space-y-6">
      {/* Profile Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <div className="relative inline-block">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-3xl font-bold text-white mx-auto overflow-hidden">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              user?.name?.charAt(0) || 'U'
            )}
          </div>
          <button onClick={() => setShowAvatarModal(true)} className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-cyan-500 flex items-center justify-center">
            <Camera className="w-4 h-4 text-white" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleAvatarUpload(file);
              e.target.value = '';
            }}
          />
          {/* Hidden camera input — mobile-friendly fallback */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="user"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleAvatarUpload(file);
              e.target.value = '';
            }}
          />
        </div>

        {/* Avatar Upload Modal */}
        {showAvatarModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center" onClick={() => setShowAvatarModal(false)}>
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              className="glass-strong rounded-t-2xl p-5 w-full max-w-sm space-y-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Cambiar foto de perfil</h3>
                <button onClick={() => setShowAvatarModal(false)} className="p-1 rounded-lg hover:bg-white/10">
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
              {isUploadingAvatar ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
                  <span className="text-sm text-gray-400 ml-2">Subiendo foto...</span>
                </div>
              ) : (
                <>
                  <button onClick={openCamera} className="w-full flex items-center gap-3 p-3 rounded-xl glass hover:bg-white/10 transition-colors">
                    <Camera className="w-5 h-5 text-cyan-400" />
                    <span className="text-sm text-white">Tomar foto</span>
                  </button>
                  <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center gap-3 p-3 rounded-xl glass hover:bg-white/10 transition-colors">
                    <Upload className="w-5 h-5 text-cyan-400" />
                    <span className="text-sm text-white">Subir desde galeria</span>
                  </button>
                </>
              )}
            </motion.div>
          </div>
        )}
        <h2 className="text-xl font-bold text-white mt-3">{user?.name || 'Usuario'}</h2>
        <div className="flex items-center justify-center gap-2 mt-1">
          <span className={`text-xs px-2 py-0.5 rounded-full ${user?.isVerified ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
            {user?.isVerified ? 'Verificado' : 'Sin verificar'}
          </span>
          <div className="flex items-center gap-1">
            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
            <span className="text-xs text-gray-400">{displayRating}</span>
          </div>
        </div>

        {/* Edit Button */}
        <button 
          onClick={() => setIsEditing(!isEditing)}
          className="mt-4 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-[11px] font-bold text-gray-400 hover:text-white transition-colors"
        >
          {isEditing ? 'Cancelar edición' : 'Editar información'}
        </button>

        {/* Edit Form */}
        <AnimatePresence>
          {isEditing && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-6 space-y-3 overflow-hidden"
            >
              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-[10px] font-bold text-gray-500 uppercase ml-4">Nombre Completo</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                    type="text" 
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-11 pr-4 text-sm text-white focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-[10px] font-bold text-gray-500 uppercase ml-4">Teléfono</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                    type="tel" 
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-11 pr-4 text-sm text-white focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
              </div>
              <button 
                onClick={handleUpdateProfile}
                disabled={saving}
                className="w-full py-3.5 rounded-2xl bg-cyan-600 text-white font-bold text-sm shadow-lg shadow-cyan-600/20 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar Cambios'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Info Cards */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-3 gap-2">
        <div className="glass rounded-xl p-3">
          <p className="text-[10px] text-gray-500">Viajes</p>
          <p className="text-base font-bold text-white">{totalRides}</p>
        </div>
        <div className="glass rounded-xl p-3">
          <p className="text-[10px] text-gray-500">Pedidos</p>
          <p className="text-base font-bold text-white">{totalOrders}</p>
        </div>
        <div className="glass rounded-xl p-3">
          <p className="text-[10px] text-gray-500">Miembro</p>
          <p className="text-[10px] font-bold text-white truncate">{memberSince || '--'}</p>
        </div>
      </motion.div>

      {/* Menu Items */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="space-y-2">
        {menuItems.map((item, i) => (
          <button
            key={i}
            onClick={() => item.href ? router.push(item.href) : item.action?.()}
            className="w-full glass rounded-xl p-3 flex items-center gap-3 hover:bg-white/5 transition-colors"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.color}`}>
              <item.icon className="w-5 h-5" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-white">{item.label}</p>
              <p className="text-xs text-gray-500">{item.desc}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        ))}
      </motion.div>

      {/* Emergency Contacts */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <EmergencyContacts session={session ? { access_token: session.access_token } : null} />
      </motion.div>

      {/* Logout */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        onClick={async () => { toast.success('Sesion cerrada'); await logout(); router.replace('/client/login'); }}
        className="w-full bg-red-500/10 border border-red-500/30 text-red-400 font-medium py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-red-500/20"
      >
        <LogOut className="w-4 h-4" /> Cerrar Sesion
      </motion.button>
    </div>
  );
}
