'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { supabase, type Driver, type Vehicle, type Profile } from '@/lib/supabase';
import { toast } from 'sonner';
import {
  User, Mail, Phone, Shield, Star, FileText, Car,
  Bell, Lock, HelpCircle, LogOut, ChevronRight, Camera,
  CreditCard, Clock, Award, CheckCircle2, Loader2,
  Trophy, Diamond, Zap, Crown,
} from 'lucide-react';

// Level system matching home page
const LEVELS = [
  { name: 'Basico', icon: Zap, minTrips: 0, color: 'from-gray-500 to-gray-400', textColor: 'text-gray-300', bgColor: 'bg-gray-500/20', borderColor: 'border-gray-500/30' },
  { name: 'Bronce', icon: Award, minTrips: 20, color: 'from-amber-700 to-amber-500', textColor: 'text-amber-500', bgColor: 'bg-amber-500/20', borderColor: 'border-amber-500/30' },
  { name: 'Plata', icon: Shield, minTrips: 50, color: 'from-gray-300 to-gray-100', textColor: 'text-gray-200', bgColor: 'bg-gray-300/20', borderColor: 'border-gray-300/30' },
  { name: 'Oro', icon: Trophy, minTrips: 100, color: 'from-yellow-500 to-amber-400', textColor: 'text-yellow-400', bgColor: 'bg-yellow-500/20', borderColor: 'border-yellow-500/30' },
  { name: 'Platino', icon: Diamond, minTrips: 200, color: 'from-cyan-400 to-blue-400', textColor: 'text-cyan-400', bgColor: 'bg-cyan-400/20', borderColor: 'border-cyan-400/30' },
  { name: 'Diamante', icon: Diamond, minTrips: 500, color: 'from-purple-400 to-pink-400', textColor: 'text-purple-400', bgColor: 'bg-purple-400/20', borderColor: 'border-purple-400/30' },
];

function getDriverLevel(totalRides: number) {
  let level = LEVELS[0];
  for (const l of LEVELS) {
    if (totalRides >= l.minTrips) level = l;
  }
  return level;
}

function getNextLevel(totalRides: number) {
  for (const l of LEVELS) {
    if (totalRides < l.minTrips) return l;
  }
  return null;
}

export default function DriverProfile() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data: driverData } = await supabase
        .from('drivers')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (driverData) {
        setDriver(driverData);
        if (driverData.id) {
          const { data: vehicleData } = await supabase
            .from('vehicles')
            .select('*')
            .eq('driver_id', driverData.id)
            .single();
          setVehicle(vehicleData || null);
        }
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      setProfile(profileData || null);
    } catch (err) {
      console.error('Error fetching driver profile:', err);
      toast.error('Error al cargar perfil');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const rating = driver?.rating || 0;
  const totalRides = driver?.total_rides || 0;
  const totalEarnings = driver?.total_earnings || 0;
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('es-CR', { month: 'long', year: 'numeric' })
    : 'N/A';
  const earningsDisplay = totalEarnings >= 1000000
    ? `₡${(totalEarnings / 1000000).toFixed(1)}M`
    : `₡${(totalEarnings / 1000).toFixed(0)}k`;

  const level = getDriverLevel(totalRides);
  const nextLevel = getNextLevel(totalRides);
  const progressToNext = nextLevel
    ? ((totalRides / nextLevel.minTrips) * 100)
    : 100;
  const tripsToNext = nextLevel ? nextLevel.minTrips - totalRides : 0;

  const vehicleDesc = vehicle
    ? `${vehicle.model} ${vehicle.year || ''}`.trim()
    : 'Sin vehiculo registrado';

  const menuItems = [
    { icon: FileText, label: 'Documentos', desc: 'Verificacion de conductor', href: '/driver/verification', color: 'text-blue-400 bg-blue-500/20' },
    { icon: Car, label: 'Vehiculo', desc: vehicleDesc, href: '/driver/vehicle', color: 'text-cyan-400 bg-cyan-500/20' },
    { icon: Bell, label: 'Notificaciones', desc: 'Configuracion de alertas', href: '/driver/notifications', color: 'text-amber-400 bg-amber-500/20' },
    { icon: Lock, label: 'Seguridad', desc: 'Cambiar contrasena', href: '/driver/security', color: 'text-emerald-400 bg-emerald-500/20' },
    { icon: FileText, label: 'Terminos', desc: 'Terminos y condiciones', href: '/driver/terms', color: 'text-purple-400 bg-purple-500/20' },
    { icon: HelpCircle, label: 'Soporte', desc: 'Ayuda 24/7', href: '/driver/support', color: 'text-pink-400 bg-pink-500/20' },
  ];

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          <p className="text-sm text-gray-400">Cargando perfil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Profile Header Card with Level */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-blue-600/30 to-cyan-500/10 rounded-2xl p-5 border border-cyan-500/20 mx-4 mt-4"
      >
        <div className="flex items-center gap-4">
          <div className="relative flex-shrink-0">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-2xl font-bold text-white">
              {user?.name?.charAt(0) || 'C'}
            </div>
            <label className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-cyan-500 flex items-center justify-center border-2 border-rida-dark cursor-pointer hover:bg-cyan-400 transition-colors">
              <Camera className="w-3 h-3 text-white" />
              <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 5 * 1024 * 1024) { toast.error('La imagen no puede superar 5MB'); return; }
                try {
                  const formData = new FormData();
                  formData.append('file', file);
                  formData.append('userId', user?.id || '');
                  formData.append('type', 'avatar');
                  const res = await fetch('/api/drivers/upload-document', { method: 'POST', body: formData });
                  const data = await res.json();
                  if (res.ok && data.url) {
                    toast.success('Foto de perfil actualizada');
                    useAuthStore.getState().updateProfile({ avatar: data.url });
                  } else { toast.error(data.error || 'Error al subir imagen'); }
                } catch { toast.error('Error al subir imagen'); }
              }} />
            </label>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white truncate">{user?.name || 'Conductor'}</h2>
              {/* Level Badge */}
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${level.bgColor} border ${level.borderColor}`}>
                <level.icon className={`w-3 h-3 ${level.textColor}`} />
                <span className={`text-[10px] font-bold ${level.textColor}`}>{level.name}</span>
              </div>
            </div>
            {/* Rating */}
            <div className="flex items-center gap-1.5 mt-1">
              <div className="flex items-center gap-0.5 bg-black/40 px-2 py-0.5 rounded-full">
                <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                <span className="text-xs font-bold text-white">{rating > 0 ? rating.toFixed(2) : '\u2014'}</span>
              </div>
              {user?.isVerified && (
                <span className="flex items-center gap-0.5 text-[10px] text-emerald-400">
                  <CheckCircle2 className="w-3 h-3" />
                  Verificado
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Level Progress */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-gray-300">Tu nivel esta semana</span>
            <div className="flex items-center gap-1">
              <Crown className="w-3 h-3 text-cyan-400" />
              <span className="text-xs text-gray-300">
                {nextLevel ? `${tripsToNext} viajes a ${nextLevel.name}` : 'Nivel maximo'}
              </span>
            </div>
          </div>
          <div className="w-full bg-white/10 rounded-full h-2.5">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(progressToNext, 100)}%` }}
              transition={{ duration: 1, delay: 0.2 }}
              className={`h-2.5 rounded-full bg-gradient-to-r ${nextLevel ? nextLevel.color : level.color}`}
            />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[10px] text-gray-500">Manten tu calificacion 4.85+</span>
            <button
              onClick={() => router.push('/driver/rewards')}
              className="text-[10px] text-cyan-400 font-medium hover:underline"
            >
              Ver beneficios
            </button>
          </div>
        </div>
      </motion.div>

      <div className="px-4 space-y-4">
        {/* Vehicle Info */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          <div className="glass rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Car className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-semibold text-white">Mi Vehiculo</span>
            </div>
            {vehicle ? (
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <p className="text-xs text-gray-500">Placa</p>
                  <p className="text-sm font-bold text-white">{vehicle.plate}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${vehicle.verified ? 'text-emerald-400 bg-emerald-500/20' : 'text-amber-400 bg-amber-500/20'}`}>
                    {vehicle.verified ? 'Verificado' : 'Pendiente'}
                  </span>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">Modelo</p>
                  <p className="text-sm font-bold text-white">{vehicle.model}</p>
                  <span className="text-[10px] text-gray-500">{vehicle.year || '-'}</span>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">Color</p>
                  <div className="flex items-center justify-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-gray-400" />
                    <p className="text-sm font-bold text-white">{vehicle.color}</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-2">Vehiculo no registrado</p>
            )}
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="grid grid-cols-3 gap-2">
          <div className="glass rounded-xl p-3 text-center">
            <Clock className="w-5 h-5 text-cyan-400 mx-auto mb-1" />
            <p className="text-lg font-bold text-white">{totalRides}</p>
            <p className="text-[10px] text-gray-500">Viajes total</p>
          </div>
          <div className="glass rounded-xl p-3 text-center">
            <Award className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
            <p className="text-lg font-bold text-white">{earningsDisplay}</p>
            <p className="text-[10px] text-gray-500">Ganancias total</p>
          </div>
          <div className="glass rounded-xl p-3 text-center">
            <CreditCard className="w-5 h-5 text-amber-400 mx-auto mb-1" />
            <p className="text-sm font-bold text-white">{memberSince}</p>
            <p className="text-[10px] text-gray-500">Miembro desde</p>
          </div>
        </motion.div>

        {/* Contact Info */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className="glass rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center">
              <Mail className="w-4 h-4 text-gray-500" />
            </div>
            <div>
              <p className="text-[10px] text-gray-500">Correo</p>
              <p className="text-sm text-white truncate">{user?.email || 'N/A'}</p>
            </div>
          </div>
          <div className="w-full h-px bg-white/5" />
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center">
              <Phone className="w-4 h-4 text-gray-500" />
            </div>
            <div>
              <p className="text-[10px] text-gray-500">Telefono</p>
              <p className="text-sm text-white">{user?.phone || 'N/A'}</p>
            </div>
          </div>
        </motion.div>

        {/* Menu Items */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="space-y-2">
          {menuItems.map((item, i) => (
            <button
              key={i}
              onClick={() => item.href && router.push(item.href)}
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

        {/* Logout */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          onClick={async () => { toast.success('Sesion cerrada'); await logout(); router.replace('/driver/login'); }}
          className="w-full bg-red-500/10 border border-red-500/30 text-red-400 font-medium py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-red-500/20 mb-4"
        >
          <LogOut className="w-4 h-4" /> Cerrar Sesion
        </motion.button>
      </div>
    </div>
  );
}
