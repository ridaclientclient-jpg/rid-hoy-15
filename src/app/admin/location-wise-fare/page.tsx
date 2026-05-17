'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  MapPin, Plus, Edit2, Trash2, Loader2, X,
  ChevronRight, ArrowLeft, Save, Car, Route,
  DollarSign, ToggleLeft, ToggleRight, Search, Filter,
  ChevronDown, AlertCircle, Info, List, ArrowLeftRight,
  Copy, Eye
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

/* ─── Types ────────────────────────────────────────────────── */
interface LocationWiseFare {
  id: string;
  source_id: string;
  destination_id: string;
  vehicle_type_id: string | null;
  flat_fare: number;
  is_active: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
  // Joined
  source_name?: string;
  destination_name?: string;
  vehicle_type_name?: string;
  source_address?: string;
  destination_address?: string;
}

interface AdminPlace {
  id: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
}

interface VehicleType {
  id: string;
  name: string;
  icon: string;
}

/* ─── Helpers ────────────────────────────────────────────────── */
function formatColones(amount: number): string {
  return '₡' + Number(amount).toLocaleString('es-CR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const emptyFare = () => ({
  source_id: '',
  destination_id: '',
  vehicle_type_id: null as string | null,
  flat_fare: 0,
  is_active: true,
  notes: '',
});

/* ═══════════════════════════════════════════════════════════════
   ADD PLACE INLINE MODAL
   ═══════════════════════════════════════════════════════════════ */
function AddPlaceModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (place: AdminPlace) => void;
}) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('admin_places')
        .insert({ name: name.trim(), address: address.trim() })
        .select()
        .single();
      if (error) throw error;
      toast.success('Lugar creado');
      onCreated(data as AdminPlace);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Error al crear lugar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <motion.div className="relative glass-strong rounded-2xl p-6 w-full max-w-md z-10"
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Plus className="w-4 h-4 text-cyan-400" />
            Nuevo Lugar
          </h3>
          <button type="button" onClick={onClose}
            className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-400">Nombre del lugar *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50"
              placeholder="Ej: Aeropuerto Juan Santamaría" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-400">Dirección</label>
            <input type="text" value={address} onChange={e => setAddress(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50"
              placeholder="Dirección o referencia" />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={handleSave} disabled={saving}
              className="flex-1 py-2.5 rounded-xl btn-neon text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Guardando...' : 'Crear Lugar'}
            </button>
            <button type="button" onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-sm hover:bg-white/10 transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   LOADING SKELETON
   ═══════════════════════════════════════════════════════════════ */
function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="glass rounded-2xl p-5">
        <div className="h-5 w-48 rounded bg-white/5 mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="h-10 rounded-xl bg-white/5" />
          <div className="h-10 rounded-xl bg-white/5" />
          <div className="h-10 rounded-xl bg-white/5" />
          <div className="h-10 rounded-xl bg-white/5" />
        </div>
      </div>
      <div className="glass rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-white/10">
          <div className="h-3 w-64 rounded bg-white/5" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-white/5">
            <div className="w-8 h-8 rounded-lg bg-white/5" />
            <div className="flex-1"><div className="h-4 w-32 rounded bg-white/5 mb-1" /><div className="h-3 w-20 rounded bg-white/5" /></div>
            <div className="h-5 w-20 rounded bg-white/5" />
            <div className="w-5 h-5 rounded-full bg-white/5" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export default function LocationWiseFarePage() {
  const [fares, setFares] = useState<LocationWiseFare[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'form' | 'list'>('list');

  // Form
  const [editingFare, setEditingFare] = useState<LocationWiseFare | null>(null);
  const [formData, setFormData] = useState(emptyFare());
  const [formSaving, setFormSaving] = useState(false);

  // Data for dropdowns
  const [places, setPlaces] = useState<AdminPlace[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);

  // Modals
  const [showAddPlaceModal, setShowAddPlaceModal] = useState<'source' | 'destination' | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  /* ── Load data ── */
  const loadFares = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('location_wise_fares')
      .select(`
        *,
        source:admin_places!location_wise_fares_source_id_fkey(id, name, address),
        destination:admin_places!location_wise_fares_destination_id_fkey(id, name, address),
        vehicle_type:vehicle_types!location_wise_fares_vehicle_type_id_fkey(id, name, icon)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Error al cargar tarifas');
      console.error(error);
      setFares([]);
    } else {
      // Flatten joined data
      const flat = (data || []).map((item: any) => ({
        ...item,
        source_name: item.source?.name,
        source_address: item.source?.address,
        destination_name: item.destination?.name,
        destination_address: item.destination?.address,
        vehicle_type_name: item.vehicle_type?.name || 'Todos',
        vehicle_type_icon: item.vehicle_type?.icon,
      }));
      setFares(flat);
    }
    setLoading(false);
  }, []);

  const loadPlaces = useCallback(async () => {
    const { data } = await supabase
      .from('admin_places')
      .select('id, name, address, lat, lng')
      .eq('is_active', true)
      .order('name', { ascending: true });
    setPlaces((data || []) as AdminPlace[]);
  }, []);

  const loadVehicleTypes = useCallback(async () => {
    const { data } = await supabase
      .from('vehicle_types')
      .select('id, name, icon')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    setVehicleTypes((data || []) as VehicleType[]);
  }, []);

  useEffect(() => {
    loadFares();
    loadPlaces();
    loadVehicleTypes();
  }, [loadFares, loadPlaces, loadVehicleTypes]);

  /* ── Filter ── */
  const filteredFares = fares.filter(f => {
    const matchSearch = !search ||
      (f.source_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (f.destination_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (f.vehicle_type_name || '').toLowerCase().includes(search.toLowerCase());
    return matchSearch;
  });

  /* ── CRUD ── */
  const openCreateForm = () => {
    setEditingFare(null);
    setFormData(emptyFare());
    setViewMode('form');
  };

  const openEditForm = (fare: LocationWiseFare) => {
    setEditingFare(fare);
    setFormData({
      source_id: fare.source_id,
      destination_id: fare.destination_id,
      vehicle_type_id: fare.vehicle_type_id,
      flat_fare: fare.flat_fare,
      is_active: fare.is_active,
      notes: fare.notes || '',
    });
    setViewMode('form');
  };

  const handleSave = async () => {
    if (!formData.source_id) { toast.error('Selecciona un origen'); return; }
    if (!formData.destination_id) { toast.error('Selecciona un destino'); return; }
    if (formData.source_id === formData.destination_id) { toast.error('Origen y destino no pueden ser iguales'); return; }
    if (formData.flat_fare <= 0) { toast.error('La tarifa debe ser mayor a ₡0'); return; }

    setFormSaving(true);
    try {
      const payload = {
        source_id: formData.source_id,
        destination_id: formData.destination_id,
        vehicle_type_id: formData.vehicle_type_id || null,
        flat_fare: formData.flat_fare,
        is_active: formData.is_active,
        notes: formData.notes,
      };

      if (editingFare) {
        const { error } = await supabase
          .from('location_wise_fares')
          .update(payload)
          .eq('id', editingFare.id);
        if (error) throw error;
        toast.success('Tarifa actualizada');
      } else {
        const { error } = await supabase
          .from('location_wise_fares')
          .insert(payload);
        if (error) throw error;
        toast.success('Tarifa creada');
      }
      setViewMode('list');
      loadFares();
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar');
    } finally {
      setFormSaving(false);
    }
  };

  const toggleActive = async (fare: LocationWiseFare) => {
    try {
      const { error } = await supabase
        .from('location_wise_fares')
        .update({ is_active: !fare.is_active })
        .eq('id', fare.id);
      if (error) throw error;
      toast.success(`Tarifa ${fare.is_active ? 'desactivada' : 'activada'}`);
      loadFares();
    } catch (err: any) {
      toast.error(err.message || 'Error al cambiar estado');
    }
  };

  const deleteFare = async (id: string) => {
    try {
      const { error } = await supabase
        .from('location_wise_fares')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast.success('Tarifa eliminada');
      setDeleteConfirm(null);
      loadFares();
    } catch (err: any) {
      toast.error(err.message || 'Error al eliminar');
    }
  };

  const resetForm = () => {
    setFormData(emptyFare());
  };

  const onPlaceCreated = (place: AdminPlace) => {
    loadPlaces();
    if (showAddPlaceModal === 'source') {
      setFormData(prev => ({ ...prev, source_id: place.id }));
    } else if (showAddPlaceModal === 'destination') {
      setFormData(prev => ({ ...prev, destination_id: place.id }));
    }
  };

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('es-CR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const activeFaresCount = fares.filter(f => f.is_active).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/admin" className="hover:text-white transition-colors flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" />
            Panel
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-white font-medium">Location Wise Fare</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
            <Route className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Location Wise Fare</h1>
            <p className="text-gray-400 mt-1">Tarifas planas por ruta origen-destino y tipo de vehiculo</p>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <motion.div className="glass rounded-2xl p-4 border border-amber-500/20"
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-amber-300 font-medium">Como funciona</p>
            <p className="text-xs text-gray-400 mt-1">
              Esta funcion te permite definir tarifas planas para rutas especificas. Por ejemplo,
              los viajes del Aeropuerto Juan Santamaria al Centro de San Jose tendran un precio fijo de ₡8,000,
              independientemente de la distancia calculada. Cuando un cliente solicita un viaje con origen y destino
              que coincidan con una tarifa configurada, se usara esa tarifa en vez del calculo normal.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      {!loading && (
        <motion.div className="grid grid-cols-2 sm:grid-cols-4 gap-3"
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <div className="glass rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-white">{fares.length}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">Total Tarifas</p>
          </div>
          <div className="glass rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-emerald-400">{activeFaresCount}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">Activas</p>
          </div>
          <div className="glass rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-cyan-400">{places.length}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">Lugares</p>
          </div>
          <div className="glass rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-amber-400">{vehicleTypes.length}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">Tipos Vehiculo</p>
          </div>
        </motion.div>
      )}

      {loading && <LoadingSkeleton />}

      {!loading && (
        <>
          {/* ── FORM VIEW ── */}
          {viewMode === 'form' && (
            <motion.div className="glass rounded-2xl p-6"
              initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Plus className="w-5 h-5 text-cyan-400" />
                  {editingFare ? 'Editar Location Wise Fare' : 'Add Location Wise Fare'}
                </h2>
                <button type="button" onClick={() => setViewMode('list')}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500/15 text-cyan-400 text-xs font-semibold hover:bg-cyan-500/25 transition-colors">
                  <List className="w-3.5 h-3.5" />
                  BACK TO LISTING
                </button>
              </div>

              <div className="space-y-4">
                {/* Source */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-400">
                    Source Location Name <span className="text-red-400">*</span>
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <select value={formData.source_id}
                        onChange={e => setFormData(prev => ({ ...prev, source_id: e.target.value }))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500/50 appearance-none cursor-pointer">
                        <option value="" className="bg-[#111827]">Select Source Location Name</option>
                        {places.map(p => (
                          <option key={p.id} value={p.id} className="bg-[#111827]">{p.name}{p.address ? ` — ${p.address}` : ''}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                    </div>
                    <button type="button" onClick={() => setShowAddPlaceModal('source')}
                      className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-cyan-500/15 text-cyan-400 text-xs font-semibold hover:bg-cyan-500/25 transition-colors flex-shrink-0">
                      <Plus className="w-3.5 h-3.5" />
                      Enter New Location
                    </button>
                  </div>
                </div>

                {/* Arrow indicator */}
                <div className="flex justify-center">
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                    <ArrowLeftRight className="w-4 h-4 text-gray-500" />
                  </div>
                </div>

                {/* Destination */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-400">
                    Destination Location Name <span className="text-red-400">*</span>
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <select value={formData.destination_id}
                        onChange={e => setFormData(prev => ({ ...prev, destination_id: e.target.value }))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500/50 appearance-none cursor-pointer">
                        <option value="" className="bg-[#111827]">Select Destination Location Name</option>
                        {places.map(p => (
                          <option key={p.id} value={p.id} className="bg-[#111827]">{p.name}{p.address ? ` — ${p.address}` : ''}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                    </div>
                    <button type="button" onClick={() => setShowAddPlaceModal('destination')}
                      className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-cyan-500/15 text-cyan-400 text-xs font-semibold hover:bg-cyan-500/25 transition-colors flex-shrink-0">
                      <Plus className="w-3.5 h-3.5" />
                      Enter New Location
                    </button>
                  </div>
                </div>

                {/* Vehicle Type + Flat Fare */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-400">
                      Vehicle Type
                    </label>
                    <div className="relative">
                      <select value={formData.vehicle_type_id || ''}
                        onChange={e => setFormData(prev => ({ ...prev, vehicle_type_id: e.target.value || null }))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500/50 appearance-none cursor-pointer">
                        <option value="" className="bg-[#111827]">Todos los vehiculos</option>
                        {vehicleTypes.map(vt => (
                          <option key={vt.id} value={vt.id} className="bg-[#111827]">{vt.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-400 flex items-center gap-1">
                      Enter Flat Fare (₡ CRC)
                      <span className="text-red-400">*</span>
                      <Info className="w-3 h-3 text-gray-600" title="Tarifa fija en colones para esta ruta" />
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">₡</span>
                      <input type="number" min="0" step="100"
                        value={formData.flat_fare || ''}
                        onChange={e => setFormData(prev => ({ ...prev, flat_fare: Number(e.target.value) || 0 }))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 font-mono"
                        placeholder="8000" />
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-400">Notas (opcional)</label>
                  <input type="text" value={formData.notes}
                    onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50"
                    placeholder="Nota o referencia adicional" />
                </div>

                {/* Status toggle */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-400">Estado</label>
                  <button type="button" onClick={() => setFormData(prev => ({ ...prev, is_active: !prev.is_active }))}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-colors ${
                      formData.is_active
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                        : 'border-white/10 bg-white/5 text-gray-500'
                    }`}>
                    {formData.is_active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                    <span className="text-sm">{formData.is_active ? 'Activa' : 'Inactiva'}</span>
                  </button>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 pt-3 border-t border-white/5">
                  <button type="button" onClick={handleSave} disabled={formSaving}
                    className="flex-1 py-3 rounded-xl btn-neon text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
                    {formSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {formSaving ? 'Guardando...' : (editingFare ? 'Guardar Cambios' : 'Add Location Wise Fare')}
                  </button>
                  <button type="button" onClick={resetForm}
                    className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-sm font-medium hover:bg-white/10 transition-colors">
                    Reset
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── LIST VIEW ── */}
          {viewMode === 'list' && (
            <>
              {/* Filters */}
              <motion.div className="glass rounded-2xl p-4"
                initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                      placeholder="Buscar por origen, destino o vehiculo..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 transition-colors" />
                  </div>
                  <button type="button" onClick={openCreateForm}
                    className="py-2.5 px-5 rounded-xl btn-neon text-white text-sm font-semibold flex items-center gap-2 flex-shrink-0">
                    <Plus className="w-4 h-4" /> ADD FARE
                  </button>
                </div>
              </motion.div>

              {/* Table */}
              <motion.div className="glass rounded-2xl overflow-hidden"
                initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Ruta</th>
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3 hidden sm:table-cell">Vehiculo</th>
                        <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Tarifa</th>
                        <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Estado</th>
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3 hidden lg:table-cell">Creado</th>
                        <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredFares.map((fare, i) => (
                        <motion.tr key={fare.id} className="hover:bg-white/[0.02] transition-colors"
                          initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex flex-col items-center">
                                <MapPin className="w-4 h-4 text-emerald-400" />
                                <ArrowLeftRight className="w-3 h-3 text-gray-600" />
                                <MapPin className="w-4 h-4 text-red-400" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-white truncate max-w-[200px]">{fare.source_name || '—'}</p>
                                <p className="text-[10px] text-gray-500 flex items-center gap-1">
                                  <ArrowLeftRight className="w-2.5 h-2.5" />
                                </p>
                                <p className="text-xs font-medium text-white truncate max-w-[200px]">{fare.destination_name || '—'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-cyan-500/15 text-cyan-400">
                              <Car className="w-3 h-3" />
                              {fare.vehicle_type_name || 'Todos'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-sm font-bold text-amber-400 font-mono">
                              {formatColones(fare.flat_fare)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button type="button" onClick={() => toggleActive(fare)} className="inline-flex items-center">
                              {fare.is_active
                                ? <ToggleRight className="w-5 h-5 text-emerald-400" />
                                : <ToggleLeft className="w-5 h-5 text-gray-500" />}
                            </button>
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell">
                            <span className="text-xs text-gray-500">{formatDate(fare.created_at)}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1">
                              <button type="button" onClick={() => openEditForm(fare)}
                                className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all"
                                title="Editar">
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              {deleteConfirm === fare.id ? (
                                <div className="flex items-center gap-1">
                                  <button type="button" onClick={() => deleteFare(fare.id)}
                                    className="text-[10px] px-2 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors">Confirmar</button>
                                  <button type="button" onClick={() => setDeleteConfirm(null)}
                                    className="text-[10px] px-2 py-1 rounded bg-white/5 text-gray-400 hover:bg-white/10 transition-colors">No</button>
                                </div>
                              ) : (
                                <button type="button" onClick={() => setDeleteConfirm(fare.id)}
                                  className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                                  title="Eliminar">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {filteredFares.length === 0 && (
                  <div className="p-12 text-center">
                    <Route className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">No hay tarifas configuradas</p>
                    <p className="text-gray-600 text-xs mt-1">Agrega tu primera tarifa con el boton de arriba</p>
                  </div>
                )}
              </motion.div>
            </>
          )}
        </>
      )}

      {/* ── ADD PLACE MODAL ── */}
      <AnimatePresence>
        {showAddPlaceModal && (
          <AddPlaceModal
            onClose={() => setShowAddPlaceModal(null)}
            onCreated={onPlaceCreated}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
