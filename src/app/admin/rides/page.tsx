'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, MapPin, DollarSign, CheckCircle2, XCircle, Clock,
  Eye, Ban, XCircle as XIcon, Loader2,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  RefreshCw, Car, ArrowLeftRight, Calendar, Filter,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

type RideStatus = 'completed' | 'cancelled' | 'in_progress' | 'pending' | 'scheduled' | 'searching' | 'assigned' | 'arriving' | 'started';

interface RideRow {
  id: string;
  realId: string;
  passenger: string;
  driver: string;
  driverId: string | null;
  origin: string;
  destination: string;
  price: number;
  paymentMethod: string;
  status: RideStatus;
  date: string;
  duration: string;
  distance: string;
}

interface DriverOption {
  id: string;
  name: string;
}

const PAGE_SIZE = 20;

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  completed: { label: 'Completado', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: CheckCircle2 },
  cancelled: { label: 'Cancelado', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: XCircle },
  in_progress: { label: 'En curso', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30', icon: Clock },
  pending: { label: 'Pendiente', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: Clock },
  scheduled: { label: 'Programado', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: Calendar },
  searching: { label: 'Buscando', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', icon: Search },
  assigned: { label: 'Asignado', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: Car },
  arriving: { label: 'Llegando', color: 'bg-violet-500/20 text-violet-400 border-violet-500/30', icon: ArrowLeftRight },
  started: { label: 'En curso', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30', icon: Clock },
};

const filterTabs = [
  { label: 'Todos', value: 'all' },
  { label: 'Buscando', value: 'searching' },
  { label: 'Programados', value: 'scheduled' },
  { label: 'Asignado', value: 'assigned' },
  { label: 'Llegando', value: 'arriving' },
  { label: 'En curso', value: 'started' },
  { label: 'Completados', value: 'completed' },
  { label: 'Cancelados', value: 'cancelled' },
] as const;

const dateFilters = ['Todos', 'Hoy', 'Esta semana', 'Este mes'] as const;

function buildDateFilter(dateFilter: string): string | null {
  if (dateFilter === 'Hoy') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.toISOString();
  } else if (dateFilter === 'Esta semana') {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return weekAgo.toISOString();
  } else if (dateFilter === 'Este mes') {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return monthStart.toISOString();
  }
  return null;
}

function formatCurrency(amount: number): string {
  return `₡${amount.toLocaleString()}`;
}

/* ─── Loading Skeleton ────────────────────────────────────── */
function RidesSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-9 w-48 bg-white/10" />
        <Skeleton className="h-5 w-64 mt-2 bg-white/5" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="glass rounded-xl p-4">
            <Skeleton className="h-5 w-20 bg-white/10 mb-2" />
            <Skeleton className="h-8 w-12 bg-white/5" />
          </div>
        ))}
      </div>
      <div className="glass rounded-2xl p-4">
        <Skeleton className="h-10 w-full bg-white/5" />
        <div className="flex gap-2 mt-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 bg-white/5" />
          ))}
        </div>
        <div className="flex gap-2 mt-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 bg-white/5" />
          ))}
        </div>
      </div>
      <div className="glass rounded-2xl overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="border-b border-white/5 px-5 py-4 flex items-center gap-4">
            <Skeleton className="h-4 w-16 bg-white/5" />
            <Skeleton className="h-4 w-24 bg-white/5" />
            <Skeleton className="h-4 w-24 bg-white/5 hidden md:block" />
            <Skeleton className="h-6 w-20 bg-white/5" />
            <Skeleton className="h-4 w-12 bg-white/5 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function RidesPage() {
  const [rides, setRides] = useState<RideRow[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('Hoy');
  const [selectedRide, setSelectedRide] = useState<RideRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  /* ─── Reassign driver state ──────────────────────────── */
  const [reassignRide, setReassignRide] = useState<RideRow | null>(null);
  const [availableDrivers, setAvailableDrivers] = useState<DriverOption[]>([]);
  const [reassignLoading, setReassignLoading] = useState(false);
  const [selectedDriverForReassign, setSelectedDriverForReassign] = useState('');
  const [reassigning, setReassigning] = useState(false);

  const fetchRides = useCallback(async (currentDateFilter: string) => {
    setLoading(true);
    try {
      const dateThreshold = buildDateFilter(currentDateFilter);

      let query = supabase
        .from('rides')
        .select('*')
        .order('created_at', { ascending: false });

      if (dateThreshold) {
        query = query.gte('created_at', dateThreshold);
      }

      const { data: rideData, error } = await query;

      if (error) {
        console.error('Error fetching rides:', error);
        toast.error('Error al cargar viajes');
        setLoading(false);
        return;
      }

      const riderIds = [...new Set((rideData || []).map(r => r.rider_id).filter(Boolean))];
      const driverIds = [...new Set((rideData || []).map(r => r.driver_id).filter(Boolean))];

      const profileMap: Record<string, string> = {};
      const driverMap: Record<string, string> = {};

      if (riderIds.length > 0) {
        const { data: riderProfiles } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', riderIds);
        if (riderProfiles) {
          riderProfiles.forEach(p => { profileMap[p.id] = p.name; });
        }
      }

      if (driverIds.length > 0) {
        const { data: driverRecords } = await supabase
          .from('drivers')
          .select('id, user_id')
          .in('id', driverIds);
        if (driverRecords) {
          const driverUserIds = driverRecords.map(d => d.user_id).filter(Boolean);
          const driverIdToUserId: Record<string, string> = {};
          driverRecords.forEach(d => { driverIdToUserId[d.id] = d.user_id; });

          if (driverUserIds.length > 0) {
            const { data: driverProfiles } = await supabase
              .from('profiles')
              .select('id, name')
              .in('id', driverUserIds);
            if (driverProfiles) {
              const userProfileMap: Record<string, string> = {};
              driverProfiles.forEach(p => { userProfileMap[p.id] = p.name; });
              Object.entries(driverIdToUserId).forEach(([dId, uId]) => {
                driverMap[dId] = userProfileMap[uId] || 'Desconocido';
              });
            }
          }
        }
      }

      const validStatuses: RideStatus[] = ['completed', 'cancelled', 'pending', 'scheduled', 'searching', 'assigned', 'arriving', 'started', 'in_progress'];
      const mapped: RideRow[] = (rideData || []).map(r => {
        const uiStatus: RideStatus = validStatuses.includes(r.status) ? r.status as RideStatus : 'pending';

        const dur = r.duration ? `${Math.round(r.duration)} min` : (['in_progress', 'started'].includes(uiStatus) ? 'En curso' : '-');
        const dist = r.distance ? `${r.distance.toFixed(1)} km` : '-';

        const paymentLabels: Record<string, string> = {
          cash: 'Efectivo',
          wallet: 'Billetera',
          card: 'Tarjeta',
          sinpe: 'SINPE',
        };

        return {
          id: r.id.slice(0, 8).toUpperCase(),
          realId: r.id,
          passenger: profileMap[r.rider_id] || 'Desconocido',
          driver: driverMap[r.driver_id || ''] || 'Sin asignar',
          driverId: r.driver_id || null,
          origin: r.origin || r.origin_address || '-',
          destination: r.destination || r.dest_address || '-',
          price: r.price || 0,
          paymentMethod: paymentLabels[r.payment_method || ''] || r.payment_method || '-',
          status: uiStatus,
          date: r.created_at,
          duration: dur,
          distance: dist,
        };
      });

      setRides(mapped);
    } catch (err) {
      console.error('Error fetching rides:', err);
      toast.error('Error al cargar viajes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRides(dateFilter);
  }, [dateFilter, fetchRides]);

  const filteredRides = rides.filter((r) => {
    const matchSearch = r.id.toLowerCase().includes(search.toLowerCase()) ||
      r.passenger.toLowerCase().includes(search.toLowerCase()) ||
      r.driver.toLowerCase().includes(search.toLowerCase()) ||
      r.origin.toLowerCase().includes(search.toLowerCase()) ||
      r.destination.toLowerCase().includes(search.toLowerCase());

    let matchStatus = true;
    if (statusFilter !== 'all') {
      if (statusFilter === 'searching') {
        matchStatus = r.status === 'searching' || r.status === 'pending';
      } else if (statusFilter === 'started') {
        // "En curso" tab matches both started and in_progress
        matchStatus = r.status === 'started' || r.status === 'in_progress';
      } else {
        matchStatus = r.status === statusFilter;
      }
    }
    return matchSearch && matchStatus;
  });

  const totalRevenue = rides.filter(r => r.status === 'completed').reduce((sum, r) => sum + r.price, 0);
  const completedToday = rides.filter(r => r.status === 'completed').length;
  const cancelledCount = rides.filter(r => r.status === 'cancelled').length;
  const scheduledCount = rides.filter(r => r.status === 'scheduled').length;
  const activeNow = rides.filter(r => ['assigned', 'arriving', 'started', 'in_progress', 'searching', 'pending'].includes(r.status)).length;

  const stats = [
    { label: 'Total Viajes', value: rides.length, color: 'text-white' },
    { label: 'Activos', value: activeNow, color: 'text-cyan-400' },
    { label: 'Completados', value: completedToday, color: 'text-emerald-400' },
    { label: 'Programados', value: scheduledCount, color: 'text-purple-400' },
    { label: 'Ingresos', value: formatCurrency(totalRevenue), color: 'text-amber-400' },
  ];

  const cancelRide = async (rideRealId: string, rideShortId: string) => {
    try {
      const { error } = await supabase
        .from('rides')
        .update({ status: 'cancelled' })
        .eq('id', rideRealId);

      if (error) {
        toast.error('Error al cancelar viaje');
        return;
      }

      setRides(prev => prev.map(r =>
        r.id === rideShortId ? { ...r, status: 'cancelled' as RideStatus } : r
      ));
      toast.success(`Viaje ${rideShortId} cancelado`);
      if (selectedRide?.id === rideShortId) {
        setSelectedRide(prev => prev ? { ...prev, status: 'cancelled' } : null);
      }
    } catch (err) {
      console.error('Cancel error:', err);
      toast.error('Error al cancelar viaje');
    }
  };

  /* ─── Reassign driver ─────────────────────────────────── */
  const openReassign = async (ride: RideRow) => {
    setReassignRide(ride);
    setSelectedRide(null);
    setReassignLoading(true);
    setSelectedDriverForReassign('');

    try {
      const { data: driverRecords } = await supabase
        .from('drivers')
        .select('id, user_id, status')
        .eq('status', 'online')
        .limit(50);

      if (driverRecords && driverRecords.length > 0) {
        const userIds = driverRecords.map(d => d.user_id).filter(Boolean);
        const driverIdToUserId: Record<string, string> = {};
        driverRecords.forEach(d => { driverIdToUserId[d.id] = d.user_id; });

        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', userIds);

        if (profiles) {
          const profMap: Record<string, string> = {};
          profiles.forEach(p => { profMap[p.id] = p.name; });
          const options: DriverOption[] = driverRecords.map(d => ({
            id: d.id,
            name: profMap[d.user_id] || 'Conductor',
          }));
          setAvailableDrivers(options);
        }
      }
    } catch (err) {
      console.error('Error fetching drivers for reassign:', err);
      toast.error('Error al cargar conductores disponibles');
    } finally {
      setReassignLoading(false);
    }
  };

  const executeReassign = async () => {
    if (!reassignRide || !selectedDriverForReassign) return;

    setReassigning(true);
    try {
      const { error } = await supabase
        .from('rides')
        .update({ driver_id: selectedDriverForReassign, status: 'assigned' })
        .eq('id', reassignRide.realId);

      if (error) {
        toast.error('Error al reasignar conductor');
        return;
      }

      toast.success('Conductor reasignado exitosamente');
      setReassignRide(null);
      fetchRides(dateFilter);
    } catch (err) {
      console.error('Reassign error:', err);
      toast.error('Error al reasignar conductor');
    } finally {
      setReassigning(false);
    }
  };

  const totalFiltered = filteredRides.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
  const paginatedRides = filteredRides.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const showingFrom = totalFiltered > 0 ? (page - 1) * PAGE_SIZE + 1 : 0;
  const showingTo = Math.min(page * PAGE_SIZE, totalFiltered);

  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    const end = Math.min(totalPages, start + maxVisible - 1);
    start = Math.max(1, end - maxVisible + 1);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }, [page, totalPages]);

  // Clamp page if filters reduce total pages below current page
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [totalPages, page]);

  const handleDateFilterChange = (df: string) => {
    setDateFilter(df);
    setPage(1);
  };

  if (loading) return <RidesSkeleton />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Viajes</h1>
          <p className="text-gray-400 mt-1">Gestion y seguimiento de todos los viajes</p>
        </div>
        <button
          onClick={() => fetchRides(dateFilter)}
          className="flex items-center gap-2 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Actualizar
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map((stat, i) => (
          <motion.div key={i} className="glass rounded-xl p-4" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <p className="text-xs text-gray-500 uppercase tracking-wider">{stat.label}</p>
            <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="glass rounded-2xl p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Buscar por ID, pasajero, conductor, origen o destino..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-cyan-500 text-white placeholder:text-gray-600 outline-none text-sm transition-all"
            />
          </div>
          <div className="flex gap-2">
            {dateFilters.map((df) => (
              <button
                key={df}
                onClick={() => handleDateFilterChange(df)}
                className={`px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                  dateFilter === df ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-white/5 text-gray-400 hover:text-white border border-transparent'
                }`}
              >
                {df}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
          {filterTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => { setStatusFilter(tab.value); setPage(1); }}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                statusFilter === tab.value
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-transparent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Rides Table */}
      <motion.div className="glass rounded-2xl overflow-hidden" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">ID</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Pasajero</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider hidden md:table-cell">Conductor</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider hidden xl:table-cell">Origen</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider hidden xl:table-cell">Destino</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Estado</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Precio</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRides.map((ride, i) => {
                const cfg = statusConfig[ride.status] || statusConfig.pending;
                const StatusIcon = cfg.icon;
                const canCancel = ['pending', 'searching', 'assigned', 'arriving', 'started', 'in_progress'].includes(ride.status);
                const canReassign = canCancel;

                return (
                  <motion.tr
                    key={ride.realId}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 + i * 0.03 }}
                  >
                    <td className="px-5 py-3 text-sm text-cyan-400 font-mono">{ride.id}</td>
                    <td className="px-5 py-3 text-sm text-white">{ride.passenger}</td>
                    <td className="px-5 py-3 text-sm text-gray-400 hidden md:table-cell">{ride.driver}</td>
                    <td className="px-5 py-3 text-sm text-gray-400 hidden xl:table-cell max-w-[180px] truncate">{ride.origin}</td>
                    <td className="px-5 py-3 text-sm text-gray-400 hidden xl:table-cell max-w-[180px] truncate">{ride.destination}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-white text-right font-medium">{formatCurrency(ride.price)}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setSelectedRide(ride)}
                          className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all"
                          title="Ver detalles"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {canReassign && (
                          <button
                            onClick={() => openReassign(ride)}
                            className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
                            title="Reasignar conductor"
                          >
                            <Car className="w-4 h-4" />
                          </button>
                        )}
                        {canCancel && (
                          <button
                            onClick={() => cancelRide(ride.realId, ride.id)}
                            className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                            title="Cancelar"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {paginatedRides.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <MapPin className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>No se encontraron viajes</p>
          </div>
        )}

        {/* Pagination */}
        {totalFiltered > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-white/5">
            <p className="text-xs text-gray-400">
              Mostrando {showingFrom}-{showingTo} de {totalFiltered} viajes
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="Primera pagina"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="Pagina anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {pageNumbers.map((pageNum) => (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`min-w-[2rem] h-8 rounded-lg flex items-center justify-center text-xs font-medium transition-all ${
                    page === pageNum
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                      : 'text-gray-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {pageNum}
                </button>
              ))}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="Pagina siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="Ultima pagina"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* ═══════════════════════════════════════════════════════
          RIDE DETAIL MODAL
          ═══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {selectedRide && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedRide(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="glass-strong rounded-2xl p-6 w-full max-w-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">Detalle del Viaje</h2>
                <button onClick={() => setSelectedRide(null)} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white">
                  <XIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-cyan-400 font-mono text-sm">{selectedRide.id}</span>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${(statusConfig[selectedRide.status] || statusConfig.pending).color}`}>
                    {(statusConfig[selectedRide.status] || statusConfig.pending).label}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-xs text-gray-500">Pasajero</p>
                    <p className="text-sm text-white mt-0.5">{selectedRide.passenger}</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-xs text-gray-500">Conductor</p>
                    <p className="text-sm text-white mt-0.5">{selectedRide.driver}</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-xs text-gray-500">Origen</p>
                    <p className="text-sm text-white mt-0.5">{selectedRide.origin}</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-xs text-gray-500">Destino</p>
                    <p className="text-sm text-white mt-0.5">{selectedRide.destination}</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-xs text-gray-500">Precio</p>
                    <p className="text-sm text-emerald-400 mt-0.5 font-bold">{formatCurrency(selectedRide.price)}</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-xs text-gray-500">Metodo de Pago</p>
                    <p className="text-sm text-white mt-0.5">{selectedRide.paymentMethod}</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-xs text-gray-500">Fecha</p>
                    <p className="text-sm text-white mt-0.5">{new Date(selectedRide.date).toLocaleString('es-CR')}</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-xs text-gray-500">Duracion</p>
                    <p className="text-sm text-white mt-0.5">{selectedRide.duration}</p>
                  </div>
                </div>

                {/* Route visualization */}
                <div className="bg-white/5 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-cyan-400" />
                      <div className="w-0.5 h-8 bg-gradient-to-b from-cyan-400 to-emerald-400" />
                      <div className="w-3 h-3 rounded-full bg-emerald-400" />
                    </div>
                    <div className="flex-1 space-y-6">
                      <div>
                        <p className="text-xs text-gray-500">Origen</p>
                        <p className="text-sm text-white">{selectedRide.origin}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Destino</p>
                        <p className="text-sm text-white">{selectedRide.destination}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                {(['pending', 'searching', 'assigned', 'arriving', 'started', 'in_progress'].includes(selectedRide.status)) && (
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => {
                        cancelRide(selectedRide.realId, selectedRide.id);
                        setSelectedRide(null);
                      }}
                      className="flex-1 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-colors"
                    >
                      Cancelar Viaje
                    </button>
                    <button
                      onClick={() => {
                        openReassign(selectedRide);
                      }}
                      className="flex-1 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 text-sm font-medium hover:bg-blue-500/20 transition-colors"
                    >
                      Reasignar Conductor
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════
          REASSIGN DRIVER MODAL
          ═══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {reassignRide && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setReassignRide(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="glass-strong rounded-2xl p-6 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <ArrowLeftRight className="w-5 h-5 text-blue-400" />
                    Reasignar Conductor
                  </h2>
                  <p className="text-xs text-gray-400 mt-1">Viaje {reassignRide.id}</p>
                </div>
                <button onClick={() => setReassignRide(null)} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white">
                  <XIcon className="w-5 h-5" />
                </button>
              </div>

              {reassignLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-gray-400 block mb-2">Conductor actual: <span className="text-gray-300">{reassignRide.driver}</span></label>
                  </div>

                  {availableDrivers.length === 0 ? (
                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 text-center">
                      <p className="text-sm text-amber-400">No hay conductores disponibles en linea</p>
                    </div>
                  ) : (
                    <div>
                      <label className="text-xs text-gray-400 block mb-2">Seleccionar nuevo conductor</label>
                      <div className="max-h-48 overflow-y-auto space-y-2">
                        {availableDrivers.map((driver) => (
                          <button
                            key={driver.id}
                            onClick={() => setSelectedDriverForReassign(driver.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all ${
                              selectedDriverForReassign === driver.id
                                ? 'bg-blue-500/20 border border-blue-500/40 text-white'
                                : 'bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10'
                            }`}
                          >
                            <Car className={`w-4 h-4 ${selectedDriverForReassign === driver.id ? 'text-blue-400' : 'text-gray-500'}`} />
                            <span>{driver.name}</span>
                            <span className="text-xs text-gray-500 ml-auto">{driver.id.slice(0, 6)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setReassignRide(null)}
                      className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-300 text-sm hover:bg-white/5 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={executeReassign}
                      disabled={!selectedDriverForReassign || reassigning}
                      className="flex-1 py-2.5 rounded-xl btn-neon text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {reassigning ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Reasignando...
                        </>
                      ) : (
                        'Reasignar'
                      )}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
