'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Mail, ArrowLeft, CheckCircle, Shield } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

export default function AdminRecoveryPage() {
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
        body: JSON.stringify({ email, redirectTo: '/admin/reset-password' }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Error al enviar email');
        return;
      }
      setSent(true);
      toast.success('Email enviado!');
    } catch {
      toast.error('Error de conexion');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-rida-dark bg-gradient-radial flex items-center justify-center relative overflow-hidden p-6">
      {/* Background effects */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      {/* Back link */}
      <motion.a
        href="/admin/login"
        className="absolute top-6 left-6 flex items-center gap-2 text-gray-400 hover:text-cyan-400 transition-colors"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm">Volver al login</span>
      </motion.a>

      <motion.div
        className="w-full max-w-sm relative z-10"
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center mx-auto mb-4 glow-cyan animate-pulse-glow">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Recuperar Contrasena</h1>
          <p className="text-gray-400 text-sm mt-1">Administrador RIDA</p>
        </div>

        <div className="glass-strong rounded-2xl p-6">
          {sent ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-4">
              <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto" />
              <h2 className="text-lg font-semibold text-white">Email Enviado</h2>
              <p className="text-sm text-gray-400">
                Revisa tu bandeja de entrada en <span className="text-cyan-400">{email}</span>
              </p>
              <p className="text-xs text-gray-500">
                Si no encuentras el email, revisa la carpeta de spam.
              </p>
              <Link href="/admin/login" className="block w-full btn-neon text-white font-medium py-3 rounded-xl text-center">
                Volver a inicio de sesion
              </Link>
            </motion.div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-400">
                Ingresa tu correo electronico de administrador y te enviaremos un enlace para restablecer tu contrasena.
              </p>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="email"
                  placeholder="Correo electronico del admin"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500"
                />
              </div>
              <button
                onClick={handleRecovery}
                disabled={isLoading}
                className="w-full btn-neon text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'Enviar enlace'
                )}
              </button>
              <button onClick={() => router.push('/admin/login')} className="w-full flex items-center justify-center gap-2 text-gray-400 hover:text-white py-2">
                <ArrowLeft className="w-4 h-4" /> Volver al login
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
