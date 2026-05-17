'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, ShoppingCart, Clock, X, Eye, ChevronDown,
  Package, User, MapPin, Check, XCircle, Loader2,
  ArrowLeft, Store, Phone, Mail, Truck, Bike, Car,
  CreditCard, StickyNote, ClipboardList, Wallet,
  ChevronRight, CircleDot, Route
} from 'lucide-react';
import { toast } from 'sonner';
import { type Delivery } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import Link from 'next/link';

// ─── Status Configuration (ALL 6 DB statuses preserved) ───────────────────

type OrderStatus = Delivery['status'];

const statusConfig: Record<OrderStatus, { label: string; color: string }> = {
  pending:    { label: 'Pendiente',  color: 'amber' },
  assigned:   { label: 'Asignado',   color: 'blue' },
  picked_up:  { label: 'Recogido',   color: 'purple' },
  in_transit: { label: 'En Camino',  color: 'cyan' },
  delivered:  { label: 'Entregado',  color: 'emerald' },
  cancelled:  { label: 'Cancelado',  color: 'red' },
};

const statusColorMap: Record<string, string> = {
  amber:   'bg-amber-500/15 text-amber-400 border-amber-500/30',
  blue:    'bg-blue-500/15 text-blue-400 border-blue-500/30',
  purple:  'bg-purple-500/15 text-purple-400 border-purple-500/30',
  cyan:    'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  red:     'bg-red-500/15 text-red-400 border-red-500/30',
};

const statusDotColor: Record<string, string> = {
  amber:   'bg-amber-400',
  blue:    'bg-blue-400',
  purple:  'bg-purple-400',
  cyan:    'bg-cyan-400',
  emerald: 'bg-emerald-400',
  red:     'bg-red-400',
};

const statusActiveBg: Record<string, string> = {
  amber:   'bg-amber-500/15 text-amber-400 border-amber-500/30 shadow-amber-500/10',
  blue:    'bg-blue-500/15 text-blue-400 border-blue-500/30 shadow-blue-500/10',
  purple:  'bg-purple-500/15 text-purple-400 border-purple-500/30 shadow-purple-500/10',
  cyan:    'bg-cyan-500/15 text-cyan-400 border-cyan-500/30 shadow-cyan-500/10',
  emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 shadow-emerald-500/10',
  red:     'bg-red-500/15 text-red-400 border-red-500/30 shadow-red-500/10',
};

const vehicleIcon = (type?: string) => {
  switch (type) {
    case 'moto':  return <Bike className="w-4 h-4" />;
    case 'carro': return <Car className="w-4 h-4" />;
    case 'bici':  return <Bike className="w-4 h-4" />;
    default:      return <Truck className="w-4 h-4" />;
  }
};

const paymentMethodLabels: Record<string, string> = {
  cash:   'Efectivo',
  wallet: 'Billetera',
  card:   'Tarjeta',
  sinpe:  'SINPE',
};

const categoryMap: Record<string, string> = {
  pharmacy: 'Farmacia',
  food:     'Comida',
  stores:   'Tiendas',
  other:    'Otro',
};

// ─── Timeline steps for order progress ────────────────────────────────────

const timelineSteps: OrderStatus[] = [
  'pending',
  'assigned',
  'picked_up',
  'in_transit',
  'delivered',
];

// ─── Filter tabs ──────────────────────────────────────────────────────────

type FilterTab = 'all' | OrderStatus;

const filterTabs: { key: FilterTab; label: string }[] = [
  { key: 'all',       label: 'Todos' },
  { key: 'pending',   label: 'Pendiente' },
  { key: 'assigned',  label: 'Asignado' },
  { key: 'picked_up', label: 'Recogido' },
  { key: 'in_transit',label: 'En Camino' },
  { key: 'delivered', label: 'Entregado' },
  { key: 'cancelled', label: 'Cancelado' },
];

const PAGE_SIZE = 20;

// ─── Sub-components ───────────────────────────────────────────────────────

function StatusBadge({ status }: { status: OrderStatus }) {
  const cfg = statusConfig[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${statusColorMap[cfg.color]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${statusDotColor[cfg.color]}`} />
      {cfg.label}
    </span>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-white/5 rounded-lg" />
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 h-10 bg-white/5 rounded-xl" />
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 w-24 bg-white/5 rounded-xl" />
          ))}
        </div>
      </div>
      {/* Desktop skeleton */}
      <div className="hidden lg:block glass rounded-2xl overflow-hidden">
        <div className="h-12 bg-white/5 border-b border-white/5" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 bg-white/[0.02] border-b border-white/5 flex items-center px-5 gap-4">
            <div className="w-20 h-4 bg-white/5 rounded" />
            <div className="flex-1 h-4 bg-white/5 rounded" />
            <div className="w-16 h-4 bg-white/5 rounded" />
            <div className="w-20 h-6 bg-white/5 rounded-full" />
            <div className="w-16 h-4 bg-white/5 rounded" />
            <div className="w-24 h-4 bg-white/5 rounded" />
            <div className="w-16 h-8 bg-white/5 rounded-lg" />
          </div>
        ))}
      </div>
      {/* Mobile skeleton */}
      <div className="lg:hidden space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="glass rounded-2xl p-4 space-y-3">
            <div className="flex justify-between">
              <div className="w-20 h-4 bg-white/5 rounded" />
              <div className="w-20 h-5 bg-white/5 rounded-full" />
            </div>
            <div className="w-32 h-4 bg-white/5 rounded" />
            <div className="flex justify-between">
              <div className="w-24 h-4 bg-white/5 rounded" />
              <div className="w-16 h-4 bg-white/5 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <Loader2 className="w-10 h-10 text-purple-400 animate-spin mb-4" />
      <p className="text-gray-400 text-sm">Cargando pedidos...</p>
    </div>
  );
}

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16"
    >
      <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
        <ShoppingCart className="w-8 h-8 text-gray-600" />
      </div>
      <p className="text-gray-500 text-sm font-medium">No se encontraron pedidos</p>
      <p className="text-gray-600 text-xs mt-1">Ajusta los filtros o espera nuevos pedidos</p>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Delivery[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterTab>('all');
  const [selectedOrder, setSelectedOrder] = useState<Delivery | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  // ─── Fetch orders ───────────────────────────────────────────────────

  const { session } = useAuthStore();

  const fetchOrders = useCallback(async (offset = 0, append = false) => {
    if (offset === 0) setLoading(true);
    else setLoadingMore(true);

    try {
      const token = session?.access_token;
      if (!token) { toast.error('Sesion no valida'); setLoading(false); setLoadingMore(false); return; }

      const res = await fetch(`/api/admin/marketplace/orders?offset=${offset}&limit=${PAGE_SIZE}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Error al cargar pedidos');

      if (append) {
        setOrders((prev) => [...prev, ...(result.orders || [])]);
      } else {
        setOrders(result.orders || []);
      }
      setHasMore(result.hasMore || false);
    } catch (err) {
      console.error('Error fetching orders:', err);
      toast.error('Error al cargar pedidos');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [session]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // ─── Helpers ────────────────────────────────────────────────────────

  const shortId = (id: string) => '#ORD-' + id.slice(-6).toUpperCase();

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-CR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
    }) + ' ' + d.toLocaleTimeString('es-CR', {
      hour: '2-digit', minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number) =>
    '₡' + (amount || 0).toLocaleString('es-CR');

  // ─── Filter + Search ────────────────────────────────────────────────

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      const profile = o.profiles as { name?: string } | null;
      const customerName = profile?.name || '';
      const idShort = shortId(o.id).toLowerCase();
      const matchSearch =
        idShort.includes(search.toLowerCase()) ||
        customerName.toLowerCase().includes(search.toLowerCase());
      const matchStatus = filterStatus === 'all' || o.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [orders, search, filterStatus]);

  const counts = useMemo(() => {
    const c: Record<FilterTab, number> = {
      all: orders.length,
      pending: 0,
      assigned: 0,
      picked_up: 0,
      in_transit: 0,
      delivered: 0,
      cancelled: 0,
    };
    for (const o of orders) {
      c[o.status]++;
    }
    return c;
  }, [orders]);

  // ─── Status change (preserves ALL 6 statuses, no mapping) ──────────

  const handleStatusChange = async (order: Delivery, newStatus: OrderStatus) => {
    const prevOrders = [...orders];

    setOrders((prev) =>
      prev.map((o) => (o.id === order.id ? { ...o, status: newStatus } : o))
    );

    if (selectedOrder?.id === order.id) {
      setSelectedOrder({ ...order, status: newStatus });
    }

    try {
      const token = session?.access_token;
      if (!token) { toast.error('Sesion no valida'); setOrders(prevOrders); return; }

      const res = await fetch('/api/admin/marketplace/orders', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ order_id: order.id, status: newStatus }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Error al actualizar');

      toast.success(`Pedido ${shortId(order.id)} → ${statusConfig[newStatus].label}`);
    } catch (err) {
      console.error('Error updating order status:', err);
      setOrders(prevOrders);
      toast.error('Error al actualizar el estado del pedido');
    }
  };

  // ─── Order item helpers ─────────────────────────────────────────────

  const getItems = (order: Delivery) => (order.items || []) as Array<{
    name?: string;
    quantity?: number;
    price?: number;
  }>;

  const itemCount = (order: Delivery) => getItems(order).length;

  // ─── Timeline logic ─────────────────────────────────────────────────

  const getTimelineIndex = (status: OrderStatus) => {
    if (status === 'cancelled') return -1;
    return timelineSteps.indexOf(status);
  };

  const isStepCompleted = (status: OrderStatus, stepIndex: number) => {
    if (status === 'cancelled') return false;
    return getTimelineIndex(status) > stepIndex;
  };

  const isStepActive = (status: OrderStatus, stepIndex: number) => {
    if (status === 'cancelled') return false;
    return getTimelineIndex(status) === stepIndex;
  };

  // ─── Render ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <LoadingSkeleton />
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Breadcrumb */}
      <Link
        href="/admin/marketplace"
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-purple-400 transition-colors group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        <span>Marketplace</span>
        <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
        <span className="text-purple-400">Pedidos</span>
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-violet-500/20 flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-purple-400" />
            </div>
            Pedidos
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            {orders.length} pedido{orders.length !== 1 ? 's' : ''} en total
          </p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por ID o nombre del cliente..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500/50 transition-colors"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {filterTabs.map((tab) => {
          const cfg = tab.key !== 'all' ? statusConfig[tab.key] : null;
          const isActive = filterStatus === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setFilterStatus(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium transition-all duration-200 whitespace-nowrap border ${
                isActive && cfg
                  ? statusActiveBg[cfg.color]
                  : isActive
                  ? 'bg-purple-500/15 text-purple-400 border-purple-500/30 shadow-purple-500/10'
                  : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
              }`}
            >
              {cfg && !isActive && (
                <span className={`w-1.5 h-1.5 rounded-full ${statusDotColor[cfg.color]}`} />
              )}
              {tab.label}
              <span className="ml-0.5 text-[10px] opacity-60 bg-white/5 px-1.5 py-0.5 rounded-md">
                {counts[tab.key]}
              </span>
            </button>
          );
        })}
      </div>

      {/* ─── Desktop Table ──────────────────────────────────────────── */}
      <div className="hidden lg:block glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">ID</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Cliente</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Vendedor</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Estado</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Items</th>
                <th className="text-right px-5 py-3.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Total</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Fecha</th>
                <th className="text-right px-5 py-3.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              <AnimatePresence mode="popLayout">
                {filtered.map((order, i) => {
                  const profile = order.profiles as { name?: string; phone?: string } | null;
                  const vendor = order.vendor as { store_name?: string } | null;
                  return (
                    <motion.tr
                      key={order.id}
                      className="hover:bg-white/[0.03] transition-colors"
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ delay: Math.min(i * 0.03, 0.3) }}
                    >
                      <td className="px-5 py-3.5">
                        <span className="text-sm font-mono text-purple-400">{shortId(order.id)}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-sm text-white font-medium truncate max-w-[160px]">
                          {profile?.name || 'Sin nombre'}
                        </p>
                        <p className="text-[11px] text-gray-500">{profile?.phone || '—'}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-sm text-gray-300 truncate max-w-[140px]">
                          {vendor?.store_name || '—'}
                        </p>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="relative" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={order.status}
                            onChange={(e) =>
                              handleStatusChange(order, e.target.value as OrderStatus)
                            }
                            className={`appearance-none text-[11px] font-medium px-2.5 py-1 rounded-full border pr-7 cursor-pointer focus:outline-none focus:ring-1 focus:ring-purple-500/30 transition-colors ${statusColorMap[statusConfig[order.status].color]}`}
                          >
                            {(Object.keys(statusConfig) as OrderStatus[]).map((s) => (
                              <option key={s} value={s} className="bg-gray-900 text-white">
                                {statusConfig[s].label}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-sm text-gray-400 flex items-center gap-1">
                          <Package className="w-3.5 h-3.5 text-gray-600" />
                          {itemCount(order)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="text-sm text-white font-semibold">
                          {formatCurrency(order.total)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-xs text-gray-500 flex items-center gap-1.5">
                          <Clock className="w-3 h-3" />
                          {formatDate(order.created_at)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <motion.button
                          onClick={() => setSelectedOrder(order)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 transition-colors"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <Eye className="w-3 h-3" />
                          Ver
                        </motion.button>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && orders.length > 0 && (
          <div className="py-12 text-center">
            <p className="text-gray-500 text-sm">Sin resultados para los filtros actuales</p>
          </div>
        )}
      </div>

      {/* ─── Mobile Cards ───────────────────────────────────────────── */}
      <div className="lg:hidden space-y-3">
        <AnimatePresence mode="popLayout">
          {filtered.map((order, i) => {
            const profile = order.profiles as { name?: string; phone?: string } | null;
            const vendor = order.vendor as { store_name?: string } | null;
            return (
              <motion.div
                key={order.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: Math.min(i * 0.03, 0.3) }}
                className="glass rounded-2xl p-4 space-y-3"
              >
                {/* Top row */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-purple-400 font-medium">
                    {shortId(order.id)}
                  </span>
                  <StatusBadge status={order.status} />
                </div>

                {/* Customer + Vendor */}
                <div className="space-y-1">
                  <p className="text-sm text-white font-medium">{profile?.name || 'Sin nombre'}</p>
                  {vendor?.store_name && (
                    <p className="text-[11px] text-gray-500 flex items-center gap-1">
                      <Store className="w-3 h-3" />
                      {vendor.store_name}
                    </p>
                  )}
                </div>

                {/* Meta row */}
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Package className="w-3 h-3" />
                    {itemCount(order)} item{itemCount(order) !== 1 ? 's' : ''}
                  </span>
                  <span className="font-semibold text-white text-sm">
                    {formatCurrency(order.total)}
                  </span>
                </div>

                {/* Date */}
                <p className="text-[11px] text-gray-600 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDate(order.created_at)}
                </p>

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t border-white/5">
                  <motion.button
                    onClick={() => setSelectedOrder(order)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-medium text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 transition-colors"
                    whileTap={{ scale: 0.98 }}
                  >
                    <Eye className="w-3 h-3" />
                    Ver Detalle
                  </motion.button>
                  <div className="relative" onClick={(e) => e.stopPropagation()}>
                    <select
                      value={order.status}
                      onChange={(e) =>
                        handleStatusChange(order, e.target.value as OrderStatus)
                      }
                      className={`appearance-none text-[11px] font-medium px-3 py-2.5 rounded-xl border pr-8 cursor-pointer focus:outline-none transition-colors bg-white/5 ${statusColorMap[statusConfig[order.status].color]}`}
                    >
                      {(Object.keys(statusConfig) as OrderStatus[]).map((s) => (
                        <option key={s} value={s} className="bg-gray-900 text-white">
                          {statusConfig[s].label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3 h-3 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Empty states */}
      {filtered.length === 0 && orders.length === 0 && <EmptyState />}
      {filtered.length === 0 && orders.length > 0 && (
        <div className="lg:hidden">
          <EmptyState />
        </div>
      )}

      {/* Load More */}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <motion.button
            onClick={() => fetchOrders(orders.length, true)}
            disabled={loadingMore}
            className="flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-medium text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            whileHover={{ scale: loadingMore ? 1 : 1.02 }}
            whileTap={{ scale: loadingMore ? 1 : 0.98 }}
          >
            {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
            {loadingMore ? 'Cargando...' : 'Cargar más'}
          </motion.button>
        </div>
      )}

      {/* ─── Order Detail Modal ─────────────────────────────────────── */}
      <AnimatePresence>
        {selectedOrder && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setSelectedOrder(null)}
            />

            <motion.div
              className="relative w-full max-w-2xl glass-strong rounded-2xl z-10 max-h-[90vh] overflow-y-auto scrollbar-thin"
              initial={{ scale: 0.92, y: 24 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 24 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              {/* ── Modal Header ── */}
              <div className="sticky top-0 z-10 glass-strong rounded-t-2xl p-5 border-b border-white/10">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-violet-500/20 flex items-center justify-center flex-shrink-0">
                      <Package className="w-5 h-5 text-purple-400" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-base font-bold text-white truncate">
                        {shortId(selectedOrder.id)}
                      </h2>
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {formatDate(selectedOrder.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <StatusBadge status={selectedOrder.status} />
                    <button
                      onClick={() => setSelectedOrder(null)}
                      className="text-gray-400 hover:text-white transition-colors p-1"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-5">
                {/* ── Order Info Bar ── */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="glass rounded-xl p-3">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Pago</p>
                    <p className="text-sm text-white font-medium flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-purple-400" />
                      {paymentMethodLabels[selectedOrder.payment_method] || selectedOrder.payment_method || '—'}
                    </p>
                  </div>
                  <div className="glass rounded-xl p-3">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Items</p>
                    <p className="text-sm text-white font-medium flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-blue-400" />
                      {itemCount(selectedOrder)} producto{itemCount(selectedOrder) !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="glass rounded-xl p-3">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Total</p>
                    <p className="text-sm text-emerald-400 font-bold flex items-center gap-1.5">
                      <Wallet className="w-3.5 h-3.5 text-emerald-400" />
                      {formatCurrency(selectedOrder.total)}
                    </p>
                  </div>
                </div>

                {/* ── Delivery Instructions & Type ── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="glass rounded-xl p-3 bg-orange-500/5 border-orange-500/10">
                    <p className="text-[10px] text-orange-500 font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                      <StickyNote className="w-3 h-3" />
                      Instrucciones de Entrega
                    </p>
                    <p className="text-sm text-white font-medium">{selectedOrder.instructions || 'Sin instrucciones adicionales'}</p>
                  </div>
                  <div className="glass rounded-xl p-3 bg-blue-500/5 border-blue-500/10">
                    <p className="text-[10px] text-blue-500 font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      Tipo de Entrega
                    </p>
                    <p className="text-sm text-white font-medium uppercase text-[11px] tracking-tight">
                      {selectedOrder.delivery_type === 'at_door' ? 'En la puerta' : selectedOrder.delivery_type || 'Estándar'}
                    </p>
                  </div>
                </div>

                {/* ── Notes ── */}
                {selectedOrder.notes && (
                  <div className="glass rounded-xl p-3">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                      <StickyNote className="w-3 h-3" />
                      Notas
                    </p>
                    <p className="text-sm text-gray-300">{selectedOrder.notes}</p>
                  </div>
                )}

                {/* ── Customer Section ── */}
                <div className="glass rounded-xl p-4">
                  <h3 className="text-xs font-semibold text-white flex items-center gap-2 mb-3 uppercase tracking-wider">
                    <User className="w-4 h-4 text-purple-400" />
                    Cliente
                  </h3>
                  <div className="grid sm:grid-cols-2 gap-y-3 gap-x-6">
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase">Nombre</p>
                      <p className="text-sm text-white mt-0.5">
                        {(selectedOrder.profiles as { name?: string } | null)?.name || 'Sin nombre'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase flex items-center gap-1">
                        <Phone className="w-3 h-3" /> Teléfono
                      </p>
                      <p className="text-sm text-white mt-0.5">
                        {(selectedOrder.profiles as { phone?: string } | null)?.phone || '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase flex items-center gap-1">
                        <Mail className="w-3 h-3" /> Email
                      </p>
                      <p className="text-sm text-white mt-0.5">
                        {(selectedOrder.profiles as { email?: string } | null)?.email || '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> Dirección de Entrega
                      </p>
                      <p className="text-sm text-white mt-0.5">{selectedOrder.delivery_address || '—'}</p>
                    </div>
                  </div>
                </div>

                {/* ── Vendor Section ── */}
                {selectedOrder.vendors && (
                  <div className="glass rounded-xl p-4">
                    <h3 className="text-xs font-semibold text-white flex items-center gap-2 mb-3 uppercase tracking-wider">
                      <Store className="w-4 h-4 text-amber-400" />
                      Vendedor
                    </h3>
                    <div className="grid sm:grid-cols-2 gap-y-3 gap-x-6">
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase">Tienda</p>
                        <p className="text-sm text-white mt-0.5">
                          {(selectedOrder.vendor as { store_name?: string }).store_name || '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase">Categoría</p>
                        <p className="text-sm text-white mt-0.5">
                          {categoryMap[(selectedOrder.vendor as { category?: string }).category || ''] || (selectedOrder.vendor as { category?: string }).category || '—'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Courier Section (if assigned) ── */}
                {selectedOrder.courier_id && selectedOrder.courier && (
                  <div className="glass rounded-xl p-4">
                    <h3 className="text-xs font-semibold text-white flex items-center gap-2 mb-3 uppercase tracking-wider">
                      <Truck className="w-4 h-4 text-cyan-400" />
                      Mensajero
                    </h3>
                    <div className="grid sm:grid-cols-2 gap-y-3 gap-x-6">
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase">Nombre</p>
                        <p className="text-sm text-white mt-0.5">
                          {(selectedOrder.courier as { profiles?: { name?: string } }).profiles?.name || 'Sin nombre'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase flex items-center gap-1">
                          <Phone className="w-3 h-3" /> Teléfono
                        </p>
                        <p className="text-sm text-white mt-0.5">
                          {(selectedOrder.courier as { profiles?: { phone?: string } }).profiles?.phone || '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase flex items-center gap-1">
                          <Route className="w-3 h-3" /> Vehículo
                        </p>
                        <p className="text-sm text-white mt-0.5 flex items-center gap-1.5">
                          {vehicleIcon((selectedOrder.courier as { vehicle_type?: string }).vehicle_type)}
                          {(selectedOrder.courier as { vehicle_type?: string }).vehicle_type || '—'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Items List ── */}
                <div className="glass rounded-xl p-4">
                  <h3 className="text-xs font-semibold text-white flex items-center gap-2 mb-3 uppercase tracking-wider">
                    <ShoppingCart className="w-4 h-4 text-purple-400" />
                    Productos
                  </h3>
                  <div className="space-y-0 divide-y divide-white/5">
                    {getItems(selectedOrder).map((item, idx) => (
                      <div key={idx} className="py-2.5">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 flex-1 mr-4">
                            <p className="text-sm text-white font-medium">{item.name || 'Producto'}</p>
                            <p className="text-[11px] text-gray-500">
                              {formatCurrency(item.price || 0)} × {item.quantity || item.qty || 0}
                            </p>
                          </div>
                          <p className="text-sm text-white font-bold flex-shrink-0">
                            {formatCurrency((item.price || 0) * (item.quantity || item.qty || 0))}
                          </p>
                        </div>
                        {/* Selected Options (Admin) */}
                        {(item.selected_options || item.selectedOptions) && (item.selected_options || item.selectedOptions).length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {(item.selected_options || item.selectedOptions).map((opt: any, i: number) => (
                              <span key={i} className="text-[9px] px-2 py-0.5 rounded bg-white/5 text-gray-400 border border-white/5 italic">
                                + {opt.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Totals */}
                  <div className="pt-3 mt-2 border-t border-white/10 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Subtotal</span>
                      <span className="text-gray-300">{formatCurrency(selectedOrder.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Envío</span>
                      <span className="text-gray-300">{formatCurrency(selectedOrder.delivery_fee)}</span>
                    </div>
                    {selectedOrder.service_fee && (
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Cuota de Servicio</span>
                        <span className="text-gray-300">{formatCurrency(selectedOrder.service_fee)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm pt-2 border-t border-white/5">
                      <span className="text-white font-semibold">Total</span>
                      <span className="text-emerald-400 font-bold text-base">
                        {formatCurrency(selectedOrder.total)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ── Timeline ── */}
                {selectedOrder.status !== 'cancelled' ? (
                  <div className="glass rounded-xl p-4">
                    <h3 className="text-xs font-semibold text-white flex items-center gap-2 mb-4 uppercase tracking-wider">
                      <CircleDot className="w-4 h-4 text-purple-400" />
                      Progreso del Pedido
                    </h3>
                    <div className="relative flex items-center justify-between">
                      {/* Connector line */}
                      <div className="absolute top-3 left-6 right-6 h-0.5 bg-white/10" />
                      <div
                        className="absolute top-3 left-6 h-0.5 bg-purple-500 transition-all duration-500"
                        style={{
                          width: `calc(${(getTimelineIndex(selectedOrder.status) / (timelineSteps.length - 1)) * 100}% - 0px)`,
                          maxWidth: 'calc(100% - 0px)',
                        }}
                      />

                      {timelineSteps.map((step, idx) => {
                        const cfg = statusConfig[step];
                        const completed = isStepCompleted(selectedOrder.status, idx);
                        const active = isStepActive(selectedOrder.status, idx);
                        return (
                          <div key={step} className="relative flex flex-col items-center z-10 flex-1">
                            <div
                              className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                                completed
                                  ? `${statusColorMap[cfg.color]} border-transparent`
                                  : active
                                  ? `${statusColorMap[cfg.color]} ring-2 ring-offset-2 ring-offset-[#0a0a0f] ring-purple-500/30`
                                  : 'bg-gray-800 border-white/10'
                              }`}
                            >
                              {completed ? (
                                <Check className="w-3.5 h-3.5" />
                              ) : active ? (
                                <span className={`w-2 h-2 rounded-full ${statusDotColor[cfg.color]} animate-pulse`} />
                              ) : (
                                <span className="w-1.5 h-1.5 rounded-full bg-gray-600" />
                              )}
                            </div>
                            <p
                              className={`text-[10px] mt-2 text-center leading-tight ${
                                completed || active ? 'text-gray-300 font-medium' : 'text-gray-600'
                              }`}
                            >
                              {cfg.label}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="glass rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center flex-shrink-0">
                        <XCircle className="w-5 h-5 text-red-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-red-400">Pedido Cancelado</p>
                        <p className="text-xs text-gray-500 mt-0.5">Este pedido fue cancelado y no tiene progreso</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Status Change Buttons (ALL 6) ── */}
                <div className="glass rounded-xl p-4">
                  <h3 className="text-xs font-semibold text-white mb-3 uppercase tracking-wider">
                    Cambiar Estado
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {(Object.keys(statusConfig) as OrderStatus[]).map((s) => {
                      const cfg = statusConfig[s];
                      const isActive = selectedOrder.status === s;
                      const icons: Record<OrderStatus, typeof Clock> = {
                        pending:    Clock,
                        assigned:   Package,
                        picked_up:  Truck,
                        in_transit: Route,
                        delivered:  Check,
                        cancelled:  XCircle,
                      };
                      const Icon = icons[s];
                      return (
                        <motion.button
                          key={s}
                          onClick={() => {
                            handleStatusChange(selectedOrder, s);
                          }}
                          className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 ${
                            isActive
                              ? statusActiveBg[cfg.color]
                              : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                          }`}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.97 }}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {cfg.label}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {/* Close button */}
                <div className="pt-2">
                  <button
                    onClick={() => setSelectedOrder(null)}
                    className="w-full py-3 rounded-xl text-sm font-medium text-gray-400 bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
