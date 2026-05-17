'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  ShieldAlert, Search, Filter, ChevronRight, ArrowLeft,
  Loader2, Ban, UserCheck, Download, RefreshCw, User, Mail,
  Phone, Car, AlertTriangle, Clock, XCircle, CheckCircle2,
  ChevronLeft, ChevronDown, Eye,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface DriverAlert {
  driver_id: string;
  user_id: string;
  driver_name: string;
  driver_email: string;
  driver_phone: string;
  driver_status: string;
  vehicle_info: string;
  cancelled_24h: number;
  declined_24h: number;
  cancelled_total: number;
  declined_total: number;
  is_blocked: boolean;
  blocked_at: string | null;
  block_reason: string | null;
  total_rides: number;
  accept_rate: number;
}

interface AlertsSummary {
  total_drivers: number;
  blocked_drivers: number;
  high_cancel_24h: number;
  total_cancelled_24h: number;
  total_declined_24h: number;
}

/* ─── Loading Skeleton ─────────────────────────────────────────────────────── */

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {/* Stats skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="glass rounded-xl p-4 animate-pulse">
            <div className="h-3 w-24 bg-white/5 rounded mb-2" />
            <div className="h-7 w-12 bg-white/5 rounded" />
          </div>
        ))}
      </div>
      {/* Table skeleton */}
      <div className="glass rounded-2xl p-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 animate-pulse">
            <div className="h-4 w-32 bg-white/5 rounded" />
            <div className="h-4 w-40 bg-white/5 rounded" />
            <div className="h-4 w-16 bg-white/5 rounded" />
            <div className="h-4 w-16 bg-white/5 rounded" />
            <div className="h-4 w-16 bg-white/5 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export default function CancelledTripsAlertPage() {
  const { user } = useAuthStore();

  /* ── State ─────────────────────────────────────────────────────── */
  const [drivers, setDrivers] = useState<DriverAlert[]>([]);
  const [summary, setSummary] = useState<AlertsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);

  // Modal states
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showUnblockModal, setShowUnblockModal] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<DriverAlert | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Detail modal
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailDriver, setDetailDriver] = useState<DriverAlert | null>(null);

  /* ── Fetch Drivers ────────────────────────────────────────────── */
  const fetchDrivers = useCallback(async () => {
    setLoading(true);
    try {
      const offset = (page - 1) * pageSize;

      const { data, error } = await supabase.rpc('get_driver_trip_alerts', {
        p_search: search,
        p_status_filter: statusFilter,
        p_limit: pageSize,
        p_offset: offset,
      });

      if (error) throw error;
      setDrivers((data || []) as unknown as DriverAlert[]);

      // Fetch count for pagination
      const { data: countData, error: countError } = await supabase.rpc(
        'get_driver_trip_alerts_count',
        { p_search: search, p_status_filter: statusFilter }
      );

      if (!countError && countData !== null) {
        setTotalCount(Number(countData));
      }
    } catch (err: unknown) {
      console.error('fetchDrivers error:', err);
      const message = err instanceof Error
        ? err.message
        : (err && typeof err === 'object' && 'message' in err)
          ? String((err as { message: unknown }).message)
          : String(err);
      toast.error(`Error al cargar datos: ${message}`);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, page, pageSize]);

  /* ── Fetch Summary ────────────────────────────────────────────── */
  const fetchSummary = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_alerts_summary');
      if (error) throw error;
      if (data && data.length > 0) {
        setSummary(data[0] as unknown as AlertsSummary);
      }
    } catch {
      // Silent fail for summary
    }
  }, []);

  /* ── Effects ──────────────────────────────────────────────────── */
  useEffect(() => {
    fetchDrivers();
    fetchSummary();
  }, [fetchDrivers, fetchSummary]);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  /* ── Block Driver ─────────────────────────────────────────────── */
  const handleBlock = async () => {
    if (!selectedDriver) return;
    if (!blockReason.trim()) {
      toast.error('Debes ingresar una razon para bloquear');
      return;
    }

    setActionLoading(true);
    try {
      const { data, error } = await supabase.rpc('toggle_driver_block', {
        p_driver_id: selectedDriver.driver_id,
        p_block: true,
        p_reason: blockReason,
        p_admin_id: user?.id,
      });

      if (error) throw error;

      const result = data && data.length > 0 ? data[0] : null;
      if (result?.success) {
        toast.success(result.message);
        setShowBlockModal(false);
        setBlockReason('');
        setSelectedDriver(null);
        await fetchDrivers();
        await fetchSummary();
      } else {
        toast.error(result?.message || 'No se pudo bloquear al conductor');
      }
    } catch (err: unknown) {
      console.error('handleBlock error:', err);
      const message = err instanceof Error
        ? err.message
        : (err && typeof err === 'object' && 'message' in err)
          ? String((err as { message: unknown }).message)
          : String(err);
      toast.error(`Error al bloquear: ${message}`);
    } finally {
      setActionLoading(false);
    }
  };

  /* ── Unblock Driver ───────────────────────────────────────────── */
  const handleUnblock = async () => {
    if (!selectedDriver) return;

    setActionLoading(true);
    try {
      const { data, error } = await supabase.rpc('toggle_driver_block', {
        p_driver_id: selectedDriver.driver_id,
        p_block: false,
        p_reason: '',
        p_admin_id: user?.id,
      });

      if (error) throw error;

      const result = data && data.length > 0 ? data[0] : null;
      if (result?.success) {
        toast.success(result.message);
        setShowUnblockModal(false);
        setSelectedDriver(null);
        await fetchDrivers();
        await fetchSummary();
      } else {
        toast.error(result?.message || 'No se pudo desbloquear al conductor');
      }
    } catch (err: unknown) {
      console.error('handleUnblock error:', err);
      const message = err instanceof Error
        ? err.message
        : (err && typeof err === 'object' && 'message' in err)
          ? String((err as { message: unknown }).message)
          : String(err);
      toast.error(`Error al desbloquear: ${message}`);
    } finally {
      setActionLoading(false);
    }
  };

  /* ── Export CSV ───────────────────────────────────────────────── */
  const handleExport = async () => {
    try {
      toast.loading('Exportando datos...');
      const { data, error } = await supabase.rpc('get_driver_trip_alerts', {
        p_search: search,
        p_status_filter: statusFilter,
        p_limit: 1000,
        p_offset: 0,
      });

      if (error) throw error;

      const rows = (data || []) as unknown as DriverAlert[];
      if (rows.length === 0) {
        toast.dismiss();
        toast.info('No hay datos para exportar');
        return;
      }

      const headers = [
        'Nombre', 'Email', 'Telefono', 'Estado Conductor', 'Vehiculo',
        'Cancelados 24h', 'Declinados 24h', 'Cancelados Total', 'Declinados Total',
        'Bloqueado', 'Fecha Bloqueo', 'Razon Bloqueo', 'Total Viajes', 'Tasa Aceptacion %'
      ];

      const csvRows = rows.map(r => [
        r.driver_name,
        r.driver_email,
        r.driver_phone,
        r.driver_status,
        r.vehicle_info,
        r.cancelled_24h,
        r.declined_24h,
        r.cancelled_total,
        r.declined_total,
        r.is_blocked ? 'Si' : 'No',
        r.blocked_at ? new Date(r.blocked_at).toLocaleString('es-CR') : '-',
        r.block_reason || '-',
        r.total_rides,
        r.accept_rate,
      ]);

      const csvContent = [
        headers.join(','),
        ...csvRows.map(row =>
          row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
        ),
      ].join('\n');

      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cancelled-trips-alert-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      toast.dismiss();
      toast.success(`Exportados ${rows.length} registros`);
    } catch (err: unknown) {
      toast.dismiss();
      console.error('handleExport error:', err);
      const message = err instanceof Error
        ? err.message
        : (err && typeof err === 'object' && 'message' in err)
          ? String((err as { message: unknown }).message)
          : String(err);
      toast.error(`Error al exportar: ${message}`);
    }
  };

  /* ── Pagination ───────────────────────────────────────────────── */
  const totalPages = Math.ceil(totalCount / pageSize);

  /* ── Stat Cards ───────────────────────────────────────────────── */
  const statCards = [
    {
      label: 'Total Conductores',
      value: summary?.total_drivers ?? '-',
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
      icon: User,
    },
    {
      label: 'Bloqueados',
      value: summary?.blocked_drivers ?? '-',
      color: 'text-red-400',
      bg: 'bg-red-500/10',
      icon: Ban,
    },
    {
      label: 'Alta Cancelacion (24h)',
      value: summary?.high_cancel_24h ?? '-',
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      icon: AlertTriangle,
    },
    {
      label: 'Cancelados (24h)',
      value: summary?.total_cancelled_24h ?? '-',
      color: 'text-orange-400',
      bg: 'bg-orange-500/10',
      icon: XCircle,
    },
    {
      label: 'Declinados (24h)',
      value: summary?.total_declined_24h ?? '-',
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
      icon: Clock,
    },
  ];

  /* ─── Render ──────────────────────────────────────────────────────────── */

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
        <Link href="/admin" className="hover:text-white transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          Panel
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-white font-medium">Alerta Cancelaciones</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <ShieldAlert className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Cancelled Trips Alert</h1>
            <p className="text-sm text-gray-400 max-w-2xl mt-1">
              Monitoreo de viajes cancelados y declinados por conductores. Puedes ver la informacion
              de cada conductor y bloquear a aquellos con alta tasa de cancelacion o decline.
              Los conductores bloqueados no recibiran nuevas solicitudes de viaje.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => { fetchDrivers(); fetchSummary(); }}
            className="px-3 py-2 rounded-lg bg-white/5 text-gray-400 text-xs font-medium flex items-center gap-1.5 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refrescar
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="px-3 py-2 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs font-medium flex items-center gap-1.5 border border-emerald-500/30 hover:bg-emerald-500/25 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {statCards.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={i}
              className="glass rounded-xl p-4"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">{stat.label}</p>
                <div className={`${stat.bg} p-1.5 rounded-lg`}>
                  <Icon className={`w-3.5 h-3.5 ${stat.color}`} />
                </div>
              </div>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Search & Filter Bar */}
      <div className="glass rounded-2xl p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Buscar por nombre, email o telefono..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-cyan-500 text-white placeholder:text-gray-600 outline-none text-sm transition-all"
            />
          </div>
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none pl-4 pr-10 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-cyan-500 text-white text-sm outline-none transition-all cursor-pointer"
            >
              <option value="all" className="bg-gray-900">Todos</option>
              <option value="blocked" className="bg-gray-900">Bloqueados</option>
              <option value="not_blocked" className="bg-gray-900">No Bloqueados</option>
              <option value="high_cancel" className="bg-gray-900">Alta Cancelacion (24h)</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          </div>
          <button
            type="button"
            onClick={() => { setSearch(''); setStatusFilter('all'); }}
            className="px-4 py-2.5 rounded-xl bg-white/5 text-gray-400 text-xs font-medium flex items-center gap-1.5 hover:text-white hover:bg-white/10 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reset
          </button>
        </div>
      </div>

      {/* Data Table */}
      <motion.div
        className="glass rounded-2xl overflow-hidden"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {loading ? (
          <LoadingSkeleton />
        ) : drivers.length > 0 ? (
          <>
            {/* Table Header */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left px-4 py-3 text-[10px] text-gray-500 uppercase tracking-wider font-medium">Conductor</th>
                    <th className="text-left px-4 py-3 text-[10px] text-gray-500 uppercase tracking-wider font-medium hidden lg:table-cell">Email</th>
                    <th className="text-center px-4 py-3 text-[10px] text-gray-500 uppercase tracking-wider font-medium">
                      <div className="flex flex-col items-center">
                        <span>Cancelados</span>
                        <span className="text-[9px] text-gray-600 normal-case">(24h)</span>
                      </div>
                    </th>
                    <th className="text-center px-4 py-3 text-[10px] text-gray-500 uppercase tracking-wider font-medium">
                      <div className="flex flex-col items-center">
                        <span>Declinados</span>
                        <span className="text-[9px] text-gray-600 normal-case">(24h)</span>
                      </div>
                    </th>
                    <th className="text-center px-4 py-3 text-[10px] text-gray-500 uppercase tracking-wider font-medium">
                      <div className="flex flex-col items-center">
                        <span>Cancelados</span>
                        <span className="text-[9px] text-gray-600 normal-case">(Total)</span>
                      </div>
                    </th>
                    <th className="text-center px-4 py-3 text-[10px] text-gray-500 uppercase tracking-wider font-medium">
                      <div className="flex flex-col items-center">
                        <span>Declinados</span>
                        <span className="text-[9px] text-gray-600 normal-case">(Total)</span>
                      </div>
                    </th>
                    <th className="text-center px-4 py-3 text-[10px] text-gray-500 uppercase tracking-wider font-medium hidden md:table-cell">Aceptacion</th>
                    <th className="text-center px-4 py-3 text-[10px] text-gray-500 uppercase tracking-wider font-medium">Estado</th>
                    <th className="text-center px-4 py-3 text-[10px] text-gray-500 uppercase tracking-wider font-medium hidden xl:table-cell">Fecha Bloqueo</th>
                    <th className="text-right px-4 py-3 text-[10px] text-gray-500 uppercase tracking-wider font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {drivers.map((driver, idx) => (
                    <motion.tr
                      key={driver.driver_id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: idx * 0.02 }}
                      className={`transition-colors ${
                        driver.is_blocked
                          ? 'bg-red-500/[0.03] hover:bg-red-500/[0.06]'
                          : 'hover:bg-white/[0.02]'
                      }`}
                    >
                      {/* Driver Name */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                            driver.is_blocked
                              ? 'bg-red-500/20 text-red-400'
                              : (driver.cancelled_24h + driver.declined_24h) >= 2
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-cyan-500/20 text-cyan-400'
                          }`}>
                            {driver.driver_name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white truncate max-w-[140px]">
                              {driver.driver_name}
                            </p>
                            <p className="text-[10px] text-gray-500 truncate max-w-[140px]">
                              {driver.vehicle_info}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <p className="text-xs text-gray-400 truncate max-w-[160px]">{driver.driver_email}</p>
                      </td>

                      {/* Cancelled 24h */}
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center justify-center w-8 h-6 rounded-lg text-xs font-bold ${
                          driver.cancelled_24h >= 2
                            ? 'bg-red-500/20 text-red-400'
                            : driver.cancelled_24h >= 1
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-white/5 text-gray-400'
                        }`}>
                          {driver.cancelled_24h}
                        </span>
                      </td>

                      {/* Declined 24h */}
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center justify-center w-8 h-6 rounded-lg text-xs font-bold ${
                          driver.declined_24h >= 3
                            ? 'bg-red-500/20 text-red-400'
                            : driver.declined_24h >= 1
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-white/5 text-gray-400'
                        }`}>
                          {driver.declined_24h}
                        </span>
                      </td>

                      {/* Cancelled Total */}
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm font-medium text-white">{driver.cancelled_total}</span>
                      </td>

                      {/* Declined Total */}
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm font-medium text-white">{driver.declined_total}</span>
                      </td>

                      {/* Accept Rate */}
                      <td className="px-4 py-3 text-center hidden md:table-cell">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`text-xs font-bold ${
                            driver.accept_rate >= 80
                              ? 'text-emerald-400'
                              : driver.accept_rate >= 50
                                ? 'text-amber-400'
                                : 'text-red-400'
                          }`}>
                            {driver.accept_rate}%
                          </span>
                          <div className="w-16 h-1.5 rounded-full bg-white/5 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                driver.accept_rate >= 80
                                  ? 'bg-emerald-400'
                                  : driver.accept_rate >= 50
                                    ? 'bg-amber-400'
                                    : 'bg-red-400'
                              }`}
                              style={{ width: `${Math.min(driver.accept_rate, 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Block Status */}
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium ${
                          driver.is_blocked
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        }`}>
                          {driver.is_blocked ? (
                            <>
                              <Ban className="w-3 h-3" />
                              Bloqueado
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3 h-3" />
                              Activo
                            </>
                          )}
                        </span>
                      </td>

                      {/* Block Date */}
                      <td className="px-4 py-3 text-center hidden xl:table-cell">
                        <span className="text-xs text-gray-500">
                          {driver.blocked_at
                            ? new Date(driver.blocked_at).toLocaleString('es-CR', {
                                day: '2-digit', month: '2-digit', year: 'numeric',
                                hour: '2-digit', minute: '2-digit',
                              })
                            : '-'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setDetailDriver(driver);
                              setShowDetailModal(true);
                            }}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all"
                            title="Ver detalle"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {driver.is_blocked ? (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedDriver(driver);
                                setShowUnblockModal(true);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-[10px] font-medium border border-emerald-500/30 hover:bg-emerald-500/25 transition-all flex items-center gap-1"
                            >
                              <UserCheck className="w-3 h-3" />
                              Desbloquear
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedDriver(driver);
                                setBlockReason('');
                                setShowBlockModal(true);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 text-[10px] font-medium border border-red-500/30 hover:bg-red-500/25 transition-all flex items-center gap-1"
                            >
                              <Ban className="w-3 h-3" />
                              Bloquear
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
              <p className="text-xs text-gray-500">
                Mostrando {(page - 1) * pageSize + 1} a {Math.min(page * pageSize, totalCount)} de {totalCount} entradas
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page <= 1}
                  className="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => setPage(pageNum)}
                      className={`w-8 h-8 rounded-lg text-xs font-medium transition-all ${
                        page === pageNum
                          ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                          : 'bg-white/5 text-gray-400 hover:text-white'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page >= totalPages}
                  className="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 bg-white/5 border border-white/10">
              <ShieldAlert className="w-8 h-8 text-gray-600" />
            </div>
            <p className="text-sm font-medium text-gray-400">No hay alertas de cancelacion</p>
            <p className="text-xs text-gray-600 mt-1">
              Las estadisticas aparecen cuando los conductores cancelan o declinan viajes.
            </p>
          </div>
        )}
      </motion.div>

      {/* ─── Block Modal ─────────────────────────────────────── */}
      <AnimatePresence>
        {showBlockModal && selectedDriver && (
          <motion.div
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowBlockModal(false)}
          >
            <motion.div
              className="glass rounded-2xl p-6 w-full max-w-md border border-red-500/20"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                  <Ban className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Bloquear Conductor</h3>
                  <p className="text-xs text-gray-400">{selectedDriver.driver_name}</p>
                </div>
              </div>

              {/* Driver Stats */}
              <div className="bg-white/[0.03] rounded-xl p-3 mb-4 space-y-1 text-xs">
                <div className="flex justify-between text-gray-400">
                  <span>Email:</span>
                  <span className="text-white">{selectedDriver.driver_email}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Cancelados (24h):</span>
                  <span className="text-red-400 font-medium">{selectedDriver.cancelled_24h}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Declinados (24h):</span>
                  <span className="text-amber-400 font-medium">{selectedDriver.declined_24h}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Cancelados (Total):</span>
                  <span className="text-white">{selectedDriver.cancelled_total}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Declinados (Total):</span>
                  <span className="text-white">{selectedDriver.declined_total}</span>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-xs text-gray-400 mb-2">
                  Razon del bloqueo <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  placeholder="Ej: Alta tasa de cancelacion de viajes..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-red-500 text-white placeholder:text-gray-600 outline-none text-sm transition-all resize-none"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowBlockModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 text-gray-400 text-sm font-medium hover:text-white transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleBlock}
                  disabled={actionLoading || !blockReason.trim()}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-red-500/20 text-red-400 text-sm font-medium border border-red-500/30 hover:bg-red-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {actionLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Ban className="w-4 h-4" />
                  )}
                  Bloquear
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Unblock Modal ─────────────────────────────────── */}
      <AnimatePresence>
        {showUnblockModal && selectedDriver && (
          <motion.div
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowUnblockModal(false)}
          >
            <motion.div
              className="glass rounded-2xl p-6 w-full max-w-md border border-emerald-500/20"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <UserCheck className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Desbloquear Conductor</h3>
                  <p className="text-xs text-gray-400">{selectedDriver.driver_name}</p>
                </div>
              </div>

              {selectedDriver.block_reason && (
                <div className="bg-white/[0.03] rounded-xl p-3 mb-4">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Razon del bloqueo</p>
                  <p className="text-xs text-gray-300">{selectedDriver.block_reason}</p>
                </div>
              )}

              <p className="text-sm text-gray-400 mb-4">
                El conductor podra recibir solicitudes de viaje nuevamente y su cuenta sera reactivada.
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowUnblockModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 text-gray-400 text-sm font-medium hover:text-white transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleUnblock}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 text-sm font-medium border border-emerald-500/30 hover:bg-emerald-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {actionLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <UserCheck className="w-4 h-4" />
                  )}
                  Desbloquear
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Detail Modal ──────────────────────────────────── */}
      <AnimatePresence>
        {showDetailModal && detailDriver && (
          <motion.div
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowDetailModal(false)}
          >
            <motion.div
              className="glass rounded-2xl p-6 w-full max-w-lg border border-white/10"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center text-lg font-bold text-cyan-400">
                    {detailDriver.driver_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">{detailDriver.driver_name}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      detailDriver.is_blocked
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-emerald-500/20 text-emerald-400'
                    }`}>
                      {detailDriver.is_blocked ? 'Bloqueado' : detailDriver.driver_status}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDetailModal(false)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-white/[0.03] rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Mail className="w-3 h-3 text-gray-500" />
                    <span className="text-[10px] text-gray-500">Email</span>
                  </div>
                  <p className="text-xs text-white truncate">{detailDriver.driver_email || '-'}</p>
                </div>
                <div className="bg-white/[0.03] rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Phone className="w-3 h-3 text-gray-500" />
                    <span className="text-[10px] text-gray-500">Telefono</span>
                  </div>
                  <p className="text-xs text-white">{detailDriver.driver_phone || '-'}</p>
                </div>
                <div className="bg-white/[0.03] rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Car className="w-3 h-3 text-gray-500" />
                    <span className="text-[10px] text-gray-500">Vehiculo</span>
                  </div>
                  <p className="text-xs text-white">{detailDriver.vehicle_info}</p>
                </div>
                <div className="bg-white/[0.03] rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <CheckCircle2 className="w-3 h-3 text-gray-500" />
                    <span className="text-[10px] text-gray-500">Total Viajes</span>
                  </div>
                  <p className="text-xs text-white font-medium">{detailDriver.total_rides}</p>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-red-500/5 rounded-xl p-3 border border-red-500/10">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Cancelados 24h</p>
                  <p className="text-2xl font-bold text-red-400">{detailDriver.cancelled_24h}</p>
                </div>
                <div className="bg-amber-500/5 rounded-xl p-3 border border-amber-500/10">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Declinados 24h</p>
                  <p className="text-2xl font-bold text-amber-400">{detailDriver.declined_24h}</p>
                </div>
                <div className="bg-white/[0.03] rounded-xl p-3">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Cancelados Total</p>
                  <p className="text-2xl font-bold text-white">{detailDriver.cancelled_total}</p>
                </div>
                <div className="bg-white/[0.03] rounded-xl p-3">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Declinados Total</p>
                  <p className="text-2xl font-bold text-white">{detailDriver.declined_total}</p>
                </div>
              </div>

              {/* Accept Rate */}
              <div className="bg-white/[0.03] rounded-xl p-3 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider">Tasa de Aceptacion</span>
                  <span className={`text-sm font-bold ${
                    detailDriver.accept_rate >= 80 ? 'text-emerald-400'
                      : detailDriver.accept_rate >= 50 ? 'text-amber-400'
                      : 'text-red-400'
                  }`}>
                    {detailDriver.accept_rate}%
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      detailDriver.accept_rate >= 80 ? 'bg-emerald-400'
                        : detailDriver.accept_rate >= 50 ? 'bg-amber-400'
                        : 'bg-red-400'
                    }`}
                    style={{ width: `${Math.min(detailDriver.accept_rate, 100)}%` }}
                  />
                </div>
              </div>

              {/* Block Info */}
              {detailDriver.is_blocked && (
                <div className="bg-red-500/5 rounded-xl p-3 border border-red-500/10 mb-4">
                  <p className="text-[10px] text-red-400 uppercase tracking-wider mb-1">Bloqueado</p>
                  <p className="text-xs text-gray-300">{detailDriver.block_reason || 'Sin razon especificada'}</p>
                  <p className="text-[10px] text-gray-500 mt-1">
                    {detailDriver.blocked_at
                      ? `Desde: ${new Date(detailDriver.blocked_at).toLocaleString('es-CR')}`
                      : ''}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2">
                {detailDriver.is_blocked ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowDetailModal(false);
                      setSelectedDriver(detailDriver);
                      setShowUnblockModal(true);
                    }}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 text-sm font-medium border border-emerald-500/30 hover:bg-emerald-500/30 transition-all flex items-center justify-center gap-2"
                  >
                    <UserCheck className="w-4 h-4" />
                    Desbloquear
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setShowDetailModal(false);
                      setSelectedDriver(detailDriver);
                      setBlockReason('');
                      setShowBlockModal(true);
                    }}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-red-500/20 text-red-400 text-sm font-medium border border-red-500/30 hover:bg-red-500/30 transition-all flex items-center justify-center gap-2"
                  >
                    <Ban className="w-4 h-4" />
                    Bloquear
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowDetailModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 text-gray-400 text-sm font-medium hover:text-white transition-all"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
