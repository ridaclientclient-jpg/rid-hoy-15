'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, Phone, Mail, ChevronRight, ChevronDown, Shield, HelpCircle, FileText, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

const faqItems = [
  {
    question: 'Como cambio mi destino durante un viaje?',
    answer: 'Si el conductor aun no ha llegado a tu ubicacion, puedes cancelar el viaje y crear uno nuevo con la direccion correcta. Si el viaje ya esta en curso, comunicate con el conductor para acordar el cambio de destino. Tambien puedes usar la opcion de agregar parada si necesitas hacer una parada intermedia antes de llegar a tu destino final.',
  },
  {
    question: 'Como solicito un reembolso?',
    answer: 'Si fuiste cobrado incorrectamente o el servicio no se completo, ve a la seccion Historial de Viajes, selecciona el viaje correspondiente y busca la opcion de Reportar Problema. Describe la situacion y nuestro equipo de soporte revisara tu caso. Los reembolsos se procesan en un plazo de 3 a 5 dias habiles una vez aprobados.',
  },
  {
    question: 'Como funciona el boton SOS?',
    answer: 'El boton SOS esta disponible durante los viajes activos. Al presionarlo, se envia una alerta inmediata a nuestro equipo de soporte con tu ubicacion GPS en tiempo real. Adicionalmente, te recomendamos llamar al 911 para emergencias que requieran atencion policial o medica. El boton SOS es para situaciones de peligro durante tu viaje.',
  },
  {
    question: 'Reportar un problema con el conductor?',
    answer: 'Puedes reportar a un conductor desde la seccion Historial de Viajes seleccionando el viaje en cuestion. Tambien puedes calificar el viaje y dejar un comentario detallado. Para reportes urgentes, usa el chat en vivo o llama a nuestro numero de soporte. Todos los reportes son tratados de manera confidencial y nuestro equipo tomara las acciones correspondientes.',
  },
  {
    question: 'No me llego mi confirmacion de recarga?',
    answer: 'Las recargas se procesan de forma inmediata. Si no ves el saldo reflejado en tu billetera despues de 5 minutos, verifica tu historial de transacciones. Si el problema persiste, contacta a soporte con el numero de referencia de tu recarga para que podamos investigar.',
  },
  {
    question: 'Como cambio mi metodo de pago predeterminado?',
    answer: 'Ve a Billetera y administra tus tarjetas guardadas. Puedes agregar nuevas tarjetas y seleccionar cual usar como predeterminada al momento de recargar. Los metodos de pago para viajes se seleccionan directamente al momento de solicitar el viaje.',
  },
];

export default function ClientSupport() {
  const router = useRouter();
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  return (
    <div className="p-4 space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-xl font-bold text-white">Soporte</h1>
        <p className="text-sm text-gray-400 mt-1">Estamos aqui para ayudarte 24/7</p>
      </motion.div>

      {/* Contact Options */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="space-y-2">
        {/* Chat en vivo */}
        <button
          type="button"
          onClick={() => router.push('/client/support/chat')}
          className="w-full glass rounded-xl p-4 flex items-center gap-3 hover:bg-white/5 transition-colors"
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-cyan-400 bg-cyan-500/20">
            <MessageCircle className="w-5 h-5" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-medium text-white">Chat en vivo</p>
            <p className="text-xs text-gray-500">Respuesta inmediata</p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </button>

        {/* WhatsApp */}
        <button
          type="button"
          onClick={() => window.open('https://wa.me/50687838329', '_blank')}
          className="w-full glass rounded-xl p-4 flex items-center gap-3 hover:bg-white/5 transition-colors"
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-emerald-400 bg-emerald-500/20">
            <Phone className="w-5 h-5" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-medium text-white">WhatsApp</p>
            <p className="text-xs text-gray-500">+506 8783-8329</p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </button>

        {/* Email */}
        <button
          type="button"
          onClick={() => window.open('mailto:soporte@rida.app', '_blank')}
          className="w-full glass rounded-xl p-4 flex items-center gap-3 hover:bg-white/5 transition-colors"
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-blue-400 bg-blue-500/20">
            <Mail className="w-5 h-5" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-medium text-white">Email</p>
            <p className="text-xs text-gray-500">soporte@rida.app</p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </button>
      </motion.div>

      {/* FAQ */}
      <div>
        <h3 className="text-sm font-semibold text-gray-400 mb-3">Preguntas Frecuentes</h3>
        <div className="space-y-2">
          {faqItems.map((item, i) => (
            <div key={i} className="glass rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                className="w-full p-3 flex items-center gap-2 text-left hover:bg-white/5 transition-colors"
              >
                <HelpCircle className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className="flex-1 text-sm text-white">{item.question}</span>
                {expandedFaq === i ? (
                  <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />
                )}
              </button>
              {expandedFaq === i && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="px-3 pb-3">
                  <div className="border-t border-white/5 pt-2">
                    <p className="text-xs text-gray-400 leading-relaxed">{item.answer}</p>
                  </div>
                </motion.div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
