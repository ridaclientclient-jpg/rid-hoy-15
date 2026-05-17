'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Mail, ArrowLeft, CheckCircle, Store } from 'lucide-react';
import { toast } from 'sonner';

export default function MarketplaceRecovery() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleRecovery = async () => {
    if (!email) {
      toast.error('Ingresa tu correo');
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, redirectTo: '/marketplace/reset-password' }),
      });
      const data = await res.json();
      if (res.ok) {
        setSent(true);
        toast.success('Email enviado!');
      } else {
        toast.error(data.error || 'Error al enviar email');
      }
    } catch {
      toast.error('Error de conexion');
    }
    setIsLoading(false);
  };

  return (
    <div className="mp-marketplace min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <motion.div className="w-full max-w-sm" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center mx-auto mb-4">
            <Store className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Recuperar Contrasena</h1>
          <p className="text-sm text-gray-500 mt-1">Recupera acceso a tu cuenta</p>
        </div>

        <div className="glass-strong rounded-2xl p-6">
          {sent ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-4">
              <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto" />
              <h2 className="text-lg font-semibold text-gray-900">Email Enviado</h2>
              <p className="text-sm text-gray-500">Revisa tu bandeja de entrada en <span className="text-green-600">{email}</span></p>
              <button onClick={() => router.push('/marketplace/login')} className="w-full btn-neon text-white font-medium py-3 rounded-xl">
                Volver a inicio de sesion
              </button>
            </motion.div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">Ingresa tu correo electronico y te enviaremos un enlace para restablecer tu contrasena.</p>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="email" placeholder="Correo electronico" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-green-500 transition-colors" />
              </div>
              <button onClick={handleRecovery} disabled={isLoading} className="w-full btn-neon text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
                {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Enviar enlace'}
              </button>
              <button onClick={() => router.push('/marketplace/login')} className="w-full flex items-center justify-center gap-2 text-gray-500 hover:text-gray-900 py-2">
                <ArrowLeft className="w-4 h-4" /> Volver
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
