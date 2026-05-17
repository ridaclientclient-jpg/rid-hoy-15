'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Edit3, Loader2, X, DollarSign, Clock, Zap,
  Crown, Car, Sparkles, Battery, Rocket, Users,
  Star, ToggleLeft, ToggleRight, Tag, Gauge,
  ArrowLeft, ChevronRight,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */
interface ServiceCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  base_fare: number;
  fare_per_km: number;
  fare_per_min: number;
  surge_enabled: boolean;
  is_active: boolean;
  sort_order: number;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

/* ═══════════════════════════════════════════════════════════════
   ICON MAPPING
   ═══════════════════════════════════════════════════════════════ */
const iconMap: Record<string, React.ElementType> = {
  car: Car,
  crown: Crown,
  star: Star,
  sparkles: Sparkles,
  battery: Battery,
  rocket: Rocket,
  users: Users,
};

const iconOptions = [
  { value: 'car', label: 'Auto' },
  { value: 'crown', label: 'Corona' },
  { value: 'star', label: 'Estrella' },
  { value: 'sparkles', label: 'Destellos' },
  { value: 'battery', label: 'Bateria' },
  { value: 'rocket', label: 'Cohete' },
  { value: 'users', label: 'Usuarios' },
];

const getIcon = (iconName: string) => iconMap[iconName] || Car;

const iconGradientMap: Record<string, string> = {
  car: 'from-cyan-600 to-cyan-400',
  crown: 'from-amber-600 to-amber-400',
  star: 'from-yellow-600 to-yellow-400',
  sparkles: 'from-violet-600 to-violet-400',
  battery: 'from-emerald-600 to-emerald-400',
  rocket: 'from-rose-600 to-rose-400',
  users: 'from-sky-600 to-sky-400',
};

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */
const formatColones = (val: number) => `₡${Math.round(val).toLocaleString()}`;

const emptyForm = {
  name: '',
  description: '',
  icon: 'car',
  base_fare: 0,
  fare_per_km: 0,
  fare_per_min: 0,
  surge_enabled: true,
  is_active: true,
};

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {/* Stats cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="glass rounded-2xl p-4 border border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/5 animate-pulse" />
              <div className="space-y-1.5">
                <div className="h-3 w-24 bg-white/5 rounded animate-pulse" />
                <div className="h-5 w-10 bg-white/5 rounded animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>
      {/* Category cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="glass rounded-2xl p-5">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-white/5 animate-pulse" />
                <div className="space-y-1.5">
                  <div className="h-4 w-24 bg-white/5 rounded animate-pulse" />
                  <div className="h-3 w-32 bg-white/5 rounded animate-pulse" />
                </div>
              </div>
              <div className="w-8 h-8 bg-white/5 rounded-lg animate-pulse" />
            </div>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[1, 2, 3].map((j) => (
                <div key={j} className="bg-white/5 rounded-lg p-2 space-y-1.5">
                  <div className="h-2.5 w-12 mx-auto bg-white/5 rounded animate-pulse" />
                  <div className="h-3.5 w-14 mx-auto bg-white/5 rounded animate-pulse" />
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-white/5">
              <div className="w-11 h-6 bg-white/5 rounded-full animate-pulse" />
              <div className="flex gap-2">
                <div className="h-4 w-12 bg-white/5 rounded-full animate-pulse" />
                <div className="h-4 w-16 bg-white/5 rounded-full animate-pulse" />
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
export default function ServiceCategoriesPage() {
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  /* Modal */
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  /* ═══════════════════════════════════════════════════════════════
     FETCH CATEGORIES
     ═══════════════════════════════════════════════════════════════ */
  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('service_categories')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) {
        console.error('Error fetching categories:', error.message);
        toast.error('Error al cargar categorias de servicio');
        return;
      }
      setCategories(data || []);
    } catch (err) {
      console.error('Error fetching categories:', err);
      toast.error('Error al cargar categorias de servicio');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  /* ═══════════════════════════════════════════════════════════════
     OPEN CREATE / EDIT MODAL
     ═══════════════════════════════════════════════════════════════ */
  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (cat: ServiceCategory) => {
    setEditingId(cat.id);
    setForm({
      name: cat.name,
      description: cat.description || '',
      icon: cat.icon || 'car',
      base_fare: cat.base_fare,
      fare_per_km: cat.fare_per_km,
      fare_per_min: cat.fare_per_min,
      surge_enabled: cat.surge_enabled,
      is_active: cat.is_active,
    });
    setModalOpen(true);
  };

  /* ═══════════════════════════════════════════════════════════════
     SAVE
     ═══════════════════════════════════════════════════════════════ */
  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        icon: form.icon,
        base_fare: form.base_fare,
        fare_per_km: form.fare_per_km,
        fare_per_min: form.fare_per_min,
        surge_enabled: form.surge_enabled,
        is_active: form.is_active,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { error } = await supabase
          .from('service_categories')
          .update(payload)
          .eq('id', editingId);
        if (error) throw error;
        toast.success('Categoria de servicio actualizada');
      } else {
        const nextSort = (categories.length > 0
          ? Math.max(...categories.map((c) => c.sort_order || 0))
          : 0) + 1;
        payload.sort_order = nextSort;
        const { error } = await supabase
          .from('service_categories')
          .insert(payload);
        if (error) throw error;
        toast.success('Categoria de servicio creada');
      }

      setModalOpen(false);
      fetchCategories();
    } catch (err: any) {
      console.error('Error saving category:', err);
      toast.error(err?.message || 'Error al guardar categoria');
    } finally {
      setSaving(false);
    }
  };

  /* ═══════════════════════════════════════════════════════════════
     TOGGLE ACTIVE
     ═══════════════════════════════════════════════════════════════ */
  const handleToggle = async (cat: ServiceCategory) => {
    setTogglingId(cat.id);
    const newActive = !cat.is_active;
    try {
      const { error } = await supabase
        .from('service_categories')
        .update({
          is_active: newActive,
          updated_at: new Date().toISOString(),
        })
        .eq('id', cat.id);

      if (error) throw error;
      toast.success(newActive ? 'Categoria activada' : 'Categoria desactivada');
      fetchCategories();
    } catch (err) {
      console.error('Error toggling category:', err);
      toast.error('Error al cambiar estado');
    } finally {
      setTogglingId(null);
    }
  };

  /* ═══════════════════════════════════════════════════════════════
     FORM UPDATE
     ═══════════════════════════════════════════════════════════════ */
  const updateForm = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  /* ═══════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-6">
      {/* ─── Header ──────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Categorias de Servicio</h1>
          <p className="text-gray-400 mt-1">
            Administra las categorias de servicio disponibles para los pasajeros
          </p>
        </div>
        <motion.button
          type="button"
          onClick={openCreate}
          className="btn-neon text-white py-3 rounded-xl text-sm font-semibold flex items-center gap-2 px-5"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Plus className="w-4 h-4" />
          CREAR CATEGORIA
        </motion.button>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
        <Link href="/admin" className="hover:text-white transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          Panel
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-white font-medium">Categorias de Servicio</span>
      </div>

      {/* ─── Stats ───────────────────────────────────────── */}
      {!loading && (
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="glass rounded-2xl p-4 border border-cyan-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 flex items-center justify-center">
              <Tag className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-wider">Total Categorias</p>
              <p className="text-lg font-bold text-cyan-400">{categories.length}</p>
            </div>
          </div>
        </div>
        <div className="glass rounded-2xl p-4 border border-emerald-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
              <Zap className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-wider">Activas</p>
              <p className="text-lg font-bold text-emerald-400">
                {categories.filter((c) => c.is_active).length}
              </p>
            </div>
          </div>
        </div>
        <div className="glass rounded-2xl p-4 border border-amber-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
              <Zap className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-wider">Con Surge</p>
              <p className="text-lg font-bold text-amber-400">
                {categories.filter((c) => c.surge_enabled).length}
              </p>
            </div>
          </div>
        </div>
      </motion.div>
      )}

      {/* ─── Category Cards Grid ────────────────────────── */}
      {loading ? (
        <LoadingSkeleton />
      ) : categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-500">
          <Tag className="w-12 h-12 mb-3 opacity-40" />
          <p>No hay categorias de servicio registradas</p>
          <button
            type="button"
            onClick={openCreate}
            className="mt-4 btn-neon text-white py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 px-4"
          >
            <Plus className="w-4 h-4" />
            Crear primera categoria
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {categories.map((cat, i) => {
              const IconComponent = getIcon(cat.icon);
              const gradient = iconGradientMap[cat.icon] || 'from-cyan-600 to-cyan-400';

              return (
                <motion.div
                  key={cat.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="glass rounded-2xl p-5 hover:bg-white/[0.07] transition-all group"
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center bg-gradient-to-br ${gradient}`}>
                        <IconComponent className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white">{cat.name}</h3>
                        {cat.description && (
                          <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-1">{cat.description}</p>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openEdit(cat)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all"
                      title="Editar"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Fare Info */}
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="bg-white/5 rounded-lg p-2 text-center">
                      <p className="text-[9px] text-gray-500 uppercase tracking-wide mb-0.5">Tarifa Base</p>
                      <p className="text-xs font-bold text-cyan-400">{formatColones(cat.base_fare)}</p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-2 text-center">
                      <p className="text-[9px] text-gray-500 uppercase tracking-wide mb-0.5">Tarifa/Km</p>
                      <p className="text-xs font-bold text-emerald-400">{formatColones(cat.fare_per_km)}</p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-2 text-center">
                      <p className="text-[9px] text-gray-500 uppercase tracking-wide mb-0.5">Tarifa/Min</p>
                      <p className="text-xs font-bold text-amber-400">{formatColones(cat.fare_per_min)}</p>
                    </div>
                  </div>

                  {/* Bottom: Toggle + Surge badge */}
                  <div className="flex items-center justify-between pt-3 border-t border-white/5">
                    {/* Animated Toggle Switch */}
                    <button
                      type="button"
                      onClick={() => handleToggle(cat)}
                      disabled={togglingId === cat.id}
                      className={`relative w-11 h-6 rounded-full transition-colors duration-300 disabled:opacity-50 ${
                        cat.is_active ? 'bg-cyan-500' : 'bg-white/10'
                      }`}
                    >
                      {togglingId === cat.id ? (
                        <div className="absolute top-0.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-white shadow-md">
                          <Loader2 className="w-3 h-3 animate-spin text-cyan-500 mt-1" />
                        </div>
                      ) : (
                        <motion.div
                          className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md"
                          animate={{ left: cat.is_active ? 'calc(100% - 22px)' : '2px' }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        />
                      )}
                    </button>

                    <div className="flex items-center gap-2">
                      {cat.surge_enabled && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 flex items-center gap-1">
                          <Zap className="w-2.5 h-2.5" />
                          Surge
                        </span>
                      )}
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        cat.is_active
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-gray-500/15 text-gray-500'
                      }`}>
                        {cat.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          CREATE / EDIT MODAL
          ═══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="glass-strong rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-5 border-b border-white/10 flex items-center justify-between">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Tag className="w-5 h-5 text-cyan-400" />
                  {editingId ? 'Editar Categoria' : 'Crear Categoria'}
                </h2>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Nombre *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => updateForm('name', e.target.value)}
                    placeholder="Ej: Básico, SUV, Lujo"
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-cyan-500 text-white placeholder:text-gray-600 outline-none text-sm"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Descripcion</label>
                  <input
                    type="text"
                    value={form.description}
                    onChange={(e) => updateForm('description', e.target.value)}
                    placeholder="Descripcion breve de la categoria"
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-cyan-500 text-white placeholder:text-gray-600 outline-none text-sm"
                  />
                </div>

                {/* Icon */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Icono</label>
                  <div className="grid grid-cols-4 gap-2">
                    {iconOptions.map((opt) => {
                      const OptIcon = getIcon(opt.value);
                      const isSelected = form.icon === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => updateForm('icon', opt.value)}
                          className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all ${
                            isSelected
                              ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-400'
                              : 'bg-white/5 border border-transparent text-gray-400 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <OptIcon className="w-5 h-5" />
                          <span className="text-[10px]">{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Fares */}
                <div className="space-y-3">
                  <p className="text-xs font-medium text-gray-400 flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-cyan-400" />
                    Tarifas
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-1">Tarifa Base</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">₡</span>
                        <input
                          type="number"
                          value={form.base_fare || ''}
                          onChange={(e) => updateForm('base_fare', Number(e.target.value))}
                          min={0}
                          className="w-full pl-8 pr-2 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-cyan-500 text-white outline-none text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-1">Tarifa/Km</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">₡</span>
                        <input
                          type="number"
                          value={form.fare_per_km || ''}
                          onChange={(e) => updateForm('fare_per_km', Number(e.target.value))}
                          min={0}
                          className="w-full pl-8 pr-2 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-cyan-500 text-white outline-none text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-1">Tarifa/Min</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">₡</span>
                        <input
                          type="number"
                          value={form.fare_per_min || ''}
                          onChange={(e) => updateForm('fare_per_min', Number(e.target.value))}
                          min={0}
                          className="w-full pl-8 pr-2 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-cyan-500 text-white outline-none text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Toggles */}
                <div className="space-y-3">
                  {/* Surge Toggle */}
                  <div className="flex items-center justify-between bg-white/5 rounded-xl p-4">
                    <div>
                      <p className="text-sm font-medium text-white flex items-center gap-1.5">
                        <Zap className="w-4 h-4 text-amber-400" />
                        Precios Dinamicos (Surge)
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">Permitir multiplicadores por alta demanda</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateForm('surge_enabled', !form.surge_enabled)}
                      className={`relative w-14 h-7 rounded-full transition-colors duration-300 ${
                        form.surge_enabled ? 'bg-amber-500' : 'bg-white/10'
                      }`}
                    >
                      <motion.div
                        className="absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md"
                        animate={{ left: form.surge_enabled ? 'calc(100% - 26px)' : '2px' }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      />
                    </button>
                  </div>

                  {/* Active Toggle */}
                  <div className="flex items-center justify-between bg-white/5 rounded-xl p-4">
                    <div>
                      <p className="text-sm font-medium text-white">Categoria Activa</p>
                      <p className="text-xs text-gray-500 mt-0.5">Las categorias inactivas no se muestran a los pasajeros</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateForm('is_active', !form.is_active)}
                      className={`relative w-14 h-7 rounded-full transition-colors duration-300 ${
                        form.is_active ? 'bg-cyan-500' : 'bg-white/10'
                      }`}
                    >
                      <motion.div
                        className="absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md"
                        animate={{ left: form.is_active ? 'calc(100% - 26px)' : '2px' }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      />
                    </button>
                  </div>
                </div>

                {/* Preview */}
                <div className="bg-white/5 rounded-xl p-4">
                  <p className="text-xs font-medium text-gray-400 mb-3">Vista Previa</p>
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center bg-gradient-to-br ${iconGradientMap[form.icon] || 'from-cyan-600 to-cyan-400'}`}>
                      {(() => {
                        const PreviewIcon = getIcon(form.icon);
                        return <PreviewIcon className="w-5 h-5 text-white" />;
                      })()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">{form.name || 'Nombre de categoria'}</p>
                      <p className="text-xs text-gray-500 truncate">{form.description || 'Descripcion de la categoria'}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {form.surge_enabled && (
                        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400">Surge</span>
                      )}
                      <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
                        form.is_active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-gray-500/15 text-gray-500'
                      }`}>
                        {form.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-5 border-t border-white/10 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-white/5 text-gray-400 text-sm font-medium hover:bg-white/10 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-neon text-white py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 px-5 disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Tag className="w-4 h-4" />
                  )}
                  {saving ? 'Guardando...' : editingId ? 'Actualizar' : 'Crear Categoria'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
