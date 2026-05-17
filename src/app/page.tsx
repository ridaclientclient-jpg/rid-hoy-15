'use client';

import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import {
  Zap, User, Car, Shield, Store, ChevronRight, MapPin, Wallet,
  MessageCircle, Clock, CreditCard, Navigation, Phone, Heart,
  Download, ArrowRight, Star, CheckCircle2, ShieldCheck,
  AlertTriangle, Users, Sparkles, Eye, Banknote, QrCode,
  Headphones, CalendarDays, Package
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  DATA                                                               */
/* ------------------------------------------------------------------ */

const apps = [
  {
    id: 'client',
    title: 'CLIENT APP',
    subtitle: 'Solicitar viajes en tiempo real',
    icon: User,
    href: '/client',
    color: 'from-blue-600 to-cyan-500',
    description: 'Mapa GPS interactivo, solicitud de viajes al instante, pagos integrados, historial completo, boton SOS y mucho mas.',
    features: ['Viajes en tiempo real', 'Seguimiento GPS en vivo', 'Pagos seguros', 'Boton SOS integrado'],
  },
  {
    id: 'driver',
    title: 'DRIVER APP',
    subtitle: 'Gestion profesional de conductores',
    icon: Car,
    href: '/driver',
    color: 'from-cyan-500 to-emerald-500',
    description: 'Aceptar viajes con un toque, navegacion inteligente, control de ganancias diarias y verificacion de identidad.',
    features: ['Aceptar viajes rapido', 'Navegacion GPS', 'Ganancias diarias', 'Verificacion total'],
  },
  {
    id: 'admin',
    title: 'ADMIN PANEL',
    subtitle: 'Control total del sistema',
    icon: Shield,
    href: '/admin',
    color: 'from-purple-600 to-blue-600',
    description: 'Dashboard en vivo, analytics avanzados, gestion de usuarios, control de precios y heatmap de demanda.',
    features: ['Dashboard completo', 'Analytics avanzados', 'Control de precios', 'Gestion total'],
  },
  {
    id: 'marketplace',
    title: 'MARKETPLACE',
    subtitle: 'Tienda y productos digitales',
    icon: Store,
    href: '/marketplace',
    color: 'from-amber-500 to-orange-500',
    description: 'Sube productos, gestiona categorias, importa desde CSV y controla tu inventario desde un solo lugar.',
    features: ['Subir productos', 'Importar CSV', 'Categorias flexibles', 'Gestion de stock'],
  },
  {
    id: 'courier',
    title: 'COURIER APP',
    subtitle: 'Entregas rapidas de marketplace',
    icon: Package,
    href: '/courier',
    color: 'from-rose-500 to-pink-500',
    description: 'Acepta entregas de tiendas y restaurantes, navega al punto de recogida, entrega al cliente y cobra al instante.',
    features: ['Entregas en vivo', 'Ganancias inmediatas', 'Navegacion GPS', 'Billetera integrada'],
  },
];

const heroStats = [
  { value: '10,000+', label: 'Usuarios activos' },
  { value: '500+', label: 'Conductores' },
  { value: '50,000+', label: 'Viajes completados' },
];

const steps = [
  {
    number: '01',
    title: 'Registrate',
    description: 'Crea tu cuenta en segundos con tu correo electronico. Sin complicaciones.',
    icon: User,
  },
  {
    number: '02',
    title: 'Solicita',
    description: 'Ingresa tu destino en el mapa, elige el tipo de viaje que prefieras y confirma.',
    icon: MapPin,
  },
  {
    number: '03',
    title: 'Disfruta',
    description: 'Tu conductor asignado llega en minutos. Relajate y llega seguro a tu destino.',
    icon: CheckCircle2,
  },
];

const features = [
  {
    icon: Navigation,
    title: 'GPS en Tiempo Real',
    description: 'Seguimiento en vivo de tu viaje y conductor. Tus seres queridos siempre saben donde estas.',
  },
  {
    icon: CreditCard,
    title: 'Pagos Seguros',
    description: 'Efectivo, Billetera RIDA, Tarjeta y SINPE Movil. multiples opciones para tu comodidad.',
  },
  {
    icon: AlertTriangle,
    title: 'Boton SOS',
    description: 'En caso de emergencia, un toque activa alertas a contactos de confianza y al equipo RIDA.',
  },
  {
    icon: Headphones,
    title: 'Chat en Vivo',
    description: 'Soporte 24/7 por chat en la app. Resolvemos tus dudas al instante.',
  },
  {
    icon: CalendarDays,
    title: 'Programar Viajes',
    description: 'Agenda tu transporte con anticipacion. Perfecto para vuelos, reuniones o eventos.',
  },
  {
    icon: Wallet,
    title: 'Billetera Digital',
    description: 'Recarga tu saldo, consulta movimientos y paga viajes directamente desde la app.',
  },
];

const safetyFeatures = [
  { icon: ShieldCheck, title: 'Verificacion de identidad', desc: 'Conductores y usuarios verificados con documentos oficiales.' },
  { icon: AlertTriangle, title: 'Boton SOS', desc: 'Emergencia con un solo toque. Alertas inmediatas a contactos.' },
  { icon: Users, title: 'Compartir viaje', desc: 'Tus seres queridos pueden seguir tu viaje en tiempo real.' },
  { icon: Star, title: 'Calificacion mutua', desc: 'Sistema de calificacion que mantiene alta la calidad del servicio.' },
];

/* ------------------------------------------------------------------ */
/*  ANIMATION HELPERS                                                  */
/* ------------------------------------------------------------------ */

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.1, ease: 'easeOut' },
  }),
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.8 } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.12 } },
};

/* ------------------------------------------------------------------ */
/*  SECTION WRAPPER (scroll-triggered)                                 */
/* ------------------------------------------------------------------ */

function Section({ children, className = '', id }: { children: React.ReactNode; className?: string; id?: string }) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <motion.section
      id={id}
      ref={ref}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
      variants={stagger}
      className={className}
    >
      {children}
    </motion.section>
  );
}

/* ------------------------------------------------------------------ */
/*  MAIN PAGE                                                          */
/* ------------------------------------------------------------------ */

export default function Home() {
  return (
    <div className="min-h-screen bg-rida-dark text-white overflow-x-hidden">
      {/* ========== HEADER ========== */}
      <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <motion.a href="/" className="flex items-center gap-3" {...fadeIn} transition={{ duration: 0.5 }}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center glow-cyan">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div className="leading-tight">
              <h1 className="text-lg font-bold text-white glow-text">RIDA</h1>
              <p className="text-[10px] text-cyan-400/70 tracking-widest font-medium">SUPREME SYSTEM</p>
            </div>
          </motion.a>

          <motion.nav
            className="hidden md:flex items-center gap-1"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            {['Como Funciona', 'Apps', 'Seguridad', 'Contacto'].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase().replace(/\s+/g, '-')}`}
                className="px-3 py-2 text-sm text-gray-400 hover:text-cyan-400 transition-colors rounded-lg hover:bg-white/5"
              >
                {item}
              </a>
            ))}
          </motion.nav>

          <motion.div
            className="flex items-center gap-3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <div className="hidden sm:flex items-center gap-2 glass rounded-lg px-3 py-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-emerald-400 font-medium">En Linea</span>
            </div>
            <a
              href="#cta"
              className="btn-neon text-sm font-semibold px-4 py-2 rounded-xl text-white"
            >
              Descargar
            </a>
          </motion.div>
        </div>
      </header>

      {/* ========== HERO SECTION ========== */}
      <section className="relative min-h-screen flex flex-col justify-center pt-20">
        {/* Animated background layers */}
        <div className="absolute inset-0 bg-hero-animated" />
        <div className="absolute inset-0 hero-grid opacity-40" />
        {/* Orbs */}
        <div className="orb w-96 h-96 bg-cyan-500/10 top-1/4 -left-48" />
        <div className="orb w-72 h-72 bg-blue-600/10 bottom-1/4 -right-36" style={{ animationDelay: '-7s' }} />
        <div className="orb w-56 h-56 bg-emerald-500/5 top-1/3 right-1/4" style={{ animationDelay: '-13s' }} />

        {/* CSS particles */}
        {[
          { left: '10%', bottom: '-5%', dur: '12s', delay: '0s', size: '3px' },
          { left: '25%', bottom: '-5%', dur: '16s', delay: '2s', size: '2px' },
          { left: '40%', bottom: '-5%', dur: '14s', delay: '4s', size: '4px' },
          { left: '55%', bottom: '-5%', dur: '18s', delay: '1s', size: '2px' },
          { left: '70%', bottom: '-5%', dur: '13s', delay: '3s', size: '3px' },
          { left: '85%', bottom: '-5%', dur: '15s', delay: '5s', size: '2px' },
          { left: '15%', bottom: '-5%', dur: '20s', delay: '6s', size: '3px' },
          { left: '60%', bottom: '-5%', dur: '17s', delay: '7s', size: '2px' },
          { left: '35%', bottom: '-5%', dur: '19s', delay: '8s', size: '3px' },
          { left: '80%', bottom: '-5%', dur: '11s', delay: '9s', size: '4px' },
        ].map((p, i) => (
          <div
            key={i}
            className="particle"
            style={{
              left: p.left,
              bottom: p.bottom,
              width: p.size,
              height: p.size,
              animationDuration: p.dur,
              animationDelay: p.delay,
            }}
          />
        ))}

        {/* Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 flex-1 flex flex-col justify-center">
          <div className="text-center max-w-3xl mx-auto">
            {/* Badge */}
            <motion.div
              className="inline-flex items-center gap-2 glass rounded-full px-5 py-2 mb-8"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6 }}
            >
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span className="text-sm text-cyan-400 font-medium">Transporte inteligente para Costa Rica</span>
              <Sparkles className="w-4 h-4 text-cyan-400" />
            </motion.div>

            {/* Headline */}
            <motion.h2
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-tight mb-6 tracking-tight"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15 }}
            >
              La forma mas{' '}
              <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-300 bg-clip-text text-transparent">
                inteligente
              </span>
              <br />
              de moverte
            </motion.h2>

            {/* Subheadline */}
            <motion.p
              className="text-base sm:text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
            >
              Solicita viajes, entregas y mas con RIDA. Rapido, seguro y confiable.
              Disponible en todo Costa Rica.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.45 }}
            >
              <a
                href="#cta"
                className="btn-neon group inline-flex items-center gap-3 text-white font-semibold px-8 py-4 rounded-2xl text-base"
              >
                <Download className="w-5 h-5" />
                Descargar App
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </a>
              <a
                href="/driver"
                className="group inline-flex items-center gap-3 glass hover:bg-white/10 text-white font-semibold px-8 py-4 rounded-2xl text-base transition-all duration-300 border border-white/10 hover:border-cyan-500/30"
              >
                <Car className="w-5 h-5 text-cyan-400" />
                Soy Conductor
                <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
              </a>
            </motion.div>
          </div>
        </div>

        {/* Stats Bar */}
        <motion.div
          className="relative z-10 border-t border-white/5 bg-black/30 backdrop-blur-md"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.6 }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="grid grid-cols-3 gap-6 sm:gap-12">
              {heroStats.map((stat, i) => (
                <div key={i} className="text-center">
                  <p className="text-xl sm:text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                    {stat.value}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500 mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      {/* ========== HOW IT WORKS ========== */}
      <Section id="como-funciona" className="relative py-24 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div className="text-center mb-16" variants={fadeUp} custom={0}>
            <p className="text-cyan-400 font-semibold text-sm tracking-widest uppercase mb-3">Como funciona</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Tres pasos y listo
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              Viajar con RIDA es facil, rapido y seguro. En solo tres pasos estas en camino.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Connector lines (desktop) */}
            <div className="hidden md:block absolute top-16 left-[calc(16.67%+2rem)] right-[calc(16.67%+2rem)] h-px">
              <svg width="100%" height="2" className="overflow-visible">
                <line x1="0" y1="1" x2="100%" y2="1" className="dash-animated" stroke="rgba(6,182,212,0.3)" strokeWidth="2" />
              </svg>
            </div>

            {steps.map((step, i) => (
              <motion.div key={i} className="relative text-center group" variants={fadeUp} custom={i + 1}>
                <div className="relative inline-flex items-center justify-center w-32 h-32 mb-6">
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-cyan-500/10 to-blue-600/10 group-hover:from-cyan-500/20 group-hover:to-blue-600/20 transition-all duration-500 rotate-6 group-hover:rotate-12" />
                  <div className="relative w-full h-full glass rounded-3xl flex flex-col items-center justify-center group-hover:glow-cyan transition-all duration-500">
                    <step.icon className="w-8 h-8 text-cyan-400 neon-pulse mb-2" />
                    <span className="text-2xl font-extrabold text-white/20">{step.number}</span>
                  </div>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{step.title}</h3>
                <p className="text-sm text-gray-400 max-w-xs mx-auto leading-relaxed">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* ========== APP SHOWCASE ========== */}
      <Section id="apps" className="relative py-24 sm:py-32">
        {/* Subtle bg accent */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-950/5 to-transparent pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div className="text-center mb-16" variants={fadeUp} custom={0}>
            <p className="text-cyan-400 font-semibold text-sm tracking-widest uppercase mb-3">Nuestras Apps</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Todo lo que necesitas, en un ecosistema
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              Cinco aplicaciones disenadas para cubrir cada aspecto de tu experiencia de transporte y entregas.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 gap-6 lg:gap-8">
            {apps.map((app, i) => (
              <motion.a
                key={app.id}
                href={app.href}
                className="group relative block"
                variants={fadeUp}
                custom={i + 1}
              >
                {/* Card */}
                <div className="glass-strong rounded-3xl p-7 sm:p-8 hover:glow-cyan transition-all duration-500 relative overflow-hidden">
                  {/* Hover gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                  <div className="relative z-10">
                    {/* Top row: icon + arrow */}
                    <div className="flex items-start justify-between mb-5">
                      <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${app.color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-500`}>
                        <app.icon className="w-8 h-8 text-white" />
                      </div>
                      <div className="flex items-center gap-1 text-xs font-medium text-gray-500 group-hover:text-cyan-400 transition-colors">
                        Acceder
                        <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>

                    {/* Text */}
                    <h3 className="text-xl font-bold text-white mb-1 group-hover:text-cyan-50 transition-colors">
                      {app.title}
                    </h3>
                    <p className="text-sm text-cyan-400/70 font-medium mb-3">{app.subtitle}</p>
                    <p className="text-sm text-gray-400 leading-relaxed mb-5">{app.description}</p>

                    {/* Feature chips */}
                    <div className="flex flex-wrap gap-2">
                      {app.features.map((f, j) => (
                        <span
                          key={j}
                          className="inline-flex items-center gap-1.5 bg-white/5 border border-white/5 rounded-full px-3 py-1 text-xs text-gray-400 group-hover:border-cyan-500/20 group-hover:text-gray-300 transition-colors"
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400/70" />
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.a>
            ))}
          </div>
        </div>
      </Section>

      {/* ========== FEATURES GRID ========== */}
      <Section className="relative py-24 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div className="text-center mb-16" variants={fadeUp} custom={0}>
            <p className="text-cyan-400 font-semibold text-sm tracking-widest uppercase mb-3">Caracteristicas</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Disenado para tu comodidad
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              Cada detalle esta pensado para ofrecerte la mejor experiencia de transporte.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feat, i) => (
              <motion.div
                key={i}
                className="group glass rounded-2xl p-6 hover:glow-cyan transition-all duration-500 cursor-default"
                variants={fadeUp}
                custom={i + 1}
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-600/10 flex items-center justify-center mb-4 group-hover:from-cyan-500/20 group-hover:to-blue-600/20 transition-all duration-500">
                  <feat.icon className="w-6 h-6 text-cyan-400 group-hover:scale-110 transition-transform" />
                </div>
                <h3 className="text-base font-bold text-white mb-2">{feat.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{feat.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* ========== SAFETY SECTION ========== */}
      <Section className="relative py-24 sm:py-32 overflow-hidden">
        {/* Background accent */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-950/5 to-transparent pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left: Text */}
            <motion.div variants={fadeUp} custom={0}>
              <p className="text-emerald-400 font-semibold text-sm tracking-widest uppercase mb-3">Seguridad</p>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6 leading-tight">
                Tu seguridad es{' '}
                <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                  nuestra prioridad
                </span>
              </h2>
              <p className="text-gray-400 leading-relaxed mb-8">
                En RIDA implementamos multiples capas de seguridad para que cada viaje sea tranquilo.
                Desde la verificacion de identidad hasta el seguimiento en tiempo real, cada detalle
                esta disenado para protegerte.
              </p>

              {/* WhatsApp contact */}
              <a
                href="https://wa.me/50687838329"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-6 py-4 hover:bg-emerald-500/20 transition-all duration-300 group"
              >
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Phone className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Soporte por WhatsApp</p>
                  <p className="text-sm font-semibold text-emerald-400">(506) 8783-8329</p>
                </div>
              </a>
            </motion.div>

            {/* Right: Safety features grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {safetyFeatures.map((item, i) => (
                <motion.div
                  key={i}
                  className="glass rounded-2xl p-5 hover:bg-white/[0.07] transition-all duration-300"
                  variants={fadeUp}
                  custom={i + 1}
                >
                  <item.icon className="w-8 h-8 text-emerald-400 mb-3" />
                  <h3 className="text-sm font-bold text-white mb-1">{item.title}</h3>
                  <p className="text-xs text-gray-400 leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* ========== CTA SECTION ========== */}
      <Section id="cta" className="relative py-24 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="relative glass-strong rounded-[2rem] p-8 sm:p-12 md:p-16 text-center overflow-hidden"
            variants={fadeUp}
            custom={0}
          >
            {/* Background decorations */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-b from-cyan-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10">
              <motion.div
                className="inline-flex items-center gap-2 glass rounded-full px-5 py-2 mb-8"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
              >
                <Heart className="w-4 h-4 text-cyan-400" />
                <span className="text-sm text-cyan-400 font-medium">Hecho en Costa Rica</span>
              </motion.div>

              <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-6 leading-tight max-w-2xl mx-auto">
                Unete a miles de usuarios que ya confian en{' '}
                <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                  RIDA
                </span>
              </h2>

              <p className="text-gray-400 max-w-xl mx-auto mb-10 text-base sm:text-lg leading-relaxed">
                Descarga la app hoy y descubre por que somos la opcion #1 de transporte inteligente en Costa Rica.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
                <a
                  href="/client"
                  className="btn-neon group inline-flex items-center gap-3 text-white font-semibold px-8 py-4 rounded-2xl text-base"
                >
                  <Download className="w-5 h-5" />
                  Descargar App
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </a>
                <a
                  href="/driver"
                  className="group inline-flex items-center gap-3 bg-white text-rida-dark font-semibold px-8 py-4 rounded-2xl text-base hover:bg-gray-100 transition-all duration-300 shadow-lg hover:shadow-xl"
                >
                  <Car className="w-5 h-5" />
                  Soy Conductor
                </a>
              </div>

              {/* Contact info */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-gray-500">
                <a
                  href="https://wa.me/50687838329"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 hover:text-emerald-400 transition-colors"
                >
                  <Phone className="w-4 h-4" />
                  (506) 8783-8329
                </a>
                <span className="hidden sm:inline text-gray-700">|</span>
                <a
                  href="mailto:soporte@rida.cr"
                  className="inline-flex items-center gap-2 hover:text-cyan-400 transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  soporte@rida.cr
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      </Section>

      {/* ========== FOOTER ========== */}
      <footer className="relative border-t border-white/5 bg-black/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
            {/* Brand */}
            <div className="sm:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center glow-cyan">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <div className="leading-tight">
                  <p className="text-lg font-bold text-white">RIDA</p>
                  <p className="text-[10px] text-cyan-400/70 tracking-widest font-medium">SUPREME SYSTEM</p>
                </div>
              </div>
              <p className="text-sm text-gray-500 leading-relaxed max-w-xs">
                Transporte inteligente, seguro y confiable. Disponible en todo Costa Rica.
              </p>
            </div>

            {/* Apps */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-4">Aplicaciones</h4>
              <ul className="space-y-3">
                {apps.map((app) => (
                  <li key={app.id}>
                    <a href={app.href} className="text-sm text-gray-500 hover:text-cyan-400 transition-colors inline-flex items-center gap-2">
                      <ChevronRight className="w-3 h-3" />
                      {app.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-4">Compania</h4>
              <ul className="space-y-3">
                {['Sobre Nosotros', 'Seguridad', 'Conductores', 'Tarifas'].map((item) => (
                  <li key={item}>
                    <span className="text-sm text-gray-500 hover:text-cyan-400 transition-colors inline-flex items-center gap-2 cursor-pointer">
                      <ChevronRight className="w-3 h-3" />
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-4">Contacto</h4>
              <ul className="space-y-3">
                <li>
                  <a
                    href="https://wa.me/50687838329"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-gray-500 hover:text-emerald-400 transition-colors inline-flex items-center gap-2"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    (506) 8783-8329
                  </a>
                </li>
                <li>
                  <span className="text-sm text-gray-500 inline-flex items-center gap-2">
                    <MessageCircle className="w-3.5 h-3.5" />
                    WhatsApp
                  </span>
                </li>
                <li>
                  <span className="text-sm text-gray-500 inline-flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5" />
                    Costa Rica
                  </span>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="border-t border-white/5 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-gray-600">
              &copy; {new Date().getFullYear()} RIDA SUPREME SYSTEM. Todos los derechos reservados.
            </p>
            <p className="text-xs text-gray-600 inline-flex items-center gap-1">
              Hecho con <Heart className="w-3 h-3 text-red-500 fill-red-500" /> en Costa Rica
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
