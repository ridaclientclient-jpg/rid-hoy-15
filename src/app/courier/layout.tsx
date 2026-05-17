'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Home, Package, Wallet, User as UserIcon, Zap, ArrowLeft, LogOut, Bell, Menu, X } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import AuthGuard from '@/components/AuthGuard';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  TrendingUp, Trophy, Gift, HelpCircle, ChevronRight,
  MessageSquare, Info as InfoIcon, Bike,
  Star, MapPin, Settings,
} from 'lucide-react';

const navItems = [
  { icon: Home, label: 'Inicio', href: '/courier' },
  { icon: Package, label: 'Entregas', href: '/courier/deliveries' },
  { icon: Wallet, label: 'Ganancias', href: '/courier/earnings' },
  { icon: UserIcon, label: 'Perfil', href: '/courier/profile' },
];

export default function CourierLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifCount, setNotifCount] = useState(0);

  const isAuthPage = pathname?.includes('/courier/login') || pathname?.includes('/courier/register') || pathname?.includes('/courier/recovery');

  const fetchNotifCount = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { count } = await supabase
        .from('app_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      setNotifCount(count || 0);
    } catch {
      // Notifications table might not exist or RLS issue
    }
  }, [user?.id]);

  useEffect(() => {
    fetchNotifCount();
    const interval = setInterval(fetchNotifCount, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifCount]);

  const sidebarMenuItems = [
    { icon: TrendingUp, label: 'Ganancias', desc: 'Tus ingresos', href: '/courier/earnings', badge: null },
    { icon: Trophy, label: 'Premios', desc: 'Recompensas', action: () => toast.info('Premios proximamente'), badge: { text: 'Nuevo', color: 'bg-emerald-500' } },
    { icon: Gift, label: 'Invita amigos', desc: 'Gana bonos', href: '/client/referral', badge: null },
    { icon: HelpCircle, label: 'Ayuda', desc: 'Soporte 24/7', action: () => router.push('/courier/support'), badge: null },
    { icon: MessageSquare, label: 'Notificaciones', desc: notifCount > 0 ? `${notifCount} no leida(s)` : 'Sin novedad', href: '/courier/notifications', badge: notifCount > 0 ? { text: String(notifCount), color: 'bg-red-500' } : null },
    { icon: InfoIcon, label: 'Centro de info', desc: 'Recursos', action: () => toast.info('Centro de informacion proximamente'), badge: null },
    { icon: Bike, label: 'Vehiculo', desc: 'Tu vehiculo de entrega', action: () => toast.info('Configuracion de vehiculo proximamente'), badge: null },
    { icon: Settings, label: 'Configuracion', desc: 'Ajustes de la app', action: () => toast.info('Configuracion proximamente'), badge: null },
  ];

  return (
    <div className="min-h-screen bg-rida-dark flex flex-col max-w-md mx-auto relative">
      {isAuthPage ? (
        <>{children}</>
      ) : (
        <AuthGuard authPage="/courier/login">
          {/* Top Bar */}
          <header className="sticky top-0 z-50 glass-strong border-b border-white/5 px-4 py-3">
            <div className="flex items-center justify-between">
              {pathname !== '/courier' ? (
                <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-white/5 transition-colors">
                  <ArrowLeft className="w-5 h-5 text-white" />
                </button>
              ) : (
                <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-xl hover:bg-white/5 transition-colors">
                  <Menu className="w-5 h-5 text-white" />
                </button>
              )}
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-600 to-orange-500 flex items-center justify-center">
                  <Zap className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-sm font-bold text-white">RIDA</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => router.push('/courier/notifications')}
                  className="relative p-2 rounded-xl hover:bg-white/5 transition-colors"
                >
                  <Bell className="w-5 h-5 text-gray-400" />
                  {notifCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-red-500 text-[9px] text-white font-bold flex items-center justify-center px-1">
                      {notifCount > 99 ? '99+' : notifCount}
                    </span>
                  )}
                </button>
                <button onClick={async () => { toast.success('Sesion cerrada'); await logout(); router.replace('/courier/login'); }} className="p-2 rounded-xl hover:bg-white/5 transition-colors">
                  <LogOut className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>
          </header>

          {/* Content */}
          <main className="flex-1 pb-20 overflow-y-auto">
            <AnimatePresence mode="wait">
              {children}
            </AnimatePresence>
          </main>

          {/* Bottom Navigation */}
          <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md glass-strong border-t border-white/10 z-50">
            <div className="flex items-center justify-around py-2 px-2">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <button
                    key={item.href}
                    onClick={() => { if (pathname !== item.href) router.push(item.href); }}
                    className={`relative flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-xl transition-all ${
                      isActive ? 'text-orange-400' : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="courier-nav-active"
                        className="absolute inset-0 bg-orange-500/10 rounded-xl"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                    <item.icon className="w-5 h-5 relative z-10" />
                    <span className="text-[10px] font-medium relative z-10">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Sidebar Overlay */}
          <AnimatePresence>
            {sidebarOpen && (
              <>
                <motion.div
                  className="fixed inset-0 bg-black/60 z-[60]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setSidebarOpen(false)}
                />
                <motion.div
                  className="fixed top-0 left-0 h-full w-72 bg-[#0d1117] border-r border-white/10 z-[70] flex flex-col"
                  initial={{ x: -300 }}
                  animate={{ x: 0 }}
                  exit={{ x: -300 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                >
                  {/* Sidebar Header - Profile */}
                  <div className="p-5 border-b border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-600 to-orange-500 flex items-center justify-center text-xl font-bold text-white flex-shrink-0">
                        {user?.name?.charAt(0) || 'R'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-base font-bold text-white truncate">{user?.name || 'Repartidor'}</p>
                        <p className="text-xs text-gray-400 truncate">{user?.email || ''}</p>
                      </div>
                    </div>
                    <button onClick={() => setSidebarOpen(false)} className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/5">
                      <X className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>

                  {/* Sidebar Menu */}
                  <nav className="flex-1 py-3 overflow-y-auto">
                    {sidebarMenuItems.map((item, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setSidebarOpen(false);
                          if (item.href) router.push(item.href);
                          else item.action?.();
                        }}
                        className="w-full flex items-center gap-3 px-5 py-3 hover:bg-white/5 transition-colors"
                      >
                        <item.icon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                        <div className="flex-1 text-left">
                          <p className="text-sm text-white">{item.label}</p>
                          <p className="text-[10px] text-gray-500">{item.desc}</p>
                        </div>
                        {item.badge && (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold text-white ${item.badge.color}`}>
                            {item.badge.text}
                          </span>
                        )}
                        <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
                      </button>
                    ))}
                  </nav>

                  {/* Sidebar Footer */}
                  <div className="p-4 border-t border-white/5">
                    <button
                      onClick={async () => {
                        setSidebarOpen(false);
                        toast.success('Sesion cerrada');
                        await logout();
                        router.replace('/courier/login');
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <LogOut className="w-5 h-5" />
                      <span>Cerrar sesion</span>
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </AuthGuard>
      )}
    </div>
  );
}
