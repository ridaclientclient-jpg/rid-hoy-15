'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Image, Plus, Edit2, Trash2, Loader2, X, Search,
  Eye, EyeOff, ExternalLink, Calendar, Target, MousePointerClick,
  ToggleLeft, ToggleRight, ChevronDown, Filter, GripVertical, ArrowLeft, ChevronRight
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

/* ─── Types ────────────────────────────────────────────────── */
interface Banner {
  id: string;
  title: string;
  description: string;
  image_url: string;
  link_url: string;
  position: number;
  target: 'app' | 'driver' | 'courier' | 'all';
  is_active: boolean;
  start_date: string;
  end_date: string;
  clicks: number;
  impressions: number;
  created_at: string;
  updated_at: string;
}

type TargetFilter = 'todos' | 'app' | 'driver' | 'courier' | 'all';
type StatusFilter = 'todos' | 'activos' | 'inactivos';

/* ─── Configs ──────────────────────────────────────────────── */
const targetLabels: Record<string, string> = {
  app: 'App Pasajero',
  driver: 'App Conductor',
  courier: 'App Repartidor',
  all: 'Todas las Apps',
};

const targetColors: Record<string, { bg: string; text: string; dot: string }> = {
  app: { bg: 'bg-cyan-500/15', text: 'text-cyan-400', dot: 'bg-cyan-400' },
  driver: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  courier: { bg: 'bg-amber-500/15', text: 'text-amber-400', dot: 'bg-amber-400' },
  all: { bg: 'bg-purple-500/15', text: 'text-purple-400', dot: 'bg-purple-400' },
};

const emptyBanner = (): Omit<Banner, 'id' | 'created_at' | 'updated_at' | 'clicks' | 'impressions'> => ({
  title: '',
  description: '',
  image_url: '',
  link_url: '',
  position: 0,
  target: 'app',
  is_active: true,
  start_date: '',
  end_date: '',
});

/* ─── Helpers ──────────────────────────────────────────────── */
function formatDate(date: string) {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function isCurrentlyActive(banner: Banner): boolean {
  if (!banner.is_active) return false;
  const now = new Date();
  if (banner.start_date && new Date(banner.start_date) > now) return false;
  if (banner.end_date && new Date(banner.end_date) < now) return false;
  return true;
}

function BannersLoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Stats Skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glass rounded-xl p-4">
            <div className="h-3 w-24 bg-white/5 rounded mb-2" />
            <div className="h-7 w-16 bg-white/5 rounded" />
          </div>
        ))}
      </div>
      {/* Filters Skeleton */}
      <div className="glass rounded-2xl p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="h-10 flex-1 bg-white/5 rounded-xl" />
          <div className="h-10 w-40 bg-white/5 rounded-xl" />
          <div className="h-10 w-32 bg-white/5 rounded-xl" />
          <div className="h-10 w-36 bg-white/5 rounded-xl" />
        </div>
      </div>
      {/* Banner Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="glass rounded-2xl overflow-hidden">
            <div className="aspect-[16/9] bg-white/5" />
            <div className="p-4 space-y-3">
              <div className="h-4 w-32 bg-white/5 rounded" />
              <div className="h-3 w-48 bg-white/5 rounded" />
              <div className="flex items-center gap-2">
                <div className="h-5 w-20 bg-white/5 rounded-full" />
                <div className="h-5 w-12 bg-white/5 rounded-full" />
              </div>
              <div className="flex items-center gap-4">
                <div className="h-3 w-16 bg-white/5 rounded" />
                <div className="h-3 w-16 bg-white/5 rounded" />
                <div className="h-3 w-20 bg-white/5 rounded" />
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                <div className="h-8 flex-1 bg-white/5 rounded-lg" />
                <div className="h-8 w-8 bg-white/5 rounded-lg" />
                <div className="h-8 w-8 bg-white/5 rounded-lg" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export default function BannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [targetFilter, setTargetFilter] = useState<TargetFilter>('todos');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos');

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [formData, setFormData] = useState(emptyBanner());
  const [formSaving, setFormSaving] = useState(false);

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Preview
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  /* ─── Fetch Banners ────────────────────────────────────── */
  const fetchBanners = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('banners')
      .select('*')
      .order('position', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Error al cargar banners');
      console.error(error);
    } else {
      setBanners(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchBanners();
  }, [fetchBanners]);

  /* ─── Filters ─────────────────────────────────────────── */
  const filteredBanners = banners.filter(b => {
    const matchSearch = !search || b.title.toLowerCase().includes(search.toLowerCase()) || (b.description || '').toLowerCase().includes(search.toLowerCase());
    const matchTarget = targetFilter === 'todos' || b.target === targetFilter;
    const matchStatus = statusFilter === 'todos' ||
      (statusFilter === 'activos' && b.is_active) ||
      (statusFilter === 'inactivos' && !b.is_active);
    return matchSearch && matchTarget && matchStatus;
  });

  const stats = {
    total: banners.length,
    active: banners.filter(b => isCurrentlyActive(b)).length,
    scheduled: banners.filter(b => b.is_active && b.start_date && new Date(b.start_date) > new Date()).length,
    totalClicks: banners.reduce((sum, b) => sum + (b.clicks || 0), 0),
  };

  /* ─── Modal Actions ───────────────────────────────────── */
  const openCreateModal = () => {
    setEditingBanner(null);
    setFormData(emptyBanner());
    setShowModal(true);
  };

  const openEditModal = (banner: Banner) => {
    setEditingBanner(banner);
    setFormData({
      title: banner.title,
      description: banner.description || '',
      image_url: banner.image_url,
      link_url: banner.link_url || '',
      position: banner.position || 0,
      target: banner.target,
      is_active: banner.is_active,
      start_date: banner.start_date ? banner.start_date.slice(0, 16) : '',
      end_date: banner.end_date ? banner.end_date.slice(0, 16) : '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      toast.error('El titulo es obligatorio');
      return;
    }
    if (!formData.image_url.trim()) {
      toast.error('La URL de la imagen es obligatoria');
      return;
    }

    setFormSaving(true);
    try {
      const payload = {
        title: formData.title,
        description: formData.description || null,
        image_url: formData.image_url,
        link_url: formData.link_url || null,
        position: formData.position || 0,
        target: formData.target,
        is_active: formData.is_active,
        start_date: formData.start_date ? new Date(formData.start_date).toISOString() : null,
        end_date: formData.end_date ? new Date(formData.end_date).toISOString() : null,
      };

      if (editingBanner) {
        const { error } = await supabase.from('banners').update(payload).eq('id', editingBanner.id);
        if (error) throw error;
        toast.success('Banner actualizado');
      } else {
        const { error } = await supabase.from('banners').insert(payload);
        if (error) throw error;
        toast.success('Banner creado');
      }
      setShowModal(false);
      fetchBanners();
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar');
    } finally {
      setFormSaving(false);
    }
  };

  const toggleActive = async (banner: Banner) => {
    try {
      const { error } = await supabase.from('banners').update({ is_active: !banner.is_active }).eq('id', banner.id);
      if (error) throw error;
      toast.success(`Banner "${banner.title}" ${banner.is_active ? 'desactivado' : 'activado'}`);
      fetchBanners();
    } catch (err: any) {
      toast.error(err.message || 'Error al cambiar estado');
    }
  };

  const deleteBanner = async (id: string) => {
    try {
      const { error } = await supabase.from('banners').delete().eq('id', id);
      if (error) throw error;
      toast.success('Banner eliminado');
      setDeleteConfirm(null);
      fetchBanners();
    } catch (err: any) {
      toast.error(err.message || 'Error al eliminar');
    }
  };

  /* ─── Loading ─────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Banners</h1>
          <p className="text-gray-400 mt-1">Gestion de banners promocionales para las apps</p>
        </div>
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/admin" className="hover:text-white transition-colors flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" />
            Panel
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-white font-medium">Banners</span>
        </div>
        <BannersLoadingSkeleton />
      </div>
    );
  }

  /* ═════════════════════════════════════════════════════════
     RENDER
     ═════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Banners</h1>
        <p className="text-gray-400 mt-1">Gestion de banners promocionales para las apps</p>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
        <Link href="/admin" className="hover:text-white transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          Panel
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-white font-medium">Banners</span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Banners', value: stats.total, color: 'text-white' },
          { label: 'Activos Ahora', value: stats.active, color: 'text-emerald-400' },
          { label: 'Programados', value: stats.scheduled, color: 'text-amber-400' },
          { label: 'Total Clicks', value: stats.totalClicks, color: 'text-cyan-400' },
        ].map((stat, i) => (
          <motion.div key={i} className="glass rounded-xl p-4" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <p className="text-xs text-gray-500 uppercase tracking-wider">{stat.label}</p>
            <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <motion.div className="glass rounded-2xl p-4" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar banner por titulo..."
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
            />
          </div>

          {/* Target Filter */}
          <div className="relative">
            <Target className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            <select
              value={targetFilter}
              onChange={e => setTargetFilter(e.target.value as TargetFilter)}
              className="bg-white/5 border border-white/10 rounded-xl pl-10 pr-8 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-cyan-500/50 appearance-none cursor-pointer min-w-[160px]"
            >
              <option value="todos" className="bg-[#111827]">Todos</option>
              <option value="app" className="bg-[#111827]">App Pasajero</option>
              <option value="driver" className="bg-[#111827]">App Conductor</option>
              <option value="courier" className="bg-[#111827]">App Repartidor</option>
              <option value="all" className="bg-[#111827]">Todas</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as StatusFilter)}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-cyan-500/50 appearance-none cursor-pointer min-w-[130px]"
            >
              <option value="todos" className="bg-[#111827]">Todos</option>
              <option value="activos" className="bg-[#111827]">Activos</option>
              <option value="inactivos" className="bg-[#111827]">Inactivos</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          </div>

          {/* Create Button */}
          <button type="button" onClick={openCreateModal} className="py-2.5 px-5 rounded-xl btn-neon text-white text-sm font-semibold flex items-center gap-2 flex-shrink-0">
            <Plus className="w-4 h-4" />
            CREAR BANNER
          </button>
        </div>
      </motion.div>

      {/* Banners Grid */}
      <motion.div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <AnimatePresence mode="popLayout">
          {filteredBanners.map((banner, i) => {
            const tColor = targetColors[banner.target] || targetColors.app;
            const currentlyActive = isCurrentlyActive(banner);
            const isScheduled = banner.is_active && banner.start_date && new Date(banner.start_date) > new Date();

            return (
              <motion.div
                key={banner.id}
                layout
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.05 }}
                className="glass rounded-2xl overflow-hidden hover:bg-white/[0.07] transition-all group"
              >
                {/* Image */}
                <div className="relative aspect-[16/9] bg-black/30 overflow-hidden cursor-pointer" onClick={() => setPreviewUrl(banner.image_url)}>
                  <img
                    src={banner.image_url}
                    alt={banner.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '';
                      (e.target as HTMLImageElement).classList.add('hidden');
                    }}
                  />
                  {/* Position Badge */}
                  <div className="absolute top-3 left-3 glass-strong rounded-lg px-2.5 py-1 flex items-center gap-1.5">
                    <GripVertical className="w-3 h-3 text-gray-400" />
                    <span className="text-[10px] text-white font-medium">#{banner.position || 0}</span>
                  </div>
                  {/* Status Badge */}
                  <div className="absolute top-3 right-3">
                    {currentlyActive ? (
                      <span className="glass-strong rounded-lg px-2.5 py-1 flex items-center gap-1.5 text-emerald-400 text-[10px] font-medium">
                        <Eye className="w-3 h-3" /> Activo
                      </span>
                    ) : isScheduled ? (
                      <span className="glass-strong rounded-lg px-2.5 py-1 flex items-center gap-1.5 text-amber-400 text-[10px] font-medium">
                        <Calendar className="w-3 h-3" /> Programado
                      </span>
                    ) : (
                      <span className="glass-strong rounded-lg px-2.5 py-1 flex items-center gap-1.5 text-gray-400 text-[10px] font-medium">
                        <EyeOff className="w-3 h-3" /> Inactivo
                      </span>
                    )}
                  </div>
                </div>

                {/* Info */}
                <div className="p-4 space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white">{banner.title}</h3>
                    {banner.description && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{banner.description}</p>
                    )}
                  </div>

                  {/* Meta */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full ${tColor.bg} ${tColor.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${tColor.dot}`} />
                      {targetLabels[banner.target]}
                    </span>
                    {banner.link_url && (
                      <span className="text-[10px] text-gray-500 flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" /> Link
                      </span>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 text-xs">
                    <span className="flex items-center gap-1 text-gray-500">
                      <MousePointerClick className="w-3 h-3" /> {banner.clicks || 0} clicks
                    </span>
                    <span className="flex items-center gap-1 text-gray-500">
                      <Eye className="w-3 h-3" /> {banner.impressions || 0} views
                    </span>
                    <span className="text-gray-600">{formatDate(banner.created_at)}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                    <button
                      type="button"
                      onClick={() => openEditModal(banner)}
                      className="flex-1 py-2 rounded-lg bg-white/5 text-gray-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all text-xs font-medium flex items-center justify-center gap-1.5"
                    >
                      <Edit2 className="w-3 h-3" /> Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleActive(banner)}
                      className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:bg-cyan-500/10 transition-all"
                    >
                      {banner.is_active ? <ToggleRight className="w-5 h-5 text-emerald-400" /> : <ToggleLeft className="w-5 h-5 text-gray-500" />}
                    </button>
                    {deleteConfirm === banner.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => deleteBanner(banner.id)}
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
                        onClick={() => setDeleteConfirm(banner.id)}
                        className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>

      {filteredBanners.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          <Image className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No se encontraron banners</p>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          FORM MODAL
          ═══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/60" onClick={() => setShowModal(false)} />
            <motion.div
              className="relative glass-strong rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto z-10"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-white">
                  {editingBanner ? 'Editar Banner' : 'Crear Banner'}
                </h2>
                <button type="button" onClick={() => setShowModal(false)} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Title */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-400">Titulo *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50"
                    placeholder="Titulo del banner"
                  />
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-400">Descripcion</label>
                  <textarea
                    value={formData.description}
                    onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={2}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 resize-none"
                    placeholder="Descripcion del banner..."
                  />
                </div>

                {/* Image URL */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-400">URL de Imagen *</label>
                  <input
                    type="url"
                    value={formData.image_url}
                    onChange={e => setFormData(prev => ({ ...prev, image_url: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50"
                    placeholder="https://ejemplo.com/banner.jpg"
                  />
                  {formData.image_url && (
                    <div className="mt-2 rounded-xl overflow-hidden aspect-[16/9] bg-black/30">
                      <img
                        src={formData.image_url}
                        alt="Preview"
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    </div>
                  )}
                </div>

                {/* Link URL */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-400">URL de Destino (Link)</label>
                  <input
                    type="url"
                    value={formData.link_url}
                    onChange={e => setFormData(prev => ({ ...prev, link_url: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50"
                    placeholder="https://ejemplo.com/promo (opcional)"
                  />
                </div>

                {/* Position & Target */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-400">Posicion</label>
                    <input
                      type="number"
                      value={formData.position}
                      onChange={e => setFormData(prev => ({ ...prev, position: parseInt(e.target.value) || 0 }))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500/50"
                      min={0}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-400">Destino</label>
                    <select
                      value={formData.target}
                      onChange={e => setFormData(prev => ({ ...prev, target: e.target.value as any }))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500/50 appearance-none"
                    >
                      <option value="app" className="bg-[#111827]">App Pasajero</option>
                      <option value="driver" className="bg-[#111827]">App Conductor</option>
                      <option value="courier" className="bg-[#111827]">App Repartidor</option>
                      <option value="all" className="bg-[#111827]">Todas</option>
                    </select>
                  </div>
                </div>

                {/* Date Range */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Fecha Inicio
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.start_date}
                      onChange={e => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500/50 [color-scheme:dark]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Fecha Fin
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.end_date}
                      onChange={e => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500/50 [color-scheme:dark]"
                    />
                  </div>
                </div>

                {/* Active Toggle */}
                <div className="flex items-center justify-between bg-white/5 rounded-xl p-3">
                  <div>
                    <p className="text-sm text-white font-medium">Estado Activo</p>
                    <p className="text-xs text-gray-500">El banner sera visible en la app</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, is_active: !prev.is_active }))}
                    className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${formData.is_active ? 'bg-cyan-500' : 'bg-white/10'}`}
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
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-sm font-medium hover:bg-white/10 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={formSaving}
                  className="flex-1 py-2.5 rounded-xl btn-neon text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {formSaving ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
                  ) : (
                    <>{editingBanner ? 'Actualizar' : 'Crear'}</>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════
          IMAGE PREVIEW MODAL
          ═══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {previewUrl && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPreviewUrl(null)}
          >
            <div className="absolute inset-0 bg-black/80" />
            <motion.div
              className="relative z-10 max-w-4xl w-full"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <button
                type="button"
                onClick={() => setPreviewUrl(null)}
                className="absolute -top-10 right-0 w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <img src={previewUrl} alt="Preview" className="w-full rounded-2xl" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
