'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, Edit3, Trash2, Package, ImageIcon, X, Loader2,
  Star, ShoppingBag, AlertTriangle, ToggleLeft, ToggleRight,
  ChevronDown, ArrowUpDown, Check, CheckSquare, Square,
  Filter, Sparkles, Eye, EyeOff, UploadCloud, FileSpreadsheet,
  ArrowUp, ArrowDown, LayoutGrid, List, TrendingUp,
  Clock, Calendar, Tag, DollarSign, FileText, Download,
  Upload, ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { useVendorId } from '@/hooks/useVendorId';
import { Progress } from '@/components/ui/progress';

/* ══════════════════════════════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════════════════════════════ */

function formatCRC(amount: number): string {
  return `₡${Math.round(amount).toLocaleString('es-CR')}`;
}

function renderStars(rating: number) {
  const stars: React.ReactNode[] = [];
  const full = Math.floor(rating);
  const hasHalf = rating - full >= 0.25;
  for (let i = 0; i < 5; i++) {
    if (i < full) {
      stars.push(<Star key={i} className="w-3 h-3 fill-amber-500 text-amber-600" />);
    } else if (i === full && hasHalf) {
      stars.push(<Star key={i} className="w-3 h-3 fill-amber-500/50 text-amber-600" />);
    } else {
      stars.push(<Star key={i} className="w-3 h-3 text-gray-300" />);
    }
  }
  return stars;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Ahora';
  if (mins < 60) return `Hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `Hace ${days}d`;
  const months = Math.floor(days / 30);
  return `Hace ${months}m`;
}

/* ══════════════════════════════════════════════════════════════════
   CSV PARSER
   ══════════════════════════════════════════════════════════════════ */

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        current.push(field.trim());
        field = '';
      } else if (char === '\n' || (char === '\r' && next === '\n')) {
        current.push(field.trim());
        field = '';
        if (current.some((c) => c.length > 0)) {
          rows.push(current);
        }
        current = [];
        if (char === '\r') i++;
      } else if (char === '\r') {
        current.push(field.trim());
        field = '';
        if (current.some((c) => c.length > 0)) {
          rows.push(current);
        }
        current = [];
      } else {
        field += char;
      }
    }
  }
  current.push(field.trim());
  if (current.some((c) => c.length > 0)) {
    rows.push(current);
  }
  return rows;
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9_]/g, '').trim();
}

const CSV_HEADERS = ['nombre', 'descripcion', 'precio', 'categoria', 'en_stock'];

function mapCSVHeaders(rawHeaders: string[]): Map<number, string> {
  const mapping = new Map<number, string>();
  for (let i = 0; i < rawHeaders.length; i++) {
    const norm = normalizeHeader(rawHeaders[i]);
    const match = CSV_HEADERS.find((h) => norm === h || norm === h.replace('_', ''));
    if (match) mapping.set(i, match);
  }
  return mapping;
}

/* ══════════════════════════════════════════════════════════════════
   TYPES
   ══════════════════════════════════════════════════════════════════ */

type StatusFilter = 'all' | 'in_stock' | 'out_of_stock' | 'featured';
type SortOption = 'newest' | 'price_asc' | 'price_desc' | 'most_sold' | 'name_asc';
type ViewMode = 'grid' | 'table';
type PanelTab = 'products' | 'csv';

interface ProductRow {
  id: string;
  vendor_id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  image_url: string | null;
  image_path: string | null;
  in_stock: boolean;
  stock_quantity: number;
  sold_count: number;
  is_featured: boolean;
  avg_rating: number;
  created_at: string;
  updated_at: string;
}

interface FormData {
  name: string;
  description: string;
  price: string;
  category: string;
  inStock: boolean;
  stockQuantity: string;
  isFeatured: boolean;
}

interface ParsedCSVRow {
  row: number;
  nombre: string;
  descripcion: string;
  precio: string;
  categoria: string;
  en_stock: string;
  valid: boolean;
  errors: string[];
}

const emptyForm: FormData = {
  name: '',
  description: '',
  price: '',
  category: '',
  inStock: true,
  stockQuantity: '10',
  isFeatured: false,
};

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

function ProductSkeleton() {
  return (
    <div className="glass rounded-2xl overflow-hidden animate-pulse">
      <div className="h-52 bg-gray-200 relative">
        <div className="absolute top-3 left-3 w-16 h-5 bg-gray-200 rounded-full" />
        <div className="absolute top-3 right-3 w-14 h-5 bg-gray-200 rounded-full" />
        <div className="absolute bottom-3 right-3 w-20 h-6 bg-gray-200 rounded-lg" />
      </div>
      <div className="p-4 space-y-3">
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-200 rounded w-full" />
        <div className="h-3 bg-gray-200 rounded w-1/2" />
      </div>
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="glass rounded-xl p-3.5">
          <div className="h-4 w-20 bg-gray-200 rounded" />
          <div className="h-6 w-12 bg-gray-200 rounded mt-2" />
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   QUICK VIEW MODAL
   ══════════════════════════════════════════════════════════════════ */

function QuickViewModal({ product, onClose, onEdit }: { product: ProductRow; onClose: () => void; onEdit: () => void }) {
  const imgSrc = product.image_url || null;

  return (
    <motion.div className="fixed inset-0 z-[55] flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="relative w-full max-w-md glass-strong rounded-2xl z-10 overflow-hidden"
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      >
        <div className="relative h-56 bg-gradient-to-br from-white/5 to-white/[0.02]">
          {imgSrc ? (
            <img src={imgSrc} alt={product.name} className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center"><ImageIcon className="w-16 h-16 text-gray-400" /></div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          <button onClick={onClose} className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-red-500 transition-colors">
            <X className="w-4 h-4" />
          </button>
          <div className="absolute bottom-3 left-3 right-3 z-10 flex items-end justify-between">
            <div className="flex items-center gap-2">
              {product.is_featured && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-amber-100 border border-amber-200 text-amber-600 backdrop-blur-sm">
                  <Sparkles className="w-3 h-3" /> Destacado
                </span>
              )}
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium backdrop-blur-sm ${product.in_stock ? 'bg-emerald-100 text-emerald-600 border border-emerald-200' : 'bg-red-100 text-red-600 border border-red-200'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${product.in_stock ? 'bg-emerald-500' : 'bg-red-500'}`} />
                {product.in_stock ? 'En stock' : 'Agotado'}
              </span>
            </div>
            <span className="text-xl font-bold text-white drop-shadow-lg">{formatCRC(product.price)}</span>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{product.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-600 border border-amber-200">
                <Tag className="w-2.5 h-2.5" /> {product.category}
              </span>
              <span className="text-[11px] text-gray-400">{product.stock_quantity} uds</span>
            </div>
          </div>
          {product.description && <p className="text-sm text-gray-500 leading-relaxed">{product.description}</p>}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-gray-900">{product.sold_count}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Vendidos</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-green-600">{formatCRC(product.price * product.sold_count)}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Ingresos</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <div className="flex items-center justify-center gap-0.5">
                {product.avg_rating > 0 ? (<><div className="flex">{renderStars(product.avg_rating)}</div><span className="text-[11px] text-gray-500 ml-1">{product.avg_rating.toFixed(1)}</span></>) : (<span className="text-xs text-gray-300">N/A</span>)}
              </div>
              <p className="text-[10px] text-gray-400 mt-0.5">Rating</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-gray-300">
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Creado: {new Date(product.created_at).toLocaleDateString('es-CR')}</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {timeAgo(product.updated_at)}</span>
          </div>
          <div className="flex gap-3">
            <motion.button onClick={onEdit} className="flex-1 btn-neon text-white py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Edit3 className="w-4 h-4" /> Editar
            </motion.button>
            <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm text-gray-500 bg-gray-50 hover:bg-gray-100 transition-colors">Cerrar</button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════════ */

export default function ProductsPage() {
  const { user } = useAuthStore();
  const { vendorId, loading: vendorLoading } = useVendorId();

  /* ── State ─────────────────────────────────────────────────── */
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbCategories, setDbCategories] = useState<{ name: string; is_active: boolean; sort_order: number }[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [activeTab, setActiveTab] = useState<PanelTab>('products');

  // Filters & sort
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductRow | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showCustomCategory, setShowCustomCategory] = useState(false);
  const [customCategory, setCustomCategory] = useState('');

  // Quick view
  const [quickViewProduct, setQuickViewProduct] = useState<ProductRow | null>(null);

  // Delete
  const [deletingProduct, setDeletingProduct] = useState<ProductRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Bulk
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<'stock' | 'featured' | 'delete' | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Image URLs cache
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  // CSV state
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [csvDragging, setCsvDragging] = useState(false);
  const [csvParsed, setCsvParsed] = useState<ParsedCSVRow[]>([]);
  const [csvFileName, setCsvFileName] = useState('');
  const [csvValidCount, setCsvValidCount] = useState(0);
  const [csvInvalidCount, setCsvInvalidCount] = useState(0);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvProgress, setCsvProgress] = useState(0);
  const [showCsvPreview, setShowCsvPreview] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  /* ── Category helpers ─────────────────────────────────────── */
  const categoryNames = useMemo(() => {
    const names = new Set<string>();
    dbCategories.filter((c) => c.is_active).sort((a, b) => a.sort_order - b.sort_order).forEach((c) => names.add(c.name));
    products.forEach((p) => { if (p.category) names.add(p.category); });
    return Array.from(names).sort();
  }, [dbCategories, products]);

  /* ── Load products via Dual Strategy (Direct + RPC) ────────────── */
  const loadProducts = useCallback(async () => {
    console.log('[loadProducts] called, vendorId:', vendorId);
    if (!vendorId) return;
    setLoading(true);
    try {
      let rawData: Record<string, any>[] = [];
      
      // Strategy 1: Direct Query
      const { data: directData, error: directError } = await supabase
        .from('products')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });

      if (!directError && directData) {
        rawData = directData;
        console.log('[loadProducts] Direct query success:', rawData.length);
      } else {
        // Strategy 2: RPC Fallback
        console.warn('[loadProducts] Direct failed, trying RPC:', directError?.message);
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_vendor_products', { p_vendor_id: vendorId });
        if (rpcError) {
          console.error('[loadProducts] RPC also failed:', rpcError);
          throw rpcError;
        }
        rawData = rpcData || [];
      }

      const rows: ProductRow[] = rawData.map((p) => ({
        id: p.id as string,
        vendor_id: p.vendor_id as string,
        name: p.name as string,
        description: (p.description as string) || null,
        price: Number(p.price) || 0,
        category: (p.category as string) || 'General',
        image_url: (p.image_url as string) || null,
        image_path: (p.image_path as string) || null,
        in_stock: Boolean(p.in_stock),
        stock_quantity: Number(p.stock_quantity) || 0,
        sold_count: Number(p.sold_count) || 0,
        is_featured: Boolean(p.is_featured),
        avg_rating: Number(p.avg_rating) || 0,
        created_at: p.created_at as string || new Date().toISOString(),
        updated_at: p.updated_at as string || new Date().toISOString(),
      }));
      
      setProducts(rows);

      // Load signed URLs for images
      const urlMap: Record<string, string> = {};
      for (const row of rows) {
        if (row.image_path) {
          try {
            const { data: urlData } = await supabase.storage.from('products').createSignedUrl(row.image_path, 3600);
            if (urlData?.signedUrl) urlMap[row.id] = urlData.signedUrl;
            else if (row.image_url) urlMap[row.id] = row.image_url;
          } catch {
            if (row.image_url) urlMap[row.id] = row.image_url;
          }
        } else if (row.image_url) {
          urlMap[row.id] = row.image_url;
        }
      }
      setSignedUrls(urlMap);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cargar productos';
      toast.error(msg);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  /* ── Load categories ────────────────────────────────────── */
  const loadCategories = useCallback(async () => {
    try {
      const { data } = await supabase.from('marketplace_categories').select('name, is_active, sort_order').eq('is_active', true).order('sort_order', { ascending: true });
      if (data) setDbCategories(data);
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => {
    console.log('[ProductsPage] vendorId:', vendorId, 'vendorLoading:', vendorLoading);
    if (vendorId) {
      loadProducts();
      loadCategories();
    } else if (!vendorLoading) {
      // vendorId es null y ya terminó de cargar — evitar loading infinito
      console.warn('[ProductsPage] vendorId is null and loading done — showing empty state');
      setLoading(false);
    }
  }, [vendorId, vendorLoading, loadProducts, loadCategories]);

  /* ── Stats ──────────────────────────────────────────────── */
  const stats = useMemo(() => {
    const total = products.length;
    const inStock = products.filter((p) => p.in_stock).length;
    const outOfStock = products.filter((p) => !p.in_stock).length;
    const featured = products.filter((p) => p.is_featured).length;
    const totalSold = products.reduce((sum, p) => sum + p.sold_count, 0);
    const totalRevenue = products.reduce((sum, p) => sum + (p.price * p.sold_count), 0);
    return { total, inStock, outOfStock, featured, totalSold, totalRevenue };
  }, [products]);

  /* ── Filtered + Sorted ──────────────────────────────────── */
  const filtered = useMemo(() => {
    let result = [...products];
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter((p) => p.name.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q)) || p.category.toLowerCase().includes(q));
    }
    if (filterCategory !== 'all') result = result.filter((p) => p.category === filterCategory);
    switch (filterStatus) {
      case 'in_stock': result = result.filter((p) => p.in_stock); break;
      case 'out_of_stock': result = result.filter((p) => !p.in_stock); break;
      case 'featured': result = result.filter((p) => p.is_featured); break;
    }
    switch (sortBy) {
      case 'newest': result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()); break;
      case 'price_asc': result.sort((a, b) => a.price - b.price); break;
      case 'price_desc': result.sort((a, b) => b.price - a.price); break;
      case 'most_sold': result.sort((a, b) => b.sold_count - a.sold_count); break;
      case 'name_asc': result.sort((a, b) => a.name.localeCompare(b.name)); break;
    }
    return result;
  }, [products, search, filterCategory, filterStatus, sortBy]);

  /* ── Bulk selection ─────────────────────────────────────── */
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map((p) => p.id)));
  };

  /* ── Image upload ───────────────────────────────────────── */
  const handleImageSelect = useCallback((file: File) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { toast.error('Solo JPG, PNG y WebP'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Imagen maximo 5MB'); return; }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) handleImageSelect(file); }, [handleImageSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); dropZoneRef.current?.classList.add('border-green-300', 'bg-green-50'); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); dropZoneRef.current?.classList.remove('border-green-300', 'bg-green-50'); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); dropZoneRef.current?.classList.remove('border-green-300', 'bg-green-50'); const file = e.dataTransfer.files?.[0]; if (file) handleImageSelect(file); }, [handleImageSelect]);

  const clearImage = () => { setImageFile(null); setImagePreview(null); if (fileInputRef.current) fileInputRef.current.value = ''; };

  const uploadProductImage = async (productId: string, file: File): Promise<{ url: string; path: string } | null> => {
    setUploadingImage(true);
    setUploadProgress(0);
    try {
      const progressInterval = setInterval(() => { setUploadProgress((prev) => { if (prev >= 90) { clearInterval(progressInterval); return 90; } return prev + 15; }); }, 200);
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `products/${vendorId}/${productId}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('products').upload(path, file, { upsert: true, contentType: file.type });
      clearInterval(progressInterval);
      setUploadProgress(100);
      if (uploadError) throw uploadError;
      const { data: urlData } = await supabase.storage.from('products').createSignedUrl(path, 3600);
      if (!urlData?.signedUrl) throw new Error('No se pudo generar URL firmada');
      return { url: urlData.signedUrl, path };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error subiendo imagen';
      toast.error(msg);
      return null;
    } finally {
      setTimeout(() => { setUploadingImage(false); setUploadProgress(0); }, 500);
    }
  };

  const deleteOldImage = async (productId: string) => {
    try {
      const product = products.find((p) => p.id === productId);
      if (!product?.image_path) return;
      const { data: files } = await supabase.storage.from('products').list(`products/${vendorId}`);
      if (files) {
        const productFiles = files.filter((f) => f.name.startsWith(productId));
        for (const pf of productFiles) {
          await supabase.storage.from('products').remove([`products/${vendorId}/${pf.name}`]);
        }
      }
    } catch { /* non-critical */ }
  };

  /* ── CRUD Operations (via RPCs) ─────────────────────────── */

  const openAddModal = () => {
    setEditingProduct(null);
    setFormData({ ...emptyForm, category: categoryNames[0] || '' });
    setImageFile(null);
    setImagePreview(null);
    setShowCustomCategory(false);
    setCustomCategory('');
    setShowModal(true);
  };

  const openEditModal = (product: ProductRow) => {
    setQuickViewProduct(null);
    setEditingProduct(product);
    setFormData({ name: product.name, description: product.description || '', price: product.price.toString(), category: product.category, inStock: product.in_stock, stockQuantity: product.stock_quantity?.toString() || '0', isFeatured: product.is_featured });
    setImageFile(null);
    setImagePreview(signedUrls[product.id] || product.image_url || null);
    setShowCustomCategory(false);
    setCustomCategory('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) { toast.error('El nombre es obligatorio'); return; }
    if (!formData.price || isNaN(Number(formData.price)) || Number(formData.price) <= 0) { toast.error('Ingresa un precio valido'); return; }
    const cat = showCustomCategory ? customCategory.trim() : formData.category;
    if (!cat.trim()) { toast.error('La categoria es obligatoria'); return; }

    setSaving(true);
    try {
      if (editingProduct) {
        // Upload image first if needed
        let imageUrl: string | undefined;
        let imagePath: string | undefined;
        if (imageFile) {
          const result = await uploadProductImage(editingProduct.id, imageFile);
          if (result) { imageUrl = result.url; imagePath = result.path; }
        } else if (imagePreview === null && (editingProduct.image_url || editingProduct.image_path)) {
          await deleteOldImage(editingProduct.id);
          imageUrl = undefined;
          imagePath = undefined;
        }

        console.log('[handleSave] update_vendor_product params:', { p_product_id: editingProduct.id, p_vendor_id: vendorId });
        const { data: updated, error } = await supabase.rpc('update_vendor_product', {
          p_product_id: editingProduct.id,
          p_vendor_id: vendorId,
          p_name: formData.name.trim(),
          p_description: formData.description.trim() || null,
          p_price: Number(formData.price),
          p_category: cat.trim(),
          p_in_stock: formData.inStock,
          p_stock_quantity: formData.inStock ? Number(formData.stockQuantity) || 0 : 0,
          p_is_featured: formData.isFeatured,
          p_image_url: imageUrl ?? undefined,
          p_image_path: imagePath ?? undefined,
        });
        if (error) {
          console.error('[handleSave] update RPC error:', JSON.stringify(error, null, 2));
          throw error;
        }

        if (updated && updated.length > 0) {
          const u = updated[0];
          setProducts((prev) => prev.map((p) => p.id === editingProduct.id ? {
            ...p,
            name: u.name, description: u.description, price: Number(u.price),
            category: u.category, in_stock: u.in_stock, stock_quantity: u.stock_quantity,
            is_featured: u.is_featured, image_url: u.image_url, image_path: u.image_path, updated_at: u.updated_at,
          } : p));
          if (imageUrl) setSignedUrls((prev) => ({ ...prev, [editingProduct.id]: imageUrl }));
          else if (imagePreview === null) setSignedUrls((prev) => { const next = { ...prev }; delete next[editingProduct.id]; return next; });
        }
        toast.success('Producto actualizado');
      } else {
        // Insert via RPC
        const { data: newProduct, error } = await supabase.rpc('insert_vendor_product', {
          p_vendor_id: vendorId,
          p_name: formData.name.trim(),
          p_description: formData.description.trim() || null,
          p_price: Number(formData.price),
          p_category: cat.trim(),
          p_in_stock: formData.inStock,
          p_stock_quantity: formData.inStock ? Number(formData.stockQuantity) || 0 : 0,
          p_is_featured: formData.isFeatured,
        });
        if (error) {
          console.error('[handleSave] insert RPC error:', JSON.stringify(error, null, 2));
          throw error;
        }

        const np = Array.isArray(newProduct) ? newProduct[0] : newProduct;
        if (!np) throw new Error('No se recibio el producto creado');

        let imageUrl: string | null = null;
        let imagePath: string | null = null;
        if (imageFile) {
          const result = await uploadProductImage(np.id, imageFile);
          if (result) { imageUrl = result.url; imagePath = result.path; }
        }

        // Update image in DB if uploaded
        if (imageUrl && imagePath) {
          await supabase.rpc('update_vendor_product', {
            p_product_id: np.id, p_vendor_id: vendorId,
            p_image_url: imageUrl, p_image_path: imagePath,
          });
        }

        const row: ProductRow = {
          id: np.id, vendor_id: np.vendor_id, name: np.name,
          description: np.description, price: Number(np.price),
          category: np.category || cat.trim(),
          image_url: imageUrl || np.image_url || null,
          image_path: imagePath || np.image_path || null,
          in_stock: np.in_stock, stock_quantity: np.stock_quantity ?? 0,
          sold_count: np.sold_count ?? 0, is_featured: np.is_featured ?? false,
          avg_rating: Number(np.avg_rating) || 0,
          created_at: np.created_at, updated_at: np.updated_at,
        };
        setProducts((prev) => [row, ...prev]);
        if (imageUrl) setSignedUrls((prev) => ({ ...prev, [np.id]: imageUrl }));
        toast.success('Producto creado');
      }
      setShowModal(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStock = async (product: ProductRow) => {
    try {
      const { error } = await supabase.rpc('toggle_vendor_product_stock', { p_product_id: product.id, p_vendor_id: vendorId });
      if (error) throw error;
      setProducts((prev) => prev.map((p) => p.id === product.id ? { ...p, in_stock: !p.in_stock } : p));
      toast.success(!product.in_stock ? 'Producto en stock' : 'Producto agotado');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al actualizar');
    }
  };

  const handleToggleFeatured = async (product: ProductRow) => {
    try {
      const { error } = await supabase.rpc('toggle_vendor_product_featured', { p_product_id: product.id, p_vendor_id: vendorId });
      if (error) throw error;
      setProducts((prev) => prev.map((p) => p.id === product.id ? { ...p, is_featured: !p.is_featured } : p));
      toast.success(!product.is_featured ? 'Producto destacado' : 'Producto sin destacar');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al actualizar');
    }
  };

  const handleDelete = async () => {
    if (!deletingProduct) return;
    setDeleting(true);
    try {
      await deleteOldImage(deletingProduct.id);
      const { error } = await supabase.rpc('delete_vendor_product', { p_product_id: deletingProduct.id, p_vendor_id: vendorId });
      if (error) throw error;
      setProducts((prev) => prev.filter((p) => p.id !== deletingProduct.id));
      setSelectedIds((prev) => { const next = new Set(prev); next.delete(deletingProduct.id); return next; });
      setSignedUrls((prev) => { const next = { ...prev }; delete next[deletingProduct.id]; return next; });
      toast.success(`"${deletingProduct.name}" eliminado`);
      setDeletingProduct(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar');
    } finally {
      setDeleting(false);
    }
  };

  /* ── Bulk Actions (via RPC) ─────────────────────────────── */
  const executeBulkAction = async () => {
    if (selectedIds.size === 0 || !bulkAction) return;
    setBulkLoading(true);
    try {
      const actionMap: Record<string, string> = { stock: 'enable_stock', featured: 'featured', delete: 'delete' };
      const { error, data } = await supabase.rpc('bulk_vendor_product_action', {
        p_vendor_id: vendorId,
        p_product_ids: Array.from(selectedIds),
        p_action: actionMap[bulkAction] || 'enable_stock',
      });
      if (error) throw error;

      const count = Number(data) || 0;
      if (bulkAction === 'delete') {
        setProducts((prev) => prev.filter((p) => !selectedIds.has(p.id)));
        toast.success(`${count} producto(s) eliminado(s)`);
      } else if (bulkAction === 'stock') {
        setProducts((prev) => prev.map((p) => selectedIds.has(p.id) ? { ...p, in_stock: true } : p));
        toast.success(`${count} producto(s) habilitados`);
      } else if (bulkAction === 'featured') {
        setProducts((prev) => prev.map((p) => selectedIds.has(p.id) ? { ...p, is_featured: true } : p));
        toast.success(`${count} producto(s) destacados`);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error en accion masiva');
    } finally {
      setBulkLoading(false);
      setBulkAction(null);
      setSelectedIds(new Set());
    }
  };

  /* ── CSV Handling ───────────────────────────────────────── */
  const handleCSVFile = useCallback((file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) { toast.error('Solo se aceptan archivos CSV'); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error('Maximo 10MB'); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) { toast.error('No se pudo leer el archivo'); return; }
      const rows = parseCSV(text);
      if (rows.length < 2) { toast.error('Se necesita al menos encabezado + 1 fila'); return; }
      const headerMap = mapCSVHeaders(rows[0]);
      let hasNombre = false, hasPrecio = false;
      for (const [, h] of headerMap) { if (h === 'nombre') hasNombre = true; if (h === 'precio') hasPrecio = true; }
      if (!hasNombre || !hasPrecio) { toast.error('Faltan columnas obligatorias: nombre, precio'); return; }
      const dataRows = rows.slice(1);
      const parsed: ParsedCSVRow[] = dataRows.map((cols, idx) => {
        const row: ParsedCSVRow = { row: idx + 2, nombre: '', descripcion: '', precio: '', categoria: '', en_stock: '', valid: true, errors: [] };
        for (const [colIdx, header] of headerMap.entries()) {
          const val = (cols[colIdx] || '').trim();
          if (header === 'nombre') row.nombre = val;
          else if (header === 'descripcion') row.descripcion = val;
          else if (header === 'precio') row.precio = val;
          else if (header === 'categoria') row.categoria = val;
          else if (header === 'en_stock') row.en_stock = val;
        }
        if (!row.nombre) { row.valid = false; row.errors.push('Nombre requerido'); }
        if (!row.precio) { row.valid = false; row.errors.push('Precio requerido'); }
        else if (isNaN(Number(row.precio)) || Number(row.precio) < 0) { row.valid = false; row.errors.push('Precio invalido'); }
        return row;
      });
      setCsvParsed(parsed);
      setCsvFileName(file.name);
      setCsvValidCount(parsed.filter((r) => r.valid).length);
      setCsvInvalidCount(parsed.filter((r) => !r.valid).length);
      setShowCsvPreview(true);
    };
    reader.readAsText(file, 'UTF-8');
  }, []);

  const handleCSVSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) handleCSVFile(file); e.target.value = ''; }, [handleCSVFile]);

  const handleCSVDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); setCsvDragging(false); const file = e.dataTransfer.files[0]; if (file) handleCSVFile(file); }, [handleCSVFile]);

  const executeCSVImport = async () => {
    if (!vendorId || csvValidCount === 0) return;
    setShowCsvPreview(false);
    setCsvImporting(true);
    setCsvProgress(0);

    const validRows = csvParsed.filter((r) => r.valid);
    const productsJSON = validRows.map((r) => ({
      nombre: r.nombre,
      descripcion: r.descripcion || '',
      precio: Number(r.precio),
      categoria: r.categoria || 'General',
      en_stock: ['true', '1', 'si', 'yes'].includes(r.en_stock.toLowerCase()),
    }));

    try {
      // Use bulk_insert_vendor_products RPC (handles up to ~1000 rows in one call)
      const { data, error } = await supabase.rpc('bulk_insert_vendor_products', {
        p_vendor_id: vendorId,
        p_products: productsJSON,
      });
      if (error) throw error;

      const results = data || [];
      const imported = results.filter((r: { success: boolean }) => r.success).length;
      const errors = results.filter((r: { success: boolean }) => !r.success).length;

      if (errors > 0) {
        const errorNames = results.filter((r: { success: boolean; name: string; error: string }) => !r.success).map((r: { name: string; error: string }) => `${r.name}: ${r.error}`);
        console.warn('[CSV Import] Errors:', errorNames);
      }

      if (imported > 0) {
        toast.success(`${imported} producto(s) importados correctamente`);
        loadProducts(); // Refresh
        setActiveTab('products');
      }
      if (errors > 0) {
        toast.warning(`${errors} producto(s) con error`);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al importar CSV');
    } finally {
      setCsvImporting(false);
      setCsvProgress(0);
      setCsvParsed([]);
      setCsvFileName('');
    }
  };

  const downloadTemplate = () => {
    const csv = 'nombre,descripcion,precio,categoria,en_stock\n';
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'plantilla_productos.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Plantilla descargada');
  };

  /* ── Sort/filter options ────────────────────────────────── */
  const sortOptions: { value: SortOption; label: string }[] = [
    { value: 'newest', label: 'Mas recientes' },
    { value: 'price_asc', label: 'Precio: menor a mayor' },
    { value: 'price_desc', label: 'Precio: mayor a menor' },
    { value: 'most_sold', label: 'Mas vendidos' },
    { value: 'name_asc', label: 'Nombre A-Z' },
  ];
  const statusOptions: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'Todos' },
    { value: 'in_stock', label: 'En stock' },
    { value: 'out_of_stock', label: 'Agotados' },
    { value: 'featured', label: 'Destacados' },
  ];

  /* ══════════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════════ */

  if (vendorLoading || loading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="space-y-2"><div className="h-8 w-48 bg-gray-200 rounded-lg animate-pulse" /><div className="h-4 w-32 bg-gray-200 rounded-lg animate-pulse" /></div>
        <StatsSkeleton />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">{Array.from({ length: 8 }).map((_, i) => <ProductSkeleton key={i} />)}</div>
      </motion.div>
    );
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6">

      {/* ─── Header ──────────────────────────────────────── */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Mis Productos</h1>
          <p className="text-gray-500 text-sm mt-1">
            {products.length} producto{products.length !== 1 ? 's' : ''} en tu tienda
            {filtered.length !== products.length && (
              <span className="text-green-600 ml-1">({filtered.length} visible{filtered.length !== 1 ? 's' : ''})</span>
            )}
          </p>
        </div>
        <div className="flex gap-2 self-start">
          <motion.button
            onClick={openAddModal}
            className="btn-neon text-white px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2"
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          >
            <Plus className="w-4 h-4" /> Agregar Producto
          </motion.button>
        </div>
      </motion.div>

      {/* ─── Tab Toggle: Products / CSV Import ──────────── */}
      <motion.div variants={itemVariants} className="flex gap-1 bg-gray-50 rounded-xl p-1 border border-gray-200 w-fit">
        <button
          onClick={() => setActiveTab('products')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${activeTab === 'products' ? 'bg-green-50 text-green-600 shadow-[inset_0_0_0_1px_rgba(6,193,103,0.3)]' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}
        >
          <Package className="w-4 h-4" /> Mis Productos
        </button>
        <button
          onClick={() => setActiveTab('csv')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${activeTab === 'csv' ? 'bg-green-50 text-green-600 shadow-[inset_0_0_0_1px_rgba(6,193,103,0.3)]' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}
        >
          <FileSpreadsheet className="w-4 h-4" /> Importar CSV
        </button>
      </motion.div>

      {/* ══════════════════════════════════════════════════════════
         PRODUCTS TAB
         ══════════════════════════════════════════════════════════ */}
      {activeTab === 'products' && (
        <>
          {/* ─── Stats Bar ───────────────────────────────────── */}
          <motion.div variants={itemVariants}>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: 'Total Productos', value: stats.total.toString(), gradient: 'from-green-500 to-green-600', icon: Package, color: 'text-green-600' },
                { label: 'En Stock', value: stats.inStock.toString(), gradient: 'from-emerald-500 to-green-500', icon: Eye, color: 'text-emerald-600' },
                { label: 'Agotados', value: stats.outOfStock.toString(), gradient: 'from-red-500 to-rose-500', icon: EyeOff, color: 'text-red-600' },
                { label: 'Destacados', value: stats.featured.toString(), gradient: 'from-amber-500 to-orange-500', icon: Sparkles, color: 'text-amber-600' },
                { label: 'Total Vendidos', value: stats.totalSold.toString(), gradient: 'from-purple-500 to-pink-500', icon: ShoppingBag, color: 'text-purple-600' },
                { label: 'Ingresos Est.', value: formatCRC(stats.totalRevenue), gradient: 'from-green-500 to-emerald-500', icon: DollarSign, color: 'text-green-400' },
              ].map((stat) => (
                <div key={stat.label} className="glass rounded-xl p-3.5 group hover:glow-green transition-all duration-300">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${stat.gradient} flex items-center justify-center`}><stat.icon className="w-3 h-3 text-white" /></div>
                    <span className="text-[10px] text-gray-400 font-medium">{stat.label}</span>
                  </div>
                  <p className={`text-base font-bold ${stat.color}`}>{stat.value}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* ─── Search + Filters + View Toggle ──────────────── */}
          <motion.div variants={itemVariants} className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre, descripcion o categoria..." className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-green-300 transition-colors" />
                {search && (<button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-900 transition-colors"><X className="w-4 h-4" /></button>)}
              </div>
              <div className="flex gap-2">
                <div className="relative">
                  <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)} className="appearance-none w-full sm:w-48 bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-8 py-2.5 text-sm text-gray-600 focus:outline-none focus:border-green-300 transition-colors cursor-pointer">
                    {sortOptions.map((opt) => (<option key={opt.value} value={opt.value} className="bg-white text-gray-900">{opt.label}</option>))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                </div>
                <div className="flex bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                  <button onClick={() => setViewMode('grid')} className={`p-2.5 transition-colors ${viewMode === 'grid' ? 'bg-green-50 text-green-600' : 'text-gray-400 hover:text-gray-600'}`}><LayoutGrid className="w-4 h-4" /></button>
                  <button onClick={() => setViewMode('table')} className={`p-2.5 transition-colors ${viewMode === 'table' ? 'bg-green-50 text-green-600' : 'text-gray-400 hover:text-gray-600'}`}><List className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex gap-1.5 flex-wrap items-center">
                <Filter className="w-4 h-4 text-gray-400" />
                {statusOptions.map((opt) => (
                  <button key={opt.value} onClick={() => setFilterStatus(opt.value)} className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${filterStatus === opt.value ? 'bg-green-50 text-green-600 border border-green-200' : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100'}`}>{opt.label}</button>
                ))}
              </div>
              <div className="flex gap-1.5 flex-wrap overflow-x-auto pb-1">
                <button onClick={() => setFilterCategory('all')} className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 whitespace-nowrap ${filterCategory === 'all' ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100'}`}>Todas</button>
                {categoryNames.map((cat) => (
                  <button key={cat} onClick={() => setFilterCategory(cat)} className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 whitespace-nowrap ${filterCategory === cat ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100'}`}>{cat}</button>
                ))}
              </div>
            </div>
          </motion.div>

          {/* ─── Bulk Actions Bar ────────────────────────────── */}
          <AnimatePresence>
            {selectedIds.size > 0 && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="glass-strong rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="flex items-center gap-3">
                  <button onClick={toggleSelectAll} className="flex items-center gap-2 text-sm text-green-600 hover:text-green-700 transition-colors">
                    {selectedIds.size === filtered.length ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                    <span>{selectedIds.size} seleccionado{selectedIds.size !== 1 ? 's' : ''}</span>
                  </button>
                  <div className="w-px h-5 bg-gray-100 hidden sm:block" />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={() => setBulkAction('stock')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${bulkAction === 'stock' ? 'bg-emerald-100 text-emerald-600 border border-emerald-200' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'}`}><Eye className="w-3 h-3" /> Habilitar stock</button>
                  <button onClick={() => setBulkAction('featured')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${bulkAction === 'featured' ? 'bg-amber-100 text-amber-600 border border-amber-200' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'}`}><Sparkles className="w-3 h-3" /> Destacar</button>
                  <button onClick={() => setBulkAction('delete')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${bulkAction === 'delete' ? 'bg-red-100 text-red-600 border border-red-200' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'}`}><Trash2 className="w-3 h-3" /> Eliminar</button>
                </div>
                {bulkAction && (
                  <div className="flex items-center gap-2 ml-auto">
                    <motion.button onClick={executeBulkAction} disabled={bulkLoading} className="btn-neon text-white px-4 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 disabled:opacity-50" whileTap={{ scale: 0.97 }}>
                      {bulkLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Aplicar
                    </motion.button>
                    <button onClick={() => setBulkAction(null)} className="text-gray-500 hover:text-gray-900 transition-colors"><X className="w-4 h-4" /></button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ─── GRID VIEW ──────────────────────────────────── */}
          {viewMode === 'grid' && (
            <motion.div variants={itemVariants}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                <AnimatePresence mode="popLayout">
                  {filtered.map((product, i) => (
                    <motion.div key={product.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ delay: i * 0.03, duration: 0.3 }} className={`glass rounded-2xl overflow-hidden group hover:glow-green transition-all duration-300 relative ${!product.in_stock ? 'opacity-60' : ''}`}>
                      <div className="absolute top-3 left-3 z-20">
                        <button onClick={() => toggleSelect(product.id)} className={`w-5 h-5 rounded-md flex items-center justify-center transition-all duration-200 ${selectedIds.has(product.id) ? 'bg-green-500 text-white' : 'bg-black/40 backdrop-blur-sm text-transparent hover:text-gray-600 border border-gray-200'}`}>
                          {selectedIds.has(product.id) && <Check className="w-3 h-3" />}
                        </button>
                      </div>
                      <div className="h-52 bg-gradient-to-br from-white/5 to-white/[0.02] relative overflow-hidden cursor-pointer" onClick={() => setQuickViewProduct(product)}>
                        {signedUrls[product.id] ? (
                          <img src={signedUrls[product.id]} alt={product.name} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center"><ImageIcon className="w-12 h-12 text-gray-400" /></div>
                        )}
                        {!product.in_stock && <div className="absolute inset-0 bg-black/30 z-[5]" />}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                        <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
                          {product.is_featured && <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-100 border border-amber-200 backdrop-blur-sm text-[10px] font-semibold text-amber-600"><Sparkles className="w-3 h-3" /> Destacado</span>}
                        </div>
                        <div className="absolute bottom-3 left-3 right-3 z-10 flex items-end justify-between">
                          <div className="flex flex-col gap-1">
                            <span className="inline-flex items-center w-fit px-2.5 py-1 rounded-full text-[10px] font-medium bg-black/40 backdrop-blur-sm text-gray-200 border border-gray-200">{product.category}</span>
                            <span className={`inline-flex items-center gap-1.5 w-fit px-2 py-0.5 rounded-full text-[10px] font-medium backdrop-blur-sm ${product.in_stock ? 'bg-emerald-100 text-emerald-600 border border-emerald-200' : 'bg-red-100 text-red-600 border border-red-200'}`}>
                              <div className={`w-1.5 h-1.5 rounded-full ${product.in_stock ? 'bg-emerald-500' : 'bg-red-500'}`} />
                              {product.in_stock ? `${product.stock_quantity} uds` : 'Agotado'}
                            </span>
                          </div>
                          <span className="text-lg font-bold text-white drop-shadow-lg">{formatCRC(product.price)}</span>
                        </div>
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2 z-10">
                          <button onClick={(e) => { e.stopPropagation(); openEditModal(product); }} className="w-10 h-10 rounded-xl bg-green-500/20 border border-green-200 backdrop-blur-sm flex items-center justify-center text-green-600 hover:bg-green-100 transition-colors"><Edit3 className="w-4 h-4" /></button>
                          <button onClick={(e) => { e.stopPropagation(); handleToggleStock(product); }} className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-200 backdrop-blur-sm flex items-center justify-center text-emerald-600 hover:bg-emerald-500/30 transition-colors">{product.in_stock ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}</button>
                          <button onClick={(e) => { e.stopPropagation(); handleToggleFeatured(product); }} className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-200 backdrop-blur-sm flex items-center justify-center text-amber-600 hover:bg-amber-500/30 transition-colors"><Sparkles className="w-4 h-4" /></button>
                          <button onClick={(e) => { e.stopPropagation(); setDeletingProduct(product); }} className="w-10 h-10 rounded-xl bg-red-100 border border-red-200 backdrop-blur-sm flex items-center justify-center text-red-600 hover:bg-red-100 transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                      <div className="p-4">
                        <h3 className="text-sm font-semibold text-gray-900 truncate mb-1">{product.name}</h3>
                        <p className="text-xs text-gray-400 line-clamp-2 mb-3 leading-relaxed min-h-[2rem]">{product.description || 'Sin descripcion'}</p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {product.avg_rating > 0 ? (<div className="flex items-center gap-1"><div className="flex">{renderStars(product.avg_rating)}</div><span className="text-xs text-gray-500 ml-0.5">{product.avg_rating.toFixed(1)}</span></div>) : (<span className="text-[11px] text-gray-300">Sin resenas</span>)}
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-gray-400">
                            <span className="flex items-center gap-1"><ShoppingBag className="w-3 h-3" /> {product.sold_count}</span>
                          </div>
                        </div>
                        {product.in_stock && product.stock_quantity > 0 && (
                          <div className="mt-2.5 flex items-center gap-1.5">
                            <div className="flex-1 h-1 bg-gray-50 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${product.stock_quantity <= 5 ? 'bg-red-500/70' : product.stock_quantity <= 15 ? 'bg-amber-500/70' : 'bg-green-500'}`} style={{ width: `${Math.min((product.stock_quantity / 50) * 100, 100)}%` }} />
                            </div>
                            <span className="text-[10px] text-gray-300">{product.stock_quantity} uds</span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {/* ─── TABLE VIEW ─────────────────────────────────── */}
          {viewMode === 'table' && (
            <motion.div variants={itemVariants}>
              <div className="glass rounded-t-xl px-4 py-3 border-b border-gray-200 flex items-center gap-3 text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                <div className="w-6" /><div className="w-12 h-8 flex-shrink-0" /><div className="flex-1 min-w-0">Producto</div>
                <div className="w-20 text-right hidden sm:block">Precio</div><div className="w-16 text-center hidden sm:block">Stock</div>
                <div className="w-16 text-center hidden md:block">Vendidos</div><div className="w-24 text-center">Estado</div>
                <div className="w-28 text-center">Acciones</div>
              </div>
              <div className="space-y-1">
                <AnimatePresence mode="popLayout">
                  {filtered.map((product, i) => (
                    <motion.div key={product.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ delay: i * 0.02, duration: 0.2 }} className={`glass rounded-xl px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors group ${!product.in_stock ? 'opacity-50' : ''}`}>
                      <div className="w-6 flex-shrink-0">
                        <button onClick={() => toggleSelect(product.id)} className={`w-5 h-5 rounded-md flex items-center justify-center transition-all duration-200 ${selectedIds.has(product.id) ? 'bg-green-500 text-white' : 'bg-gray-50 text-transparent hover:text-gray-600 border border-gray-200'}`}>
                          {selectedIds.has(product.id) && <Check className="w-3 h-3" />}
                        </button>
                      </div>
                      <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer bg-gray-50" onClick={() => setQuickViewProduct(product)}>
                        {signedUrls[product.id] ? <img src={signedUrls[product.id]} alt={product.name} className="w-full h-full object-cover" loading="lazy" /> : <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-5 h-5 text-gray-400" /></div>}
                      </div>
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setQuickViewProduct(product)}>
                        <h3 className="text-sm font-medium text-gray-900 truncate group-hover:text-green-600 transition-colors">{product.name}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-gray-400 truncate">{product.category}</span>
                          {product.is_featured && <Sparkles className="w-3 h-3 text-amber-600 flex-shrink-0" />}
                        </div>
                      </div>
                      <div className="w-20 text-right hidden sm:block"><span className="text-sm font-semibold text-gray-900">{formatCRC(product.price)}</span></div>
                      <div className="w-16 text-center hidden sm:block"><span className={`text-sm font-medium ${product.in_stock ? (product.stock_quantity <= 5 ? 'text-red-600' : 'text-gray-600') : 'text-red-600'}`}>{product.in_stock ? product.stock_quantity : 0}</span><span className="text-[10px] text-gray-300 ml-0.5">uds</span></div>
                      <div className="w-16 text-center hidden md:block"><span className="text-sm text-gray-500">{product.sold_count}</span></div>
                      <div className="w-24 text-center">
                        <button onClick={() => handleToggleStock(product)} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium transition-all hover:scale-105 ${product.in_stock ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${product.in_stock ? 'bg-emerald-500' : 'bg-red-500'}`} />{product.in_stock ? 'Activo' : 'Agotado'}
                        </button>
                      </div>
                      <div className="w-28 flex items-center justify-center gap-1.5">
                        <button onClick={() => openEditModal(product)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-green-600 hover:bg-green-50 transition-all"><Edit3 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleToggleFeatured(product)} className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"><Sparkles className={`w-3.5 h-3.5 transition-colors ${product.is_featured ? 'text-amber-600' : 'text-gray-300 hover:text-amber-600'}`} /></button>
                        <button onClick={() => setDeletingProduct(product)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {/* ─── Empty State ────────────────────────────────── */}
          {filtered.length === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
              <div className="w-20 h-20 rounded-3xl bg-gray-50 flex items-center justify-center mx-auto mb-5"><Package className="w-10 h-10 text-gray-400" /></div>
              <p className="text-gray-600 text-base font-medium mb-1">{products.length === 0 ? 'No tienes productos aun' : 'No se encontraron productos'}</p>
              <p className="text-gray-300 text-sm mb-6">{products.length === 0 ? 'Agrega tu primer producto o importa un CSV' : 'Intenta cambiar los filtros de busqueda'}</p>
              {products.length === 0 && (
                <div className="flex items-center justify-center gap-3">
                  <motion.button onClick={openAddModal} className="btn-neon text-white px-5 py-2.5 rounded-xl text-sm font-medium inline-flex items-center gap-2" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}><Plus className="w-4 h-4" /> Agregar Producto</motion.button>
                  <motion.button onClick={() => setActiveTab('csv')} className="px-5 py-2.5 rounded-xl text-sm font-medium text-green-600 bg-green-50 border border-green-200 hover:bg-green-500/20 transition-colors inline-flex items-center gap-2" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}><FileSpreadsheet className="w-4 h-4" /> Importar CSV</motion.button>
                </div>
              )}
            </motion.div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════
         CSV TAB
         ══════════════════════════════════════════════════════════ */}
      {activeTab === 'csv' && (
        <motion.div variants={itemVariants} className="space-y-6">
          {/* CSV Upload Area */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Importar Productos via CSV</h2>
              <p className="text-xs text-gray-400 mt-0.5">Sube un archivo CSV con tus productos para importarlos masivamente</p>
            </div>
            <motion.button onClick={downloadTemplate} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-green-600 bg-green-50 border border-green-200 hover:bg-green-500/20 transition-colors" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Download className="w-4 h-4" /> Descargar Plantilla
            </motion.button>
          </div>

          <motion.div
            onDrop={handleCSVDrop}
            onDragOver={(e) => { e.preventDefault(); setCsvDragging(true); }}
            onDragLeave={() => setCsvDragging(false)}
            onClick={() => !csvImporting && csvInputRef.current?.click()}
            className={`glass rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-300 ${csvDragging ? 'glow-green border-green-300' : csvImporting ? 'opacity-50 cursor-not-allowed' : 'hover:glow-green'}`}
          >
            <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={handleCSVSelect} />
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center mx-auto mb-6">
              {csvImporting ? <Loader2 className="w-8 h-8 text-purple-600 animate-spin" /> : <Upload className="w-8 h-8 text-purple-600" />}
            </div>
            {csvImporting ? (
              <div className="max-w-md mx-auto">
                <p className="text-gray-900 font-semibold mb-2">Importando: {csvFileName}</p>
                <Progress value={csvProgress} className="h-2 mb-2" />
                <p className="text-sm text-green-600">{csvProgress}%</p>
              </div>
            ) : (
              <>
                <p className="text-gray-900 font-semibold mb-1">Arrastra tu archivo CSV aqui</p>
                <p className="text-gray-500 text-sm mb-4">o haz clic para seleccionar</p>
                <div className="flex items-center justify-center gap-4 text-xs text-gray-300">
                  <div className="flex items-center gap-1.5"><FileSpreadsheet className="w-3.5 h-3.5" /> .CSV</div>
                  <div className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Max 10MB</div>
                  <div className="flex items-center gap-1.5">UTF-8</div>
                </div>
              </>
            )}
          </motion.div>

          {/* CSV Format Guide */}
          <div className="glass rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2"><FileText className="w-4 h-4 text-green-600" /> Formato del CSV</h3>
            <div className="bg-gray-100 rounded-xl p-4 overflow-x-auto">
              <code className="text-xs text-gray-500 whitespace-nowrap block">
                nombre,descripcion,precio,categoria,en_stock<br />
                &quot;Producto Ejemplo&quot;,&quot;Descripcion del producto&quot;,3500,Categoria,true
              </code>
            </div>
            <div className="flex flex-wrap gap-3 mt-3">
              <span className="text-[11px] text-gray-400"><span className="text-emerald-600 font-medium">Obligatorias:</span> nombre, precio</span>
              <span className="text-[11px] text-gray-400"><span className="text-gray-500 font-medium">Opcionales:</span> descripcion, categoria, en_stock</span>
            </div>
          </div>
        </motion.div>
      )}

      {/* ═════════════════════════════════════════════════════════════
         QUICK VIEW MODAL
         ═════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {quickViewProduct && <QuickViewModal product={quickViewProduct} onClose={() => setQuickViewProduct(null)} onEdit={() => openEditModal(quickViewProduct)} />}
      </AnimatePresence>

      {/* ═════════════════════════════════════════════════════════════
         ADD / EDIT MODAL
         ═════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showModal && (
          <motion.div className="fixed inset-0 z-[60] flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowModal(false)} />
            <motion.div className="relative w-full max-w-lg glass-strong rounded-2xl z-10 max-h-[92vh] overflow-y-auto" initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }}>
              <div className="sticky top-0 bg-white/90 backdrop-blur-xl z-10 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</h2>
                <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-900 transition-colors p-1"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 space-y-5">
                {/* Image upload */}
                <div className="space-y-2">
                  <label className="text-sm text-gray-500 font-medium">Foto del producto</label>
                  <div ref={dropZoneRef} onClick={() => fileInputRef.current?.click()} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} className="relative w-full h-52 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-green-300 transition-all duration-300 overflow-hidden group">
                    <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileInput} />
                    {imagePreview ? (
                      <>
                        <img src={imagePreview} alt="Preview" className="absolute inset-0 w-full h-full object-cover" />
                        {uploadingImage && (
                          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-10">
                            <Loader2 className="w-8 h-8 text-green-600 animate-spin mb-2" />
                            <div className="w-32 h-1.5 bg-gray-100 rounded-full overflow-hidden"><motion.div className="h-full bg-green-500 rounded-full" initial={{ width: 0 }} animate={{ width: `${uploadProgress}%` }} transition={{ duration: 0.3 }} /></div>
                            <span className="text-xs text-gray-500 mt-1">{uploadProgress}%</span>
                          </div>
                        )}
                        {!uploadingImage && <div className="absolute top-2 right-2 z-10"><button onClick={(e) => { e.stopPropagation(); clearImage(); }} className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white hover:bg-red-500 transition-colors"><X className="w-4 h-4" /></button></div>}
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-2 group-hover:text-green-600 transition-colors">
                        <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center mb-1"><UploadCloud className="w-6 h-6 text-green-600" /></div>
                        <p className="text-sm text-gray-500">Arrastra o haz clic para subir</p>
                        <p className="text-[10px] text-gray-300">JPG, PNG o WebP — max 5MB</p>
                      </div>
                    )}
                  </div>
                </div>
                {/* Name */}
                <div className="space-y-1.5">
                  <label className="text-sm text-gray-500 font-medium">Nombre del producto *</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Ej: Ibuprofeno 600mg" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-green-300 transition-colors" />
                </div>
                {/* Description */}
                <div className="space-y-1.5">
                  <label className="text-sm text-gray-500 font-medium">Descripcion</label>
                  <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Descripcion breve..." rows={3} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-green-300 transition-colors resize-none" />
                </div>
                {/* Price + Category */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm text-gray-500 font-medium">Precio (₡) *</label>
                    <input type="number" min="0" step="1" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} placeholder="3500" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-green-300 transition-colors" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm text-gray-500 font-medium">Categoria *</label>
                    {!showCustomCategory ? (
                      <div className="relative">
                        <select value={formData.category} onChange={(e) => { if (e.target.value === '__custom__') setShowCustomCategory(true); else setFormData({ ...formData, category: e.target.value }); }} className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-xl px-3 py-3 text-sm text-gray-900 focus:outline-none focus:border-green-300 transition-colors pr-8 cursor-pointer">
                          <option value="" className="bg-white">Seleccionar...</option>
                          {categoryNames.map((cat) => (<option key={cat} value={cat} className="bg-white">{cat}</option>))}
                          <option value="__custom__" className="bg-white text-green-600">+ Nueva categoria</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                      </div>
                    ) : (
                      <div className="flex gap-1.5">
                        <input type="text" value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} placeholder="Nueva categoria" className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-3 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-green-300 transition-colors" autoFocus onKeyDown={(e) => { if (e.key === 'Escape') { setShowCustomCategory(false); setCustomCategory(''); } }} />
                        <button onClick={() => { setShowCustomCategory(false); setCustomCategory(''); }} className="text-gray-500 hover:text-gray-900 transition-colors p-2"><X className="w-4 h-4" /></button>
                      </div>
                    )}
                  </div>
                </div>
                {/* Stock toggle */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${formData.inStock ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>{formData.inStock ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}</div>
                      <div><p className="text-sm text-gray-900 font-medium">En stock</p><p className="text-[11px] text-gray-400">Disponible para venta</p></div>
                    </div>
                    <button type="button" onClick={() => setFormData({ ...formData, inStock: !formData.inStock })} className={`w-12 h-7 rounded-full transition-colors duration-200 flex items-center px-0.5 ${formData.inStock ? 'bg-green-500' : 'bg-gray-300'}`}>
                      <motion.div className="w-6 h-6 rounded-full bg-white shadow-md" animate={{ x: formData.inStock ? 20 : 0 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
                    </button>
                  </div>
                  {formData.inStock && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-1.5">
                      <label className="text-sm text-gray-500 font-medium">Cantidad en stock</label>
                      <input type="number" min="0" step="1" value={formData.stockQuantity} onChange={(e) => setFormData({ ...formData, stockQuantity: e.target.value })} placeholder="10" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-green-300 transition-colors" />
                    </motion.div>
                  )}
                </div>
                {/* Featured toggle */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${formData.isFeatured ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-400'}`}><Sparkles className="w-4 h-4" /></div>
                    <div><p className="text-sm text-gray-900 font-medium">Destacado</p><p className="text-[11px] text-gray-400">Insignia especial</p></div>
                  </div>
                  <button type="button" onClick={() => setFormData({ ...formData, isFeatured: !formData.isFeatured })} className={`w-12 h-7 rounded-full transition-colors duration-200 flex items-center px-0.5 ${formData.isFeatured ? 'bg-amber-500' : 'bg-gray-300'}`}>
                    <motion.div className="w-6 h-6 rounded-full bg-white shadow-md" animate={{ x: formData.isFeatured ? 20 : 0 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
                  </button>
                </div>
              </div>
              {/* Footer */}
              <div className="sticky bottom-0 bg-white/90 backdrop-blur-xl border-t border-gray-200 px-6 py-4 flex gap-3">
                <button onClick={() => setShowModal(false)} className="flex-1 py-3 rounded-xl text-sm font-medium text-gray-500 bg-gray-50 hover:bg-gray-100 transition-colors">Cancelar</button>
                <motion.button onClick={handleSave} disabled={saving || uploadingImage} className="flex-1 btn-neon text-white py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50" whileHover={{ scale: saving ? 1 : 1.02 }} whileTap={{ scale: saving ? 1 : 0.98 }}>
                  {saving || uploadingImage ? (<><Loader2 className="w-4 h-4 animate-spin" /> {saving ? 'Guardando...' : 'Subiendo...'}</>) : (<><Check className="w-4 h-4" /> {editingProduct ? 'Guardar Cambios' : 'Crear Producto'}</>)}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═════════════════════════════════════════════════════════════
         CSV PREVIEW MODAL
         ═════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showCsvPreview && (
          <motion.div className="fixed inset-0 z-[60] flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !csvImporting && setShowCsvPreview(false)} />
            <motion.div className="relative w-full max-w-3xl glass-strong rounded-2xl z-10 max-h-[85vh] flex flex-col" initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}>
              <div className="flex items-center justify-between p-6 pb-0">
                <div><h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Eye className="w-5 h-5 text-green-600" /> Vista Previa CSV</h2><p className="text-xs text-gray-400 mt-1">{csvFileName}</p></div>
                <button onClick={() => setShowCsvPreview(false)} disabled={csvImporting} className="text-gray-500 hover:text-gray-900 disabled:opacity-50"><X className="w-5 h-5" /></button>
              </div>
              <div className="flex items-center gap-4 px-6 mt-4">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200"><Check className="w-3.5 h-3.5 text-emerald-600" /><span className="text-xs text-emerald-600 font-medium">{csvValidCount} validos</span></div>
                {csvInvalidCount > 0 && <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200"><X className="w-3.5 h-3.5 text-red-600" /><span className="text-xs text-red-600 font-medium">{csvInvalidCount} con error</span></div>}
              </div>
              <div className="flex-1 overflow-auto px-6 mt-4 mb-4">
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr><th className="px-3 py-2.5 text-left text-gray-500 font-medium">#</th><th className="px-3 py-2.5 text-left text-gray-500 font-medium">Nombre</th><th className="px-3 py-2.5 text-left text-gray-500 font-medium">Descripcion</th><th className="px-3 py-2.5 text-left text-gray-500 font-medium">Precio</th><th className="px-3 py-2.5 text-left text-gray-500 font-medium">Categoria</th><th className="px-3 py-2.5 text-left text-gray-500 font-medium">Estado</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {csvParsed.slice(0, 50).map((r) => (
                        <tr key={r.row} className={r.valid ? 'hover:bg-gray-50' : 'bg-red-50'}>
                          <td className="px-3 py-2 text-gray-300">{r.row}</td>
                          <td className="px-3 py-2 text-gray-900 font-medium">{r.nombre || '-'}</td>
                          <td className="px-3 py-2 text-gray-500 max-w-[150px] truncate">{r.descripcion || '-'}</td>
                          <td className="px-3 py-2 text-gray-900">₡{r.precio || '-'}</td>
                          <td className="px-3 py-2 text-gray-500">{r.categoria || '-'}</td>
                          <td className="px-3 py-2">{r.valid ? <span className="text-emerald-600">OK</span> : <span className="text-red-600" title={r.errors.join(', ')}>✗ {r.errors[0]}</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {csvParsed.length > 50 && <div className="px-4 py-2 text-[11px] text-gray-400 text-center border-t border-gray-100">...y {csvParsed.length - 50} filas mas</div>}
                </div>
              </div>
              <div className="flex gap-3 p-6 pt-0">
                <button onClick={() => setShowCsvPreview(false)} disabled={csvImporting} className="flex-1 py-3 rounded-xl text-sm font-medium text-gray-500 bg-gray-50 hover:bg-gray-100 transition-colors disabled:opacity-50">Cancelar</button>
                {csvValidCount > 0 && (
                  <motion.button onClick={executeCSVImport} disabled={csvImporting} className="flex-1 btn-neon text-white py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50" whileHover={{ scale: csvImporting ? 1 : 1.02 }} whileTap={{ scale: csvImporting ? 1 : 0.98 }}>
                    {csvImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {csvImporting ? 'Importando...' : `Importar ${csvValidCount} producto${csvValidCount !== 1 ? 's' : ''}`}
                  </motion.button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═════════════════════════════════════════════════════════════
         DELETE CONFIRMATION
         ═════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {deletingProduct && (
          <motion.div className="fixed inset-0 z-[70] flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !deleting && setDeletingProduct(null)} />
            <motion.div className="relative w-full max-w-sm glass-strong rounded-2xl z-10 p-6" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0"><AlertTriangle className="w-6 h-6 text-red-600" /></div>
                <div><h3 className="text-base font-bold text-gray-900">Eliminar producto</h3><p className="text-xs text-gray-500 truncate max-w-[200px]">{deletingProduct.name}</p></div>
              </div>
              <div className="space-y-3 mb-5">
                <p className="text-sm text-gray-600">Estas seguro de eliminar <span className="text-gray-900 font-semibold">&quot;{deletingProduct.name}&quot;</span>?</p>
                {deletingProduct.sold_count > 0 && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
                    <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div><p className="text-xs text-amber-600 font-medium">Advertencia</p><p className="text-xs text-amber-600 mt-0.5">Tiene {deletingProduct.sold_count} venta{deletingProduct.sold_count !== 1 ? 's' : ''} registrada{deletingProduct.sold_count !== 1 ? 's' : ''}.</p></div>
                  </div>
                )}
                <p className="text-xs text-gray-400">Esta accion no se puede deshacer.</p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setDeletingProduct(null)} disabled={deleting} className="flex-1 py-2.5 rounded-xl text-sm text-gray-500 bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors disabled:opacity-50">Cancelar</button>
                <motion.button onClick={handleDelete} disabled={deleting} className="flex-1 py-2.5 rounded-xl text-sm text-red-600 bg-red-100 border border-red-200 hover:bg-red-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-50" whileTap={{ scale: 0.97 }}>
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Eliminar
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
