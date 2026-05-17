'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Store, LayoutDashboard, Package, Grid3X3, ShoppingCart,
  Upload, User, LogOut, Menu, X
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import AuthGuard from '@/components/AuthGuard';
import { toast } from 'sonner';

const navItems = [
  { label: 'Dashboard', href: '/marketplace', icon: LayoutDashboard, exact: true },
  { label: 'Productos', href: '/marketplace/products', icon: Package },
  { label: 'Categorías', href: '/marketplace/categories', icon: Grid3X3 },
  { label: 'Pedidos', href: '/marketplace/orders', icon: ShoppingCart },
  { label: 'CSV Import', href: '/marketplace/import', icon: Upload },
  { label: 'Perfil', href: '/marketplace/profile', icon: User },
];

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isPublicPage = pathname === '/marketplace/login' || pathname === '/marketplace/recovery';

  const handleLogout = async () => {
    toast.success('Sesión cerrada');
    await logout();
    router.replace('/marketplace/login');
  };

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  // Login and recovery pages: no sidebar
  if (isPublicPage) {
    return <>{children}</>;
  }

  // Protected pages: show loading or content based on auth
  return (
    <AuthGuard requiredRole="vendor" authPage="/marketplace/login">
    <div className="min-h-screen mp-marketplace flex">
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            className="fixed inset-0 bg-black/40 z-40 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-56 bg-white border-r border-gray-200 flex flex-col transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo */}
        <div className="p-5 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-md">
                <Store className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold text-gray-900">RIDA MARKET</h1>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Marketplace</p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-gray-400 hover:text-gray-900"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const active = isActive(item.href, item.exact);
            return (
              <motion.button
                key={item.href}
                onClick={() => {
                  router.push(item.href);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
                  active
                    ? 'bg-green-50 text-green-700 shadow-[inset_0_0_0_1px_rgba(6,193,103,0.2)]'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }`}
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
              >
                <item.icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-green-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                <span className="flex-1 text-left">{item.label}</span>
                {active && (
                  <motion.div
                    layoutId="sidebar-active-indicator"
                    className="w-1.5 h-1.5 rounded-full bg-green-500"
                  />
                )}
              </motion.button>
            );
          })}
        </nav>

        {/* User & Logout */}
        <div className="p-3 border-t border-gray-200">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white text-xs font-bold">
              {user?.name?.charAt(0) || 'V'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900 font-medium truncate">{user?.name || 'Vendedor'}</p>
              <p className="text-[10px] text-gray-500 truncate">{user?.email || ''}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-500 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0">
        {/* Top bar (mobile) */}
        <header className="lg:hidden sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b border-gray-200 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-500 hover:text-gray-900"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Store className="w-5 h-5 text-green-600" />
            <span className="text-sm font-semibold text-gray-900">RIDA MARKET</span>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Online
          </div>
        </header>

        {/* Page content */}
        <div className="p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
    </AuthGuard>
  );
}
