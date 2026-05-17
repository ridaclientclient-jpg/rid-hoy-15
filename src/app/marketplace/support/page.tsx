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
  Send,
  HelpCircle,
} from 'lucide-react';
import { toast } from 'sonner';

const faqItems = [
  {
    question: 'Como agrego un nuevo producto a mi tienda?',
    answer:
      'Ve a la seccion Productos en el menu lateral y haz clic en "Agregar producto". Completa el formulario con nombre, descripcion, precio, categoria y sube al menos una foto. El producto estara visible para los clientes una vez que lo publiques. Puedes agregar hasta 10 imagenes por producto.',
  },
  {
    question: 'Como gestiono los pedidos recibidos?',
    answer:
      'En la seccion Pedidos podras ver todos los pedidos entrantes. Cada pedido muestra los productos solicitados, la direccion de entrega y el estado actual. Puedes aceptar o rechazar pedidos manualmente, o activar la aceptacion automatica en tu configuracion. Cuando aceptes un pedido, este se asignara a un repartidor disponible.',
  },
  {
    question: 'Cuando y como recibo mis pagos?',
    answer:
      'Los pagos se procesan automaticamente al completar cada entrega. El dinero se acumula en tu saldo de vendedor y puedes solicitar un retiro en cualquier momento desde la seccion de Ganancias. Los retiros se procesan en un plazo de 1 a 3 dias habiles. RIDA cobra una comision del 10% por cada venta realizada.',
  },
  {
    question: 'Puedo importar productos en masa?',
    answer:
      'Si, puedes importar productos usando un archivo CSV desde la seccion CSV Import en el menu lateral. Descarga la plantilla proporcionada, completa los datos de tus productos y sube el archivo. El sistema validara los datos antes de importarlos. Puedes importar hasta 500 productos por archivo.',
  },
];

const contactOptions = [
  {
    icon: MessageCircle,
    label: 'Chat en vivo',
    desc: 'Respuesta inmediata',
    color: 'text-green-600 bg-green-100',
    navigate: '/marketplace/support/chat',
  },
  {
    icon: Phone,
    label: 'WhatsApp',
    desc: '+506 8783-8329',
    color: 'text-emerald-600 bg-emerald-100',
    href: 'https://wa.me/50687838329',
  },
  {
    icon: Mail,
    label: 'Email',
    desc: 'soporte@rida.app',
    color: 'text-blue-600 bg-blue-100',
    href: 'mailto:soporte@rida.app',
  },
];

export default function MarketplaceSupport() {
  const router = useRouter();
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-xl font-bold text-gray-900">Soporte</h1>
        <p className="text-sm text-gray-500 mt-1">Estamos aqui para ayudarte 24/7</p>
      </motion.div>

      {/* Contact Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-1 sm:grid-cols-3 gap-3"
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
            className="glass rounded-2xl p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors"
          >
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${item.color}`}
            >
              <item.icon className="w-5 h-5" />
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-medium text-gray-900">{item.label}</p>
              <p className="text-xs text-gray-400 truncate">{item.desc}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
          </button>
        ))}
      </motion.div>

      {/* FAQ Section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-green-600" />
          Preguntas frecuentes
        </h3>
        <div className="space-y-2">
          {faqItems.map((item, index) => (
            <div key={index} className="glass rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                className="w-full p-4 flex items-center gap-3 text-left hover:bg-gray-50 transition-colors"
              >
                <span className="flex-1 text-sm text-gray-900">{item.question}</span>
                {expandedFaq === index ? (
                  <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                )}
              </button>
              {expandedFaq === index && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  className="px-4 pb-4"
                >
                  <div className="border-t border-gray-100 pt-3">
                    <p className="text-xs text-gray-500 leading-relaxed">{item.answer}</p>
                  </div>
                </motion.div>
              )}
            </div>
          ))}
        </div>
      </motion.div>

      {/* Contact Form */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="glass-strong rounded-2xl p-5 sm:p-6 space-y-4"
      >
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <Send className="w-4 h-4 text-green-600" />
          Envanos un mensaje
        </h3>
        <div>
          <select
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-green-500"
          >
            <option value="" className="bg-rida-dark">Selecciona un tema</option>
            <option value="products" className="bg-rida-dark">Productos</option>
            <option value="orders" className="bg-rida-dark">Pedidos</option>
            <option value="payments" className="bg-rida-dark">Pagos y facturacion</option>
            <option value="import" className="bg-rida-dark">Importar productos</option>
            <option value="technical" className="bg-rida-dark">Problema tecnico</option>
            <option value="other" className="bg-rida-dark">Otro</option>
          </select>
        </div>
        <textarea
          placeholder="Describe tu problema o consulta..."
          rows={4}
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-green-500 resize-none"
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
