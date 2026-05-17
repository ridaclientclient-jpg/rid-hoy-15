'use client';

import { motion } from 'framer-motion';
import { FileText, ChevronDown, ChevronUp, Shield, User, Car, CreditCard } from 'lucide-react';
import { useState } from 'react';

const sections = [
  {
    title: '1. Terminos Generales',
    icon: FileText,
    content: `Al registrarte como conductor o repartidor en RIDA SUPREME SYSTEM, aceptas cumplir con todos los terminos y condiciones aqui establecidos. La plataforma RIDA es un servicio de intermediacion tecnologica que conecta a conductores y repartidores con usuarios que solicitan servicios de transporte o entrega de paquetes. Al usar la plataforma, reconoces que RIDA actua exclusivamente como intermediario y no asume responsabilidad directa por los servicios prestados entre las partes. Estos terminos aplican de igual manera para conductores de vehiculos, motociclistas y ciclistas que ofrecen servicios de entrega o courier a traves de la plataforma.`,
  },
  {
    title: '2. Requisitos para Conductor',
    icon: Car,
    content: `Para operar como conductor en RIDA, debes cumplir con los siguientes requisitos: ser mayor de 18 anos de edad, poseer una licencia de conducir vigente emitida por la autoridad competente, contar con un vehiculo que cumpla con las normas de seguridad vial establecidas por la legislacion local. El vehiculo debe tener seguro vigente, revision tecnica al dia y estar en buenas condiciones mecanicas. Para conductores de vehiculos motorizados (carros y motos), la licencia debe corresponder al tipo de vehiculo que se utilizara. Para ciclistas, se requiere casco de seguridad certificado y equipo reflectante. RIDA se reserva el derecho de solicitar documentacion adicional y realizar verificaciones periodicas para mantener la calidad del servicio.`,
  },
  {
    title: '3. Requisitos para Repartidor',
    icon: CreditCard,
    content: `Los repartidores que ofrecen servicios de courier a traves de RIDA deben cumplir con los siguientes requisitos: ser mayor de 18 anos de edad, contar con identificacion vigente, y utilizar un vehiculo adecuado para el tipo de entregas que acepten. Los repartidores pueden utilizar moto, bicicleta o vehiculo, y deben tener el equipo de seguridad correspondiente a cada tipo de vehiculo. Todo repartidor debe mantener en buen estado su equipo de transporte y proporcionar un servicio seguro y confiable. RIDA evalua periodicamente el desempeno de los repartidores y puede suspender cuentas que no cumplan con los estandares de calidad.`,
  },
  {
    title: '4. Seguridad y Responsabilidad',
    icon: Shield,
    content: `La seguridad de todos los participantes es la prioridad maxima de RIDA. Los conductores y repartidores deben: respetar todas las leyes de transito aplicables, no utilizar dispositivos moviles mientras conducen, mantener un comportamiento profesional y respetuoso en todo momento, no transportar pasajeros o paquetes adicionales no registrados en la plataforma, y reportar inmediatamente cualquier incidente o situacion de emergencia a traves del boton SOS. RIDA cuenta con sistemas de seguimiento GPS en tiempo real, verificacion de identidad y calificacion mutua para garantizar la seguridad. El incumplimiento de las normas de seguridad puede resultar en la suspension o cancelacion permanente de la cuenta.`,
  },
  {
    title: '5. Tarifas y Pagos',
    icon: CreditCard,
    content: `Las tarifas de los servicios son calculadas dinamicamente por la plataforma basandose en factores como la distancia, tiempo estimado, demanda en tiempo real y condiciones del trafico. RIDA retiene un porcentaje de comision sobre cada servicio, el cual es comunicado claramente antes de aceptar cada viaje o entrega. Los pagos son procesados de forma segura y depositados directamente en la billetera digital del conductor o repartidor dentro de la plataforma. Los retiros de fondos pueden solicitarse en cualquier momento y seran procesados segun los tiempos establecidos por el proveedor de pago. RIDA garantiza transparencia total en la estructura de tarifas y comisiones, la cual esta disponible en todo momento dentro de la seccion de ganancias de la aplicacion.`,
  },
  {
    title: '6. Privacidad y Proteccion de Datos',
    icon: User,
    content: `RIDA respeta la privacidad de todos sus usuarios y cumple con la legislacion de proteccion de datos aplicable. Los datos personales proporcionados durante el registro (nombre, correo, telefono, documentos de verificacion) son utilizados exclusivamente para los fines de la plataforma: verificacion de identidad, gestion de servicios, comunicaciones relacionadas con la plataforma y cumplimiento de obligaciones legales. RIDA no compartira informacion personal con terceros sin consentimiento expreso del usuario, excepto cuando sea requerido por autoridad competente. Los datos de ubicacion se recopilan unicamente durante la prestacion activa del servicio y se eliminan periodicamente segun nuestra politica de retencion de datos. El usuario puede solicitar la eliminacion de su cuenta y datos personales en cualquier momento contactando a soporte.`,
  },
  {
    title: '7. Calificaciones y Calidad del Servicio',
    icon: Shield,
    content: `RIDA utiliza un sistema de calificacion mutua de 1 a 5 estrellas tanto para conductores/repartidores como para usuarios. Las calificaciones ayudan a mantener la calidad del servicio y permiten a todos los participantes tomar decisiones informadas. Un promedio de calificacion inferior a 4.3 puede resultar en advertencias o suspension de la cuenta. Los casos de calificacion muy baja seran revisados por nuestro equipo de soporte antes de tomar cualquier accion. RIDA tambien toma en cuenta factores como tasa de aceptacion de viajes, puntualidad, cancelled rides ratio y cumplimiento de las normas de seguridad para evaluar el desempeno general de cada conductor y repartidor en la plataforma.`,
  },
  {
    title: '8. Cancelaciones y Sanciones',
    icon: FileText,
    content: `Las cancelaciones frecuentes de servicios aceptados afectan negativamente la experiencia de todos los usuarios. RIDA establece los siguientes lineamientos: cancelar un servicio despues de haberlo aceptado sin causa justificada puede resultar en una penalizacion. Las causas justificadas incluyen: emergencia personal, problema mecanico del vehiculo, o situacion de inseguridad. Tres o mas cancelaciones injustificadas en un periodo de 7 dias resultaran en una reduccion temporal del numero de solicitudes recibidas. El incumplimiento reiterado puede llevar a la suspension temporal o permanente de la cuenta. RIDA se compromete a revisar cada caso de forma justa y transparente antes de aplicar cualquier sancion, y el conductor o repartidor tendra derecho a apelar cualquier decision a traves del canal de soporte.`,
  },
];

export default function DriverTerms() {
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
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-xl font-bold text-white">Terminos y Condiciones</h1>
        <p className="text-sm text-gray-400 mt-1">Ultima actualizacion: Abril 2025</p>
      </motion.div>

      {/* Summary */}
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
          Estos terminos regulan tu uso de RIDA como conductor o repartidor. Al utilizar la plataforma, aceptas estas condiciones. Te recomendamos leerlas completamente antes de comenzar a ofrecer servicios.
        </p>
      </motion.div>

      {/* Sections */}
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

      {/* Footer Note */}
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
