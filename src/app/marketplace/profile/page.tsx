'use client';

import { useState, useEffect, useRef, useCallback, type ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  Store, User, Phone, MapPin, Clock, Star, Package,
  ShoppingCart, DollarSign, Camera, Edit3, Check, X,
  TrendingUp, Wallet, ArrowUpRight, ArrowDownRight,
  Loader2, ChevronDown, Bell, Shield, FileText,
  Headphones, LogOut, CircleDot, Radio,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useVendorId } from '@/hooks/useVendorId';
import { supabase, type Vendor, type VendorWallet, type VendorTransaction } from '@/lib/supabase';
import { toast } from 'sonner';

/* ── Helpers ──────────────────────────────────────────────────── */

function formatCRC(amount: number): string {
  return `₡${Math.round(amount).toLocaleString('es-CR')}`;
}

function relativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (diffMin < 1) return 'Ahora';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  if (diffHr < 24) return `Hace ${diffHr}h`;
  if (diffDay < 7) return `Hace ${diffDay}d`;
  return date.toLocaleDateString('es-CR', { day: '2-digit', month: 'short' });
}

/* ── Constants ────────────────────────────────────────────────── */

const CATEGORY_OPTIONS = [
  { value: 'pharmacy', label: 'Farmacia' },
  { value: 'food', label: 'Comida' },
  { value: 'stores', label: 'Tiendas' },
  { value: 'other', label: 'Otros' },
] as const;

const CATEGORY_LABEL: Record<string, string> = {
  pharmacy: 'Farmacia',
  food: 'Comida',
  stores: 'Tiendas',
  other: 'Otros',
};

const CATEGORY_COLOR: Record<string, string> = {
  pharmacy: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  food: 'bg-amber-50 text-amber-600 border-amber-200',
  stores: 'bg-green-50 text-green-600 border-green-200',
  other: 'bg-purple-50 text-purple-600 border-purple-200',
};

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
type DayKey = (typeof DAY_KEYS)[number];

const DAY_LABELS: Record<DayKey, string> = {
  mon: 'Lunes',
  tue: 'Martes',
  wed: 'Miércoles',
  thu: 'Jueves',
  fri: 'Viernes',
  sat: 'Sábado',
  sun: 'Domingo',
};

const TX_TYPE_CONFIG: Record<string, { label: string; color: string; icon: typeof ArrowUpRight }> = {
  earning: { label: 'Ganancia', color: 'text-emerald-600', icon: ArrowUpRight },
  withdrawal: { label: 'Retiro', color: 'text-red-600', icon: ArrowDownRight },
  adjustment: { label: 'Ajuste', color: 'text-amber-600', icon: ArrowDownRight },
};

const TX_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendiente', color: 'bg-amber-50 text-amber-600' },
  completed: { label: 'Completada', color: 'bg-emerald-50 text-emerald-600' },
  failed: { label: 'Fallida', color: 'bg-red-50 text-red-600' },
};

/* ── Types ────────────────────────────────────────────────────── */

interface DaySchedule {
  open: string;
  close: string;
  active: boolean;
}

interface ProfileStats {
  totalProducts: number;
  totalOrders: number;
  totalEarnings: number;
  avgRating: number;
  pendingOrders: number;
  balance: number;
}

interface FormState {
  store_name: string;
  description: string;
  phone: string;
  address: string;
  category: string;
  opening_hours: Record<DayKey, DaySchedule>;
  min_order_amount: string;
  delivery_radius_km: string;
}

/* ── Default opening hours ────────────────────────────────────── */

function defaultOpeningHours(): Record<DayKey, DaySchedule> {
  return {
    mon: { open: '08:00', close: '22:00', active: true },
    tue: { open: '08:00', close: '22:00', active: true },
    wed: { open: '08:00', close: '22:00', active: true },
    thu: { open: '08:00', close: '22:00', active: true },
    fri: { open: '08:00', close: '22:00', active: true },
    sat: { open: '08:00', close: '22:00', active: true },
    sun: { open: '08:00', close: '22:00', active: false },
  };
}

/* ── Animations ───────────────────────────────────────────────── */

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

/* ── Skeleton ─────────────────────────────────────────────────── */

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Header */}
      <div>
        <div className="h-8 w-56 bg-gray-100 rounded-lg" />
        <div className="h-4 w-40 bg-gray-100 rounded-lg mt-2" />
      </div>
      {/* Store card */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="h-28 bg-gradient-to-r from-amber-50 to-green-50" />
        <div className="px-6 pb-6 -mt-10 space-y-4">
          <div className="flex items-end gap-5">
            <div className="w-20 h-20 rounded-2xl bg-gray-100 border-4 border-white" />
            <div className="flex-1 space-y-2 pb-2">
              <div className="h-6 w-40 bg-gray-100 rounded-lg" />
              <div className="h-4 w-20 bg-gray-100 rounded-lg" />
            </div>
          </div>
          <div className="h-4 w-full bg-gray-100 rounded-lg" />
          <div className="grid sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-50 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="glass rounded-2xl p-5">
            <div className="w-10 h-10 rounded-xl bg-gray-100 mb-3" />
            <div className="h-7 w-20 bg-gray-100 rounded-lg" />
            <div className="h-3 w-16 bg-gray-100 rounded mt-2" />
          </div>
        ))}
      </div>
      {/* Form & Earnings */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="glass rounded-2xl p-6 space-y-4">
          <div className="h-6 w-32 bg-gray-100 rounded-lg" />
          {[...Array(6)].map((_, i) => (
            <div key={i} className="space-y-1">
              <div className="h-3 w-20 bg-gray-100 rounded" />
              <div className="h-10 bg-gray-100 rounded-lg" />
            </div>
          ))}
        </div>
        <div className="glass rounded-2xl p-6 space-y-4">
          <div className="h-6 w-28 bg-gray-100 rounded-lg" />
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-50 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ───────────────────────────────────────────── */

export default function ProfilePage() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const { vendorId, loading: vendorLoading, error: vendorError } = useVendorId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Data state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [wallet, setWallet] = useState<VendorWallet | null>(null);
  const [transactions, setTransactions] = useState<VendorTransaction[]>([]);
  const [stats, setStats] = useState<ProfileStats>({
    totalProducts: 0,
    totalOrders: 0,
    totalEarnings: 0,
    avgRating: 0,
    pendingOrders: 0,
    balance: 0,
  });
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState<FormState>({
    store_name: '',
    description: '',
    phone: '',
    address: '',
    category: 'other',
    opening_hours: defaultOpeningHours(),
    min_order_amount: '',
    delivery_radius_km: '',
  });

  const [showHours, setShowHours] = useState(false);

  // Edit mode
  const [isEditing, setIsEditing] = useState(false);

  // Active panel / modal state
  const [activePanel, setActivePanel] = useState<string | null>(null);

  // Notification preferences
  const [notifPrefs, setNotifPrefs] = useState({
    newOrders: true,
    orderStatus: true,
    earnings: true,
    support: false,
  });

  /* ── Fetch all data ─────────────────────────────────────────── */
  const fetchAllData = useCallback(async () => {
    if (!vendorId) return;
    let cancelled = false;

    try {
      setLoading(true);

      // 1. Vendor data
      const { data: vendorData, error: vendorErr } = await supabase
        .from('vendors')
        .select('*')
        .eq('id', vendorId)
        .single();

      if (vendorErr) console.error('Vendor fetch error:', vendorErr);
      if (vendorData && !cancelled) {
        const v = vendorData as Vendor;
        setVendor(v);
        setForm({
          store_name: v.store_name || '',
          description: v.description || '',
          phone: v.phone || '',
          address: v.address || '',
          category: v.category || 'other',
          opening_hours: v.opening_hours
            ? (v.opening_hours as Record<DayKey, DaySchedule>)
            : defaultOpeningHours(),
          min_order_amount: v.min_order_amount != null ? String(v.min_order_amount) : '',
          delivery_radius_km: v.delivery_radius_km != null ? String(v.delivery_radius_km) : '',
        });

        // Fetch signed URL for logo
        if (v.logo_url) {
          const { data: signedData } = await supabase.storage
            .from('products')
            .createSignedUrl(v.logo_url, 3600);
          if (signedData?.signedUrl && !cancelled) {
            setLogoUrl(signedData.signedUrl);
          }
        }
      }

      if (cancelled) return;

      // 2. Wallet data
      const { data: walletData, error: walletErr } = await supabase
        .from('vendor_wallets')
        .select('*')
        .eq('vendor_id', vendorId)
        .single();

      if (walletErr && walletErr.code !== 'PGRST116') {
        console.error('Wallet fetch error:', walletErr);
      }
      if (walletData && !cancelled) {
        setWallet(walletData as VendorWallet);
      }

      if (cancelled) return;

      // 3. Product count
      const { count: productCount } = await supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('vendor_id', vendorId);

      // 4. Order stats
      const { count: totalOrders } = await supabase
        .from('deliveries')
        .select('id', { count: 'exact', head: true })
        .eq('vendor_id', vendorId);

      const { count: pendingOrders } = await supabase
        .from('deliveries')
        .select('id', { count: 'exact', head: true })
        .eq('vendor_id', vendorId)
        .eq('status', 'pending');

      if (cancelled) return;

      // 5. Recent transactions
      const { data: txData, error: txErr } = await supabase
        .from('vendor_transactions')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (txErr) console.error('Transactions fetch error:', txErr);
      if (txData && !cancelled) {
        setTransactions(txData as VendorTransaction[]);
      }

      if (cancelled) return;

      // Set stats
      setStats({
        totalProducts: productCount ?? 0,
        totalOrders: totalOrders ?? 0,
        totalEarnings: (walletData as VendorWallet | null)?.total_earned ?? 0,
        avgRating: (vendorData as Vendor | null)?.rating ?? 0,
        pendingOrders: pendingOrders ?? 0,
        balance: (walletData as VendorWallet | null)?.balance ?? 0,
      });
    } catch (err) {
      console.error('Profile fetch error:', err);
      toast.error('Error al cargar datos del perfil');
    } finally {
      if (!cancelled) setLoading(false);
    }

    return () => { cancelled = true; };
  }, [vendorId]);

  useEffect(() => {
    if (vendorId) fetchAllData();
  }, [vendorId, fetchAllData]);

  /* ── Form handlers ──────────────────────────────────────────── */

  const updateForm = (field: keyof FormState, value: string | Record<DayKey, DaySchedule>) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateDayHour = (day: DayKey, field: keyof DaySchedule, value: string | boolean) => {
    setForm((prev) => ({
      ...prev,
      opening_hours: {
        ...prev.opening_hours,
        [day]: { ...prev.opening_hours[day], [field]: value },
      },
    }));
  };

  /* ── Save vendor profile ────────────────────────────────────── */

  const handleSave = async () => {
    if (!vendorId) return;

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        store_name: form.store_name.trim(),
        description: form.description.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        category: form.category,
        opening_hours: form.opening_hours,
        min_order_amount: form.min_order_amount ? parseFloat(form.min_order_amount) : null,
        delivery_radius_km: form.delivery_radius_km ? parseFloat(form.delivery_radius_km) : null,
      };

      const { error } = await supabase
        .from('vendors')
        .update(payload)
        .eq('id', vendorId);

      if (error) {
        console.error('Save vendor error:', error);
        toast.error('Error al guardar: ' + error.message);
        return;
      }

      setVendor((prev) => prev ? { ...prev, ...payload } as Vendor : prev);
      setIsEditing(false);
      toast.success('Perfil guardado correctamente');
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Error al guardar perfil');
    } finally {
      setSaving(false);
    }
  };

  /* ── Logo upload ────────────────────────────────────────────── */

  const handleLogoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !vendorId) return;

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('La imagen no puede superar 2MB');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Solo se permiten archivos de imagen');
      return;
    }

    setUploadingLogo(true);
    try {
      const filePath = `vendors/${vendorId}/logo`;

      // Remove old logo if exists
      if (vendor?.logo_url) {
        await supabase.storage.from('products').remove([vendor.logo_url]);
      }

      // Upload new logo
      const { error: uploadErr } = await supabase.storage
        .from('products')
        .upload(filePath, file, { upsert: true, contentType: file.type });

      if (uploadErr) {
        console.error('Upload error:', uploadErr);
        toast.error('Error al subir imagen: ' + uploadErr.message);
        return;
      }

      // Update vendor record with the file path
      const { error: updateErr } = await supabase
        .from('vendors')
        .update({ logo_url: filePath })
        .eq('id', vendorId);

      if (updateErr) {
        console.error('Vendor update error:', updateErr);
        toast.error('Error al actualizar logo');
        return;
      }

      // Get signed URL for preview
      const { data: signedData } = await supabase.storage
        .from('products')
        .createSignedUrl(filePath, 3600);

      if (signedData?.signedUrl) {
        setLogoUrl(signedData.signedUrl);
      }

      setVendor((prev) => prev ? { ...prev, logo_url: filePath } : prev);
      toast.success('Logo actualizado');
    } catch (err) {
      console.error('Logo upload error:', err);
      toast.error('Error al subir logo');
    } finally {
      setUploadingLogo(false);
      // Reset input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  /* ── Menu items ─────────────────────────────────────────────── */

  const menuItems = [
    { label: 'Notificaciones', icon: Bell, color: 'text-amber-600', action: () => setActivePanel('notifications') },
    { label: 'Términos y Condiciones', icon: FileText, color: 'text-green-600', action: () => setActivePanel('terms') },
    { label: 'Soporte', icon: Headphones, color: 'text-emerald-600', action: () => router.push('/marketplace/support') },
    { label: 'Privacidad', icon: Shield, color: 'text-purple-600', action: () => setActivePanel('privacy') },
    { label: 'Cerrar Sesión', icon: LogOut, color: 'text-red-600', action: () => setActivePanel('logout') },
  ];

  /* ── Loading / Error ────────────────────────────────────────── */

  if (vendorLoading || loading) return <LoadingSkeleton />;

  if (vendorError) {
    return (
      <div className="text-center py-16">
        <Store className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-400 text-sm">{vendorError}</p>
      </div>
    );
  }

  /* ── Stat cards config ──────────────────────────────────────── */

  const statCards = [
    { label: 'Productos', value: stats.totalProducts.toString(), icon: Package, color: 'from-blue-600 to-green-500' },
    { label: 'Pedidos', value: stats.totalOrders.toString(), icon: ShoppingCart, color: 'from-emerald-500 to-green-500' },
    { label: 'Ganancias', value: formatCRC(stats.totalEarnings), icon: DollarSign, color: 'from-green-500 to-emerald-500' },
    { label: 'Rating', value: stats.avgRating.toFixed(1), icon: Star, color: 'from-purple-500 to-pink-500' },
    { label: 'Pendientes', value: stats.pendingOrders.toString(), icon: Radio, color: 'from-amber-600 to-yellow-500' },
    { label: 'Balance', value: formatCRC(stats.balance), icon: Wallet, color: 'from-green-500 to-emerald-500' },
  ];

  /* ── Active days summary ────────────────────────────────────── */

  const activeDays = DAY_KEYS.filter((d) => form.opening_hours[d].active);
  const allSameHours = activeDays.length > 0 && activeDays.every(
    (d) =>
      form.opening_hours[d].open === form.opening_hours[activeDays[0]].open &&
      form.opening_hours[d].close === form.opening_hours[activeDays[0]].close
  );

  const hoursSummary = (() => {
    if (activeDays.length === 0) return 'Cerrado todos los días';
    if (activeDays.length === 7) {
      if (allSameHours) return `Todos los días · ${form.opening_hours.mon.open} - ${form.opening_hours.mon.close}`;
      return 'Horario variable';
    }
    const dayNames = activeDays.map((d) => DAY_LABELS[d].slice(0, 3)).join(', ');
    if (allSameHours) return `${dayNames} · ${form.opening_hours[activeDays[0]].open} - ${form.opening_hours[activeDays[0]].close}`;
    return `${dayNames} · Horario variable`;
  })();

  /* ── Render ─────────────────────────────────────────────────── */

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 max-w-5xl">
      {/* Header */}
      <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Perfil de <span className="bg-gradient-to-r from-green-500 to-orange-500 bg-clip-text text-transparent">Tienda</span>
          </h1>
          <p className="text-gray-500 text-sm mt-1">Administra la información de tu tienda</p>
        </div>
        <div className="flex gap-2">
          {!isEditing ? (
            <motion.button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-green-600 bg-green-50 border border-green-200 hover:bg-green-100 transition-colors"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <Edit3 className="w-4 h-4" />
              Editar Perfil
            </motion.button>
          ) : (
            <>
              <motion.button
                onClick={() => {
                  // Revert form to vendor data
                  if (vendor) {
                    setForm({
                      store_name: vendor.store_name || '',
                      description: vendor.description || '',
                      phone: vendor.phone || '',
                      address: vendor.address || '',
                      category: vendor.category || 'other',
                      opening_hours: vendor.opening_hours
                        ? (vendor.opening_hours as Record<DayKey, DaySchedule>)
                        : defaultOpeningHours(),
                      min_order_amount: vendor.min_order_amount != null ? String(vendor.min_order_amount) : '',
                      delivery_radius_km: vendor.delivery_radius_km != null ? String(vendor.delivery_radius_km) : '',
                    });
                  }
                  setIsEditing(false);
                  setShowHours(false);
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-500 bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                <X className="w-4 h-4" />
                Cancelar
              </motion.button>
              <motion.button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white btn-neon disabled:opacity-50"
                whileHover={{ scale: saving ? 1 : 1.03 }}
                whileTap={{ scale: saving ? 1 : 0.97 }}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {saving ? 'Guardando...' : 'Guardar'}
              </motion.button>
            </>
          )}
        </div>
      </motion.div>

      {/* Store Card */}
      <motion.div variants={item} className="glass rounded-2xl overflow-hidden">
        {/* Banner */}
        <div className="h-28 bg-gradient-to-r from-green-500/20 via-emerald-500/20 to-teal-500/20 relative">
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        </div>

        <div className="px-6 pb-6 -mt-10 relative">
          {/* Avatar / Logo */}
          <div className="flex items-end gap-5 mb-6">
            <div className="relative">
              {logoUrl ? (
                <div className="w-20 h-20 rounded-2xl border-4 border-white shadow-lg overflow-hidden bg-gray-100">
                  <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white text-2xl font-bold border-4 border-white shadow-lg">
                  {(form.store_name || 'T').charAt(0).toUpperCase()}
                </div>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingLogo}
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-lg bg-green-500 flex items-center justify-center text-white shadow-lg hover:bg-green-400 transition-colors disabled:opacity-50"
              >
                {uploadingLogo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoUpload}
              />
            </div>
            <div className="flex-1 pb-1">
              {isEditing ? (
                <input
                  type="text"
                  value={form.store_name}
                  onChange={(e) => updateForm('store_name', e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-lg font-bold text-gray-900 focus:outline-none focus:border-green-500 mb-1"
                  placeholder="Nombre de la tienda"
                />
              ) : (
                <h2 className="text-xl font-bold text-gray-900">{form.store_name || 'Sin nombre'}</h2>
              )}
              <div className="flex items-center gap-2 mt-1">
                {isEditing ? (
                  <select
                    value={form.category}
                    onChange={(e) => updateForm('category', e.target.value)}
                    className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-0.5 text-[10px] font-medium text-gray-600 focus:outline-none focus:border-green-500"
                  >
                    {CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value} className="bg-white">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${CATEGORY_COLOR[form.category] || CATEGORY_COLOR.other}`}>
                    {CATEGORY_LABEL[form.category] || 'Otros'}
                  </span>
                )}
                {vendor?.is_approved && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                    Verificado
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="mb-4">
            {isEditing ? (
              <textarea
                value={form.description}
                onChange={(e) => updateForm('description', e.target.value)}
                rows={2}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-green-500 resize-none placeholder:text-gray-300"
                placeholder="Describe tu tienda..."
              />
            ) : (
              <p className="text-sm text-gray-500">{form.description || 'Sin descripción'}</p>
            )}
          </div>

          {/* Contact info */}
          <div className="grid sm:grid-cols-3 gap-4">
            {/* Phone */}
            <div className="p-3 rounded-xl bg-gray-50">
              <div className="flex items-center gap-2 mb-1">
                <Phone className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-[10px] text-gray-300 uppercase tracking-wider">Teléfono</span>
              </div>
              {isEditing ? (
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => updateForm('phone', e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1 text-sm text-gray-900 focus:outline-none focus:border-green-500"
                  placeholder="+506 8888 0000"
                />
              ) : (
                <p className="text-sm text-gray-600 truncate">{form.phone || '—'}</p>
              )}
            </div>

            {/* Address */}
            <div className="p-3 rounded-xl bg-gray-50">
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-[10px] text-gray-300 uppercase tracking-wider">Dirección</span>
              </div>
              {isEditing ? (
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => updateForm('address', e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1 text-sm text-gray-900 focus:outline-none focus:border-green-500"
                  placeholder="Dirección del local"
                />
              ) : (
                <p className="text-sm text-gray-600 truncate">{form.address || '—'}</p>
              )}
            </div>

            {/* Email (read-only from auth) */}
            <div className="p-3 rounded-xl bg-gray-50">
              <div className="flex items-center gap-2 mb-1">
                <User className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-[10px] text-gray-300 uppercase tracking-wider">Email</span>
              </div>
              <p className="text-sm text-gray-600 truncate">{user?.email || '—'}</p>
            </div>
          </div>

          {/* Delivery settings (edit mode) */}
          {isEditing && (
            <div className="grid sm:grid-cols-2 gap-4 mt-4">
              <div className="p-3 rounded-xl bg-gray-50">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-[10px] text-gray-300 uppercase tracking-wider">Pedido mínimo (₡)</span>
                </div>
                <input
                  type="number"
                  value={form.min_order_amount}
                  onChange={(e) => updateForm('min_order_amount', e.target.value)}
                  min="0"
                  step="100"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1 text-sm text-gray-900 focus:outline-none focus:border-green-500"
                  placeholder="0"
                />
              </div>
              <div className="p-3 rounded-xl bg-gray-50">
                <div className="flex items-center gap-2 mb-1">
                  <MapPin className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-[10px] text-gray-300 uppercase tracking-wider">Radio de entrega (km)</span>
                </div>
                <input
                  type="number"
                  value={form.delivery_radius_km}
                  onChange={(e) => updateForm('delivery_radius_km', e.target.value)}
                  min="0"
                  step="0.5"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1 text-sm text-gray-900 focus:outline-none focus:border-green-500"
                  placeholder="0"
                />
              </div>
            </div>
          )}

          {/* Opening Hours */}
          <div className="mt-4 p-4 rounded-xl bg-gray-50 border border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Horario</p>
                  {!isEditing && (
                    <p className="text-sm text-gray-900 font-medium">{hoursSummary}</p>
                  )}
                </div>
              </div>
              {isEditing && (
                <button
                  type="button"
                  onClick={() => setShowHours(!showHours)}
                  className="flex items-center gap-1.5 text-xs text-green-600 hover:text-green-700 transition-colors"
                >
                  {showHours ? 'Ocultar' : 'Editar horario'}
                  <ChevronDown className={`w-3 h-3 transition-transform ${showHours ? 'rotate-180' : ''}`} />
                </button>
              )}
            </div>

            {/* Day-by-day editor */}
            <AnimatePresence>
              {isEditing && showHours && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div className="mt-4 space-y-2">
                    {DAY_KEYS.map((day) => {
                      const schedule = form.opening_hours[day];
                      return (
                        <div
                          key={day}
                          className="flex items-center gap-3 py-2 px-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                        >
                          {/* Active toggle */}
                          <button
                            type="button"
                            onClick={() => updateDayHour(day, 'active', !schedule.active)}
                            className={`flex-shrink-0 w-5 h-5 rounded-md border transition-colors flex items-center justify-center ${
                              schedule.active
                                ? 'bg-green-500 border-green-500'
                                : 'bg-transparent border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            {schedule.active && <Check className="w-3 h-3 text-white" />}
                          </button>

                          {/* Day label */}
                          <span className={`w-20 text-sm flex-shrink-0 ${schedule.active ? 'text-gray-900 font-medium' : 'text-gray-300'}`}>
                            {DAY_LABELS[day]}
                          </span>

                          {/* Time inputs */}
                          {schedule.active ? (
                            <div className="flex items-center gap-2 flex-1">
                              <input
                                type="time"
                                value={schedule.open}
                                onChange={(e) => updateDayHour(day, 'open', e.target.value)}
                                className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-900 focus:outline-none focus:border-green-500"
                              />
                              <span className="text-xs text-gray-400">—</span>
                              <input
                                type="time"
                                value={schedule.close}
                                onChange={(e) => updateDayHour(day, 'close', e.target.value)}
                                className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-900 focus:outline-none focus:border-green-500"
                              />
                            </div>
                          ) : (
                            <span className="text-xs text-gray-300 flex-1">Cerrado</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            className="glass rounded-2xl p-5 group hover:glow-cyan transition-all duration-300"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.05 }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-lg`}>
                <stat.icon className="w-5 h-5 text-white" />
              </div>
              <TrendingUp className="w-4 h-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-xs text-gray-400 mt-1">{stat.label}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Earnings & Transactions */}
      <div className="grid lg:grid-cols-5 gap-6">
        {/* Earnings Summary */}
        <motion.div variants={item} className="lg:col-span-2 glass rounded-2xl p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-1">Ganancias</h2>
          <p className="text-xs text-gray-400 mb-5">Resumen financiero</p>

          <div className="space-y-4">
            {/* Balance */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-200">
              <p className="text-xs text-green-600 font-medium mb-1">Balance Disponible</p>
              <p className="text-2xl font-bold text-gray-900">{formatCRC(stats.balance)}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-gray-50">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Pendiente</p>
                <p className="text-sm font-semibold text-amber-600">{formatCRC(wallet?.pending_balance ?? 0)}</p>
              </div>
              <div className="p-3 rounded-xl bg-gray-50">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Ganado</p>
                <p className="text-sm font-semibold text-emerald-600">{formatCRC(wallet?.total_earned ?? 0)}</p>
              </div>
              <div className="p-3 rounded-xl bg-gray-50">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Retirado</p>
                <p className="text-sm font-semibold text-red-600">{formatCRC(wallet?.total_withdrawn ?? 0)}</p>
              </div>
              <div className="p-3 rounded-xl bg-gray-50">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Pedidos</p>
                <p className="text-sm font-semibold text-gray-900">{stats.totalOrders}</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Recent Transactions */}
        <motion.div variants={item} className="lg:col-span-3 glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Transacciones</h2>
              <p className="text-xs text-gray-400 mt-0.5">Últimos 10 movimientos</p>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto space-y-2">
            {transactions.length === 0 ? (
              <div className="text-center py-12">
                <Wallet className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Sin transacciones aún</p>
              </div>
            ) : (
              transactions.map((tx, i) => {
                const config = TX_TYPE_CONFIG[tx.type] || TX_TYPE_CONFIG.adjustment;
                const statusConfig = TX_STATUS_CONFIG[tx.status] || TX_STATUS_CONFIG.pending;
                const IconComp = config.icon;
                const isPositive = tx.type === 'earning';

                return (
                  <motion.div
                    key={tx.id}
                    className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + i * 0.03 }}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      isPositive ? 'bg-emerald-50' : 'bg-red-50'
                    }`}>
                      <IconComp className={`w-4 h-4 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-gray-900 font-medium truncate">{config.label}</p>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${statusConfig.color}`}>
                          {statusConfig.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 truncate">{tx.description || 'Sin descripción'}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-sm font-semibold ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                        {isPositive ? '+' : '-'}{formatCRC(tx.amount)}
                      </p>
                      {tx.created_at && (
                        <p className="text-[10px] text-gray-300">{relativeTime(tx.created_at)}</p>
                      )}
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </motion.div>
      </div>

      {/* Quick Links */}
      <motion.div variants={item} className="glass rounded-2xl overflow-hidden">
        {menuItems.map((menuItem, i) => (
          <motion.button
            key={menuItem.label}
            onClick={menuItem.action}
            className={`w-full flex items-center gap-4 px-6 py-4 hover:bg-gray-100 transition-colors ${
              menuItem.label === 'Cerrar Sesión' ? 'border-t border-gray-200' : ''
            }`}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35 + i * 0.03 }}
            whileHover={{ x: 4 }}
          >
            <div className={`w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center ${menuItem.color}`}>
              <menuItem.icon className="w-4 h-4" />
            </div>
            <span className="text-sm text-gray-600 flex-1 text-left">{menuItem.label}</span>
            <CircleDot className="w-3.5 h-3.5 text-gray-400" />
          </motion.button>
        ))}
      </motion.div>

      {/* ── Notifications Modal ──────────────────────────────────── */}
      <AnimatePresence>
        {activePanel === 'notifications' && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setActivePanel(null)} />
            <motion.div
              className="relative w-full max-w-lg glass-strong rounded-2xl p-6 z-10 max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                    <Bell className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Notificaciones</h3>
                    <p className="text-xs text-gray-400">Configura tus alertas</p>
                  </div>
                </div>
                <button
                  onClick={() => setActivePanel(null)}
                  className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Toggles */}
              <div className="space-y-3">
                {([
                  { key: 'newOrders' as const, label: 'Nuevos pedidos', desc: 'Recibe alertas cuando lleguen nuevos pedidos' },
                  { key: 'orderStatus' as const, label: 'Estado de pedidos', desc: 'Actualizaciones sobre el estado de tus entregas' },
                  { key: 'earnings' as const, label: 'Ganancias', desc: 'Notificaciones sobre pagos y retiros' },
                  { key: 'support' as const, label: 'Mensajes del soporte', desc: 'Comunicados y respuestas del equipo de soporte' },
                ]).map((pref) => (
                  <div key={pref.key} className="flex items-center justify-between p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex-1 mr-4">
                      <p className="text-sm font-medium text-gray-900">{pref.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{pref.desc}</p>
                    </div>
                    <button
                      onClick={() => setNotifPrefs((prev) => ({ ...prev, [pref.key]: !prev[pref.key] }))}
                      className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200 ${
                        notifPrefs[pref.key] ? 'bg-green-500' : 'bg-gray-100'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
                          notifPrefs[pref.key] ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>

              {/* Save button */}
              <div className="mt-6">
                <motion.button
                  onClick={() => {
                    toast.success('Preferencias de notificaciones guardadas');
                    setActivePanel(null);
                  }}
                  className="w-full py-2.5 rounded-xl text-sm font-medium text-white btn-neon"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Guardar Preferencias
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Terms & Conditions Modal ─────────────────────────────── */}
      <AnimatePresence>
        {activePanel === 'terms' && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setActivePanel(null)} />
            <motion.div
              className="relative w-full max-w-lg glass-strong rounded-2xl p-6 z-10 max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Términos y Condiciones</h3>
                    <p className="text-xs text-gray-400">RIDA SUPREME SYSTEM</p>
                  </div>
                </div>
                <button
                  onClick={() => setActivePanel(null)}
                  className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Content */}
              <div className="space-y-5 text-sm text-gray-600 leading-relaxed">
                <div>
                  <h4 className="text-sm font-semibold text-green-600 mb-1.5">1. Uso del Servicio</h4>
                  <p className="text-xs text-gray-500">
                    RIDA SUPREME SYSTEM es una plataforma de entrega y comercio electrónico que conecta vendedores con compradores en Costa Rica. Al registrarte como vendedor, aceptas utilizar la plataforma de manera responsable, cumpliendo con todas las leyes y regulaciones aplicables en la República de Costa Rica. Queda prohibido el uso de la plataforma para actividades ilegales, fraudulentas o que violen derechos de terceros.
                  </p>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-green-600 mb-1.5">2. Registro de Vendedor</h4>
                  <p className="text-xs text-gray-500">
                    Para vender en RIDA SUPREME SYSTEM, debes proporcionar información veraz y completa: nombre del negocio, número de teléfono, dirección física, categoría de productos y documentación legal requerida. La plataforma se reserva el derecho de aprobar o rechazar solicitudes de registro a su discreción. Es responsabilidad del vendedor mantener su información actualizada.
                  </p>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-green-600 mb-1.5">3. Comisiones</h4>
                  <p className="text-xs text-gray-500">
                    RIDA SUPREME SYSTEM aplica una comisión del <span className="text-amber-600 font-medium">15%</span> sobre el monto total de cada venta realizada a través de la plataforma. Esta comisión cubre los costos de mantenimiento, desarrollo tecnológico, soporte al vendedor y procesamiento de pagos. La comisión se deduce automáticamente antes de acreditar las ganancias al vendedor.
                  </p>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-green-600 mb-1.5">4. Pagos</h4>
                  <p className="text-xs text-gray-500">
                    Los pagos a vendedores se procesan en colones costarricenses (₡). Los retiros están sujetos a un período mínimo de procesamiento de 48 horas hábiles. El saldo disponible para retiro se muestra en el panel de ganancias. RIDA SUPREME SYSTEM no se responsabiliza por demoras causadas por entidades bancarias o procesadores de pago externos. El monto mínimo de retiro es de ₡5,000.
                  </p>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-green-600 mb-1.5">5. Responsabilidad</h4>
                  <p className="text-xs text-gray-500">
                    El vendedor es responsable de la calidad de sus productos, tiempos de entrega y atención al cliente. RIDA SUPREME SYSTEM actúa como intermediario tecnológico y no se hace responsable por defectos en los productos, incumplimientos de entrega por parte del vendedor, ni disputas entre vendedor y comprador. Sin embargo, nos comprometemos a mediar en caso de controversias.
                  </p>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-green-600 mb-1.5">6. Modificaciones</h4>
                  <p className="text-xs text-gray-500">
                    RIDA SUPREME SYSTEM se reserva el derecho de modificar estos términos en cualquier momento. Los cambios entrarán en vigencia a partir de su publicación en la plataforma. Se notificará a los vendedores sobre cambios significativos mediante correo electrónico o notificación dentro de la plataforma. El uso continuado del servicio después de modificaciones constituye aceptación de los nuevos términos.
                  </p>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-green-600 mb-1.5">7. Contacto</h4>
                  <p className="text-xs text-gray-500">
                    Para consultas sobre estos Términos y Condiciones, puedes contactarnos a través de la sección de Soporte dentro de la plataforma o escribirnos a <span className="text-green-600">soporte@ridasupremesystem.com</span>. Nuestro equipo de soporte está disponible de lunes a viernes de 8:00 a.m. a 6:00 p.m., horario de Costa Rica.
                  </p>
                </div>

                <div className="pt-2 border-t border-gray-100">
                  <p className="text-[10px] text-gray-300">Última actualización: Enero 2025 · San José, Costa Rica</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Privacy Policy Modal ─────────────────────────────────── */}
      <AnimatePresence>
        {activePanel === 'privacy' && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setActivePanel(null)} />
            <motion.div
              className="relative w-full max-w-lg glass-strong rounded-2xl p-6 z-10 max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Política de Privacidad</h3>
                    <p className="text-xs text-gray-400">RIDA SUPREME SYSTEM</p>
                  </div>
                </div>
                <button
                  onClick={() => setActivePanel(null)}
                  className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Content */}
              <div className="space-y-5 text-sm text-gray-600 leading-relaxed">
                <div>
                  <h4 className="text-sm font-semibold text-purple-600 mb-1.5">1. Datos que se Recopilan</h4>
                  <p className="text-xs text-gray-500">
                    Recopilamos la información necesaria para operar la plataforma: nombre del negocio, información de contacto (teléfono, correo electrónico, dirección), datos bancarios para procesamiento de pagos, catálogo de productos, historial de transacciones y datos de uso de la plataforma. Toda la información se almacena de forma segura en servidores encriptados.
                  </p>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-purple-600 mb-1.5">2. Uso de Datos</h4>
                  <p className="text-xs text-gray-500">
                    Sus datos se utilizan exclusivamente para: procesar transacciones y pagos, gestionar su cuenta de vendedor, mejorar la experiencia del usuario en la plataforma, enviar notificaciones relevantes sobre su cuenta y pedidos, cumplir con obligaciones legales y regulatorias en Costa Rica, y generar reportes estadísticos anónimos para mejorar nuestros servicios.
                  </p>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-purple-600 mb-1.5">3. Protección de Datos</h4>
                  <p className="text-xs text-gray-500">
                    Implementamos medidas de seguridad de nivel empresarial que incluyen: encriptación SSL/TLS para todas las comunicaciones, almacenamiento en bases de datos encriptadas, controles de acceso basados en roles, auditorías de seguridad periódicas y cumplimiento con las leyes de protección de datos de Costa Rica. Nunca compartimos su información personal con terceros sin su consentimiento explícito.
                  </p>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-purple-600 mb-1.5">4. Cookies</h4>
                  <p className="text-xs text-gray-500">
                    Utilizamos cookies y tecnologías similares para: mantener su sesión activa, recordar sus preferencias, analizar el uso de la plataforma y mostrar contenido relevante. Puede configurar su navegador para bloquear cookies, aunque esto podría afectar la funcionalidad de ciertas características de la plataforma.
                  </p>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-purple-600 mb-1.5">5. Derechos del Usuario</h4>
                  <p className="text-xs text-gray-500">
                    Como usuario de RIDA SUPREME SYSTEM, usted tiene derecho a: acceder a sus datos personales en cualquier momento, solicitar la corrección de datos inexactos, solicitar la eliminación de su cuenta y datos asociados, exportar su información en formato legible, y retirar su consentimiento para el procesamiento de datos. Para ejercer estos derechos, contacte a nuestro equipo de soporte.
                  </p>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-purple-600 mb-1.5">6. Contacto</h4>
                  <p className="text-xs text-gray-500">
                    Para cualquier consulta relacionada con esta Política de Privacidad, puede contactarnos a través de la sección de Soporte en la plataforma o escribir a <span className="text-purple-600">privacidad@ridasupremesystem.com</span>. Responderemos su solicitud en un plazo máximo de 15 días hábiles conforme a la legislación costarricense.
                  </p>
                </div>

                <div className="pt-2 border-t border-gray-100">
                  <p className="text-[10px] text-gray-300">Última actualización: Enero 2025 · San José, Costa Rica</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Logout Confirmation Modal ────────────────────────────── */}
      <AnimatePresence>
        {activePanel === 'logout' && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setActivePanel(null)} />
            <motion.div
              className="relative w-full max-w-sm glass-strong rounded-2xl p-6 z-10"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              {/* Header */}
              <div className="flex flex-col items-center text-center mb-6">
                <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
                  <LogOut className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">¿Estás seguro?</h3>
                <p className="text-sm text-gray-500 mt-1">¿Estás seguro de que deseas cerrar sesión?</p>
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <motion.button
                  onClick={() => setActivePanel(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-600 bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Cancelar
                </motion.button>
                <motion.button
                  onClick={() => {
                    setActivePanel(null);
                    toast.success('Sesión cerrada');
                    logout();
                    router.replace('/marketplace/login');
                  }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 transition-colors"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Cerrar Sesión
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
