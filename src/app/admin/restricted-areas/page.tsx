'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, ArrowLeft, Plus, Trash2, Loader2, X, Search,
  ToggleLeft, ToggleRight, Info, ShieldAlert, Ban, AlertTriangle,
  ChevronDown, Eye, EyeOff, Pencil
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

/* ─── Types ────────────────────────────────────────────────── */
interface RestrictedArea {
  id: string;
  name: string;
  area_type: 'restriction';
  country: string;
  coordinates: string;
  is_active: boolean;
  notes: string;
  restrict_scope: string;
  restrict_type: string;
  created_at: string;
  updated_at: string;
}

type StatusFilter = 'todos' | 'activos' | 'inactivos';

/* ─── Config ──────────────────────────────────────────────── */
const scopeLabels: Record<string, string> = {
  all: 'Todas las operaciones',
  pickup: 'Solo recogidas',
  dropoff: 'Solo entregas',
};

const typeLabels: Record<string, string> = {
  disallowed: 'Prohibido',
  surge: 'Surge Pricing',
  limited: 'Limitado',
  warning: 'Advertencia',
};

const typeColors: Record<string, { bg: string; text: string; dot: string }> = {
  disallowed: { bg: 'bg-red-500/15', text: 'text-red-400', dot: 'bg-red-400' },
  surge: { bg: 'bg-amber-500/15', text: 'text-amber-400', dot: 'bg-amber-400' },
  limited: { bg: 'bg-blue-500/15', text: 'text-blue-400', dot: 'bg-blue-400' },
  warning: { bg: 'bg-orange-500/15', text: 'text-orange-400', dot: 'bg-orange-400' },
};

/* ─── Empty Form ──────────────────────────────────────────── */
const emptyForm = () => ({
  name: '',
  restrict_scope: 'all',
  restrict_type: 'disallowed',
  is_active: true,
  notes: '',
});

/* ─── Helpers ─────────────────────────────────────────────── */
function formatDate(date: string) {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('es-CR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/* ─── Loading Skeleton ────────────────────────────────────── */
function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="glass rounded-2xl p-6">
        <div className="h-6 w-64 rounded bg-white/5 mb-2" />
        <div className="h-4 w-full rounded bg-white/5 mb-1" />
        <div className="h-4 w-3/4 rounded bg-white/5" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass rounded-xl p-4">
            <div className="h-3 w-20 bg-white/5 rounded mb-2" />
            <div className="h-7 w-12 bg-white/5 rounded" />
          </div>
        ))}
      </div>
      <div className="glass rounded-2xl overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-4 border-b border-white/5">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-40 rounded bg-white/5" />
              <div className="h-3 w-24 rounded bg-white/5" />
            </div>
            <div className="h-6 w-20 rounded-full bg-white/5" />
            <div className="w-8 h-8 rounded-lg bg-white/5" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export default function RestrictedAreasPage() {
  const [areas, setAreas] = useState<RestrictedArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos');

  // Form modal
  const [showForm, setShowForm] = useState(false);
  const [editingArea, setEditingArea] = useState<RestrictedArea | null>(null);
  const [formData, setFormData] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  // Delete
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  /* ─── Fetch Areas ─────────────────────────────────────── */
  const fetchAreas = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('location_areas')
      .select('*')
      .eq('area_type', 'restriction')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Error al cargar areas restringidas');
      console.error(error);
    } else {
      setAreas((data || []) as RestrictedArea[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAreas();
  }, [fetchAreas]);

  /* ─── Filters ─────────────────────────────────────────── */
  const filtered = areas.filter((a) => {
    const matchSearch =
      !search ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      (a.notes || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus =
      statusFilter === 'todos' ||
      (statusFilter === 'activos' && a.is_active) ||
      (statusFilter === 'inactivos' && !a.is_active);
    return matchSearch && matchStatus;
  });

  const stats = {
    total: areas.length,
    active: areas.filter((a) => a.is_active).length,
    inactive: areas.filter((a) => !a.is_active).length,
    disallowed: areas.filter((a) => a.restrict_type === 'disallowed' && a.is_active).length,
  };

  /* ─── Form Actions ────────────────────────────────────── */
  const openCreate = () => {
    setEditingArea(null);
    setFormData(emptyForm());
    setShowForm(true);
  };

  const openEdit = (area: RestrictedArea) => {
    setEditingArea(area);
    setFormData({
      name: area.name,
      restrict_scope: (area as Record<string, unknown>).restrict_scope as string || 'all',
      restrict_type: (area as Record<string, unknown>).restrict_type as string || 'disallowed',
      is_active: area.is_active,
      notes: area.notes || '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('El nombre del area es obligatorio');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        area_type: 'restriction' as const,
        country: 'CR',
        coordinates: '[]',
        is_active: formData.is_active,
        notes: formData.notes.trim() || null,
        restrict_scope: formData.restrict_scope,
        restrict_type: formData.restrict_type,
      };

      if (editingArea) {
        const { error } = await supabase
          .from('location_areas')
          .update(payload)
          .eq('id', editingArea.id);
        if (error) throw error;
        toast.success('Area restringida actualizada');
      } else {
        const { error } = await supabase
          .from('location_areas')
          .insert(payload);
        if (error) throw error;
        toast.success('Area restringida creada');
      }
      setShowForm(false);
      fetchAreas();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (area: RestrictedArea) => {
    try {
      const { error } = await supabase
        .from('location_areas')
        .update({ is_active: !area.is_active })
        .eq('id', area.id);
      if (error) throw error;
      toast.success(
        `Area "${area.name}" ${area.is_active ? 'desactivada' : 'activada'}`
      );
      fetchAreas();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cambiar estado';
      toast.error(msg);
    }
  };

  const deleteArea = async (id: string) => {
    try {
      const { error } = await supabase
        .from('location_areas')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast.success('Area eliminada');
      setDeleteConfirm(null);
      fetchAreas();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al eliminar';
      toast.error(msg);
    }
  };

  /* ─── Loading ─────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link href="/admin/locations" className="hover:text-white transition-colors flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" />
              Areas Geo.
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-white">Areas Restringidas</h1>
          <p className="text-gray-400 mt-1">Gestion de zonas restringidas del sistema</p>
        </div>
        <LoadingSkeleton />
      </div>
    );
  }

  /* ═════════════════════════════════════════════════════════
     RENDER
     ═════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-6">
      {/* ─── Header ────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/admin/locations" className="hover:text-white transition-colors flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" />
            Areas Geo.
          </Link>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center">
                <Ban className="w-5 h-5 text-red-400" />
              </div>
              Areas Restringidas
            </h1>
            <p className="text-gray-400 mt-2 max-w-2xl leading-relaxed">
              Esta funcionalidad evita que se envíen solicitudes de viaje desde o hacia las zonas que marques.
              Si la ubicacion de recogida o entrega cae dentro de un area restringida, la app no procesara la solicitud.
            </p>
          </div>
          <motion.button
            type="button"
            onClick={openCreate}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white text-sm font-semibold shadow-lg shadow-red-500/20 hover:shadow-red-500/30 transition-all flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            Agregar Area
          </motion.button>
        </div>
      </div>

      {/* ─── Info Banner ────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-4 border-l-4 border-amber-500/50"
      >
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-amber-400 font-medium">Como funciona</p>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed">
              Cuando creas un area restringida, el sistema verifica automaticamente si las coordenadas
              de recogida o entrega de un viaje caen dentro de esa zona. Si es asi, se bloquea la solicitud.
              Puedes definir si la restriccion aplica a recogidas, entregas o ambas.
            </p>
          </div>
        </div>
      </motion.div>

      {/* ─── Stats ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Areas', value: stats.total, color: 'text-white', icon: ShieldAlert },
          { label: 'Activas', value: stats.active, color: 'text-emerald-400', icon: Eye },
          { label: 'Inactivas', value: stats.inactive, color: 'text-gray-500', icon: EyeOff },
          { label: 'Prohibidas', value: stats.disallowed, color: 'text-red-400', icon: Ban },
        ].map((stat, i) => (
          <motion.div
            key={i}
            className="glass rounded-xl p-4"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-500 uppercase tracking-wider">{stat.label}</p>
              <stat.icon className="w-4 h-4 text-gray-600" />
            </div>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* ─── Filters ────────────────────────────────────── */}
      <motion.div
        className="glass rounded-2xl p-4"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar area restringida..."
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500/50 transition-colors"
            />
          </div>
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-red-500/50 appearance-none cursor-pointer min-w-[130px]"
            >
              <option value="todos" className="bg-[#111827]">Todos</option>
              <option value="activos" className="bg-[#111827]">Activos</option>
              <option value="inactivos" className="bg-[#111827]">Inactivos</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          </div>
        </div>
      </motion.div>

      {/* ─── Areas List ─────────────────────────────────── */}
      <motion.div
        className="glass rounded-2xl overflow-hidden"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        {filtered.length > 0 ? (
          <div>
            {/* Table header */}
            <div className="hidden sm:flex items-center gap-4 px-4 py-3 border-b border-white/10 text-xs text-gray-500 uppercase tracking-wider font-medium">
              <div className="w-10" />
              <div className="flex-1">Nombre</div>
              <div className="w-32">Alcance</div>
              <div className="w-28">Tipo</div>
              <div className="w-20">Estado</div>
              <div className="w-24 text-right">Fecha</div>
              <div className="w-24 text-right">Acciones</div>
            </div>
            {/* Rows */}
            {filtered.map((area, i) => {
              const tColor = typeColors[area.restrict_type] || typeColors.disallowed;
              return (
                <motion.div
                  key={area.id}
                  className="flex items-center gap-4 px-4 py-3 border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                >
                  {/* Icon */}
                  <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
                    <Ban className="w-4 h-4 text-red-400/60" />
                  </div>
                  {/* Name + Notes */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{area.name}</p>
                    {area.notes && (
                      <p className="text-[11px] text-gray-500 truncate mt-0.5">{area.notes}</p>
                    )}
                  </div>
                  {/* Scope */}
                  <div className="w-32 hidden sm:block">
                    <span className="text-xs text-gray-400">
                      {scopeLabels[area.restrict_scope] || area.restrict_scope}
                    </span>
                  </div>
                  {/* Type */}
                  <div className="w-28 hidden sm:block">
                    <span className={`inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full ${tColor.bg} ${tColor.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${tColor.dot}`} />
                      {typeLabels[area.restrict_type] || area.restrict_type}
                    </span>
                  </div>
                  {/* Status */}
                  <div className="w-20">
                    {area.is_active ? (
                      <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">Activo</span>
                    ) : (
                      <span className="text-[10px] font-medium text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">Inactivo</span>
                    )}
                  </div>
                  {/* Date */}
                  <div className="w-24 text-right hidden sm:block">
                    <span className="text-[11px] text-gray-500">{formatDate(area.created_at)}</span>
                  </div>
                  {/* Actions */}
                  <div className="w-24 flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(area)}
                      className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleActive(area)}
                      className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:bg-cyan-500/10 transition-all"
                    >
                      {area.is_active ? (
                        <ToggleRight className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <ToggleLeft className="w-5 h-5 text-gray-500" />
                      )}
                    </button>
                    {deleteConfirm === area.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => deleteArea(area.id)}
                          className="text-[10px] px-2 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                        >
                          Si
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirm(null)}
                          className="text-[10px] px-2 py-1 rounded bg-white/5 text-gray-400 hover:bg-white/10 transition-colors"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm(area.id)}
                        className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16">
            <ShieldAlert className="w-12 h-12 mx-auto mb-3 text-gray-600" />
            <p className="text-gray-500 text-sm">
              {areas.length === 0
                ? 'No hay areas restringidas creadas'
                : 'No se encontraron areas con los filtros aplicados'}
            </p>
            {areas.length === 0 && (
              <button
                type="button"
                onClick={openCreate}
                className="mt-4 px-5 py-2.5 rounded-xl bg-red-500/15 text-red-400 border border-red-500/30 text-sm font-medium hover:bg-red-500/25 transition-colors"
              >
                Crear primera area
              </button>
            )}
          </div>
        )}
      </motion.div>

      {/* ═══════════════════════════════════════════════════════
          FORM MODAL
          ═══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/60" onClick={() => setShowForm(false)} />
            <motion.div
              className="relative glass-strong rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto z-10"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-red-500/15 flex items-center justify-center">
                    <Ban className="w-4 h-4 text-red-400" />
                  </div>
                  <h2 className="text-lg font-bold text-white">
                    {editingArea ? 'Editar Area Restringida' : 'Agregar Area Restringida'}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Description */}
              <p className="text-xs text-gray-400 leading-relaxed mb-5 bg-white/5 rounded-xl p-3">
                Esta funcionalidad evita que se envíen solicitudes de viaje desde una zona marcada.
                En caso de que la ubicacion de recogida o entrega caiga dentro del area restringida,
                la app no enviara solicitudes de viaje.
              </p>

              {/* Form fields */}
              <div className="space-y-4">
                {/* Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-400 flex items-center gap-1.5">
                    Nombre del Area <span className="text-red-400">*</span>
                    <Info className="w-3 h-3 text-gray-600" />
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500/50"
                    placeholder="Ej: Zona Centro San Jose"
                  />
                </div>

                {/* Restrict Scope */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-400 flex items-center gap-1.5">
                    Restringir Area <span className="text-red-400">*</span>
                    <Info className="w-3 h-3 text-gray-600" />
                  </label>
                  <select
                    value={formData.restrict_scope}
                    onChange={(e) => setFormData((prev) => ({ ...prev, restrict_scope: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-red-500/50 appearance-none cursor-pointer"
                  >
                    <option value="all" className="bg-[#111827]">Todas las operaciones</option>
                    <option value="pickup" className="bg-[#111827]">Solo recogidas</option>
                    <option value="dropoff" className="bg-[#111827]">Solo entregas</option>
                  </select>
                </div>

                {/* Restrict Type */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-400 flex items-center gap-1.5">
                    Tipo de Restriccion <span className="text-red-400">*</span>
                    <Info className="w-3 h-3 text-gray-600" />
                  </label>
                  <select
                    value={formData.restrict_type}
                    onChange={(e) => setFormData((prev) => ({ ...prev, restrict_type: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-red-500/50 appearance-none cursor-pointer"
                  >
                    <option value="disallowed" className="bg-[#111827]">Prohibido</option>
                    <option value="surge" className="bg-[#111827]">Surge Pricing</option>
                    <option value="limited" className="bg-[#111827]">Limitado</option>
                    <option value="warning" className="bg-[#111827]">Advertencia</option>
                  </select>
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-400">Notas</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                    rows={2}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500/50 resize-none"
                    placeholder="Notas adicionales sobre esta restriccion..."
                  />
                </div>

                {/* Status Toggle */}
                <div className="flex items-center justify-between bg-white/5 rounded-xl p-3">
                  <div>
                    <p className="text-sm text-white font-medium">Estado</p>
                    <p className="text-xs text-gray-500">Activar o desactivar esta restriccion</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, is_active: !prev.is_active }))}
                    className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${
                      formData.is_active ? 'bg-red-500' : 'bg-white/10'
                    }`}
                  >
                    <motion.div
                      className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md"
                      animate={{ left: formData.is_active ? 'calc(100% - 22px)' : '2px' }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-sm font-medium hover:bg-white/10 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-red-500/20 hover:shadow-red-500/30 transition-all disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      {editingArea ? 'Actualizar' : 'Agregar Area'}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
