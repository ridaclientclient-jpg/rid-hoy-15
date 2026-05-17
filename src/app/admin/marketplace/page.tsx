'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Store, Package, ShoppingCart, DollarSign, TrendingUp,
  ArrowUpRight, Clock, Users, Eye, Loader2, Star,
  BarChart3, Tag, Grid3X3, Layers, Zap, RefreshCw,
  PackageCheck, PackageX,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase, type Product, type Delivery, type Vendor } from '@/lib/supabase';

// ─── Helpers ──────────────────────────────────────────────────────
function formatCRC(amount: number): string {
  return `₡${Math.round(amount).toLocaleString('es-CR')}`;
}

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'Ahora';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  if (diffHr < 24) return `Hace ${diffHr}h`;
  return `Hace ${diffDay}d`;
}

function formatDayLabel(date: Date): string {
  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  return `${days[date.getDay()]} ${date.getDate().toString().padStart(2, '0')}`;
}

// ─── Types ────────────────────────────────────────────────────────
interface DashboardStats {
  totalVendors: number;
  activeProducts: number;
  ordersToday: number;
  totalEarnings: number;
}

interface RevenueDay {
  date: string;
  label: string;
  total: number;
}

interface RecentProduct {
  id: string;
  name: string;
  vendorName: string;
  price: number;
  inStock: boolean;
  stockQuantity: number;
  imageUrl: string | null;
}

interface RecentOrder {
  id: string;
  dbId: string;
  customer: string;
  vendorName: string;
  total: number;
  status: string;
  time: string;
}

interface TopVendor {
  id: string;
  storeName: string;
  productCount: number;
  orderCount: number;
  earnings: number;
  rating: number;
}

// ─── Constants ────────────────────────────────────────────────────
const statusColors: Record<string, string> = {
  delivered: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  in_transit: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  pending: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  assigned: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  picked_up: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  cancelled: 'bg-red-500/15 text-red-400 border-red-500/30',
};

const statusLabels: Record<string, string> = {
  delivered: 'Entregado',
  in_transit: 'En tránsito',
  pending: 'Pendiente',
  assigned: 'Asignado',
  picked_up: 'Recogido',
  cancelled: 'Cancelado',
};

const quickLinks = [
  {
    label: 'Vendedores',
    href: '/admin/marketplace/vendors',
    icon: Store,
    gradient: 'from-amber-500 to-orange-500',
    bgHover: 'hover:shadow-amber-500/20',
    statKey: 'vendors' as const,
  },
  {
    label: 'Productos',
    href: '/admin/marketplace/products',
    icon: Package,
    gradient: 'from-violet-500 to-purple-500',
    bgHover: 'hover:shadow-violet-500/20',
    statKey: 'products' as const,
  },
  {
    label: 'Categorías',
    href: '/admin/services/categories',
    icon: Grid3X3,
    gradient: 'from-cyan-500 to-teal-500',
    bgHover: 'hover:shadow-cyan-500/20',
    statKey: null,
  },
  {
    label: 'Pedidos',
    href: '/admin/marketplace/orders',
    icon: ShoppingCart,
    gradient: 'from-emerald-500 to-green-500',
    bgHover: 'hover:shadow-emerald-500/20',
    statKey: 'orders' as const,
  },
];

// ─── Animation Variants ──────────────────────────────────────────
const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

// ─── Star Rating Component ───────────────────────────────────────
function StarRating({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
  const sz = size === 'md' ? 'w-3.5 h-3.5' : 'w-3 h-3';
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${sz} ${star <= Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-gray-600'}`}
        />
      ))}
      <span className={`text-gray-400 ml-1 ${size === 'md' ? 'text-xs' : 'text-[10px]'}`}>
        {rating > 0 ? rating.toFixed(1) : '—'}
      </span>
    </div>
  );
}

// ─── Loading Skeleton ───────────────────────────────────────────
function DashboardSkeleton() {
  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* Header skeleton */}
      <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="h-8 w-48 bg-white/5 rounded-lg animate-pulse mb-2" />
          <div className="h-4 w-36 bg-white/5 rounded animate-pulse" />
        </div>
      </motion.div>

      {/* Stats cards skeleton */}
      <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass rounded-2xl p-5 animate-pulse">
            <div className="flex items-start justify-between mb-3">
              <div className="w-11 h-11 rounded-xl bg-white/5" />
            </div>
            <div className="h-7 w-24 bg-white/5 rounded mb-2" />
            <div className="h-4 w-32 bg-white/5 rounded" />
          </div>
        ))}
      </motion.div>

      {/* Chart skeleton */}
      <motion.div variants={item} className="glass rounded-2xl p-5 animate-pulse">
        <div className="h-5 w-40 bg-white/5 rounded mb-6" />
        <div className="flex items-end gap-3 h-40">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full bg-white/5 rounded-t-md" style={{ height: `${30 + Math.random() * 60}%` }} />
            </div>
          ))}
        </div>
      </motion.div>

      {/* Tables skeleton */}
      <motion.div variants={item} className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 glass rounded-2xl p-5 animate-pulse">
          <div className="h-5 w-40 bg-white/5 rounded mb-4" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-3 border-b border-white/5 last:border-0">
              <div className="w-10 h-10 rounded-lg bg-white/5 shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-40 bg-white/5 rounded" />
                <div className="h-3 w-24 bg-white/5 rounded" />
              </div>
            </div>
          ))}
        </div>
        <div className="glass rounded-2xl p-5 animate-pulse">
          <div className="h-5 w-32 bg-white/5 rounded mb-4" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 bg-white/5 rounded-xl mb-3 last:mb-0" />
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Revenue Bar Chart ──────────────────────────────────────────
function RevenueChart({ data }: { data: RevenueDay[] }) {
  const maxTotal = Math.max(...data.map((d) => d.total), 1);

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-violet-400" />
          Ingresos — Últimos 7 días
        </h2>
        <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
          <Zap className="w-3 h-3 text-violet-400" />
          Actualizado en tiempo real
        </div>
      </div>

      {data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <BarChart3 className="w-10 h-10 text-gray-600 mb-3" />
          <p className="text-gray-500 text-sm">Sin datos de ingresos</p>
        </div>
      ) : (
        <div className="space-y-1">
          {/* Bars */}
          <div className="flex items-end gap-2 sm:gap-3 h-40">
            {data.map((day, i) => {
              const heightPercent = maxTotal > 0 ? (day.total / maxTotal) * 100 : 0;
              const isToday = i === data.length - 1;

              return (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-2 min-w-0">
                  {/* Amount label */}
                  <span className="text-[10px] text-gray-500 truncate w-full text-center">
                    {day.total > 0 ? formatCRC(day.total) : '—'}
                  </span>

                  {/* Bar */}
                  <div className="w-full relative flex items-end" style={{ height: '120px' }}>
                    <motion.div
                      className={`w-full rounded-t-lg ${
                        isToday
                          ? 'bg-gradient-to-t from-violet-600 to-purple-400'
                          : 'bg-gradient-to-t from-violet-600/40 to-purple-400/40'
                      }`}
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max(heightPercent, 2)}%` }}
                      transition={{ duration: 0.6, delay: i * 0.08, ease: 'easeOut' }}
                      style={{ minHeight: '4px' }}
                    />
                  </div>

                  {/* Day label */}
                  <span
                    className={`text-[10px] truncate w-full text-center ${
                      isToday ? 'text-violet-400 font-semibold' : 'text-gray-500'
                    }`}
                  >
                    {day.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Total summary */}
          <div className="flex items-center justify-between pt-4 mt-2 border-t border-white/5">
            <span className="text-xs text-gray-500">Total del periodo</span>
            <span className="text-sm font-bold text-violet-400">
              {formatCRC(data.reduce((sum, d) => sum + d.total, 0))}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────
export default function AdminMarketplaceDashboard() {
  const router = useRouter();
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [stats, setStats] = useState<DashboardStats>({
    totalVendors: 0,
    activeProducts: 0,
    ordersToday: 0,
    totalEarnings: 0,
  });
  const [revenueData, setRevenueData] = useState<RevenueDay[]>([]);
  const [recentProducts, setRecentProducts] = useState<RecentProduct[]>([]);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [topVendors, setTopVendors] = useState<TopVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  // ─── Fetch all dashboard data ─────────────────────────────────
  const fetchDashboard = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      // 1. Stats: vendor count
      const { count: vendorCount } = await supabase
        .from('vendors')
        .select('id', { count: 'exact', head: true })
        .eq('is_approved', true);

      // 2. Stats: active products count
      const { count: productCount } = await supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('in_stock', true);

      // 3. Stats: today's deliveries
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { count: todayOrders } = await supabase
        .from('deliveries')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', todayStart.toISOString());

      // 4. Stats: total earnings (delivered)
      const { data: earningsData } = await supabase
        .from('deliveries')
        .select('total')
        .eq('status', 'delivered');
      const totalEarnings = (earningsData || []).reduce(
        (sum, d) => sum + (d.total || 0),
        0
      );

      setStats({
        totalVendors: vendorCount || 0,
        activeProducts: productCount || 0,
        ordersToday: todayOrders || 0,
        totalEarnings,
      });

      // 5. Revenue chart: last 7 days of delivered deliveries
      const chartEnd = new Date();
      chartEnd.setHours(23, 59, 59, 999);
      const chartStart = new Date();
      chartStart.setDate(chartStart.getDate() - 6);
      chartStart.setHours(0, 0, 0, 0);

      const { data: chartDeliveries } = await supabase
        .from('deliveries')
        .select('total, created_at')
        .eq('status', 'delivered')
        .gte('created_at', chartStart.toISOString())
        .lte('created_at', chartEnd.toISOString());

      // Group by date
      const dayMap: Record<string, number> = {};
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        const key = d.toISOString().split('T')[0];
        dayMap[key] = 0;
      }

      for (const delivery of chartDeliveries || []) {
        const dayKey = delivery.created_at?.split('T')[0];
        if (dayKey && dayMap[dayKey] !== undefined) {
          dayMap[dayKey] += delivery.total || 0;
        }
      }

      const revenueDays: RevenueDay[] = Object.entries(dayMap).map(
        ([date, total]) => ({
          date,
          label: formatDayLabel(new Date(date + 'T12:00:00')),
          total,
        })
      );
      setRevenueData(revenueDays);

      // 6. Recent 6 products with vendor name
      const { data: productsData } = await supabase
        .from('products')
        .select('id, name, price, in_stock, stock_quantity, image_url, vendors(store_name)')
        .order('created_at', { ascending: false })
        .limit(6);

      const mappedProducts: RecentProduct[] = (productsData || []).map((p) => {
        const vendor = p.vendors as { store_name?: string } | null;
        return {
          id: p.id,
          name: p.name,
          vendorName: vendor?.store_name || 'Sin vendedor',
          price: p.price || 0,
          inStock: p.in_stock,
          stockQuantity: p.stock_quantity || 0,
          imageUrl: p.image_url || null,
        };
      });
      setRecentProducts(mappedProducts);

      // 7. Recent 5 orders with customer + vendor
      const { data: ordersData } = await supabase
        .from('deliveries')
        .select('id, total, status, created_at, profiles(name), vendors(store_name)')
        .order('created_at', { ascending: false })
        .limit(5);

      const mappedOrders: RecentOrder[] = (ordersData || []).map((d) => {
        const profile = d.profiles as { name?: string } | null;
        const vendor = d.vendors as { store_name?: string } | null;
        return {
          id: '#ORD-' + d.id.slice(-4).toUpperCase(),
          dbId: d.id,
          customer: profile?.name || 'Sin nombre',
          vendorName: vendor?.store_name || '—',
          total: d.total || 0,
          status: d.status,
          time: d.created_at ? formatRelativeTime(d.created_at) : '',
        };
      });
      setRecentOrders(mappedOrders);

      // 8. Top 5 vendors by earnings (from delivered deliveries)
      const { data: topVendorsData } = await supabase
        .from('vendors')
        .select('*, profiles(name)')
        .eq('is_approved', true);

      const allVendorIds = (topVendorsData || []).map((v) => v.id);

      // Get delivered deliveries for vendor earnings
      const { data: vendorDeliveries } = await supabase
        .from('deliveries')
        .select('vendor_id, total, items')
        .eq('status', 'delivered');

      // Build product_id → vendor_id mapping
      const { data: allProducts } = await supabase
        .from('products')
        .select('id, vendor_id');
      const productToVendor: Record<string, string> = {};
      if (allProducts) {
        allProducts.forEach((p) => {
          if (p.id && p.vendor_id) productToVendor[p.id] = p.vendor_id;
        });
      }

      // Calculate vendor earnings and order counts
      const vendorEarnings: Record<string, number> = {};
      const vendorOrders: Record<string, number> = {};

      for (const order of vendorDeliveries || []) {
        let vid = order.vendor_id;
        if (!vid && order.items && Array.isArray(order.items)) {
          for (const i of order.items) {
            const derived = productToVendor[i.id];
            if (derived) { vid = derived; break; }
          }
        }
        if (vid) {
          vendorEarnings[vid] = (vendorEarnings[vid] || 0) + (order.total || 0);
          vendorOrders[vid] = (vendorOrders[vid] || 0) + 1;
        }
      }

      // Count products per vendor
      const vendorProductCounts: Record<string, number> = {};
      const { count: totalProductsGrouped } = await supabase
        .from('products')
        .select('id', { count: 'exact', head: true });
      // Instead of a separate count call for each vendor, use the products data we have
      if (allProducts) {
        for (const p of allProducts) {
          if (p.vendor_id) {
            vendorProductCounts[p.vendor_id] =
              (vendorProductCounts[p.vendor_id] || 0) + 1;
          }
        }
      }

      // Build top vendors list
      const vendorList: TopVendor[] = (topVendorsData || [])
        .map((v) => ({
          id: v.id,
          storeName: v.store_name,
          productCount: vendorProductCounts[v.id] || 0,
          orderCount: vendorOrders[v.id] || 0,
          earnings: vendorEarnings[v.id] || 0,
          rating: v.rating || 0,
        }))
        .sort((a, b) => b.earnings - a.earnings)
        .slice(0, 5);

      setTopVendors(vendorList);
      setLastUpdated(new Date().toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      console.error('Error fetching dashboard:', err);
      toast.error('Error al cargar datos del marketplace');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // ─── Initial load + auto-refresh every 30s ────────────────────
  useEffect(() => {
    fetchDashboard();

    refreshTimerRef.current = setInterval(() => {
      fetchDashboard(true);
    }, 30000);

    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [fetchDashboard]);

  // ─── Realtime subscription on deliveries ──────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('admin-mkt-deliveries-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'deliveries' },
        () => {
          fetchDashboard(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchDashboard]);

  // ─── Stats config ─────────────────────────────────────────────
  const statsConfig = [
    {
      label: 'Total Vendedores',
      value: stats.totalVendors.toString(),
      icon: Store,
      gradient: 'from-amber-500 to-orange-500',
      glowClass: 'shadow-amber-500/20',
    },
    {
      label: 'Productos Activos',
      value: stats.activeProducts.toString(),
      icon: Package,
      gradient: 'from-violet-500 to-purple-500',
      glowClass: 'shadow-violet-500/20',
    },
    {
      label: 'Pedidos Hoy',
      value: stats.ordersToday.toString(),
      icon: ShoppingCart,
      gradient: 'from-emerald-500 to-green-500',
      glowClass: 'shadow-emerald-500/20',
    },
    {
      label: 'Ingresos Marketplace',
      value: formatCRC(stats.totalEarnings),
      icon: DollarSign,
      gradient: 'from-violet-600 to-fuchsia-500',
      glowClass: 'shadow-fuchsia-500/20',
    },
  ];

  // ─── Quick link stat values ───────────────────────────────────
  const quickStatMap = {
    vendors: stats.totalVendors,
    products: stats.activeProducts,
    orders: stats.ordersToday,
  };

  // ─── Loading state ────────────────────────────────────────────
  if (loading) {
    return (
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
        <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">Marketplace</h1>
            <p className="text-gray-400 text-sm mt-1">Panel de gestión del marketplace</p>
          </div>
        </motion.div>
        <DashboardSkeleton />
      </motion.div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────
  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────── */}
      <motion.div
        variants={item}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Marketplace</h1>
          <p className="text-gray-400 text-sm mt-1">Panel de gestión del marketplace</p>
        </div>
        <div className="flex items-center gap-3 self-start">
          {lastUpdated && (
            <span className="text-[11px] text-gray-500 hidden sm:flex items-center gap-1.5">
              <RefreshCw
                className={`w-3 h-3 ${refreshing ? 'animate-spin text-violet-400' : 'text-gray-600'}`}
              />
              {refreshing ? 'Actualizando...' : `Actualizado ${lastUpdated}`}
            </span>
          )}
          <Link href="/admin/marketplace/vendors">
            <motion.span
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-500/20 cursor-pointer"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <Users className="w-4 h-4" />
              Vendedores
            </motion.span>
          </Link>
          <Link href="/admin/marketplace/products">
            <motion.span
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <Package className="w-4 h-4" />
              Productos
            </motion.span>
          </Link>
          <Link href="/admin/marketplace/orders">
            <motion.span
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <ShoppingCart className="w-4 h-4" />
              Pedidos
            </motion.span>
          </Link>
        </div>
      </motion.div>

      {/* ── Stats Cards ────────────────────────────────────────── */}
      <motion.div
        variants={item}
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {statsConfig.map((stat, i) => (
          <motion.div
            key={stat.label}
            className="glass rounded-2xl p-5 transition-all duration-300 group"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + i * 0.05 }}
            whileHover={{ y: -2 }}
          >
            <div className="flex items-start justify-between mb-3">
              <div
                className={`w-11 h-11 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center shadow-lg ${stat.glowClass}`}
              >
                <stat.icon className="w-5 h-5 text-white" />
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-white">{stat.value}</p>
            <p className="text-xs sm:text-sm text-gray-400 mt-0.5">{stat.label}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* ── Revenue Chart ──────────────────────────────────────── */}
      <motion.div variants={item}>
        <RevenueChart data={revenueData} />
      </motion.div>

      {/* ── Content Grid: Recent Products + Quick Links ────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Recent Products Table */}
        <motion.div
          variants={item}
          className="xl:col-span-2 glass rounded-2xl overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Package className="w-5 h-5 text-violet-400" />
              Productos Recientes
            </h2>
            <Link
              href="/admin/marketplace/products"
              className="text-xs text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1"
            >
              Ver todos <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Producto
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Vendedor
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Precio
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Stock
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentProducts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-gray-500 text-sm">
                      <Package className="w-8 h-8 mx-auto mb-2 text-gray-600" />
                      No hay productos registrados
                    </td>
                  </tr>
                ) : (
                  recentProducts.map((product, i) => (
                    <motion.tr
                      key={product.id}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer group"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.05 }}
                      onClick={() => router.push('/admin/marketplace/products')}
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center overflow-hidden shrink-0">
                            {product.imageUrl ? (
                              <img
                                src={product.imageUrl}
                                alt={product.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <Package className="w-5 h-5 text-violet-400/60" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm text-white font-medium truncate group-hover:text-violet-300 transition-colors">
                              {product.name}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-400">
                        {product.vendorName}
                      </td>
                      <td className="px-5 py-3 text-sm text-white font-semibold">
                        {formatCRC(product.price)}
                      </td>
                      <td className="px-5 py-3">
                        {product.inStock ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <PackageCheck className="w-3 h-3" />
                            {product.stockQuantity > 0 ? product.stockQuantity : '✓'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-red-500/15 text-red-400 border border-red-500/30">
                            <PackageX className="w-3 h-3" />
                            Agotado
                          </span>
                        )}
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden p-4 space-y-3">
            {recentProducts.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">
                No hay productos registrados
              </p>
            ) : (
              recentProducts.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] cursor-pointer hover:bg-white/[0.06] transition-colors"
                  onClick={() => router.push('/admin/marketplace/products')}
                >
                  <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center overflow-hidden shrink-0">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <Package className="w-5 h-5 text-violet-400/60" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{product.name}</p>
                    <p className="text-[11px] text-gray-500 truncate">{product.vendorName}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-white">{formatCRC(product.price)}</p>
                    {product.inStock ? (
                      <span className="text-[10px] text-emerald-400">En stock</span>
                    ) : (
                      <span className="text-[10px] text-red-400">Agotado</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>

        {/* Quick Links Panel */}
        <motion.div variants={item} className="space-y-4">
          <div className="glass rounded-2xl p-5 space-y-3">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-violet-400" />
              Gestión Rápida
            </h2>
            <div className="space-y-2">
              {quickLinks.map((link) => (
                <Link key={link.href + link.label} href={link.href}>
                  <motion.div
                    className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] transition-all cursor-pointer group"
                    whileHover={{ x: 4 }}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl bg-gradient-to-br ${link.gradient} flex items-center justify-center shadow-lg ${link.bgHover}`}
                    >
                      <link.icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white group-hover:text-violet-300 transition-colors">
                        {link.label}
                      </p>
                      {link.statKey && (
                        <p className="text-xs text-gray-500">
                          {quickStatMap[link.statKey]}{' '}
                          {link.statKey === 'vendors'
                            ? 'registrados'
                            : link.statKey === 'products'
                              ? 'activos'
                              : 'hoy'}
                        </p>
                      )}
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-gray-500 group-hover:text-violet-400 transition-colors shrink-0" />
                  </motion.div>
                </Link>
              ))}
            </div>
          </div>

          {/* Live Status Indicator */}
          <div className="glass rounded-2xl p-4 flex items-center gap-3">
            <div className="relative">
              <div className="w-3 h-3 rounded-full bg-emerald-400" />
              <div className="absolute inset-0 w-3 h-3 rounded-full bg-emerald-400 animate-ping opacity-40" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-white">Datos en tiempo real</p>
              <p className="text-[10px] text-gray-500">
                Se actualiza automáticamente con cada nuevo pedido
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── Recent Orders Table ────────────────────────────────── */}
      <motion.div variants={item} className="glass rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-violet-400" />
            Pedidos Recientes
          </h2>
          <Link
            href="/admin/marketplace/orders"
            className="text-xs text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1"
          >
            Ver todos <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Desktop Table */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                  ID Pedido
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Vendedor
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Estado
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Total
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Hace
                </th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-gray-500 text-sm">
                    <ShoppingCart className="w-8 h-8 mx-auto mb-2 text-gray-600" />
                    No hay pedidos registrados
                  </td>
                </tr>
              ) : (
                recentOrders.map((order, i) => (
                  <motion.tr
                    key={order.dbId}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer group"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + i * 0.05 }}
                    onClick={() => router.push('/admin/marketplace/orders')}
                  >
                    <td className="px-5 py-3 text-sm font-mono text-violet-400 group-hover:text-violet-300 transition-colors">
                      {order.id}
                    </td>
                    <td className="px-5 py-3 text-sm text-white">{order.customer}</td>
                    <td className="px-5 py-3 text-sm text-gray-400">
                      {order.vendorName}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                          statusColors[order.status] || statusColors.pending
                        }`}
                      >
                        {statusLabels[order.status] || order.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-white font-semibold">
                      {formatCRC(order.total)}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-500 flex items-center gap-1.5">
                      <Clock className="w-3 h-3" />
                      {order.time}
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="lg:hidden p-4 space-y-3">
          {recentOrders.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">
              No hay pedidos registrados
            </p>
          ) : (
            recentOrders.map((order) => (
              <div
                key={order.dbId}
                className="bg-white/[0.03] rounded-xl p-4 cursor-pointer hover:bg-white/[0.06] transition-colors"
                onClick={() => router.push('/admin/marketplace/orders')}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono text-violet-400">{order.id}</span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                      statusColors[order.status] || statusColors.pending
                    }`}
                  >
                    {statusLabels[order.status] || order.status}
                  </span>
                </div>
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <p className="text-sm text-white font-medium">{order.customer}</p>
                    <p className="text-[11px] text-gray-500">{order.vendorName}</p>
                  </div>
                  <p className="text-sm font-bold text-white">{formatCRC(order.total)}</p>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-gray-500 mt-2">
                  <Clock className="w-3 h-3" />
                  {order.time}
                </div>
              </div>
            ))
          )}
        </div>
      </motion.div>

      {/* ── Top Vendors ────────────────────────────────────────── */}
      <motion.div variants={item}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-violet-400" />
            Top Vendedores
          </h2>
          <Link
            href="/admin/marketplace/vendors"
            className="text-xs text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1"
          >
            Ver todos <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>

        {topVendors.length === 0 ? (
          <div className="glass rounded-2xl p-10 flex flex-col items-center justify-center">
            <Store className="w-10 h-10 text-gray-600 mb-3" />
            <p className="text-gray-500 text-sm">No hay vendedores con ventas</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
            {topVendors.map((vendor, i) => (
              <motion.div
                key={vendor.id}
                className="glass rounded-2xl p-4 cursor-pointer hover:bg-white/[0.04] transition-all group"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + i * 0.07 }}
                whileHover={{ y: -3, boxShadow: '0 8px 30px rgba(139, 92, 246, 0.1)' }}
                onClick={() => router.push('/admin/marketplace/vendors')}
              >
                {/* Rank badge */}
                <div className="flex items-center justify-between mb-3">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                      i === 0
                        ? 'bg-amber-500/20 text-amber-400'
                        : i === 1
                          ? 'bg-gray-400/20 text-gray-300'
                          : i === 2
                            ? 'bg-orange-600/20 text-orange-400'
                            : 'bg-white/5 text-gray-500'
                    }`}
                  >
                    #{i + 1}
                  </div>
                  <Store className="w-4 h-4 text-gray-600 group-hover:text-violet-400 transition-colors" />
                </div>

                {/* Store name */}
                <h3 className="text-sm font-semibold text-white truncate group-hover:text-violet-300 transition-colors mb-3">
                  {vendor.storeName}
                </h3>

                {/* Stats */}
                <div className="space-y-2 mb-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-500 flex items-center gap-1">
                      <Package className="w-3 h-3" />
                      Productos
                    </span>
                    <span className="text-[11px] text-white font-medium">
                      {vendor.productCount}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-500 flex items-center gap-1">
                      <ShoppingCart className="w-3 h-3" />
                      Pedidos
                    </span>
                    <span className="text-[11px] text-white font-medium">
                      {vendor.orderCount}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-500 flex items-center gap-1">
                      <DollarSign className="w-3 h-3" />
                      Ingresos
                    </span>
                    <span className="text-[11px] text-emerald-400 font-semibold">
                      {formatCRC(vendor.earnings)}
                    </span>
                  </div>
                </div>

                {/* Rating */}
                <div className="pt-3 border-t border-white/5">
                  <StarRating rating={vendor.rating} size="sm" />
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
