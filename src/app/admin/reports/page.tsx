'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  Search, FileText, AlertTriangle, Shield, AlertCircle,
  MessageSquare, CheckCircle2, Eye, Clock, ChevronDown,
  ChevronUp, ChevronRight, ArrowLeft, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

type ReportType = 'incident' | 'fraud' | 'sos' | 'complaint';
type ReportStatus = 'pending' | 'reviewed' | 'resolved';

interface ReportRow {
  id: string;
  user_id: string;
  type: ReportType;
  description: string;
  status: ReportStatus;
  priority: 'high' | 'medium' | 'low';
  ride_id: string | null;
  details: string | null;
  images: string[] | null;
  created_at: string;
  updated_at: string;
  profiles?: { name: string } | null;
}

interface ReportData {
  id: string;
  type: ReportType;
  user: string;
  description: string;
  status: ReportStatus;
  date: string;
  priority: 'high' | 'medium' | 'low';
  details: string;
  rideId?: string;
}

const typeConfig: Record<ReportType, { label: string; color: string; icon: React.ElementType }> = {
  incident: { label: 'Incidente', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: AlertTriangle },
  fraud: { label: 'Fraude', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: Shield },
  sos: { label: 'SOS', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: AlertCircle },
  complaint: { label: 'Queja', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: MessageSquare },
};

const statusConfig: Record<ReportStatus, { label: string; color: string }> = {
  pending: { label: 'Pendiente', color: 'bg-amber-500/20 text-amber-400' },
  reviewed: { label: 'Revisado', color: 'bg-blue-500/20 text-blue-400' },
  resolved: { label: 'Resuelto', color: 'bg-emerald-500/20 text-emerald-400' },
};

const priorityConfig = {
  high: { label: 'Alta', color: 'text-red-400' },
  medium: { label: 'Media', color: 'text-amber-400' },
  low: { label: 'Baja', color: 'text-gray-400' },
};

const typeFilters: string[] = ['Todos', 'Incidentes', 'Fraude', 'SOS', 'Quejas'];
const statusFilters: string[] = ['Todos', 'Pendientes', 'Revisados', 'Resueltos'];

function formatCreatedAt(dateStr: string): string {
  const d = new Date(dateStr);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="glass rounded-xl p-4 animate-pulse">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex-shrink-0" />
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-3 w-16 rounded bg-white/5" />
                <div className="h-4 w-16 rounded-md bg-white/5" />
                <div className="h-4 w-16 rounded-md bg-white/5" />
              </div>
              <div className="h-4 w-3/4 rounded bg-white/5" />
              <div className="flex items-center gap-3">
                <div className="h-3 w-24 rounded bg-white/5" />
                <div className="h-3 w-32 rounded bg-white/5" />
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <div className="w-8 h-8 rounded-lg bg-white/5" />
              <div className="w-8 h-8 rounded-lg bg-white/5" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportData[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('Todos');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('id, user_id, type, description, status, priority, ride_id, details, images, created_at, updated_at, profiles(name)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mapped: ReportData[] = (data as ReportRow[]).map((r) => ({
        id: r.id,
        type: r.type,
        user: r.profiles?.name ?? 'Usuario desconocido',
        description: r.description,
        status: r.status,
        date: formatCreatedAt(r.created_at),
        priority: r.priority,
        details: r.details ?? '',
        rideId: r.ride_id ?? undefined,
      }));

      setReports(mapped);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      toast.error(`Error al cargar reportes: ${message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const filteredReports = reports.filter((r) => {
    const matchSearch = r.id.toLowerCase().includes(search.toLowerCase()) ||
      r.user.toLowerCase().includes(search.toLowerCase()) ||
      r.description.toLowerCase().includes(search.toLowerCase());

    let matchType = true;
    switch (typeFilter) {
      case 'Incidentes': matchType = r.type === 'incident'; break;
      case 'Fraude': matchType = r.type === 'fraud'; break;
      case 'SOS': matchType = r.type === 'sos'; break;
      case 'Quejas': matchType = r.type === 'complaint'; break;
    }

    let matchStatus = true;
    switch (statusFilter) {
      case 'Pendientes': matchStatus = r.status === 'pending'; break;
      case 'Revisados': matchStatus = r.status === 'reviewed'; break;
      case 'Resueltos': matchStatus = r.status === 'resolved'; break;
    }

    return matchSearch && matchType && matchStatus;
  });

  const markAsReviewed = async (id: string) => {
    setUpdatingId(id);
    try {
      const { error } = await supabase
        .from('reports')
        .update({ status: 'reviewed', updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      setReports((prev) => prev.map((r) =>
        r.id === id ? { ...r, status: 'reviewed' as ReportStatus } : r
      ));
      toast.success(`Reporte ${id.slice(0, 8)} marcado como revisado`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      toast.error(`Error al actualizar: ${message}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const markAsResolved = async (id: string) => {
    setUpdatingId(id);
    try {
      const { error } = await supabase
        .from('reports')
        .update({ status: 'resolved', updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      setReports((prev) => prev.map((r) =>
        r.id === id ? { ...r, status: 'resolved' as ReportStatus } : r
      ));
      toast.success(`Reporte ${id.slice(0, 8)} marcado como resuelto`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      toast.error(`Error al actualizar: ${message}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const pendingCount = reports.filter((r) => r.status === 'pending').length;
  const reviewedCount = reports.filter((r) => r.status === 'reviewed').length;
  const resolvedCount = reports.filter((r) => r.status === 'resolved').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link href="/admin" className="hover:text-white transition-colors flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" />
              Panel
            </Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-white font-medium">Reportes</span>
          </div>
          <h1 className="text-3xl font-bold text-white">Reportes</h1>
          <p className="text-gray-400 mt-1">{reports.length} reportes y incidentes</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="flex items-center gap-1.5 text-amber-400">{pendingCount} pendientes</span>
          <span className="flex items-center gap-1.5 text-blue-400">{reviewedCount} revisados</span>
          <span className="flex items-center gap-1.5 text-emerald-400">{resolvedCount} resueltos</span>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="glass rounded-2xl p-4">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar por ID, usuario o descripción..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-cyan-500 text-white placeholder:text-gray-600 outline-none text-sm transition-all"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {typeFilters.map((tab) => (
            <button
              key={tab}
              onClick={() => setTypeFilter(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                typeFilter === tab
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'bg-white/5 text-gray-400 hover:text-white border border-transparent'
              }`}
            >
              {tab}
            </button>
          ))}
          <div className="w-px bg-white/10 mx-1" />
          {statusFilters.map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                statusFilter === tab
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'bg-white/5 text-gray-400 hover:text-white border border-transparent'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Loading State */}
      {loading && <LoadingSkeleton />}

      {/* Reports List */}
      {!loading && (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {filteredReports.map((report, i) => {
              const typeCfg = typeConfig[report.type];
              const statusCfg = statusConfig[report.status];
              const TypeIcon = typeCfg.icon;
              const isExpanded = expandedId === report.id;
              const isUpdating = updatingId === report.id;

              return (
                <motion.div
                  key={report.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: i * 0.05 }}
                  className="glass rounded-xl overflow-hidden"
                >
                  {/* Report Header */}
                  <div className="p-4">
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${typeCfg.color.split(' ')[0]}`}>
                        <TypeIcon className={`w-5 h-5 ${typeCfg.color.split(' ')[1]}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-cyan-400 font-mono text-xs">{report.id.slice(0, 8)}</span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border ${typeCfg.color}`}>
                            {typeCfg.label}
                          </span>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium ${statusCfg.color}`}>
                            {statusCfg.label}
                          </span>
                          <span className={`text-[10px] font-medium ${priorityConfig[report.priority].color}`}>
                            Prioridad: {priorityConfig[report.priority].label}
                          </span>
                        </div>
                        <p className="text-sm text-white mt-1">{report.description}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                          <span>{report.user}</span>
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {report.date}</span>
                          {report.rideId && <span className="text-cyan-400/60">Viaje: {report.rideId.slice(0, 8)}</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        {report.status !== 'resolved' && (
                          <button
                            onClick={() => markAsResolved(report.id)}
                            disabled={isUpdating}
                            className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 hover:bg-emerald-500/20 transition-all disabled:opacity-50"
                            title="Marcar resuelto"
                          >
                            {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                          </button>
                        )}
                        {report.status === 'pending' && (
                          <button
                            onClick={() => markAsReviewed(report.id)}
                            disabled={isUpdating}
                            className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 hover:bg-blue-500/20 transition-all disabled:opacity-50"
                            title="Marcar revisado"
                          >
                            {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                          </button>
                        )}
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : report.id)}
                          className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 border-t border-white/5 pt-3">
                          <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Detalle del Reporte</h4>
                          <p className="text-sm text-gray-300 leading-relaxed">{report.details || 'Sin detalle adicional'}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {filteredReports.length === 0 && (
            <div className="text-center py-16 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No se encontraron reportes</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
