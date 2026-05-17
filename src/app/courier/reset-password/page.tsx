'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeOff, CheckCircle, Package, ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

function CourierResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const hash = window.location.hash;
        let hashSession = false;

        if (hash && hash.includes('access_token')) {
          await new Promise(resolve => setTimeout(resolve, 500));
          const retrySession = await supabase.auth.getSession();
          if (retrySession.data.session) hashSession = true;
        }

        if (session || hashSession) {
          setIsValid(true);
        } else {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) setIsValid(true);
        }
      } catch {
        setIsValid(false);
      } finally {
        setIsValidating(false);
      }
    };
    checkSession();
  }, [searchParams]);

  const handleReset = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error('La contrasena debe tener al menos 6 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Las contrasenas no coinciden');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        if (error.message.includes('session') || error.message.includes('expired')) {
          toast.error('El enlace expiro. Solicita uno nuevo.');
          setTimeout(() => router.push('/courier/recovery'), 2000);
          return;
        }
        toast.error(error.message || 'Error al actualizar contrasena');
        return;
      }
      setIsSuccess(true);
      toast.success('Contrasena actualizada correctamente');
    } catch {
      toast.error('Error de conexion. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isValidating) {
    return (
      <div className="min-h-screen bg-rida-dark flex flex-col items-center justify-center p-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-4">
          <Loader2 className="w-8 h-8 text-orange-400 animate-spin mx-auto" />
          <p className="text-sm text-gray-400">Verificando enlace...</p>
        </motion.div>
      </div>
    );
  }

  if (!isValid) {
    return (
      <div className="min-h-screen bg-rida-dark flex flex-col items-center justify-center p-6">
        <motion.div className="w-full max-w-sm" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-orange-500 flex items-center justify-center mx-auto mb-4"
              style={{ boxShadow: '0 0 20px rgba(168, 85, 247, 0.3), 0 0 60px rgba(249, 115, 22, 0.1)' }}
            >
              <Package className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Enlace Invalido</h1>
          </div>
          <div className="glass-strong rounded-2xl p-6 text-center space-y-4">
            <p className="text-sm text-gray-400">Este enlace de recuperacion no es valido o ha expirado.</p>
            <button onClick={() => router.push('/courier/recovery')} className="w-full font-medium py-3 rounded-xl text-white" style={{
              background: 'linear-gradient(135deg, #9333ea, #f97316)',
              boxShadow: '0 0 20px rgba(249, 115, 22, 0.3)',
            }}>
              Solicitar nuevo enlace
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-rida-dark flex flex-col items-center justify-center p-6">
        <motion.div className="w-full max-w-sm" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">Contrasena Actualizada</h1>
          </div>
          <div className="glass-strong rounded-2xl p-6 text-center space-y-4">
            <p className="text-sm text-gray-400">Tu contrasena se ha cambiado exitosamente.</p>
            <button onClick={() => router.push('/courier/login')} className="w-full font-medium py-3 rounded-xl text-white" style={{
              background: 'linear-gradient(135deg, #9333ea, #f97316)',
              boxShadow: '0 0 20px rgba(249, 115, 22, 0.3)',
            }}>
              Iniciar Sesion
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-rida-dark flex flex-col items-center justify-center p-6">
      <motion.div className="w-full max-w-sm" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-orange-500 flex items-center justify-center mx-auto mb-4"
            style={{ boxShadow: '0 0 20px rgba(168, 85, 247, 0.3), 0 0 60px rgba(249, 115, 22, 0.1)' }}
          >
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Nueva Contrasena</h1>
          <p className="text-sm text-orange-400/70 mt-1">Cuenta de repartidor</p>
        </div>

        <div className="glass-strong rounded-2xl p-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Nueva contrasena</label>
            <div className="relative mt-1.5">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimo 6 caracteres"
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-12 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-orange-500 transition-colors"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Confirmar contrasena</label>
            <div className="relative mt-1.5">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite la contrasena"
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-orange-500 transition-colors"
              />
            </div>
          </div>

          {newPassword.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex gap-1">
                {[1, 2, 3].map((i) => (
                  <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${newPassword.length >= i * 3 ? (newPassword.length >= 9 ? 'bg-emerald-400' : newPassword.length >= 6 ? 'bg-amber-400' : 'bg-red-400') : 'bg-white/10'}`} />
                ))}
              </div>
              <p className="text-[11px] text-gray-500">{newPassword.length < 6 ? 'Muy debil' : newPassword.length < 9 ? 'Moderada' : 'Fuerte'}</p>
            </div>
          )}

          <button onClick={handleReset} disabled={isLoading || !newPassword || !confirmPassword} className="w-full font-medium py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 text-white" style={{
            background: 'linear-gradient(135deg, #9333ea, #f97316)',
            boxShadow: '0 0 20px rgba(249, 115, 22, 0.3)',
          }}>
            {isLoading ? (<><Loader2 className="w-4 h-4 animate-spin" /> Actualizando...</>) : 'Cambiar Contrasena'}
          </button>

          <button onClick={() => router.push('/courier/login')} className="w-full flex items-center justify-center gap-2 text-gray-400 hover:text-white py-2">
            <ArrowLeft className="w-4 h-4" /> Volver al login
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function ResetFallback() {
  return (
    <div className="min-h-screen bg-rida-dark flex flex-col items-center justify-center p-6">
      <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
    </div>
  );
}

export default function CourierResetPassword() {
  return (
    <Suspense fallback={<ResetFallback />}>
      <CourierResetPasswordForm />
    </Suspense>
  );
}
