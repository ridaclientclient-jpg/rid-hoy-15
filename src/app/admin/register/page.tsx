'use client';

import { motion } from 'framer-motion';
import { Shield, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function AdminRegisterPage() {
  return (
    <div className="min-h-screen bg-rida-dark bg-gradient-radial flex items-center justify-center relative overflow-hidden p-6">
      {/* Background effects */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
      </div>

      <motion.div
        className="w-full max-w-md relative z-10 text-center"
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        {/* Shield Icon */}
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-red-600 to-amber-500 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-red-500/20">
          <Shield className="w-10 h-10 text-white" />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-white mb-2">
          Registro Restringido
        </h1>
        <p className="text-gray-400 text-sm mb-8 max-w-sm mx-auto">
          El registro de administradores está restringido
        </p>

        {/* Message Card */}
        <div className="glass-strong rounded-2xl p-6 mb-6">
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
            <p className="text-sm text-amber-400/80">
              Solo un Super Administrador puede crear nuevas cuentas de administrador.
            </p>
          </div>
        </div>

        {/* Back to Login */}
        <Link
          href="/admin/login"
          className="inline-flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al Login
        </Link>
      </motion.div>
    </div>
  );
}
