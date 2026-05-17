'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bike, Car, Truck, Bus, Gem, Package, Plus, Edit3,
  Loader2, X, Users, DollarSign, Clock, Gauge,
  ChevronRight, ToggleLeft, ToggleRight, Tag, Zap, ArrowLeft
} from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */
interface VehicleType {
  id: string;
  name: string;
  description: string;
  base_price: number;
  price_per_km: number;
  price_per_min: number;
  icon: string;
  capacity: number;
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
  bike: Bike,
  car: Car,
  truck: Truck,
  bus: Bus,
  gem: Gem,
  package: Package,
};

const iconOptions = [
  { value: 'bike', label: 'Bicicleta' },
  { value: 'car', label: 'Auto' },
  { value: 'truck', label: 'Camion' },
  { value: 'bus', label: 'Bus' },
  { value: 'gem', label: 'Gema' },
  { value: 'package', label: 'Paquete' },
];

const getIcon = (iconName: string) => iconMap[iconName] || Car;

const iconColorMap: Record<string, string> = {
  bike: 'from-emerald-600 to-emerald-400',
  car: 'from-cyan-600 to-cyan-400',
  truck: 'from-amber-600 to-amber-400',
  bus: 'from-violet-600 to-violet-400',
  gem: 'from-pink-600 to-pink-400',
  package: 'from-orange-600 to-orange-400',
};

const iconBgMap: Record<string, string> = {
  bike: 'bg-emerald-500/15 text-emerald-400',
  car: 'bg-cyan-500/15 text-cyan-400',
  truck: 'bg-amber-500/15 text-amber-400',
  bus: 'bg-violet-500/15 text-violet-400',
  gem: 'bg-pink-500/15 text-pink-400',
  package: 'bg-orange-500/15 text-orange-400',
};

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */
const formatColones = (val: number) => `₡${Math.round(val).toLocaleString()}`;

const emptyForm = {
  name: '',
  description: '',
  base_price: 0,
  price_per_km: 0,
  price_per_min: 0,
  icon: 'car',
  capacity: 4,
  is_active: true,
};

function VehicleTypesLoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Stats Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="glass rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/5" />
              <div>
                <div className="h-3 w-24 bg-white/5 rounded mb-1" />
                <div className="h-5 w-16 bg-white/5 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
      {/* Vehicle Type Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="glass rounded-2xl p-5">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-white/5" />
              <div className="flex gap-1">
                <div className="w-8 h-8 rounded-lg bg-white/5" />
                <div className="w-8 h-8 rounded-lg bg-white/5" />
              </div>
            </div>
            <div className="h-4 w-28 bg-white/5 rounded mb-1" />
            <div className="h-3 w-40 bg-white/5 rounded mb-4" />
            <div className="grid grid-cols-3 gap-2">
              {[...Array(3)].map((_, j) => (
                <div key={j} className="bg-white/5 rounded-lg p-2.5">
                  <div className="h-3 w-12 bg-white/5 rounded mb-1" />
                  <div className="h-4 w-14 bg-white/5 rounded" />
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
              <div className="h-3 w-28 bg-white/5 rounded" />
              <div className="h-5 w-14 bg-white/5 rounded-full" />
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
export default function VehicleTypesPage() {
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  /* Modal */
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  /* ═══════════════════════════════════════════════════════════════
     FETCH VEHICLE TYPES
     ═══════════════════════════════════════════════════════════════ */
  const fetchVehicleTypes = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('vehicle_types')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) {
        console.error('Error fetching vehicle types:', error.message);
        toast.error('Error al cargar tipos de vehiculo');
        return;
      }
      setVehicleTypes(data || []);
    } catch (err) {
      console.error('Error fetching vehicle types:', err);
      toast.error('Error al cargar tipos de vehiculo');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVehicleTypes();
  }, [fetchVehicleTypes]);

  /* ═══════════════════════════════════════════════════════════════
     STATS
     ═══════════════════════════════════════════════════════════════ */
  const stats = {
    total: vehicleTypes.length,
    activos: vehicleTypes.filter((v) => v.is_active).length,
  };

  /* ═══════════════════════════════════════════════════════════════
     OPEN CREATE / EDIT MODAL
     ═══════════════════════════════════════════════════════════════ */
  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (vt: VehicleType) => {
    setEditingId(vt.id);
    setForm({
      name: vt.name,
      description: vt.description || '',
      base_price: vt.base_price,
      price_per_km: vt.price_per_km,
      price_per_min: vt.price_per_min,
      icon: vt.icon || 'car',
      capacity: vt.capacity || 4,
      is_active: vt.is_active,
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
        base_price: form.base_price,
        price_per_km: form.price_per_km,
        price_per_min: form.price_per_min,
        icon: form.icon,
        capacity: form.capacity,
        is_active: form.is_active,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { error } = await supabase
          .from('vehicle_types')
          .update(payload)
          .eq('id', editingId);
        if (error) throw error;
        toast.success('Tipo de vehiculo actualizado');
      } else {
        const nextSort = (vehicleTypes.length > 0
          ? Math.max(...vehicleTypes.map((v) => v.sort_order || 0))
          : 0) + 1;
        payload.sort_order = nextSort;
        const { error } = await supabase
          .from('vehicle_types')
          .insert(payload);
        if (error) throw error;
        toast.success('Tipo de vehiculo creado');
      }

      setModalOpen(false);
      fetchVehicleTypes();
    } catch (err: any) {
      console.error('Error saving vehicle type:', err);
      toast.error(err?.message || 'Error al guardar tipo de vehiculo');
    } finally {
      setSaving(false);
    }
  };

  /* ═══════════════════════════════════════════════════════════════
     TOGGLE ACTIVE
     ═══════════════════════════════════════════════════════════════ */
  const handleToggle = async (vt: VehicleType) => {
    setTogglingId(vt.id);
    const newActive = !vt.is_active;
    try {
      const { error } = await supabase
        .from('vehicle_types')
        .update({
          is_active: newActive,
          updated_at: new Date().toISOString(),
        })
        .eq('id', vt.id);

      if (error) throw error;
      toast.success(newActive ? 'Tipo activado' : 'Tipo desactivado');
      fetchVehicleTypes();
    } catch (err) {
      console.error('Error toggling vehicle type:', err);
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
          <h1 className="text-3xl font-bold text-white">Tipos de Vehiculo</h1>
          <p className="text-gray-400 mt-1">
            Administra las categorias de vehiculos disponibles en la plataforma
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
          CREAR TIPO
        </motion.button>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
        <Link href="/admin" className="hover:text-white transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          Panel
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-white font-medium">Tipos de Vehiculo</span>
      </div>

      {/* ─── Stats ───────────────────────────────────────── */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="glass rounded-2xl p-4 border border-cyan-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 flex items-center justify-center">
              <Car className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-wider">Total Tipos</p>
              <p className="text-lg font-bold text-cyan-400">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="glass rounded-2xl p-4 border border-emerald-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
              <Zap className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-wider">Tipos Activos</p>
              <p className="text-lg font-bold text-emerald-400">{stats.activos}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ─── Vehicle Type Cards ─────────────────────────── */}
      {loading ? (
        <VehicleTypesLoadingSkeleton />
      ) : vehicleTypes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-500">
          <Car className="w-12 h-12 mb-3 opacity-40" />
          <p>No hay tipos de vehiculo registrados</p>
          <button
            type="button"
            onClick={openCreate}
            className="mt-4 btn-neon text-white py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 px-4"
          >
            <Plus className="w-4 h-4" />
            Crear primer tipo
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {vehicleTypes.map((vt, i) => {
              const IconComponent = getIcon(vt.icon);
              const gradientColor = iconColorMap[vt.icon] || 'from-cyan-600 to-cyan-400';
              const bgColor = iconBgMap[vt.icon] || 'bg-cyan-500/15 text-cyan-400';

              return (
                <motion.div
                  key={vt.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="glass rounded-2xl p-5 hover:bg-white/[0.07] transition-all group"
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br ${gradientColor}`}>
                      <IconComponent className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleToggle(vt)}
                        disabled={togglingId === vt.id}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all disabled:opacity-50"
                        title={vt.is_active ? 'Desactivar' : 'Activar'}
                      >
                        {togglingId === vt.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : vt.is_active ? (
                          <ToggleRight className="w-5 h-5 text-emerald-400" />
                        ) : (
                          <ToggleLeft className="w-5 h-5 text-gray-500" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(vt)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all"
                        title="Editar"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Name & Description */}
                  <h3 className="text-base font-semibold text-white">{vt.name}</h3>
                  {vt.description && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{vt.description}</p>
                  )}

                  {/* Stats Grid */}
                  <div className="grid grid-cols-3 gap-2 mt-4">
                    <div className="bg-white/5 rounded-lg p-2.5 text-center">
                      <p className="text-[10px] text-gray-500 mb-0.5">Precio Base</p>
                      <p className="text-xs font-bold text-cyan-400">{formatColones(vt.base_price)}</p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-2.5 text-center">
                      <p className="text-[10px] text-gray-500 mb-0.5">Precio/Km</p>
                      <p className="text-xs font-bold text-emerald-400">{formatColones(vt.price_per_km)}</p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-2.5 text-center">
                      <p className="text-[10px] text-gray-500 mb-0.5">Precio/Min</p>
                      <p className="text-xs font-bold text-amber-400">{formatColones(vt.price_per_min)}</p>
                    </div>
                  </div>

                  {/* Capacity */}
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                      <Users className="w-3.5 h-3.5" />
                      Capacidad: <span className="text-white font-medium">{vt.capacity}</span>
                    </div>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      vt.is_active
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-gray-500/15 text-gray-400'
                    }`}>
                      {vt.is_active ? 'Activo' : 'Inactivo'}
                    </span>
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
                  <Car className="w-5 h-5 text-cyan-400" />
                  {editingId ? 'Editar Tipo' : 'Crear Tipo'}
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
                    placeholder="Ej: Auto Economico"
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
                    placeholder="Descripcion breve del tipo de vehiculo"
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-cyan-500 text-white placeholder:text-gray-600 outline-none text-sm"
                  />
                </div>

                {/* Icon + Capacity */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Icono</label>
                    <select
                      value={form.icon}
                      onChange={(e) => updateForm('icon', e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-cyan-500 text-white outline-none text-sm appearance-none cursor-pointer"
                    >
                      {iconOptions.map((opt) => (
                        <option key={opt.value} value={opt.value} className="bg-[#0a0e1a]">
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Capacidad (pasajeros)</label>
                    <div className="relative">
                      <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <input
                        type="number"
                        value={form.capacity}
                        onChange={(e) => updateForm('capacity', Number(e.target.value))}
                        min={1}
                        max={50}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-cyan-500 text-white outline-none text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Prices */}
                <div className="space-y-3">
                  <p className="text-xs font-medium text-gray-400 flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-cyan-400" />
                    Precios
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-1">Precio Base</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">₡</span>
                        <input
                          type="number"
                          value={form.base_price || ''}
                          onChange={(e) => updateForm('base_price', Number(e.target.value))}
                          min={0}
                          className="w-full pl-8 pr-2 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-cyan-500 text-white outline-none text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-1">Precio/Km</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">₡</span>
                        <input
                          type="number"
                          value={form.price_per_km || ''}
                          onChange={(e) => updateForm('price_per_km', Number(e.target.value))}
                          min={0}
                          className="w-full pl-8 pr-2 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-cyan-500 text-white outline-none text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-1">Precio/Min</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">₡</span>
                        <input
                          type="number"
                          value={form.price_per_min || ''}
                          onChange={(e) => updateForm('price_per_min', Number(e.target.value))}
                          min={0}
                          className="w-full pl-8 pr-2 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-cyan-500 text-white outline-none text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Active Toggle */}
                <div className="flex items-center justify-between bg-white/5 rounded-xl p-4">
                  <div>
                    <p className="text-sm font-medium text-white">Tipo Activo</p>
                    <p className="text-xs text-gray-500">Los tipos inactivos no se muestran a los pasajeros</p>
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

                {/* Icon Preview */}
                <div className="bg-white/5 rounded-xl p-4">
                  <p className="text-xs font-medium text-gray-400 mb-3">Vista Previa</p>
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br ${iconColorMap[form.icon] || 'from-cyan-600 to-cyan-400'}`}>
                      {(() => {
                        const PreviewIcon = getIcon(form.icon);
                        return <PreviewIcon className="w-6 h-6 text-white" />;
                      })()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{form.name || 'Nombre del tipo'}</p>
                      <p className="text-xs text-gray-500">{form.description || 'Descripcion del tipo'}</p>
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
                    <Car className="w-4 h-4" />
                  )}
                  {saving ? 'Guardando...' : editingId ? 'Actualizar' : 'Crear Tipo'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
