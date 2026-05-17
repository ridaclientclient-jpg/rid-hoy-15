'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, LayoutDashboard, Users, Car, MapPin, DollarSign,
  BarChart3, FileText, Settings, LogOut, ChevronLeft, Zap,
  Menu, X, Store, Package, ShoppingCart, Truck, MessageSquare,
  Receipt, Star, AlertTriangle, Trophy, Building2, MapPinned,
  Tag, CarFront, Grid3X3, Image, Eye, Flame, Map, UserCog, Siren, ShieldAlert, BookOpen, HelpCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import AuthGuard from '@/components/AuthGuard';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Usuarios', icon: Users },
  { href: '/admin/drivers', label: 'Conductores', icon: Car },
  { href: '/admin/rides', label: 'Viajes', icon: MapPin },
  { href: '/admin/pricing', label: 'Pricing', icon: DollarSign },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/admin/reports', label: 'Reportes', icon: FileText },
  { href: '/admin/marketplace', label: 'Marketplace', icon: Store },
  { href: '/admin/marketplace/vendors', label: 'Vendedores', icon: Users },
  { href: '/admin/marketplace/products', label: 'Productos', icon: Package },
  { href: '/admin/marketplace/orders', label: 'Pedidos MKT', icon: ShoppingCart },
  { href: '/admin/payment-report', label: 'Reporte Pagos', icon: Receipt },
  { href: '/admin/reviews', label: 'Resenas', icon: Star },
  { href: '/admin/driver-alerts', label: 'SOS Alertas', icon: Siren },
  { href: '/admin/anti-fraud', label: 'Anti-Fraude', icon: ShieldAlert },
  { href: '/admin/couriers', label: 'Repartidores', icon: Truck },
  { href: '/admin/chat', label: 'Chat Soporte', icon: MessageSquare },
  { href: '/admin/rewards', label: 'Recompensas', icon: Trophy },
  { href: '/admin/organizations', label: 'Organizaciones', icon: Building2 },
  { href: '/admin/locations', label: 'Areas Geo.', icon: MapPinned },
  { href: '/admin/promo-codes', label: 'Codigos Promo', icon: Tag },
  { href: '/admin/vehicle-types', label: 'Tipos Vehiculo', icon: CarFront },
  { href: '/admin/services/categories', label: 'Cat. Servicio', icon: Grid3X3 },
  { href: '/admin/banners', label: 'Banners', icon: Image },
  { href: '/admin/geo-map', label: 'Mapa Zonas', icon: Map },
  { href: '/admin/gods-view', label: "God's View", icon: Eye },
  { href: '/admin/heat-map', label: 'Heat Map', icon: Flame },
  { href: '/admin/leaderboard', label: 'Leaderboard', icon: Trophy },
  { href: '/admin/settings', label: 'Configuración', icon: Settings },
  { href: '/admin/admins', label: 'Admins', icon: UserCog, superAdminOnly: true },
  { href: '/admin/ayuda', label: 'Ayuda', icon: BookOpen, isHelp: true },
];

function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    // Using a timeout to avoid the strict sync setState rule
    const id = requestAnimationFrame(() => setHydrated(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return hydrated;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const hydrated = useHydrated();

  const publicPaths = ['/admin/login', '/admin/register', '/admin/recovery'];
  const isPublicPath = publicPaths.includes(pathname);

  // Don't show sidebar on public pages (AuthGuard handles auth redirects)
  if (isPublicPath) {
    return <>{children}</>;
  }

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Sesión cerrada');
    } catch (err) {
      console.error('Logout error:', err);
    }
    // Force full page navigation to ensure clean state
    window.location.href = '/admin/login';
  };

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin';
    return pathname.startsWith(href);
  };

  // Section separator keys — items that start a new visual group
  const sectionBreaks = ['/admin/marketplace', '/admin/driver-alerts', '/admin/settings'];

  return (
    <AuthGuard requiredRole="admin" authPage="/admin/login">
    <div className="min-h-screen bg-[#09090b] flex">
      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 h-screen z-50 flex flex-col transition-all duration-300 ease-out ${
          collapsed ? 'w-[78px]' : 'w-64'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} bg-[#0c0e14]/95 backdrop-blur-2xl border-r border-white/[0.06]`}
      >
        {/* Logo */}
        <div className="px-5 py-5 flex items-center justify-between border-b border-white/[0.06]">
          <Link href="/admin" className="flex items-center gap-3.5 overflow-hidden">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-500 via-cyan-400 to-orange-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-cyan-500/20">
              <Shield className="w-6 h-6 text-white" />
            </div>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="whitespace-nowrap"
              >
                <h1 className="text-[17px] font-extrabold tracking-tight text-white">
                  RIDA<span className="text-orange-400">.</span>
                </h1>
                <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-[0.2em] mt-0.5">Admin Panel</p>
              </motion.div>
            )}
          </Link>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex w-8 h-8 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] items-center justify-center text-gray-500 hover:text-gray-300 transition-all duration-200 border border-white/[0.04]"
          >
            <ChevronLeft className={`w-4 h-4 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} />
          </button>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden w-8 h-8 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-gray-500 hover:text-gray-300 transition-all duration-200 border border-white/[0.04]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-5 px-3 space-y-1.5 overflow-y-auto scrollbar-none">
          {navItems.map((item: any, idx: number) => {
            // Hide super_admin-only items if user is not super_admin
            if (item.superAdminOnly && user?.role !== 'super_admin') return null;

            const active = isActive(item.href);
            const isSuperBadge = item.superAdminOnly;
            const isHelp = item.isHelp;

            // Add separator before help item
            const showSeparator = isHelp && idx > 0 && !navItems[idx - 1]?.isHelp;
            // Section separators for visual grouping
            const isSectionBreak = sectionBreaks.includes(item.href) && idx > 0;
            return (
              <div key={item.href}>
                {(showSeparator || isSectionBreak) && (
                  <div className="!my-2.5 pt-2.5 border-t border-white/[0.04]" />
                )}
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`relative flex items-center gap-3 px-3 py-3 rounded-xl text-[13px] font-medium transition-all duration-200 group ${
                    active
                      ? 'text-orange-300'
                      : isHelp
                        ? 'text-amber-500/60 hover:text-amber-400 hover:bg-amber-500/[0.06]'
                        : 'text-gray-500 hover:text-gray-200 hover:bg-white/[0.04]'
                  }`}
                >
                  {active && (
                    <motion.div
                      layoutId="admin-nav-active"
                      className={`absolute inset-0 rounded-xl ${
                        isHelp
                          ? 'bg-gradient-to-r from-amber-500/15 to-amber-500/[0.03]'
                          : 'bg-gradient-to-r from-orange-500/15 via-orange-500/[0.08] to-transparent'
                      }`}
                      style={{ boxShadow: isHelp ? 'none' : 'inset 3px 0 0 0 rgba(249,115,22,0.6)' }}
                      transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
                    />
                  )}
                  <item.icon className={`w-[18px] h-[18px] flex-shrink-0 relative z-10 transition-colors duration-200 ${
                    active
                      ? (isHelp ? 'text-amber-400' : 'text-orange-400')
                      : isHelp
                        ? 'text-amber-500/40 group-hover:text-amber-400'
                        : 'text-gray-600 group-hover:text-gray-300'
                  }`} />
                  {!collapsed && (
                    <span className="relative z-10 whitespace-nowrap">{item.label}</span>
                  )}
                  {!collapsed && isSuperBadge && (
                    <span className="relative z-10 ml-auto px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-red-500/15 text-red-400 border border-red-500/20">
                      Super
                    </span>
                  )}
                  {active && !collapsed && !isSuperBadge && !isHelp && (
                    <div className="relative z-10 ml-auto w-1.5 h-1.5 rounded-full bg-orange-400 shadow-sm shadow-orange-400/50" />
                  )}
                </Link>
              </div>
            );
          })}
        </nav>

        {/* User & Logout */}
        <div className="p-3 border-t border-white/[0.06]">
          {!collapsed && (
            <div className="flex items-center gap-3 px-3 py-3 mb-2 rounded-xl bg-white/[0.02]">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center flex-shrink-0 shadow-md shadow-orange-500/20">
                <span className="text-xs font-bold text-white">
                  {user?.name?.charAt(0)?.toUpperCase() || 'A'}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white font-semibold truncate leading-tight">{user?.name}</p>
                <p className="text-[11px] text-gray-500 truncate mt-0.5">{user?.email}</p>
              </div>
            </div>
          )}
          {collapsed && (
            <div className="flex justify-center mb-2">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-md shadow-orange-500/20">
                <span className="text-xs font-bold text-white">
                  {user?.name?.charAt(0)?.toUpperCase() || 'A'}
                </span>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-[13px] font-medium text-gray-500 hover:text-red-400 hover:bg-red-500/[0.08] transition-all duration-200 group"
          >
            <LogOut className="w-[18px] h-[18px] flex-shrink-0 text-gray-600 group-hover:text-red-400 transition-colors" />
            {!collapsed && <span>Cerrar sesión</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-[#09090b]/80 backdrop-blur-2xl px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden w-10 h-10 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-gray-400 hover:text-white transition-all duration-200 border border-white/[0.04]"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-emerald-500/[0.08] border border-emerald-500/10">
              <div className="relative">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-400 animate-ping opacity-75" />
              </div>
              <span className="text-[11px] text-emerald-400 font-semibold tracking-wide">Sistema Online</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06]">
              <Zap className="w-3 h-3 text-orange-400/70" />
              <span className="text-[11px] text-gray-500 font-medium">v1.0.0</span>
            </div>
          </div>
          {/* Gradient bottom line */}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
    </AuthGuard>
  );
}
