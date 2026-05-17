'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  MessageCircle,
  Phone,
  Mail,
  ChevronRight,
  ChevronDown,
  Shield,
  HelpCircle,
  Send,
  Users,
  Settings,
  Database,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

const faqItems = [
  {
    question: 'Como gestiono los usuarios del sistema?',
    answer:
      'Desde la seccion Usuarios en el menu lateral puedes ver todos los usuarios registrados, filtrar por rol (cliente, conductor, repartidor), ver su estado de verificacion y realizar acciones como suspender o eliminar cuentas. Tambien puedes buscar usuarios por nombre, email o telefono.',
  },
  {
    question: 'Como manejo los reportes de SOS?',
    answer:
      'Los reportes SOS llegan a la seccion Chat de Soporte y tambien se registran como notificaciones de tipo alerta. Debes revisarlos de inmediato ya que representan situaciones de emergencia. Verifica la ubicacion del usuario, contacta al conductor involucrado y coordina con las autoridades si es necesario.',
  },
  {
    question: 'Como configuro las tarifas y comisiones?',
    answer:
      'En la seccion Pricing puedes ajustar las tarifas base por kilometro, los multiplicadores por horario (hora pico, nocturno, festivo), la comision de la plataforma y los porcentajes para conductores. Los cambios se aplican de inmediato a los nuevos viajes solicitados.',
  },
  {
    question: 'Que hago si un conductor recibe multiples reportes?',
    answer:
      'Revisa el historial de reportes del conductor en su perfil. Si los reportes son graves (comportamiento inapropiado, seguridad), puedes suspender temporalmente su cuenta desde la seccion Conductores. Para violaciones severas, procede con la eliminacion permanente. Documenta todas las acciones tomadas.',
  },
  {
    question: 'Como superviso las operaciones del Marketplace?',
    answer:
      'Desde las secciones Marketplace, Vendedores, Productos y Pedidos MKT puedes gestionar todo el ecosistema de tienda. Revisa los productos pendientes de aprobacion, gestiona disputas entre vendedores y clientes, y monitorea las metricas de ventas desde el dashboard de Analytics.',
  },
  {
    question: 'Como genero reportes financieros?',
    answer:
      'En la seccion Reportes puedes generar reportes de ingresos, comisiones, pagos a conductores y transacciones de billetera. Puedes filtrar por rango de fechas, tipo de transaccion y metodo de pago. Los reportes se pueden exportar en formato CSV para analisis externo.',
  },
];

const contactOptions = [
  {
    icon: MessageCircle,
    label: 'Chat Soporte',
    desc: 'Gestionar chats',
    color: 'text-cyan-400 bg-cyan-500/20',
    href: '/admin/chat',
  },
  {
    icon: Phone,
    label: 'WhatsApp',
    desc: '+506 8783-8329',
    color: 'text-emerald-400 bg-emerald-500/20',
    href: 'https://wa.me/50687838329',
  },
  {
    icon: Mail,
    label: 'Email RIDA',
    desc: 'ridadride7@gmail.com',
    color: 'text-blue-400 bg-blue-500/20',
    href: 'mailto:ridadride7@gmail.com',
  },
];

export default function AdminSupport() {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-white">Soporte Administrativo</h1>
        <p className="text-gray-400 mt-1">Recursos y contactos para la gestion del sistema RIDA</p>
      </motion.div>

      {/* Contact Options */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        {contactOptions.map((item, i) => (
          <a
            key={i}
            href={item.href}
            target={item.href.startsWith('http') ? '_blank' : undefined}
            rel={item.href.startsWith('http') ? 'noopener noreferrer' : undefined}
            className="glass rounded-2xl p-5 flex items-center gap-4 hover:bg-white/5 transition-colors group"
          >
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${item.color}`}
            >
              <item.icon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white group-hover:text-cyan-400 transition-colors">
                {item.label}
              </p>
              <p className="text-xs text-gray-500 truncate mt-0.5">{item.desc}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-600 shrink-0" />
          </a>
        ))}
      </motion.div>

      {/* Quick Admin Tools */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4"
      >
        <a href="/admin/users" className="glass rounded-2xl p-4 flex items-center gap-3 hover:bg-white/5 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <Users className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">Gestionar Usuarios</p>
            <p className="text-xs text-gray-500">Ver, suspender, eliminar</p>
          </div>
        </a>
        <a href="/admin/drivers" className="glass rounded-2xl p-4 flex items-center gap-3 hover:bg-white/5 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">Alertas SOS</p>
            <p className="text-xs text-gray-500">Emergencias activas</p>
          </div>
        </a>
        <a href="/admin/settings" className="glass rounded-2xl p-4 flex items-center gap-3 hover:bg-white/5 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
            <Settings className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">Configuracion</p>
            <p className="text-xs text-gray-500">Tarifas y parametros</p>
          </div>
        </a>
        <a href="/admin/reports" className="glass rounded-2xl p-4 flex items-center gap-3 hover:bg-white/5 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <Database className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">Reportes</p>
            <p className="text-xs text-gray-500">Financieros y operativos</p>
          </div>
        </a>
      </motion.div>

      {/* FAQ */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-cyan-400" />
          Preguntas frecuentes del administrador
        </h3>
        <div className="space-y-2">
          {faqItems.map((item, index) => (
            <div key={index} className="glass rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                className="w-full p-4 flex items-center gap-3 text-left hover:bg-white/5 transition-colors"
              >
                <Shield className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className="flex-1 text-sm text-white">{item.question}</span>
                {expandedFaq === index ? (
                  <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />
                )}
              </button>
              {expandedFaq === index && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  className="px-4 pb-4"
                >
                  <div className="border-t border-white/5 pt-3">
                    <p className="text-sm text-gray-400 leading-relaxed">{item.answer}</p>
                  </div>
                </motion.div>
              )}
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
