'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  UtensilsCrossed, Pill, ShoppingBag, Wine, Croissant, ShoppingCart,
  PawPrint, Package, Coffee, Heart, Zap, Star, Plus, Edit, Trash2,
  ChevronUp, ChevronDown, Eye, Search, X, Loader2, ChevronLeft,
  Upload, AlertTriangle, Image as ImageIcon, LayoutGrid, List,
} from 'lucide-react';
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
  Plus,
  Edit,
  Trash2,
  ChevronUp,
  ChevronDown,
  Eye,
  Search,
};

const iconOptions = Object.keys(iconMap);

function getIcon(name: string): React.ElementType {
  return iconMap[name] || Package;
}

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */
interface CategoryRow extends MarketplaceCategory {
  product_count: number;
  image_signed_url?: string;
}

interface FormData {
  name: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
  imageFile: File | null;
  imagePreview: string | null;
}

const emptyForm: FormData = {
  name: '',
  icon: 'Package',
  sort_order: 0,
  is_active: true,
  imageFile: null,
  imagePreview: null,
};

type ModalMode = 'add' | 'edit' | 'delete' | null;

/* ═══════════════════════════════════════════════════════════════
   BREADCRUMB
   ═══════════════════════════════════════════════════════════════ */
function Breadcrumb() {
  return (
    <nav className="flex items-center gap-2 text-sm">
      <Link
        href="/admin/marketplace"
        className="text-gray-400 hover:text-violet-400 transition-colors flex items-center gap-1"
      >
        <ChevronLeft className="w-4 h-4" />
        Marketplace
      </Link>
      <span className="text-gray-600">/</span>
      <span className="text-white font-medium">Categorías</span>
    </nav>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SKELETON LOADING
   ═══════════════════════════════════════════════════════════════ */
function SkeletonRow() {
  return (
    <div className="glass rounded-xl p-4 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-white/5" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-white/5 rounded w-40" />
          <div className="h-3 bg-white/5 rounded w-24" />
        </div>
        <div className="h-6 bg-white/5 rounded-full w-16" />
        <div className="h-6 bg-white/5 rounded-full w-16" />
        <div className="h-8 w-20 bg-white/5 rounded-lg" />
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="glass rounded-xl p-4 animate-pulse">
            <div className="h-6 bg-white/5 rounded w-12 mx-auto mb-1" />
            <div className="h-3 bg-white/5 rounded w-16 mx-auto" />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ICON PREVIEW COMPONENT
   ═══════════════════════════════════════════════════════════════ */
function renderIcon(name: string, size = 'md'): React.ReactNode {
  const Icon = getIcon(name);
  const cls = { sm: 'w-4 h-4', md: 'w-5 h-5', lg: 'w-6 h-6' }[size] || 'w-5 h-5';
  return <Icon className={cls} />;
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export default function MarketplaceCategoriesPage() {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<ModalMode>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CategoryRow | null>(null);
  const [deleteProductCount, setDeleteProductCount] = useState(0);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ═══════════════════════════════════════════════════════════════
     FETCH CATEGORIES + PRODUCT COUNTS
     ═══════════════════════════════════════════════════════════════ */
  const fetchCategories = useCallback(async () => {
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

      // Fetch signed URLs for images in parallel
      const urlPromises = rows.map(async (row) => {
        if (row.image_url) {
          try {
            const path = row.image_url.replace('products/', '');
            const { data: urlData } = await supabase.storage
              .from('products')
              .createSignedUrl(path, 3600);
            if (urlData?.signedUrl) {
              row.image_signed_url = urlData.signedUrl;
            }
          } catch {
            row.image_signed_url = row.image_url;
          }
        }
        return row;
      });
      const rowsWithUrls = await Promise.all(urlPromises);

      // Count products per category
      if (rowsWithUrls.length > 0) {
        const { data: products } = await supabase
          .from('products')
          .select('category');

        const productCounts: Record<string, number> = {};
        for (const p of products || []) {
          if (p.category) {
            productCounts[p.category] = (productCounts[p.category] || 0) + 1;
          }
        }

        for (const row of rowsWithUrls) {
          row.product_count = productCounts[row.name.toLowerCase()] || 0;
        }
      }

      setCategories(rowsWithUrls);
    } catch (err) {
      console.error('Error fetching categories:', err);
      toast.error('Error al cargar categorías');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  /* ═══════════════════════════════════════════════════════════════
     FILTERED
     ═══════════════════════════════════════════════════════════════ */
  const filtered = categories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalCategories = categories.length;
  const activeCategories = categories.filter((c) => c.is_active).length;
  const totalProducts = categories.reduce((sum, c) => sum + c.product_count, 0);

  /* ═══════════════════════════════════════════════════════════════
     OPEN MODALS
     ═══════════════════════════════════════════════════════════════ */
  function openAddModal() {
    const nextSort = totalCategories > 0
      ? Math.max(...categories.map((c) => c.sort_order || 0)) + 1
      : 1;
    setForm({ ...emptyForm, sort_order: nextSort });
    setEditingId(null);
    setModal('add');
  }

  function openEditModal(cat: CategoryRow) {
    setEditingId(cat.id);
    setForm({
      name: cat.name,
      icon: cat.icon || 'Package',
      sort_order: cat.sort_order,
      is_active: cat.is_active,
      imageFile: null,
      imagePreview: cat.image_signed_url || cat.image_url || null,
    });
    setModal('edit');
  }

  function openDeleteModal(cat: CategoryRow) {
    setDeleteTarget(cat);
    // Count products using this category name
    setDeleteProductCount(cat.product_count);
    setModal('delete');
  }

  function closeModal() {
    setModal(null);
    setEditingId(null);
    setDeleteTarget(null);
    setDeleteProductCount(0);
    setForm(emptyForm);
  }

  /* ═══════════════════════════════════════════════════════════════
     IMAGE HANDLER
     ═══════════════════════════════════════════════════════════════ */
  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen no puede superar 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setForm((prev) => ({
        ...prev,
        imageFile: file,
        imagePreview: reader.result as string,
      }));
    };
    reader.readAsDataURL(file);
  }

  function removeImage() {
    setForm((prev) => ({ ...prev, imageFile: null, imagePreview: null }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  /* ═══════════════════════════════════════════════════════════════
     SAVE (CREATE / UPDATE)
     ═══════════════════════════════════════════════════════════════ */
  async function handleSave() {
    if (!form.name.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }

    setSaving(true);
    try {
      let imageUrl: string | null = null;

      if (editingId) {
        // Keep existing image if no new one provided
        imageUrl = form.imagePreview && !form.imageFile
          ? categories.find((c) => c.id === editingId)?.image_url || null
          : null;
      }

      // Upload new image if provided
      if (form.imageFile) {
        const ext = form.imageFile.name.split('.').pop();
        const folderPath = editingId || `temp-${Date.now()}`;
        const filePath = `categories/${folderPath}/image.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('products')
          .upload(filePath, form.imageFile, { upsert: true });
        if (uploadErr) throw uploadErr;
        imageUrl = `products/${filePath}`;
      }

      if (modal === 'add') {
        const { data: newCat, error } = await supabase
          .from('marketplace_categories')
          .insert({
            name: form.name.trim(),
            icon: form.icon,
            image_url: imageUrl,
            sort_order: form.sort_order,
            is_active: form.is_active,
          })
          .select()
          .single();

        if (error) throw error;

        // If image was uploaded with temp path, move it
        if (form.imageFile && newCat) {
          const ext = form.imageFile.name.split('.').pop();
          const correctPath = `categories/${newCat.id}/image.${ext}`;
          try {
            await supabase.storage
              .from('products')
              .move(`categories/temp-${Date.now()}/image.${ext}`, correctPath);
            await supabase
              .from('marketplace_categories')
              .update({ image_url: `products/${correctPath}` })
              .eq('id', newCat.id);
          } catch {
            // Keep the temp path, not critical
          }
        }

        toast.success('Categoría creada exitosamente');
      } else if (modal === 'edit' && editingId) {
        const updates: Record<string, unknown> = {
          name: form.name.trim(),
          icon: form.icon,
          sort_order: form.sort_order,
          is_active: form.is_active,
        };
        if (form.imageFile) {
          updates.image_url = imageUrl;
        }

        const { error } = await supabase
          .from('marketplace_categories')
          .update(updates)
          .eq('id', editingId);

        if (error) throw error;
        toast.success('Categoría actualizada exitosamente');
      }

      closeModal();
      fetchCategories();
    } catch (err: any) {
      console.error('Error saving category:', err);
      const msg = err?.message || 'Error al guardar categoría';
      if (msg.includes('unique') || msg.includes('duplicate')) {
        toast.error('Ya existe una categoría con ese nombre');
      } else {
        toast.error(msg);
      }
    } finally {
      setSaving(false);
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     DELETE
     ═══════════════════════════════════════════════════════════════ */
  async function handleDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      // Delete image from storage if exists
      if (deleteTarget.image_url) {
        const path = deleteTarget.image_url.replace('products/', '');
        try {
          // Try to remove the file; list and remove all files in the category folder
          const { data: files } = await supabase.storage
            .from('products')
            .list(`categories/${deleteTarget.id}`);
          if (files && files.length > 0) {
            const pathsToRemove = files.map((f) => `categories/${deleteTarget.id}/${f.name}`);
            await supabase.storage
              .from('products')
              .remove(pathsToRemove);
          }
        } catch {
          // Image cleanup failed, continue with category deletion
        }
      }

      const { error } = await supabase
        .from('marketplace_categories')
        .delete()
        .eq('id', deleteTarget.id);

      if (error) throw error;
      toast.success('Categoría eliminada');
      closeModal();
      fetchCategories();
    } catch (err) {
      console.error('Error deleting category:', err);
      toast.error('Error al eliminar categoría');
    } finally {
      setSaving(false);
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     TOGGLE ACTIVE
     ═══════════════════════════════════════════════════════════════ */
  async function handleToggleActive(cat: CategoryRow) {
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
    } catch (err) {
      console.error('Error toggling category:', err);
      toast.error('Error al cambiar estado');
    } finally {
      setTogglingId(null);
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     REORDER
     ═══════════════════════════════════════════════════════════════ */
  async function handleMoveUp(index: number) {
    if (index <= 0) return;
    const sorted = [...filtered];
    const current = sorted[index];
    const above = sorted[index - 1];
    if (!current || !above) return;

    setReorderingId(current.id);
    try {
      const { error } = await supabase
        .from('marketplace_categories')
        .update({ sort_order: above.sort_order })
        .eq('id', current.id);
      if (error) throw error;

      const { error: error2 } = await supabase
        .from('marketplace_categories')
        .update({ sort_order: current.sort_order })
        .eq('id', above.id);
      if (error2) throw error2;

      fetchCategories();
    } catch (err) {
      console.error('Error reordering:', err);
      toast.error('Error al reordenar');
    } finally {
      setReorderingId(null);
    }
  }

  async function handleMoveDown(index: number) {
    if (index >= filtered.length - 1) return;
    const sorted = [...filtered];
    const current = sorted[index];
    const below = sorted[index + 1];
    if (!current || !below) return;

    setReorderingId(current.id);
    try {
      const { error } = await supabase
        .from('marketplace_categories')
        .update({ sort_order: below.sort_order })
        .eq('id', current.id);
      if (error) throw error;

      const { error: error2 } = await supabase
        .from('marketplace_categories')
        .update({ sort_order: current.sort_order })
        .eq('id', below.id);
      if (error2) throw error2;

      fetchCategories();
    } catch (err) {
      console.error('Error reordering:', err);
      toast.error('Error al reordenar');
    } finally {
      setReorderingId(null);
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════ */
  if (loading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <Breadcrumb />
        <LoadingState />
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* ─── Breadcrumb ────────────────────────────────────── */}
      <Breadcrumb />

      {/* ─── Header ───────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Categorías</h1>
          <p className="text-gray-400 text-sm mt-1">
            Gestiona las categorías del marketplace
          </p>
        </div>
        <motion.button
          onClick={openAddModal}
          className="self-start inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-500 hover:to-purple-500 shadow-lg shadow-violet-500/20 transition-all"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
        >
          <Plus className="w-4 h-4" />
          Nueva Categoría
        </motion.button>
      </div>

      {/* ─── Stats ────────────────────────────────────────── */}
      <motion.div
        className="grid grid-cols-3 gap-3"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="glass rounded-xl p-4 border border-violet-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center">
              <LayoutGrid className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-wider">Total</p>
              <p className="text-lg font-bold text-violet-400">{totalCategories}</p>
            </div>
          </div>
        </div>
        <div className="glass rounded-xl p-4 border border-emerald-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
              <Eye className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-wider">Activas</p>
              <p className="text-lg font-bold text-emerald-400">{activeCategories}</p>
            </div>
          </div>
        </div>
        <div className="glass rounded-xl p-4 border border-amber-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-wider">Productos</p>
              <p className="text-lg font-bold text-amber-400">{totalProducts}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ─── Search ───────────────────────────────────────── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar categorías..."
          className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-violet-500/50 transition-colors"
        />
      </div>

      {/* ─── Category List ────────────────────────────────── */}
      {filtered.length === 0 && !loading ? (
        <div className="text-center py-16">
          <LayoutGrid className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No se encontraron categorías</p>
          <motion.button
            onClick={openAddModal}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-500 hover:to-purple-500 shadow-lg shadow-violet-500/20 transition-all"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <Plus className="w-4 h-4" />
            Crear primera categoría
          </motion.button>
        </div>
      ) : (
        <>
          {/* ─── Desktop Table (hidden on mobile) ──────────── */}
          <div className="hidden md:block">
            <div className="glass rounded-2xl overflow-hidden border border-white/5">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left px-4 py-3 text-[11px] text-gray-500 uppercase tracking-wider font-medium">
                      Icono
                    </th>
                    <th className="text-left px-4 py-3 text-[11px] text-gray-500 uppercase tracking-wider font-medium">
                      Nombre
                    </th>
                    <th className="text-left px-4 py-3 text-[11px] text-gray-500 uppercase tracking-wider font-medium">
                      Imagen
                    </th>
                    <th className="text-center px-4 py-3 text-[11px] text-gray-500 uppercase tracking-wider font-medium">
                      Productos
                    </th>
                    <th className="text-center px-4 py-3 text-[11px] text-gray-500 uppercase tracking-wider font-medium">
                      Orden
                    </th>
                    <th className="text-center px-4 py-3 text-[11px] text-gray-500 uppercase tracking-wider font-medium">
                      Estado
                    </th>
                    <th className="text-right px-4 py-3 text-[11px] text-gray-500 uppercase tracking-wider font-medium">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {filtered.map((cat, index) => (
                      <motion.tr
                        key={cat.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        transition={{ delay: index * 0.03 }}
                        className="border-b border-white/5 hover:bg-white/[0.03] transition-colors group"
                      >
                        {/* Icon */}
                        <td className="px-4 py-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600/20 to-purple-600/20 flex items-center justify-center text-violet-400">
                            {renderIcon(cat.icon || 'Package')}
                          </div>
                        </td>
                        {/* Name */}
                        <td className="px-4 py-3">
                          <p className="text-sm font-semibold text-white">{cat.name}</p>
                          <p className="text-[11px] text-gray-500 mt-0.5 font-mono">{cat.icon || '—'}</p>
                        </td>
                        {/* Image thumbnail */}
                        <td className="px-4 py-3">
                          {cat.image_signed_url ? (
                            <div className="w-10 h-10 rounded-lg overflow-hidden ring-1 ring-white/10">
                              <img
                                src={cat.image_signed_url}
                                alt={cat.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                              <ImageIcon className="w-4 h-4 text-gray-600" />
                            </div>
                          )}
                        </td>
                        {/* Product count */}
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400">
                            <ShoppingBag className="w-3 h-3" />
                            {cat.product_count}
                          </span>
                        </td>
                        {/* Sort order + reorder */}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <motion.button
                              onClick={() => handleMoveUp(index)}
                              disabled={index === 0 || reorderingId === cat.id}
                              className="p-1 rounded-md text-gray-500 hover:text-violet-400 hover:bg-violet-500/10 transition-colors disabled:opacity-30"
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                            >
                              <ChevronUp className="w-4 h-4" />
                            </motion.button>
                            <span className="w-7 text-center text-xs font-mono text-gray-400">
                              {cat.sort_order}
                            </span>
                            <motion.button
                              onClick={() => handleMoveDown(index)}
                              disabled={index === filtered.length - 1 || reorderingId === cat.id}
                              className="p-1 rounded-md text-gray-500 hover:text-violet-400 hover:bg-violet-500/10 transition-colors disabled:opacity-30"
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                            >
                              <ChevronDown className="w-4 h-4" />
                            </motion.button>
                          </div>
                        </td>
                        {/* Active badge */}
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleToggleActive(cat)}
                            disabled={togglingId === cat.id}
                            className={`relative w-11 h-6 rounded-full transition-colors duration-300 disabled:opacity-50 ${
                              cat.is_active ? 'bg-emerald-500' : 'bg-white/10'
                            }`}
                          >
                            {togglingId === cat.id ? (
                              <div className="absolute top-0.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-white shadow-md">
                                <Loader2 className="w-3 h-3 animate-spin text-emerald-500 mt-1" />
                              </div>
                            ) : (
                              <motion.div
                                className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md"
                                animate={{
                                  left: cat.is_active ? 'calc(100% - 22px)' : '2px',
                                }}
                                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                              />
                            )}
                          </button>
                        </td>
                        {/* Actions */}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <motion.button
                              onClick={() => openEditModal(cat)}
                              className="p-2 rounded-lg text-gray-400 hover:text-violet-400 hover:bg-violet-500/10 transition-colors"
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              title="Editar"
                            >
                              <Edit className="w-4 h-4" />
                            </motion.button>
                            <motion.button
                              onClick={() => openDeleteModal(cat)}
                              className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </motion.button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </div>

          {/* ─── Mobile Cards (hidden on desktop) ──────────── */}
          <div className="md:hidden space-y-3">
            <AnimatePresence>
              {filtered.map((cat, index) => (
                <motion.div
                  key={cat.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: index * 0.03 }}
                  className="glass rounded-2xl p-4 border border-white/5"
                >
                  <div className="flex items-start gap-3">
                    {/* Icon + Image */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600/20 to-purple-600/20 flex items-center justify-center text-violet-400">
                        {renderIcon(cat.icon || 'Package')}
                      </div>
                      {cat.image_signed_url ? (
                        <div className="w-10 h-10 rounded-lg overflow-hidden ring-1 ring-white/10">
                          <img
                            src={cat.image_signed_url}
                            alt={cat.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : null}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-white truncate">{cat.name}</h3>
                        <button
                          onClick={() => handleToggleActive(cat)}
                          disabled={togglingId === cat.id}
                          className={`relative w-11 h-6 rounded-full transition-colors duration-300 disabled:opacity-50 shrink-0 ml-2 ${
                            cat.is_active ? 'bg-emerald-500' : 'bg-white/10'
                          }`}
                        >
                          {togglingId === cat.id ? (
                            <div className="absolute top-0.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-white shadow-md">
                              <Loader2 className="w-3 h-3 animate-spin text-emerald-500 mt-1" />
                            </div>
                          ) : (
                            <motion.div
                              className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md"
                              animate={{
                                left: cat.is_active ? 'calc(100% - 22px)' : '2px',
                              }}
                              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                            />
                          )}
                        </button>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[11px] text-gray-500 flex items-center gap-1">
                          <ShoppingBag className="w-3 h-3" />
                          {cat.product_count} productos
                        </span>
                        <span className="text-[11px] text-gray-500">
                          Orden: {cat.sort_order}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
                    <div className="flex items-center gap-1">
                      <motion.button
                        onClick={() => handleMoveUp(index)}
                        disabled={index === 0 || reorderingId === cat.id}
                        className="p-1.5 rounded-md text-gray-500 hover:text-violet-400 hover:bg-violet-500/10 transition-colors disabled:opacity-30"
                        whileTap={{ scale: 0.9 }}
                      >
                        <ChevronUp className="w-4 h-4" />
                      </motion.button>
                      <motion.button
                        onClick={() => handleMoveDown(index)}
                        disabled={index === filtered.length - 1 || reorderingId === cat.id}
                        className="p-1.5 rounded-md text-gray-500 hover:text-violet-400 hover:bg-violet-500/10 transition-colors disabled:opacity-30"
                        whileTap={{ scale: 0.9 }}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </motion.button>
                    </div>
                    <div className="flex items-center gap-1">
                      <motion.button
                        onClick={() => openEditModal(cat)}
                        className="p-2 rounded-lg text-gray-400 hover:text-violet-400 hover:bg-violet-500/10 transition-colors"
                        whileTap={{ scale: 0.9 }}
                      >
                        <Edit className="w-4 h-4" />
                      </motion.button>
                      <motion.button
                        onClick={() => openDeleteModal(cat)}
                        className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        whileTap={{ scale: 0.9 }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════
          CREATE / EDIT MODAL
          ═══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {(modal === 'add' || modal === 'edit') && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={closeModal}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="glass-strong rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-white/10 flex items-center justify-between">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  {modal === 'add' ? (
                    <>
                      <Plus className="w-5 h-5 text-violet-400" />
                      Nueva Categoría
                    </>
                  ) : (
                    <>
                      <Edit className="w-5 h-5 text-violet-400" />
                      Editar Categoría
                    </>
                  )}
                </h2>
                <button
                  onClick={closeModal}
                  className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 space-y-5">
                {/* Name */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    Nombre <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Ej: Farmacia, Comida, Restaurantes"
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-violet-500/50 text-white placeholder:text-gray-600 outline-none text-sm transition-colors"
                  />
                </div>

                {/* Icon */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    Icono (nombre de Lucide React)
                  </label>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600/20 to-purple-600/20 flex items-center justify-center text-violet-400 ring-1 ring-violet-500/20">
                      {renderIcon(form.icon, 'lg')}
                    </div>
                    <div className="flex-1">
                      <input
                        type="text"
                        value={form.icon}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, icon: e.target.value }))
                        }
                        placeholder="Ej: UtensilsCrossed, Coffee, Heart"
                        className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-violet-500/50 text-white placeholder:text-gray-600 outline-none text-sm font-mono transition-colors"
                      />
                    </div>
                  </div>
                  {/* Icon grid picker */}
                  <div className="grid grid-cols-7 gap-1.5">
                    {iconOptions.map((opt) => {
                      const isSelected = form.icon === opt;
                      const Icon = getIcon(opt);
                      return (
                        <motion.button
                          key={opt}
                          type="button"
                          onClick={() => setForm((prev) => ({ ...prev, icon: opt }))}
                          className={`p-2 rounded-lg transition-all flex items-center justify-center ${
                            isSelected
                              ? 'bg-violet-500/20 border border-violet-500/40 text-violet-400'
                              : 'bg-white/5 border border-transparent text-gray-500 hover:bg-white/10 hover:text-gray-300'
                          }`}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          title={opt}
                        >
                          <Icon className="w-4 h-4" />
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {/* Image Upload */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    Imagen de categoría
                  </label>
                  {form.imagePreview ? (
                    <div className="relative rounded-xl overflow-hidden border border-white/10 group">
                      <img
                        src={form.imagePreview}
                        alt="Preview"
                        className="w-full h-40 object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                          onClick={removeImage}
                          className="px-3 py-1.5 rounded-lg bg-red-500/80 text-white text-xs font-medium flex items-center gap-1.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Eliminar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed border-white/10 hover:border-violet-500/30 transition-colors cursor-pointer bg-white/[0.02]">
                      <Upload className="w-6 h-6 text-gray-500" />
                      <span className="text-xs text-gray-400">
                        Haz clic para subir una imagen
                      </span>
                      <span className="text-[10px] text-gray-600">Máximo 5MB</span>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                {/* Sort Order */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    Orden de aparición
                  </label>
                  <input
                    type="number"
                    value={form.sort_order}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        sort_order: parseInt(e.target.value) || 0,
                      }))
                    }
                    min={0}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-violet-500/50 text-white outline-none text-sm transition-colors"
                  />
                  <p className="text-[10px] text-gray-600 mt-1">
                    Menor número = aparece primero
                  </p>
                </div>

                {/* Active Toggle */}
                <div className="flex items-center justify-between bg-white/5 rounded-xl p-4">
                  <div>
                    <p className="text-sm font-medium text-white flex items-center gap-1.5">
                      <Eye className="w-4 h-4 text-emerald-400" />
                      Categoría activa
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Las inactivas no se muestran en el marketplace
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({ ...prev, is_active: !prev.is_active }))
                    }
                    className={`relative w-14 h-7 rounded-full transition-colors duration-300 ${
                      form.is_active ? 'bg-emerald-500' : 'bg-white/10'
                    }`}
                  >
                    <motion.div
                      className="absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md"
                      animate={{
                        left: form.is_active ? 'calc(100% - 26px)' : '2px',
                      }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  </button>
                </div>

                {/* Preview */}
                <div className="bg-white/5 rounded-xl p-4">
                  <p className="text-xs font-medium text-gray-400 mb-3">Vista previa</p>
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-600/20 to-purple-600/20 flex items-center justify-center text-violet-400 ring-1 ring-violet-500/20">
                      {renderIcon(form.icon)}
                    </div>
                    {form.imagePreview && (
                      <div className="w-11 h-11 rounded-lg overflow-hidden ring-1 ring-white/10">
                        <img
                          src={form.imagePreview}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        {form.name || 'Nombre de categoría'}
                      </p>
                      <p className="text-[11px] text-gray-500 font-mono">
                        {form.icon || 'Package'}
                      </p>
                    </div>
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        form.is_active
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-gray-500/15 text-gray-500'
                      }`}
                    >
                      {form.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-5 border-t border-white/10 flex gap-3 justify-end">
                <button
                  onClick={closeModal}
                  className="px-5 py-2.5 rounded-xl bg-white/5 text-gray-400 text-sm font-medium hover:bg-white/10 transition-colors"
                >
                  Cancelar
                </button>
                <motion.button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-500 hover:to-purple-500 shadow-lg shadow-violet-500/20 transition-all disabled:opacity-50"
                  whileHover={{ scale: saving ? 1 : 1.02 }}
                  whileTap={{ scale: saving ? 1 : 0.98 }}
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : modal === 'add' ? (
                    <Plus className="w-4 h-4" />
                  ) : (
                    <Edit className="w-4 h-4" />
                  )}
                  {saving
                    ? 'Guardando...'
                    : modal === 'add'
                      ? 'Crear Categoría'
                      : 'Actualizar'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════
          DELETE CONFIRMATION MODAL
          ═══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {modal === 'delete' && deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={closeModal}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="glass-strong rounded-2xl w-full max-w-md border border-red-500/20"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 text-center">
                {/* Warning icon */}
                <div className="w-14 h-14 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-7 h-7 text-red-400" />
                </div>

                <h2 className="text-lg font-bold text-white mb-2">
                  Eliminar categoría
                </h2>
                <p className="text-sm text-gray-400 mb-1">
                  ¿Estás seguro de eliminar{' '}
                  <span className="text-white font-medium">{deleteTarget.name}</span>?
                </p>

                {/* Warning if products exist */}
                {deleteProductCount > 0 && (
                  <div className="mt-3 mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <div className="flex items-center gap-2 justify-center">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      <p className="text-xs text-amber-400">
                        <span className="font-semibold">{deleteProductCount}</span> producto(s) usan
                        esta categoría. Serán desvinculados.
                      </p>
                    </div>
                  </div>
                )}

                <p className="text-xs text-gray-600 mt-3">
                  Esta acción no se puede deshacer.
                </p>
              </div>

              <div className="px-6 pb-6 flex gap-3">
                <button
                  onClick={closeModal}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 text-gray-400 text-sm font-medium hover:bg-white/10 transition-colors"
                >
                  Cancelar
                </button>
                <motion.button
                  onClick={handleDelete}
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all disabled:opacity-50"
                  whileHover={{ scale: saving ? 1 : 1.02 }}
                  whileTap={{ scale: saving ? 1 : 0.98 }}
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  {saving ? 'Eliminando...' : 'Eliminar'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
