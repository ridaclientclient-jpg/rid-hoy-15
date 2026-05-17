'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  HelpCircle, MessageSquare, Phone, Mail, Shield,
  ChevronRight, ChevronDown, Search, Send, Loader2,
  Headphones, AlertTriangle, CreditCard, Car, FileText, BookOpen,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';

const faqItems = [
  {
    question: 'Como cambio mi contrasena?',
    answer: 'Ve a Perfil > Seguridad > Cambiar Contrasena. Ingresa tu contrasena actual y luego la nueva. La contrasena debe tener al menos 6 caracteres. Si no recuerdas tu contrasena actual, puedes usar la opcion de recuperacion en la pantalla de inicio de sesion.',
  },
  {
    question: 'No recibo solicitudes de viaje, que puedo hacer?',
    answer: 'Verifica que tu estado este en "Conectado" en la pantalla principal. Asegurate de estar en una zona con buena cobertura. Mantén una calificacion superior a 4.3. Si tu calificacion es baja, completa mas viajes para mejorarla. Tambien verifica que tus documentos esten verificados y al dia.',
  },
  {
    question: 'Como retiro mis ganancias?',
    answer: 'Dirigete a la seccion Ganancias > Billetera > Retirar. Puedes solicitar un retiro cuando tu saldo sea mayor al minimo establecido. Los retiros se procesan en un plazo de 1 a 3 dias habiles segun tu metodo de pago seleccionado. Verifica que tus datos bancarios esten correctos en tu perfil.',
  },
  {
    question: 'Mi documento fue rechazado, que hago?',
    answer: 'Revisa el correo electronico o la seccion de notificaciones para conocer el motivo del rechazo. Los motivos comunes incluyen: imagen borrosa, documento vencido, datos no legibles, o mala iluminacion. Corrige el problema y vuelve a subir los documentos desde la seccion de Verificacion en tu perfil.',
  },
  {
    question: 'Quiero ser repartidor, como activo esa opcion?',
    answer: 'Puedes seleccionar si quieres ser conductor, repartidor o ambos durante el registro. Si ya tienes cuenta de conductor, ve a Perfil > Vehiculo y ahi podras agregar tipo de vehiculo para reparto (moto, bici o carro) y activar la opcion de repartidor. Los repartidores pueden aceptar entregas de paquetes y food delivery.',
  },
  {
    question: 'Como contacto con soporte en una emergencia?',
    answer: 'Durante un viaje activo, puedes usar el boton SOS que aparece en la pantalla. Esto alerta a nuestro equipo de soporte con tu ubicacion en tiempo real. Para emergencias que no sean durante un viaje, llama al numero de emergencia local (911) y luego reporta el incidente a traves de la seccion de Soporte en la app.',
  },
  {
    question: 'Como mejoran mis ganancias?',
    answer: 'Conduce en horarios de alta demanda (7am-9am, 12pm-2pm, 5pm-8pm). Mantén una calificacion alta para recibir mas viajes. Completa mas viajes para subir de nivel y obtener mejores comisiones. Evita cancelar viajes ya que esto afecta tu tasa de aceptacion y prioridad en la asignacion de viajes.',
  },
  {
    question: 'Como funciona el sistema de niveles?',
    answer: 'El sistema de niveles premia tu dedicacion. Con cada viaje completado acumulas puntos para subir de nivel: Basico (0 viajes), Bronce (20), Plata (50), Oro (100), Platino (200) y Diamante (500). Cada nivel superior te da mejor comision, bonos por viaje y prioridad en la asignacion de viajes. Ve a la seccion de Premios para ver tus beneficios actuales.',
  },
];

const contactOptions = [
  { icon: MessageSquare, label: 'Chat en vivo', desc: 'Respuesta inmediata', color: 'text-cyan-400 bg-cyan-500/20', href: '/driver/support/chat' },
  { icon: Phone, label: 'WhatsApp', desc: '+506 8783-8329', color: 'text-emerald-400 bg-emerald-500/20', href: 'https://wa.me/50687838329' },
  { icon: Mail, label: 'Email', desc: 'soporte@rida.app', color: 'text-blue-400 bg-blue-500/20', href: 'mailto:soporte@rida.app' },
];

const quickLinks = [
  { icon: CreditCard, label: 'Problemas con pagos', color: 'text-emerald-400', href: '/driver/earnings' },
  { icon: Car, label: 'Problemas con vehiculo', color: 'text-cyan-400', href: '/driver/vehicle' },
  { icon: FileText, label: 'Documentacion', color: 'text-blue-400', href: '/driver/verification' },
  { icon: Shield, label: 'Seguridad y emergencias', color: 'text-red-400', href: '/driver/security' },
  { icon: BookOpen, label: 'Terminos y condiciones', color: 'text-purple-400', href: '/driver/terms' },
  { icon: AlertTriangle, label: 'Reportar incidente', color: 'text-amber-400', href: '/driver/support/chat' },
];

export default function DriverSupport() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formSubject, setFormSubject] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const filteredFaq = faqItems.filter(item =>
    item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSendForm = async () => {
    if (!user?.id) {
      toast.error('Debes iniciar sesion para enviar un mensaje');
      return;
    }
    if (!formSubject) {
      toast.error('Selecciona un tema');
      return;
    }
    if (!formMessage.trim() || formMessage.trim().length < 10) {
      toast.error('Describe tu problema (minimo 10 caracteres)');
      return;
    }

    setIsSending(true);
    try {
      // Create a support chat with the message
      const subjectLabels: Record<string, string> = {
        technical: 'Problema tecnico',
        payment: 'Problema con pago',
        documents: 'Documentos',
        safety: 'Seguridad',
        other: 'Otro',
      };

      const { data: chat, error: chatError } = await supabase
        .from('support_chats')
        .insert({
          user_id: user.id,
          user_name: user.name || 'Conductor',
          user_role: 'driver',
          subject: subjectLabels[formSubject] || formSubject,
          status: 'open',
        })
        .select()
        .single();

      if (chatError) throw chatError;

      // Add the user's message
      const { error: msgError } = await supabase
        .from('chat_messages')
        .insert({
          chat_id: chat.id,
          sender_type: 'user',
          sender_id: user.id,
          content: formMessage.trim(),
          message_type: 'text',
        });

      if (msgError) throw msgError;

      toast.success('Mensaje enviado! Te responderemos pronto.');
      setFormSubject('');
      setFormMessage('');

      // Navigate to chat
      router.push('/driver/support/chat');
    } catch (err: any) {
      console.error('Error sending support message:', err);
      toast.error('Error al enviar mensaje. Intenta de nuevo.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
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
          <Shield className="w-6 h-6 text-red-400" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-white">Emergencia?</p>
          <p className="text-xs text-gray-400">Si estas en peligro, llama al 911 inmediatamente y usa el boton SOS durante tu viaje activo.</p>
        </div>
      </motion.div>

      {/* Search */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="relative"
      >
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          placeholder="Buscar en ayuda..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500"
        />
      </motion.div>

      {/* Contact Options */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-3 gap-2"
      >
        {contactOptions.map((item, i) => (
          <button
            key={i}
            onClick={() => {
              if (item.href.startsWith('/')) {
                router.push(item.href);
              } else {
                window.open(item.href, '_blank');
              }
            }}
            className="glass rounded-xl p-3 flex flex-col items-center gap-2 hover:bg-white/5 transition-colors"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.color}`}>
              <item.icon className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium text-white">{item.label}</span>
            <span className="text-[10px] text-gray-500">{item.desc}</span>
          </button>
        ))}
      </motion.div>

      {/* Quick Links */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.13 }}
        className="glass rounded-2xl p-4"
      >
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Headphones className="w-4 h-4 text-cyan-400" />
          Temas de ayuda
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {quickLinks.map((link, i) => (
            <button
              key={i}
              onClick={() => router.push(link.href)}
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 transition-colors"
            >
              <link.icon className={`w-4 h-4 ${link.color}`} />
              <span className="text-xs text-gray-300">{link.label}</span>
              <ChevronRight className="w-3 h-3 text-gray-600 ml-auto" />
            </button>
          ))}
        </div>
      </motion.div>

      {/* FAQ */}
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
              <p className="text-sm text-gray-500">No se encontraron resultados para &quot;{searchQuery}&quot;</p>
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
        <h3 className="text-sm font-semibold text-white">Envianos un mensaje</h3>
        <div>
          <select
            value={formSubject}
            onChange={(e) => setFormSubject(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="" className="bg-rida-dark">Selecciona un tema</option>
            <option value="technical" className="bg-rida-dark">Problema tecnico</option>
            <option value="payment" className="bg-rida-dark">Problema con pago</option>
            <option value="documents" className="bg-rida-dark">Documentos</option>
            <option value="safety" className="bg-rida-dark">Seguridad</option>
            <option value="other" className="bg-rida-dark">Otro</option>
          </select>
        </div>
        <textarea
          placeholder="Describe tu problema o consulta..."
          rows={4}
          value={formMessage}
          onChange={(e) => setFormMessage(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500 resize-none"
        />
        <button
          onClick={handleSendForm}
          disabled={isSending}
          className="w-full btn-neon text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {isSending ? 'Enviando...' : 'Enviar mensaje'}
        </button>
      </motion.div>
    </div>
  );
}
