'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Truck, Bike, Car, Eye, ToggleLeft, ToggleRight,
  Ban, CheckCircle2, XCircle, MoreHorizontal, ChevronDown,
  Loader2, MapPin, Star, Package, Users, X, ArrowLeft, ChevronRight
} from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { Courier } from '@/lib/supabase';
import { toast } from 'sonner';

interface CourierRow extends Courier {
  name: string;
  email: string;
}

const vehicleIcons: Record<string, any> = {
  moto: Bike,
  bici: Bike,
  carro: Car,
};

const vehicleLabels: Record<string, string> = {
  moto: 'Moto',
  bici: 'Bicicleta',
  carro: 'Carro',
};

const vehicleColors: Record<string, string> = {
  moto: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  bici: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  carro: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

const statusBadge: Record<string, { label: string; color: string }> = {
  online: { label: 'En linea', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  offline: { label: 'Desconectado', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  busy: { label: 'Ocupado', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  delivering: { label: 'Entregando', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  suspended: { label: 'Suspendido', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
};

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Stats Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="h-3 w-24 bg-white/5 rounded mb-2" />
                <div className="h-7 w-12 bg-white/5 rounded" />
              </div>
              <div className="w-11 h-11 rounded-xl bg-white/5" />
            </div>
          </div>
        ))}
      </div>
      {/* Search Skeleton */}
      <div className="glass rounded-2xl p-4">
        <div className="h-10 w-full bg-white/5 rounded-xl" />
      </div>
      {/* Courier List Skeleton */}
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="glass rounded-xl p-4">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-white/5 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 bg-white/5 rounded" />
                <div className="h-3 w-48 bg-white/5 rounded" />
              </div>
              <div className="h-7 w-20 bg-white/5 rounded-lg hidden sm:block" />
              <div className="h-7 w-24 bg-white/5 rounded-lg hidden sm:block" />
              <div className="h-7 w-20 bg-white/5 rounded-lg hidden lg:block" />
              <div className="w-8 h-8 rounded-lg bg-white/5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminCouriersPage() {
  const [couriers, setCouriers] = useState<CourierRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(8);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [selectedCourier, setSelectedCourier] = useState<CourierRow | null>(null);

  const fetchCouriers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('couriers')
        .select('*, profiles(name, email)')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching couriers:', error);
        toast.error('Error al cargar repartidores');
        setLoading(false);
        return;
      }

      const rows: CourierRow[] = (data || []).map((c: any) => ({
        ...c,
        name: c.profiles?.name || 'Sin nombre',
        email: c.profiles?.email || '',
      }));
      setCouriers(rows);
    } catch (err) {
      console.error('Error:', err);
      toast.error('Error al cargar repartidores');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCouriers();
  }, [fetchCouriers]);

  const filtered = couriers.filter((c) => {
    return c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase());
  });

  const displayed = filtered.slice(0, visibleCount);

  const toggleStatus = async (courierId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'suspended' ? 'offline' : 'suspended';
      const { error } = await supabase
        .from('couriers')
        .update({ status: newStatus, is_online: false })
        .eq('id', courierId);

      if (error) {
        toast.error('Error al actualizar estado');
        return;
      }

      toast.success(newStatus === 'suspended' ? 'Repartidor suspendido' : 'Repartidor reactivado');
      setCouriers(prev => prev.map(c => c.id === courierId ? { ...c, status: newStatus, is_online: false } : c));
    } catch (err) {
      toast.error('Error al actualizar estado');
    }
    setOpenMenu(null);
  };

  const toggleOnline = async (courierId: string, currentOnline: boolean) => {
    try {
      const newOnline = !currentOnline;
      const newStatus = newOnline ? 'online' : 'offline';
      const { error } = await supabase
        .from('couriers')
        .update({ is_online: newOnline, status: newStatus })
        .eq('id', courierId);

      if (error) {
        toast.error('Error al cambiar estado');
        return;
      }

      toast.success(newOnline ? 'Repartidor ahora en linea' : 'Repartidor desconectado');
      setCouriers(prev => prev.map(c => c.id === courierId ? { ...c, is_online: newOnline, status: newStatus } : c));
    } catch (err) {
      toast.error('Error al cambiar estado');
    }
    setOpenMenu(null);
  };

  // Stats
  const totalCouriers = couriers.length;
  const onlineCouriers = couriers.filter(c => c.is_online || c.status === 'online' || c.status === 'delivering').length;
  const suspendedCouriers = couriers.filter(c => c.status === 'suspended').length;

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('es-CR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <Truck className="w-8 h-8 text-orange-400" />
            Repartidores
          </h1>
          <p className="text-gray-400 mt-1">{loading ? 'Cargando...' : `${totalCouriers} repartidores registrados`}</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            {onlineCouriers} en linea
          </span>
          <span className="text-gray-600">|</span>
          <span className="flex items-center gap-1.5 text-gray-400">
            <Users className="w-3.5 h-3.5" />
            {totalCouriers} total
          </span>
          <span className="text-gray-600">|</span>
          <span className="flex items-center gap-1.5 text-red-400">
            <Ban className="w-3.5 h-3.5" />
            {suspendedCouriers} suspendidos
          </span>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
        <Link href="/admin" className="hover:text-white transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          Panel
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-white font-medium">Repartidores</span>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-5"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">Total Repartidores</p>
              <p className="text-2xl font-bold text-white mt-1">{totalCouriers}</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-600 to-purple-500 flex items-center justify-center">
              <Truck className="w-5 h-5 text-white" />
            </div>
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="glass rounded-2xl p-5"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">En Linea Ahora</p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">{onlineCouriers}</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-600 to-cyan-500 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-white" />
            </div>
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-2xl p-5"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">Entregas Totales</p>
              <p className="text-2xl font-bold text-white mt-1">
                {couriers.reduce((sum, c) => sum + (c.total_deliveries || 0), 0)}
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-500 flex items-center justify-center">
              <Package className="w-5 h-5 text-white" />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Search */}
      <div className="glass rounded-2xl p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar repartidores por nombre o email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-orange-500 text-white placeholder:text-gray-600 outline-none text-sm transition-all"
          />
        </div>
      </div>

      {/* Courier List */}
      <div className="space-y-2">
        {loading ? (
          <LoadingSkeleton />
        ) : (
          <>
            <AnimatePresence mode="popLayout">
              {displayed.map((courier, i) => {
                const VIcon = vehicleIcons[courier.vehicle_type] || Truck;
                const st = statusBadge[courier.status] || statusBadge.offline;
                const vc = vehicleColors[courier.vehicle_type] || vehicleColors.moto;
                return (
                  <motion.div
                    key={courier.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ delay: i * 0.03 }}
                    className="glass rounded-xl p-4 hover:bg-white/[0.07] transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      {/* Avatar */}
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 bg-gradient-to-br from-orange-600 to-purple-500 text-white">
                        {courier.name.charAt(0)}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-white truncate">{courier.name}</h3>
                          {courier.is_verified && <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />}
                          {courier.status === 'suspended' && <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            {courier.email}
                          </span>
                        </div>
                      </div>

                      {/* Vehicle */}
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${vc} hidden sm:inline-flex items-center gap-1`}>
                        <VIcon className="w-3 h-3" />
                        {vehicleLabels[courier.vehicle_type] || courier.vehicle_type}
                      </span>

                      {/* Status */}
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${st.color} hidden sm:inline-flex items-center gap-1`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${
                          courier.status === 'online' || courier.status === 'delivering' ? 'bg-emerald-400 animate-pulse' : 'bg-current opacity-50'
                        }`} />
                        {st.label}
                      </span>

                      {/* Stats */}
                      <div className="hidden lg:flex items-center gap-3 text-xs text-gray-500 w-40">
                        <span className="flex items-center gap-1">
                          <Package className="w-3 h-3" />
                          {courier.total_deliveries}
                        </span>
                        <span className="flex items-center gap-1">
                          <Star className="w-3 h-3 text-amber-400" />
                          {Number(courier.rating) > 0 ? Number(courier.rating).toFixed(1) : '5.0'}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="relative flex-shrink-0">
                        <button
                          onClick={() => setOpenMenu(openMenu === courier.id ? null : courier.id)}
                          className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>

                        <AnimatePresence>
                          {openMenu === courier.id && (
                            <motion.div
                              initial={{ opacity: 0, y: -5, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: -5, scale: 0.95 }}
                              className="absolute right-0 top-10 w-52 glass-strong rounded-xl py-1.5 z-20 shadow-xl"
                            >
                              <button
                                onClick={() => { setSelectedCourier(courier); setOpenMenu(null); }}
                                className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                              >
                                <Eye className="w-4 h-4 text-cyan-400" /> Ver perfil
                              </button>
                              <button
                                onClick={() => toggleOnline(courier.id, courier.is_online)}
                                className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                              >
                                {courier.is_online ? (
                                  <><ToggleRight className="w-4 h-4 text-emerald-400" /> Desconectar</>
                                ) : (
                                  <><ToggleLeft className="w-4 h-4 text-gray-400" /> Conectar</>
                                )}
                              </button>
                              {!courier.is_verified && (
                                <button
                                  onClick={async () => {
                                    const { error } = await supabase.from('couriers').update({ is_verified: true }).eq('id', courier.id);
                                    if (error) {
                                      toast.error('Error al verificar repartidor');
                                      return;
                                    }
                                    setCouriers(prev => prev.map(c => c.id === courier.id ? { ...c, is_verified: true } : c));
                                    toast.success('Repartidor verificado');
                                    setOpenMenu(null);
                                  }}
                                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                                >
                                  <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Verificar
                                </button>
                              )}
                              <button
                                onClick={() => toggleStatus(courier.id, courier.status)}
                                className={`w-full flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-white/5 transition-colors ${
                                  courier.status === 'suspended' ? 'text-emerald-400 hover:text-emerald-300' : 'text-red-400 hover:text-red-300'
                                }`}
                              >
                                {courier.status === 'suspended' ? (
                                  <><ToggleRight className="w-4 h-4" /> Reactivar</>
                                ) : (
                                  <><Ban className="w-4 h-4" /> Suspender</>
                                )}
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Load More */}
            {visibleCount < filtered.length && (
              <motion.button
                onClick={() => setVisibleCount((v) => v + 6)}
                className="w-full py-3 glass rounded-xl text-sm text-orange-400 hover:text-orange-300 hover:bg-white/[0.07] transition-all flex items-center justify-center gap-2"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                <ChevronDown className="w-4 h-4" />
                Cargar mas ({filtered.length - visibleCount} restantes)
              </motion.button>
            )}

            {filtered.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <Truck className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No se encontraron repartidores</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Courier Profile Modal */}
      <AnimatePresence>
        {selectedCourier && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/60" onClick={() => setSelectedCourier(null)} />
            <motion.div
              className="relative glass-strong rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto z-10"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-white">Perfil del Repartidor</h2>
                <button
                  type="button"
                  onClick={() => setSelectedCourier(null)}
                  className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Profile Info */}
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold bg-gradient-to-br from-orange-600 to-purple-500 text-white flex-shrink-0">
                  {selectedCourier.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-white truncate">{selectedCourier.name}</h3>
                    {selectedCourier.is_verified && <CheckCircle2 className="w-4 h-4 text-cyan-400 flex-shrink-0" />}
                  </div>
                  <p className="text-sm text-gray-400 truncate">{selectedCourier.email}</p>
                  <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-lg text-xs font-medium border ${statusBadge[selectedCourier.status]?.color || statusBadge.offline.color}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      selectedCourier.status === 'online' || selectedCourier.status === 'delivering' ? 'bg-emerald-400 animate-pulse' : 'bg-current opacity-50'
                    }`} />
                    {statusBadge[selectedCourier.status]?.label || 'Desconectado'}
                  </span>
                </div>
              </div>

              {/* Details Grid */}
              <div className="space-y-3 mb-6">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-xs text-gray-500">Vehiculo</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      {(() => { const VI = vehicleIcons[selectedCourier.vehicle_type] || Truck; return <VI className="w-4 h-4 text-gray-300" />; })()}
                      <span className="text-sm font-medium text-white">{vehicleLabels[selectedCourier.vehicle_type] || selectedCourier.vehicle_type || 'N/A'}</span>
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-xs text-gray-500">Rating</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Star className="w-4 h-4 text-amber-400" />
                      <span className="text-sm font-medium text-white">{Number(selectedCourier.rating) > 0 ? Number(selectedCourier.rating).toFixed(1) : '5.0'}</span>
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-xs text-gray-500">Entregas</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Package className="w-4 h-4 text-gray-300" />
                      <span className="text-sm font-medium text-white">{selectedCourier.total_deliveries || 0}</span>
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-xs text-gray-500">Ganancias</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-sm font-medium text-emerald-400">₡{Math.round(selectedCourier.total_earnings || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-xs text-gray-500">Verificacion</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      {selectedCourier.is_verified ? (
                        <><CheckCircle2 className="w-4 h-4 text-cyan-400" /><span className="text-sm font-medium text-cyan-400">Verificado</span></>
                      ) : (
                        <><XCircle className="w-4 h-4 text-red-400" /><span className="text-sm font-medium text-red-400">No verificado</span></>
                      )}
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-xs text-gray-500">Registrado</p>
                    <span className="text-sm font-medium text-white mt-1 block">{formatDate(selectedCourier.created_at)}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2">
                {!selectedCourier.is_verified && (
                  <button
                    type="button"
                    onClick={async () => {
                      const { error } = await supabase.from('couriers').update({ is_verified: true }).eq('id', selectedCourier.id);
                      if (error) { toast.error('Error al verificar'); return; }
                      setCouriers(prev => prev.map(c => c.id === selectedCourier.id ? { ...c, is_verified: true } : c));
                      setSelectedCourier(prev => prev ? { ...prev, is_verified: true } : null);
                      toast.success('Repartidor verificado');
                    }}
                    className="w-full py-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm font-medium hover:bg-cyan-500/20 transition-all flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Verificar Repartidor
                  </button>
                )}
                {selectedCourier.is_verified && (
                  <button
                    type="button"
                    onClick={async () => {
                      const { error } = await supabase.from('couriers').update({ is_verified: false }).eq('id', selectedCourier.id);
                      if (error) { toast.error('Error al quitar verificacion'); return; }
                      setCouriers(prev => prev.map(c => c.id === selectedCourier.id ? { ...c, is_verified: false } : c));
                      setSelectedCourier(prev => prev ? { ...prev, is_verified: false } : null);
                      toast.success('Verificacion removida');
                    }}
                    className="w-full py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-medium hover:bg-amber-500/20 transition-all flex items-center justify-center gap-2"
                  >
                    <XCircle className="w-4 h-4" /> Quitar Verificacion
                  </button>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => toggleOnline(selectedCourier.id, selectedCourier.is_online)}
                    className="py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm font-medium hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                  >
                    {selectedCourier.is_online ? (
                      <><ToggleRight className="w-4 h-4 text-emerald-400" /> Desconectar</>
                    ) : (
                      <><ToggleLeft className="w-4 h-4" /> Conectar</>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      toggleStatus(selectedCourier.id, selectedCourier.status);
                      setSelectedCourier(prev => prev ? { ...prev, status: selectedCourier.status === 'suspended' ? 'offline' : 'suspended' } : null);
                    }}
                    className={`py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                      selectedCourier.status === 'suspended'
                        ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                        : 'bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20'
                    }`}
                  >
                    {selectedCourier.status === 'suspended' ? (
                      <><ToggleRight className="w-4 h-4" /> Reactivar</>
                    ) : (
                      <><Ban className="w-4 h-4" /> Suspender</>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
