'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  MessageCircle,
  Phone,
  Mail,
  ChevronRight,
  ChevronDown,
  Search,
  Send,
  HelpCircle,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

const faqItems = [
  {
    question: 'No recibo solicitudes de entrega, que puedo hacer?',
    answer:
      'Verifica que tu estado este activo en la pantalla principal. Asegurate de estar en una zona con alta demanda de entregas. Manten una calificacion superior a 4.5 estrellas para recibir prioridad en las asignaciones. Tambien puedes activar notificaciones push para no perderte ninguna solicitud.',
  },
  {
    question: 'Como retiro mis ganancias?',
    answer:
      'Dirigete a la seccion Ganancias en el menu inferior y selecciona Retirar. Puedes solicitar un retiro cuando tu saldo supere el minimo establecido. Los retiros se procesan en un plazo de 1 a 3 dias habiles segun tu metodo de pago. Asegrate de que tus datos bancarios esten correctos en tu perfil.',
  },
  {
    question: 'Que hago si el cliente no esta en la direccion de entrega?',
    answer:
      'Intenta comunicarte con el cliente a traves de los datos de contacto proporcionados en el pedido. Espera al menos 5 minutos en el lugar. Si no hay respuesta, puedes marcar el pedido como "Cliente no encontrado" y contactar con soporte para instrucciones adicionales. No dejes el paquete sin confirmacion del destinatario.',
  },
  {
    question: 'Como reporto un problema durante una entrega?',
    answer:
      'Durante una entrega activa, puedes usar el boton de Soporte en la pantalla de seguimiento para reportar cualquier incidente. Describe el problema con el mayor detalle posible e incluye fotos si es necesario. Para emergencias, llama al 911 inmediatamente y luego reporta el incidente a nuestro equipo de soporte.',
  },
];

const contactOptions = [
  {
    icon: MessageCircle,
    label: 'Chat en vivo',
    desc: 'Respuesta inmediata',
    color: 'text-cyan-400 bg-cyan-500/20',
    navigate: '/courier/support/chat',
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
    label: 'Email',
    desc: 'soporte@rida.app',
    color: 'text-blue-400 bg-blue-500/20',
    href: 'mailto:soporte@rida.app',
  },
];

export default function CourierSupport() {
  const router = useRouter();
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredFaq = faqItems.filter(
    (item) =>
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="p-4 space-y-5">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-xl font-bold text-white">Soporte</h1>
        <p className="text-sm text-gray-400 mt-1">Estamos aqui para ayudarte 24/7</p>
      </motion.div>

      {/* SOS Banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-center gap-3"
      >
        <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-6 h-6 text-red-400" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-white">Emergencia?</p>
          <p className="text-xs text-gray-400">
            Si estas en peligro, llama al 911 inmediatamente y usa el boton SOS durante tu entrega activa.
          </p>
        </div>
      </motion.div>

      {/* Contact Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-3 gap-2"
      >
        {contactOptions.map((item, i) => (
          <button
            key={i}
            type="button"
            onClick={() => {
              if (item.navigate) {
                router.push(item.navigate);
              } else if (item.href) {
                window.open(item.href, '_blank');
              }
            }}
            className="glass rounded-xl p-3 flex flex-col items-center gap-2 hover:bg-white/5 transition-colors"
          >
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.color}`}
            >
              <item.icon className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium text-white">{item.label}</span>
            <span className="text-[10px] text-gray-500">{item.desc}</span>
          </button>
        ))}
      </motion.div>

      {/* FAQ Search */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.13 }}
        className="relative"
      >
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          placeholder="Buscar en preguntas frecuentes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500"
        />
      </motion.div>

      {/* FAQ Section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.16 }}
      >
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-cyan-400" />
          Preguntas frecuentes
        </h3>
        <div className="space-y-2">
          {(searchQuery ? filteredFaq : faqItems).map((item, index) => (
            <div key={index} className="glass rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                className="w-full p-3 flex items-center gap-2 text-left hover:bg-white/5 transition-colors"
              >
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
                  className="px-3 pb-3"
                >
                  <div className="border-t border-white/5 pt-2">
                    <p className="text-xs text-gray-400 leading-relaxed">{item.answer}</p>
                  </div>
                </motion.div>
              )}
            </div>
          ))}
          {searchQuery && filteredFaq.length === 0 && (
            <div className="text-center py-6">
              <p className="text-sm text-gray-500">
                No se encontraron resultados para &quot;{searchQuery}&quot;
              </p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Contact Form */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-strong rounded-2xl p-4 space-y-3"
      >
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Send className="w-4 h-4 text-cyan-400" />
          Envanos un mensaje
        </h3>
        <div>
          <select
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="" className="bg-rida-dark">Selecciona un tema</option>
            <option value="delivery" className="bg-rida-dark">Problema con entrega</option>
            <option value="earnings" className="bg-rida-dark">Ganancias y pagos</option>
            <option value="safety" className="bg-rida-dark">Seguridad</option>
            <option value="technical" className="bg-rida-dark">Problema tecnico</option>
            <option value="other" className="bg-rida-dark">Otro</option>
          </select>
        </div>
        <textarea
          placeholder="Describe tu problema o consulta..."
          rows={4}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500 resize-none"
        />
        <button
          type="button"
          onClick={() => toast.success('Mensaje enviado. Te responderemos pronto.')}
          className="w-full btn-neon text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2"
        >
          <Send className="w-4 h-4" />
          Enviar mensaje
        </button>
      </motion.div>
    </div>
  );
}
