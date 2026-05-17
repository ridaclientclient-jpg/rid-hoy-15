'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wrench,
  Plus,
  X,
  Loader2,
  Filter,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ChevronDown,
  Fuel,
  Disc3,
  CircleDot,
  Settings,
  ClipboardCheck,
  Battery,
  MoreHorizontal,
  Trash2,
  Save,
  MapPin,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

// ── Types ───────────────────────────────────────────────────────────────────

type MaintenanceType =
  | 'oil_change'
  | 'tire_rotation'
  | 'brake_service'
  | 'engine_service'
  | 'general_inspection'
  | 'battery_replacement'
  | 'other';

type MaintenanceStatus = 'pending' | 'in_progress' | 'completed';

interface Vehicle {
  id: string;
  plate: string;
  model: string;
  color: string;
  year?: number;
}

interface MaintenanceRecord {
  id: string;
  driver_id: string;
  vehicle_id: string;
  maintenance_type: MaintenanceType;
  description: string | null;
  odometer_km: number | null;
  cost: number | null;
  maintenance_date: string | null;
  next_maintenance_km: number | null;
  next_maintenance_date: string | null;
  shop_name: string | null;
  status: MaintenanceStatus;
  created_at: string;
  updated_at: string;
  vehicles?: Vehicle;
}

interface MaintenanceReminder {
  record: MaintenanceRecord;
  type: 'date' | 'km';
  message: string;
  urgency: 'soon' | 'overdue';
}

// ── Constants ───────────────────────────────────────────────────────────────

const TYPE_OPTIONS: { value: MaintenanceType; label: string; icon: typeof Wrench; color: string }[] = [
  { value: 'oil_change', label: 'Cambio de aceite', icon: Fuel, color: 'text-amber-400' },
  { value: 'tire_rotation', label: 'Rotacion de llantas', icon: Disc3, color: 'text-blue-400' },
  { value: 'brake_service', label: 'Servicio de frenos', icon: CircleDot, color: 'text-red-400' },
  { value: 'engine_service', label: 'Servicio de motor', icon: Settings, color: 'text-purple-400' },
  { value: 'general_inspection', label: 'Inspeccion general', icon: ClipboardCheck, color: 'text-cyan-400' },
  { value: 'battery_replacement', label: 'Reemplazo de bateria', icon: Battery, color: 'text-yellow-400' },
  { value: 'other', label: 'Otro', icon: Wrench, color: 'text-gray-400' },
];

const STATUS_CONFIG: Record<MaintenanceStatus, { label: string; color: string; bgColor: string; icon: typeof Clock }> = {
  pending: { label: 'Pendiente', color: 'text-amber-400', bgColor: 'bg-amber-500/15', icon: Clock },
  in_progress: { label: 'En progreso', color: 'text-cyan-400', bgColor: 'bg-cyan-500/15', icon: Loader2 },
  completed: { label: 'Completado', color: 'text-emerald-400', bgColor: 'bg-emerald-500/15', icon: CheckCircle2 },
};

const INITIAL_FORM = {
  vehicle_id: '',
  maintenance_type: 'oil_change' as MaintenanceType,
  description: '',
  odometer_km: '',
  cost: '',
  maintenance_date: '',
  next_maintenance_km: '',
  next_maintenance_date: '',
  shop_name: '',
  status: 'pending' as MaintenanceStatus,
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatCost(cost: number | null): string {
  if (cost == null) return '--';
  return `₡${cost.toLocaleString('es-CR')}`;
}

function formatKm(km: number | null): string {
  if (km == null) return '--';
  return `${km.toLocaleString('es-CR')} km`;
}

function getTypeConfig(type: MaintenanceType) {
  return TYPE_OPTIONS.find(t => t.value === type) || TYPE_OPTIONS[6];
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

// ── Skeleton ────────────────────────────────────────────────────────────────

function MaintenanceSkeleton() {
  return (
    <div className="p-4 space-y-4">
      <Skeleton className="h-8 w-48 rounded-xl bg-white/5" />
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-20 rounded-xl bg-white/5" />
        ))}
      </div>
      {[1, 2, 3].map(i => (
        <Skeleton key={i} className="h-24 rounded-xl bg-white/5" />
      ))}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function VehicleMaintenance() {
  const { user } = useAuthStore();
  const [driverId, setDriverId] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Filters
  const [filterType, setFilterType] = useState<MaintenanceType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<MaintenanceStatus | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<MaintenanceRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Fetch Data ──────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Get driver record
      const { data: driverData } = await supabase
        .from('drivers')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!driverData) {
        setLoading(false);
        return;
      }

      setDriverId(driverData.id);

      // Get vehicles
      const { data: vehicleData } = await supabase
        .from('vehicles')
        .select('id, plate, model, color, year')
        .eq('driver_id', driverData.id);

      setVehicles(vehicleData || []);

      // Get maintenance records
      const { data: maintenanceData, error } = await supabase
        .from('vehicle_maintenance')
        .select('*, vehicles(id, plate, model, color, year)')
        .eq('driver_id', driverData.id)
        .order('maintenance_date', { ascending: false });

      if (error) throw error;
      setRecords(maintenanceData || []);
    } catch (err: any) {
      console.error('Error fetching maintenance data:', err);
      toast.error('Error al cargar datos', {
        description: err?.message || 'Intenta de nuevo mas tarde.',
      });
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Computed Values ─────────────────────────────────────────────────────

  const filteredRecords = records.filter(r => {
    if (filterType !== 'all' && r.maintenance_type !== filterType) return false;
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    return true;
  });

  const reminders: MaintenanceReminder[] = (() => {
    const result: MaintenanceReminder[] = [];
    for (const r of records) {
      if (r.status === 'completed') continue;

      // Check date-based reminders
      if (r.next_maintenance_date) {
        const days = daysUntil(r.next_maintenance_date);
        if (days !== null && days <= 14) {
          result.push({
            record: r,
            type: 'date',
            message: days <= 0
              ? `Mantenimiento vencido hace ${Math.abs(days)} dia(s)`
              : `Vence en ${days} dia(s)`,
            urgency: days <= 0 ? 'overdue' : 'soon',
          });
        }
      }

      // Check km-based reminders (compare with last known odometer)
      if (r.next_maintenance_km && r.odometer_km) {
        const remaining = r.next_maintenance_km - r.odometer_km;
        if (remaining <= 500) {
          result.push({
            record: r,
            type: 'km',
            message: remaining <= 0
              ? `${Math.abs(remaining).toLocaleString('es-CR')} km excedidos`
              : `${remaining.toLocaleString('es-CR')} km restantes`,
            urgency: remaining <= 0 ? 'overdue' : 'soon',
          });
        }
      }
    }
    return result;
  })();

  const totalSpent = records
    .filter(r => r.status === 'completed' && r.cost != null)
    .reduce((sum, r) => sum + (r.cost || 0), 0);

  const completedCount = records.filter(r => r.status === 'completed').length;
  const pendingCount = records.filter(r => r.status === 'pending' || r.status === 'in_progress').length;

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!driverId) return;

    if (!form.vehicle_id) {
      toast.error('Selecciona un vehiculo');
      return;
    }

    const payload: Record<string, unknown> = {
      driver_id: driverId,
      vehicle_id: form.vehicle_id,
      maintenance_type: form.maintenance_type,
      status: form.status,
    };

    if (form.description.trim()) payload.description = form.description.trim();
    if (form.odometer_km) payload.odometer_km = parseInt(form.odometer_km);
    if (form.cost) payload.cost = parseInt(form.cost);
    if (form.maintenance_date) payload.maintenance_date = form.maintenance_date;
    if (form.next_maintenance_km) payload.next_maintenance_km = parseInt(form.next_maintenance_km);
    if (form.next_maintenance_date) payload.next_maintenance_date = form.next_maintenance_date;
    if (form.shop_name.trim()) payload.shop_name = form.shop_name.trim();

    setSaving(true);
    try {
      const { error } = await supabase
        .from('vehicle_maintenance')
        .insert(payload);

      if (error) throw error;

      toast.success('Mantenimiento registrado', {
        description: `${getTypeConfig(form.maintenance_type).label} agregado correctamente.`,
      });

      setForm(INITIAL_FORM);
      setShowForm(false);
      fetchData();
    } catch (err: any) {
      toast.error('Error al registrar', {
        description: err?.message || 'Intenta de nuevo.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (record: MaintenanceRecord, newStatus: MaintenanceStatus) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('vehicle_maintenance')
        .update({ status: newStatus })
        .eq('id', record.id);

      if (error) throw error;

      toast.success('Estado actualizado', {
        description: `Cambiado a: ${STATUS_CONFIG[newStatus].label}`,
      });

      fetchData();
    } catch (err: any) {
      toast.error('Error al actualizar', {
        description: err?.message || 'Intenta de nuevo.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from('vehicle_maintenance')
        .delete()
        .eq('id', deleteTarget.id);

      if (error) throw error;

      toast.success('Registro eliminado');
      setDeleteTarget(null);
      fetchData();
    } catch (err: any) {
      toast.error('Error al eliminar', {
        description: err?.message || 'Intenta de nuevo.',
      });
    } finally {
      setDeleting(false);
    }
  };

  const updateForm = (key: string, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  // ── Render ──────────────────────────────────────────────────────────────

  if (loading) return <MaintenanceSkeleton />;

  if (!driverId) {
    return (
      <div className="p-4 text-center py-16">
        <Wrench className="w-12 h-12 text-gray-600 mx-auto mb-3" />
        <p className="text-sm text-gray-400">No se encontro registro de conductor</p>
        <p className="text-xs text-gray-600 mt-1">Registra tu vehiculo primero</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-orange-500/20 flex items-center justify-center">
              <Wrench className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white">Mantenimiento</h1>
              <p className="text-xs text-gray-500">{records.length} registros</p>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowForm(!showForm)}
            className="h-8 px-3 rounded-lg bg-orange-500/20 border border-orange-500/30 text-orange-400 text-xs font-medium flex items-center gap-1.5 hover:bg-orange-500/30 transition-colors"
          >
            {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {showForm ? 'Cancelar' : 'Agregar'}
          </motion.button>
        </div>
      </motion.div>

      {/* ── Reminders ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {reminders.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="space-y-2"
          >
            <h3 className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              Recordatorios ({reminders.length})
            </h3>
            <div className="max-h-40 overflow-y-auto space-y-2 custom-scrollbar">
              {reminders.map((rem, i) => {
                const typeConfig = getTypeConfig(rem.record.maintenance_type);
                const vehicleLabel = rem.record.vehicles
                  ? `${rem.record.vehicles.plate} - ${rem.record.vehicles.model}`
                  : '';
                return (
                  <motion.div
                    key={`${rem.record.id}-${rem.type}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`glass rounded-xl p-3 flex items-center gap-3 border ${
                      rem.urgency === 'overdue'
                        ? 'border-red-500/30 bg-red-500/5'
                        : 'border-amber-500/20'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      rem.urgency === 'overdue' ? 'bg-red-500/20' : 'bg-amber-500/15'
                    }`}>
                      <AlertTriangle className={`w-4 h-4 ${
                        rem.urgency === 'overdue' ? 'text-red-400' : 'text-amber-400'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate">
                        {typeConfig.label}
                      </p>
                      <p className={`text-[10px] ${
                        rem.urgency === 'overdue' ? 'text-red-400' : 'text-amber-400/80'
                      }`}>
                        {rem.message}
                      </p>
                      {vehicleLabel && (
                        <p className="text-[10px] text-gray-600">{vehicleLabel}</p>
                      )}
                    </div>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                      rem.urgency === 'overdue'
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-amber-500/15 text-amber-400'
                    }`}>
                      {rem.type === 'date' ? '📅' : '📏'}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Stats ────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-3 gap-3"
      >
        <div className="glass rounded-xl p-3 text-center">
          <p className="text-lg font-bold text-white">{completedCount}</p>
          <p className="text-[10px] text-gray-500">Completados</p>
        </div>
        <div className="glass rounded-xl p-3 text-center">
          <p className="text-lg font-bold text-amber-400">{pendingCount}</p>
          <p className="text-[10px] text-gray-500">Pendientes</p>
        </div>
        <div className="glass rounded-xl p-3 text-center">
          <p className="text-sm font-bold text-emerald-400">{formatCost(totalSpent)}</p>
          <p className="text-[10px] text-gray-500">Total gastado</p>
        </div>
      </motion.div>

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
      >
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="w-full glass rounded-xl p-3 flex items-center gap-2 hover:bg-white/5 transition-colors"
        >
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-xs text-gray-400 flex-1 text-left">
            Filtros: {filterType !== 'all' ? getTypeConfig(filterType).label : 'Todos los tipos'}
            {' · '}
            {filterStatus !== 'all' ? STATUS_CONFIG[filterStatus].label : 'Todos los estados'}
          </span>
          <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="glass-strong rounded-xl p-4 mt-2 space-y-3">
                <div>
                  <label className="text-[10px] text-gray-500 font-medium mb-1.5 block">Tipo de mantenimiento</label>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setFilterType('all')}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors ${
                        filterType === 'all'
                          ? 'bg-white/15 text-white'
                          : 'bg-white/5 text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      Todos
                    </button>
                    {TYPE_OPTIONS.map(t => (
                      <button
                        key={t.value}
                        onClick={() => setFilterType(t.value)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors ${
                          filterType === t.value
                            ? 'bg-white/15 text-white'
                            : 'bg-white/5 text-gray-500 hover:text-gray-300'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 font-medium mb-1.5 block">Estado</label>
                  <div className="flex gap-1.5">
                    {(['all', 'pending', 'in_progress', 'completed'] as const).map(s => (
                      <button
                        key={s}
                        onClick={() => setFilterStatus(s)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors ${
                          filterStatus === s
                            ? 'bg-white/15 text-white'
                            : 'bg-white/5 text-gray-500 hover:text-gray-300'
                        }`}
                      >
                        {s === 'all' ? 'Todos' : STATUS_CONFIG[s].label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── Add Form ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -10 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="glass-strong rounded-2xl p-4 space-y-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-orange-400" />
                Nuevo Mantenimiento
              </h3>

              {/* Vehicle select */}
              {vehicles.length === 0 ? (
                <p className="text-xs text-amber-400 bg-amber-500/10 rounded-lg p-2">
                  No tienes vehiculos registrados. Ve a la seccion de Vehiculo primero.
                </p>
              ) : (
                <div>
                  <label className="text-[10px] text-gray-400 mb-1 block">Vehiculo *</label>
                  <div className="flex flex-wrap gap-1.5">
                    {vehicles.map(v => (
                      <button
                        key={v.id}
                        onClick={() => updateForm('vehicle_id', v.id)}
                        className={`px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${
                          form.vehicle_id === v.id
                            ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                            : 'bg-white/5 text-gray-400 border border-white/10 hover:border-white/20'
                        }`}
                      >
                        {v.plate} - {v.model}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Maintenance type */}
              <div>
                <label className="text-[10px] text-gray-400 mb-1 block">Tipo de mantenimiento</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {TYPE_OPTIONS.map(t => (
                    <button
                      key={t.value}
                      onClick={() => updateForm('maintenance_type', t.value)}
                      className={`flex items-center gap-2 p-2 rounded-lg text-left transition-colors ${
                        form.maintenance_type === t.value
                          ? 'bg-white/10 border border-white/20'
                          : 'bg-white/5 border border-white/5 hover:border-white/15'
                      }`}
                    >
                      <t.icon className={`w-3.5 h-3.5 ${t.color} shrink-0`} />
                      <span className={`text-[10px] font-medium ${
                        form.maintenance_type === t.value ? 'text-white' : 'text-gray-400'
                      }`}>
                        {t.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Date and Odometer */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-gray-400 mb-1 block">Fecha</label>
                  <input
                    type="date"
                    value={form.maintenance_date}
                    onChange={(e) => updateForm('maintenance_date', e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/50 transition-colors [color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 mb-1 block">Odometro (km)</label>
                  <input
                    type="number"
                    placeholder="Ej: 50000"
                    value={form.odometer_km}
                    onChange={(e) => updateForm('odometer_km', e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-orange-500/50 transition-colors"
                  />
                </div>
              </div>

              {/* Cost and Shop */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-gray-400 mb-1 block">Costo (₡)</label>
                  <input
                    type="number"
                    placeholder="Ej: 25000"
                    value={form.cost}
                    onChange={(e) => updateForm('cost', e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-orange-500/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 mb-1 block">Taller</label>
                  <input
                    type="text"
                    placeholder="Nombre del taller"
                    value={form.shop_name}
                    onChange={(e) => updateForm('shop_name', e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-orange-500/50 transition-colors"
                  />
                </div>
              </div>

              {/* Next maintenance */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-gray-400 mb-1 block">Prox. fecha</label>
                  <input
                    type="date"
                    value={form.next_maintenance_date}
                    onChange={(e) => updateForm('next_maintenance_date', e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/50 transition-colors [color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 mb-1 block">Prox. km</label>
                  <input
                    type="number"
                    placeholder="Ej: 55000"
                    value={form.next_maintenance_km}
                    onChange={(e) => updateForm('next_maintenance_km', e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-orange-500/50 transition-colors"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-[10px] text-gray-400 mb-1 block">Descripcion</label>
                <textarea
                  placeholder="Detalles del mantenimiento..."
                  value={form.description}
                  onChange={(e) => updateForm('description', e.target.value)}
                  rows={2}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-orange-500/50 transition-colors resize-none"
                />
              </div>

              {/* Submit */}
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={handleSubmit}
                disabled={saving || !form.vehicle_id}
                className="w-full h-10 rounded-xl bg-orange-500 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-orange-600 transition-colors disabled:opacity-40"
              >
                {saving ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
                ) : (
                  <><Save className="w-4 h-4" /> Registrar Mantenimiento</>
                )}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Records List ─────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {filteredRecords.length === 0 && (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="glass rounded-xl p-8 text-center"
            >
              <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3">
                <Wrench className="w-7 h-7 text-gray-600" />
              </div>
              <p className="text-sm text-gray-400 mb-1">Sin registros de mantenimiento</p>
              <p className="text-xs text-gray-600">
                {records.length > 0
                  ? 'No hay registros que coincidan con los filtros.'
                  : 'Agrega tu primer registro de mantenimiento.'}
              </p>
            </motion.div>
          )}

          {filteredRecords.map((record, index) => {
            const typeConfig = getTypeConfig(record.maintenance_type);
            const statusCfg = STATUS_CONFIG[record.status];
            const vehicleLabel = record.vehicles
              ? `${record.vehicles.plate} - ${record.vehicles.model}`
              : 'Vehiculo desconocido';

            return (
              <motion.div
                key={record.id}
                layout
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 15, scale: 0.95 }}
                transition={{ duration: 0.2, delay: index * 0.03 }}
                className="glass rounded-xl overflow-hidden"
              >
                <div className="p-3">
                  {/* Top row: type icon, info, status badge */}
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-white/5`}>
                      <typeConfig.icon className={`w-5 h-5 ${typeConfig.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white truncate">
                          {typeConfig.label}
                        </span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${statusCfg.bgColor} ${statusCfg.color}`}>
                          {statusCfg.label}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-500 mt-0.5">{vehicleLabel}</p>
                      {record.description && (
                        <p className="text-[11px] text-gray-400 mt-1 line-clamp-2">{record.description}</p>
                      )}
                    </div>
                  </div>

                  {/* Details row */}
                  <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-white/5">
                    <div className="flex items-center gap-3">
                      {record.maintenance_date && (
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-gray-600" />
                          <span className="text-[10px] text-gray-400">{formatDate(record.maintenance_date)}</span>
                        </div>
                      )}
                      {record.odometer_km != null && (
                        <span className="text-[10px] text-gray-500">{formatKm(record.odometer_km)}</span>
                      )}
                      {record.cost != null && (
                        <span className="text-[10px] font-medium text-emerald-400">{formatCost(record.cost)}</span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      {/* Status quick actions */}
                      {record.status === 'pending' && (
                        <button
                          onClick={() => handleUpdateStatus(record, 'in_progress')}
                          className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                          title="Marcar en progreso"
                        >
                          <Clock className="w-3.5 h-3.5 text-cyan-500" />
                        </button>
                      )}
                      {record.status === 'in_progress' && (
                        <button
                          onClick={() => handleUpdateStatus(record, 'completed')}
                          className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                          title="Marcar completado"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        </button>
                      )}

                      {/* Shop name */}
                      {record.shop_name && (
                        <div className="flex items-center gap-1 px-1.5">
                          <MapPin className="w-3 h-3 text-gray-600" />
                          <span className="text-[9px] text-gray-500 max-w-[80px] truncate">{record.shop_name}</span>
                        </div>
                      )}

                      {/* Delete */}
                      <button
                        onClick={() => setDeleteTarget(record)}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-gray-600 hover:text-red-400" />
                      </button>
                    </div>
                  </div>

                  {/* Next maintenance info */}
                  {(record.next_maintenance_date || record.next_maintenance_km) && (
                    <div className="flex items-center gap-3 mt-2">
                      {record.next_maintenance_date && (
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-amber-500/60" />
                          <span className="text-[10px] text-gray-500">
                            Prox: {formatDate(record.next_maintenance_date)}
                          </span>
                        </div>
                      )}
                      {record.next_maintenance_km && (
                        <span className="text-[10px] text-gray-500">
                          Prox: {formatKm(record.next_maintenance_km)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* ── Delete Confirmation Dialog ───────────────────────────────────── */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6"
            onClick={() => setDeleteTarget(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="glass-strong rounded-2xl p-6 max-w-sm w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-7 h-7 text-red-400" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Eliminar registro?</h3>
                <p className="text-sm text-gray-400 mb-1">
                  Estas a punto de eliminar el registro de{' '}
                  <span className="text-white font-medium">
                    {getTypeConfig(deleteTarget.maintenance_type).label}
                  </span>
                  .
                </p>
                <p className="text-xs text-gray-600 mb-6">Esta accion no se puede deshacer.</p>

                <div className="flex gap-3">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setDeleteTarget(null)}
                    disabled={deleting}
                    className="flex-1 h-10 rounded-xl border border-white/10 text-gray-300 text-sm font-medium hover:bg-white/5 transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex-1 h-10 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {deleting ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Eliminando...</>
                    ) : (
                      <><Trash2 className="w-4 h-4" /> Eliminar</>
                    )}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
