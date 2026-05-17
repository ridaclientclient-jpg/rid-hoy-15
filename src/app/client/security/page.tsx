'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeOff, Shield, CheckCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export default function ClientSecurity() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Completa todos los campos');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('La nueva contrasena debe tener al menos 6 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Las contrasenas no coinciden');
      return;
    }
    if (currentPassword === newPassword) {
      toast.error('La nueva contrasena debe ser diferente a la actual');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        if (error.message.includes('Invalid login credentials') || error.message.includes('Credentials')) {
          toast.error('La contrasena actual es incorrecta');
        } else {
          toast.error('Error al cambiar contrasena: ' + error.message);
        }
      } else {
        setSuccess(true);
        toast.success('Contrasena cambiada exitosamente');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch {
      toast.error('Error de conexion. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  const passwordStrength = (pass: string) => {
    let score = 0;
    if (pass.length >= 6) score++;
    if (pass.length >= 10) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    if (score <= 1) return { label: 'Debil', color: 'bg-red-500', textColor: 'text-red-400' };
    if (score <= 2) return { label: 'Regular', color: 'bg-amber-500', textColor: 'text-amber-400' };
    if (score <= 3) return { label: 'Buena', color: 'bg-cyan-500', textColor: 'text-cyan-400' };
    if (score <= 4) return { label: 'Fuerte', color: 'bg-emerald-500', textColor: 'text-emerald-400' };
    return { label: 'Excelente', color: 'bg-emerald-400', textColor: 'text-emerald-300' };
  };

  const strength = passwordStrength(newPassword);

  return (
    <div className="p-4 space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-xl font-bold text-white">Seguridad</h1>
        <p className="text-sm text-gray-400 mt-1">Protege tu cuenta</p>
      </motion.div>

      {success && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-strong rounded-2xl p-6 text-center space-y-3"
        >
          <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto" />
          <h2 className="text-lg font-bold text-white">Contrasena Actualizada</h2>
          <p className="text-sm text-gray-400">Tu contrasena ha sido cambiada exitosamente.</p>
        </motion.div>
      )}

      {!success && (
        <>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="glass rounded-2xl p-4 border border-cyan-500/20"
          >
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-semibold text-white">Consejos de seguridad</span>
            </div>
            <ul className="space-y-1.5">
              <li className="text-xs text-gray-400 flex items-start gap-2">
                <span className="text-cyan-400 mt-0.5">&#8226;</span>
                Usa una contrasena que no uses en otras plataformas
              </li>
              <li className="text-xs text-gray-400 flex items-start gap-2">
                <span className="text-cyan-400 mt-0.5">&#8226;</span>
                Combina letras, numeros y simbolos
              </li>
              <li className="text-xs text-gray-400 flex items-start gap-2">
                <span className="text-cyan-400 mt-0.5">&#8226;</span>
                No compartas tu contrasena con nadie
              </li>
              <li className="text-xs text-gray-400 flex items-start gap-2">
                <span className="text-cyan-400 mt-0.5">&#8226;</span>
                Cambia tu contrasena periodicamente
              </li>
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-strong rounded-2xl p-6 space-y-4"
          >
            <h3 className="text-base font-semibold text-white">Cambiar Contrasena</h3>

            <div className="space-y-2">
              <label className="text-xs text-gray-400 font-medium">Contrasena actual</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type={showCurrent ? 'text' : 'password'}
                  placeholder="Tu contrasena actual"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                >
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-gray-400 font-medium">Nueva contrasena</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type={showNew ? 'text' : 'password'}
                  placeholder="Minimo 6 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {newPassword.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${strength.color}`} style={{ width: `${(strength.label === 'Debil' ? 20 : strength.label === 'Regular' ? 40 : strength.label === 'Buena' ? 60 : strength.label === 'Fuerte' ? 80 : 100)}%` }} />
                    </div>
                    <span className={`text-[10px] font-medium ${strength.textColor}`}>{strength.label}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs text-gray-400 font-medium">Confirmar nueva contrasena</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Repite tu nueva contrasena"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                <p className="text-xs text-red-400">Las contrasenas no coinciden</p>
              )}
            </div>

            <button
              onClick={handleChangePassword}
              disabled={isLoading || !currentPassword || !newPassword || !confirmPassword}
              className="w-full btn-neon text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 mt-4"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  Actualizar Contrasena
                </>
              )}
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="glass rounded-2xl p-4 flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-white">Verificacion en dos pasos</p>
              <p className="text-xs text-gray-500">Proximamente disponible</p>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-medium">Proximo</span>
          </motion.div>
        </>
      )}
    </div>
  );
}
