'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Home, MapPin, Clock, User as UserIcon, Zap, ArrowLeft, LogOut, Store, Gift } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useCartStore } from '@/store/cartStore';
import AuthGuard from '@/components/AuthGuard';
import { motion, AnimatePresence } from 'framer-motion';
import NotificationPanel from '@/components/NotificationPanel';

const navItems = [
  { icon: Home, label: 'Inicio', href: '/client' },
  { icon: MapPin, label: 'Viaje', href: '/client/ride' },
  { icon: Store, label: 'Market', href: '/client/market', showCartBadge: true },
  { icon: Gift, label: 'Invitar', href: '/client/referral' },
  { icon: UserIcon, label: 'Perfil', href: '/client/profile' },
];

function CartBadge() {
  const itemCount = useCartStore((s) => s.itemCount());
  const count = itemCount;

  if (count === 0) return null;

  return (
    <motion.span
      key={count}
      initial={{ scale: 0.5 }}
      animate={{ scale: 1 }}
      className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-1 border border-[#0a0e1a]"
    >
      {count > 9 ? '9+' : count}
    </motion.span>
  );
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();

  const isAuthPage = pathname?.includes('/client/login') || pathname?.includes('/client/register') || pathname?.includes('/client/recovery');

  return (
    <div className="min-h-screen bg-rida-dark flex flex-col max-w-md mx-auto relative">
      {isAuthPage ? (
        <>{children}</>
      ) : (
        <AuthGuard authPage="/client/login">
          {/* Top Bar */}
          <header className="sticky top-0 z-50 glass-strong border-b border-white/5 px-4 py-3">
            <div className="flex items-center justify-between">
              {pathname !== '/client' ? (
                <button type="button" onClick={() => router.back()} className="p-2 rounded-xl hover:bg-white/5 transition-colors">
                  <ArrowLeft className="w-5 h-5 text-white" />
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-sm font-bold text-white">RIDA</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <NotificationPanel />
                <button type="button" onClick={async () => { await logout(); router.replace('/client/login'); }} className="p-2 rounded-xl hover:bg-white/5 transition-colors">
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

          {/* Bottom Navigation - compacto */}
          <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md glass-strong border-t border-white/10 z-50">
            <div className="flex items-center justify-around px-1" style={{ paddingTop: '2px', paddingBottom: '4px' }}>
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={true}
                    className={`relative flex flex-col items-center gap-0 px-2 py-0.5 rounded-lg transition-all ${
                      isActive ? 'text-cyan-400' : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="client-nav-active"
                        className="absolute inset-0 bg-cyan-500/10 rounded-lg"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                    <div className="relative z-10">
                      <item.icon className="w-4 h-4" />
                      {item.showCartBadge && <CartBadge />}
                    </div>
                    <span className="text-[8px] font-medium relative z-10">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>
        </AuthGuard>
      )}
    </div>
  );
}
