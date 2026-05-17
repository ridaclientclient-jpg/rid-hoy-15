'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, Zap, User, Phone, ArrowRight, ArrowLeft, Car, Bike } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';

type ServiceMode = 'conductor' | 'repartidor' | 'ambos';

const serviceModes: { id: ServiceMode; label: string; desc: string; icon: typeof Car }[] = [
  { id: 'conductor', label: 'Conductor', desc: 'Transporte de pasajeros', icon: Car },
  { id: 'repartidor', label: 'Repartidor', desc: 'Entregas y paquetes', icon: Bike },
  { id: 'ambos', label: 'Ambos', desc: 'Conductor y repartidor', icon: Zap },
];

const vehicleTypes = [
  { id: 'carro', label: 'Carro', emoji: 'Carro' },
  { id: 'moto', label: 'Moto', emoji: 'Moto' },
  { id: 'bici', label: 'Bicicleta', emoji: 'Bici' },
];

export default function DriverRegister() {
  const router = useRouter();
  const { register, isLoading } = useAuthStore();
  const [step, setStep] = useState(1);
  const [serviceMode, setServiceMode] = useState<ServiceMode>('conductor');
  const [vehicleType, setVehicleType] = useState('carro');
  const [form, setForm] = useState({
    name: '', email: '', phone: '', plate: '', model: '', color: '',
    password: '', confirmPassword: '', acceptTerms: false,
  });
  const [showPassword, setShowPassword] = useState(false);

  const updateForm = (key: string, value: string | boolean) => setForm(prev => ({ ...prev, [key]: value }));

  const isRepartidor = serviceMode === 'repartidor' || serviceMode === 'ambos';

  const handleNextStep1 = () => {
    if (!form.name || !form.email || !form.phone) {
      toast.error('Completa nombre, correo y telefono');
      return;
    }
    setStep(2);
  };

  const handleNextStep2 = () => {
    // Vehicle info only required for conductors
    if (!isRepartidor) {
      if (!form.plate || !form.model || !form.color) {
        toast.error('Completa los datos del vehiculo');
        return;
      }
    }
    setStep(3);
  };

  const handleRegister = async () => {
    if (!form.password) {
      toast.error('Ingresa una contrasena');
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

    const result = await register(form.name, form.email, form.phone, form.password, 'driver');
    if (result.success) {
      toast.success('Cuenta creada exitosamente!');
      router.push('/driver');
    } else {
      toast.error(result.error || 'Error al crear cuenta');
    }
  };

  return (
    <div className="min-h-screen bg-rida-dark flex flex-col items-center justify-center p-6">
      <div className="absolute inset-0 bg-gradient-radial pointer-events-none" />

      <motion.div className="w-full max-w-sm relative z-10" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center mx-auto mb-4 glow-cyan">
            {isRepartidor ? <Bike className="w-8 h-8 text-white" /> : <Car className="w-8 h-8 text-white" />}
          </div>
          <h1 className="text-2xl font-bold text-white">Crear Cuenta</h1>
          <p className="text-sm text-gray-400 mt-1">Conviertete en parte de RIDA</p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-6">
          {[1, 2, 3].map(s => (
            <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${step >= s ? 'bg-cyan-500' : 'bg-white/10'}`} />
          ))}
        </div>
        <div className="flex justify-between mb-6">
          <span className={`text-[10px] ${step >= 1 ? 'text-cyan-400' : 'text-gray-600'}`}>Datos</span>
          <span className={`text-[10px] ${step >= 2 ? 'text-cyan-400' : 'text-gray-600'}`}>Vehiculo</span>
          <span className={`text-[10px] ${step >= 3 ? 'text-cyan-400' : 'text-gray-600'}`}>Seguridad</span>
        </div>

        <div className="glass-strong rounded-2xl p-6 space-y-4">
          {step === 1 && (
            <>
              <h2 className="text-lg font-semibold text-white">Datos Personales</h2>

              {/* Service Mode Selection */}
              <div className="space-y-2">
                <label className="text-xs text-gray-400 font-medium">Como quieres trabajar?</label>
                <div className="grid grid-cols-3 gap-2">
                  {serviceModes.map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setServiceMode(mode.id)}
                      className={`p-3 rounded-xl border text-center transition-all ${
                        serviceMode === mode.id
                          ? 'border-cyan-500 bg-cyan-500/10'
                          : 'border-white/10 hover:border-white/20'
                      }`}
                    >
                      <mode.icon className={`w-5 h-5 mx-auto ${serviceMode === mode.id ? 'text-cyan-400' : 'text-gray-500'}`} />
                      <p className={`text-[11px] font-medium mt-1 ${serviceMode === mode.id ? 'text-cyan-400' : 'text-gray-400'}`}>
                        {mode.label}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* If repartidor, show vehicle type */}
              {isRepartidor && (
                <div className="space-y-2">
                  <label className="text-xs text-gray-400 font-medium">Tipo de vehiculo para reparto</label>
                  <div className="grid grid-cols-3 gap-2">
                    {vehicleTypes.map((vt) => (
                      <button
                        key={vt.id}
                        type="button"
                        onClick={() => setVehicleType(vt.id)}
                        className={`p-2.5 rounded-xl border text-center transition-all ${
                          vehicleType === vt.id
                            ? 'border-emerald-500 bg-emerald-500/10'
                            : 'border-white/10 hover:border-white/20'
                        }`}
                      >
                        <p className={`text-xs font-medium ${vehicleType === vt.id ? 'text-emerald-400' : 'text-gray-400'}`}>
                          {vt.label}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input type="text" placeholder="Nombre completo" value={form.name} onChange={(e) => updateForm('name', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500" />
                </div>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input type="email" placeholder="Correo electronico" value={form.email} onChange={(e) => updateForm('email', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500" />
                </div>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input type="tel" placeholder="Telefono (+506)" value={form.phone} onChange={(e) => updateForm('phone', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500" />
                </div>
              </div>
              <button onClick={handleNextStep1} className="w-full btn-neon text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2">
                Siguiente <ArrowRight className="w-4 h-4" />
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="text-lg font-semibold text-white">
                {isRepartidor ? 'Datos del Vehiculo (Opcional)' : 'Datos del Vehiculo'}
              </h2>
              {isRepartidor && (
                <p className="text-xs text-gray-500">Los datos del vehiculo son opcionales para repartidores, pero recomendamos registrarlos para mejor confianza.</p>
              )}
              <div className="space-y-3">
                <div className="relative">
                  <Car className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input type="text" placeholder="Placa del vehiculo (opcional)" value={form.plate} onChange={(e) => updateForm('plate', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input type="text" placeholder="Modelo (opcional)" value={form.model} onChange={(e) => updateForm('model', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500" />
                  <input type="text" placeholder="Color (opcional)" value={form.color} onChange={(e) => updateForm('color', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500" />
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="flex-1 border border-white/10 text-gray-300 py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-white/5">
                  <ArrowLeft className="w-4 h-4" /> Atras
                </button>
                <button onClick={handleNextStep2} className="flex-1 btn-neon text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2">
                  Siguiente <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="text-lg font-semibold text-white">Seguridad</h2>

              {/* Summary */}
              <div className="glass rounded-xl p-3 space-y-1.5">
                <p className="text-xs text-gray-500">Resumen:</p>
                <p className="text-xs text-gray-300">Modo: <span className="text-cyan-400 font-medium">{serviceModes.find(m => m.id === serviceMode)?.label}</span></p>
                {isRepartidor && (
                  <p className="text-xs text-gray-300">Vehiculo de reparto: <span className="text-emerald-400 font-medium">{vehicleTypes.find(v => v.id === vehicleType)?.label}</span></p>
                )}
                {form.name && <p className="text-xs text-gray-300">Nombre: <span className="text-white">{form.name}</span></p>}
                {form.email && <p className="text-xs text-gray-300">Correo: <span className="text-white">{form.email}</span></p>}
              </div>

              <div className="space-y-3">
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input type={showPassword ? 'text' : 'password'} placeholder="Contrasena" value={form.password} onChange={(e) => updateForm('password', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input type="password" placeholder="Confirmar contrasena" value={form.confirmPassword} onChange={(e) => updateForm('confirmPassword', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500" />
                </div>
                <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-3">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.acceptTerms} onChange={(e) => updateForm('acceptTerms', e.target.checked)} className="mt-0.5 accent-cyan-500" />
                    <span className="text-xs text-gray-400">Acepto los <span className="text-cyan-400 hover:underline cursor-pointer" onClick={() => router.push('/driver/terms')}>Terminos y Condiciones</span> y la Politica de Privacidad. Confirmo que <span className="text-amber-400 font-medium">no puedo prestar mi cuenta ni vehiculo</span> a terceros y soy el unico responsable del uso de la plataforma.</span>
                  </label>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="flex-1 border border-white/10 text-gray-300 py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-white/5">
                  <ArrowLeft className="w-4 h-4" /> Atras
                </button>
                <button onClick={handleRegister} disabled={isLoading} className="flex-1 btn-neon text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
                  {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>Registrarse</>}
                </button>
              </div>
            </>
          )}
        </div>

        <p className="text-center mt-4">
          <span className="text-xs text-gray-500">Ya tienes cuenta? </span>
          <button onClick={() => router.push('/driver/login')} className="text-xs text-cyan-400 hover:underline">Inicia sesion</button>
        </p>
      </motion.div>
    </div>
  );
}
