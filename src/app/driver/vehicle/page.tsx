'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Car, Bike, Truck, Check, Plus, Pencil, Trash2, Save, X, Shield, CheckCircle, Loader2 } from 'lucide-react';
import { supabase, type Vehicle, type Driver } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';

type VehicleType = 'carro' | 'moto' | 'bici';
type ServiceMode = 'conductor' | 'repartidor' | 'ambos';

const vehicleTypeOptions: { id: VehicleType; label: string; icon: typeof Car; desc: string }[] = [
  { id: 'carro', label: 'Carro', icon: Car, desc: 'Transporte de pasajeros' },
  { id: 'moto', label: 'Moto', icon: Bike, desc: 'Reparto rapido y courier' },
  { id: 'bici', label: 'Bicicleta', icon: Bike, desc: 'Reparto ecologico' },
];

const serviceModeOptions: { id: ServiceMode; label: string; desc: string }[] = [
  { id: 'conductor', label: 'Conductor', desc: 'Transporte de pasajeros' },
  { id: 'repartidor', label: 'Repartidor', desc: 'Entregas y paquetes' },
  { id: 'ambos', label: 'Ambos', desc: 'Conductor y repartidor' },
];

export default function VehicleManagement() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [isEditing, setIsEditing] = useState(false);
  const [editVehicleId, setEditVehicleId] = useState<string | null>(null);
  const [serviceMode, setServiceMode] = useState<ServiceMode>('conductor');
  const [vehicleType, setVehicleType] = useState<VehicleType>('carro');
  const [form, setForm] = useState({ plate: '', model: '', color: '', year: '' });

  const resetForm = () => {
    setForm({ plate: '', model: '', color: '', year: '' });
    setVehicleType('carro');
    setEditVehicleId(null);
    setIsEditing(false);
  };

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      // Fetch driver record
      const { data: driverData } = await supabase
        .from('drivers')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (driverData) {
        setDriver(driverData);
        // Get service mode from driver metadata
        if (driverData.vehicle_type) {
          setServiceMode(driverData.vehicle_type as ServiceMode);
        }
      }

      // Fetch vehicles
      if (driverData?.id) {
        const { data: vehicleData } = await supabase
          .from('vehicles')
          .select('*')
          .eq('driver_id', driverData.id);
        setVehicles(vehicleData || []);
      }
    } catch (err) {
      console.error('Error fetching vehicle data:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSaveVehicle = async () => {
    if (!form.plate || !form.model || !form.color) {
      toast.error('Completa placa, modelo y color');
      return;
    }

    setSaving(true);
    try {
      // Ensure driver record exists
      let driverId = driver?.id;
      if (!driverId && user?.id) {
        const { data: newDriver } = await supabase
          .from('drivers')
          .insert({ user_id: user.id, status: 'offline' })
          .select()
          .single();
        driverId = newDriver?.id;
        if (newDriver) setDriver(newDriver);
      }

      if (!driverId) {
        toast.error('Error: no se pudo crear registro de conductor');
        setSaving(false);
        return;
      }

      const vehicleData = {
        driver_id: driverId,
        plate: form.plate.toUpperCase(),
        model: form.model,
        color: form.color,
        year: form.year ? parseInt(form.year) : null,
        verified: false,
      };

      if (editVehicleId) {
        // Update existing
        const { error } = await supabase
          .from('vehicles')
          .update(vehicleData)
          .eq('id', editVehicleId);
        if (error) throw error;
        toast.success('Vehiculo actualizado');
      } else {
        // Create new
        const { error } = await supabase
          .from('vehicles')
          .insert(vehicleData);
        if (error) throw error;
        toast.success('Vehiculo registrado correctamente');
      }

      resetForm();
      fetchData();
    } catch (err: any) {
      if (err?.message) {
        toast.error('Error: ' + err.message);
      } else {
        toast.error('Error al guardar vehiculo');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVehicle = async (id: string) => {
    if (!window.confirm('Estas seguro de que deseas eliminar este vehiculo? Esta accion no se puede deshacer.')) return;
    try {
      const { error } = await supabase
        .from('vehicles')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast.success('Vehiculo eliminado');
      fetchData();
    } catch {
      toast.error('Error al eliminar vehiculo');
    }
  };

  const handleEditVehicle = (v: Vehicle) => {
    setEditVehicleId(v.id);
    setForm({ plate: v.plate, model: v.model, color: v.color, year: v.year?.toString() || '' });
    setIsEditing(true);
  };

  const handleSaveServiceMode = async () => {
    if (!driver?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('drivers')
        .update({ vehicle_type: serviceMode })
        .eq('id', driver.id);
      if (error) throw error;
      toast.success(`Modo actualizado a: ${serviceModeOptions.find(o => o.id === serviceMode)?.label}`);
    } catch {
      toast.error('Error al actualizar modo de servicio');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          <p className="text-sm text-gray-400">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-5">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-xl font-bold text-white">Mi Vehiculo</h1>
        <p className="text-sm text-gray-400 mt-1">Gestiona tus vehiculos y tipo de servicio</p>
      </motion.div>

      {/* Service Mode Selection */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="glass-strong rounded-2xl p-4 space-y-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Car className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-semibold text-white">Modo de servicio</span>
          </div>
          <button
            onClick={handleSaveServiceMode}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg btn-neon text-white text-xs font-medium disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            Guardar
          </button>
        </div>
        <p className="text-xs text-gray-500">Selecciona como quieres trabajar en RIDA</p>
        <div className="grid grid-cols-3 gap-2">
          {serviceModeOptions.map((mode) => (
            <button
              key={mode.id}
              onClick={() => setServiceMode(mode.id)}
              className={`p-3 rounded-xl border text-center transition-all ${
                serviceMode === mode.id
                  ? 'border-cyan-500 bg-cyan-500/10'
                  : 'border-white/10 hover:border-white/20'
              }`}
            >
              <p className={`text-sm font-medium ${serviceMode === mode.id ? 'text-cyan-400' : 'text-gray-400'}`}>
                {mode.label}
              </p>
              <p className="text-[10px] text-gray-600 mt-0.5">{mode.desc}</p>
              {serviceMode === mode.id && (
                <CheckCircle className="w-4 h-4 text-cyan-400 mx-auto mt-1" />
              )}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Vehicle Type (for deliveries) */}
      {(serviceMode === 'repartidor' || serviceMode === 'ambos') && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-strong rounded-2xl p-4 space-y-3"
        >
          <div className="flex items-center gap-2">
            <Bike className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-semibold text-white">Tipo de vehiculo para reparto</span>
          </div>
          <p className="text-xs text-gray-500">Selecciona el vehiculo que usas para entregas</p>
          <div className="grid grid-cols-3 gap-2">
            {vehicleTypeOptions.map((vt) => (
              <button
                key={vt.id}
                onClick={() => setVehicleType(vt.id)}
                className={`p-3 rounded-xl border text-center transition-all ${
                  vehicleType === vt.id
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-white/10 hover:border-white/20'
                }`}
              >
                <vt.icon className={`w-6 h-6 mx-auto ${vehicleType === vt.id ? 'text-emerald-400' : 'text-gray-500'}`} />
                <p className={`text-xs font-medium mt-1 ${vehicleType === vt.id ? 'text-emerald-400' : 'text-gray-400'}`}>
                  {vt.label}
                </p>
                <p className="text-[10px] text-gray-600">{vt.desc}</p>
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Existing Vehicles */}
      {vehicles.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="space-y-2"
        >
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Shield className="w-4 h-4 text-cyan-400" />
            Vehiculos registrados ({vehicles.length})
          </h3>
          {vehicles.map((v, i) => (
            <motion.div
              key={v.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 + 0.2 }}
              className="glass rounded-xl p-4 flex items-center gap-3"
            >
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center shrink-0">
                <Car className="w-6 h-6 text-cyan-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-white">{v.model}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    v.verified ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {v.verified ? 'Verificado' : 'Pendiente'}
                  </span>
                </div>
                <p className="text-xs text-gray-500">Placa: {v.plate} | Color: {v.color} {v.year ? `| ${v.year}` : ''}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleEditVehicle(v)}
                  className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                >
                  <Pencil className="w-4 h-4 text-gray-500" />
                </button>
                <button
                  onClick={() => handleDeleteVehicle(v.id)}
                  className="p-2 rounded-lg hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="w-4 h-4 text-gray-500 hover:text-red-400" />
                </button>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Add / Edit Vehicle Form */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="glass-strong rounded-2xl p-4 space-y-3"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">
            {isEditing ? 'Editar Vehiculo' : 'Agregar Vehiculo'}
          </h3>
          {isEditing && (
            <button onClick={resetForm} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
              <X className="w-4 h-4 text-gray-500" />
            </button>
          )}
        </div>

        {!isEditing && vehicles.length > 0 && !isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="w-full py-3 rounded-xl border border-dashed border-white/20 text-gray-400 text-sm flex items-center justify-center gap-2 hover:border-cyan-500/50 hover:text-cyan-400 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Agregar otro vehiculo
          </button>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-gray-500 font-medium mb-1 block">Placa</label>
                <input
                  type="text"
                  placeholder="ABC-123"
                  value={form.plate}
                  onChange={(e) => setForm(prev => ({ ...prev, plate: e.target.value.toUpperCase() }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 font-medium mb-1 block">Ano</label>
                <input
                  type="text"
                  placeholder="2024"
                  value={form.year}
                  onChange={(e) => setForm(prev => ({ ...prev, year: e.target.value }))}
                  maxLength={4}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-gray-500 font-medium mb-1 block">Modelo</label>
              <input
                type="text"
                placeholder="Toyota Corolla"
                value={form.model}
                onChange={(e) => setForm(prev => ({ ...prev, model: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 font-medium mb-1 block">Color</label>
              <input
                type="text"
                placeholder="Blanco"
                value={form.color}
                onChange={(e) => setForm(prev => ({ ...prev, color: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="flex gap-2 pt-1">
              {isEditing && (
                <button
                  onClick={resetForm}
                  className="flex-1 border border-white/10 text-gray-400 py-2.5 rounded-xl text-sm font-medium hover:bg-white/5"
                >
                  Cancelar
                </button>
              )}
              <button
                onClick={handleSaveVehicle}
                disabled={saving || !form.plate || !form.model || !form.color}
                className="flex-1 btn-neon text-white font-medium py-2.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {isEditing ? 'Actualizar' : 'Guardar'}
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Verification reminder */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="glass rounded-2xl p-4 border border-amber-500/20"
      >
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-semibold text-amber-400">Recuerda</span>
        </div>
        <p className="text-xs text-gray-400 leading-relaxed">
          Despues de registrar tu vehiculo, debes subir las fotos del mismo en la seccion de Verificacion para completar el proceso. Las fotos deben mostrar la placa claramente visible.
        </p>
        <button
          type="button"
          onClick={() => router.push('/driver/verification')}
          className="mt-2 text-xs text-cyan-400 font-medium hover:underline"
        >
          Ir a Verificacion
        </button>
      </motion.div>
    </div>
  );
}
