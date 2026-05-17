'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Percent, Package, Megaphone, Plus, X, Loader2, Trash2,
  Edit3, ToggleLeft, ToggleRight, Calendar, Tag, DollarSign,
  ImageIcon, ChevronDown, AlertTriangle, Search, UploadCloud,
  Clock, Gift, Zap, PartyPopper, Truck, Sparkles, Layers,
  Check, Eye
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useVendorId } from '@/hooks/useVendorId';

/* ══════════════════════════════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════════════════════════════ */

function formatCRC(amount: number): string {
  return `₡${Math.round(amount).toLocaleString('es-CR')}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Sin límite';
  return new Date(dateStr).toLocaleDateString('es-CR', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

const PROMO_TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  bogo: { label: '2x1', icon: Gift, color: 'bg-violet-500/20 text-violet-400 border-violet-500/30' },
  flash_sale: { label: 'Flash Sale', icon: Zap, color: 'bg-red-500/20 text-red-600 border-red-500/30' },
  happy_hour: { label: 'Happy Hour', icon: PartyPopper, color: 'bg-amber-500/20 text-amber-600 border-amber-200' },
  seasonal: { label: 'Temporada', icon: Sparkles, color: 'bg-emerald-500/20 text-emerald-600 border-emerald-200' },
  free_delivery: { label: 'Envío Gratis', icon: Truck, color: 'bg-green-50 text-green-600 border-green-200' },
  general: { label: 'General', icon: Megaphone, color: 'bg-sky-500/20 text-sky-400 border-sky-500/30' },
};

/* ══════════════════════════════════════════════════════════════════
   TYPES
   ══════════════════════════════════════════════════════════════════ */

type MainTab = 'discounts' | 'combos' | 'promotions';
type PromoType = 'bogo' | 'flash_sale' | 'happy_hour' | 'seasonal' | 'free_delivery' | 'general';

interface VendorProduct {
  id: string;
  name: string;
  price: number;
  category: string;
  image_url: string | null;
}

interface DiscountRow {
  id: string;
  product_id: string;
  product_name: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_quantity: number | null;
  max_uses: number | null;
  uses_count: number;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
}

interface ComboItemRow {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
}

interface ComboRow {
  id: string;
  name: string;
  description: string | null;
  original_price: number;
  combo_price: number;
  image_url: string | null;
  items: ComboItemRow[];
  is_active: boolean;
  created_at: string;
}

interface PromotionRow {
  id: string;
  name: string;
  description: string | null;
  promo_type: PromoType;
  discount_pct: number;
  banner_url: string | null;
  start_date: string | null;
  end_date: string | null;
  applicable_categories: string[] | null;
  is_active: boolean;
  created_at: string;
}

/* ══════════════════════════════════════════════════════════════════
   ANIMATION VARIANTS
   ══════════════════════════════════════════════════════════════════ */

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04, delayChildren: 0.05 } },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
} as const;

/* ══════════════════════════════════════════════════════════════════
   LOADING SKELETON
   ══════════════════════════════════════════════════════════════════ */

function ListSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="glass rounded-2xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gray-50 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-50 rounded w-2/3" />
            <div className="h-3 bg-gray-50 rounded w-1/2" />
          </div>
          <div className="h-8 w-20 bg-gray-50 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   DELETE CONFIRMATION MODAL
   ══════════════════════════════════════════════════════════════════ */

function DeleteModal({
  title, message, onConfirm, onCancel, loading,
}: {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <motion.div
        className="relative w-full max-w-sm glass-strong rounded-2xl z-10 p-6"
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <h3 className="text-base font-bold text-gray-900">{title}</h3>
        </div>
        <p className="text-sm text-gray-500 mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm text-gray-500 bg-gray-50 hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-red-500/20 text-red-600 border border-red-500/30 hover:bg-red-500/30 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Eliminar
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════════ */

export default function OffersPage() {
  const { vendorId, loading: vendorLoading } = useVendorId();

  /* ── Shared State ─────────────────────────────────────────── */
  const [activeTab, setActiveTab] = useState<MainTab>('discounts');
  const [vendorProducts, setVendorProducts] = useState<VendorProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);

  /* ── Discounts ───────────────────────────────────────────── */
  const [discounts, setDiscounts] = useState<DiscountRow[]>([]);
  const [discountsLoading, setDiscountsLoading] = useState(true);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<DiscountRow | null>(null);
  const [discountForm, setDiscountForm] = useState({
    product_id: '',
    discount_type: 'percentage' as 'percentage' | 'fixed',
    discount_value: '',
    min_quantity: '',
    max_uses: '',
    start_date: '',
    end_date: '',
  });
  const [discountSaving, setDiscountSaving] = useState(false);
  const [deletingDiscount, setDeletingDiscount] = useState<DiscountRow | null>(null);
  const [discountDeleting, setDiscountDeleting] = useState(false);

  /* ── Combos ──────────────────────────────────────────────── */
  const [combos, setCombos] = useState<ComboRow[]>([]);
  const [combosLoading, setCombosLoading] = useState(true);
  const [showComboModal, setShowComboModal] = useState(false);
  const [editingCombo, setEditingCombo] = useState<ComboRow | null>(null);
  const [comboForm, setComboForm] = useState({
    name: '',
    description: '',
    combo_price: '',
    image_url: '',
  });
  const [comboItems, setComboItems] = useState<{ product_id: string; quantity: number }[]>([]);
  const [comboSaving, setComboSaving] = useState(false);
  const [comboUploading, setComboUploading] = useState(false);
  const [comboImageFile, setComboImageFile] = useState<File | null>(null);
  const [comboImagePreview, setComboImagePreview] = useState<string | null>(null);
  const comboFileRef = useRef<HTMLInputElement>(null);
  const [deletingCombo, setDeletingCombo] = useState<ComboRow | null>(null);
  const [comboDeleting, setComboDeleting] = useState(false);

  /* ── Promotions ──────────────────────────────────────────── */
  const [promotions, setPromotions] = useState<PromotionRow[]>([]);
  const [promosLoading, setPromosLoading] = useState(true);
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [editingPromo, setEditingPromo] = useState<PromotionRow | null>(null);
  const [promoForm, setPromoForm] = useState({
    name: '',
    description: '',
    promo_type: 'general' as PromoType,
    discount_pct: '',
    start_date: '',
    end_date: '',
    applicable_categories: '' as string,
  });
  const [promoSaving, setPromoSaving] = useState(false);
  const [promoUploading, setPromoUploading] = useState(false);
  const [promoImageFile, setPromoImageFile] = useState<File | null>(null);
  const [promoImagePreview, setPromoImagePreview] = useState<string | null>(null);
  const promoFileRef = useRef<HTMLInputElement>(null);
  const [deletingPromo, setDeletingPromo] = useState<PromotionRow | null>(null);
  const [promoDeleting, setPromoDeleting] = useState(false);

  /* ═══════════════════════════════════════════════════════════════
     LOAD VENDOR PRODUCTS (for product selectors)
     ═══════════════════════════════════════════════════════════════ */
  const loadVendorProducts = useCallback(async () => {
    if (!vendorId) return;
    setProductsLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_vendor_products', { p_vendor_id: vendorId });
      if (error) { console.error('[loadVendorProducts]', error); return; }
      const rows: VendorProduct[] = (data || []).map((p: Record<string, unknown>) => ({
        id: p.id as string,
        name: p.name as string,
        price: Number(p.price),
        category: (p.category as string) || 'General',
        image_url: (p.image_url as string) || null,
      }));
      setVendorProducts(rows);
    } catch {
      // non-critical
    } finally {
      setProductsLoading(false);
    }
  }, [vendorId]);

  /* ═══════════════════════════════════════════════════════════════
     LOAD DISCOUNTS
     ═══════════════════════════════════════════════════════════════ */
  const loadDiscounts = useCallback(async () => {
    if (!vendorId) return;
    setDiscountsLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_vendor_discounts', { p_vendor_id: vendorId });
      if (error) { console.error('[loadDiscounts]', JSON.stringify(error, null, 2)); setDiscounts([]); return; }
      const rows: DiscountRow[] = (data || []).map((d: Record<string, unknown>) => ({
        id: d.id as string,
        product_id: d.product_id as string,
        product_name: (d.product_name as string) || 'Producto',
        discount_type: (d.discount_type as 'percentage' | 'fixed') || 'percentage',
        discount_value: Number(d.discount_value) || 0,
        min_quantity: (d.min_quantity as number) ?? null,
        max_uses: (d.max_uses as number) ?? null,
        uses_count: (d.uses_count as number) ?? 0,
        start_date: (d.start_date as string) || null,
        end_date: (d.end_date as string) || null,
        is_active: d.is_active as boolean,
        created_at: d.created_at as string,
      }));
      setDiscounts(rows);
    } catch {
      setDiscounts([]);
    } finally {
      setDiscountsLoading(false);
    }
  }, [vendorId]);

  /* ═══════════════════════════════════════════════════════════════
     LOAD COMBOS
     ═══════════════════════════════════════════════════════════════ */
  const loadCombos = useCallback(async () => {
    if (!vendorId) return;
    setCombosLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_vendor_combos', { p_vendor_id: vendorId });
      if (error) { console.error('[loadCombos]', JSON.stringify(error, null, 2)); setCombos([]); return; }
      const rows: ComboRow[] = (data || []).map((c: Record<string, unknown>) => ({
        id: c.id as string,
        name: c.name as string,
        description: (c.description as string) || null,
        original_price: Number(c.original_price) || 0,
        combo_price: Number(c.combo_price) || 0,
        image_url: (c.image_url as string) || null,
        items: (c.items as ComboItemRow[]) || [],
        is_active: c.is_active as boolean,
        created_at: c.created_at as string,
      }));
      setCombos(rows);
    } catch {
      setCombos([]);
    } finally {
      setCombosLoading(false);
    }
  }, [vendorId]);

  /* ═══════════════════════════════════════════════════════════════
     LOAD PROMOTIONS
     ═══════════════════════════════════════════════════════════════ */
  const loadPromotions = useCallback(async () => {
    if (!vendorId) return;
    setPromosLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_vendor_promotions', { p_vendor_id: vendorId });
      if (error) { console.error('[loadPromotions]', JSON.stringify(error, null, 2)); setPromotions([]); return; }
      const rows: PromotionRow[] = (data || []).map((p: Record<string, unknown>) => ({
        id: p.id as string,
        name: p.name as string,
        description: (p.description as string) || null,
        promo_type: (p.promo_type as PromoType) || 'general',
        discount_pct: Number(p.discount_pct) || 0,
        banner_url: (p.banner_url as string) || null,
        start_date: (p.start_date as string) || null,
        end_date: (p.end_date as string) || null,
        applicable_categories: (p.applicable_categories as string[]) || null,
        is_active: p.is_active as boolean,
        created_at: p.created_at as string,
      }));
      setPromotions(rows);
    } catch {
      setPromotions([]);
    } finally {
      setPromosLoading(false);
    }
  }, [vendorId]);

  /* ── Load all on mount / vendorId change ──────────────── */
  useEffect(() => {
    if (vendorId) {
      loadVendorProducts();
      loadDiscounts();
      loadCombos();
      loadPromotions();
    } else if (!vendorLoading) {
      setDiscountsLoading(false);
      setCombosLoading(false);
      setPromosLoading(false);
      setProductsLoading(false);
    }
  }, [vendorId, vendorLoading, loadVendorProducts, loadDiscounts, loadCombos, loadPromotions]);

  /* ═══════════════════════════════════════════════════════════════
     IMAGE UPLOAD HELPERS
     ═══════════════════════════════════════════════════════════════ */

  const handleImageFile = useCallback((
    file: File,
    setPreview: (v: string | null) => void,
    setFile: (v: File | null) => void,
  ) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Solo JPG, PNG y WebP');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagen máximo 5MB');
      return;
    }
    setFile(file);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  }, []);

  const uploadImage = useCallback(async (
    bucket: string,
    folder: string,
    fileId: string,
    file: File,
    setUploading: (v: boolean) => void,
  ): Promise<string | null> => {
    setUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${folder}/${vendorId}/${fileId}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file, {
        upsert: true,
        contentType: file.type,
      });
      if (error) throw error;
      const { data: urlData } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
      return urlData?.signedUrl || null;
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error subiendo imagen');
      return null;
    } finally {
      setUploading(false);
    }
  }, [vendorId]);

  /* ═══════════════════════════════════════════════════════════════
     DISCOUNTS CRUD
     ═══════════════════════════════════════════════════════════════ */

  const openDiscountModal = (discount?: DiscountRow) => {
    if (discount) {
      setEditingDiscount(discount);
      setDiscountForm({
        product_id: discount.product_id,
        discount_type: discount.discount_type,
        discount_value: discount.discount_value.toString(),
        min_quantity: discount.min_quantity?.toString() || '',
        max_uses: discount.max_uses?.toString() || '',
        start_date: discount.start_date ? discount.start_date.slice(0, 10) : '',
        end_date: discount.end_date ? discount.end_date.slice(0, 10) : '',
      });
    } else {
      setEditingDiscount(null);
      setDiscountForm({
        product_id: '',
        discount_type: 'percentage',
        discount_value: '',
        min_quantity: '',
        max_uses: '',
        start_date: '',
        end_date: '',
      });
    }
    setShowDiscountModal(true);
  };

  const handleSaveDiscount = async () => {
    if (!vendorId) return;
    if (!discountForm.product_id) { toast.error('Selecciona un producto'); return; }
    const val = Number(discountForm.discount_value);
    if (!val || val <= 0) { toast.error('Ingresa un valor de descuento válido'); return; }
    if (discountForm.discount_type === 'percentage' && val > 100) {
      toast.error('El porcentaje no puede ser mayor a 100');
      return;
    }

    setDiscountSaving(true);
    try {
      const { error } = await supabase.rpc('upsert_vendor_discount', {
        p_vendor_id: vendorId,
        p_product_id: discountForm.product_id,
        p_name: '',
        p_discount_type: discountForm.discount_type,
        p_discount_value: val,
        p_min_quantity: discountForm.min_quantity ? Number(discountForm.min_quantity) : null,
        p_max_uses: discountForm.max_uses ? Number(discountForm.max_uses) : null,
        p_start_date: discountForm.start_date || null,
        p_end_date: discountForm.end_date || null,
        p_is_active: true,
      });
      if (error) throw error;
      toast.success(editingDiscount ? 'Descuento actualizado' : 'Descuento creado');
      setShowDiscountModal(false);
      loadDiscounts();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar descuento');
    } finally {
      setDiscountSaving(false);
    }
  };

  const handleToggleDiscount = async (discount: DiscountRow) => {
    try {
      const { error } = await supabase.rpc('toggle_vendor_discount', {
        p_discount_id: discount.id,
        p_vendor_id: vendorId,
      });
      if (error) throw error;
      setDiscounts((prev) => prev.map((d) =>
        d.id === discount.id ? { ...d, is_active: !d.is_active } : d
      ));
      toast.success(discount.is_active ? 'Descuento desactivado' : 'Descuento activado');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al actualizar');
    }
  };

  const handleDeleteDiscount = async () => {
    if (!deletingDiscount || !vendorId) return;
    setDiscountDeleting(true);
    try {
      const { error } = await supabase.rpc('delete_vendor_discount', {
        p_discount_id: deletingDiscount.id,
        p_vendor_id: vendorId,
      });
      if (error) throw error;
      setDiscounts((prev) => prev.filter((d) => d.id !== deletingDiscount.id));
      toast.success('Descuento eliminado');
      setDeletingDiscount(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar');
    } finally {
      setDiscountDeleting(false);
    }
  };

  /* ═══════════════════════════════════════════════════════════════
     COMBOS CRUD
     ═══════════════════════════════════════════════════════════════ */

  const openComboModal = (combo?: ComboRow) => {
    if (combo) {
      setEditingCombo(combo);
      setComboForm({
        name: combo.name,
        description: combo.description || '',
        combo_price: combo.combo_price.toString(),
        image_url: combo.image_url || '',
      });
      setComboItems(combo.items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })));
      setComboImagePreview(combo.image_url || null);
    } else {
      setEditingCombo(null);
      setComboForm({ name: '', description: '', combo_price: '', image_url: '' });
      setComboItems([]);
      setComboImagePreview(null);
    }
    setComboImageFile(null);
    setShowComboModal(true);
  };

  const addComboItem = () => {
    if (vendorProducts.length === 0) {
      toast.error('No hay productos disponibles');
      return;
    }
    const usedIds = new Set(comboItems.map((i) => i.product_id));
    const available = vendorProducts.find((p) => !usedIds.has(p.id));
    if (!available) {
      toast.error('Todos los productos ya están en el combo');
      return;
    }
    setComboItems((prev) => [...prev, { product_id: available.id, quantity: 1 }]);
  };

  const removeComboItem = (index: number) => {
    setComboItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateComboItem = (index: number, field: 'product_id' | 'quantity', value: string | number) => {
    setComboItems((prev) => prev.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    ));
  };

  const getComboOriginalPrice = () => {
    return comboItems.reduce((sum, ci) => {
      const product = vendorProducts.find((p) => p.id === ci.product_id);
      return sum + (product ? product.price * ci.quantity : 0);
    }, 0);
  };

  const handleSaveCombo = async () => {
    if (!vendorId) return;
    if (!comboForm.name.trim()) { toast.error('El nombre es obligatorio'); return; }
    if (comboItems.length === 0) { toast.error('Agrega al menos un producto al combo'); return; }
    const comboPrice = Number(comboForm.combo_price);
    if (!comboPrice || comboPrice <= 0) { toast.error('Ingresa un precio de combo válido'); return; }

    setComboSaving(true);
    try {
      let imageUrl = comboForm.image_url || null;
      if (comboImageFile) {
        const id = editingCombo?.id || crypto.randomUUID();
        const url = await uploadImage('combos', 'combos', id, comboImageFile, setComboUploading);
        if (url) imageUrl = url;
      }

      const itemsPayload = comboItems.map((ci) => ({
        product_id: ci.product_id,
        quantity: ci.quantity,
      }));

      const originalPrice = editingCombo?.original_price || getComboOriginalPrice();

      if (editingCombo) {
        const { error } = await supabase.rpc('update_vendor_combo', {
          p_combo_id: editingCombo.id,
          p_vendor_id: vendorId,
          p_name: comboForm.name.trim(),
          p_description: comboForm.description.trim() || null,
          p_combo_price: comboPrice,
          p_image_url: imageUrl,
          p_items: itemsPayload,
        });
        if (error) throw error;
        toast.success('Combo actualizado');
      } else {
        const { error } = await supabase.rpc('create_vendor_combo', {
          p_vendor_id: vendorId,
          p_name: comboForm.name.trim(),
          p_description: comboForm.description.trim() || null,
          p_original_price: originalPrice,
          p_combo_price: comboPrice,
          p_image_url: imageUrl,
          p_items: itemsPayload,
        });
        if (error) throw error;
        toast.success('Combo creado');
      }
      setShowComboModal(false);
      loadCombos();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar combo');
    } finally {
      setComboSaving(false);
    }
  };

  const handleToggleCombo = async (combo: ComboRow) => {
    try {
      const { error } = await supabase.rpc('toggle_vendor_combo', {
        p_combo_id: combo.id,
        p_vendor_id: vendorId,
      });
      if (error) throw error;
      setCombos((prev) => prev.map((c) =>
        c.id === combo.id ? { ...c, is_active: !c.is_active } : c
      ));
      toast.success(combo.is_active ? 'Combo desactivado' : 'Combo activado');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al actualizar');
    }
  };

  const handleDeleteCombo = async () => {
    if (!deletingCombo || !vendorId) return;
    setComboDeleting(true);
    try {
      const { error } = await supabase.rpc('delete_vendor_combo', {
        p_combo_id: deletingCombo.id,
        p_vendor_id: vendorId,
      });
      if (error) throw error;
      setCombos((prev) => prev.filter((c) => c.id !== deletingCombo.id));
      toast.success('Combo eliminado');
      setDeletingCombo(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar');
    } finally {
      setComboDeleting(false);
    }
  };

  /* ═══════════════════════════════════════════════════════════════
     PROMOTIONS CRUD
     ═══════════════════════════════════════════════════════════════ */

  const openPromoModal = (promo?: PromotionRow) => {
    if (promo) {
      setEditingPromo(promo);
      setPromoForm({
        name: promo.name,
        description: promo.description || '',
        promo_type: promo.promo_type,
        discount_pct: promo.discount_pct.toString(),
        start_date: promo.start_date ? promo.start_date.slice(0, 10) : '',
        end_date: promo.end_date ? promo.end_date.slice(0, 10) : '',
        applicable_categories: (promo.applicable_categories || []).join(', '),
      });
      setPromoImagePreview(promo.banner_url || null);
    } else {
      setEditingPromo(null);
      setPromoForm({
        name: '',
        description: '',
        promo_type: 'general',
        discount_pct: '',
        start_date: '',
        end_date: '',
        applicable_categories: '',
      });
      setPromoImagePreview(null);
    }
    setPromoImageFile(null);
    setShowPromoModal(true);
  };

  const handleSavePromo = async () => {
    if (!vendorId) return;
    if (!promoForm.name.trim()) { toast.error('El nombre es obligatorio'); return; }
    const pct = Number(promoForm.discount_pct);
    if (isNaN(pct) || pct < 0 || pct > 100) { toast.error('El porcentaje debe ser entre 0 y 100'); return; }

    setPromoSaving(true);
    try {
      let bannerUrl: string | null = null;
      if (promoImageFile) {
        const id = editingPromo?.id || crypto.randomUUID();
        const url = await uploadImage('promotions', 'promotions', id, promoImageFile, setPromoUploading);
        if (url) bannerUrl = url;
      } else if (editingPromo?.banner_url) {
        bannerUrl = editingPromo.banner_url;
      }

      const categories = promoForm.applicable_categories
        ? promoForm.applicable_categories.split(',').map((c) => c.trim()).filter(Boolean)
        : null;

      if (editingPromo) {
        const { error } = await supabase.rpc('update_vendor_promotion', {
          p_promo_id: editingPromo.id,
          p_vendor_id: vendorId,
          p_name: promoForm.name.trim(),
          p_description: promoForm.description.trim() || null,
          p_promo_type: promoForm.promo_type,
          p_discount_pct: pct,
          p_banner_url: bannerUrl,
          p_start_date: promoForm.start_date || null,
          p_end_date: promoForm.end_date || null,
          p_applicable_categories: categories,
          p_is_active: true,
        });
        if (error) throw error;
        toast.success('Promoción actualizada');
      } else {
        const { error } = await supabase.rpc('create_vendor_promotion', {
          p_vendor_id: vendorId,
          p_name: promoForm.name.trim(),
          p_description: promoForm.description.trim() || null,
          p_promo_type: promoForm.promo_type,
          p_discount_pct: pct,
          p_banner_url: bannerUrl,
          p_start_date: promoForm.start_date || null,
          p_end_date: promoForm.end_date || null,
          p_applicable_categories: categories,
          p_is_active: true,
        });
        if (error) throw error;
        toast.success('Promoción creada');
      }
      setShowPromoModal(false);
      loadPromotions();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar promoción');
    } finally {
      setPromoSaving(false);
    }
  };

  const handleTogglePromo = async (promo: PromotionRow) => {
    try {
      const { error } = await supabase.rpc('toggle_vendor_promotion', {
        p_promo_id: promo.id,
        p_vendor_id: vendorId,
      });
      if (error) throw error;
      setPromotions((prev) => prev.map((p) =>
        p.id === promo.id ? { ...p, is_active: !p.is_active } : p
      ));
      toast.success(promo.is_active ? 'Promoción desactivada' : 'Promoción activada');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al actualizar');
    }
  };

  const handleDeletePromo = async () => {
    if (!deletingPromo || !vendorId) return;
    setPromoDeleting(true);
    try {
      const { error } = await supabase.rpc('delete_vendor_promotion', {
        p_promo_id: deletingPromo.id,
        p_vendor_id: vendorId,
      });
      if (error) throw error;
      setPromotions((prev) => prev.filter((p) => p.id !== deletingPromo.id));
      toast.success('Promoción eliminada');
      setDeletingPromo(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar');
    } finally {
      setPromoDeleting(false);
    }
  };

  /* ═══════════════════════════════════════════════════════════════
     TAB DEFINITIONS
     ═══════════════════════════════════════════════════════════════ */

  const tabs: { key: MainTab; label: string; icon: React.ElementType; count: number }[] = [
    { key: 'discounts', label: 'Descuentos', icon: Percent, count: discounts.length },
    { key: 'combos', label: 'Combos', icon: Package, count: combos.length },
    { key: 'promotions', label: 'Promociones', icon: Megaphone, count: promotions.length },
  ];

  const isLoading = vendorLoading || productsLoading;

  /* ═══════════════════════════════════════════════════════════════
     RENDER: DISCOUNT CARD
     ═══════════════════════════════════════════════════════════════ */

  const renderDiscountCard = (d: DiscountRow) => {
    const discountDisplay = d.discount_type === 'percentage'
      ? `${d.discount_value}%`
      : formatCRC(d.discount_value);

    return (
      <motion.div
        key={d.id}
        variants={itemVariants}
        className="glass rounded-2xl p-4 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <Percent className="w-6 h-6 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-gray-900 truncate">{d.product_name}</h3>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-600 border border-emerald-200">
                -{discountDisplay}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-400">
              {d.min_quantity && (
                <span className="flex items-center gap-1">
                  <Layers className="w-3 h-3" />
                  Min. {d.min_quantity} uds
                </span>
              )}
              {d.start_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {formatDate(d.start_date)}
                </span>
              )}
              {d.end_date && (
                <span className="flex items-center gap-1">
                  → {formatDate(d.end_date)}
                </span>
              )}
              {d.max_uses && (
                <span className="flex items-center gap-1">
                  <Tag className="w-3 h-3" />
                  {d.uses_count}/{d.max_uses} usos
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => handleToggleDiscount(d)}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              {d.is_active
                ? <ToggleRight className="w-5 h-5 text-emerald-600" />
                : <ToggleLeft className="w-5 h-5 text-gray-300" />}
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => openDiscountModal(d)}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Edit3 className="w-4 h-4 text-gray-500" />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setDeletingDiscount(d)}
              className="p-1.5 rounded-lg hover:bg-red-500/20 transition-colors"
            >
              <Trash2 className="w-4 h-4 text-red-600/60 hover:text-red-600" />
            </motion.button>
          </div>
        </div>
      </motion.div>
    );
  };

  /* ═══════════════════════════════════════════════════════════════
     RENDER: COMBO CARD
     ═══════════════════════════════════════════════════════════════ */

  const renderComboCard = (c: ComboRow) => {
    const savings = c.original_price > 0
      ? Math.round(((c.original_price - c.combo_price) / c.original_price) * 100)
      : 0;

    return (
      <motion.div
        key={c.id}
        variants={itemVariants}
        className="glass rounded-2xl overflow-hidden hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-start gap-4 p-4">
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
            {c.image_url ? (
              <img src={c.image_url} alt={c.name} className="w-full h-full object-cover" />
            ) : (
              <Package className="w-7 h-7 text-amber-600" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-gray-900 truncate">{c.name}</h3>
              {savings > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-600 border border-amber-200">
                  Ahorras {savings}%
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-base font-bold text-gray-900">{formatCRC(c.combo_price)}</span>
              {c.original_price > c.combo_price && (
                <span className="text-xs text-gray-400 line-through">{formatCRC(c.original_price)}</span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {c.items.slice(0, 3).map((item, idx) => (
                <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-gray-50 text-gray-500 border border-gray-200">
                  {item.product_name} x{item.quantity}
                </span>
              ))}
              {c.items.length > 3 && (
                <span className="text-[10px] text-gray-400">+{c.items.length - 3} más</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => handleToggleCombo(c)}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              {c.is_active
                ? <ToggleRight className="w-5 h-5 text-emerald-600" />
                : <ToggleLeft className="w-5 h-5 text-gray-300" />}
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => openComboModal(c)}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Edit3 className="w-4 h-4 text-gray-500" />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setDeletingCombo(c)}
              className="p-1.5 rounded-lg hover:bg-red-500/20 transition-colors"
            >
              <Trash2 className="w-4 h-4 text-red-600/60 hover:text-red-600" />
            </motion.button>
          </div>
        </div>
      </motion.div>
    );
  };

  /* ═══════════════════════════════════════════════════════════════
     RENDER: PROMOTION CARD
     ═══════════════════════════════════════════════════════════════ */

  const renderPromoCard = (p: PromotionRow) => {
    const config = PROMO_TYPE_CONFIG[p.promo_type] || PROMO_TYPE_CONFIG.general;
    const Icon = config.icon;

    return (
      <motion.div
        key={p.id}
        variants={itemVariants}
        className="glass rounded-2xl overflow-hidden hover:bg-gray-100 transition-colors"
      >
        {p.banner_url && (
          <div className="h-28 overflow-hidden">
            <img src={p.banner_url} alt={p.name} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="flex items-start gap-4 p-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${config.color.split(' ').slice(0, 2).join(' ')}`}>
            <Icon className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-gray-900 truncate">{p.name}</h3>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${config.color}`}>
                {config.label}
              </span>
            </div>
            {p.description && (
              <p className="text-xs text-gray-400 mt-1 line-clamp-1">{p.description}</p>
            )}
            <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-400">
              {p.discount_pct > 0 && (
                <span className="flex items-center gap-1 text-emerald-600 font-medium">
                  <Percent className="w-3 h-3" />
                  {p.discount_pct}% dcto
                </span>
              )}
              {p.start_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {formatDate(p.start_date)}
                  {p.end_date && ` → ${formatDate(p.end_date)}`}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => handleTogglePromo(p)}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              {p.is_active
                ? <ToggleRight className="w-5 h-5 text-emerald-600" />
                : <ToggleLeft className="w-5 h-5 text-gray-300" />}
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => openPromoModal(p)}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Edit3 className="w-4 h-4 text-gray-500" />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setDeletingPromo(p)}
              className="p-1.5 rounded-lg hover:bg-red-500/20 transition-colors"
            >
              <Trash2 className="w-4 h-4 text-red-600/60 hover:text-red-600" />
            </motion.button>
          </div>
        </div>
      </motion.div>
    );
  };

  /* ═══════════════════════════════════════════════════════════════
     RENDER: MODALS
     ═══════════════════════════════════════════════════════════════ */

  const inputCls = 'bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:border-green-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-colors w-full';
  const labelCls = 'text-xs font-medium text-gray-500 mb-1.5 block';

  /* ── Discount Modal ───────────────────────────────────────── */
  const renderDiscountModal = () => (
    <AnimatePresence>
      {showDiscountModal && (
        <motion.div
          className="fixed inset-0 z-[55] flex items-center justify-center p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowDiscountModal(false)} />
          <motion.div
            className="relative w-full max-w-md glass-strong rounded-2xl z-10 max-h-[90vh] overflow-y-auto"
            initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h2 className="text-base font-bold text-gray-900">
                {editingDiscount ? 'Editar Descuento' : 'Nuevo Descuento'}
              </h2>
              <button onClick={() => setShowDiscountModal(false)} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Product select */}
              <div>
                <label className={labelCls}>Producto</label>
                <div className="relative">
                  <select
                    value={discountForm.product_id}
                    onChange={(e) => setDiscountForm((prev) => ({ ...prev, product_id: e.target.value }))}
                    className={`${inputCls} appearance-none pr-10`}
                  >
                    <option value="" className="bg-[#0d1220]">Seleccionar producto...</option>
                    {vendorProducts.map((p) => (
                      <option key={p.id} value={p.id} className="bg-[#0d1220]">
                        {p.name} — {formatCRC(p.price)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Discount type & value */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Tipo de descuento</label>
                  <div className="relative">
                    <select
                      value={discountForm.discount_type}
                      onChange={(e) => setDiscountForm((prev) => ({ ...prev, discount_type: e.target.value as 'percentage' | 'fixed' }))}
                      className={`${inputCls} appearance-none pr-10`}
                    >
                      <option value="percentage" className="bg-[#0d1220]">Porcentaje (%)</option>
                      <option value="fixed" className="bg-[#0d1220]">Monto fijo (₡)</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Valor</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                      {discountForm.discount_type === 'percentage' ? '%' : '₡'}
                    </span>
                    <input
                      type="number"
                      value={discountForm.discount_value}
                      onChange={(e) => setDiscountForm((prev) => ({ ...prev, discount_value: e.target.value }))}
                      placeholder="0"
                      className={`${inputCls} pl-8`}
                      min="0"
                      max={discountForm.discount_type === 'percentage' ? '100' : undefined}
                    />
                  </div>
                </div>
              </div>

              {/* Min quantity & max uses */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Cantidad mínima <span className="text-gray-300">(opcional)</span></label>
                  <input
                    type="number"
                    value={discountForm.min_quantity}
                    onChange={(e) => setDiscountForm((prev) => ({ ...prev, min_quantity: e.target.value }))}
                    placeholder="Ej: 3"
                    className={inputCls}
                    min="0"
                  />
                </div>
                <div>
                  <label className={labelCls}>Máximo de usos <span className="text-gray-300">(opcional)</span></label>
                  <input
                    type="number"
                    value={discountForm.max_uses}
                    onChange={(e) => setDiscountForm((prev) => ({ ...prev, max_uses: e.target.value }))}
                    placeholder="Ej: 100"
                    className={inputCls}
                    min="0"
                  />
                </div>
              </div>

              {/* Date range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Fecha inicio <span className="text-gray-300">(opcional)</span></label>
                  <input
                    type="date"
                    value={discountForm.start_date}
                    onChange={(e) => setDiscountForm((prev) => ({ ...prev, start_date: e.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Fecha fin <span className="text-gray-300">(opcional)</span></label>
                  <input
                    type="date"
                    value={discountForm.end_date}
                    onChange={(e) => setDiscountForm((prev) => ({ ...prev, end_date: e.target.value }))}
                    className={inputCls}
                    min={discountForm.start_date || undefined}
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 p-5 pt-0">
              <button
                onClick={() => setShowDiscountModal(false)}
                disabled={discountSaving}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm text-gray-500 bg-gray-50 hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <motion.button
                onClick={handleSaveDiscount}
                disabled={discountSaving}
                className="flex-1 btn-neon text-white py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                whileHover={{ scale: discountSaving ? 1 : 1.02 }}
                whileTap={{ scale: discountSaving ? 1 : 0.98 }}
              >
                {discountSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {editingDiscount ? 'Actualizar' : 'Crear'}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  /* ── Combo Modal ───────────────────────────────────────────── */
  const renderComboModal = () => (
    <AnimatePresence>
      {showComboModal && (
        <motion.div
          className="fixed inset-0 z-[55] flex items-center justify-center p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowComboModal(false)} />
          <motion.div
            className="relative w-full max-w-lg glass-strong rounded-2xl z-10 max-h-[90vh] overflow-y-auto"
            initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h2 className="text-base font-bold text-gray-900">
                {editingCombo ? 'Editar Combo' : 'Nuevo Combo'}
              </h2>
              <button onClick={() => setShowComboModal(false)} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Image upload */}
              <div>
                <label className={labelCls}>Imagen del combo <span className="text-gray-300">(opcional)</span></label>
                {comboImagePreview ? (
                  <div className="relative w-full h-32 rounded-xl overflow-hidden group">
                    <img src={comboImagePreview} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      onClick={() => { setComboImagePreview(null); setComboImageFile(null); }}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3.5 h-3.5 text-white" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => comboFileRef.current?.click()}
                    className="w-full h-32 rounded-xl border border-dashed border-gray-200 hover:border-green-200 hover:bg-green-50 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <UploadCloud className="w-8 h-8 text-gray-300" />
                    <span className="text-xs text-gray-400">Haz clic para subir imagen</span>
                  </div>
                )}
                <input
                  ref={comboFileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageFile(file, setComboImagePreview, setComboImageFile);
                  }}
                  className="hidden"
                />
              </div>

              {/* Name */}
              <div>
                <label className={labelCls}>Nombre del combo</label>
                <input
                  type="text"
                  value={comboForm.name}
                  onChange={(e) => setComboForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Ej: Combo Familiar"
                  className={inputCls}
                />
              </div>

              {/* Description */}
              <div>
                <label className={labelCls}>Descripción <span className="text-gray-300">(opcional)</span></label>
                <textarea
                  value={comboForm.description}
                  onChange={(e) => setComboForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Descripción del combo..."
                  className={`${inputCls} resize-none h-20`}
                />
              </div>

              {/* Combo price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Precio del combo</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₡</span>
                    <input
                      type="number"
                      value={comboForm.combo_price}
                      onChange={(e) => setComboForm((prev) => ({ ...prev, combo_price: e.target.value }))}
                      placeholder="0"
                      className={`${inputCls} pl-8`}
                      min="0"
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Precio original</label>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-500">
                    {formatCRC(getComboOriginalPrice())}
                  </div>
                </div>
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={labelCls + ' mb-0'}>Productos del combo</label>
                  <button
                    onClick={addComboItem}
                    disabled={vendorProducts.length === 0}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-green-50 text-green-600 border border-green-200 hover:bg-cyan-500/30 transition-colors disabled:opacity-40"
                  >
                    <Plus className="w-3 h-3" /> Agregar
                  </button>
                </div>
                {comboItems.length === 0 ? (
                  <div className="py-6 text-center text-xs text-gray-300">
                    Agrega productos al combo
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {comboItems.map((ci, idx) => {
                      const product = vendorProducts.find((p) => p.id === ci.product_id);
                      return (
                        <div key={idx} className="flex items-center gap-2 bg-gray-50 rounded-xl p-2.5">
                          <div className="flex-1 min-w-0">
                            <div className="relative">
                              <select
                                value={ci.product_id}
                                onChange={(e) => updateComboItem(idx, 'product_id', e.target.value)}
                                className="bg-transparent text-sm text-gray-900 w-full focus:outline-none cursor-pointer"
                              >
                                {vendorProducts.map((p) => (
                                  <option key={p.id} value={p.id} className="bg-[#0d1220]">
                                    {p.name} — {formatCRC(p.price)}
                                  </option>
                                ))}
                              </select>
                            </div>
                            {product && (
                              <span className="text-[10px] text-gray-300">{formatCRC(product.price * ci.quantity)}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => updateComboItem(idx, 'quantity', Math.max(1, ci.quantity - 1))}
                              className="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center text-gray-900 text-xs hover:bg-white/20 transition-colors"
                            >
                              −
                            </button>
                            <span className="w-8 text-center text-sm text-gray-900 font-medium">{ci.quantity}</span>
                            <button
                              onClick={() => updateComboItem(idx, 'quantity', ci.quantity + 1)}
                              className="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center text-gray-900 text-xs hover:bg-white/20 transition-colors"
                            >
                              +
                            </button>
                          </div>
                          <button
                            onClick={() => removeComboItem(idx)}
                            className="p-1 rounded-md hover:bg-red-500/20 transition-colors"
                          >
                            <X className="w-3.5 h-3.5 text-red-600/60" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 p-5 pt-0">
              <button
                onClick={() => setShowComboModal(false)}
                disabled={comboSaving || comboUploading}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm text-gray-500 bg-gray-50 hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <motion.button
                onClick={handleSaveCombo}
                disabled={comboSaving || comboUploading}
                className="flex-1 btn-neon text-white py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                whileHover={{ scale: comboSaving ? 1 : 1.02 }}
                whileTap={{ scale: comboSaving ? 1 : 0.98 }}
              >
                {(comboSaving || comboUploading) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {editingCombo ? 'Actualizar' : 'Crear'}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  /* ── Promotion Modal ───────────────────────────────────────── */
  const renderPromoModal = () => (
    <AnimatePresence>
      {showPromoModal && (
        <motion.div
          className="fixed inset-0 z-[55] flex items-center justify-center p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowPromoModal(false)} />
          <motion.div
            className="relative w-full max-w-lg glass-strong rounded-2xl z-10 max-h-[90vh] overflow-y-auto"
            initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h2 className="text-base font-bold text-gray-900">
                {editingPromo ? 'Editar Promoción' : 'Nueva Promoción'}
              </h2>
              <button onClick={() => setShowPromoModal(false)} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Banner upload */}
              <div>
                <label className={labelCls}>Banner <span className="text-gray-300">(opcional)</span></label>
                {promoImagePreview ? (
                  <div className="relative w-full h-36 rounded-xl overflow-hidden group">
                    <img src={promoImagePreview} alt="Banner" className="w-full h-full object-cover" />
                    <button
                      onClick={() => { setPromoImagePreview(null); setPromoImageFile(null); }}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3.5 h-3.5 text-white" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => promoFileRef.current?.click()}
                    className="w-full h-36 rounded-xl border border-dashed border-gray-200 hover:border-green-200 hover:bg-green-50 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <UploadCloud className="w-8 h-8 text-gray-300" />
                    <span className="text-xs text-gray-400">Subir banner de promoción</span>
                    <span className="text-[10px] text-gray-300">Recomendado: 1200x400px</span>
                  </div>
                )}
                <input
                  ref={promoFileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageFile(file, setPromoImagePreview, setPromoImageFile);
                  }}
                  className="hidden"
                />
              </div>

              {/* Name */}
              <div>
                <label className={labelCls}>Nombre de la promoción</label>
                <input
                  type="text"
                  value={promoForm.name}
                  onChange={(e) => setPromoForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Ej: Super Martes"
                  className={inputCls}
                />
              </div>

              {/* Description */}
              <div>
                <label className={labelCls}>Descripción <span className="text-gray-300">(opcional)</span></label>
                <textarea
                  value={promoForm.description}
                  onChange={(e) => setPromoForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Descripción de la promoción..."
                  className={`${inputCls} resize-none h-20`}
                />
              </div>

              {/* Type & Discount */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Tipo de promoción</label>
                  <div className="relative">
                    <select
                      value={promoForm.promo_type}
                      onChange={(e) => setPromoForm((prev) => ({ ...prev, promo_type: e.target.value as PromoType }))}
                      className={`${inputCls} appearance-none pr-10`}
                    >
                      {Object.entries(PROMO_TYPE_CONFIG).map(([key, cfg]) => (
                        <option key={key} value={key} className="bg-[#0d1220]">{cfg.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Descuento (%)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                    <input
                      type="number"
                      value={promoForm.discount_pct}
                      onChange={(e) => setPromoForm((prev) => ({ ...prev, discount_pct: e.target.value }))}
                      placeholder="0"
                      className={`${inputCls} pl-8`}
                      min="0"
                      max="100"
                    />
                  </div>
                </div>
              </div>

              {/* Date range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Fecha inicio <span className="text-gray-300">(opcional)</span></label>
                  <input
                    type="date"
                    value={promoForm.start_date}
                    onChange={(e) => setPromoForm((prev) => ({ ...prev, start_date: e.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Fecha fin <span className="text-gray-300">(opcional)</span></label>
                  <input
                    type="date"
                    value={promoForm.end_date}
                    onChange={(e) => setPromoForm((prev) => ({ ...prev, end_date: e.target.value }))}
                    className={inputCls}
                    min={promoForm.start_date || undefined}
                  />
                </div>
              </div>

              {/* Applicable categories */}
              <div>
                <label className={labelCls}>Categorías aplicables <span className="text-gray-300">(opcional, separadas por coma)</span></label>
                <input
                  type="text"
                  value={promoForm.applicable_categories}
                  onChange={(e) => setPromoForm((prev) => ({ ...prev, applicable_categories: e.target.value }))}
                  placeholder="Ej: Comida, Bebidas, Postres"
                  className={inputCls}
                />
              </div>
            </div>

            <div className="flex gap-3 p-5 pt-0">
              <button
                onClick={() => setShowPromoModal(false)}
                disabled={promoSaving || promoUploading}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm text-gray-500 bg-gray-50 hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <motion.button
                onClick={handleSavePromo}
                disabled={promoSaving || promoUploading}
                className="flex-1 btn-neon text-white py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                whileHover={{ scale: promoSaving ? 1 : 1.02 }}
                whileTap={{ scale: promoSaving ? 1 : 0.98 }}
              >
                {(promoSaving || promoUploading) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {editingPromo ? 'Actualizar' : 'Crear'}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  /* ═══════════════════════════════════════════════════════════════
     EMPTY STATE
     ═══════════════════════════════════════════════════════════════ */

  const renderEmpty = (tab: MainTab) => {
    const config: Record<MainTab, { icon: React.ElementType; title: string; desc: string }> = {
      discounts: {
        icon: Percent,
        title: 'Sin descuentos',
        desc: 'Crea tu primer descuento para ofrecer mejores precios a tus clientes.',
      },
      combos: {
        icon: Package,
        title: 'Sin combos',
        desc: 'Crea combos para agrupar productos y ofrecer precios especiales.',
      },
      promotions: {
        icon: Megaphone,
        title: 'Sin promociones',
        desc: 'Crea promociones para atraer más clientes a tu tienda.',
      },
    };
    const { icon: Icon, title, desc } = config[tab];
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-16"
      >
        <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
          <Icon className="w-8 h-8 text-gray-300" />
        </div>
        <h3 className="text-sm font-semibold text-gray-500 mb-1">{title}</h3>
        <p className="text-xs text-gray-300 max-w-xs mx-auto">{desc}</p>
      </motion.div>
    );
  };

  /* ═══════════════════════════════════════════════════════════════
     MAIN RENDER
     ═══════════════════════════════════════════════════════════════ */

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-gray-50 rounded-lg animate-pulse" />
        <div className="h-12 bg-gray-50 rounded-xl animate-pulse" />
        <ListSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 flex items-center justify-center">
              <Tag className="w-4 h-4 text-green-600" />
            </span>
            Ofertas y Promociones
          </h1>
          <p className="text-sm text-gray-400 mt-1">Gestiona descuentos, combos y promociones de tu tienda</p>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 glass rounded-xl w-fit">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <motion.button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-gray-100 text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-600 hover:bg-gray-50'
              }`}
              whileTap={{ scale: 0.97 }}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-green-600' : ''}`} />
              <span className="hidden sm:inline">{tab.label}</span>
              {tab.count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  isActive ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-400'
                }`}>
                  {tab.count}
                </span>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Action button per tab */}
      <div className="flex justify-end">
        <motion.button
          onClick={() => {
            if (activeTab === 'discounts') openDiscountModal();
            else if (activeTab === 'combos') openComboModal();
            else openPromoModal();
          }}
          className="btn-neon text-white px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Plus className="w-4 h-4" />
          {activeTab === 'discounts' && 'Nuevo Descuento'}
          {activeTab === 'combos' && 'Nuevo Combo'}
          {activeTab === 'promotions' && 'Nueva Promoción'}
        </motion.button>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {/* DISCOUNTS TAB */}
        {activeTab === 'discounts' && (
          <motion.div
            key="discounts"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {discountsLoading ? (
              <ListSkeleton />
            ) : discounts.length === 0 ? (
              renderEmpty('discounts')
            ) : (
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="space-y-3"
              >
                {discounts.map(renderDiscountCard)}
              </motion.div>
            )}
          </motion.div>
        )}

        {/* COMBOS TAB */}
        {activeTab === 'combos' && (
          <motion.div
            key="combos"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {combosLoading ? (
              <ListSkeleton />
            ) : combos.length === 0 ? (
              renderEmpty('combos')
            ) : (
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="space-y-3"
              >
                {combos.map(renderComboCard)}
              </motion.div>
            )}
          </motion.div>
        )}

        {/* PROMOTIONS TAB */}
        {activeTab === 'promotions' && (
          <motion.div
            key="promotions"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {promosLoading ? (
              <ListSkeleton />
            ) : promotions.length === 0 ? (
              renderEmpty('promotions')
            ) : (
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="space-y-3"
              >
                {promotions.map(renderPromoCard)}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      {renderDiscountModal()}
      {renderComboModal()}
      {renderPromoModal()}

      {/* Delete confirmations */}
      <AnimatePresence>
        {deletingDiscount && (
          <DeleteModal
            title="Eliminar descuento"
            message={`¿Estás seguro de eliminar el descuento de "${deletingDiscount.product_name}"? Esta acción no se puede deshacer.`}
            onConfirm={handleDeleteDiscount}
            onCancel={() => setDeletingDiscount(null)}
            loading={discountDeleting}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deletingCombo && (
          <DeleteModal
            title="Eliminar combo"
            message={`¿Estás seguro de eliminar el combo "${deletingCombo.name}"? Esta acción no se puede deshacer.`}
            onConfirm={handleDeleteCombo}
            onCancel={() => setDeletingCombo(null)}
            loading={comboDeleting}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deletingPromo && (
          <DeleteModal
            title="Eliminar promoción"
            message={`¿Estás seguro de eliminar la promoción "${deletingPromo.name}"? Esta acción no se puede deshacer.`}
            onConfirm={handleDeletePromo}
            onCancel={() => setDeletingPromo(null)}
            loading={promoDeleting}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
