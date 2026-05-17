'use client';

import { motion } from 'framer-motion';
import { FileText, ChevronDown, ChevronUp, Shield, User, CreditCard, MapPin, Clock, Banknote } from 'lucide-react';
import { useState } from 'react';

const sections = [
  {
    title: '1. Terminos Generales',
    icon: FileText,
    content: `Al registrarte como usuario en RIDA SUPREME SYSTEM, aceptas cumplir con todos los terminos y condiciones aqui establecidos. La plataforma RIDA es un servicio de intermediacion tecnologica que conecta a conductores y repartidores con usuarios que solicitan servicios de transporte o entrega de paquetes. Al usar la plataforma, reconoces que RIDA actua exclusivamente como intermediario y no asume responsabilidad directa por los servicios prestados entre las partes. Estos terminos aplican a todos los usuarios de la plataforma, incluyendo pasajeros, conductores, repartidores y vendedores del marketplace.`,
  },
  {
    title: '2. Uso del Servicio',
    icon: MapPin,
    content: `Como usuario de RIDA, te comprometes a: proporcionar informacion veraz y actualizada en tu perfil, mantener la seguridad durante cada viaje o entrega, tratar a conductores y repartidores con respeto, no utilizar la plataforma para fines ilegales, y cumplir con todas las leyes y regulaciones locales aplicables. RIDA se reserva el derecho de suspender o cancelar cuentas que violen estos terminos. El servicio esta disponible las 24 horas del dia, sujeto a disponibilidad de conductores en tu zona. Las tarifas son calculadas dinamicamente y pueden variar segun la demanda, distancia, tiempo y condiciones del trafico.`,
  },
  {
    title: '3. Pagos y Tarifas',
    icon: Banknote,
    content: `Los pagos por los servicios de RIDA pueden realizarse en efectivo, SINPE Movil o tarjeta. Las tarifas son calculadas en colones costarricenses (CRC) y se muestran antes de confirmar cada viaje. RIDA utiliza un sistema de precios dinamicos que ajusta las tarifas segun la demanda en tiempo real, la distancia del viaje, las condiciones del trafico y la hora del dia. En periodos de alta demanda, puede aplicarse un multiplicador de tarifa que sera comunicado claramente antes de la solicitud. Los pagos con tarjeta son procesados de forma segura a traves de proveedores certificados. Los codigos de promocion estan sujetos a terminos y condiciones especificas de cada campana.`,
  },
  {
    title: '4. Cancelaciones',
    icon: Clock,
    content: `Puedes cancelar un viaje en cualquier momento antes de que el conductor llegue a tu punto de recogida. Sin embargo, las cancelaciones frecuentes pueden afectar tu experiencia en la plataforma. Si cancelas despues de que un conductor ha aceptado tu solicitud y se dirige a tu ubicacion, puede aplicarse una tarifa de cancelacion que sera comunicada claramente antes de confirmar. Las cancelaciones por razones de seguridad o emergencia no generan penalizacion. RIDA se compromete a revisar cada caso de forma justa y transparente.`,
  },
  {
    title: '5. Seguridad del Usuario',
    icon: Shield,
    content: `RIDA implementa multiples medidas de seguridad para proteger a todos los usuarios: verificacion de identidad de conductores y usuarios, seguimiento GPS en tiempo real de todos los viajes, boton de emergencia SOS, sistema de calificacion mutua, y contacto de emergencia configurable. Recomendamos compartir tu viaje con contactos de confianza, verificar la placa y modelo del vehiculo antes de subir, y siempre usar el cinturon de seguridad. En caso de cualquier situacion de emergencia durante un viaje, utiliza el boton SOS disponible en la aplicacion o contacta al 911 directamente.`,
  },
  {
    title: '6. Privacidad y Datos',
    icon: User,
    content: `RIDA respeta tu privacidad y cumple con la legislacion de proteccion de datos aplicable en Costa Rica. Tus datos personales (nombre, correo, telefono, ubicacion) son utilizados exclusivamente para prestar el servicio: solicitar viajes, mostrar tu ubicacion al conductor, procesar pagos y mejorar la experiencia del usuario. RIDA no compartira tu informacion personal con terceros sin tu consentimiento expreso, excepto cuando sea requerido por autoridad competente. Tu ubicacion se recopila unicamente durante la prestacion activa del servicio. Puedes solicitar la eliminacion de tu cuenta y datos personales contactando a soporte.`,
  },
  {
    title: '7. Calificaciones y Reseñas',
    icon: CreditCard,
    content: `Despues de cada viaje completado, podras calificar a tu conductor con una puntuacion de 1 a 5 estrellas y dejar un comentario opcional. Del mismo modo, el conductor podra calificarte. Las calificaciones ayudan a mantener la calidad del servicio y permiten a todos los participantes tomar decisiones informadas. RIDA toma en cuenta las calificaciones y comentarios para evaluar el desempeno de los conductores y mantener un servicio seguro y confiable. Los comentarios ofensivos o inapropiados seran eliminados y pueden resultar en restriccion de la cuenta.`,
  },
  {
    title: '8. Responsabilidad Limitada',
    icon: Shield,
    content: `RIDA actua como intermediario tecnologico y no es responsable directa ni subsidiariamente por los daños, perdidas, retrasos o cualquier otro perjuicio que pueda surgir durante la prestacion del servicio por parte del conductor o repartidor. La responsabilidad civil y penal recae sobre el conductor o repartidor que presta el servicio directamente. RIDA se compromete a proporcionar herramientas de seguridad y soporte, pero no garantiza la disponibilidad ininterrumpida del servicio ni la ausencia total de errores. En caso de disputa, RIDA actuara como mediador para facilitar una solucion justa entre las partes.`,
  },
];

export default function ClientTerms() {
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0]));

  const toggleSection = (index: number) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <div className="p-4 space-y-4">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-xl font-bold text-white">Terminos y Condiciones</h1>
        <p className="text-sm text-gray-400 mt-1">Ultima actualizacion: Abril 2025</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="glass rounded-2xl p-4 border border-cyan-500/20"
      >
        <div className="flex items-center gap-2 mb-2">
          <FileText className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-semibold text-white">Resumen</span>
        </div>
        <p className="text-xs text-gray-400 leading-relaxed">
          Estos terminos regulan tu uso de RIDA como pasajero o usuario. Al utilizar la plataforma, aceptas estas condiciones. Te recomendamos leerlas completamente antes de solicitar tu primer viaje.
        </p>
      </motion.div>

      <div className="space-y-2">
        {sections.map((section, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 + 0.1 }}
            className="glass rounded-xl overflow-hidden"
          >
            <button
              onClick={() => toggleSection(index)}
              className="w-full p-4 flex items-center gap-3 text-left hover:bg-white/5 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-cyan-500/10 flex items-center justify-center shrink-0">
                <section.icon className="w-4 h-4 text-cyan-400" />
              </div>
              <span className="flex-1 text-sm font-medium text-white">{section.title}</span>
              {expandedSections.has(index) ? (
                <ChevronUp className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              )}
            </button>
            {expandedSections.has(index) && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="px-4 pb-4"
              >
                <div className="border-t border-white/5 pt-3">
                  <p className="text-xs text-gray-400 leading-relaxed whitespace-pre-line">
                    {section.content}
                  </p>
                </div>
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-center py-4"
      >
        <p className="text-[10px] text-gray-600">
          Al continuar usando RIDA, aceptas estos Terminos y Condiciones.
        </p>
        <p className="text-[10px] text-gray-600 mt-1">
          Para dudas, contacta a soporte desde la app.
        </p>
      </motion.div>
    </div>
  );
}
