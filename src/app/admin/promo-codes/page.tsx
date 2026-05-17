'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Tag, Plus, Search, Edit3, Trash2, ToggleLeft, ToggleRight,
  Calendar, Percent, DollarSign, Hash, Loader2, X, Copy,
  Clock, CheckCircle2, XCircle, AlertCircle, Gift, ArrowLeft, ChevronRight
} from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */
interface PromoCode {
  id: string;
  code: string;
  description: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  max_uses: number | null;
  current_uses: number;
  min_order_amount: number;
  max_discount: number | null;
  valid_from: string;
  valid_until: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

type FilterStatus = 'todos' | 'activos' | 'expirados';

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */
const formatColones = (val: number) => `₡${Math.round(val).toLocaleString()}`;

const formatDate = (dateStr: string) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('es-CR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const isExpired = (validUntil: string) => {
  if (!validUntil) return false;
  return new Date(validUntil) < new Date();
};

const getPromoStatus = (promo: PromoCode) => {
  if (!promo.is_active) return 'inactivo';
  if (isExpired(promo.valid_until)) return 'expirado';
  if (promo.max_uses && promo.current_uses >= promo.max_uses) return 'agotado';
  return 'activo';
};

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  activo: { label: 'Activo', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: CheckCircle2 },
  inactivo: { label: 'Inactivo', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', icon: XCircle },
  expirado: { label: 'Expirado', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: AlertCircle },
  agotado: { label: 'Agotado', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: Clock },
};

const emptyForm = {
  code: '',
  description: '',
  discount_type: 'percentage' as 'percentage' | 'fixed',
  discount_value: 0,
  max_uses: null as number | null,
  current_uses: 0,
  min_order_amount: 0,
  max_discount: null as number | null,
  valid_from: new Date().toISOString().split('T')[0],
  valid_until: '',
  is_active: true,
};

function PromoCodesLoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Stats Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="glass rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/5" />
              <div>
                <div className="h-3 w-28 bg-white/5 rounded mb-1" />
                <div className="h-5 w-16 bg-white/5 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
      {/* Search & Filters Skeleton */}
      <div className="glass rounded-2xl p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="h-10 flex-1 bg-white/5 rounded-xl" />
          <div className="flex gap-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-10 w-20 bg-white/5 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
      {/* Table Skeleton */}
      <div className="glass rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              {[...Array(6)].map((_, i) => (
                <th key={i} className="px-4 py-3">
                  <div className="h-3 w-16 bg-white/5 rounded" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...Array(5)].map((_, i) => (
              <tr key={i} className="border-b border-white/5">
                <td className="px-4 py-3">
                  <div className="h-7 w-20 bg-white/5 rounded-lg" />
                </td>
                <td className="px-4 py-3">
                  <div className="h-5 w-16 bg-white/5 rounded" />
                </td>
                <td className="px-4 py-3">
                  <div className="h-4 w-12 bg-white/5 rounded" />
                </td>
                <td className="px-4 py-3">
                  <div className="h-4 w-20 bg-white/5 rounded" />
                </td>
                <td className="px-4 py-3">
                  <div className="h-6 w-20 bg-white/5 rounded-full" />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <div className="w-8 h-8 bg-white/5 rounded-lg" />
                    <div className="w-8 h-8 bg-white/5 rounded-lg" />
                    <div className="w-8 h-8 bg-white/5 rounded-lg" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export default function PromoCodesPage() {
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterStatus>('todos');

  /* Modal */
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  /* Delete confirm */
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  /* Toggle loading */
  const [togglingId, setTogglingId] = useState<string | null>(null);

  /* ═══════════════════════════════════════════════════════════════
     FETCH PROMO CODES
     ═══════════════════════════════════════════════════════════════ */
  const fetchPromoCodes = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('promo_codes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching promo codes:', error.message);
        toast.error('Error al cargar codigos promocionales');
        return;
      }
      setPromoCodes(data || []);
    } catch (err) {
      console.error('Error fetching promo codes:', err);
      toast.error('Error al cargar codigos promocionales');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPromoCodes();
  }, [fetchPromoCodes]);

  /* ═══════════════════════════════════════════════════════════════
     STATS
     ═══════════════════════════════════════════════════════════════ */
  const stats = {
    total: promoCodes.length,
    activos: promoCodes.filter((p) => getPromoStatus(p) === 'activo').length,
    usosHoy: promoCodes.reduce((sum, p) => sum + p.current_uses, 0),
  };

  /* ═══════════════════════════════════════════════════════════════
     FILTER & SEARCH
     ═══════════════════════════════════════════════════════════════ */
  const filtered = promoCodes.filter((p) => {
    const matchSearch = p.code.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase());
    const status = getPromoStatus(p);
    let matchFilter = true;
    if (filter === 'activos') matchFilter = status === 'activo';
    if (filter === 'expirados') matchFilter = status === 'expirado';
    return matchSearch && matchFilter;
  });

  /* ═══════════════════════════════════════════════════════════════
     OPEN CREATE MODAL
     ═══════════════════════════════════════════════════════════════ */
  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  /* ═══════════════════════════════════════════════════════════════
     OPEN EDIT MODAL
     ═══════════════════════════════════════════════════════════════ */
  const openEdit = (promo: PromoCode) => {
    setEditingId(promo.id);
    setForm({
      code: promo.code,
      description: promo.description || '',
      discount_type: promo.discount_type,
      discount_value: promo.discount_value,
      max_uses: promo.max_uses,
      current_uses: promo.current_uses,
      min_order_amount: promo.min_order_amount || 0,
      max_discount: promo.max_discount,
      valid_from: promo.valid_from ? promo.valid_from.split('T')[0] : '',
      valid_until: promo.valid_until ? promo.valid_until.split('T')[0] : '',
      is_active: promo.is_active,
    });
    setModalOpen(true);
  };

  /* ═══════════════════════════════════════════════════════════════
     SAVE (CREATE / UPDATE)
     ═══════════════════════════════════════════════════════════════ */
  const handleSave = async () => {
    if (!form.code.trim()) {
      toast.error('El codigo es obligatorio');
      return;
    }
    if (form.discount_value <= 0) {
      toast.error('El valor de descuento debe ser mayor a 0');
      return;
    }
    if (form.discount_type === 'percentage' && form.discount_value > 100) {
      toast.error('El porcentaje no puede ser mayor a 100%');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        description: form.description.trim(),
        discount_type: form.discount_type,
        discount_value: form.discount_value,
        max_uses: form.max_uses || null,
        min_order_amount: form.min_order_amount || 0,
        max_discount: form.max_discount || null,
        valid_from: form.valid_from || null,
        valid_until: form.valid_until || null,
        is_active: form.is_active,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { error } = await supabase
          .from('promo_codes')
          .update(payload)
          .eq('id', editingId);
        if (error) throw error;
        toast.success('Codigo promocional actualizado');
      } else {
        payload.current_uses = 0;
        const { error } = await supabase
          .from('promo_codes')
          .insert(payload);
        if (error) throw error;
        toast.success('Codigo promocional creado');
      }

      setModalOpen(false);
      fetchPromoCodes();
    } catch (err: any) {
      console.error('Error saving promo code:', err);
      const msg = err?.message || 'Error al guardar codigo promocional';
      if (msg.includes('duplicate') || msg.includes('unique')) {
        toast.error('Ya existe un codigo con ese nombre');
      } else {
        toast.error(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  /* ═══════════════════════════════════════════════════════════════
     TOGGLE ACTIVE / INACTIVE
     ═══════════════════════════════════════════════════════════════ */
  const handleToggle = async (promo: PromoCode) => {
    setTogglingId(promo.id);
    const newActive = !promo.is_active;
    try {
      const { error } = await supabase
        .from('promo_codes')
        .update({
          is_active: newActive,
          updated_at: new Date().toISOString(),
        })
        .eq('id', promo.id);

      if (error) throw error;

      toast.success(newActive ? 'Codigo activado' : 'Codigo desactivado');
      fetchPromoCodes();
    } catch (err) {
      console.error('Error toggling promo:', err);
      toast.error('Error al cambiar estado');
    } finally {
      setTogglingId(null);
    }
  };

  /* ═══════════════════════════════════════════════════════════════
     DELETE
     ═══════════════════════════════════════════════════════════════ */
  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('promo_codes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Codigo promocional eliminado');
      setDeleteConfirm(null);
      fetchPromoCodes();
    } catch (err) {
      console.error('Error deleting promo:', err);
      toast.error('Error al eliminar codigo');
    } finally {
      setDeleting(false);
    }
  };

  /* ═══════════════════════════════════════════════════════════════
     COPY CODE
     ═══════════════════════════════════════════════════════════════ */
  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(`Codigo "${code}" copiado al portapapeles`);
  };

  /* ═══════════════════════════════════════════════════════════════
     FORM FIELD UPDATE
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
          <h1 className="text-3xl font-bold text-white">Codigos Promocionales</h1>
          <p className="text-gray-400 mt-1">
            Crea y administra codigos de descuento para los pasajeros
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
          CREAR CODIGO
        </motion.button>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
        <Link href="/admin" className="hover:text-white transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          Panel
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-white font-medium">Codigos Promocionales</span>
      </div>

      {/* ─── Stats ───────────────────────────────────────── */}
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
              <p className="text-[11px] text-gray-500 uppercase tracking-wider">Total Codigos</p>
              <p className="text-lg font-bold text-cyan-400">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="glass rounded-2xl p-4 border border-emerald-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-wider">Activos</p>
              <p className="text-lg font-bold text-emerald-400">{stats.activos}</p>
            </div>
          </div>
        </div>
        <div className="glass rounded-2xl p-4 border border-amber-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
              <Gift className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-wider">Usos Totales</p>
              <p className="text-lg font-bold text-amber-400">{stats.usosHoy.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ─── Search & Filters ───────────────────────────── */}
      <motion.div
        className="glass rounded-2xl p-4"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Buscar por codigo o descripcion..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-cyan-500 text-white placeholder:text-gray-600 outline-none text-sm transition-all"
            />
          </div>
          <div className="flex gap-2">
            {(['todos', 'activos', 'expirados'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`px-4 py-2.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all capitalize ${
                  filter === f
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-transparent'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ─── Table ───────────────────────────────────────── */}
      <motion.div
        className="glass rounded-2xl overflow-hidden"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {loading ? (
          <PromoCodesLoadingSkeleton />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <Tag className="w-12 h-12 mb-3 opacity-40" />
            <p>No se encontraron codigos promocionales</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Codigo</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Descuento</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Usos</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Valido hasta</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Estado</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((promo, i) => {
                  const status = getPromoStatus(promo);
                  const cfg = statusConfig[status];
                  const StatusIcon = cfg.icon;

                  return (
                    <motion.tr
                      key={promo.id}
                      className="border-b border-white/5 hover:bg-white/[0.03] transition-colors"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                    >
                      {/* Code */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleCopy(promo.code)}
                            className="flex items-center gap-2 group"
                            title="Copiar codigo"
                          >
                            <span className="text-sm font-mono font-bold text-white bg-white/10 px-2.5 py-1 rounded-lg group-hover:bg-cyan-500/20 transition-colors">
                              {promo.code}
                            </span>
                            <Copy className="w-3.5 h-3.5 text-gray-500 group-hover:text-cyan-400 transition-colors" />
                          </button>
                        </div>
                        {promo.description && (
                          <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[200px]">{promo.description}</p>
                        )}
                      </td>

                      {/* Discount */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {promo.discount_type === 'percentage' ? (
                            <>
                              <Percent className="w-3.5 h-3.5 text-cyan-400" />
                              <span className="text-sm font-semibold text-cyan-400">{promo.discount_value}%</span>
                            </>
                          ) : (
                            <>
                              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-sm font-semibold text-emerald-400">{formatColones(promo.discount_value)}</span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Uses */}
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-300">
                          {promo.current_uses}
                          {promo.max_uses && (
                            <span className="text-gray-500"> / {promo.max_uses}</span>
                          )}
                        </div>
                        {promo.max_uses && (
                          <div className="w-20 h-1.5 bg-white/10 rounded-full mt-1 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                promo.current_uses >= promo.max_uses
                                  ? 'bg-red-500'
                                  : 'bg-cyan-500'
                              }`}
                              style={{ width: `${Math.min((promo.current_uses / promo.max_uses) * 100, 100)}%` }}
                            />
                          </div>
                        )}
                      </td>

                      {/* Valid Until */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-sm text-gray-400">
                          <Calendar className="w-3.5 h-3.5" />
                          {formatDate(promo.valid_until)}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium border ${cfg.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {cfg.label}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleToggle(promo)}
                            disabled={togglingId === promo.id}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all disabled:opacity-50"
                            title={promo.is_active ? 'Desactivar' : 'Activar'}
                          >
                            {togglingId === promo.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : promo.is_active ? (
                              <ToggleRight className="w-5 h-5 text-emerald-400" />
                            ) : (
                              <ToggleLeft className="w-5 h-5 text-gray-500" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(promo)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all"
                            title="Editar"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirm(promo.id)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

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
                  {editingId ? 'Editar Codigo' : 'Crear Codigo'}
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
                {/* Code */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Codigo *</label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type="text"
                      value={form.code}
                      onChange={(e) => updateForm('code', e.target.value)}
                      placeholder="Ej: RIDA20"
                      disabled={!!editingId}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-cyan-500 text-white placeholder:text-gray-600 outline-none text-sm uppercase disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Descripcion</label>
                  <input
                    type="text"
                    value={form.description}
                    onChange={(e) => updateForm('description', e.target.value)}
                    placeholder="Ej: 20% de descuento para nuevos usuarios"
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-cyan-500 text-white placeholder:text-gray-600 outline-none text-sm"
                  />
                </div>

                {/* Discount Type + Value */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Tipo de Descuento</label>
                    <select
                      value={form.discount_type}
                      onChange={(e) => updateForm('discount_type', e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-cyan-500 text-white outline-none text-sm appearance-none cursor-pointer"
                    >
                      <option value="percentage" className="bg-[#0a0e1a]">Porcentaje (%)</option>
                      <option value="fixed" className="bg-[#0a0e1a]">Monto Fijo (₡)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">
                      {form.discount_type === 'percentage' ? 'Porcentaje (%)' : 'Monto (₡)'}
                    </label>
                    <div className="relative">
                      {form.discount_type === 'percentage' ? (
                        <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      ) : (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">₡</span>
                      )}
                      <input
                        type="number"
                        value={form.discount_value}
                        onChange={(e) => updateForm('discount_value', Number(e.target.value))}
                        min={0}
                        max={form.discount_type === 'percentage' ? 100 : 999999}
                        className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-cyan-500 text-white outline-none text-sm pr-10"
                      />
                    </div>
                  </div>
                </div>

                {/* Max Uses + Min Order */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Usos Maximos</label>
                    <input
                      type="number"
                      value={form.max_uses ?? ''}
                      onChange={(e) => updateForm('max_uses', e.target.value ? Number(e.target.value) : null)}
                      placeholder="Sin limite"
                      min={1}
                      className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-cyan-500 text-white placeholder:text-gray-600 outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Pedido Minimo (₡)</label>
                    <input
                      type="number"
                      value={form.min_order_amount || ''}
                      onChange={(e) => updateForm('min_order_amount', Number(e.target.value))}
                      placeholder="0"
                      min={0}
                      className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-cyan-500 text-white placeholder:text-gray-600 outline-none text-sm"
                    />
                  </div>
                </div>

                {/* Max Discount */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Descuento Maximo (₡)</label>
                  <input
                    type="number"
                    value={form.max_discount ?? ''}
                    onChange={(e) => updateForm('max_discount', e.target.value ? Number(e.target.value) : null)}
                    placeholder="Sin limite"
                    min={0}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-cyan-500 text-white placeholder:text-gray-600 outline-none text-sm"
                  />
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Válido Desde</label>
                    <input
                      type="date"
                      value={form.valid_from}
                      onChange={(e) => updateForm('valid_from', e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-cyan-500 text-white outline-none text-sm [color-scheme:dark]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Válido Hasta</label>
                    <input
                      type="date"
                      value={form.valid_until}
                      onChange={(e) => updateForm('valid_until', e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-cyan-500 text-white outline-none text-sm [color-scheme:dark]"
                    />
                  </div>
                </div>

                {/* Active Toggle */}
                <div className="flex items-center justify-between bg-white/5 rounded-xl p-4">
                  <div>
                    <p className="text-sm font-medium text-white">Codigo Activo</p>
                    <p className="text-xs text-gray-500">Los codigos inactivos no pueden ser usados</p>
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
                  {saving ? 'Guardando...' : editingId ? 'Actualizar' : 'Crear Codigo'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════
          DELETE CONFIRM MODAL
          ═══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setDeleteConfirm(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="glass-strong rounded-2xl w-full max-w-sm p-6 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-14 h-14 rounded-2xl bg-red-500/15 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-7 h-7 text-red-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Eliminar Codigo</h3>
              <p className="text-sm text-gray-400 mb-6">
                Esta accion no se puede deshacer. El codigo sera eliminado permanentemente.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 text-gray-400 text-sm font-medium hover:bg-white/10 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(deleteConfirm)}
                  disabled={deleting}
                  className="flex-1 py-2.5 rounded-xl bg-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/30 transition-all border border-red-500/30 disabled:opacity-50"
                >
                  {deleting ? (
                    <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                  ) : (
                    'Eliminar'
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
