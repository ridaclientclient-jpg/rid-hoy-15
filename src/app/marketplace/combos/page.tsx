'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Tag, Plus, Trash2, Edit3, Package, Percent, Search, X,
  ChevronUp, ChevronDown, Image, Calendar, Check, ToggleLeft,
  ToggleRight, AlertTriangle, Loader2, UploadCloud, Zap, Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase, type ComboWithItems, type Product } from '@/lib/supabase';
import { useVendorId } from '@/hooks/useVendorId';

/* ══════════════════════════════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════════════════════════════ */

function formatCRC(amount: number): string {
  return `₡${Math.round(amount).toLocaleString('es-CR')}`;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ══════════════════════════════════════════════════════════════════
   TYPES
   ══════════════════════════════════════════════════════════════════ */

interface SelectedItem {
  product_id: string;
  product_name: string;
  price: number;
  quantity: number;
  product_image_url?: string;
  category?: string;
  in_stock?: boolean;
}

interface ComboFormData {
  name: string;
  description: string;
  discount_pct: number;
  is_active: boolean;
  starts_at: string;
  ends_at: string;
  items: SelectedItem[];
}

const emptyForm: ComboFormData = {
  name: '',
  description: '',
  discount_pct: 10,
  is_active: true,
  starts_at: '',
  ends_at: '',
  items: [],
};

/* ══════════════════════════════════════════════════════════════════
   ANIMATION VARIANTS
   ══════════════════════════════════════════════════════════════════ */

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  },
};

const modalOverlay = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const modalContent = {
  hidden: { opacity: 0, scale: 0.95, y: 10 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', damping: 25, stiffness: 300 } },
  exit: { opacity: 0, scale: 0.95, y: 10 },
};

/* ══════════════════════════════════════════════════════════════════
   LOADING SKELETON
   ══════════════════════════════════════════════════════════════════ */

function ComboSkeleton() {
  return (
    <div className="glass rounded-2xl overflow-hidden animate-pulse">
      <div className="h-44 bg-gray-50 relative">
        <div className="absolute top-3 right-3 w-16 h-5 bg-gray-50 rounded-full" />
      </div>
      <div className="p-4 space-y-3">
        <div className="h-4 bg-gray-50 rounded w-3/4" />
        <div className="h-3 bg-gray-50 rounded w-full" />
        <div className="h-3 bg-gray-50 rounded w-1/2" />
        <div className="flex items-center gap-3 pt-2">
          <div className="h-5 w-24 bg-gray-50 rounded-lg" />
          <div className="h-5 w-20 bg-gray-50 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════════ */

export default function CombosPage() {
  const { vendorId, loading: vendorLoading } = useVendorId();

  /* ── State ─────────────────────────────────────────────────── */
  const [combos, setCombos] = useState<ComboWithItems[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editingCombo, setEditingCombo] = useState<ComboWithItems | null>(null);
  const [formData, setFormData] = useState<ComboFormData>(emptyForm);
  const [saving, setSaving] = useState(false);

  // Image upload
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Product picker
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [vendorProducts, setVendorProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Delete confirmation
  const [deletingCombo, setDeletingCombo] = useState<ComboWithItems | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Toggle loading
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Image URLs cache (signed URLs)
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  /* ── Load combos ──────────────────────────────────────────── */
  const loadCombos = useCallback(async () => {
    if (!vendorId) return;
    setLoading(true);

    try {
      const { data, error } = await supabase.rpc('get_vendor_combos', {
        p_vendor_id: vendorId,
      });

      if (error) throw error;

      const rows: ComboWithItems[] = (data || []).map((c: Record<string, unknown>) => ({
        id: c.id as string,
        vendor_id: c.vendor_id as string,
        name: c.name as string,
        description: (c.description as string) || undefined,
        discount_pct: Number(c.discount_pct),
        image_url: (c.image_url as string) || undefined,
        is_active: c.is_active as boolean,
        starts_at: (c.starts_at as string) || undefined,
        ends_at: (c.ends_at as string) || undefined,
        created_at: (c.created_at as string) || undefined,
        updated_at: (c.updated_at as string) || undefined,
        items: Array.isArray(c.items)
          ? (c.items as Array<Record<string, unknown>>).map((item) => ({
              combo_item_id: item.combo_item_id as string | undefined,
              quantity: Number(item.quantity),
              product_id: item.product_id as string,
              product_name: item.product_name as string,
              price: Number(item.price),
              product_image_url: (item.product_image_url as string) || undefined,
              in_stock: item.in_stock as boolean | undefined,
              category: (item.category as string) || undefined,
            }))
          : [],
        original_price: c.original_price ? Number(c.original_price) : undefined,
        combo_price: c.combo_price ? Number(c.combo_price) : undefined,
        vendor_name: (c.vendor_name as string) || undefined,
      }));

      setCombos(rows);

      // Load signed URLs for combo images
      const urlMap: Record<string, string> = {};
      for (const row of rows) {
        if (row.image_url) {
          // The image_url from RPC is already a public URL or path; try to get signed URL
          try {
            // Try extracting path from URL if it looks like a storage path
            const pathMatch = row.image_url.match(/\/products\/(.+)/);
            if (pathMatch) {
              const { data: urlData } = await supabase.storage
                .from('products')
                .createSignedUrl(pathMatch[1], 3600);
              if (urlData?.signedUrl) {
                urlMap[row.id] = urlData.signedUrl;
              } else {
                urlMap[row.id] = row.image_url;
              }
            } else {
              urlMap[row.id] = row.image_url;
            }
          } catch {
            urlMap[row.id] = row.image_url;
          }
        }
      }
      setSignedUrls(urlMap);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cargar combos';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  useEffect(() => {
    if (vendorId) {
      loadCombos();
    }
  }, [vendorId, loadCombos]);

  /* ── Load vendor products for picker ──────────────────────── */
  const loadVendorProducts = useCallback(async () => {
    if (!vendorId) return;
    setLoadingProducts(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('name', { ascending: true });

      if (error) throw error;
      setVendorProducts(data || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cargar productos';
      toast.error(msg);
    } finally {
      setLoadingProducts(false);
    }
  }, [vendorId]);

  /* ── Stats ────────────────────────────────────────────────── */
  const stats = useMemo(() => {
    const total = combos.length;
    const active = combos.filter((c) => c.is_active).length;
    const inactive = total - active;
    return { total, active, inactive };
  }, [combos]);

  /* ── Price calculation ────────────────────────────────────── */
  const calculatedPrices = useMemo(() => {
    const original = formData.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    const combo = Math.round(original * (1 - formData.discount_pct / 100));
    const savings = original - combo;
    return { original, combo, savings };
  }, [formData.items, formData.discount_pct]);

  /* ── Filtered products for picker ─────────────────────────── */
  const filteredProducts = useMemo(() => {
    let result = [...vendorProducts];
    if (productSearch.trim()) {
      const q = productSearch.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.category && p.category.toLowerCase().includes(q))
      );
    }
    return result;
  }, [vendorProducts, productSearch]);

  /* ── Image upload ─────────────────────────────────────────── */
  const handleImageSelect = useCallback((file: File) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Solo se aceptan JPG, PNG y WebP');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagen máximo 5MB');
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleImageSelect(file);
    },
    [handleImageSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dropZoneRef.current?.classList.add('border-cyan-500/50', 'bg-green-50');
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dropZoneRef.current?.classList.remove('border-cyan-500/50', 'bg-green-50');
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dropZoneRef.current?.classList.remove('border-cyan-500/50', 'bg-green-50');
      const file = e.dataTransfer.files?.[0];
      if (file) handleImageSelect(file);
    },
    [handleImageSelect]
  );

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /* ── CRUD Operations ──────────────────────────────────────── */

  const openAddModal = async () => {
    setEditingCombo(null);
    setFormData({ ...emptyForm });
    setImageFile(null);
    setImagePreview(null);
    setShowModal(true);
    // Pre-load products for picker
    if (vendorProducts.length === 0) {
      await loadVendorProducts();
    }
  };

  const openEditModal = async (combo: ComboWithItems) => {
    setEditingCombo(combo);
    setFormData({
      name: combo.name,
      description: combo.description || '',
      discount_pct: combo.discount_pct,
      is_active: combo.is_active,
      starts_at: combo.starts_at ? combo.starts_at.slice(0, 16) : '',
      ends_at: combo.ends_at ? combo.ends_at.slice(0, 16) : '',
      items: (combo.items || []).map((item) => ({
        product_id: item.product_id,
        product_name: item.product_name,
        price: item.price,
        quantity: item.quantity,
        product_image_url: item.product_image_url,
        category: item.category,
        in_stock: item.in_stock,
      })),
    });
    setImageFile(null);
    setImagePreview(signedUrls[combo.id] || combo.image_url || null);
    setShowModal(true);
    // Pre-load products for picker
    if (vendorProducts.length === 0) {
      await loadVendorProducts();
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }
    if (formData.items.length === 0) {
      toast.error('Agrega al menos un producto al combo');
      return;
    }
    if (formData.discount_pct < 1 || formData.discount_pct > 90) {
      toast.error('El descuento debe ser entre 1% y 90%');
      return;
    }

    setSaving(true);

    try {
      if (editingCombo) {
        // ── UPDATE ──
        const updates: Record<string, unknown> = {
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          discount_pct: formData.discount_pct,
          is_active: formData.is_active,
          starts_at: formData.starts_at || null,
          ends_at: formData.ends_at || null,
          updated_at: new Date().toISOString(),
        };

        // Upload image if new file selected
        if (imageFile) {
          setUploadingImage(true);
          const ext = imageFile.name.split('.').pop()?.toLowerCase() || 'jpg';
          const imagePath = `products/${vendorId}/combo_${editingCombo.id}.${ext}`;

          const { error: uploadErr } = await supabase.storage
            .from('products')
            .upload(imagePath, imageFile, { upsert: true, contentType: imageFile.type });

          if (uploadErr) {
            console.error('Image upload error:', uploadErr);
          } else {
            const { data: urlData } = await supabase.storage
              .from('products')
              .createSignedUrl(imagePath, 3600);
            if (urlData?.signedUrl) {
              updates.image_url = urlData.signedUrl;
            }
          }
          setUploadingImage(false);
        } else if (imagePreview === null) {
          // User explicitly removed the image
          updates.image_url = null;
        }

        const { error } = await supabase
          .from('product_combos')
          .update(updates)
          .eq('id', editingCombo.id);

        if (error) throw error;

        // Delete old combo items
        const { error: deleteItemsErr } = await supabase
          .from('combo_items')
          .delete()
          .eq('combo_id', editingCombo.id);

        if (deleteItemsErr) throw deleteItemsErr;

        // Insert new combo items
        if (formData.items.length > 0) {
          const newItems = formData.items.map((item) => ({
            combo_id: editingCombo.id,
            product_id: item.product_id,
            quantity: item.quantity,
          }));

          const { error: insertItemsErr } = await supabase
            .from('combo_items')
            .insert(newItems);

          if (insertItemsErr) throw insertItemsErr;
        }

        toast.success('Combo actualizado correctamente');
      } else {
        // ── CREATE ──
        const { data: newCombo, error } = await supabase
          .from('product_combos')
          .insert({
            vendor_id: vendorId,
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            discount_pct: formData.discount_pct,
            is_active: formData.is_active,
            starts_at: formData.starts_at || null,
            ends_at: formData.ends_at || null,
          })
          .select()
          .single();

        if (error) throw error;

        // Upload image
        if (imageFile) {
          setUploadingImage(true);
          const ext = imageFile.name.split('.').pop()?.toLowerCase() || 'jpg';
          const imagePath = `products/${vendorId}/combo_${newCombo.id}.${ext}`;

          const { error: uploadErr } = await supabase.storage
            .from('products')
            .upload(imagePath, imageFile, { upsert: true, contentType: imageFile.type });

          if (!uploadErr) {
            const { data: urlData } = await supabase.storage
              .from('products')
              .createSignedUrl(imagePath, 3600);
            if (urlData?.signedUrl) {
              await supabase
                .from('product_combos')
                .update({ image_url: urlData.signedUrl })
                .eq('id', newCombo.id);
            }
          }
          setUploadingImage(false);
        }

        // Insert combo items
        if (formData.items.length > 0) {
          const newItems = formData.items.map((item) => ({
            combo_id: newCombo.id,
            product_id: item.product_id,
            quantity: item.quantity,
          }));

          const { error: insertItemsErr } = await supabase
            .from('combo_items')
            .insert(newItems);

          if (insertItemsErr) throw insertItemsErr;
        }

        toast.success('Combo creado correctamente');
      }

      setShowModal(false);
      loadCombos();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar combo';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (combo: ComboWithItems) => {
    const newVal = !combo.is_active;
    setTogglingId(combo.id);
    try {
      const { error } = await supabase
        .from('product_combos')
        .update({ is_active: newVal, updated_at: new Date().toISOString() })
        .eq('id', combo.id);

      if (error) throw error;

      setCombos((prev) =>
        prev.map((c) => (c.id === combo.id ? { ...c, is_active: newVal } : c))
      );
      toast.success(newVal ? 'Combo activado' : 'Combo desactivado');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al actualizar combo';
      toast.error(msg);
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deletingCombo) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('product_combos')
        .delete()
        .eq('id', deletingCombo.id);

      if (error) throw error;

      setCombos((prev) => prev.filter((c) => c.id !== deletingCombo.id));
      setSignedUrls((prev) => {
        const next = { ...prev };
        delete next[deletingCombo.id];
        return next;
      });
      toast.success(`"${deletingCombo.name}" eliminado`);
      setDeletingCombo(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al eliminar combo';
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  /* ── Item management helpers ──────────────────────────────── */

  const addItemToCombo = (product: Product) => {
    const exists = formData.items.find((i) => i.product_id === product.id);
    if (exists) {
      toast.warning('Este producto ya está en el combo');
      return;
    }
    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          product_id: product.id,
          product_name: product.name,
          price: Number(product.discount_price && product.discount_price > 0 ? product.discount_price : product.price),
          quantity: 1,
          product_image_url: product.image_url || undefined,
          category: product.category,
          in_stock: product.in_stock,
        },
      ],
    }));
    setShowProductPicker(false);
    toast.success(`${product.name} agregado al combo`);
  };

  const removeItemFromCombo = (productId: string) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((i) => i.product_id !== productId),
    }));
  };

  const updateItemQuantity = (productId: string, newQty: number) => {
    if (newQty < 1 || newQty > 10) return;
    setFormData((prev) => ({
      ...prev,
      items: prev.items.map((i) =>
        i.product_id === productId ? { ...i, quantity: newQty } : i
      ),
    }));
  };

  /* ══════════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════════ */

  if (vendorLoading || loading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-48 bg-gray-50 rounded-lg animate-pulse" />
            <div className="h-4 w-32 bg-gray-50 rounded-lg animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 animate-pulse">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass rounded-xl p-4">
              <div className="h-4 w-20 bg-gray-50 rounded" />
              <div className="h-6 w-12 bg-gray-50 rounded mt-2" />
            </div>
          ))}
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <ComboSkeleton key={i} />
          ))}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* ─── Header ──────────────────────────────────────── */}
      <motion.div
        variants={itemVariants}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg">
            <Tag className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
              Combos
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Crea ofertas con descuento combinando productos
            </p>
          </div>
        </div>
        <motion.button
          type="button"
          onClick={openAddModal}
          className="btn-neon text-white px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 self-start"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
        >
          <Plus className="w-4 h-4" />
          Crear Combo
        </motion.button>
      </motion.div>

      {/* ─── Stats Bar ───────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total Combos', value: stats.total.toString(), gradient: 'from-cyan-500 to-blue-600', icon: Tag },
            { label: 'Activos', value: stats.active.toString(), gradient: 'from-emerald-500 to-green-500', icon: ToggleRight },
            { label: 'Inactivos', value: stats.inactive.toString(), gradient: 'from-gray-500 to-gray-600', icon: ToggleLeft },
          ].map((stat) => (
            <div
              key={stat.label}
              className="glass rounded-xl p-4 group hover:glow-cyan transition-all duration-300"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${stat.gradient} flex items-center justify-center`}>
                  <stat.icon className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-[11px] text-gray-400 font-medium">{stat.label}</span>
              </div>
              <p className="text-xl font-bold text-gray-900">{stat.value}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ─── Combos Grid ─────────────────────────────────── */}
      {combos.length === 0 ? (
        <motion.div variants={itemVariants} className="glass rounded-2xl p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8 text-gray-300" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Sin combos</h3>
          <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto">
            Crea tu primer combo para ofrecer descuentos atractivos combinando tus productos.
          </p>
          <motion.button
            type="button"
            onClick={openAddModal}
            className="btn-neon text-white px-6 py-2.5 rounded-xl text-sm font-medium inline-flex items-center gap-2"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <Plus className="w-4 h-4" />
            Crear Combo
          </motion.button>
        </motion.div>
      ) : (
        <motion.div variants={itemVariants} className="grid sm:grid-cols-2 gap-4">
          {combos.map((combo) => {
            const comboImageUrl = signedUrls[combo.id] || combo.image_url;
            const originalPrice = combo.original_price || (combo.items || []).reduce((s, i) => s + i.price * i.quantity, 0);
            const comboPrice = combo.combo_price || Math.round(originalPrice * (1 - combo.discount_pct / 100));
            const hasTimeLimit = combo.starts_at || combo.ends_at;

            return (
              <div
                key={combo.id}
                className="glass rounded-2xl overflow-hidden group hover:glow-cyan transition-all duration-300"
              >
                {/* Image */}
                <div className="h-44 relative overflow-hidden">
                  {comboImageUrl ? (
                    <img
                      src={comboImageUrl}
                      alt={combo.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-cyan-900/30 via-blue-900/20 to-purple-900/30 flex items-center justify-center">
                      <Package className="w-12 h-12 text-white/10" />
                    </div>
                  )}
                  {/* Overlay gradient */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                  {/* Discount Badge */}
                  <div className="absolute top-3 right-3">
                    <div className="bg-emerald-500/90 backdrop-blur-sm text-white px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1">
                      <Percent className="w-3 h-3" />
                      {combo.discount_pct}% OFF
                    </div>
                  </div>

                  {/* Active Badge */}
                  <div className="absolute top-3 left-3">
                    <div className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 backdrop-blur-sm ${
                      combo.is_active
                        ? 'bg-emerald-500/20 text-emerald-600 border border-emerald-200'
                        : 'bg-gray-500/20 text-gray-500 border border-gray-500/30'
                    }`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${combo.is_active ? 'bg-emerald-400' : 'bg-gray-500'}`} />
                      {combo.is_active ? 'Activo' : 'Inactivo'}
                    </div>
                  </div>

                  {/* Time limit indicator */}
                  {hasTimeLimit && (
                    <div className="absolute bottom-3 left-3">
                      <div className="bg-amber-500/20 text-amber-600 px-2 py-0.5 rounded-md text-[10px] font-medium flex items-center gap-1 backdrop-blur-sm">
                        <Clock className="w-3 h-3" />
                        Temporal
                      </div>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-4 space-y-3">
                  <div>
                    <h3 className="text-gray-900 font-semibold text-base truncate">{combo.name}</h3>
                    {combo.description && (
                      <p className="text-gray-500 text-xs mt-1 line-clamp-2">{combo.description}</p>
                    )}
                  </div>

                  {/* Items list */}
                  {(combo.items && combo.items.length > 0) && (
                    <div className="space-y-1.5">
                      {combo.items.slice(0, 4).map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs">
                          <span className="text-gray-400">•</span>
                          <span className="text-gray-600 flex-1 truncate">{item.product_name}</span>
                          <span className="text-gray-400 font-medium">x{item.quantity}</span>
                        </div>
                      ))}
                      {combo.items.length > 4 && (
                        <p className="text-[11px] text-green-600">
                          +{combo.items.length - 4} producto{combo.items.length - 4 !== 1 ? 's' : ''} más
                        </p>
                      )}
                    </div>
                  )}

                  {/* Prices */}
                  <div className="flex items-baseline gap-2.5 pt-1">
                    {originalPrice > comboPrice && (
                      <span className="text-gray-400 text-sm line-through">
                        {formatCRC(originalPrice)}
                      </span>
                    )}
                    <span className="text-gray-900 font-bold text-lg">
                      {formatCRC(comboPrice)}
                    </span>
                    {originalPrice > comboPrice && (
                      <span className="text-emerald-600 text-[11px] font-medium">
                        Ahorras {formatCRC(originalPrice - comboPrice)}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                    {/* Toggle */}
                    <button
                      type="button"
                      onClick={() => handleToggleActive(combo)}
                      disabled={togglingId === combo.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border disabled:opacity-50"
                    >
                      {togglingId === combo.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-500" />
                      ) : combo.is_active ? (
                        <>
                          <ToggleRight className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-600">Activo</span>
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="w-3.5 h-3.5 text-gray-500" />
                          <span className="text-gray-500">Inactivo</span>
                        </>
                      )}
                    </button>

                    <div className="flex-1" />

                    <button
                      type="button"
                      onClick={() => openEditModal(combo)}
                      className="p-1.5 rounded-lg text-gray-500 hover:text-green-600 hover:bg-gray-50 transition-all"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingCombo(combo)}
                      className="p-1.5 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════════════════
          CREATE / EDIT MODAL
          ═══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto"
            variants={modalOverlay}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setShowModal(false)}
            />

            {/* Modal */}
            <motion.div
              className="relative w-full max-w-lg bg-[#0d1117] border border-gray-200 rounded-2xl shadow-2xl my-8"
              variants={modalContent}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                    <Tag className="w-4 h-4 text-white" />
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {editingCombo ? 'Editar Combo' : 'Nuevo Combo'}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
                {/* Name */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">
                    Nombre del combo <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Ej: Combo Familiar"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-green-500/50 transition-colors"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">
                    Descripción
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe tu combo..."
                    rows={2}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-green-500/50 transition-colors resize-none"
                  />
                </div>

                {/* Discount */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">
                    Descuento <span className="text-red-600">*</span>
                  </label>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="relative">
                        <input
                          type="number"
                          value={formData.discount_pct}
                          onChange={(e) => {
                            let val = parseInt(e.target.value) || 0;
                            val = Math.min(90, Math.max(1, val));
                            setFormData((prev) => ({ ...prev, discount_pct: val }));
                          }}
                          min={1}
                          max={90}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-green-500/50 transition-colors pr-10"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <input
                        type="range"
                        min={1}
                        max={90}
                        value={formData.discount_pct}
                        onChange={(e) => setFormData((prev) => ({ ...prev, discount_pct: parseInt(e.target.value) }))}
                        className="w-full h-2 bg-gray-100 rounded-full appearance-none cursor-pointer accent-cyan-500"
                        style={{
                          background: `linear-gradient(to right, #06b6d4 0%, #2563eb ${formData.discount_pct}%, rgba(255,255,255,0.1) ${formData.discount_pct}%, rgba(255,255,255,0.1) 100%)`,
                        }}
                      />
                      <div className="flex justify-between text-[10px] text-gray-300 mt-1">
                        <span>1%</span>
                        <span>90%</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 mt-2">
                    <Percent className="w-3 h-3 text-green-600" />
                    <span className="text-green-600 text-xs font-medium">{formData.discount_pct}% de descuento</span>
                  </div>
                </div>

                {/* Image Upload */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">
                    Imagen del combo
                  </label>
                  {imagePreview ? (
                    <div className="relative rounded-xl overflow-hidden border border-gray-200">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-40 object-cover"
                      />
                      <button
                        type="button"
                        onClick={clearImage}
                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-white hover:bg-red-500/80 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div
                      ref={dropZoneRef}
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-green-200 hover:bg-green-50 transition-all"
                    >
                      <UploadCloud className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-xs text-gray-500">
                        Arrastra o haz clic para subir imagen
                      </p>
                      <p className="text-[10px] text-gray-300 mt-1">
                        JPG, PNG, WebP • Máximo 5MB
                      </p>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileInput}
                    className="hidden"
                  />
                </div>

                {/* Products selection */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-medium text-gray-500">
                      Productos <span className="text-red-600">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowProductPicker(true);
                        setProductSearch('');
                        if (vendorProducts.length === 0) {
                          loadVendorProducts();
                        }
                      }}
                      className="flex items-center gap-1.5 text-xs text-green-600 hover:text-green-700 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Agregar producto
                    </button>
                  </div>

                  {formData.items.length === 0 ? (
                    <div className="border border-dashed border-gray-200 rounded-xl p-4 text-center">
                      <Package className="w-6 h-6 text-gray-300 mx-auto mb-1.5" />
                      <p className="text-xs text-gray-400">No hay productos en el combo</p>
                      <p className="text-[10px] text-gray-300 mt-0.5">
                        Haz clic en &quot;Agregar producto&quot; para empezar
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {formData.items.map((item) => (
                        <div
                          key={item.product_id}
                          className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100"
                        >
                          {/* Product mini image or placeholder */}
                          <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {item.product_image_url ? (
                              <img
                                src={item.product_image_url}
                                alt={item.product_name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Package className="w-4 h-4 text-gray-300" />
                            )}
                          </div>
                          {/* Product info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-900 font-medium truncate">{item.product_name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-gray-400">{item.category || 'Sin categoría'}</span>
                              <span className="text-[10px] text-green-600">{formatCRC(item.price)}</span>
                            </div>
                          </div>
                          {/* Quantity controls */}
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => updateItemQuantity(item.product_id, item.quantity - 1)}
                              disabled={item.quantity <= 1}
                              className="w-6 h-6 rounded-md bg-gray-50 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-xs text-gray-900 font-medium w-6 text-center">{item.quantity}</span>
                            <button
                              type="button"
                              onClick={() => updateItemQuantity(item.product_id, item.quantity + 1)}
                              disabled={item.quantity >= 10}
                              className="w-6 h-6 rounded-md bg-gray-50 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {/* Remove */}
                          <button
                            type="button"
                            onClick={() => removeItemFromCombo(item.product_id)}
                            className="p-1 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all flex-shrink-0"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Price Summary */}
                {formData.items.length > 0 && (
                  <div className="bg-gradient-to-r from-cyan-500/5 to-blue-500/5 border border-green-200 rounded-xl p-4 space-y-2">
                    <div className="flex items-center gap-2 mb-3">
                      <Zap className="w-4 h-4 text-green-600" />
                      <span className="text-xs font-medium text-green-600">Resumen de precios</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Precio original</span>
                      <span className={calculatedPrices.savings > 0 ? 'text-gray-400 line-through' : 'text-gray-900'}>
                        {formatCRC(calculatedPrices.original)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Descuento ({formData.discount_pct}%)</span>
                      <span className="text-emerald-600">
                        -{formatCRC(calculatedPrices.savings)}
                      </span>
                    </div>
                    <div className="border-t border-gray-200 pt-2 mt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900">Precio combo</span>
                        <span className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                          {formatCRC(calculatedPrices.combo)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Dates */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="flex items-center gap-1.5 block text-xs font-medium text-gray-500 mb-1.5">
                      <Calendar className="w-3 h-3" />
                      Fecha inicio
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.starts_at}
                      onChange={(e) => setFormData((prev) => ({ ...prev, starts_at: e.target.value }))}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-green-500/50 transition-colors [color-scheme:dark]"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 block text-xs font-medium text-gray-500 mb-1.5">
                      <Calendar className="w-3 h-3" />
                      Fecha fin
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.ends_at}
                      onChange={(e) => setFormData((prev) => ({ ...prev, ends_at: e.target.value }))}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-green-500/50 transition-colors [color-scheme:dark]"
                    />
                  </div>
                </div>
                {(!formData.starts_at || !formData.ends_at) && (
                  <p className="text-[10px] text-gray-300 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Dejar vacío para combo permanente
                  </p>
                )}

                {/* Active Toggle */}
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm text-gray-900 font-medium">Estado</p>
                    <p className="text-[11px] text-gray-400">Los combos inactivos no son visibles</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, is_active: !prev.is_active }))}
                    className="flex items-center"
                  >
                    {formData.is_active ? (
                      <ToggleRight className="w-10 h-10 text-emerald-600" />
                    ) : (
                      <ToggleLeft className="w-10 h-10 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center gap-3 p-5 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-all"
                >
                  Cancelar
                </button>
                <motion.button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || uploadingImage}
                  className="flex-1 btn-neon text-white px-4 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {saving || uploadingImage ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      {editingCombo ? 'Actualizar' : 'Crear Combo'}
                    </>
                  )}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════
          PRODUCT PICKER MODAL
          ═══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showProductPicker && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            variants={modalOverlay}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setShowProductPicker(false)}
            />

            {/* Picker Modal */}
            <motion.div
              className="relative w-full max-w-md bg-[#0d1117] border border-gray-200 rounded-2xl shadow-2xl max-h-[80vh] flex flex-col"
              variants={modalContent}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
                <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <Search className="w-4 h-4 text-green-600" />
                  Agregar Producto
                </h3>
                <button
                  type="button"
                  onClick={() => setShowProductPicker(false)}
                  className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Search */}
              <div className="p-4 border-b border-gray-100 flex-shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Buscar producto por nombre o categoría..."
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-green-500/50 transition-colors"
                    autoFocus
                  />
                  {productSearch && (
                    <button
                      type="button"
                      onClick={() => setProductSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-900 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Product List */}
              <div className="flex-1 overflow-y-auto p-2">
                {loadingProducts ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 text-green-600 animate-spin" />
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">
                      {vendorProducts.length === 0
                        ? 'No tienes productos. Crea productos primero.'
                        : 'No se encontraron productos'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredProducts.map((product) => {
                      const isAlreadyAdded = formData.items.some((i) => i.product_id === product.id);
                      const effectivePrice = Number(
                        product.discount_price && product.discount_price > 0
                          ? product.discount_price
                          : product.price
                      );

                      return (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => !isAlreadyAdded && addItemToCombo(product)}
                          disabled={isAlreadyAdded}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
                            isAlreadyAdded
                              ? 'bg-white/3 opacity-50 cursor-not-allowed'
                              : 'hover:bg-gray-50 cursor-pointer'
                          }`}
                        >
                          {/* Product image */}
                          <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {product.image_url ? (
                              <img
                                src={product.image_url}
                                alt={product.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Package className="w-4 h-4 text-gray-300" />
                            )}
                          </div>
                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-900 font-medium truncate">{product.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-gray-400">{product.category || 'Sin categoría'}</span>
                              <span className="text-xs text-green-600 font-medium">{formatCRC(effectivePrice)}</span>
                            </div>
                          </div>
                          {/* Status */}
                          {isAlreadyAdded ? (
                            <div className="flex items-center gap-1 text-xs text-amber-600 flex-shrink-0">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>Agregado</span>
                            </div>
                          ) : (
                            <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                              <Plus className="w-4 h-4 text-green-600" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════
          DELETE CONFIRMATION MODAL
          ═══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {deletingCombo && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            variants={modalOverlay}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <motion.div
              className="fixed inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => !deleting && setDeletingCombo(null)}
            />
            <motion.div
              className="relative w-full max-w-sm bg-[#0d1117] border border-gray-200 rounded-2xl shadow-2xl p-6"
              variants={modalContent}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-7 h-7 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Eliminar Combo</h3>
                <p className="text-sm text-gray-500 mb-6">
                  ¿Estás seguro de eliminar &quot;<span className="text-gray-900 font-medium">{deletingCombo.name}</span>&quot;?
                  Esta acción no se puede deshacer.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setDeletingCombo(null)}
                    disabled={deleting}
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-all"
                  >
                    Cancelar
                  </button>
                  <motion.button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    whileTap={{ scale: 0.98 }}
                  >
                    {deleting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    Eliminar
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
