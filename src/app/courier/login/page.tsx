'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, Zap, UserPlus, ArrowRight, Package, Chrome, Phone, ArrowLeft, RotateCcw } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

type AuthView = 'email' | 'phone' | 'otp';

export default function CourierLogin() {
  const router = useRouter();
  const { login, isLoading, loginAttempts, isLocked } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authView, setAuthView] = useState<AuthView>('email');

  // Phone OTP states
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
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

    const result = await login(email, password);
    if (result.success) {
      toast.success('Bienvenido repartidor!');
      router.replace('/courier');
    } else {
      toast.error(result.error || 'Error al iniciar sesion');
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/courier`,
          data: { role: 'courier' },
        },
      });
      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('not configured') || msg.includes('not enabled') || msg.includes('provider')) {
          toast.error('Google no esta configurado. Usa correo y contrasena.', { duration: 5000 });
        } else {
          toast.error('Error al conectar con Google: ' + error.message);
        }
        setGoogleLoading(false);
      }
    } catch {
      toast.error('No se pudo conectar con Google en este momento.');
      setGoogleLoading(false);
    }
  };

  const handleSendOtp = async () => {
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 8) {
      toast.error('Ingresa un numero de telefono valido');
      return;
    }

    setOtpLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: `+506${cleanPhone}`,
        options: {
          data: { role: 'courier' },
        },
      });
      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('not configured') || msg.includes('sms') || msg.includes('provider')) {
          toast.error('SMS no disponible. Usa correo y contrasena.', { duration: 5000 });
        } else {
          toast.error(error.message);
        }
        setOtpLoading(false);
        return;
      }
      setAuthView('otp');
      setResendCooldown(60);
      toast.success('Codigo enviado a +506 ' + cleanPhone);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al enviar codigo';
      toast.error(message);
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const token = otp.join('');
    if (token.length !== 6) {
      toast.error('Ingresa el codigo completo');
      return;
    }

    const cleanPhone = phone.replace(/\D/g, '');
    setVerifyLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone: `+506${cleanPhone}`,
        token,
        type: 'sms',
      });
      if (error) {
        if (error.message.includes('expired')) {
          toast.error('Codigo expirado. Reenvia uno nuevo.');
        } else if (error.message.includes('invalid')) {
          toast.error('Codigo incorrecto. Verifica e intenta de nuevo.');
        } else {
          toast.error(error.message);
        }
        setVerifyLoading(false);
        return;
      }

      // Auto-create profile if this is a new user
      if (data.user) {
        try {
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', data.user.id)
            .single();

          if (!existingProfile) {
            const meta = data.user.user_metadata || {};
            await supabase.from('profiles').upsert({
              id: data.user.id,
              name: meta.name || meta.phone || `Repartidor ${cleanPhone.slice(-4)}`,
              email: data.user.email || '',
              phone: cleanPhone,
              role: meta.role || 'courier',
              is_verified: true,
              phone_verified: true,
            }, { onConflict: 'id' });
          } else {
            await supabase.from('profiles').update({
              phone_verified: true,
            }).eq('id', data.user.id);
          }
        } catch (profileErr) {
          console.warn('Profile auto-create failed:', profileErr);
        }

        useAuthStore.getState().initAuth();
      }

      // Log successful phone login
      try {
        await supabase.from('login_logs').insert({
          user_id: data.user?.id,
          phone: `+506${cleanPhone}`,
          method: 'phone_otp',
          status: 'success',
        });
      } catch (logErr) {
        console.warn('Login log failed:', logErr);
      }

      toast.success('Bienvenido repartidor!');
      router.replace('/courier');
    } catch {
      toast.error('Error al verificar. Intenta de nuevo.');
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setOtp(['', '', '', '', '', '']);
    await handleSendOtp();
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
    if (index === 5 && value) {
      setTimeout(() => handleVerifyOtp(), 200);
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newOtp = [...otp];
    pasted.split('').forEach((char, i) => { newOtp[i] = char; });
    setOtp(newOtp);
    const nextEmpty = pasted.length < 6 ? pasted.length : 5;
    otpRefs.current[nextEmpty]?.focus();
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
            className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-orange-500 flex items-center justify-center mx-auto mb-4"
            style={{ boxShadow: '0 0 20px rgba(168, 85, 247, 0.3), 0 0 60px rgba(249, 115, 22, 0.1)' }}
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Package className="w-8 h-8 text-white" />
          </motion.div>
          <h1 className="text-2xl font-bold text-white">RIDA REPARTIDOR</h1>
          <p className="text-sm text-orange-400/70">Gana entregando con RIDA</p>
        </div>

        {/* Login Form */}
        <div className="glass-strong rounded-2xl p-6 space-y-4">
          <AnimatePresence mode="wait">
            {/* EMAIL/PASSWORD VIEW */}
            {authView === 'email' && (
              <motion.div
                key="email-view"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-4"
              >
                <h2 className="text-lg font-semibold text-white">Iniciar Sesion</h2>

                <div className="space-y-3">
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type="email"
                      placeholder="Correo electronico"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-orange-500 transition-colors"
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
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-orange-500 transition-colors"
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

                <div className="flex items-center justify-end">
                  <button type="button" onClick={() => router.push('/courier/recovery')} className="text-xs text-orange-400 hover:underline">
                    Olvide mi contrasena
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleLogin}
                  disabled={isLoading || isLocked}
                  className="w-full font-medium py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 text-white"
                  style={{
                    background: 'linear-gradient(135deg, #9333ea, #f97316)',
                    boxShadow: '0 0 20px rgba(249, 115, 22, 0.3)',
                  }}
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

                {/* Divider */}
                <div className="relative my-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/10" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-[#0f1729] px-3 text-xs text-gray-500">o continua con</span>
                  </div>
                </div>

                {/* Google Button */}
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={googleLoading}
                  className="w-full bg-white/10 border border-white/20 backdrop-blur-md text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-white/15 transition-colors disabled:opacity-50"
                >
                  {googleLoading ? (
                    <div className="w-5 h-5 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
                  ) : (
                    <>
                      <Chrome className="w-5 h-5 text-white" />
                      Continuar con Google
                    </>
                  )}
                </button>

                {/* Phone Button */}
                <button
                  type="button"
                  onClick={() => setAuthView('phone')}
                  className="w-full bg-white/5 border border-white/10 text-orange-400 font-medium py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-white/10 transition-colors"
                >
                  <Phone className="w-4 h-4" />
                  Iniciar sesion con telefono
                </button>

                {/* Divider */}
                <div className="relative my-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/10" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-[#0f1729] px-3 text-xs text-gray-500">o</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => router.push('/courier/register')}
                  className="w-full border border-orange-500/30 text-orange-400 font-medium py-3 rounded-xl hover:bg-orange-500/10 transition-colors flex items-center justify-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  Crear cuenta de repartidor
                </button>
              </motion.div>
            )}

            {/* PHONE INPUT VIEW */}
            {authView === 'phone' && (
              <motion.div
                key="phone-view"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setAuthView('email')}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <h2 className="text-lg font-semibold text-white">Telefono</h2>
                </div>

                <p className="text-sm text-gray-400">
                  Te enviaremos un codigo de verificacion por SMS a tu numero de Costa Rica.
                </p>

                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">🇨🇷</span>
                  <div className="absolute left-11 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">
                    +506
                  </div>
                  <input
                    type="tel"
                    placeholder="8888 8888"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-20 pr-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-orange-500 transition-colors tracking-wider"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={otpLoading}
                  className="w-full font-medium py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 text-white"
                  style={{
                    background: 'linear-gradient(135deg, #9333ea, #f97316)',
                    boxShadow: '0 0 20px rgba(249, 115, 22, 0.3)',
                  }}
                >
                  {otpLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      Enviar codigo
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </motion.div>
            )}

            {/* OTP VERIFICATION VIEW */}
            {authView === 'otp' && (
              <motion.div
                key="otp-view"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => { setAuthView('phone'); setOtp(['', '', '', '', '', '']); }}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <h2 className="text-lg font-semibold text-white">Verificacion</h2>
                </div>

                <div className="text-center space-y-1">
                  <p className="text-sm text-gray-400">
                    Ingresa el codigo de 6 digitos enviado a
                  </p>
                  <p className="text-sm font-semibold text-orange-400">
                    +506 {phone}
                  </p>
                </div>

                {/* 6-digit OTP boxes */}
                <div className="flex justify-center gap-2" onPaste={handleOtpPaste}>
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => { otpRefs.current[index] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      className="w-11 h-13 bg-white/5 border border-white/10 rounded-xl text-center text-lg font-semibold text-white focus:outline-none focus:border-orange-500 focus:bg-white/10 transition-colors"
                      autoFocus={index === 0}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleVerifyOtp}
                  disabled={verifyLoading || otp.join('').length !== 6}
                  className="w-full font-medium py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 text-white"
                  style={{
                    background: 'linear-gradient(135deg, #9333ea, #f97316)',
                    boxShadow: '0 0 20px rgba(249, 115, 22, 0.3)',
                  }}
                >
                  {verifyLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      Verificar codigo
                    </>
                  )}
                </button>

                {/* Resend */}
                <div className="text-center">
                  {resendCooldown > 0 ? (
                    <p className="text-xs text-gray-500">
                      Reenviar en <span className="text-orange-400 font-medium">{resendCooldown}s</span>
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      className="text-xs text-orange-400 hover:underline flex items-center justify-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Reenviar codigo
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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
