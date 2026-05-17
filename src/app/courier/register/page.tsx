'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, User, Phone, ArrowRight, ArrowLeft, Package, Bike, Car, Check } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';

const VEHICLE_TYPES = [
  { id: 'moto', label: 'Moto', icon: Bike, desc: 'Entregas rapidas', color: 'from-orange-500 to-amber-500', selectedColor: 'border-orange-500 bg-orange-500/10' },
  { id: 'bici', label: 'Bicicleta', icon: Bike, desc: 'Eco-friendly', color: 'from-emerald-500 to-green-400', selectedColor: 'border-emerald-500 bg-emerald-500/10' },
  { id: 'carro', label: 'Carro', icon: Car, desc: 'Entregas grandes', color: 'from-purple-500 to-violet-500', selectedColor: 'border-purple-500 bg-purple-500/10' },
];

export default function CourierRegister() {
  const router = useRouter();
  const { register, isLoading } = useAuthStore();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    vehicleType: '',
    password: '',
    confirmPassword: '',
    acceptTerms: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState(1);

  const updateForm = (key: string, value: string | boolean) => setForm(prev => ({ ...prev, [key]: value }));

  const handleRegister = async () => {
    if (!form.name || !form.email || !form.phone || !form.vehicleType || !form.password) {
      toast.error('Completa todos los campos');
      return;
    }
    if (form.password !== form.confirmPassword) {
      toast.error('Las contrasenas no coinciden');
      return;
    }
    if (form.password.length < 6) {
      toast.error('La contrasena debe tener al menos 6 caracteres');
      return;
    }
    if (!form.acceptTerms) {
      toast.error('Debes aceptar los terminos y condiciones');
      return;
    }

    const result = await register(form.name, form.email, form.phone, form.password, 'courier');
    if (result.success) {
      toast.success('Cuenta de repartidor creada exitosamente!');
      router.push('/courier');
    } else {
      toast.error(result.error || 'Error al crear cuenta');
    }
  };

  return (
    <div className="min-h-screen bg-rida-dark flex flex-col items-center justify-center p-6">
      <div className="absolute inset-0 bg-gradient-radial pointer-events-none" />

      <motion.div className="w-full max-w-sm relative z-10" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-orange-500 flex items-center justify-center mx-auto mb-4"
            style={{ boxShadow: '0 0 20px rgba(168, 85, 247, 0.3), 0 0 60px rgba(249, 115, 22, 0.1)' }}
          >
            <Package className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Crear Cuenta</h1>
          <p className="text-sm text-gray-400 mt-1">Conviertete en repartidor RIDA</p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-6">
          {[1, 2].map(s => (
            <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${step >= s ? 'bg-orange-500' : 'bg-white/10'}`} />
          ))}
        </div>

        <div className="glass-strong rounded-2xl p-6 space-y-4">
          {step === 1 ? (
            <>
              <h2 className="text-lg font-semibold text-white">Datos Personales</h2>
              <div className="space-y-3">
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input type="text" placeholder="Nombre completo" value={form.name} onChange={(e) => updateForm('name', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-orange-500" />
                </div>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input type="email" placeholder="Correo electronico" value={form.email} onChange={(e) => updateForm('email', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-orange-500" />
                </div>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input type="tel" placeholder="Telefono (+506)" value={form.phone} onChange={(e) => updateForm('phone', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-orange-500" />
                </div>

                {/* Vehicle Type Selector */}
                <div>
                  <p className="text-sm text-gray-400 mb-2">Tipo de vehiculo</p>
                  <div className="grid grid-cols-3 gap-2">
                    {VEHICLE_TYPES.map((vt) => {
                      const isSelected = form.vehicleType === vt.id;
                      return (
                        <button
                          key={vt.id}
                          onClick={() => updateForm('vehicleType', vt.id)}
                          className={`relative p-3 rounded-xl border transition-all flex flex-col items-center gap-1.5 ${
                            isSelected ? vt.selectedColor : 'border-white/10 hover:border-white/20'
                          }`}
                        >
                          {isSelected && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center"
                            >
                              <Check className="w-2.5 h-2.5 text-white" />
                            </motion.div>
                          )}
                          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${vt.color} flex items-center justify-center`}>
                            <vt.icon className="w-5 h-5 text-white" />
                          </div>
                          <span className="text-xs font-medium text-white">{vt.label}</span>
                          <span className="text-[9px] text-gray-500">{vt.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <button onClick={() => {
                if (form.name && form.email && form.phone && form.vehicleType) setStep(2);
                else toast.error('Completa todos los campos');
              }} className="w-full font-medium py-3 rounded-xl flex items-center justify-center gap-2 text-white" style={{
                background: 'linear-gradient(135deg, #9333ea, #f97316)',
                boxShadow: '0 0 20px rgba(249, 115, 22, 0.3)',
              }}>
                Siguiente <ArrowRight className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-white">Seguridad</h2>
              <div className="space-y-3">
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input type={showPassword ? 'text' : 'password'} placeholder="Contrasena" value={form.password} onChange={(e) => updateForm('password', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-orange-500" />
                  <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input type="password" placeholder="Confirmar contrasena" value={form.confirmPassword} onChange={(e) => updateForm('confirmPassword', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-orange-500" />
                </div>
                <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl p-3">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.acceptTerms} onChange={(e) => updateForm('acceptTerms', e.target.checked)} className="mt-0.5 accent-orange-500" />
                    <span className="text-xs text-gray-400">Acepto los Terminos y Condiciones, la Politica de Privacidad. Confirmo que <span className="text-amber-400 font-medium">no puedo prestar mi cuenta a terceros</span> y soy el unico responsable del uso de la plataforma.</span>
                  </label>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="flex-1 border border-white/10 text-gray-300 py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-white/5">
                  <ArrowLeft className="w-4 h-4" /> Atras
                </button>
                <button onClick={handleRegister} disabled={isLoading} className="flex-1 font-medium py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 text-white" style={{
                  background: 'linear-gradient(135deg, #9333ea, #f97316)',
                  boxShadow: '0 0 20px rgba(249, 115, 22, 0.3)',
                }}>
                  {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>Registrarse</>}
                </button>
              </div>
            </>
          )}
        </div>

        <p className="text-center mt-4">
          <span className="text-xs text-gray-500">Ya tienes cuenta? </span>
          <button onClick={() => router.push('/courier/login')} className="text-xs text-orange-400 hover:underline">Inicia sesion</button>
        </p>
      </motion.div>
    </div>
  );
}
