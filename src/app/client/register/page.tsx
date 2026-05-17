'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, Zap, User, Phone, ArrowRight, ArrowLeft, Gift, Chrome } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useReferralStore } from '@/store/referralStore';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

type RegView = 'form' | 'phone-verify';
type OtpStatus = 'idle' | 'sending' | 'sent' | 'verifying';

export default function ClientRegister() {
  const router = useRouter();
  const { register, isLoading } = useAuthStore();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [referralCode, setReferralCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState(1);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Phone registration states
  const [regView, setRegView] = useState<RegView>('form');
  const [regPhone, setRegPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpStatus, setOtpStatus] = useState<OtpStatus>('idle');
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const updateForm = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const handleRegister = async () => {
    if (!form.name || !form.email || !form.phone || !form.password) {
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

    const result = await register(form.name, form.email, form.phone, form.password, 'client');
    if (result.success) {
      toast.success('Cuenta creada exitosamente!');
      // Apply referral code if provided
      if (referralCode.trim()) {
        const { applyReferralCode } = useReferralStore.getState();
        const userId = useAuthStore.getState().user?.id;
        if (userId) {
          const applyResult = await applyReferralCode(userId, referralCode.trim());
          if (applyResult.success) {
            toast.success(applyResult.message);
          } else {
            toast.error(applyResult.message);
          }
        }
      }
      router.push('/client');
    } else {
      toast.error(result.error || 'Error al crear cuenta');
    }
  };

  const handleGoogleRegister = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + '/client' },
      });
      if (error) throw error;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al conectar con Google';
      toast.error(message);
      setGoogleLoading(false);
    }
  };

  const handlePhoneRegisterSendOtp = async () => {
    const cleanPhone = regPhone.replace(/\D/g, '');
    if (cleanPhone.length < 8) {
      toast.error('Ingresa un numero de telefono valido');
      return;
    }

    setOtpStatus('sending');
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: `+506${cleanPhone}`,
      });
      if (error) throw error;
      setOtpStatus('sent');
      setRegView('phone-verify');
      setResendCooldown(60);
      toast.success('Codigo enviado a tu telefono');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al enviar codigo';
      toast.error(message);
      setOtpStatus('idle');
    }
  };

  const handlePhoneRegisterVerify = async () => {
    const token = otp.join('');
    if (token.length !== 6) {
      toast.error('Ingresa el codigo completo');
      return;
    }

    const cleanPhone = regPhone.replace(/\D/g, '');
    setOtpStatus('verifying');
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: `+506${cleanPhone}`,
        token,
        type: 'sms',
      });
      if (error) throw error;
      toast.success('Bienvenido a RIDA!');
      router.replace('/client');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Codigo invalido';
      toast.error(message);
      setOtpStatus('sent');
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setOtp(['', '', '', '', '', '']);
    setOtpStatus('idle');
    await handlePhoneRegisterSendOtp();
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
      setTimeout(() => handlePhoneRegisterVerify(), 200);
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
      
      <motion.div className="w-full max-w-sm relative z-10" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center mx-auto mb-4 glow-cyan">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Crear Cuenta</h1>
          <p className="text-sm text-gray-400 mt-1">Unete a RIDA hoy</p>
        </div>

        <AnimatePresence mode="wait">
          {regView === 'form' ? (
            <motion.div
              key="form-view"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              {/* Progress */}
              <div className="flex items-center gap-2 mb-6">
                {[1, 2].map(s => (
                  <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${step >= s ? 'bg-cyan-500' : 'bg-white/10'}`} />
                ))}
              </div>

              <div className="glass-strong rounded-2xl p-6 space-y-4">
                {step === 1 ? (
                  <>
                    <h2 className="text-lg font-semibold text-white">Datos Personales</h2>
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
                    <button type="button" onClick={() => { if (form.name && form.email) setStep(2); else toast.error('Completa los campos'); }} className="w-full btn-neon text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2">
                      Siguiente <ArrowRight className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <h2 className="text-lg font-semibold text-white">Seguridad</h2>
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
                      {/* Referral Code - Optional */}
                      <div className="relative">
                        <Gift className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                          type="text"
                          placeholder="Codigo de invitacion (opcional)"
                          value={referralCode}
                          onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                          className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500 font-mono tracking-wide"
                        />
                      </div>
                      <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-3">
                        <label className="flex items-start gap-2 cursor-pointer">
                          <input type="checkbox" className="mt-0.5 accent-cyan-500" />
                          <span className="text-xs text-gray-400">Acepto los Terminos y Condiciones, la Politica de Privacidad y confirmo que soy responsable por las personas que viajen conmigo.</span>
                        </label>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button type="button" onClick={() => setStep(1)} className="flex-1 border border-white/10 text-gray-300 py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-white/5">
                        <ArrowLeft className="w-4 h-4" /> Atras
                      </button>
                      <button type="button" onClick={handleRegister} disabled={isLoading} className="flex-1 btn-neon text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
                        {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>Registrarse</>}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          ) : (
            /* PHONE OTP VERIFICATION VIEW */
            <motion.div
              key="phone-verify-view"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <div className="glass-strong rounded-2xl p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => { setRegView('form'); setOtp(['', '', '', '', '', '']); setOtpStatus('idle'); }}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <h2 className="text-lg font-semibold text-white">Verificacion SMS</h2>
                </div>

                <div className="text-center space-y-1">
                  <p className="text-sm text-gray-400">
                    Ingresa el codigo de 6 digitos enviado a
                  </p>
                  <p className="text-sm font-semibold text-cyan-400">
                    +506 {regPhone}
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
                      className="w-11 h-13 bg-white/5 border border-white/10 rounded-xl text-center text-lg font-semibold text-white focus:outline-none focus:border-cyan-500 focus:bg-white/10 transition-colors"
                      autoFocus={index === 0}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handlePhoneRegisterVerify}
                  disabled={otpStatus === 'verifying' || otp.join('').length !== 6}
                  className="w-full btn-neon text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {otpStatus === 'verifying' ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      Crear cuenta
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {/* Resend */}
                <div className="text-center">
                  {resendCooldown > 0 ? (
                    <p className="text-xs text-gray-500">
                      Reenviar en <span className="text-cyan-400 font-medium">{resendCooldown}s</span>
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      className="text-xs text-cyan-400 hover:underline flex items-center justify-center gap-1"
                    >
                      Reenviar codigo
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-center mt-4">
          <span className="text-xs text-gray-500">Ya tienes cuenta? </span>
          <button type="button" onClick={() => router.push('/client/login')} className="text-xs text-cyan-400 hover:underline">Inicia sesion</button>
        </p>
      </motion.div>
    </div>
  );
}
