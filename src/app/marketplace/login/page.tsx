'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Store, Mail, Lock, Eye, EyeOff, ArrowRight, Zap, Chrome, Phone, ArrowLeft, RotateCcw } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

type AuthView = 'email' | 'phone' | 'otp';

export default function MarketplaceLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [registerData, setRegisterData] = useState({ name: '', email: '', phone: '', password: '' });
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

  const { login, register, isLoading } = useAuthStore();

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Completa todos los campos');
      return;
    }
    const result = await login(email, password, 'vendor');
    if (result.success) {
      toast.success('Bienvenido a RIDA MARKET!');
      router.push('/marketplace');
    } else {
      toast.error(result.error || 'Error al iniciar sesion');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerData.name || !registerData.email || !registerData.phone || !registerData.password) {
      toast.error('Completa todos los campos');
      return;
    }
    const result = await register(registerData.name, registerData.email, registerData.phone, registerData.password, 'vendor');
    if (result.success) {
      toast.success('Cuenta creada exitosamente!');
      router.push('/marketplace');
    } else {
      toast.error(result.error || 'Error al crear cuenta');
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/marketplace`,
          data: { role: 'vendor' },
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
      toast.error('Ingresa un numero de telefono valido (8 digitos)');
      return;
    }

    setOtpLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: `+506${cleanPhone}`,
        options: {
          data: { role: 'vendor' },
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
      setOtpSent(true);
      setAuthView('otp');
      setResendCooldown(60);
      toast.success('Codigo enviado a +506 ' + cleanPhone);
    } catch {
      toast.error('Error al enviar codigo. Intenta de nuevo.');
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
              name: meta.name || meta.phone || `Vendedor ${cleanPhone.slice(-4)}`,
              email: data.user.email || '',
              phone: cleanPhone,
              role: meta.role || 'vendor',
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

      toast.success('Bienvenido a RIDA MARKET!');
      router.push('/marketplace');
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
    <div className="mp-marketplace min-h-screen bg-gray-50 flex items-center justify-center p-4">
      {/* Ambient background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-green-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
      </div>

      <motion.div
        className="relative w-full max-w-md z-10"
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <div className="glass-strong rounded-3xl p-8 shadow-2xl">
          {/* Logo */}
          <motion.div
            className="flex flex-col items-center mb-6"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center mb-3 shadow-lg">
              <Store className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">RIDA MARKET</h1>
            <p className="text-gray-500 text-sm mt-1">Marketplace de RIDA Supreme</p>
          </motion.div>

          <AnimatePresence mode="wait">
            {/* REGISTER VIEW */}
            {isRegister ? (
              <motion.form
                key="register-view"
                onSubmit={handleRegister}
                className="space-y-4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <h2 className="text-lg font-semibold text-gray-900">Crear cuenta de vendedor</h2>

                <div className="space-y-2">
                  <label className="text-sm text-gray-500 font-medium">Nombre de la tienda</label>
                  <input
                    type="text"
                    value={registerData.name}
                    onChange={(e) => setRegisterData({ ...registerData, name: e.target.value })}
                    placeholder="Mi Tienda"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-green-500 transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-gray-500 font-medium">Correo electronico</label>
                  <input
                    type="email"
                    value={registerData.email}
                    onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                    placeholder="tienda@ejemplo.com"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-green-500 transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-gray-500 font-medium">Telefono</label>
                  <input
                    type="tel"
                    value={registerData.phone}
                    onChange={(e) => setRegisterData({ ...registerData, phone: e.target.value })}
                    placeholder="+506 8888 0000"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-green-500 transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-gray-500 font-medium">Contrasena</label>
                  <input
                    type="password"
                    value={registerData.password}
                    onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                    placeholder="Minimo 6 caracteres"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-green-500 transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full btn-neon text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      Crear Cuenta
                      <Zap className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="text-center mt-4">
                  <p className="text-gray-400 text-sm">
                    Ya tienes cuenta?{' '}
                    <button
                      type="button"
                      onClick={() => { setIsRegister(false); setAuthView('email'); }}
                      className="text-green-600 hover:text-green-700 font-medium transition-colors"
                    >
                      Iniciar sesion
                    </button>
                  </p>
                </div>
              </motion.form>
            ) : authView === 'email' ? (
              /* EMAIL/PASSWORD VIEW */
              <motion.form
                key="email-view"
                onSubmit={handleLogin}
                className="space-y-4"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <h2 className="text-lg font-semibold text-gray-900">Iniciar Sesion</h2>

                <div className="space-y-3">
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="correo@ejemplo.com"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-green-500 transition-colors"
                    />
                  </div>

                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Contrasena"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-12 py-3 text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-green-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => router.push('/marketplace/recovery')}
                    className="text-xs text-green-600 hover:underline"
                  >
                    Olvide mi contrasena
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full btn-neon text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
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
                  onClick={() => setIsRegister(true)}
                  className="w-full border border-green-200 text-green-600 font-medium py-3 rounded-xl hover:bg-green-50 transition-colors flex items-center justify-center gap-2"
                >
                  <Store className="w-4 h-4" />
                  Crear cuenta de vendedor
                </button>
              </motion.form>
            ) : authView === 'phone' ? (
              /* PHONE INPUT VIEW */
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
                    className="text-gray-500 hover:text-gray-900 transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <h2 className="text-lg font-semibold text-gray-900">Telefono</h2>
                </div>

                <p className="text-sm text-gray-500">
                  Te enviaremos un codigo de verificacion por SMS a tu numero de Costa Rica.
                </p>

                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">🇨🇷</span>
                  <div className="absolute left-11 top-1/2 -translate-y-1/2 text-sm text-gray-500 font-medium">
                    +506
                  </div>
                  <input
                    type="tel"
                    placeholder="8888 8888"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-20 pr-4 py-3 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-green-500 transition-colors tracking-wider"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={otpLoading}
                  className="w-full btn-neon text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
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
            ) : (
              /* OTP VERIFICATION VIEW */
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
                    onClick={() => { setAuthView('phone'); setOtpSent(false); setOtp(['', '', '', '', '', '']); }}
                    className="text-gray-500 hover:text-gray-900 transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <h2 className="text-lg font-semibold text-gray-900">Verificacion</h2>
                </div>

                <div className="text-center space-y-1">
                  <p className="text-sm text-gray-500">
                    Ingresa el codigo de 6 digitos enviado a
                  </p>
                  <p className="text-sm font-semibold text-green-600">
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
                      className="w-11 h-13 bg-gray-50 border border-gray-200 rounded-xl text-center text-lg font-semibold text-gray-900 focus:outline-none focus:border-green-500 focus:bg-gray-100 transition-colors"
                      autoFocus={index === 0}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleVerifyOtp}
                  disabled={verifyLoading || otp.join('').length !== 6}
                  className="w-full btn-neon text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
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
                    <p className="text-xs text-gray-400">
                      Reenviar en <span className="text-green-600 font-medium">{resendCooldown}s</span>
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      className="text-xs text-green-600 hover:underline flex items-center justify-center gap-1"
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
      </motion.div>
    </div>
  );
}
