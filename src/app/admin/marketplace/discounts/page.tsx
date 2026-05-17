'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Percent, Plus, Search, Filter, ToggleLeft, ToggleRight,
  Trash2, Eye, Copy, Check, X, Calendar, DollarSign,
  ShoppingBag, Car, Package, Loader2, RefreshCw, Clock,
  Users, TrendingDown, Tag, AlertCircle, ChevronDown, ChevronUp,
  BarChart3,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

// ─── Helpers ──────────────────────────────────────────────────────
function formatCRC(amount: number): string {
  return `₡${Math.round(amount).toLocaleString('es-CR')}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return 'Sin límite';
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Types ────────────────────────────────────────────────────────
interface DiscountCode {
  id: string;
  code: string;
  description: string | null;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order_amount: number;
  max_discount_amount: number | null;
  max_uses: number | null;
  current_uses: number;
  remaining_uses: number | null;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
  applies_to: 'all' | 'marketplace' | 'rides' | 'delivery';
  max_uses_per_user: number;
  vendor_id: string | null;
  vendor_name: string | null;
  total_discounted: number;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

interface VendorOption {
  id: string;
  store_name: string;
}

type ViewTab = 'all' | 'active' | 'inactive' | 'expired';

// ─── Constants ────────────────────────────────────────────────────
const appliesToLabels: Record<string, string> = {
  all: 'Todo',
  marketplace: 'Marketplace',
  rides: 'Viajes',
  delivery: 'Entregas',
};

const appliesToColors: Record<string, string> = {
  all: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  marketplace: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  rides: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  delivery: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
};

const appliesToIcons: Record<string, any> = {
  all: Tag,
  marketplace: ShoppingBag,
  rides: Car,
  delivery: Package,
};

// ─── Animation Variants ──────────────────────────────────────────
const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

// ─── Create/Edit Form Modal ─────────────────────────────────────
function DiscountFormModal({
  isOpen,
  onClose,
  onSave,
  vendors,
  editCode,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<boolean>;
  vendors: VendorOption[];
  editCode: DiscountCode | null;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code: '',
    description: '',
    discount_type: 'percentage' as 'percentage' | 'fixed',
    discount_value: '',
    min_order_amount: '0',
    max_discount_amount: '',
    max_uses: '',
    max_uses_per_user: '1',
    valid_from: '',
    valid_until: '',
    applies_to: 'all' as 'all' | 'marketplace' | 'rides' | 'delivery',
    vendor_id: '',
  });

  useEffect(() => {
    if (editCode) {
      setForm({
        code: editCode.code,
        description: editCode.description || '',
        discount_type: editCode.discount_type,
        discount_value: String(editCode.discount_value),
        min_order_amount: String(editCode.min_order_amount || 0),
        max_discount_amount: editCode.max_discount_amount ? String(editCode.max_discount_amount) : '',
        max_uses: editCode.max_uses ? String(editCode.max_uses) : '',
        max_uses_per_user: String(editCode.max_uses_per_user || 1),
        valid_from: editCode.valid_from ? editCode.valid_from.slice(0, 16) : '',
        valid_until: editCode.valid_until ? editCode.valid_until.slice(0, 16) : '',
        applies_to: editCode.applies_to,
        vendor_id: editCode.vendor_id || '',
      });
    } else {
      setForm({
        code: '',
        description: '',
        discount_type: 'percentage',
        discount_value: '',
        min_order_amount: '0',
        max_discount_amount: '',
        max_uses: '',
        max_uses_per_user: '1',
        valid_from: new Date().toISOString().slice(0, 16),
        valid_until: '',
        applies_to: 'all',
        vendor_id: '',
      });
    }
  }, [editCode, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const codeVal = form.code.trim().toUpperCase();
    if (!codeVal) { toast.error('El codigo es requerido'); return; }

    const discountValue = parseFloat(form.discount_value);
    if (isNaN(discountValue) || discountValue <= 0) { toast.error('Valor de descuento invalido'); return; }

    if (form.discount_type === 'percentage' && (discountValue < 1 || discountValue > 100)) {
      toast.error('El porcentaje debe estar entre 1 y 100');
      return;
    }

    const minOrder = parseFloat(form.min_order_amount) || 0;
    const maxDiscount = form.max_discount_amount ? parseFloat(form.max_discount_amount) : null;
    const maxUses = form.max_uses ? parseInt(form.max_uses) : null;
    const maxUsesPerUser = parseInt(form.max_uses_per_user) || 1;
    const validFrom = form.valid_from ? new Date(form.valid_from).toISOString() : new Date().toISOString();
    const validUntil = form.valid_until ? new Date(form.valid_until).toISOString() : null;
    const vendorId = form.vendor_id || null;

    setSaving(true);
    const success = await onSave({
      code: codeVal,
      description: form.description.trim() || null,
      discount_type: form.discount_type,
      discount_value: discountValue,
      min_order_amount: minOrder,
      max_discount_amount: maxDiscount,
      max_uses: maxUses,
      max_uses_per_user: maxUsesPerUser,
      valid_from: validFrom,
      valid_until: validUntil,
      applies_to: form.applies_to,
      vendor_id: vendorId,
    });
    setSaving(false);

    if (success) onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-[#0d1117] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Percent className="w-5 h-5 text-pink-400" />
              {editCode ? 'Editar Cupon' : 'Nuevo Cupon'}
            </h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Code */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Codigo del cupon *</label>
              <input
                type="text"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="Ej: RIDA20"
                disabled={!!editCode}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm font-mono uppercase focus:outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              />
              {editCode && (
                <p className="text-[10px] text-gray-500 mt-1">El codigo no se puede modificar despues de crearlo</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Descripcion</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Ej: 20% de descuento en marketplace"
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/25 transition-all"
              />
            </div>

            {/* Discount Type + Value row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Tipo de descuento</label>
                <div className="flex rounded-xl bg-white/5 border border-white/10 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, discount_type: 'percentage' })}
                    className={`flex-1 px-3 py-2.5 text-xs font-medium transition-all ${
                      form.discount_type === 'percentage'
                        ? 'bg-pink-500/20 text-pink-400'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Porcentaje %
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, discount_type: 'fixed' })}
                    className={`flex-1 px-3 py-2.5 text-xs font-medium transition-all ${
                      form.discount_type === 'fixed'
                        ? 'bg-pink-500/20 text-pink-400'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Monto fijo ₡
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  {form.discount_type === 'percentage' ? 'Porcentaje (1-100)' : 'Monto (₡)'}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                    {form.discount_type === 'percentage' ? '%' : '₡'}
                  </span>
                  <input
                    type="number"
                    value={form.discount_value}
                    onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
                    placeholder={form.discount_type === 'percentage' ? '20' : '2000'}
                    min={form.discount_type === 'percentage' ? '1' : '1'}
                    max={form.discount_type === 'percentage' ? '100' : undefined}
                    className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/25 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Min order + Max discount */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Pedido minimo (₡)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₡</span>
                  <input
                    type="number"
                    value={form.min_order_amount}
                    onChange={(e) => setForm({ ...form, min_order_amount: e.target.value })}
                    placeholder="0"
                    min="0"
                    className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/25 transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  Tope descuento (₡)
                  <span className="text-gray-600 ml-1">solo %</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₡</span>
                  <input
                    type="number"
                    value={form.max_discount_amount}
                    onChange={(e) => setForm({ ...form, max_discount_amount: e.target.value })}
                    placeholder="5000"
                    min="0"
                    disabled={form.discount_type === 'fixed'}
                    className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/25 transition-all disabled:opacity-40"
                  />
                </div>
              </div>
            </div>

            {/* Max uses + per user */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  Maximo usos total
                  <span className="text-gray-600 ml-1">vacio = ilimitado</span>
                </label>
                <input
                  type="number"
                  value={form.max_uses}
                  onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
                  placeholder="Ilimitado"
                  min="1"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/25 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Usos por usuario</label>
                <input
                  type="number"
                  value={form.max_uses_per_user}
                  onChange={(e) => setForm({ ...form, max_uses_per_user: e.target.value })}
                  placeholder="1"
                  min="1"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/25 transition-all"
                />
              </div>
            </div>

            {/* Applies to */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Aplica a</label>
              <div className="grid grid-cols-4 gap-2">
                {(['all', 'marketplace', 'rides', 'delivery'] as const).map((scope) => {
                  const Icon = appliesToIcons[scope];
                  return (
                    <button
                      key={scope}
                      type="button"
                      onClick={() => setForm({ ...form, applies_to: scope })}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition-all ${
                        form.applies_to === scope
                          ? 'bg-pink-500/15 text-pink-400 border-pink-500/30'
                          : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {appliesToLabels[scope]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Vendor selector */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Vendedor especifico
                <span className="text-gray-600 ml-1">opcional</span>
              </label>
              <select
                value={form.vendor_id}
                onChange={(e) => setForm({ ...form, vendor_id: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/25 transition-all appearance-none"
              >
                <option value="" className="bg-[#0d1117]">Todos los vendedores</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id} className="bg-[#0d1117]">
                    {v.store_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date range */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Vigente desde</label>
                <input
                  type="datetime-local"
                  value={form.valid_from}
                  onChange={(e) => setForm({ ...form, valid_from: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/25 transition-all [color-scheme:dark]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  Vigente hasta
                  <span className="text-gray-600 ml-1">vacio = siempre</span>
                </label>
                <input
                  type="datetime-local"
                  value={form.valid_until}
                  onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/25 transition-all [color-scheme:dark]"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-lg shadow-pink-500/20 hover:shadow-pink-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Guardando...
                  </>
                ) : editCode ? (
                  'Actualizar'
                ) : (
                  'Crear Cupon'
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Detail Modal ────────────────────────────────────────────────
function DetailModal({
  discount,
  onClose,
  onToggle,
  onDelete,
}: {
  discount: DiscountCode;
  onClose: () => void;
  onToggle: (id: string, active: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);

  const isExpired = discount.valid_until && new Date(discount.valid_until) < new Date();
  const isExhausted = discount.max_uses !== null && discount.current_uses >= discount.max_uses;
  const usagePercent = discount.max_uses
    ? Math.min((discount.current_uses / discount.max_uses) * 100, 100)
    : null;

  const handleCopy = () => {
    navigator.clipboard.writeText(discount.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggle = async () => {
    setToggling(true);
    await onToggle(discount.id, !discount.is_active);
    setToggling(false);
    onClose();
  };

  const handleDelete = async () => {
    setDeleting(true);
    await onDelete(discount.id);
    setDeleting(false);
    onClose();
  };

  const AplicaIcon = appliesToIcons[discount.applies_to] || Tag;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-[#0d1117] border border-white/10 rounded-2xl w-full max-w-md"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-white/10">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-3 py-1.5 rounded-lg bg-pink-500/15 text-pink-400 font-mono font-bold text-lg tracking-wider">
                    {discount.code}
                  </span>
                  <button
                    onClick={handleCopy}
                    className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-pink-400 transition-colors"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-sm text-gray-400">{discount.description || 'Sin descripcion'}</p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-4">
            {/* Status badges row */}
            <div className="flex flex-wrap gap-2">
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium border ${
                discount.is_active
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : 'bg-red-500/15 text-red-400 border-red-500/30'
              }`}>
                {discount.is_active ? 'Activo' : 'Inactivo'}
              </span>
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border ${appliesToColors[discount.applies_to]}`}>
                <AplicaIcon className="w-3 h-3" />
                {appliesToLabels[discount.applies_to]}
              </span>
              {isExpired && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-gray-500/15 text-gray-400 border-gray-500/30">
                  <AlertCircle className="w-3 h-3" />
                  Expirado
                </span>
              )}
              {isExhausted && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-red-500/15 text-red-400 border-red-500/30">
                  Agotado
                </span>
              )}
            </div>

            {/* Discount value */}
            <div className="glass rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Valor del descuento</p>
              <p className="text-2xl font-bold text-white">
                {discount.discount_type === 'percentage'
                  ? `${discount.discount_value}%`
                  : formatCRC(discount.discount_value)}
              </p>
              {discount.discount_type === 'percentage' && discount.max_discount_amount && (
                <p className="text-xs text-gray-500 mt-1">
                  Tope maximo: {formatCRC(discount.max_discount_amount)}
                </p>
              )}
              {discount.min_order_amount > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  Pedido minimo: {formatCRC(discount.min_order_amount)}
                </p>
              )}
            </div>

            {/* Usage stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="glass rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />
                  <p className="text-xs text-gray-500">Total descontado</p>
                </div>
                <p className="text-lg font-bold text-white">{formatCRC(discount.total_discounted)}</p>
              </div>
              <div className="glass rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-3.5 h-3.5 text-blue-400" />
                  <p className="text-xs text-gray-500">Veces usado</p>
                </div>
                <p className="text-lg font-bold text-white">{discount.usage_count}</p>
              </div>
            </div>

            {/* Usage progress bar */}
            {usagePercent !== null && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-500">Uso del cupon</p>
                  <p className="text-xs text-gray-400">{discount.current_uses} / {discount.max_uses}</p>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      usagePercent >= 90 ? 'bg-red-500' : usagePercent >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${usagePercent}%` }}
                  />
                </div>
              </div>
            )}

            {/* Limits */}
            <div className="grid grid-cols-2 gap-3">
              <div className="glass rounded-xl p-3">
                <p className="text-[10px] text-gray-500 mb-0.5">Maximo por usuario</p>
                <p className="text-sm font-semibold text-white">{discount.max_uses_per_user}</p>
              </div>
              <div className="glass rounded-xl p-3">
                <p className="text-[10px] text-gray-500 mb-0.5">Vendedor</p>
                <p className="text-sm font-semibold text-white truncate">{discount.vendor_name || 'Todos'}</p>
              </div>
            </div>

            {/* Dates */}
            <div className="glass rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <Calendar className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-gray-500">Desde:</span>
                <span className="text-gray-300">{formatDateTime(discount.valid_from)}</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Calendar className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-gray-500">Hasta:</span>
                <span className="text-gray-300">{formatDate(discount.valid_until || '')}</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Clock className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-gray-500">Creado:</span>
                <span className="text-gray-300">{formatDateTime(discount.created_at)}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="px-6 pb-6 flex gap-3">
            <button
              onClick={handleToggle}
              disabled={toggling}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              style={{
                background: discount.is_active
                  ? 'rgba(239, 68, 68, 0.15)'
                  : 'rgba(34, 197, 94, 0.15)',
                color: discount.is_active ? '#f87171' : '#4ade80',
                border: `1px solid ${discount.is_active ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
              }}
            >
              {toggling ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : discount.is_active ? (
                <>
                  <ToggleRight className="w-4 h-4" />
                  Desactivar
                </>
              ) : (
                <>
                  <ToggleLeft className="w-4 h-4" />
                  Activar
                </>
              )}
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-2.5 rounded-xl text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Main Component ─────────────────────────────────────────────
export default function AdminMarketplaceDiscounts() {
  const [discounts, setDiscounts] = useState<DiscountCode[]>([]);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<ViewTab>('all');
  const [sortField, setSortField] = useState<'created_at' | 'usage_count' | 'total_discounted'>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showForm, setShowForm] = useState(false);
  const [editCode, setEditCode] = useState<DiscountCode | null>(null);
  const [detailCode, setDetailCode] = useState<DiscountCode | null>(null);
  const [showSortMenu, setShowSortMenu] = useState(false);

  // ─── Fetch vendors ──────────────────────────────────────────
  const fetchVendors = useCallback(async () => {
    const { data } = await supabase
      .from('vendors')
      .select('id, store_name')
      .eq('is_approved', true)
      .order('store_name');
    setVendors((data || []).map((v) => ({ id: v.id, store_name: v.store_name })));
  }, []);

  // ─── Fetch discounts ────────────────────────────────────────
  const fetchDiscounts = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const { data, error } = await supabase.rpc('get_discount_codes');
      if (error) throw error;
      setDiscounts((data || []) as DiscountCode[]);
    } catch (err: any) {
      console.error('Error fetching discounts:', err);
      toast.error('Error al cargar codigos de descuento');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchVendors();
    fetchDiscounts();
  }, [fetchVendors, fetchDiscounts]);

  // ─── Create/Update discount ─────────────────────────────────
  const handleSave = async (data: any): Promise<boolean> => {
    try {
      if (editCode) {
        // Update via direct Supabase update (code can't change)
        const { error } = await supabase
          .from('discount_codes')
          .update({
            description: data.description,
            discount_type: data.discount_type,
            discount_value: data.discount_value,
            min_order_amount: data.min_order_amount,
            max_discount_amount: data.max_discount_amount,
            max_uses: data.max_uses,
            max_uses_per_user: data.max_uses_per_user,
            valid_from: data.valid_from,
            valid_until: data.valid_until,
            applies_to: data.applies_to,
            vendor_id: data.vendor_id,
          })
          .eq('id', editCode.id);

        if (error) throw error;
        toast.success('Cupon actualizado correctamente');
      } else {
        const { data: result, error } = await supabase.rpc('create_discount_code', {
          p_code: data.code,
          p_description: data.description,
          p_discount_type: data.discount_type,
          p_discount_value: data.discount_value,
          p_min_order_amount: data.min_order_amount,
          p_max_discount_amount: data.max_discount_amount,
          p_max_uses: data.max_uses,
          p_max_uses_per_user: data.max_uses_per_user,
          p_valid_from: data.valid_from,
          p_valid_until: data.valid_until,
          p_applies_to: data.applies_to,
          p_vendor_id: data.vendor_id,
        });

        if (error) throw error;
        const res = result as any;
        if (res && !res.success) {
          toast.error(res.message || 'Error al crear cupon');
          return false;
        }
        toast.success(res?.message || 'Cupon creado exitosamente');
      }
      fetchDiscounts(true);
      return true;
    } catch (err: any) {
      console.error('Save error:', err);
      toast.error(err.message || 'Error al guardar cupon');
      return false;
    }
  };

  // ─── Toggle discount ────────────────────────────────────────
  const handleToggle = async (id: string, active: boolean) => {
    try {
      const { data, error } = await supabase.rpc('toggle_discount_code', {
        p_code_id: id,
        p_is_active: active,
      });
      if (error) throw error;
      const res = data as any;
      if (!res?.success) {
        toast.error(res?.message || 'Error al cambiar estado');
        return;
      }
      toast.success(res.message);
      fetchDiscounts(true);
    } catch (err: any) {
      toast.error('Error al cambiar estado del cupon');
    }
  };

  // ─── Delete discount ────────────────────────────────────────
  const handleDelete = async (id: string) => {
    try {
      const { data, error } = await supabase.rpc('delete_discount_code', {
        p_code_id: id,
      });
      if (error) throw error;
      const res = data as any;
      if (!res?.success) {
        toast.error(res?.message || 'Error al eliminar');
        return;
      }
      toast.success(res.message);
      fetchDiscounts(true);
    } catch (err: any) {
      toast.error('Error al eliminar cupon');
    }
  };

  // ─── Filtered & sorted discounts ────────────────────────────
  const now = new Date();

  const filtered = discounts
    .filter((d) => {
      if (search) {
        const q = search.toLowerCase();
        if (!d.code.toLowerCase().includes(q) && !(d.description || '').toLowerCase().includes(q)) return false;
      }
      if (activeTab === 'active') return d.is_active;
      if (activeTab === 'inactive') return !d.is_active;
      if (activeTab === 'expired') return d.valid_until !== null && new Date(d.valid_until) < now;
      return true;
    })
    .sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortField === 'created_at') return dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      if (sortField === 'usage_count') return dir * (a.usage_count - b.usage_count);
      if (sortField === 'total_discounted') return dir * (a.total_discounted - b.total_discounted);
      return 0;
    });

  // ─── Stats ──────────────────────────────────────────────────
  const totalCodes = discounts.length;
  const activeCodes = discounts.filter((d) => d.is_active).length;
  const expiredCodes = discounts.filter((d) => d.valid_until !== null && new Date(d.valid_until) < now).length;
  const totalDiscounted = discounts.reduce((sum, d) => sum + (d.total_discounted || 0), 0);

  const statsConfig = [
    { label: 'Total Cupones', value: totalCodes, icon: Percent, gradient: 'from-pink-500 to-rose-500' },
    { label: 'Activos', value: activeCodes, icon: ToggleRight, gradient: 'from-emerald-500 to-green-500' },
    { label: 'Expirados', value: expiredCodes, icon: Clock, gradient: 'from-amber-500 to-orange-500' },
    { label: 'Total Descontado', value: formatCRC(totalDiscounted), icon: TrendingDown, gradient: 'from-violet-500 to-purple-500' },
  ];

  const tabs: { key: ViewTab; label: string }[] = [
    { key: 'all', label: 'Todos' },
    { key: 'active', label: 'Activos' },
    { key: 'inactive', label: 'Inactivos' },
    { key: 'expired', label: 'Expirados' },
  ];

  // ─── Loading ────────────────────────────────────────────────
  if (loading) {
    return (
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
        <motion.div variants={item}>
          <div className="h-8 w-64 bg-white/5 rounded-lg animate-pulse mb-2" />
          <div className="h-4 w-48 bg-white/5 rounded animate-pulse" />
        </motion.div>
        <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass rounded-2xl p-5 animate-pulse">
              <div className="w-11 h-11 rounded-xl bg-white/5 mb-3" />
              <div className="h-7 w-24 bg-white/5 rounded mb-2" />
              <div className="h-4 w-32 bg-white/5 rounded" />
            </div>
          ))}
        </motion.div>
        <motion.div variants={item} className="glass rounded-2xl p-5 animate-pulse h-96" />
      </motion.div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────
  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* Header */}
      <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center shadow-lg shadow-pink-500/20">
              <Percent className="w-5 h-5 text-white" />
            </div>
            Descuentos
          </h1>
          <p className="text-gray-400 text-sm mt-1">Gestion de cupones y codigos de descuento</p>
        </div>
        <div className="flex items-center gap-3 self-start">
          <button
            onClick={() => fetchDiscounts(true)}
            className="p-2.5 rounded-xl bg-white/5 text-gray-400 hover:text-white transition-colors border border-white/10"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => { setEditCode(null); setShowForm(true); }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-lg shadow-pink-500/20 hover:shadow-pink-500/30 transition-all"
          >
            <Plus className="w-4 h-4" />
            Nuevo Cupon
          </button>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statsConfig.map((stat, i) => (
          <motion.div
            key={stat.label}
            className="glass rounded-2xl p-5 transition-all duration-300 group"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + i * 0.05 }}
            whileHover={{ y: -2 }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center shadow-lg`}>
                <stat.icon className="w-5 h-5 text-white" />
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-white">{stat.value}</p>
            <p className="text-xs sm:text-sm text-gray-400 mt-0.5">{stat.label}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Main Panel */}
      <motion.div variants={item} className="glass rounded-2xl overflow-hidden">
        {/* Toolbar */}
        <div className="px-5 py-4 border-b border-white/10 space-y-3">
          {/* Search + Sort */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por codigo o descripcion..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/25 transition-all"
              />
            </div>
            <div className="relative">
              <button
                onClick={() => setShowSortMenu(!showSortMenu)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-300 hover:bg-white/10 transition-colors"
              >
                <BarChart3 className="w-4 h-4" />
                Ordenar
                {sortDir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
              </button>
              <AnimatePresence>
                {showSortMenu && (
                  <motion.div
                    className="absolute right-0 top-full mt-2 w-48 bg-[#161b22] border border-white/10 rounded-xl overflow-hidden z-20 shadow-xl"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                  >
                    {([
                      { field: 'created_at' as const, label: 'Fecha creacion' },
                      { field: 'usage_count' as const, label: 'Veces usado' },
                      { field: 'total_discounted' as const, label: 'Total descontado' },
                    ]).map((opt) => (
                      <button
                        key={opt.field}
                        onClick={() => {
                          if (sortField === opt.field) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                          else { setSortField(opt.field); setSortDir('desc'); }
                          setShowSortMenu(false);
                        }}
                        className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${
                          sortField === opt.field ? 'bg-pink-500/10 text-pink-400' : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {tabs.map((tab) => {
              const count = tab.key === 'all'
                ? totalCodes
                : tab.key === 'active'
                  ? activeCodes
                  : tab.key === 'inactive'
                    ? totalCodes - activeCodes
                    : expiredCodes;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
                    activeTab === tab.key
                      ? 'bg-pink-500/15 text-pink-400 border border-pink-500/30'
                      : 'bg-white/5 text-gray-400 border border-white/5 hover:bg-white/10'
                  }`}
                >
                  {tab.label}
                  <span className={`ml-1.5 ${activeTab === tab.key ? 'text-pink-300' : 'text-gray-500'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Discount Codes List */}
        <div className="divide-y divide-white/5">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Percent className="w-12 h-12 text-gray-600 mb-3" />
              <p className="text-gray-400 text-sm font-medium">No hay codigos de descuento</p>
              <p className="text-gray-500 text-xs mt-1">
                {search ? 'Intenta con otra busqueda' : 'Crea tu primer cupon de descuento'}
              </p>
            </div>
          ) : (
            filtered.map((discount, i) => {
              const AplicaIcon = appliesToIcons[discount.applies_to] || Tag;
              const isExpired = discount.valid_until !== null && new Date(discount.valid_until) < new Date();
              const isExhausted = discount.max_uses !== null && discount.current_uses >= discount.max_uses;
              const usagePercent = discount.max_uses
                ? Math.min((discount.current_uses / discount.max_uses) * 100, 100)
                : null;

              return (
                <motion.div
                  key={discount.id}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.03] transition-colors cursor-pointer group"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.02 * i }}
                  onClick={() => setDetailCode(discount)}
                >
                  {/* Code badge */}
                  <div className="shrink-0">
                    <div className={`px-3 py-2 rounded-lg font-mono font-bold text-sm tracking-wider border ${
                      discount.is_active
                        ? 'bg-pink-500/10 text-pink-400 border-pink-500/20'
                        : 'bg-white/5 text-gray-500 border-white/5'
                    }`}>
                      {discount.code}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate group-hover:text-pink-300 transition-colors">
                      {discount.description || 'Sin descripcion'}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs font-semibold text-white">
                        {discount.discount_type === 'percentage'
                          ? `${discount.discount_value}%`
                          : formatCRC(discount.discount_value)}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${appliesToColors[discount.applies_to]}`}>
                        <AplicaIcon className="w-2.5 h-2.5" />
                        {appliesToLabels[discount.applies_to]}
                      </span>
                      {discount.vendor_name && (
                        <span className="text-[10px] text-gray-500">por {discount.vendor_name}</span>
                      )}
                    </div>
                  </div>

                  {/* Usage bar */}
                  {usagePercent !== null && (
                    <div className="hidden md:flex flex-col items-end gap-1 w-28 shrink-0">
                      <span className="text-[10px] text-gray-500">{discount.current_uses}/{discount.max_uses}</span>
                      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            usagePercent >= 90 ? 'bg-red-500' : usagePercent >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${usagePercent}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Stats */}
                  <div className="hidden lg:flex flex-col items-end gap-0.5 w-24 shrink-0">
                    <span className="text-xs font-semibold text-emerald-400">{formatCRC(discount.total_discounted)}</span>
                    <span className="text-[10px] text-gray-500">{discount.usage_count} usos</span>
                  </div>

                  {/* Status + Validity */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                      !discount.is_active
                        ? 'bg-red-500/15 text-red-400 border-red-500/30'
                        : isExpired
                          ? 'bg-gray-500/15 text-gray-400 border-gray-500/30'
                          : isExhausted
                            ? 'bg-orange-500/15 text-orange-400 border-orange-500/30'
                            : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    }`}>
                      {!discount.is_active ? 'Inactivo' : isExpired ? 'Expirado' : isExhausted ? 'Agotado' : 'Activo'}
                    </span>
                    <span className="text-[10px] text-gray-500">
                      {formatDate(discount.valid_until || '')}
                    </span>
                  </div>

                  {/* Toggle */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggle(discount.id, !discount.is_active);
                    }}
                    className="shrink-0 text-gray-500 hover:text-pink-400 transition-colors"
                  >
                    {discount.is_active ? (
                      <ToggleRight className="w-6 h-6 text-emerald-400" />
                    ) : (
                      <ToggleLeft className="w-6 h-6" />
                    )}
                  </button>
                </motion.div>
              );
            })
          )}
        </div>
      </motion.div>

      {/* Form Modal */}
      <DiscountFormModal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditCode(null); }}
        onSave={handleSave}
        vendors={vendors}
        editCode={editCode}
      />

      {/* Detail Modal */}
      {detailCode && (
        <DetailModal
          discount={detailCode}
          onClose={() => setDetailCode(null)}
          onToggle={handleToggle}
          onDelete={handleDelete}
        />
      )}
    </motion.div>
  );
}
