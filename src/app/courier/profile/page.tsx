'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { supabase, type Courier, type Profile } from '@/lib/supabase';
import { toast } from 'sonner';
import {
  User, Mail, Phone, Shield, Star, FileText, Package,
  Bell, Lock, HelpCircle, LogOut, ChevronRight, Camera,
  CreditCard, Clock, Award, CheckCircle2, Loader2,
  Trophy, Diamond, Zap, Crown, Bike, Car,
} from 'lucide-react';

// Level system matching home page
const LEVELS = [
  { name: 'Basico', icon: Zap, minDeliveries: 0, color: 'from-gray-500 to-gray-400', textColor: 'text-gray-300', bgColor: 'bg-gray-500/20', borderColor: 'border-gray-500/30' },
  { name: 'Bronce', icon: Award, minDeliveries: 20, color: 'from-amber-700 to-amber-500', textColor: 'text-amber-500', bgColor: 'bg-amber-500/20', borderColor: 'border-amber-500/30' },
  { name: 'Plata', icon: Shield, minDeliveries: 50, color: 'from-gray-300 to-gray-100', textColor: 'text-gray-200', bgColor: 'bg-gray-300/20', borderColor: 'border-gray-300/30' },
  { name: 'Oro', icon: Trophy, minDeliveries: 100, color: 'from-yellow-500 to-amber-400', textColor: 'text-yellow-400', bgColor: 'bg-yellow-500/20', borderColor: 'border-yellow-500/30' },
  { name: 'Platino', icon: Diamond, minDeliveries: 200, color: 'from-purple-400 to-blue-400', textColor: 'text-purple-400', bgColor: 'bg-purple-400/20', borderColor: 'border-purple-400/30' },
  { name: 'Diamante', icon: Diamond, minDeliveries: 500, color: 'from-orange-400 to-pink-400', textColor: 'text-orange-400', bgColor: 'bg-orange-400/20', borderColor: 'border-orange-400/30' },
];

function getCourierLevel(totalDeliveries: number) {
  let level = LEVELS[0];
  for (const l of LEVELS) {
    if (totalDeliveries >= l.minDeliveries) level = l;
  }
  return level;
}

function getNextLevel(totalDeliveries: number) {
  for (const l of LEVELS) {
    if (totalDeliveries < l.minDeliveries) return l;
  }
  return null;
}

const VEHICLE_LABELS: Record<string, string> = {
  moto: 'Moto',
  bici: 'Bicicleta',
  carro: 'Carro',
};

const VEHICLE_COLORS: Record<string, string> = {
  moto: 'from-orange-500 to-amber-500',
  bici: 'from-emerald-500 to-green-400',
  carro: 'from-purple-500 to-violet-500',
};

export default function CourierProfile() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [courier, setCourier] = useState<Courier | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isEditingVehicle, setIsEditingVehicle] = useState(false);
  const [vehicleForm, setVehicleForm] = useState({
    model: '',
    color: '',
    plate: '',
  });
  const [savingVehicle, setSavingVehicle] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data: courierData } = await supabase
        .from('couriers')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (courierData) {
        setCourier(courierData);
        setVehicleForm({
          model: courierData.vehicle_model || '',
          color: courierData.vehicle_color || '',
          plate: courierData.vehicle_plate || '',
        });
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      setProfile(profileData || null);
    } catch (err) {
      console.error('Error fetching courier profile:', err);
      toast.error('Error al cargar perfil');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const rating = courier?.rating || 0;
  const totalDeliveries = courier?.total_deliveries || 0;
  const totalEarnings = courier?.total_earnings || 0;
  const vehicleType = courier?.vehicle_type || 'moto';
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('es-CR', { month: 'long', year: 'numeric' })
    : 'N/A';
  const earningsDisplay = totalEarnings >= 1000000
    ? `₡${(totalEarnings / 1000000).toFixed(1)}M`
    : `₡${(totalEarnings / 1000).toFixed(0)}k`;

  const level = getCourierLevel(totalDeliveries);
  const nextLevel = getNextLevel(totalDeliveries);
  const progressToNext = nextLevel
    ? ((totalDeliveries / nextLevel.minDeliveries) * 100)
    : 100;
  const deliveriesToNext = nextLevel ? nextLevel.minDeliveries - totalDeliveries : 0;

  const saveVehicle = async () => {
    if (!courier?.id) return;
    setSavingVehicle(true);
    try {
      const { error } = await supabase
        .from('couriers')
        .update({
          vehicle_model: vehicleForm.model,
          vehicle_color: vehicleForm.color,
          vehicle_plate: vehicleForm.plate,
        })
        .eq('id', courier.id);

      if (error) throw error;
      toast.success('Vehiculo actualizado');
      setCourier({ ...courier, ...vehicleForm, vehicle_model: vehicleForm.model, vehicle_color: vehicleForm.color, vehicle_plate: vehicleForm.plate });
      setIsEditingVehicle(false);
    } catch (err) {
      console.error('Error saving vehicle:', err);
      toast.error('Error al guardar vehiculo');
    } finally {
      setSavingVehicle(false);
    }
  };

  const menuItems = [
    { icon: FileText, label: 'Editar perfil', desc: 'Actualizar datos personales', action: () => router.push('/courier/support'), color: 'text-purple-400 bg-purple-500/20' },
    { icon: Bike, label: 'Vehiculo', desc: `${VEHICLE_LABELS[vehicleType]} - ${courier?.vehicle_plate || 'Configurar placa'}`, action: () => setIsEditingVehicle(true), color: 'text-orange-400 bg-orange-500/20' },
    { icon: Bell, label: 'Notificaciones', desc: 'Ver alertas recientes', action: () => router.push('/courier/notifications'), color: 'text-amber-400 bg-amber-500/20' },
    { icon: Lock, label: 'Seguridad', desc: 'Cambiar contrasena', action: () => router.push('/courier/reset-password'), color: 'text-emerald-400 bg-emerald-500/20' },
    { icon: HelpCircle, label: 'Ayuda y Soporte', desc: 'Chat con el equipo RIDA', action: () => router.push('/courier/support'), color: 'text-pink-400 bg-pink-500/20' },
  ];

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
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
        className="bg-gradient-to-br from-purple-600/30 to-orange-500/10 rounded-2xl p-5 border border-orange-500/20 mx-4 mt-4"
      >
        <div className="flex items-center gap-4">
          <div className="relative flex-shrink-0">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-600 to-orange-500 flex items-center justify-center text-2xl font-bold text-white">
              {user?.name?.charAt(0) || 'R'}
            </div>
            <button onClick={() => { const inp = document.createElement('input'); inp.type='file'; inp.accept='image/*'; inp.onchange = async (e) => { const file = (e.target as HTMLInputElement).files?.[0]; if (!file) return; toast.info('Foto seleccionada. Sube tu foto desde Editar perfil.'); }; inp.click(); }} className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center border-2 border-rida-dark">
              <Camera className="w-3 h-3 text-white" />
            </button>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white truncate">{user?.name || 'Repartidor'}</h2>
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
                <span className="text-xs font-bold text-white">{rating > 0 ? rating.toFixed(2) : '5.00'}</span>
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
              <Crown className="w-3 h-3 text-orange-400" />
              <span className="text-xs text-gray-300">
                {nextLevel ? `${deliveriesToNext} entregas a ${nextLevel.name}` : 'Nivel maximo'}
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
              onClick={() => toast.info(`Nivel ${level.name}: Haz ${nextLevel ? nextLevel.minDeliveries - totalDeliveries + ' entregas mas para subir a ' + nextLevel.name : 'nivel maximo alcanzado'}`)}
              className="text-[10px] text-orange-400 font-medium hover:underline"
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
              <Package className="w-4 h-4 text-orange-400" />
              <span className="text-sm font-semibold text-white">Mi Vehiculo</span>
            </div>
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${VEHICLE_COLORS[vehicleType]} flex items-center justify-center`}>
                {vehicleType === 'carro' ? (
                  <Car className="w-6 h-6 text-white" />
                ) : (
                  <Bike className="w-6 h-6 text-white" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-base font-bold text-white">{courier?.vehicle_color} {courier?.vehicle_model || VEHICLE_LABELS[vehicleType]}</p>
                <p className="text-xs text-gray-500">{courier?.vehicle_plate || 'Sin placa configurada'}</p>
              </div>
              <button 
                onClick={() => setIsEditingVehicle(true)}
                className="text-xs font-medium text-orange-400 px-3 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20"
              >
                Editar
              </button>
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="grid grid-cols-3 gap-2">
          <div className="glass rounded-xl p-3 text-center">
            <Clock className="w-5 h-5 text-orange-400 mx-auto mb-1" />
            <p className="text-lg font-bold text-white">{totalDeliveries}</p>
            <p className="text-[10px] text-gray-500">Entregas total</p>
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
              onClick={() => item.action?.()}
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
          onClick={async () => { toast.success('Sesion cerrada'); await logout(); router.replace('/courier/login'); }}
          className="w-full bg-red-500/10 border border-red-500/30 text-red-400 font-medium py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-red-500/20 mb-4"
        >
          <LogOut className="w-4 h-4" /> Cerrar Sesion
        </motion.button>
      </div>

      {/* Edit Vehicle Modal */}
      {isEditingVehicle && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            onClick={() => setIsEditingVehicle(false)}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm" 
          />
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="relative w-full max-w-md glass-strong rounded-3xl p-6 border border-white/10 shadow-2xl"
          >
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Bike className="w-5 h-5 text-orange-400" />
              Detalles del Vehiculo
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block ml-1">Modelo / Marca</label>
                <input
                  type="text"
                  placeholder="Ej: Yamaha FZ 250"
                  value={vehicleForm.model}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, model: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-orange-500 transition-colors"
                />
              </div>
              
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block ml-1">Color</label>
                <input
                  type="text"
                  placeholder="Ej: Negro Mate"
                  value={vehicleForm.color}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, color: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-orange-500 transition-colors"
                />
              </div>
              
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block ml-1">Placa</label>
                <input
                  type="text"
                  placeholder="Ej: ABC-123"
                  value={vehicleForm.plate}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, plate: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-orange-500 transition-colors uppercase"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setIsEditingVehicle(false)}
                className="flex-1 py-3 rounded-xl bg-white/5 text-gray-300 font-bold hover:bg-white/10 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={saveVehicle}
                disabled={savingVehicle}
                className="flex-[2] py-3 rounded-xl bg-orange-500 text-white font-bold hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingVehicle ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar Cambios'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
