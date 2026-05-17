'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  Search, Package, Plus, Eye, Pencil, Trash2, Store, TrendingUp,
  X, Loader2, ChevronLeft, Star, ImageIcon, Upload, ChevronDown,
  CheckSquare, Square, AlertTriangle, DollarSign, StarHalf, Filter,
  ArrowUpDown, MoreHorizontal, ToggleLeft, ToggleRight, Sparkles,
  ArrowUpDownIcon
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase, type Product, type Vendor, type ProductReview } from '@/lib/supabase';

// ─── Helpers ────────────────────────────────────────────────────
function formatCRC(amount: number): string {
  return `₡${Math.round(amount).toLocaleString('es-CR')}`;
}

const ITEMS_PER_PAGE = 24;

const categoryColors: Record<string, string> = {
  Farmacia: 'from-emerald-500/20 to-green-500/20 text-emerald-400',
  Comida: 'from-amber-500/20 to-orange-500/20 text-amber-400',
  Tiendas: 'from-blue-500/20 to-cyan-500/20 text-blue-400',
  Otro: 'from-violet-500/20 to-purple-500/20 text-purple-400',
};

const categoryBadgeColors: Record<string, string> = {
  Farmacia: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  Comida: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  Tiendas: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  Otro: 'bg-violet-500/15 text-purple-400 border-purple-500/30',
};

const categoryMap: Record<string, string> = {
  pharmacy: 'Farmacia',
  food: 'Comida',
  stores: 'Tiendas',
  other: 'Otro',
};

const reverseCategoryMap: Record<string, string> = {
  Farmacia: 'pharmacy',
  Comida: 'food',
  Tiendas: 'stores',
  Otro: 'other',
};

const presetCategories = ['Farmacia', 'Comida', 'Tiendas', 'Otro'];

const sortOptions = [
  { key: 'newest', label: 'Más recientes' },
  { key: 'price_asc', label: 'Precio: menor a mayor' },
  { key: 'price_desc', label: 'Precio: mayor a menor' },
  { key: 'most_sold', label: 'Más vendidos' },
];

const stockFilters = [
  { key: 'all', label: 'Todos' },
  { key: 'in_stock', label: 'En stock' },
  { key: 'out_of_stock', label: 'Agotados' },
];

// ─── Types ──────────────────────────────────────────────────────
interface ProductRow {
  id: string;
  vendor_id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image_url: string | null;
  in_stock: boolean;
  stock_quantity: number;
  sold_count: number;
  is_featured: boolean;
  avg_rating: number;
  created_at: string;
  vendor_name: string;
  vendor_category: string;
}

type ModalMode = 'add' | 'edit' | 'detail' | 'delete' | null;

interface FormData {
  name: string;
  description: string;
  price: string;
  category: string;
  customCategory: string;
  useCustomCategory: boolean;
  in_stock: boolean;
  stock_quantity: string;
  vendor_id: string;
  is_featured: boolean;
  imageFile: File | null;
  imagePreview: string | null;
}

const emptyForm: FormData = {
  name: '',
  description: '',
  price: '',
  category: 'Otro',
  customCategory: '',
  useCustomCategory: false,
  in_stock: true,
  stock_quantity: '',
  vendor_id: '',
  is_featured: false,
  imageFile: null,
  imagePreview: null,
};

// ─── Star Rating Component ──────────────────────────────────────
function StarRating({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
  const sz = size === 'md' ? 'w-4 h-4' : 'w-3 h-3';
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${sz} ${star <= Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-gray-600'}`}
        />
      ))}
      <span className={`text-gray-400 ml-1 ${size === 'md' ? 'text-sm' : 'text-xs'}`}>
        {rating > 0 ? rating.toFixed(1) : '—'}
      </span>
    </div>
  );
}

// ─── Loading Skeleton ───────────────────────────────────────────
function ProductCardSkeleton() {
  return (
    <div className="glass rounded-2xl overflow-hidden animate-pulse">
      <div className="h-36 bg-white/5" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-white/5 rounded w-3/4" />
        <div className="h-3 bg-white/5 rounded w-1/2" />
        <div className="flex justify-between">
          <div className="h-6 bg-white/5 rounded-full w-20" />
          <div className="h-6 bg-white/5 rounded w-16" />
        </div>
        <div className="h-8 bg-white/5 rounded-lg w-full" />
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
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

// ─── Vendor Search Dropdown ─────────────────────────────────────
function VendorSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (vendorId: string) => void;
}) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const selected = vendors.find((v) => v.id === value);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from('vendors')
        .select('*, profiles(name)')
        .eq('is_approved', true)
        .order('store_name', { ascending: true });
      if (data) setVendors(data as Vendor[]);
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = vendors.filter(
    (v) =>
      v.store_name.toLowerCase().includes(query.toLowerCase()) ||
      ((v as Record<string, unknown>).profiles as { name?: string } | null)?.name
        ?.toLowerCase()
        .includes(query.toLowerCase())
  );

  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center gap-2">
        <Store className="w-4 h-4 text-gray-500 shrink-0" />
        <button
          type="button"
          onClick={() => !loading && setOpen(!open)}
          className="w-full text-left bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white hover:border-violet-500/40 transition-colors truncate"
        >
          {selected
            ? selected.store_name
            : loading
              ? 'Cargando vendedores...'
              : 'Seleccionar vendedor'}
        </button>
      </div>
      <AnimatePresence>
        {open && !loading && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute z-50 w-full mt-1 bg-gray-900 border border-white/10 rounded-xl shadow-xl max-h-60 overflow-hidden"
          >
            <div className="p-2 border-b border-white/10">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar vendedor..."
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-violet-500/40"
                  autoFocus
                />
              </div>
            </div>
            <div className="overflow-y-auto max-h-48 p-1">
              {filtered.length === 0 ? (
                <p className="text-gray-500 text-xs text-center py-4">No se encontró vendedor</p>
              ) : (
                filtered.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => {
                      onChange(v.id);
                      setOpen(false);
                      setQuery('');
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      v.id === value
                        ? 'bg-violet-500/15 text-violet-400'
                        : 'text-gray-300 hover:bg-white/5'
                    }`}
                  >
                    <span className="font-medium">{v.store_name}</span>
                    <span className="text-gray-500 text-xs ml-2">
                      {categoryMap[v.category] || v.category}
                    </span>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────
export default function AdminProductsPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('Todos');
  const [filterStock, setFilterStock] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [selected, setSelected] = useState<ProductRow | null>(null);
  const [modal, setModal] = useState<ModalMode>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [imageSignedUrls, setImageSignedUrls] = useState<Record<string, string>>({});
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkActionOpen, setBulkActionOpen] = useState(false);
  const [detailReviews, setDetailReviews] = useState<ProductReview[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProductRow | null>(null);

  // ─── Fetch Products ─────────────────────────────────────────
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      // Strategy 1: Direct query (works when RLS is configured for admin)
      type RawProduct = Record<string, unknown>;
      let allProducts: RawProduct[] = [];

      const { data: directData, error: directError } = await supabase
        .from('products')
        .select('*, vendors(store_name, category)')
        .order('created_at', { ascending: false });

      if (!directError && directData && directData.length > 0) {
        allProducts = directData as RawProduct[];
        console.log('[AdminProducts] Direct query OK, rows:', allProducts.length);
      } else {
        // Strategy 2: Admin RPC with SECURITY DEFINER (bypasses RLS entirely)
        console.warn('[AdminProducts] Direct query returned 0 or errored, trying RPC:', directError?.message);
        const { data: rpcData, error: rpcError } = await supabase
          .rpc('admin_get_all_products');
        if (rpcError) {
          console.error('[AdminProducts] RPC also failed:', rpcError.message);
          // Surface the original query error if both fail
          throw directError || rpcError;
        }
        allProducts = (rpcData || []) as RawProduct[];
        console.log('[AdminProducts] RPC OK, rows:', allProducts.length);
      }

      // Batch-fetch sold counts from delivered deliveries
      const productIds = allProducts.map((p) => p.id as string);
      const soldMap: Record<string, number> = {};
      if (productIds.length > 0) {
        const { data: completedDeliveries } = await supabase
          .from('deliveries')
          .select('items')
          .eq('status', 'delivered');

        for (const delivery of completedDeliveries || []) {
          const items = (delivery.items || []) as Array<{ id?: string; qty?: number }>;
          for (const item of items) {
            if (item.id && productIds.includes(item.id)) {
              soldMap[item.id] = (soldMap[item.id] || 0) + (item.qty || 1);
            }
          }
        }
      }

      const mapped: ProductRow[] = allProducts.map((p) => {
        const vendor = p.vendors as { store_name?: string; category?: string } | null;
        const vendorCat = vendor?.category || (p.vendor_category as string) || 'other';
        const rawCat = (p.category as string) || '';
        const displayCat = categoryMap[rawCat] || categoryMap[vendorCat] || rawCat || 'Otro';

        return {
          id: p.id as string,
          vendor_id: p.vendor_id as string,
          name: p.name as string,
          description: (p.description as string) || '',
          price: p.price as number,
          category: displayCat,
          image_url: (p.image_url as string) || null,
          in_stock: p.in_stock as boolean,
          stock_quantity: (p.stock_quantity as number) || 0,
          sold_count: soldMap[p.id as string] || (p.sold_count as number) || 0,
          is_featured: (p.is_featured as boolean) || false,
          avg_rating: (p.avg_rating as number) || 0,
          created_at: (p.created_at as string) || '',
          vendor_name: vendor?.store_name || (p.vendor_name as string) || 'Sin vendedor',
          vendor_category: vendorCat,
        };
      });

      setProducts(mapped);

      // Fetch signed URLs for product images
      const urlMap: Record<string, string> = {};
      const imagesToFetch = mapped.filter((p) => p.image_url);
      for (const p of imagesToFetch) {
        try {
          const rawPath = p.image_url!;
          if (rawPath.startsWith('http')) {
            // Already a full URL — use directly
            urlMap[p.id] = rawPath;
          } else {
            // Remove leading 'products/' prefix to avoid double-prefixing in storage
            const storagePath = rawPath.startsWith('products/')
              ? rawPath.slice('products/'.length)
              : rawPath;
            const { data: urlData } = await supabase.storage
              .from('products')
              .createSignedUrl(storagePath, 3600);
            if (urlData?.signedUrl) urlMap[p.id] = urlData.signedUrl;
            else urlMap[p.id] = rawPath;
          }
        } catch {
          urlMap[p.id] = p.image_url!;
        }
      }
      setImageSignedUrls(urlMap);
    } catch (err) {
      console.error('[AdminProducts] Error fetching products:', err);
      toast.error('Error al cargar productos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // ─── Compute dynamic categories ─────────────────────────────
  const dynamicCategories = useMemo(() => {
    const cats = new Set(products.map((p) => p.category));
    return ['Todos', ...Array.from(cats).sort()];
  }, [products]);

  // ─── Filtered + Sorted ───────────────────────────────────────
  const filtered = useMemo(() => {
    let result = products.filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.vendor_name.toLowerCase().includes(search.toLowerCase());
      const matchCat = filterCategory === 'Todos' || p.category === filterCategory;
      const matchStock =
        filterStock === 'all' ||
        (filterStock === 'in_stock' && p.in_stock) ||
        (filterStock === 'out_of_stock' && !p.in_stock);
      return matchSearch && matchCat && matchStock;
    });

    switch (sortBy) {
      case 'price_asc':
        result.sort((a, b) => a.price - b.price);
        break;
      case 'price_desc':
        result.sort((a, b) => b.price - a.price);
        break;
      case 'most_sold':
        result.sort((a, b) => b.sold_count - a.sold_count);
        break;
      default:
        // newest — already sorted by created_at desc
        break;
    }

    return result;
  }, [products, search, filterCategory, filterStock, sortBy]);

  const visibleProducts = filtered.slice(0, visibleCount);
  const hasMore = filtered.length > visibleCount;

  const totalProducts = products.length;
  const inStockCount = products.filter((p) => p.in_stock).length;
  const outOfStockCount = totalProducts - inStockCount;

  // ─── Reset page on filter change ─────────────────────────────
  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
  }, [search, filterCategory, filterStock, sortBy]);

  // ─── Bulk select helpers ─────────────────────────────────────
  const allVisibleSelected =
    visibleProducts.length > 0 &&
    visibleProducts.every((p) => bulkSelected.has(p.id));

  function toggleSelectAll() {
    if (allVisibleSelected) {
      setBulkSelected(new Set());
    } else {
      setBulkSelected(new Set(visibleProducts.map((p) => p.id)));
    }
  }

  function toggleSelect(id: string) {
    setBulkSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ─── Bulk actions ────────────────────────────────────────────
  async function handleBulkDelete() {
    if (bulkSelected.size === 0) return;
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .in('id', Array.from(bulkSelected));
      if (error) throw error;
      toast.success(`${bulkSelected.size} producto(s) eliminado(s)`);
      setBulkSelected(new Set());
      setBulkActionOpen(false);
      fetchProducts();
    } catch (err) {
      console.error(err);
      toast.error('Error al eliminar productos');
    }
  }

  async function handleBulkToggleStock() {
    if (bulkSelected.size === 0) return;
    try {
      // Set all selected to out of stock
      const { error } = await supabase
        .from('products')
        .update({ in_stock: false })
        .in('id', Array.from(bulkSelected));
      if (error) throw error;
      toast.success(`Stock desactivado para ${bulkSelected.size} producto(s)`);
      setBulkSelected(new Set());
      setBulkActionOpen(false);
      fetchProducts();
    } catch (err) {
      console.error(err);
      toast.error('Error al actualizar stock');
    }
  }

  async function handleBulkSetFeatured() {
    if (bulkSelected.size === 0) return;
    try {
      const { error } = await supabase
        .from('products')
        .update({ is_featured: true })
        .in('id', Array.from(bulkSelected));
      if (error) throw error;
      toast.success(`${bulkSelected.size} producto(s) marcado(s) como destacado(s)`);
      setBulkSelected(new Set());
      setBulkActionOpen(false);
      fetchProducts();
    } catch (err) {
      console.error(err);
      toast.error('Error al marcar productos');
    }
  }

  // ─── Form helpers ────────────────────────────────────────────
  function updateForm(patch: Partial<FormData>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  function openAddModal() {
    setForm(emptyForm);
    setSelected(null);
    setModal('add');
  }

  function openEditModal(product: ProductRow) {
    setSelected(product);
    const matchedPreset = presetCategories.includes(product.category);
    setForm({
      name: product.name,
      description: product.description,
      price: product.price.toString(),
      category: matchedPreset ? product.category : 'Otro',
      customCategory: matchedPreset ? '' : product.category,
      useCustomCategory: !matchedPreset,
      in_stock: product.in_stock,
      stock_quantity: product.stock_quantity.toString(),
      vendor_id: product.vendor_id,
      is_featured: product.is_featured,
      imageFile: null,
      imagePreview: imageSignedUrls[product.id] || product.image_url || null,
    });
    setModal('edit');
  }

  async function openDetailModal(product: ProductRow) {
    setSelected(product);
    setModal('detail');
    setDetailLoading(true);
    try {
      const { data, error } = await supabase
        .from('product_reviews')
        .select('*')
        .eq('product_id', product.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      setDetailReviews((data as ProductReview[]) || []);
    } catch {
      setDetailReviews([]);
    } finally {
      setDetailLoading(false);
    }
  }

  function openDeleteConfirm(product: ProductRow) {
    setDeleteTarget(product);
    setModal('delete');
  }

  function closeModal() {
    setModal(null);
    setSelected(null);
    setForm(emptyForm);
    setDeleteTarget(null);
  }

  // ─── Image Upload Handler ────────────────────────────────────
  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen no puede superar 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      updateForm({ imageFile: file, imagePreview: reader.result as string });
    };
    reader.readAsDataURL(file);
  }

  // ─── Submit Create/Update ────────────────────────────────────
  async function handleSubmit() {
    if (!form.name.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }
    if (!form.price || isNaN(Number(form.price)) || Number(form.price) < 0) {
      toast.error('Precio inválido');
      return;
    }
    if (!form.vendor_id) {
      toast.error('Selecciona un vendedor');
      return;
    }

    const finalCategory = form.useCustomCategory
      ? form.customCategory.trim() || 'Otro'
      : form.category;
    const stockQty = form.in_stock ? (parseInt(form.stock_quantity) || 0) : 0;

    setFormSubmitting(true);
    try {
      let imageUrl = form.imagePreview;

      // Upload new image if provided
      if (form.imageFile) {
        const ext = form.imageFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('products')
          .upload(fileName, form.imageFile);
        if (uploadErr) throw uploadErr;
        imageUrl = `products/${fileName}`;
      }

      if (modal === 'add') {
        const { error } = await supabase.from('products').insert({
          vendor_id: form.vendor_id,
          name: form.name.trim(),
          description: form.description.trim() || null,
          price: Number(form.price),
          category: reverseCategoryMap[finalCategory] || finalCategory.toLowerCase(),
          image_url: imageUrl || null,
          in_stock: form.in_stock,
          stock_quantity: stockQty,
          is_featured: form.is_featured,
        });
        if (error) throw error;
        toast.success('Producto creado exitosamente');
      } else if (modal === 'edit' && selected) {
        const updates: Record<string, unknown> = {
          name: form.name.trim(),
          description: form.description.trim() || null,
          price: Number(form.price),
          category: reverseCategoryMap[finalCategory] || finalCategory.toLowerCase(),
          in_stock: form.in_stock,
          stock_quantity: stockQty,
          is_featured: form.is_featured,
        };
        if (form.imageFile) {
          updates.image_url = imageUrl;
        }
        const { error } = await supabase
          .from('products')
          .update(updates)
          .eq('id', selected.id);
        if (error) throw error;
        toast.success('Producto actualizado exitosamente');
      }

      closeModal();
      fetchProducts();
    } catch (err) {
      console.error(err);
      toast.error('Error al guardar producto');
    } finally {
      setFormSubmitting(false);
    }
  }

  // ─── Delete Handler ──────────────────────────────────────────
  async function handleDelete() {
    if (!deleteTarget) return;
    setFormSubmitting(true);
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', deleteTarget.id);
      if (error) throw error;
      toast.success('Producto eliminado');
      closeModal();
      fetchProducts();
    } catch (err) {
      console.error(err);
      toast.error('Error al eliminar producto');
    } finally {
      setFormSubmitting(false);
    }
  }

  // ─── Render ──────────────────────────────────────────────────
  if (loading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <Breadcrumb />
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Productos</h1>
          <p className="text-gray-400 text-sm mt-1">Gestión de productos del marketplace</p>
        </div>
        <LoadingState />
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Productos</h1>
          <p className="text-gray-400 text-sm mt-1">Gestión de productos del marketplace</p>
        </div>
        <motion.button
          onClick={openAddModal}
          className="self-start inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-500 hover:to-purple-500 shadow-lg shadow-violet-500/20 transition-all"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
        >
          <Plus className="w-4 h-4" />
          Agregar Producto
        </motion.button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass rounded-xl p-4 text-center">
          <p className="text-xl font-bold text-white">{totalProducts}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">Total</p>
        </div>
        <div className="glass rounded-xl p-4 text-center">
          <p className="text-xl font-bold text-emerald-400">{inStockCount}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">En Stock</p>
        </div>
        <div className="glass rounded-xl p-4 text-center">
          <p className="text-xl font-bold text-red-400">{outOfStockCount}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">Agotados</p>
        </div>
      </div>

      {/* Search, Filters, Sort */}
      <div className="space-y-3">
        {/* Search Row */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar productos o vendedores..."
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-violet-500/50 transition-colors"
            />
          </div>
          {/* Sort dropdown */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="appearance-none bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 pr-10 text-sm text-white focus:outline-none focus:border-violet-500/50 transition-colors cursor-pointer"
            >
              {sortOptions.map((opt) => (
                <option key={opt.key} value={opt.key} className="bg-gray-900 text-white">
                  {opt.label}
                </option>
              ))}
            </select>
            <ArrowUpDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          </div>
        </div>

        {/* Filter pills */}
        <div className="flex flex-wrap gap-2">
          {/* Category pills */}
          <div className="flex items-center gap-1.5 mr-2">
            <Filter className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">Categoría:</span>
          </div>
          {dynamicCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                filterCategory === cat
                  ? 'bg-violet-500/15 text-violet-400 border border-violet-500/30'
                  : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
              }`}
            >
              {cat}
            </button>
          ))}

          <div className="w-px h-6 bg-white/10 mx-1" />

          {/* Stock pills */}
          <div className="flex items-center gap-1.5 mr-2">
            <Package className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">Stock:</span>
          </div>
          {stockFilters.map((sf) => (
            <button
              key={sf.key}
              onClick={() => setFilterStock(sf.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                filterStock === sf.key
                  ? 'bg-violet-500/15 text-violet-400 border border-violet-500/30'
                  : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
              }`}
            >
              {sf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk Actions Bar */}
      <AnimatePresence>
        {bulkSelected.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass rounded-xl p-3 flex items-center justify-between flex-wrap gap-3"
          >
            <div className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-violet-400" />
              <span className="text-sm text-white font-medium">
                {bulkSelected.size} seleccionado(s)
              </span>
            </div>
            <div className="relative">
              <button
                onClick={() => setBulkActionOpen(!bulkActionOpen)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-violet-500/15 text-violet-400 border border-violet-500/30 hover:bg-violet-500/25 transition-colors"
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
                Acciones masivas
                <ChevronDown className="w-3 h-3" />
              </button>
              <AnimatePresence>
                {bulkActionOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="absolute right-0 z-40 mt-1 w-52 bg-gray-900 border border-white/10 rounded-xl shadow-xl overflow-hidden"
                  >
                    <button
                      onClick={handleBulkDelete}
                      className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-white/5 flex items-center gap-2 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Eliminar seleccionados
                    </button>
                    <button
                      onClick={handleBulkToggleStock}
                      className="w-full text-left px-4 py-2.5 text-sm text-amber-400 hover:bg-white/5 flex items-center gap-2 transition-colors"
                    >
                      <ToggleLeft className="w-4 h-4" />
                      Desactivar stock
                    </button>
                    <button
                      onClick={handleBulkSetFeatured}
                      className="w-full text-left px-4 py-2.5 text-sm text-violet-400 hover:bg-white/5 flex items-center gap-2 transition-colors"
                    >
                      <Sparkles className="w-4 h-4" />
                      Marcar destacados
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <button
              onClick={() => setBulkSelected(new Set())}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Limpiar selección
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Select All */}
      {filtered.length > 0 && (
        <div className="flex items-center gap-2">
          <button onClick={toggleSelectAll} className="flex items-center gap-2 text-xs text-gray-400 hover:text-white transition-colors">
            {allVisibleSelected ? (
              <CheckSquare className="w-4 h-4 text-violet-400" />
            ) : (
              <Square className="w-4 h-4" />
            )}
            Seleccionar todos ({filtered.length})
          </button>
        </div>
      )}

      {/* Product Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <AnimatePresence mode="popLayout">
          {visibleProducts.map((product, i) => (
            <motion.div
              key={product.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: Math.min(i * 0.03, 0.3) }}
              className={`glass rounded-2xl overflow-hidden group transition-all duration-300 ${
                bulkSelected.has(product.id)
                  ? 'ring-2 ring-violet-500 shadow-lg shadow-violet-500/10'
                  : 'hover:shadow-lg hover:shadow-violet-500/5'
              }`}
            >
              {/* Image / Category header */}
              <div className="relative h-36 overflow-hidden">
                {product.image_url && imageSignedUrls[product.id] ? (
                  <img
                    src={imageSignedUrls[product.id]}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className={`w-full h-full bg-gradient-to-br ${categoryColors[product.category] || categoryColors['Otro']} flex items-center justify-center`}>
                    <Package className="w-10 h-10 opacity-50" />
                  </div>
                )}
                {/* Overlays */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />

                {/* Checkbox */}
                <div className="absolute top-3 left-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelect(product.id);
                    }}
                    className="p-1 rounded-md bg-black/30 backdrop-blur-sm hover:bg-black/50 transition-colors"
                  >
                    {bulkSelected.has(product.id) ? (
                      <CheckSquare className="w-4 h-4 text-violet-400" />
                    ) : (
                      <Square className="w-4 h-4 text-white/60" />
                    )}
                  </button>
                </div>

                {/* Stock indicator */}
                <div
                  className={`absolute top-3 right-3 flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium backdrop-blur-sm ${
                    product.in_stock
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full ${product.in_stock ? 'bg-emerald-400' : 'bg-red-400'}`} />
                  {product.in_stock ? 'En stock' : 'Agotado'}
                </div>

                {/* Featured badge */}
                {product.is_featured && (
                  <div className="absolute bottom-3 left-3 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/20 text-amber-400 backdrop-blur-sm">
                    <Sparkles className="w-3 h-3" />
                    Destacado
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="text-sm font-semibold text-white truncate flex-1">{product.name}</h3>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border shrink-0 ${
                    categoryBadgeColors[product.category] || categoryBadgeColors['Otro']
                  }`}>
                    {product.category}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 mb-3">
                  <Store className="w-3 h-3 text-gray-500" />
                  <span className="text-[11px] text-gray-400 truncate">{product.vendor_name}</span>
                </div>

                <div className="flex items-center justify-between mb-3">
                  <p className="text-lg font-bold text-white">{formatCRC(product.price)}</p>
                  <p className="text-[11px] text-gray-500 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    {product.sold_count} vendidos
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-3 border-t border-white/10">
                  <motion.button
                    onClick={() => openDetailModal(product)}
                    className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-medium text-violet-400 bg-violet-500/10 hover:bg-violet-500/20 transition-colors"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Eye className="w-3 h-3" />
                    Ver
                  </motion.button>
                  <motion.button
                    onClick={() => openEditModal(product)}
                    className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-medium text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 transition-colors"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Pencil className="w-3 h-3" />
                    Editar
                  </motion.button>
                  <motion.button
                    onClick={() => openDeleteConfirm(product)}
                    className="flex items-center justify-center p-2 rounded-lg text-xs font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </motion.button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Empty State */}
      {filtered.length === 0 && !loading && (
        <div className="text-center py-16">
          <Package className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No se encontraron productos</p>
          <p className="text-gray-600 text-xs mt-1">Intenta ajustar los filtros de búsqueda</p>
        </div>
      )}

      {/* Load More */}
      {hasMore && (
        <div className="flex justify-center">
          <motion.button
            onClick={() => setVisibleCount((prev) => prev + ITEMS_PER_PAGE)}
            className="px-6 py-2.5 rounded-xl text-sm font-medium bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 transition-colors flex items-center gap-2"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            Cargar más
            <ChevronDown className="w-4 h-4" />
          </motion.button>
        </div>
      )}

      {/* ═══════════ MODALS ═══════════ */}

      {/* Add / Edit Modal */}
      <AnimatePresence>
        {(modal === 'add' || modal === 'edit') && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeModal} />
            <motion.div
              className="relative w-full max-w-lg glass-strong rounded-2xl z-10 max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
            >
              <div className="flex items-center justify-between p-6 pb-0">
                <h2 className="text-lg font-bold text-white">
                  {modal === 'add' ? 'Agregar Producto' : 'Editar Producto'}
                </h2>
                <button onClick={closeModal} className="text-gray-400 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Nombre *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => updateForm({ name: e.target.value })}
                    placeholder="Nombre del producto"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-violet-500/50 transition-colors"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Descripción</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => updateForm({ description: e.target.value })}
                    placeholder="Descripción del producto..."
                    rows={3}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-violet-500/50 transition-colors resize-none"
                  />
                </div>

                {/* Price + Category row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Precio (₡) *</label>
                    <input
                      type="number"
                      value={form.price}
                      onChange={(e) => updateForm({ price: e.target.value })}
                      placeholder="0"
                      min="0"
                      step="1"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-violet-500/50 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Categoría *</label>
                    {!form.useCustomCategory ? (
                      <div className="relative">
                        <select
                          value={form.category}
                          onChange={(e) => updateForm({ category: e.target.value })}
                          className="w-full appearance-none bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/50 transition-colors cursor-pointer"
                        >
                          {presetCategories.map((cat) => (
                            <option key={cat} value={cat} className="bg-gray-900 text-white">
                              {cat}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => updateForm({ useCustomCategory: true })}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-violet-400 hover:text-violet-300"
                          title="Categoría personalizada"
                        >
                          +Custom
                        </button>
                      </div>
                    ) : (
                      <div className="relative">
                        <input
                          type="text"
                          value={form.customCategory}
                          onChange={(e) => updateForm({ customCategory: e.target.value })}
                          placeholder="Categoría custom..."
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-violet-500/50 transition-colors pr-16"
                        />
                        <button
                          type="button"
                          onClick={() => updateForm({ useCustomCategory: false })}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 hover:text-white"
                        >
                          Lista
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Vendor Selector */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Vendedor *</label>
                  <VendorSelector
                    value={form.vendor_id}
                    onChange={(id) => updateForm({ vendor_id: id })}
                  />
                </div>

                {/* Image Upload */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Imagen</label>
                  <div className="relative">
                    {form.imagePreview ? (
                      <div className="relative rounded-xl overflow-hidden h-40">
                        <img
                          src={form.imagePreview}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => updateForm({ imageFile: null, imagePreview: null })}
                          className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 text-white hover:bg-black/70 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-white/10 rounded-xl cursor-pointer hover:border-violet-500/30 hover:bg-violet-500/5 transition-all group">
                        <Upload className="w-8 h-8 text-gray-500 group-hover:text-violet-400 transition-colors mb-2" />
                        <span className="text-xs text-gray-500 group-hover:text-violet-400 transition-colors">
                          Subir imagen (max 5MB)
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </div>

                {/* Stock + Featured toggles */}
                <div className="space-y-3">
                  {/* In Stock Toggle */}
                  <div className="flex items-center justify-between p-3 bg-white/[0.03] rounded-xl">
                    <div className="flex items-center gap-2">
                      {form.in_stock ? (
                        <ToggleRight className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <ToggleLeft className="w-5 h-5 text-gray-500" />
                      )}
                      <span className="text-sm text-white">En stock</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateForm({ in_stock: !form.in_stock })}
                      className={`relative w-11 h-6 rounded-full transition-colors ${
                        form.in_stock ? 'bg-emerald-500' : 'bg-gray-600'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                          form.in_stock ? 'translate-x-5' : ''
                        }`}
                      />
                    </button>
                  </div>

                  {/* Stock Quantity */}
                  {form.in_stock && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">Cantidad en stock</label>
                      <input
                        type="number"
                        value={form.stock_quantity}
                        onChange={(e) => updateForm({ stock_quantity: e.target.value })}
                        placeholder="0"
                        min="0"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-violet-500/50 transition-colors"
                      />
                    </motion.div>
                  )}

                  {/* Featured Toggle */}
                  <div className="flex items-center justify-between p-3 bg-white/[0.03] rounded-xl">
                    <div className="flex items-center gap-2">
                      <Sparkles className={`w-5 h-5 ${form.is_featured ? 'text-amber-400' : 'text-gray-500'}`} />
                      <span className="text-sm text-white">Destacado</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateForm({ is_featured: !form.is_featured })}
                      className={`relative w-11 h-6 rounded-full transition-colors ${
                        form.is_featured ? 'bg-amber-500' : 'bg-gray-600'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                          form.is_featured ? 'translate-x-5' : ''
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Submit */}
                <div className="flex gap-3 pt-2">
                  <motion.button
                    onClick={handleSubmit}
                    disabled={formSubmitting}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-500 hover:to-purple-500 shadow-lg shadow-violet-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {formSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : modal === 'add' ? (
                      <Plus className="w-4 h-4" />
                    ) : (
                      <Pencil className="w-4 h-4" />
                    )}
                    {modal === 'add' ? 'Crear Producto' : 'Guardar Cambios'}
                  </motion.button>
                  <button
                    onClick={closeModal}
                    className="px-6 py-3 rounded-xl text-sm font-medium text-gray-400 bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detail Modal */}
      <AnimatePresence>
        {modal === 'detail' && selected && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeModal} />
            <motion.div
              className="relative w-full max-w-lg glass-strong rounded-2xl z-10 max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
            >
              {/* Image */}
              <div className="relative h-48 overflow-hidden rounded-t-2xl">
                {selected.image_url && imageSignedUrls[selected.id] ? (
                  <img
                    src={imageSignedUrls[selected.id]}
                    alt={selected.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className={`w-full h-full bg-gradient-to-br ${categoryColors[selected.category] || categoryColors['Otro']} flex items-center justify-center`}>
                    <ImageIcon className="w-12 h-12 opacity-40" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <button onClick={closeModal} className="absolute top-4 left-4 p-1.5 rounded-lg bg-black/40 text-white hover:bg-black/60 transition-colors">
                  <X className="w-5 h-5" />
                </button>
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="flex items-center gap-2 mb-1">
                    {selected.is_featured && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/30 text-amber-300">
                        <Sparkles className="w-3 h-3" />
                        Destacado
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        selected.in_stock
                          ? 'bg-emerald-500/30 text-emerald-300'
                          : 'bg-red-500/30 text-red-300'
                      }`}
                    >
                      {selected.in_stock ? 'En stock' : 'Agotado'}
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-white">{selected.name}</h2>
                </div>
              </div>

              <div className="p-6 space-y-4">
                {/* Description */}
                {selected.description && (
                  <p className="text-sm text-gray-300 leading-relaxed">{selected.description}</p>
                )}

                {/* Info grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="glass rounded-xl p-3">
                    <p className="text-[11px] text-gray-500 mb-1">Precio</p>
                    <p className="text-sm font-bold text-white">{formatCRC(selected.price)}</p>
                  </div>
                  <div className="glass rounded-xl p-3">
                    <p className="text-[11px] text-gray-500 mb-1">Categoría</p>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                      categoryBadgeColors[selected.category] || categoryBadgeColors['Otro']
                    }`}>
                      {selected.category}
                    </span>
                  </div>
                  <div className="glass rounded-xl p-3">
                    <p className="text-[11px] text-gray-500 mb-1">Vendedor</p>
                    <p className="text-sm text-white font-medium truncate">{selected.vendor_name}</p>
                  </div>
                  <div className="glass rounded-xl p-3">
                    <p className="text-[11px] text-gray-500 mb-1">Stock</p>
                    <p className="text-sm text-white font-medium">
                      {selected.in_stock ? `${selected.stock_quantity} unidades` : 'Agotado'}
                    </p>
                  </div>
                </div>

                {/* Stats row */}
                <div className="glass rounded-xl p-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-lg font-bold text-violet-400">{selected.sold_count}</p>
                      <p className="text-[10px] text-gray-500">Vendidos</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-emerald-400">{formatCRC(selected.price * selected.sold_count)}</p>
                      <p className="text-[10px] text-gray-500">Ingresos est.</p>
                    </div>
                    <div>
                      <div className="flex justify-center">
                        <StarRating rating={selected.avg_rating} />
                      </div>
                      <p className="text-[10px] text-gray-500 mt-1">Calificación</p>
                    </div>
                  </div>
                </div>

                {/* Reviews */}
                <div>
                  <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                    <Star className="w-4 h-4 text-amber-400" />
                    Reseñas ({detailReviews.length})
                  </h3>
                  {detailLoading ? (
                    <div className="space-y-2">
                      {[1, 2].map((i) => (
                        <div key={i} className="animate-pulse bg-white/5 rounded-lg p-3">
                          <div className="h-3 bg-white/5 rounded w-3/4 mb-2" />
                          <div className="h-3 bg-white/5 rounded w-1/2" />
                        </div>
                      ))}
                    </div>
                  ) : detailReviews.length === 0 ? (
                    <p className="text-xs text-gray-500 text-center py-4">
                      No hay reseñas para este producto
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {detailReviews.map((review) => (
                        <div key={review.id} className="bg-white/[0.03] rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1">
                            <StarRating rating={review.rating} />
                            <span className="text-[10px] text-gray-500">
                              {review.created_at
                                ? new Date(review.created_at).toLocaleDateString('es-CR')
                                : ''}
                            </span>
                          </div>
                          {review.comment && (
                            <p className="text-xs text-gray-300">{review.comment}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <motion.button
                    onClick={() => {
                      closeModal();
                      setTimeout(() => openEditModal(selected), 100);
                    }}
                    className="flex-1 py-3 rounded-xl text-sm font-medium text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 transition-colors flex items-center justify-center gap-2"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Pencil className="w-4 h-4" />
                    Editar
                  </motion.button>
                  <motion.button
                    onClick={() => {
                      closeModal();
                      setTimeout(() => openDeleteConfirm(selected), 100);
                    }}
                    className="flex-1 py-3 rounded-xl text-sm font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-colors flex items-center justify-center gap-2"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Trash2 className="w-4 h-4" />
                    Eliminar
                  </motion.button>
                </div>

                <button
                  onClick={closeModal}
                  className="w-full py-3 rounded-xl text-sm font-medium text-gray-400 bg-white/5 hover:bg-white/10 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {modal === 'delete' && deleteTarget && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeModal} />
            <motion.div
              className="relative w-full max-w-sm glass-strong rounded-2xl p-6 z-10"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-full bg-red-500/15 flex items-center justify-center mb-4">
                  <AlertTriangle className="w-7 h-7 text-red-400" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Eliminar Producto</h3>
                <p className="text-sm text-gray-400 mb-1">
                  ¿Estás seguro de eliminar
                </p>
                <p className="text-sm text-white font-medium mb-6">"{deleteTarget.name}"?</p>
                <p className="text-xs text-gray-500 mb-6">
                  Esta acción no se puede deshacer. El producto será eliminado permanentemente.
                </p>
                <div className="flex gap-3 w-full">
                  <button
                    onClick={closeModal}
                    className="flex-1 py-3 rounded-xl text-sm font-medium text-gray-400 bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    Cancelar
                  </button>
                  <motion.button
                    onClick={handleDelete}
                    disabled={formSubmitting}
                    className="flex-1 py-3 rounded-xl text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {formSubmitting ? (
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

// ─── Breadcrumb Component ───────────────────────────────────────
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
      <span className="text-white font-medium">Productos</span>
    </nav>
  );
}
