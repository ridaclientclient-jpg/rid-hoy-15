'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UtensilsCrossed, Pill, ShoppingBag, Wine, Croissant, ShoppingCart,
  PawPrint, Package, Coffee, Heart, Zap, Star, Plus, Pencil, Trash2,
  AlertTriangle, Loader2, RefreshCw, X, Check, LayoutGrid, Eye,
  Search, ChevronUp, ChevronDown, Image as ImageIcon,
} from 'lucide-react';
import { useVendorId } from '@/hooks/useVendorId';
import { supabase, type MarketplaceCategory } from '@/lib/supabase';
import { toast } from 'sonner';

/* ═══════════════════════════════════════════════════════════════
   ICON MAPPING
   ═══════════════════════════════════════════════════════════════ */
const iconMap: Record<string, React.ElementType> = {
  UtensilsCrossed,
  Pill,
  ShoppingBag,
  Wine,
  Croissant,
  ShoppingCart,
  PawPrint,
  Package,
  Coffee,
  Heart,
  Zap,
  Star,
};

const iconOptions = Object.keys(iconMap);

function getIcon(name: string): React.ElementType {
  return iconMap[name] || Package;
}

function renderIcon(name: string, size: 'sm' | 'md' | 'lg' = 'md'): React.ReactNode {
  const Icon = getIcon(name);
  const cls = { sm: 'w-4 h-4', md: 'w-5 h-5', lg: 'w-7 h-7' }[size];
  return <Icon className={cls} />;
}

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */
interface CategoryRow extends MarketplaceCategory {
  product_count: number;
}

interface AddFormData {
  name: string;
  icon: string;
  is_active: boolean;
}

const emptyAddForm: AddFormData = {
  name: '',
  icon: 'Package',
  is_active: true,
};

/* ═══════════════════════════════════════════════════════════════
   SKELETON LOADING
   ═══════════════════════════════════════════════════════════════ */
function SkeletonCard() {
  return (
    <div className="glass rounded-2xl overflow-hidden animate-pulse">
      <div className="h-2 bg-gray-50" />
      <div className="p-5 space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gray-50" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-50 rounded w-32" />
            <div className="h-3 bg-gray-50 rounded w-20" />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="h-3 bg-gray-50 rounded w-24" />
          <div className="h-6 bg-gray-50 rounded-full w-16" />
        </div>
      </div>
    </div>
  );
}

function SkeletonStats() {
  return (
    <div className="grid grid-cols-3 gap-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="glass rounded-xl p-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-50" />
            <div className="space-y-1.5">
              <div className="h-3 bg-gray-50 rounded w-12" />
              <div className="h-5 bg-gray-50 rounded w-8" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ICON PICKER POPOVER
   ═══════════════════════════════════════════════════════════════ */
function IconPicker({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (icon: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-12 h-12 rounded-xl bg-green-50 border border-green-200 flex items-center justify-center text-green-600 hover:bg-green-100 transition-colors"
      >
        {renderIcon(selected, 'lg')}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 mt-2 p-2 glass-strong rounded-xl grid grid-cols-4 gap-1.5 z-30 min-w-[180px]"
          >
            {iconOptions.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => {
                  onSelect(name);
                  setOpen(false);
                }}
                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                  name === selected
                    ? 'bg-green-100 text-green-700 ring-1 ring-green-300'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                {renderIcon(name, 'sm')}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TOGGLE SWITCH
   ═══════════════════════════════════════════════════════════════ */
function ToggleSwitch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={`relative w-11 h-6 rounded-full transition-colors duration-300 shrink-0 disabled:opacity-50 ${
        checked ? 'bg-green-500' : 'bg-gray-100'
      }`}
    >
      <motion.div
        className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md"
        animate={{ left: checked ? 'calc(100% - 22px)' : '2px' }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export default function CategoriesPage() {
  const { vendorId, loading: vendorLoading, error: vendorError } = useVendorId();

  /* ── State ─────────────────────────────────────────────────── */
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  // Add form
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<AddFormData>(emptyAddForm);

  // Inline rename
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<CategoryRow | null>(null);
  const [deleteCount, setDeleteCount] = useState(0);

  // Toggle loading
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Reorder loading
  const [reorderingId, setReorderingId] = useState<string | null>(null);

  /* ═══════════════════════════════════════════════════════════════
     FETCH CATEGORIES + VENDOR PRODUCT COUNTS
     ═══════════════════════════════════════════════════════════════ */
  const fetchCategories = useCallback(async () => {
    if (!vendorId) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('marketplace_categories')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;

      const rows: CategoryRow[] = (data || []).map((c) => ({
        ...c,
        product_count: 0,
      }));

      // Count this vendor's products per category
      if (rows.length > 0) {
        const { data: products } = await supabase
          .from('products')
          .select('category')
          .eq('vendor_id', vendorId);

        const counts: Record<string, number> = {};
        for (const p of products || []) {
          if (p.category) {
            counts[p.category] = (counts[p.category] || 0) + 1;
          }
        }

        for (const row of rows) {
          row.product_count = counts[row.name.toLowerCase()] || 0;
          // Also try exact case match
          if (row.product_count === 0) {
            row.product_count = counts[row.name] || 0;
          }
        }
      }

      setCategories(rows);
    } catch (err) {
      console.error('Error fetching categories:', err);
      toast.error('Error al cargar categorías');
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  useEffect(() => {
    if (vendorId) fetchCategories();
  }, [vendorId, fetchCategories]);

  /* ── Computed ──────────────────────────────────────────────── */
  const filtered = useMemo(
    () => categories.filter((c) => c.name.toLowerCase().includes(search.toLowerCase())),
    [categories, search]
  );

  const totalCategories = categories.length;
  const activeCategories = categories.filter((c) => c.is_active).length;
  const totalProducts = categories.reduce((sum, c) => sum + c.product_count, 0);

  /* ═══════════════════════════════════════════════════════════════
     ADD CATEGORY
     ═══════════════════════════════════════════════════════════════ */
  const handleAddCategory = async () => {
    if (!addForm.name.trim()) {
      toast.error('El nombre no puede estar vacío');
      return;
    }

    const trimmed = addForm.name.trim();

    if (categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error('Ya existe una categoría con ese nombre');
      return;
    }

    setSaving(true);
    try {
      const nextSort = totalCategories > 0
        ? Math.max(...categories.map((c) => c.sort_order || 0)) + 1
        : 1;

      const { error } = await supabase
        .from('marketplace_categories')
        .insert({
          name: trimmed,
          icon: addForm.icon,
          sort_order: nextSort,
          is_active: addForm.is_active,
        });

      if (error) throw error;

      toast.success(`Categoría "${trimmed}" creada`);
      setAddForm(emptyAddForm);
      setShowAddForm(false);
      await fetchCategories();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al crear categoría';
      if (msg.includes('unique') || msg.includes('duplicate')) {
        toast.error('Ya existe una categoría con ese nombre');
      } else {
        toast.error(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  /* ═══════════════════════════════════════════════════════════════
     RENAME CATEGORY
     ═══════════════════════════════════════════════════════════════ */
  const handleStartRename = (cat: CategoryRow) => {
    setEditingId(cat.id);
    setEditValue(cat.name);
  };

  const handleConfirmRename = async () => {
    if (!editingId || !editValue.trim()) {
      toast.error('El nombre no puede estar vacío');
      return;
    }

    const trimmed = editValue.trim();
    const cat = categories.find((c) => c.id === editingId);
    if (!cat) return;

    if (trimmed === cat.name) {
      setEditingId(null);
      return;
    }

    if (categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase() && c.id !== editingId)) {
      toast.error('Ya existe una categoría con ese nombre');
      return;
    }

    setSaving(true);
    try {
      // Update marketplace_categories table
      const { error: catError } = await supabase
        .from('marketplace_categories')
        .update({ name: trimmed })
        .eq('id', editingId);

      if (catError) throw catError;

      // Update all vendor products with the old category name
      const { error: prodError } = await supabase
        .from('products')
        .update({ category: trimmed })
        .eq('vendor_id', vendorId!)
        .eq('category', cat.name);

      if (prodError) {
        console.warn('Warning: Could not update product categories:', prodError.message);
      }

      setEditingId(null);
      toast.success(`Categoría renombrada a "${trimmed}"`);
      await fetchCategories();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al renombrar';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelRename = () => {
    setEditingId(null);
    setEditValue('');
  };

  /* ═══════════════════════════════════════════════════════════════
     DELETE CATEGORY
     ═══════════════════════════════════════════════════════════════ */
  const handleOpenDelete = async (cat: CategoryRow) => {
    // Re-count products for this specific category at delete time
    if (!vendorId) return;

    const { data: products } = await supabase
      .from('products')
      .select('category')
      .eq('vendor_id', vendorId);

    let count = 0;
    for (const p of products || []) {
      if (p.category && p.category.toLowerCase() === cat.name.toLowerCase()) {
        count++;
      }
    }

    setDeleteTarget(cat);
    setDeleteCount(count);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    if (deleteCount > 0) {
      toast.error(
        `No se puede eliminar "${deleteTarget.name}": tiene ${deleteCount} producto(s). Reasigna los productos primero.`
      );
      setDeleteTarget(null);
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('marketplace_categories')
        .delete()
        .eq('id', deleteTarget.id);

      if (error) throw error;

      toast.success(`Categoría "${deleteTarget.name}" eliminada`);
      setDeleteTarget(null);
      setDeleteCount(0);
      await fetchCategories();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al eliminar categoría';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  /* ═══════════════════════════════════════════════════════════════
     TOGGLE ACTIVE
     ═══════════════════════════════════════════════════════════════ */
  const handleToggleActive = async (cat: CategoryRow) => {
    setTogglingId(cat.id);
    const newActive = !cat.is_active;
    try {
      const { error } = await supabase
        .from('marketplace_categories')
        .update({ is_active: newActive })
        .eq('id', cat.id);
      if (error) throw error;
      toast.success(newActive ? 'Categoría activada' : 'Categoría desactivada');
      fetchCategories();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cambiar estado';
      toast.error(msg);
    } finally {
      setTogglingId(null);
    }
  };

  /* ═══════════════════════════════════════════════════════════════
     REORDER
     ═══════════════════════════════════════════════════════════════ */
  const handleMoveUp = async (index: number) => {
    if (index <= 0) return;
    const current = filtered[index];
    const above = filtered[index - 1];
    if (!current || !above) return;

    setReorderingId(current.id);
    try {
      const { error: e1 } = await supabase
        .from('marketplace_categories')
        .update({ sort_order: above.sort_order })
        .eq('id', current.id);
      if (e1) throw e1;

      const { error: e2 } = await supabase
        .from('marketplace_categories')
        .update({ sort_order: current.sort_order })
        .eq('id', above.id);
      if (e2) throw e2;

      fetchCategories();
    } catch {
      toast.error('Error al reordenar');
    } finally {
      setReorderingId(null);
    }
  };

  const handleMoveDown = async (index: number) => {
    if (index >= filtered.length - 1) return;
    const current = filtered[index];
    const below = filtered[index + 1];
    if (!current || !below) return;

    setReorderingId(current.id);
    try {
      const { error: e1 } = await supabase
        .from('marketplace_categories')
        .update({ sort_order: below.sort_order })
        .eq('id', current.id);
      if (e1) throw e1;

      const { error: e2 } = await supabase
        .from('marketplace_categories')
        .update({ sort_order: current.sort_order })
        .eq('id', below.id);
      if (e2) throw e2;

      fetchCategories();
    } catch {
      toast.error('Error al reordenar');
    } finally {
      setReorderingId(null);
    }
  };

  /* ═══════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════ */

  /* ── Vendor loading / error ───────────────────────────────── */
  if (vendorLoading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <SkeletonStats />
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </motion.div>
    );
  }

  if (!vendorId) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center py-20"
      >
        <AlertTriangle className="w-10 h-10 text-amber-600 mb-4" />
        <p className="text-gray-500 text-sm">No se encontró tienda asociada</p>
        <p className="text-gray-300 text-xs mt-1">Contacta al administrador para vincular tu cuenta</p>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* ─── Header ───────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categorías</h1>
          <p className="text-gray-500 text-sm mt-1">
            {loading ? 'Cargando...' : `${totalCategories} categorías · ${totalProducts} productos`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            type="button"
            onClick={() => fetchCategories()}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-all disabled:opacity-50"
            whileTap={{ scale: 0.97 }}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </motion.button>
          <motion.button
            type="button"
            onClick={() => setShowAddForm(true)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-50 border border-green-200 text-sm text-green-600 hover:bg-green-100 transition-all disabled:opacity-50"
            whileTap={{ scale: 0.97 }}
          >
            <Plus className="w-4 h-4" />
            Nueva Categoría
          </motion.button>
        </div>
      </div>

      {/* ─── Stats ────────────────────────────────────────── */}
      {!loading && (
        <motion.div
          className="grid grid-cols-3 gap-3"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="glass rounded-xl p-4 border border-green-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
                <LayoutGrid className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-[11px] text-gray-400 uppercase tracking-wider">Total</p>
                <p className="text-lg font-bold text-green-600">{totalCategories}</p>
              </div>
            </div>
          </div>
          <div className="glass rounded-xl p-4 border border-emerald-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                <Eye className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-[11px] text-gray-400 uppercase tracking-wider">Activas</p>
                <p className="text-lg font-bold text-emerald-600">{activeCategories}</p>
              </div>
            </div>
          </div>
          <div className="glass rounded-xl p-4 border border-amber-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                <ShoppingBag className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-[11px] text-gray-400 uppercase tracking-wider">Productos</p>
                <p className="text-lg font-bold text-amber-600">{totalProducts}</p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ─── Add Category Form ────────────────────────────── */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="glass rounded-2xl p-5 border border-green-200">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Nueva Categoría</h3>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                {/* Icon picker */}
                <div className="flex flex-col items-center gap-1.5">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">Icono</span>
                  <IconPicker
                    selected={addForm.icon}
                    onSelect={(icon) => setAddForm((prev) => ({ ...prev, icon }))}
                  />
                </div>

                {/* Name input */}
                <div className="flex-1 w-full space-y-1">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">Nombre</span>
                  <input
                    type="text"
                    value={addForm.name}
                    onChange={(e) => setAddForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Ej: Bebidas, Limpieza, Snacks..."
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-green-500 transition-colors"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddCategory();
                      if (e.key === 'Escape') {
                        setShowAddForm(false);
                        setAddForm(emptyAddForm);
                      }
                    }}
                    disabled={saving}
                  />
                </div>

                {/* Active toggle */}
                <div className="flex flex-col items-center gap-1.5">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">Activa</span>
                  <ToggleSwitch
                    checked={addForm.is_active}
                    onChange={() => setAddForm((prev) => ({ ...prev, is_active: !prev.is_active }))}
                    disabled={saving}
                  />
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2">
                  <motion.button
                    type="button"
                    onClick={handleAddCategory}
                    disabled={saving || !addForm.name.trim()}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-600 text-white text-sm font-medium hover:bg-green-500 transition-all disabled:opacity-50"
                    whileTap={{ scale: 0.97 }}
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Crear
                  </motion.button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      setAddForm(emptyAddForm);
                    }}
                    className="p-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors"
                    disabled={saving}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-gray-400 mt-3">
                La categoría se creará en el marketplace. Puedes asignarla a tus productos desde la página de productos.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Search ───────────────────────────────────────── */}
      {!loading && categories.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar categorías..."
            className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-green-300 transition-colors"
          />
        </div>
      )}

      {/* ─── Loading Skeleton ─────────────────────────────── */}
      {loading && (
        <div className="space-y-6">
          <SkeletonStats />
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      )}

      {/* ─── Empty State ──────────────────────────────────── */}
      {!loading && categories.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-20"
        >
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Sin categorías</p>
          <p className="text-gray-300 text-xs mt-1">Crea tu primera categoría para organizar tus productos</p>
          <motion.button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-green-50 border border-green-200 text-sm text-green-600 hover:bg-green-100 transition-all"
            whileTap={{ scale: 0.97 }}
          >
            <Plus className="w-4 h-4" />
            Crear Categoría
          </motion.button>
        </motion.div>
      )}

      {/* ─── Search: No results ───────────────────────────── */}
      {!loading && categories.length > 0 && filtered.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-16"
        >
          <Search className="w-10 h-10 text-gray-300 mb-3" />
          <p className="text-gray-400 text-sm">No se encontraron categorías con &ldquo;{search}&rdquo;</p>
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════════════════
          CATEGORY CARDS GRID
          ═══════════════════════════════════════════════════════ */}
      {!loading && filtered.length > 0 && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          <AnimatePresence mode="popLayout">
            {filtered.map((cat, index) => (
              <motion.div
                key={cat.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: index * 0.05 }}
                className="glass rounded-2xl overflow-hidden group hover:glow-cyan transition-all duration-300"
              >
                {/* Top gradient bar */}
                <div className={`h-1.5 ${
                  cat.is_active
                    ? 'bg-gradient-to-r from-green-500 to-emerald-400'
                    : 'bg-gray-100'
                }`} />

                <div className="p-5">
                  {/* Icon + Name + Actions */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                        cat.is_active
                          ? 'bg-green-50 text-green-600'
                          : 'bg-gray-50 text-gray-400'
                      }`}>
                        {renderIcon(cat.icon || 'Package', 'lg')}
                      </div>

                      <div className="min-w-0">
                        {editingId === cat.id ? (
                          /* ── Inline rename ──────────── */
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1 text-sm text-gray-900 focus:outline-none focus:border-green-500 w-36"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleConfirmRename();
                                if (e.key === 'Escape') handleCancelRename();
                              }}
                              disabled={saving}
                            />
                            <button
                              type="button"
                              onClick={handleConfirmRename}
                              className="p-1 text-emerald-600 hover:text-emerald-500 disabled:opacity-50"
                              disabled={saving}
                            >
                              {saving ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelRename}
                              className="p-1 text-gray-500 hover:text-gray-900 disabled:opacity-50"
                              disabled={saving}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <h3 className={`text-base font-bold truncate ${
                            cat.is_active ? 'text-gray-900' : 'text-gray-500'
                          }`}>
                            {cat.name}
                          </h3>
                        )}
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {cat.product_count} producto{cat.product_count !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>

                    {editingId !== cat.id && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        <motion.button
                          type="button"
                          onClick={() => handleStartRename(cat)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors"
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          title="Renombrar"
                          disabled={saving}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </motion.button>
                        <motion.button
                          type="button"
                          onClick={() => handleOpenDelete(cat)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          title="Eliminar"
                          disabled={saving}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </motion.button>
                      </div>
                    )}
                  </div>

                  {/* Stats bar */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-xs">
                      <ShoppingBag className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-gray-900 font-semibold">{cat.product_count}</span>
                      <span className="text-gray-400">productos</span>
                    </div>
                    {totalProducts > 0 && (
                      <>
                        <div className="flex-1 h-1.5 bg-gray-50 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400"
                            initial={{ width: 0 }}
                            animate={{
                              width: `${(cat.product_count / totalProducts) * 100}%`,
                            }}
                            transition={{ duration: 0.6, delay: index * 0.05 }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-400 tabular-nums w-8 text-right">
                          {Math.round((cat.product_count / totalProducts) * 100)}%
                        </span>
                      </>
                    )}
                  </div>

                  {/* Bottom row: Reorder + Active toggle */}
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                    {/* Reorder buttons */}
                    <div className="flex items-center gap-0.5">
                      <motion.button
                        type="button"
                        onClick={() => handleMoveUp(index)}
                        disabled={index === 0 || reorderingId === cat.id}
                        className="p-1 rounded-md text-gray-300 hover:text-green-600 hover:bg-green-50 transition-colors disabled:opacity-30"
                        whileTap={{ scale: 0.9 }}
                      >
                        <ChevronUp className="w-4 h-4" />
                      </motion.button>
                      <span className="w-6 text-center text-[10px] text-gray-300 font-mono">
                        {cat.sort_order}
                      </span>
                      <motion.button
                        type="button"
                        onClick={() => handleMoveDown(index)}
                        disabled={index === filtered.length - 1 || reorderingId === cat.id}
                        className="p-1 rounded-md text-gray-300 hover:text-green-600 hover:bg-green-50 transition-colors disabled:opacity-30"
                        whileTap={{ scale: 0.9 }}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </motion.button>
                    </div>

                    {/* Active toggle */}
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-medium ${
                        cat.is_active ? 'text-emerald-600' : 'text-gray-300'
                      }`}>
                        {cat.is_active ? 'Activa' : 'Inactiva'}
                      </span>
                      {togglingId === cat.id ? (
                        <div className="w-11 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-green-600" />
                        </div>
                      ) : (
                        <ToggleSwitch
                          checked={cat.is_active}
                          onChange={() => handleToggleActive(cat)}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          DELETE CONFIRMATION MODAL
          ═══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setDeleteTarget(null)}
            />
            <motion.div
              className="relative w-full max-w-sm glass-strong rounded-2xl z-10 p-6 mx-4"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              {deleteCount > 0 ? (
                /* ── Warning: products exist ───────────── */
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gray-900">No se puede eliminar</h3>
                      <p className="text-xs text-gray-500">{deleteTarget.name}</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-5">
                    Esta categoría tiene <span className="text-gray-900 font-semibold">{deleteCount} producto{deleteCount !== 1 ? 's' : ''}</span> asignado{deleteCount !== 1 ? 's' : ''}.
                    Reasigna los productos a otra categoría antes de eliminarla.
                  </p>
                  <motion.button
                    type="button"
                    onClick={() => setDeleteTarget(null)}
                    className="w-full py-2.5 rounded-xl text-sm text-gray-500 bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors"
                    whileTap={{ scale: 0.97 }}
                  >
                    Entendido
                  </motion.button>
                </>
              ) : (
                /* ── Confirm delete ─────────────────────── */
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-5 h-5 text-red-400" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gray-900">Eliminar categoría</h3>
                      <p className="text-xs text-gray-500">{deleteTarget.name}</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-5">
                    ¿Estás seguro de que deseas eliminar la categoría{' '}
                    <span className="text-gray-900 font-semibold">&ldquo;{deleteTarget.name}&rdquo;</span>?
                    Esta acción no se puede deshacer.
                  </p>
                  <div className="flex items-center gap-3">
                    <motion.button
                      type="button"
                      onClick={() => setDeleteTarget(null)}
                      className="flex-1 py-2.5 rounded-xl text-sm text-gray-500 bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors"
                      whileTap={{ scale: 0.97 }}
                      disabled={saving}
                    >
                      Cancelar
                    </motion.button>
                    <motion.button
                      type="button"
                      onClick={handleConfirmDelete}
                      className="flex-1 py-2.5 rounded-xl text-sm text-white bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 transition-colors flex items-center justify-center gap-2"
                      whileTap={{ scale: 0.97 }}
                      disabled={saving}
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      Eliminar
                    </motion.button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
