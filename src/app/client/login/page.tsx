'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, Zap, UserPlus, ArrowRight, Chrome, Phone, ArrowLeft, Loader2, RotateCcw } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

type AuthView = 'email' | 'phone' | 'otp';

export default function ClientLogin() {
  const router = useRouter();
  const { login, isLoading, loginAttempts, isLocked } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authView, setAuthView] = useState<AuthView>('email');

  // Phone OTP states
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleLogin = async () => {
    if (!email || !password) {
      toast.error('Completa todos los campos');
      return;
    }

    if (isLocked) {
      toast.error('Cuenta bloqueada temporalmente. Intenta mas tarde.');
      return;
    }

    const result = await login(email, password);
    if (result.success) {
      toast.success('Bienvenido a RIDA!');
      router.replace('/client');
    } else {
      toast.error(result.error || 'Error al iniciar sesion');
    }
  };

  return (
    <div className="min-h-screen bg-rida-dark flex flex-col items-center justify-center p-6">
      <div className="absolute inset-0 bg-gradient-radial pointer-events-none" />
      
      <motion.div 
        className="w-full max-w-sm relative z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div 
            className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center mx-auto mb-4 glow-cyan"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Zap className="w-8 h-8 text-white" />
          </motion.div>
          <h1 className="text-2xl font-bold text-white">RIDA</h1>
          <p className="text-sm text-cyan-400/70">Transporte inteligente</p>
        </div>

        {/* Login Form */}
        <div className="glass-strong rounded-2xl p-6 space-y-4">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Iniciar Sesion</h2>
            
            <div className="space-y-3">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="email"
                  placeholder="Correo electronico"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
              
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Contrasena"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500 transition-colors"
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded border-white/20 bg-white/5 accent-cyan-500" />
                <span className="text-xs text-gray-400">Recordarme</span>
              </label>
              <button type="button" onClick={() => router.push('/client/recovery')} className="text-xs text-cyan-400 hover:underline">
                Olvide mi contrasena
              </button>
            </div>

            <button
              type="button"
              onClick={handleLogin}
              disabled={isLoading}
              className="w-full btn-neon text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Iniciar Sesion
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => router.push('/client/register')}
              className="w-full border border-cyan-500/30 text-cyan-400 font-medium py-3 rounded-xl hover:bg-cyan-500/10 transition-colors flex items-center justify-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Crear cuenta nueva
            </button>
          </div>
        </div>

        <div className="text-center mt-4">
          <button type="button" onClick={() => router.push('/')} className="text-xs text-gray-600 hover:text-gray-400">
            Volver al inicio
          </button>
        </div>
      </motion.div>
    </div>
  );
}
