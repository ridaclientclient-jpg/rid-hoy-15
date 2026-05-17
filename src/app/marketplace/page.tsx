'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  ShoppingCart,
  DollarSign,
  Package,
  Star,
  TrendingUp,
  Clock,
  ArrowRight,
  Plus,
  Upload,
  User,
  BarChart3,
  Store,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useVendorId } from '@/hooks/useVendorId';
import { supabase, type VendorWallet, type Product, type Delivery, type Vendor } from '@/lib/supabase';
import { toast } from 'sonner';

/* ══════════════════════════════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════════════════════════════ */

function formatCRC(amount: number): string {
  return `₡${Math.round(amount).toLocaleString('es-CR')}`;
}

function relativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return 'Ahora';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  if (diffHr < 24) return `Hace ${diffHr}h`;
  if (diffDay < 7) return `Hace ${diffDay}d`;
  return date.toLocaleDateString('es-CR', { day: '2-digit', month: 'short' });
}

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-CR', { weekday: 'short', day: '2-digit' });
}

/* ══════════════════════════════════════════════════════════════════
   CONSTANTS
   ══════════════════════════════════════════════════════════════════ */

const statusLabel: Record<string, string> = {
  pending: 'Pendiente',
  assigned: 'Asignado',
  picked_up: 'Recogido',
  in_transit: 'En camino',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

const statusColors: Record<string, string> = {
  pending: 'bg-orange-50 text-orange-500 border-orange-200',
  assigned: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  picked_up: 'bg-purple-50 text-purple-600 border-purple-500/30',
  in_transit: 'bg-green-50 text-green-600 border-green-200',
  delivered: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  cancelled: 'bg-red-500/15 text-red-400 border-red-500/30',
};

const categoryColorMap: Record<string, string> = {
  farmacia: 'bg-emerald-500',
  food: 'bg-amber-500',
  comida: 'bg-amber-500',
  stores: 'bg-blue-500',
  tiendas: 'bg-blue-500',
  other: 'bg-purple-500',
  otro: 'bg-purple-500',
  bebidas: 'bg-cyan-500',
  snacks: 'bg-orange-500',
  cuidado_personal: 'bg-pink-500',
  limpieza: 'bg-teal-500',
  suplementos: 'bg-lime-500',
  medicina: 'bg-red-500',
};

const categoryLabelMap: Record<string, string> = {
  farmacia: 'Farmacia',
  food: 'Comida',
  comida: 'Comida',
  stores: 'Tiendas',
  tiendas: 'Tiendas',
  other: 'Otro',
  otro: 'Otro',
  bebidas: 'Bebidas',
  snacks: 'Snacks',
  cuidado_personal: 'Cuidado Personal',
  limpieza: 'Limpieza',
  suplementos: 'Suplementos',
  medicina: 'Medicina',
};

/* ══════════════════════════════════════════════════════════════════
   ANIMATION VARIANTS
   ══════════════════════════════════════════════════════════════════ */

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  },
};

/* ══════════════════════════════════════════════════════════════════
   TYPES
   ══════════════════════════════════════════════════════════════════ */

interface DashboardStats {
  totalProducts: number;
  ordersToday: number;
  totalRevenue: number;
  availableBalance: number;
  pendingOrders: number;
  rating: number;
}

interface RevenueDay {
  date: string;
  label: string;
  total: number;
}

interface TopProduct {
  id: string;
  name: string;
  category: string;
  price: number;
  sold_count: number;
  revenue: number;
}

interface RecentOrder {
  id: string;
  shortId: string;
  customer: string;
  total: number;
  status: string;
  createdAt: string;
}

interface CategoryCount {
  name: string;
  count: number;
  color: string;
  percentage: number;
}

/* ══════════════════════════════════════════════════════════════════
   LOADING SKELETON
   ══════════════════════════════════════════════════════════════════ */

function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="h-8 w-72 bg-gray-100 rounded-lg" />
          <div className="h-4 w-48 bg-gray-100 rounded-lg mt-3" />
        </div>
        <div className="h-10 w-44 bg-gray-100 rounded-xl" />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="glass rounded-2xl p-5">
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-gray-100" />
              <div className="w-6 h-6 rounded-full bg-gray-100" />
            </div>
            <div className="h-7 w-24 bg-gray-100 rounded-lg" />
            <div className="h-3 w-20 bg-gray-100 rounded mt-2" />
          </div>
        ))}
      </div>

      {/* Revenue chart + Category */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass rounded-2xl p-6">
          <div className="h-5 w-36 bg-gray-100 rounded-lg mb-6" />
          <div className="flex items-end gap-3 h-44">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div
                  className="w-full bg-gray-100 rounded-t-lg"
                  style={{ height: `${30 + Math.random() * 60}%` }}
                />
                <div className="h-3 w-8 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        </div>
        <div className="glass rounded-2xl p-6">
          <div className="h-5 w-28 bg-gray-100 rounded-lg mb-6" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <div className="h-3 w-20 bg-gray-100 rounded" />
                <div className="h-3 w-8 bg-gray-100 rounded" />
              </div>
              <div className="h-2.5 w-full bg-gray-100 rounded-full" />
            </div>
          ))}
        </div>
      </div>

      {/* Top Products + Quick Actions */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass rounded-2xl p-6">
          <div className="h-5 w-32 bg-gray-100 rounded-lg mb-5" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-3 rounded-xl mb-2">
              <div className="w-8 h-8 rounded-lg bg-gray-100" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-36 bg-gray-100 rounded" />
                <div className="h-3 w-20 bg-gray-100 rounded" />
              </div>
              <div className="h-4 w-16 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
        <div className="glass rounded-2xl p-6">
          <div className="h-5 w-28 bg-gray-100 rounded-lg mb-5" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 rounded-xl mb-3" />
          ))}
        </div>
      </div>

      {/* Recent Orders */}
      <div className="glass rounded-2xl p-6">
        <div className="h-5 w-40 bg-gray-100 rounded-lg mb-5" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-3 border-b border-gray-100">
            <div className="h-4 w-20 bg-gray-100 rounded" />
            <div className="h-4 w-24 bg-gray-100 rounded" />
            <div className="flex-1" />
            <div className="h-5 w-20 bg-gray-100 rounded-full" />
            <div className="h-4 w-16 bg-gray-100 rounded" />
            <div className="h-4 w-14 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════════ */

export default function MarketplaceDashboard() {
  const { user } = useAuthStore();
  const router = useRouter();
  const { vendorId, loading: vendorLoading, error: vendorError } = useVendorId();

  const [loading, setLoading] = useState(true);
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    ordersToday: 0,
    totalRevenue: 0,
    availableBalance: 0,
    pendingOrders: 0,
    rating: 0,
  });
  const [revenueDays, setRevenueDays] = useState<RevenueDay[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [categories, setCategories] = useState<CategoryCount[]>([]);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  /* ── Fetch all dashboard data ──────────────────────────────── */
  const fetchDashboard = useCallback(
    async (showToast = false) => {
      if (!vendorId) return;

      try {
        setLoading(true);

        // ── 1. Vendor info ──
        const { data: vendorData } = await supabase
          .from('vendors')
          .select('*')
          .eq('id', vendorId)
          .single();

        if (vendorData) {
          setVendor(vendorData as Vendor);
        }

        // ── 2. Vendor Wallet ──
        const { data: wallet } = await supabase
          .from('vendor_wallets')
          .select('balance, total_earned')
          .eq('vendor_id', vendorId)
          .single();

        // ── 3. Total products count ──
        const { count: totalProducts } = await supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('vendor_id', vendorId);

        // ── 4. Orders today ──
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const { count: ordersToday } = await supabase
          .from('deliveries')
          .select('id', { count: 'exact', head: true })
          .eq('vendor_id', vendorId)
          .gte('created_at', todayStart.toISOString());

        // ── 5. Pending orders ──
        const { count: pendingOrders } = await supabase
          .from('deliveries')
          .select('id', { count: 'exact', head: true })
          .eq('vendor_id', vendorId)
          .eq('status', 'pending');

        // ── 6. Revenue chart (last 7 days, delivered) ──
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const { data: weekDeliveries } = await supabase
          .from('deliveries')
          .select('id, total, created_at')
          .eq('vendor_id', vendorId)
          .eq('status', 'delivered')
          .gte('created_at', sevenDaysAgo.toISOString());

        // Group by date
        const dayMap: Record<string, number> = {};
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const key = d.toISOString().slice(0, 10);
          dayMap[key] = 0;
        }

        if (weekDeliveries) {
          for (const del of weekDeliveries) {
            const key = new Date(del.created_at).toISOString().slice(0, 10);
            if (key in dayMap) {
              dayMap[key] += Number(del.total) || 0;
            }
          }
        }

        const revenueData: RevenueDay[] = Object.entries(dayMap).map(
          ([date, total]) => ({
            date,
            label: dayLabel(date),
            total,
          }),
        );
        setRevenueDays(revenueData);

        // ── 7. Top products (by sold_count) ──
        const { data: topProductsData } = await supabase
          .from('products')
          .select('id, name, category, price, sold_count')
          .eq('vendor_id', vendorId)
          .order('sold_count', { ascending: false })
          .limit(5);

        const mappedTop: TopProduct[] = (topProductsData || []).map((p) => ({
          id: p.id,
          name: p.name,
          category: categoryLabelMap[p.category?.toLowerCase()] || p.category || 'Otro',
          price: Number(p.price),
          sold_count: p.sold_count || 0,
          revenue: Number(p.price) * (p.sold_count || 0),
        }));
        setTopProducts(mappedTop);

        // ── 8. All products for category distribution ──
        const { data: allProducts } = await supabase
          .from('products')
          .select('category')
          .eq('vendor_id', vendorId);

        if (allProducts && allProducts.length > 0) {
          const catMap: Record<string, number> = {};
          for (const p of allProducts) {
            const cat = (p.category || 'otro').toLowerCase();
            catMap[cat] = (catMap[cat] || 0) + 1;
          }
          const total = allProducts.length;
          const catEntries = Object.entries(catMap)
            .sort((a, b) => b[1] - a[1])
            .map(([cat, count]) => ({
              name: categoryLabelMap[cat] || cat,
              count,
              color: categoryColorMap[cat] || 'bg-gray-500',
              percentage: Math.round((count / total) * 100),
            }));
          setCategories(catEntries);
        } else {
          setCategories([]);
        }

        // ── 9. Recent orders (last 5) ──
        const { data: recentData, error: recentError } = await supabase
          .from('deliveries')
          .select('id, total, status, created_at, profiles!deliveries_customer_id_fkey(name)')
          .eq('vendor_id', vendorId)
          .order('created_at', { ascending: false })
          .limit(5);

        if (recentError) {
          console.error('Recent orders error:', recentError);
        } else {
          const orders: RecentOrder[] = (recentData || []).map((d) => {
            const profileData = d.profiles as { name?: string } | null;
            return {
              id: d.id,
              shortId: `#${d.id.slice(0, 8)}`,
              customer: profileData?.name || 'Cliente',
              total: Number(d.total) || 0,
              status: d.status,
              createdAt: d.created_at,
            };
          });
          setRecentOrders(orders);
        }

        // ── Set stats ──
        setStats({
          totalProducts: totalProducts ?? 0,
          ordersToday: ordersToday ?? 0,
          totalRevenue: wallet?.total_earned ?? 0,
          availableBalance: wallet?.balance ?? 0,
          pendingOrders: pendingOrders ?? 0,
          rating: vendorData?.rating ?? 5,
        });

        setLastRefresh(new Date());
        if (showToast) {
          toast.success('Dashboard actualizado');
        }
      } catch (err) {
        console.error('Dashboard fetch error:', err);
        toast.error('Error al cargar el dashboard');
      } finally {
        setLoading(false);
      }
    },
    [vendorId],
  );

  /* ── Initial load + auto-refresh ────────────────────────────── */
  useEffect(() => {
    if (!vendorId) {
      if (!vendorLoading) setLoading(false);
      return;
    }

    fetchDashboard();

    // Auto-refresh every 60s
    refreshTimerRef.current = setInterval(() => {
      fetchDashboard();
    }, 60_000);

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [vendorId, vendorLoading, fetchDashboard]);

  /* ── Realtime subscription ──────────────────────────────────── */
  useEffect(() => {
    if (!vendorId) return;

    const channel = supabase
      .channel(`vendor-dashboard-${vendorId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'deliveries',
          filter: `vendor_id=eq.${vendorId}`,
        },
        (payload) => {
          console.log('[Realtime] Delivery change:', payload.eventType);
          if (payload.eventType === 'INSERT') {
            toast.info('¡Nuevo pedido recibido!');
          }
          // Refresh stats on any change
          fetchDashboard();
        },
      )
      .subscribe();

    realtimeChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [vendorId, fetchDashboard]);

  /* ── Stat cards config ──────────────────────────────────────── */
  const statCards = useMemo(
    () => [
      {
        label: 'Total Productos',
        value: stats.totalProducts.toString(),
        icon: Package,
        gradient: 'from-green-500 to-green-600',
        ring: 'ring-green-100',
      },
      {
        label: 'Pedidos Hoy',
        value: stats.ordersToday.toString(),
        icon: ShoppingCart,
        gradient: 'from-orange-500 to-amber-500',
        ring: 'ring-orange-100',
      },
      {
        label: 'Ganancias Totales',
        value: formatCRC(stats.totalRevenue),
        icon: DollarSign,
        gradient: 'from-emerald-500 to-green-600',
        ring: 'ring-emerald-500/20',
      },
      {
        label: 'Balance Disponible',
        value: formatCRC(stats.availableBalance),
        icon: TrendingUp,
        gradient: 'from-green-500 to-emerald-600',
        ring: 'ring-green-100',
      },
      {
        label: 'Pedidos Pendientes',
        value: stats.pendingOrders.toString(),
        icon: Clock,
        gradient: 'from-yellow-500 to-amber-500',
        ring: 'ring-yellow-100',
      },
      {
        label: 'Rating',
        value: stats.rating.toFixed(1),
        icon: Star,
        gradient: 'from-amber-400 to-yellow-400',
        ring: 'ring-orange-100',
        extra: <span className="text-[10px] text-orange-400">/ 5.0</span>,
      },
    ],
    [stats],
  );

  /* ── Quick actions ──────────────────────────────────────────── */
  const quickActions = useMemo(
    () => [
      {
        label: 'Agregar Producto',
        icon: Plus,
        href: '/marketplace/products',
        color: 'from-green-500 to-green-600',
        hover: 'hover:shadow-[0_4px_12px_rgba(6,193,103,0.15)]',
      },
      {
        label: 'Ver Pedidos',
        icon: ShoppingCart,
        href: '/marketplace/orders',
        color: 'from-orange-500 to-amber-500',
        hover: 'hover:shadow-[0_4px_12px_rgba(255,107,0,0.15)]',
      },
      {
        label: 'Importar CSV',
        icon: Upload,
        href: '/marketplace/import',
        color: 'from-purple-500 to-pink-500',
        hover: 'hover:shadow-[0_4px_12px_rgba(168,85,247,0.15)]',
      },
      {
        label: 'Mi Perfil',
        icon: User,
        href: '/marketplace/profile',
        color: 'from-gray-500 to-gray-600',
        hover: 'hover:shadow-[0_4px_12px_rgba(107,114,128,0.15)]',
      },
    ],
    [],
  );

  /* ── Revenue chart helpers ──────────────────────────────────── */
  const maxRevenue = useMemo(
    () => Math.max(...revenueDays.map((d) => d.total), 1),
    [revenueDays],
  );

  /* ── Loading / Error ────────────────────────────────────────── */
  if (vendorLoading || loading) return <DashboardSkeleton />;

  if (vendorError) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Store className="w-14 h-14 text-gray-300 mb-4" />
        <p className="text-gray-500 text-sm">{vendorError}</p>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════════ */
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* ─── Header ─────────────────────────────────────────── */}
      <motion.div
        variants={itemVariants}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
            Dashboard{' '}
            <span className="bg-gradient-to-r from-green-500 to-orange-500 bg-clip-text text-transparent">
              Marketplace
            </span>
          </h1>
          <p className="text-gray-500 text-sm mt-1.5">
            Bienvenido, {vendor?.store_name || user?.name || 'Vendedor'}. Aquí está tu resumen.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchDashboard(true)}
            className="glass rounded-xl px-4 py-2.5 text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors flex items-center gap-2"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Actualizar
          </button>
          <div className="text-[10px] text-gray-300 hidden sm:block">
            {lastRefresh.toLocaleTimeString('es-CR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </div>
      </motion.div>

      {/* ─── Stats Cards (2x3) ─────────────────────────────── */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-2 lg:grid-cols-3 gap-4"
      >
        <AnimatePresence>
          {statCards.map((stat, i) => (
            <motion.div
              key={stat.label}
              className="glass rounded-2xl p-5 group hover:glow-cyan transition-all duration-300 cursor-default"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.1 + i * 0.06, duration: 0.4 }}
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center shadow-lg ring-4 ${stat.ring}`}
                >
                  <stat.icon className="w-5 h-5 text-white" />
                </div>
                {stat.extra || null}
              </div>
              <p className="text-2xl font-bold text-gray-900 tracking-tight">
                {stat.value}
              </p>
              <p className="text-xs text-gray-400 mt-1.5">{stat.label}</p>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      {/* ─── Revenue Chart + Category Distribution ──────────── */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Revenue Chart (last 7 days) */}
        <motion.div
          variants={itemVariants}
          className="lg:col-span-2 glass rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Ingresos</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Últimos 7 días · Pedidos entregados
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-green-600">
              <BarChart3 className="w-3.5 h-3.5" />
              {formatCRC(revenueDays.reduce((s, d) => s + d.total, 0))}
            </div>
          </div>

          {/* Bar Chart */}
          <div className="flex items-end gap-2 sm:gap-3 h-44">
            {revenueDays.map((day, i) => {
              const heightPct = maxRevenue > 0 ? (day.total / maxRevenue) * 100 : 4;
              const isToday = i === revenueDays.length - 1;
              return (
                <div
                  key={day.date}
                  className="flex-1 flex flex-col items-center gap-2 min-w-0"
                >
                  {/* Amount tooltip */}
                  <div className="text-[10px] text-gray-400 font-medium truncate w-full text-center">
                    {day.total > 0 ? formatCRC(day.total) : ''}
                  </div>
                  {/* Bar */}
                  <div className="w-full flex-1 flex items-end">
                    <motion.div
                      className={`w-full rounded-t-lg ${
                        isToday
                          ? 'bg-gradient-to-t from-green-600 to-green-400 shadow-[0_0_12px_rgba(6,193,103,0.3)]'
                          : 'bg-gradient-to-t from-gray-200 to-gray-100 hover:from-green-600/30 hover:to-green-400/20'
                      } transition-colors duration-300`}
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max(heightPct, 4)}%` }}
                      transition={{
                        delay: 0.3 + i * 0.06,
                        duration: 0.6,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      title={`${day.label}: ${formatCRC(day.total)}`}
                    />
                  </div>
                  {/* Label */}
                  <span
                    className={`text-[10px] ${
                      isToday ? 'text-green-600 font-semibold' : 'text-gray-400'
                    }`}
                  >
                    {day.label}
                  </span>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Category Distribution */}
        <motion.div variants={itemVariants} className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Categorías</h2>
              <p className="text-xs text-gray-400 mt-0.5">Distribución</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-gray-400" />
            </div>
          </div>

          <div className="space-y-4">
            {categories.length === 0 ? (
              <div className="text-center py-10">
                <BarChart3 className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Sin categorías</p>
              </div>
            ) : (
              categories.map((cat, i) => (
                <motion.div
                  key={cat.name}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.06 }}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2.5 h-2.5 rounded-full ${cat.color}`}
                      />
                      <span className="text-sm text-gray-600">{cat.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">
                        {cat.percentage}%
                      </span>
                      <span className="text-sm font-semibold text-gray-900">
                        {cat.count}
                      </span>
                    </div>
                  </div>
                  <div className="h-2 bg-gray-50 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${cat.color}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${cat.percentage}%` }}
                      transition={{
                        delay: 0.6 + i * 0.08,
                        duration: 0.8,
                        ease: 'easeOut',
                      }}
                    />
                  </div>
                </motion.div>
              ))
            )}
          </div>

          {/* Quick category stats */}
          {categories.length > 0 && (
            <div className="mt-6 pt-5 border-t border-gray-200 grid grid-cols-2 gap-3">
              <div className="text-center">
                <p className="text-xl font-bold text-gray-900">{stats.totalProducts}</p>
                <p className="text-[10px] text-gray-400">Total SKUs</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-gray-900">
                  {categories.length}
                </p>
                <p className="text-[10px] text-gray-400">Categorías</p>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* ─── Top Products + Quick Actions ───────────────────── */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Top Products Table */}
        <motion.div
          variants={itemVariants}
          className="lg:col-span-2 glass rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Top Productos
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Los más vendidos
              </p>
            </div>
            <button
              onClick={() => router.push('/marketplace/products')}
              className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1.5 transition-colors font-medium"
            >
              Ver todos
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left text-xs font-medium text-gray-400 pb-3 pr-3">
                    #
                  </th>
                  <th className="text-left text-xs font-medium text-gray-400 pb-3 pr-3">
                    Producto
                  </th>
                  <th className="text-left text-xs font-medium text-gray-400 pb-3 pr-3">
                    Categoría
                  </th>
                  <th className="text-right text-xs font-medium text-gray-400 pb-3 pr-3">
                    Precio
                  </th>
                  <th className="text-right text-xs font-medium text-gray-400 pb-3 pr-3">
                    Vendidos
                  </th>
                  <th className="text-right text-xs font-medium text-gray-400 pb-3">
                    Ingresos
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {topProducts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-10 text-center text-sm text-gray-400"
                    >
                      <Package className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      Sin datos de ventas aún
                    </td>
                  </tr>
                ) : (
                  topProducts.map((product, i) => (
                    <motion.tr
                      key={product.id}
                      className="hover:bg-gray-50 transition-colors cursor-pointer group"
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + i * 0.05 }}
                      onClick={() => router.push('/marketplace/products')}
                    >
                      <td className="py-3 pr-3">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                            i === 0
                              ? 'bg-orange-50 text-orange-500'
                              : i === 1
                                ? 'bg-gray-400/20 text-gray-600'
                                : i === 2
                                  ? 'bg-orange-600/20 text-orange-400'
                                  : 'bg-gray-50 text-gray-400'
                          }`}
                        >
                          {i + 1}
                        </div>
                      </td>
                      <td className="py-3 pr-3">
                        <p className="text-sm font-medium text-gray-900 group-hover:text-green-700 transition-colors truncate max-w-[180px]">
                          {product.name}
                        </p>
                      </td>
                      <td className="py-3 pr-3">
                        <span className="text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded-md">
                          {product.category}
                        </span>
                      </td>
                      <td className="py-3 pr-3 text-right text-sm text-gray-600">
                        {formatCRC(product.price)}
                      </td>
                      <td className="py-3 pr-3 text-right">
                        <span className="text-sm font-semibold text-emerald-600">
                          {product.sold_count}
                        </span>
                      </td>
                      <td className="py-3 text-right text-sm font-semibold text-gray-900">
                        {formatCRC(product.revenue)}
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {topProducts.length === 0 ? (
              <div className="text-center py-10">
                <Package className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Sin datos de ventas aún</p>
              </div>
            ) : (
              topProducts.map((product, i) => (
                <motion.div
                  key={product.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.05 }}
                  onClick={() => router.push('/marketplace/products')}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      i === 0
                        ? 'bg-orange-50 text-orange-500'
                        : i === 1
                          ? 'bg-gray-400/20 text-gray-600'
                          : i === 2
                            ? 'bg-orange-600/20 text-orange-400'
                            : 'bg-gray-50 text-gray-400'
                    }`}
                  >
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {product.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {product.category} · {product.sold_count} vendidos
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-gray-900">
                      {formatCRC(product.revenue)}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      {formatCRC(product.price)} c/u
                    </p>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div variants={itemVariants} className="glass rounded-2xl p-6">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-gray-900">
              Acciones Rápidas
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Atajos de navegación
            </p>
          </div>

          <div className="space-y-3">
            {quickActions.map((action, i) => (
              <motion.button
                key={action.label}
                onClick={() => router.push(action.href)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-gray-50 hover:bg-gray-100 transition-all duration-200 group ${action.hover}`}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.07 }}
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
              >
                <div
                  className={`w-9 h-9 rounded-lg bg-gradient-to-br ${action.color} flex items-center justify-center shadow-md flex-shrink-0`}
                >
                  <action.icon className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-medium text-gray-600 group-hover:text-gray-900 transition-colors text-left flex-1">
                  {action.label}
                </span>
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0" />
              </motion.button>
            ))}
          </div>

          {/* Pending orders alert */}
          {stats.pendingOrders > 0 && (
            <motion.div
              className="mt-5 p-3 rounded-xl bg-amber-500/10 border border-orange-200"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.8 }}
            >
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-orange-500" />
                <span className="text-sm font-semibold text-orange-500">
                  {stats.pendingOrders} pendiente
                  {stats.pendingOrders !== 1 ? 's' : ''}
                </span>
              </div>
              <p className="text-xs text-amber-400/60">
                Hay pedidos esperando atención
              </p>
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* ─── Recent Orders ─────────────────────────────────── */}
      <motion.div variants={itemVariants} className="glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Pedidos Recientes</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Últimas 5 transacciones
            </p>
          </div>
          <button
            onClick={() => router.push('/marketplace/orders')}
            className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1.5 transition-colors font-medium"
          >
            Ver todos
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {recentOrders.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingCart className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-sm text-gray-400">Aún no hay pedidos</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left text-xs font-medium text-gray-400 pb-3 pr-4">
                      Pedido
                    </th>
                    <th className="text-left text-xs font-medium text-gray-400 pb-3 pr-4">
                      Cliente
                    </th>
                    <th className="text-left text-xs font-medium text-gray-400 pb-3 pr-4">
                      Estado
                    </th>
                    <th className="text-right text-xs font-medium text-gray-400 pb-3 pr-4">
                      Total
                    </th>
                    <th className="text-right text-xs font-medium text-gray-400 pb-3">
                      Hace
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentOrders.map((order, i) => (
                    <motion.tr
                      key={order.id}
                      className="hover:bg-gray-50 transition-colors cursor-pointer group"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.6 + i * 0.05 }}
                      onClick={() => router.push('/marketplace/orders')}
                    >
                      <td className="py-3.5 pr-4 text-sm font-mono text-green-600 group-hover:text-green-700 transition-colors">
                        {order.shortId}
                      </td>
                      <td className="py-3.5 pr-4 text-sm text-gray-900">
                        {order.customer}
                      </td>
                      <td className="py-3.5 pr-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium border ${
                            statusColors[order.status] ||
                            'bg-gray-500/15 text-gray-500 border-gray-500/30'
                          }`}
                        >
                          {statusLabel[order.status] || order.status}
                        </span>
                      </td>
                      <td className="py-3.5 pr-4 text-right text-sm font-semibold text-gray-900">
                        {formatCRC(order.total)}
                      </td>
                      <td className="py-3.5 text-right text-sm text-gray-400 flex items-center justify-end gap-1.5">
                        <Clock className="w-3 h-3" />
                        {relativeTime(order.createdAt)}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {recentOrders.map((order, i) => (
                <motion.div
                  key={order.id}
                  className="bg-gray-50 hover:bg-gray-100 rounded-xl p-4 cursor-pointer transition-colors"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 + i * 0.05 }}
                  onClick={() => router.push('/marketplace/orders')}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono text-green-600">
                      {order.shortId}
                    </span>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium border ${
                        statusColors[order.status] ||
                        'bg-gray-500/15 text-gray-500 border-gray-500/30'
                      }`}
                    >
                      {statusLabel[order.status] || order.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-900 font-medium">
                        {order.customer}
                      </p>
                      <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {relativeTime(order.createdAt)}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-gray-900">
                      {formatCRC(order.total)}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
