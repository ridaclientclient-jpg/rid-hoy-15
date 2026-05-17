'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard, Users, Car, MapPin, DollarSign,
  BarChart3, FileText, Settings, Store, Package,
  ShoppingCart, Truck, MessageSquare, Receipt, Star,
  Siren, ShieldAlert, Trophy, Building2, MapPinned,
  Tag, CarFront, Grid3X3, Image, Eye, Flame, Map,
  UserCog, BookOpen, ChevronDown, ChevronRight,
  Shield, Search, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface GuideItem {
  id: string;
  icon: any;
  label: string;
  href: string;
  color: string;
  summary: string;
  steps: string[];
  tips: string[];
}

const guides: GuideItem[] = [
  {
    id: 'dashboard',
    icon: LayoutDashboard,
    label: 'Dashboard',
    href: '/admin',
    color: 'from-blue-600 to-cyan-500',
    summary: 'Vista general del sistema. Muestra estadísticas en tiempo real sobre viajes activos, usuarios, conductores, ingresos del día y alertas pendientes.',
    steps: [
      'Al entrar al panel admin, el Dashboard es la primera pantalla que ves',
      'Revisa los números principales: viajes del día, usuarios activos, conductores en línea',
      'Las tarjetas superiores muestran datos clave del negocio',
      'Si ves alertas rojas, significa que hay SOS activos o reportes sin revisar',
      'Puedes hacer clic en cualquier estadística para ver más detalles'
    ],
    tips: [
      'Visita el Dashboard al inicio de cada turno para ver el estado general',
      'Si el contador de viajes activos es alto, puede haber mucha demanda'
    ]
  },
  {
    id: 'users',
    icon: Users,
    label: 'Usuarios',
    href: '/admin/users',
    color: 'from-purple-600 to-pink-500',
    summary: 'Gestión completa de todos los usuarios del sistema: clientes, conductores, vendedores y repartidores. Puedes buscar, filtrar y administrar cuentas.',
    steps: [
      'Aquí ves la lista completa de todos los usuarios registrados en la app',
      'Usa la barra de búsqueda para encontrar un usuario por nombre o correo',
      'Filtra por rol (cliente, conductor, vendedor, repartidor) usando los botones',
      'Haz clic en un usuario para ver su perfil completo, historial de viajes y estado',
      'Puedes verificar documentos, cambiar roles o suspender cuentas si es necesario'
    ],
    tips: [
      'Antes de suspender una cuenta, revisa los reportes asociados al usuario',
      'Los usuarios verificados tienen un check verde junto a su nombre'
    ]
  },
  {
    id: 'drivers',
    icon: Car,
    label: 'Conductores',
    href: '/admin/drivers',
    color: 'from-green-600 to-emerald-500',
    summary: 'Panel dedicado a la gestión de conductores. Revisa documentos de verificación, aprueba solicitudes, calificaciones y estado operativo de cada conductor.',
    steps: [
      'Lista todos los conductores registrados con su estado actual (online, offline, busy, suspended)',
      'Los conductores pendientes de verificación aparecen con una etiqueta amarilla',
      'Haz clic en "Ver" para revisar los documentos del conductor (licencia, fotos del vehículo, etc.)',
      'Puedes aprobar o rechazar documentos con un motivo',
      'Para suspender un conductor, selecciónalo y elige "Suspender" — se desactiva su cuenta',
      'Revisa las calificaciones promedio de cada conductor para mantener la calidad del servicio'
    ],
    tips: [
      'Un conductor con calificación menor a 4.0 debería ser revisado',
      'Verifica que la foto del vehículo coincida con la placa registrada',
      'Los conductores suspendidos no pueden recibir viajes nuevos'
    ]
  },
  {
    id: 'rides',
    icon: MapPin,
    label: 'Viajes',
    href: '/admin/rides',
    color: 'from-orange-600 to-amber-500',
    summary: 'Historial y gestión de todos los viajes realizados en la plataforma. Filtra por estado, fecha, conductor o cliente para analizar el servicio.',
    steps: [
      'Muestra todos los viajes con su estado actual: buscando, asignado, en camino, en curso, completado o cancelado',
      'Filtra por estado usando los botones superiores para ver solo los viajes que te interesan',
      'Usa la búsqueda para encontrar un viaje por ID, nombre del cliente o del conductor',
      'Haz clic en un viaje para ver los detalles completos: origen, destino, precio, duración, calificación',
      'Si un viaje tiene un reporte asociado, aparecerá un indicador rojo',
      'Puedes ver la ruta recorrida y el mapa del viaje completado'
    ],
    tips: [
      'Los viajes cancelados frecuentemente por el mismo conductor pueden indicar un problema',
      'Revisa los viajes con precio anormalmente alto o bajo'
    ]
  },
  {
    id: 'pricing',
    icon: DollarSign,
    label: 'Pricing',
    href: '/admin/pricing',
    color: 'from-emerald-600 to-teal-500',
    summary: 'Configuración de precios del servicio. Ajusta la tarifa base, precio por kilómetro, precio por minuto, comisión de la plataforma y precios por tipo de vehículo.',
    steps: [
      'Aquí defines cuánto cuesta cada viaje según la distancia y el tiempo',
      'Tarifa base: es el precio mínimo que paga el cliente al iniciar un viaje',
      'Precio por km: cuánto se cobra por cada kilómetro recorrido',
      'Precio por minuto: cuánto se cobra por cada minuto de duración del viaje',
      'Comisión: porcentaje que la plataforma retiene de cada viaje (el resto va al conductor)',
      'Puedes configurar precios diferentes para cada tipo de vehículo (auto, moto, camioneta, etc.)',
      'Los cambios se guardan automáticamente y aplican a los NUEVOS viajes (los ya en curso no cambian)'
    ],
    tips: [
      'La moneda usada es Colones Costarricenses (CRC)',
      'No subas los precios demasiado alto o los clientes usarán otras apps',
      'Revisa la competencia para mantener precios competitivos'
    ]
  },
  {
    id: 'analytics',
    icon: BarChart3,
    label: 'Analytics',
    href: '/admin/analytics',
    color: 'from-indigo-600 to-violet-500',
    summary: 'Estadísticas y gráficas detalladas del rendimiento del negocio. Viajes por día, ingresos, crecimiento de usuarios, tiempos promedio y métricas clave.',
    steps: [
      'Muestra gráficas de viajes, ingresos y usuarios a lo largo del tiempo',
      'Selecciona el rango de fechas para ver datos de un período específico',
      'Las gráficas principales muestran la tendencia de viajes e ingresos',
      'Desplázate hacia abajo para ver métricas detalladas por categoría',
      'Puedes exportar los datos si necesitas reportes externos'
    ],
    tips: [
      'Compara los fines de semana con los días entre semana para ver patrones',
      'Si los ingresos bajan, revisa si hay problemas con conductores o precios'
    ]
  },
  {
    id: 'reports',
    icon: FileText,
    label: 'Reportes',
    href: '/admin/reports',
    color: 'from-red-600 to-rose-500',
    summary: 'Sistema de reportes y quejas de usuarios. Los clientes y conductores pueden reportar incidentes, fraude, quejas o emergencias SOS durante un viaje.',
    steps: [
      'Aquí llegan todos los reportes hechos por usuarios y conductores',
      'Los reportes tienen estados: pendiente, en revisión, resuelto, descartado',
      'Haz clic en un reporte para ver los detalles completos: quién lo reportó, por qué, qué viaje era',
      'Si el reporte tiene imágenes, puedes verlas para entender mejor la situación',
      'Cambia el estado a "En revisión" cuando empieces a investigar',
      'Una vez resuelto, cambia a "Resuelto" y agrega una resolución',
      'Para reportes falsos o sin fundamento, márcalos como "Descartado"'
    ],
    tips: [
      'Los reportes de tipo SOS son prioridad — atiéndelos primero',
      'Los reportes de fraude requieren revisión cuidadosa antes de tomar acción',
      'Si un usuario tiene muchos reportes, puede ser necesario suspender su cuenta'
    ]
  },
  {
    id: 'marketplace',
    icon: Store,
    label: 'Marketplace',
    href: '/admin/marketplace',
    color: 'from-yellow-600 to-orange-500',
    summary: 'Centro comercial dentro de la app. Gestiona tiendas, productos y pedidos de los vendedores registrados. Los clientes pueden comprar productos y un repartidor los lleva.',
    steps: [
      'Gestiona todas las tiendas (vendedores) del marketplace',
      'Revisa y aprueba solicitudes de nuevos vendedores',
      'Supervisa los productos que cada tienda tiene publicado',
      'Gestiona los pedidos: pendientes, en camino, entregados o cancelados',
      'Desde aquí también puedes acceder a Vendedores, Productos y Pedidos individualmente'
    ],
    tips: [
      'Aprueba solo vendedores con documentación completa',
      'Revisa periódicamente los precios de los productos para evitar fraudes'
    ]
  },
  {
    id: 'vendors',
    icon: Users,
    label: 'Vendedores',
    href: '/admin/marketplace/vendors',
    color: 'from-teal-600 to-cyan-500',
    summary: 'Gestión individual de vendedores del marketplace. Aprobación de tiendas, verificación de documentos y control de vendedores activos.',
    steps: [
      'Lista todos los vendedores con su estado: pendiente, aprobado, rechazado',
      'Revisa la documentación de cada vendedor antes de aprobar',
      'Puedes ver las estadísticas de ventas de cada vendedor',
      'Para rechazar un vendedor, indica el motivo del rechazo',
      'Los vendedores aprobados aparecen en la app de clientes'
    ],
    tips: [
      'Verifica que la información fiscal del vendedor sea correcta',
      'Un vendedor con malas calificaciones puede afectar al marketplace'
    ]
  },
  {
    id: 'products',
    icon: Package,
    label: 'Productos',
    href: '/admin/marketplace/products',
    color: 'from-sky-600 to-blue-500',
    summary: 'Catálogo de productos del marketplace. Revisa, aprueba o rechaza productos que los vendedores publican. Controla la calidad de lo que se vende en la app.',
    steps: [
      'Muestra todos los productos publicados por los vendedores',
      'Filtra por categoría, vendedor o estado de aprobación',
      'Revisa la imagen, descripción y precio del producto',
      'Puedes aprobar, rechazar o solicitar cambios al vendedor',
      'Productos rechazados no aparecen en la app de clientes'
    ],
    tips: [
      'Verifica que las imágenes correspondan al producto real',
      'Los precios deben estar en Colones Costarricenses'
    ]
  },
  {
    id: 'orders',
    icon: ShoppingCart,
    label: 'Pedidos MKT',
    href: '/admin/marketplace/orders',
    color: 'from-fuchsia-600 to-pink-500',
    summary: 'Gestión de pedidos del marketplace. Seguimiento de cada pedido desde que se hace hasta que se entrega al cliente.',
    steps: [
      'Lista todos los pedidos del marketplace con su estado actual',
      'Los estados son: pendiente, aceptado, preparando, en camino, entregado, cancelado',
      'Filtra por estado para ver solo los pedidos que necesitas atender',
      'Haz clic en un pedido para ver los detalles: productos, cliente, vendedor, repartidor',
      'Si hay un problema con un pedido, puedes cancelarlo o reasignar el repartidor'
    ],
    tips: [
      'Los pedidos pendientes deberían ser atendidos rápidamente',
      'Si un pedido tarda más de lo normal, contacta al repartidor'
    ]
  },
  {
    id: 'payment-report',
    icon: Receipt,
    label: 'Reporte Pagos',
    href: '/admin/payment-report',
    color: 'from-lime-600 to-green-500',
    summary: 'Reporte financiero detallado. Muestra todos los pagos, comisiones, retiros y movimientos de dinero en la plataforma.',
    steps: [
      'Muestra un resumen de ingresos totales de la plataforma',
      'Desglose de comisiones retenidas de conductores y vendedores',
      'Lista de retiros solicitados por conductores y vendedores',
      'Filtra por fecha para ver los pagos de un período específico',
      'Puedes ver el historial completo de transacciones'
    ],
    tips: [
      'Revisa los retiros pendientes y apruébalos rápidamente',
      'Los montos están en Colones Costarricenses'
    ]
  },
  {
    id: 'reviews',
    icon: Star,
    label: 'Resenas',
    href: '/admin/reviews',
    color: 'from-amber-600 to-yellow-500',
    summary: 'Calificaciones y reseñas que dejan los clientes y conductores después de cada viaje. Monitorea la satisfacción del servicio.',
    steps: [
      'Lista todas las reseñas y calificaciones del sistema',
      'Filtra por calificación (1-5 estrellas) para ver las buenas o malas',
      'Lee las reseñas con calificación baja para identificar problemas',
      'Puedes responder a las reseñas si es necesario',
      'Las calificaciones promedio aparecen en el perfil de cada conductor'
    ],
    tips: [
      'Una calificación de 1 estrella con descripción merece investigación',
      'Si un conductor tiene promedio bajo, comunícate con él para mejorar'
    ]
  },
  {
    id: 'sos',
    icon: Siren,
    label: 'SOS Alertas',
    href: '/admin/driver-alerts',
    color: 'from-red-700 to-red-500',
    summary: 'Alertas de emergencia SOS activadas por usuarios o conductores durante un viaje. Estas son PRIORIDAD MÁXIMA y deben atenderse de inmediato.',
    steps: [
      'Las alertas SOS aparecen aquí cuando un usuario presiona el botón de emergencia',
      'Cada alerta muestra la ubicación GPS del usuario, el viaje en curso y la hora',
      'Haz clic en "Ver ubicación" para abrir el mapa con la posición exacta',
      'Si es una emergencia real, contacta a las autoridades locales (911)',
      'Una vez resuelta, marca la alerta como resuelta y agrega un resumen de lo sucedido',
      'Las alertas sin resolver aparecen con un badge rojo brillante'
    ],
    tips: [
      'NUNCA ignores una alerta SOS — es prioridad máxima',
      'Ten el número de emergencias (911) siempre a la mano',
      'Practica el protocolo de respuesta a emergencias regularmente'
    ]
  },
  {
    id: 'anti-fraud',
    icon: ShieldAlert,
    label: 'Anti-Fraude',
    href: '/admin/anti-fraud',
    color: 'from-gray-600 to-slate-500',
    summary: 'Sistema de detección y prevención de fraude. Monitorea actividades sospechosas como cuentas falsas, viajes fraudulentos, reembolsos anómalos y más.',
    steps: [
      'Muestra alertas de posibles fraudes detectados automáticamente por el sistema',
      'Filtra por tipo de fraude: cuenta falsa, viaje sospechoso, reembolso anómalo, etc.',
      'Revisa cada alerta y determina si es fraude real o un falso positivo',
      'Para fraudes confirmados, toma acción: suspender cuenta, bloquear usuario, etc.',
      'Los fraudes resueltos quedan en el historial para auditoría'
    ],
    tips: [
      'Revisa las alertas de anti-fraude al menos una vez al día',
      'Si un usuario tiene múltiples alertas de fraude, es probable que sea una cuenta fraudulenta'
    ]
  },
  {
    id: 'couriers',
    icon: Truck,
    label: 'Repartidores',
    href: '/admin/couriers',
    color: 'from-cyan-600 to-sky-500',
    summary: 'Gestión de repartidores del marketplace. Verifica documentos, aprueba solicitudes y monitorea el rendimiento de los repartidores.',
    steps: [
      'Lista todos los repartidores registrados en el sistema',
      'Revisa su estado: activo, inactivo, suspendido',
      'Verifica documentos del repartidor (identificación, etc.)',
      'Aprueba o rechaza solicitudes de nuevos repartidores',
      'Monitorea la cantidad de entregas completadas y las calificaciones'
    ],
    tips: [
      'Un repartidor con muchas entregas canceladas necesita revisión',
      'Mantén un buen número de repartidores activos para los picos de demanda'
    ]
  },
  {
    id: 'chat',
    icon: MessageSquare,
    label: 'Chat Soporte',
    href: '/admin/chat',
    color: 'from-blue-500 to-indigo-500',
    summary: 'Sistema de mensajería para dar soporte a usuarios y conductores. Chatea en tiempo real para resolver dudas, problemas o emergencias.',
    steps: [
      'Muestra todas las conversaciones activas de soporte',
      'Haz clic en una conversación para ver los mensajes y responder',
      'Puedes ver el perfil del usuario con el que estás chateando',
      'Responde rápidamente para mantener una buena experiencia de usuario',
      'Cierra la conversación cuando el problema esté resuelto'
    ],
    tips: [
      'Sé amable y profesional en todas las respuestas',
      'Si un usuario reporta un problema técnico, pide capturas de pantalla'
    ]
  },
  {
    id: 'rewards',
    icon: Trophy,
    label: 'Recompensas',
    href: '/admin/rewards',
    color: 'from-yellow-500 to-amber-500',
    summary: 'Sistema de recompensas y gamificación para conductores. Configura metas, bonos y premios para motivar a los conductores a dar mejor servicio.',
    steps: [
      'Configura las recompensas que los conductores pueden ganar',
      'Define metas: cantidad de viajes, calificación promedio, etc.',
      'Establece los premios por cumplir metas (bonos en dinero, insignias, etc.)',
      'Revisa el ranking de conductores y sus logros',
      'Puedes crear recompensas temporales (por ejemplo, bono de fin de semana)'
    ],
    tips: [
      'Las recompensas motivan a los conductores a mejorar su servicio',
      'Revisa las estadísticas de las recompensas para ver cuáles funcionan mejor'
    ]
  },
  {
    id: 'organizations',
    icon: Building2,
    label: 'Organizaciones',
    href: '/admin/organizations',
    color: 'from-stone-600 to-neutral-500',
    summary: 'Gestión de organizaciones empresariales. Empresas que tienen flotas de conductores o cuentas corporativas para sus empleados.',
    steps: [
      'Lista todas las organizaciones registradas en el sistema',
      'Revisa los detalles de cada organización: nombre, contacto, número de miembros',
      'Puedes crear nuevas organizaciones o editar las existentes',
      'Administra los conductores y usuarios que pertenecen a cada organización',
      'Gestiona los planes corporativos y tarifas especiales'
    ],
    tips: [
      'Las organizaciones pueden tener tarifas especiales negociadas',
      'Mantén comunicación regular con los contactos de cada organización'
    ]
  },
  {
    id: 'locations',
    icon: MapPinned,
    label: 'Areas Geo.',
    href: '/admin/locations',
    color: 'from-green-500 to-teal-500',
    summary: 'Definición de áreas geográficas operativas. Configura las zonas donde el servicio está disponible, tarifas por zona y cobertura del servicio.',
    steps: [
      'Define las áreas geográficas donde opera el servicio',
      'Puedes crear, editar o eliminar zonas de cobertura',
      'Configura tarifas especiales por zona si es necesario',
      'Las zonas se muestran en un mapa interactivo',
      'Los viajes solo pueden iniciarse dentro de las zonas configuradas'
    ],
    tips: [
      'Empieza con una zona pequeña y ve expandiendo conforme crezca la demanda',
      'Revisa regularmente si hay zonas sin cobertura que tengan demanda'
    ]
  },
  {
    id: 'promo-codes',
    icon: Tag,
    label: 'Codigos Promo',
    href: '/admin/promo-codes',
    color: 'from-pink-500 to-rose-500',
    summary: 'Creación y gestión de códigos promocionales. Ofrece descuentos a usuarios para atraer nuevos clientes o recompensar a los existentes.',
    steps: [
      'Crea nuevos códigos promocionales con descuento en porcentaje o monto fijo',
      'Configura la fecha de inicio y fin de la promoción',
      'Define cuántas veces puede usarse el código (por usuario o en total)',
      'Puedes limitar el código a usuarios nuevos o a usuarios existentes',
      'Monitorea cuántas veces se ha usado cada código y el descuento total otorgado'
    ],
    tips: [
      'Usa códigos cortos y fáciles de recordar para mejor adopción',
      'Ofrece promociones en fechas especiales (día de la madre, navidad, etc.)',
      'Los descuentos se aplican en Colones Costarricenses'
    ]
  },
  {
    id: 'vehicle-types',
    icon: CarFront,
    label: 'Tipos Vehiculo',
    href: '/admin/vehicle-types',
    color: 'from-violet-500 to-purple-500',
    summary: 'Configuración de los tipos de vehículos disponibles en la plataforma. Define las categorías: auto, moto, camioneta, lujo, etc.',
    steps: [
      'Lista todos los tipos de vehículos disponibles para los clientes',
      'Crea nuevos tipos de vehículo con nombre, descripción e imagen',
      'Configura el precio base y multiplicador para cada tipo',
      'Define la capacidad de pasajeros para cada tipo de vehículo',
      'Activa o desactiva tipos de vehículo según la disponibilidad'
    ],
    tips: [
      'Los tipos de vehículo más populares deberían estar al inicio de la lista',
      'Agrega una imagen representativa para cada tipo'
    ]
  },
  {
    id: 'service-categories',
    icon: Grid3X3,
    label: 'Cat. Servicio',
    href: '/admin/services/categories',
    color: 'from-slate-500 to-gray-500',
    summary: 'Categorías de servicio disponibles. Organiza los diferentes tipos de servicios que ofrece la plataforma (viaje, delivery, courier, etc.).',
    steps: [
      'Lista las categorías de servicio activas',
      'Crea nuevas categorías según las necesidades del negocio',
      'Configura iconos y colores para cada categoría',
      'Activa o desactiva categorías según la temporada o demanda'
    ],
    tips: [
      'Mantén las categorías organizadas y con nombres claros',
      'No tengas demasiadas categorías activas al mismo tiempo'
    ]
  },
  {
    id: 'banners',
    icon: Image,
    label: 'Banners',
    href: '/admin/banners',
    color: 'from-rose-500 to-pink-500',
    summary: 'Gestión de banners promocionales que se muestran en la app. Crea publicidad para ofertas, eventos o anuncios importantes.',
    steps: [
      'Sube imágenes de banners que se mostrarán en la app de clientes',
      'Configura el enlace al que dirige el banner (una promoción, sección, etc.)',
      'Define la fecha de inicio y fin de publicación del banner',
      'Activa o desactiva banners según la campaña',
      'Puedes tener múltiples banners activos que se rotan en la app'
    ],
    tips: [
      'Usa imágenes de alta calidad con texto legible',
      'Los banners deben ser atractivos pero no demasiado pesados para no frenar la app'
    ]
  },
  {
    id: 'geo-map',
    icon: Map,
    label: 'Mapa Zonas',
    href: '/admin/geo-map',
    color: 'from-emerald-500 to-green-500',
    summary: 'Mapa interactivo de zonas geográficas. Visualiza las áreas de cobertura, zonas con alta demanda y distribución de conductores en tiempo real.',
    steps: [
      'Muestra un mapa interactivo con las zonas configuradas',
      'Visualiza la cobertura del servicio en tiempo real',
      'Identifica zonas con alta demanda (colores más intensos)',
      'Puedes dibujar nuevas zonas directamente en el mapa',
      'Las zonas se superponen con la ubicación de conductores activos'
    ],
    tips: [
      'Úsalo junto con el Heat Map para identificar oportunidades de expansión',
      'Revisa las zonas sin conductores para mejorar la cobertura'
    ]
  },
  {
    id: 'gods-view',
    icon: Eye,
    label: "God's View",
    href: '/admin/gods-view',
    color: 'from-cyan-500 to-blue-500',
    summary: 'Vista en tiempo real de todos los conductores y viajes activos en el mapa. Es como ver toda la operación desde arriba.',
    steps: [
      'Muestra el mapa en tiempo real con la posición de TODOS los conductores activos',
      'Los puntos verdes son conductores disponibles, los naranjas están ocupados',
      'Puedes ver los viajes en curso con la ruta del conductor al cliente',
      'Haz clic en un conductor para ver su información completa',
      'Haz clic en un viaje para ver los detalles del servicio',
      'Actualiza la vista para obtener los datos más recientes'
    ],
    tips: [
      'Usa esta vista para ver la cobertura de conductores en tiempo real',
      'Si ves zonas sin conductores, puede ser necesario activar más'
    ]
  },
  {
    id: 'heat-map',
    icon: Flame,
    label: 'Heat Map',
    href: '/admin/heat-map',
    color: 'from-red-500 to-orange-500',
    summary: 'Mapa de calor que muestra dónde hay más demanda de viajes. Las zonas rojas son de alta demanda y las azules de baja demanda.',
    steps: [
      'Muestra un mapa de calor con la concentración de solicitudes de viaje',
      'Las zonas rojas/amarillas indican ALTA demanda — muchos usuarios buscando viaje',
      'Las zonas azules/verdes indican BAJA demanda — pocos viajes solicitados',
      'Filtra por fecha y hora para ver patrones de demanda',
      'Usa esta información para decidir dónde poner más conductores'
    ],
    tips: [
      'Revisa el heat map en horas pico para ver los patrones de demanda',
      'Las zonas rojas sin conductores suficientes son oportunidades perdidas'
    ]
  },
  {
    id: 'leaderboard',
    icon: Trophy,
    label: 'Leaderboard',
    href: '/admin/leaderboard',
    color: 'from-yellow-500 to-orange-500',
    summary: 'Ranking de los mejores conductores de la plataforma. Basado en calificación, cantidad de viajes y earnings. Motiva la competencia sana.',
    steps: [
      'Muestra el ranking de conductores por diferentes métricas',
      'Filtra por: mejores calificados, más viajes, más ganancias, etc.',
      'Puedes ver el ranking por semana, mes o todo el tiempo',
      'Los top 3 conductores aparecen destacados en la parte superior',
      'Usa este panel para identificar a los conductores estrella'
    ],
    tips: [
      'Reconoce a los conductores del top para mantener su motivación',
      'Los conductores del leaderboard pueden ser embajadores de la marca'
    ]
  },
  {
    id: 'settings',
    icon: Settings,
    label: 'Configuración',
    href: '/admin/settings',
    color: 'from-gray-600 to-zinc-500',
    summary: 'Configuración general del sistema. Ajustes de la plataforma, modos de mantenimiento, registro de usuarios y otras opciones globales.',
    steps: [
      'Ajustes generales de la plataforma',
      'Activa o desactiva el modo mantenimiento (bloquea la app temporalmente)',
      'Configura si el registro de nuevos usuarios está abierto o cerrado',
      'Ajusta el límite de intentos de login antes de bloquear una cuenta',
      'Configura montos mínimos de retiro y límites diarios',
      'Los cambios se guardan automáticamente en la base de datos'
    ],
    tips: [
      'Solo cambia la configuración si sabes lo que haces — afecta toda la app',
      'Si la app tiene problemas, activa el modo mantenimiento temporalmente',
      'Pide permiso al Super Admin antes de cambiar configuraciones críticas'
    ]
  },
  {
    id: 'admins',
    icon: UserCog,
    label: 'Admins',
    href: '/admin/admins',
    color: 'from-red-600 to-red-400',
    summary: 'Panel exclusivo del SUPER ADMIN. Gestión de cuentas de administradores: crear, bloquear, desbloquear y eliminar admins. Solo visible para el Super Admin.',
    steps: [
      'Solo el Super Admin (kardellridclient@outlook.com) puede ver este panel',
      'Lista todos los administradores del sistema con su estado',
      'Para CREAR un nuevo admin: llena nombre, correo y contraseña temporal',
      'Para BLOQUEAR un admin: selecciona "Bloquear" y agrega el motivo — no podrá entrar',
      'Para DESBLOQUEAR un admin: selecciona "Desbloquear" — podrá entrar de nuevo',
      'Para ELIMINAR un admin: selecciona "Eliminar" — pierde acceso de admin (se vuelve cliente)',
      'El historial de todas las acciones queda registrado en el log de actividades'
    ],
    tips: [
      'Solo crea admins de confianza — tienen acceso a datos sensibles',
      'Si un admin ya no trabaja contigo, ELIMINA su acceso inmediatamente',
      'NUNCA compartas tu contraseña de Super Admin con nadie'
    ]
  }
];

const categories = [
  { label: 'General', ids: ['dashboard', 'users', 'drivers', 'rides', 'pricing'] },
  { label: 'Marketplace', ids: ['marketplace', 'vendors', 'products', 'orders', 'couriers'] },
  { label: ' Finanzas', ids: ['payment-report', 'promo-codes'] },
  { label: 'Soporte', ids: ['reports', 'sos', 'anti-fraud', 'chat', 'reviews'] },
  { label: 'Mapas', ids: ['gods-view', 'heat-map', 'geo-map', 'locations'] },
  { label: 'Marketing', ids: ['banners', 'rewards', 'leaderboard', 'organizations'] },
  { label: 'Configuración', ids: ['vehicle-types', 'service-categories', 'settings', 'admins'] },
];

export default function AyudaPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filteredGuides = guides.filter(g => {
    const matchesSearch = !searchTerm ||
      g.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.summary.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !activeCategory || categories.find(c => c.label === activeCategory)?.ids.includes(g.id);
    return matchesSearch && matchesCategory;
  });

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Centro de Ayuda</h1>
            <p className="text-sm text-gray-400">Guía completa de cada panel del sistema administrativo</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar panel o función..."
          className="w-full pl-12 pr-12 py-3 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Category Filters */}
      <div className="flex flex-wrap gap-2 mb-8">
        <button
          onClick={() => setActiveCategory(null)}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            !activeCategory
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
              : 'bg-white/5 text-gray-400 border border-white/10 hover:text-white hover:bg-white/10'
          }`}
        >
          Todos
        </button>
        {categories.map(cat => (
          <button
            key={cat.label}
            onClick={() => setActiveCategory(activeCategory === cat.label ? null : cat.label)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeCategory === cat.label
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'bg-white/5 text-gray-400 border border-white/10 hover:text-white hover:bg-white/10'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Guide Cards */}
      <div className="space-y-3">
        {filteredGuides.map((guide, idx) => {
          const isExpanded = expandedId === guide.id;
          const Icon = guide.icon;

          return (
            <motion.div
              key={guide.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
            >
              <div
                onClick={() => toggleExpand(guide.id)}
                className={`cursor-pointer rounded-2xl border transition-all duration-300 ${
                  isExpanded
                    ? 'bg-white/5 border-cyan-500/30 shadow-lg shadow-cyan-500/5'
                    : 'bg-white/[0.02] border-white/5 hover:bg-white/5 hover:border-white/10'
                }`}
              >
                {/* Card Header */}
                <div className="flex items-center gap-4 p-4">
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${guide.color} flex items-center justify-center flex-shrink-0`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-white">{guide.label}</h3>
                      {guide.id === 'admins' && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                          Solo Super Admin
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400 mt-0.5 line-clamp-1">{guide.summary}</p>
                  </div>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all flex-shrink-0 ${
                    isExpanded ? 'bg-cyan-500/20 text-cyan-400 rotate-180' : 'bg-white/5 text-gray-500'
                  }`}>
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>

                {/* Expanded Content */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-5 pt-1 border-t border-white/5">
                        {/* Steps */}
                        <div className="mb-5">
                          <h4 className="text-sm font-semibold text-cyan-400 mb-3 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                            Como usar este panel
                          </h4>
                          <ol className="space-y-2.5">
                            {guide.steps.map((step, i) => (
                              <li key={i} className="flex gap-3 text-sm">
                                <span className="w-6 h-6 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5">
                                  {i + 1}
                                </span>
                                <span className="text-gray-300 leading-relaxed">{step}</span>
                              </li>
                            ))}
                          </ol>
                        </div>

                        {/* Tips */}
                        {guide.tips.length > 0 && (
                          <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-4">
                            <h4 className="text-sm font-semibold text-amber-400 mb-2 flex items-center gap-2">
                              <span className="text-base">&#9888;</span>
                              Consejos importantes
                            </h4>
                            <ul className="space-y-2">
                              {guide.tips.map((tip, i) => (
                                <li key={i} className="flex gap-2 text-sm text-amber-200/70">
                                  <span className="text-amber-400 mt-1">&#8226;</span>
                                  <span>{tip}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Link to panel */}
                        <div className="mt-4">
                          <Link
                            href={guide.href}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-sm font-medium hover:from-cyan-500 hover:to-blue-500 transition-all shadow-lg shadow-cyan-500/20"
                          >
                            Ir al panel de {guide.label}
                            <ChevronRight className="w-4 h-4" />
                          </Link>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* No results */}
      {filteredGuides.length === 0 && (
        <div className="text-center py-16">
          <Search className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">No se encontraron resultados</p>
          <p className="text-gray-500 text-sm mt-1">Intenta con otro término de búsqueda</p>
        </div>
      )}

      {/* Footer info */}
      <div className="mt-10 p-5 rounded-2xl bg-white/[0.02] border border-white/5">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="text-sm font-semibold text-white mb-1">Información de seguridad</h4>
            <p className="text-sm text-gray-400 leading-relaxed">
              Si tienes dudas sobre algo que no aparece en esta guía, contacta al Super Admin.
              No compartas tu contraseña con nadie y cierra tu sesión al terminar tu turno.
              Todas las acciones que realizas en el panel quedan registradas en el sistema.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
