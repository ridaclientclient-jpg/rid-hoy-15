'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Car, Star, CheckCircle2, XCircle, Clock,
  Eye, MoreHorizontal, AlertTriangle, Loader2,
  User, CreditCard, FileCheck, X, ShieldCheck, ShieldX,
  ChevronRight, ShieldOff, Wallet, RefreshCw, Users,
} from 'lucide-react';
import { supabase, type Profile, type Vehicle, type Document } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

/* ─── Types ────────────────────────────────────────────────── */
type DriverStatus = 'pending' | 'verified' | 'rejected' | 'online' | 'offline' | 'suspended' | 'busy';
type DocStatus = 'pending' | 'approved' | 'rejected';

interface DriverData {
  id: string;
  userId: string;
  name: string;
  phone: string;
  vehicle: string;
  plate: string;
  vehicleVerified: boolean;
  vehicleId: string | null;
  rating: number;
  totalRides: number;
  totalEarnings: number;
  earnings: string;
  status: DriverStatus;
  joined: string;
  avatar: string;
  documents: Record<string, DocStatus>;
  docCount: number;
  totalDocs: number;
}

/* ─── Document type definitions ───────────────────────────── */
const DOCUMENT_TYPES = [
  { type: 'selfie', label: 'Selfie', icon: User },
  { type: 'id_front', label: 'Cedula Frente', icon: CreditCard },
  { type: 'id_back', label: 'Cedula Reverso', icon: CreditCard },
  { type: 'license_front', label: 'Licencia Frente', icon: CreditCard },
  { type: 'license_back', label: 'Licencia Reverso', icon: CreditCard },
  { type: 'vehicle_front', label: 'Vehiculo Frente', icon: Car },
  { type: 'vehicle_side', label: 'Vehiculo Lateral', icon: Car },
  { type: 'vehicle_back', label: 'Vehiculo Atras', icon: Car },
  { type: 'vehicle_interior', label: 'Interior Vehiculo', icon: Car },
  { type: 'circulacion', label: 'Circulacion Vehicular', icon: FileCheck },
  { type: 'marchamo', label: 'Marchamo', icon: FileCheck },
];

/* ─── Configs ──────────────────────────────────────────────── */
const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: 'Pendiente', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: Clock },
  verified: { label: 'Verificado', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: CheckCircle2 },
  rejected: { label: 'Rechazado', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: XCircle },
  online: { label: 'En linea', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30', icon: CheckCircle2 },
  offline: { label: 'Desconectado', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', icon: Clock },
  suspended: { label: 'Suspendido', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: XCircle },
  busy: { label: 'Ocupado', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: Clock },
};

const docStatusConfig: Record<DocStatus, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: 'Pendiente', color: 'text-amber-400', icon: Clock },
  approved: { label: 'Aprobado', color: 'text-emerald-400', icon: CheckCircle2 },
  rejected: { label: 'Rechazado', color: 'text-red-400', icon: XCircle },
};

const docStatusBg: Record<DocStatus, string> = {
  pending: 'bg-amber-500/10 border-amber-500/20',
  approved: 'bg-emerald-500/10 border-emerald-500/20',
  rejected: 'bg-red-500/10 border-red-500/20',
};

const filterTabs = ['Todos', 'Pendientes', 'Verificados', 'Rechazados', 'En linea', 'Desconectados'] as const;

/* ─── Helpers ──────────────────────────────────────────────── */
function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function formatEarnings(amount: number): string {
  if (amount >= 1000000) return `₡${(amount / 1000000).toFixed(2)}M`;
  if (amount >= 1000) return `₡${(amount / 1000).toFixed(0)}k`;
  return `₡${amount.toLocaleString()}`;
}

function formatCurrency(amount: number): string {
  return `₡${Math.round(amount).toLocaleString('es-CR')}`;
}

/* ─── Loading Skeleton ────────────────────────────────────── */
function DriversSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-9 w-48 bg-white/10" />
          <Skeleton className="h-5 w-64 mt-2 bg-white/5" />
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass rounded-xl p-4">
            <Skeleton className="h-5 w-20 bg-white/10 mb-2" />
            <Skeleton className="h-8 w-12 bg-white/5" />
          </div>
        ))}
      </div>
      <div className="glass rounded-2xl p-4">
        <Skeleton className="h-10 w-full bg-white/5" />
        <div className="flex gap-2 mt-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 bg-white/5" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass rounded-2xl p-5">
            <div className="flex items-start gap-4">
              <Skeleton className="w-12 h-12 rounded-xl bg-white/10" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32 bg-white/10" />
                <Skeleton className="h-3 w-48 bg-white/5" />
                <Skeleton className="h-3 w-24 bg-white/5" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export default function DriversPage() {
  const adminUser = useAuthStore((s) => s.user);

  const [drivers, setDrivers] = useState<DriverData[]>([]);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('Todos');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  /* ─── Detail Modal State ──────────────────────────────── */
  const [selectedDriver, setSelectedDriver] = useState<DriverData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [driverDocs, setDriverDocs] = useState<Document[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [earningsHistory, setEarningsHistory] = useState<{ date: string; amount: number }[]>([]);

  /* ─── Document Review Modal State ─────────────────────── */
  const [reviewDriver, setReviewDriver] = useState<DriverData | null>(null);
  const [reviewDocs, setReviewDocs] = useState<Document[]>([]);
  const [reviewUrls, setReviewUrls] = useState<Record<string, string>>({});
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewActions, setReviewActions] = useState<Record<string, 'approve' | 'reject'>>({});
  const [reviewReasons, setReviewReasons] = useState<Record<string, string>>({});
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  /* ─── Full-size Image Viewer ──────────────────────────── */
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerLabel, setViewerLabel] = useState('');

  /* ─── Stats ───────────────────────────────────────────── */
  const statsData = {
    total: drivers.length,
    online: drivers.filter(d => d.status === 'online').length,
    pending: drivers.filter(d => d.status === 'pending').length,
    suspended: drivers.filter(d => d.status === 'suspended').length,
  };

  /* ═════════════════════════════════════════════════════════
     FETCH DRIVERS (with documents)
     ═════════════════════════════════════════════════════════ */
  const fetchDrivers = useCallback(async () => {
    setLoading(true);
    try {
      const { data: driverRecords, error } = await supabase
        .from('drivers')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error fetching drivers:', error.message);
        toast.error('Error al cargar conductores');
        setLoading(false);
        return;
      }

      // Cast to any[] — DB schema has more status values (pending, verified, rejected)
      // than the TS Driver type union ('offline' | 'online' | 'busy' | 'suspended')
      const records = (driverRecords || []) as any[];

      if (records.length === 0) {
        setDrivers([]);
        setLoading(false);
        return;
      }

      const userIds = records.map((d: any) => d.user_id).filter(Boolean);
      const driverIds = records.map((d: any) => d.id).filter(Boolean);

      /* Batch fetch profiles */
      const profileMap: Record<string, Profile> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('*')
          .in('id', userIds);
        if (profiles) profiles.forEach((p) => { profileMap[p.id] = p; });
      }

      /* Batch fetch vehicles */
      const vehicleMap: Record<string, Vehicle> = {};
      if (driverIds.length > 0) {
        const { data: vehicles } = await supabase
          .from('vehicles')
          .select('*')
          .in('driver_id', driverIds);
        if (vehicles) vehicles.forEach((v) => { vehicleMap[v.driver_id] = v; });
      }

      /* Batch fetch ALL documents for these users */
      const docsMap: Record<string, Document[]> = {};
      if (userIds.length > 0) {
        const { data: allDocs } = await supabase
          .from('documents')
          .select('*')
          .in('user_id', userIds);
        if (allDocs) {
          allDocs.forEach((doc) => {
            if (!docsMap[doc.user_id]) docsMap[doc.user_id] = [];
            docsMap[doc.user_id].push(doc);
          });
        }
      }

      /* Map to DriverData */
      const mapped: DriverData[] = records.map((d: any) => {
        const profile = profileMap[d.user_id || ''];
        const vehicle = vehicleMap[d.id || ''];
        const userDocs = docsMap[d.user_id || ''] || [];
        const status = d.status || 'offline';
        const isVerified = d.is_verified || false;

        const docStatusMap: Record<string, DocStatus> = {};
        let docCount = 0;
        userDocs.forEach((doc) => {
          docStatusMap[doc.type] = doc.status as DocStatus;
          docCount++;
        });

        if (isVerified && docCount === 0) {
          DOCUMENT_TYPES.forEach((dt) => { docStatusMap[dt.type] = 'approved'; });
        }

        return {
          id: d.id,
          userId: d.user_id,
          name: profile?.name || 'Desconocido',
          phone: profile?.phone || 'N/A',
          vehicle: vehicle ? `${vehicle.model} ${vehicle.year || ''}`.trim() : 'Sin vehiculo',
          plate: vehicle?.plate || '-',
          vehicleVerified: vehicle?.verified || false,
          vehicleId: vehicle?.id || null,
          rating: d.rating || 0,
          totalRides: d.total_rides || 0,
          totalEarnings: d.total_earnings || 0,
          status: status as DriverStatus,
          joined: d.created_at || '',
          avatar: getInitials(profile?.name || 'D'),
          earnings: formatEarnings(d.total_earnings || 0),
          documents: docStatusMap,
          docCount,
          totalDocs: DOCUMENT_TYPES.length,
        };
      });

      setDrivers(mapped);
    } catch (err) {
      console.error('Error fetching drivers:', err);
      toast.error('Error al cargar conductores');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDrivers();
  }, [fetchDrivers]);

  /* ═════════════════════════════════════════════════════════
     SUPABASE REALTIME SUBSCRIPTION
     ═════════════════════════════════════════════════════════ */
  useEffect(() => {
    const channel = supabase
      .channel('drivers-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, (payload) => {
        if (payload.eventType === 'UPDATE' && payload.new) {
          const updated = payload.new as any;
          setDrivers(prev => prev.map(d => {
            if (d.id === updated.id) {
              return {
                ...d,
                status: updated.status || d.status,
                rating: updated.rating ?? d.rating,
                totalRides: updated.total_rides ?? d.totalRides,
                totalEarnings: updated.total_earnings ?? d.totalEarnings,
                earnings: formatEarnings(updated.total_earnings ?? d.totalEarnings),
              };
            }
            return d;
          }));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  /* ═════════════════════════════════════════════════════════
     FILTER
     ═════════════════════════════════════════════════════════ */
  const filteredDrivers = drivers.filter((d) => {
    const matchSearch =
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.plate.toLowerCase().includes(search.toLowerCase());
    let matchFilter = true;
    switch (activeFilter) {
      case 'Pendientes': matchFilter = d.status === 'pending'; break;
      case 'Verificados': matchFilter = d.status === 'verified' || d.status === 'online'; break;
      case 'Rechazados': matchFilter = d.status === 'rejected'; break;
      case 'En linea': matchFilter = d.status === 'online'; break;
      case 'Desconectados': matchFilter = d.status === 'offline'; break;
    }
    return matchSearch && matchFilter;
  });

  /* ═════════════════════════════════════════════════════════
     SIGNED URLs HELPER
     ═════════════════════════════════════════════════════════ */
  const loadSignedUrls = async (docs: Document[]): Promise<Record<string, string>> => {
    const urls: Record<string, string> = {};
    for (const doc of docs) {
      try {
        const { data } = await supabase.storage
          .from('documents')
          .createSignedUrl(doc.url, 3600);
        if (data?.signedUrl) urls[doc.type] = data.signedUrl;
      } catch (err) {
        console.warn('Error getting signed URL for', doc.type);
      }
    }
    return urls;
  };

  /* ═════════════════════════════════════════════════════════
     SUSPEND/ACTIVATE TOGGLE
     ═════════════════════════════════════════════════════════ */
  const toggleSuspend = async (driverId: string, driverName: string, currentStatus: DriverStatus) => {
    const newStatus = currentStatus === 'suspended' ? 'offline' : 'suspended';
    try {
      const { error } = await supabase
        .from('drivers')
        .update({ status: newStatus })
        .eq('id', driverId);

      if (error) {
        toast.error('Error al actualizar estado del conductor');
        return;
      }

      toast.success(newStatus === 'suspended'
        ? `Conductor ${driverName} suspendido`
        : `Conductor ${driverName} reactivado`
      );
      setDrivers(prev => prev.map(d =>
        d.id === driverId ? { ...d, status: newStatus as DriverStatus } : d
      ));
    } catch (err) {
      toast.error('Error al actualizar estado del conductor');
    }
    setOpenMenu(null);
  };

  /* ═════════════════════════════════════════════════════════
     OPEN DETAIL MODAL
     ═════════════════════════════════════════════════════════ */
  const openDetail = async (driver: DriverData) => {
    setSelectedDriver(driver);
    setOpenMenu(null);
    setDetailLoading(true);
    setSignedUrls({});
    setEarningsHistory([]);

    try {
      const [docsRes, transactionsRes] = await Promise.all([
        supabase
          .from('documents')
          .select('*')
          .eq('user_id', driver.userId)
          .order('created_at', { ascending: true }),
        // Fetch wallet transactions for earnings
        supabase
          .from('wallets')
          .select('id')
          .eq('user_id', driver.userId)
          .single(),
      ]);

      const docsList = docsRes.data || [];
      setDriverDocs(docsList);

      if (docsList.length > 0) {
        const urls = await loadSignedUrls(docsList);
        setSignedUrls(urls);
      }

      // Fetch earnings history from transactions
      if (transactionsRes.data) {
        const { data: transactions } = await supabase
          .from('transactions')
          .select('amount, type, created_at')
          .eq('wallet_id', transactionsRes.data.id)
          .in('type', ['credit', 'ride_payment'])
          .order('created_at', { ascending: false })
          .limit(20);

        if (transactions) {
          setEarningsHistory(transactions.map(t => ({
            date: t.created_at,
            amount: t.amount,
          })));
        }
      }
    } catch (err) {
      console.error('Error loading driver details:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  /* ═════════════════════════════════════════════════════════
     OPEN DOCUMENT REVIEW MODAL
     ═════════════════════════════════════════════════════════ */
  const openReview = async (driver: DriverData) => {
    setReviewDriver(driver);
    setOpenMenu(null);
    setReviewLoading(true);
    setReviewActions({});
    setReviewReasons({});
    setReviewComment('');
    setReviewUrls({});

    try {
      const { data: docs } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', driver.userId)
        .order('created_at', { ascending: true });

      const docsList = docs || [];
      setReviewDocs(docsList);

      if (docsList.length > 0) {
        const urls = await loadSignedUrls(docsList);
        setReviewUrls(urls);
      }
    } catch (err) {
      console.error('Error loading review documents:', err);
    } finally {
      setReviewLoading(false);
    }
  };

  /* ═════════════════════════════════════════════════════════
     SET REVIEW ACTION
     ═════════════════════════════════════════════════════════ */
  const setAction = (docType: string, action: 'approve' | 'reject') => {
    setReviewActions((prev) => ({ ...prev, [docType]: action }));
    if (action === 'approve') {
      setReviewReasons((prev) => {
        const next = { ...prev };
        delete next[docType];
        return next;
      });
    }
  };

  /* ═════════════════════════════════════════════════════════
     SUBMIT REVIEW
     ═════════════════════════════════════════════════════════ */
  const submitReview = async () => {
    if (!reviewDriver || !adminUser) return;

    const actionsCount = Object.keys(reviewActions).length;
    if (actionsCount === 0) {
      toast.error('Debes aprobar o rechazar al menos un documento');
      return;
    }

    setSubmittingReview(true);
    try {
      let allApproved = true;
      const rejectedDocs: string[] = [];

      for (const [docType, action] of Object.entries(reviewActions)) {
        const doc = reviewDocs.find((d) => d.type === docType);
        if (!doc) continue;

        const newStatus = action === 'approve' ? 'approved' : 'rejected';
        const reason = action === 'reject' ? reviewReasons[docType] || 'No especificado' : null;

        const { error } = await supabase
          .from('documents')
          .update({
            status: newStatus,
            reviewed_by: adminUser.id,
            reviewed_at: new Date().toISOString(),
            rejection_reason: reason,
          })
          .eq('id', doc.id);

        if (error) {
          console.error('Error updating doc', docType, ':', error.message);
        }

        if (action === 'reject') {
          allApproved = false;
          const label = DOCUMENT_TYPES.find((dt) => dt.type === docType)?.label || docType;
          rejectedDocs.push(label + (reason ? ` (${reason})` : ''));
        }
      }

      const { data: allDocsNow } = await supabase
        .from('documents')
        .select('status')
        .eq('user_id', reviewDriver.userId);

      const anyPending = allDocsNow?.some((d) => d.status === 'pending') || false;
      const anyRejected = allDocsNow?.some((d) => d.status === 'rejected') || false;

      if (!anyPending && !anyRejected) {
        await supabase
          .from('drivers')
          .update({ is_verified: true, status: 'verified' })
          .eq('id', reviewDriver.id);

        await supabase.from('app_notifications').insert({
          user_id: reviewDriver.userId,
          title: 'Cuenta verificada',
          message: 'Felicidades! Todos tus documentos han sido aprobados. Ya puedes comenzar a recibir viajes.',
          type: 'verification',
          is_read: false,
        });

        toast.success(`Conductor ${reviewDriver.name} verificado correctamente`);
      } else {
        if (anyRejected) {
          await supabase
            .from('drivers')
            .update({ status: 'pending' })
            .eq('id', reviewDriver.id);

          const missingText = rejectedDocs.join(', ');
          await supabase.from('app_notifications').insert({
            user_id: reviewDriver.userId,
            title: 'Documentos pendientes de revision',
            message: `Algunos documentos necesitan correcciones: ${missingText}. Por favor actualiza los documentos rechazados para continuar.`,
            type: 'verification',
            is_read: false,
          });

          toast.warning(`Se notifico a ${reviewDriver.name} sobre documentos por corregir`);
        } else {
          toast.info('Revision guardada. Quedan documentos pendientes por revisar.');
        }
      }

      if (reviewComment.trim()) {
        await supabase.from('app_notifications').insert({
          user_id: reviewDriver.userId,
          title: 'Comentario del administrador',
          message: reviewComment.trim(),
          type: 'system',
          is_read: false,
        });
      }

      setReviewDriver(null);
      fetchDrivers();
    } catch (err: any) {
      console.error('Submit review error:', err);
      toast.error('Error al enviar revision');
    } finally {
      setSubmittingReview(false);
    }
  };

  /* ═════════════════════════════════════════════════════════
     QUICK ACTIONS
     ═════════════════════════════════════════════════════════ */
  const quickApprove = async (driverId: string, driverName: string) => {
    try {
      const { error } = await supabase
        .from('drivers')
        .update({ is_verified: true, status: 'verified' })
        .eq('id', driverId);
      if (error) {
        toast.error('Error al aprobar conductor');
        return;
      }
      toast.success(`Conductor ${driverName} aprobado`);
      fetchDrivers();
    } catch (err) {
      toast.error('Error al aprobar conductor');
    }
    setOpenMenu(null);
  };

  /* ─── Approve / Reject Vehicle ─────────────────────────── */
  const approveVehicle = async (driverId: string, vehicleId: string, driverName: string, currentPlate: string) => {
    try {
      const { error } = await supabase
        .from('vehicles')
        .update({ verified: true })
        .eq('id', vehicleId)
        .eq('driver_id', driverId);
      if (error) {
        toast.error('Error al aprobar vehiculo');
        return;
      }
      toast.success(`Vehiculo ${currentPlate} de ${driverName} aprobado`);
      fetchDrivers();
      // If detail modal is open, refresh it too
      if (selectedDriver?.id === driverId) {
        const refreshed = await supabase.from('drivers').select('*').eq('id', driverId).single();
        if (refreshed.data) {
          const v = await supabase.from('vehicles').select('*').eq('driver_id', driverId).maybeSingle();
          setSelectedDriver({
            ...selectedDriver,
            vehicleVerified: v.data?.verified || false,
          });
        }
      }
    } catch (err) {
      toast.error('Error al aprobar vehiculo');
    }
    setOpenMenu(null);
  };

  const rejectVehicle = async (driverId: string, vehicleId: string, driverName: string, currentPlate: string) => {
    try {
      const { error } = await supabase
        .from('vehicles')
        .update({ verified: false })
        .eq('id', vehicleId)
        .eq('driver_id', driverId);
      if (error) {
        toast.error('Error al rechazar vehiculo');
        return;
      }
      toast.success(`Vehiculo ${currentPlate} de ${driverName} rechazado`);
      fetchDrivers();
    } catch (err) {
      toast.error('Error al rechazar vehiculo');
    }
    setOpenMenu(null);
  };

  /* ═════════════════════════════════════════════════════════
     DOCUMENT STATUS SUMMARY FOR CARD
     ═════════════════════════════════════════════════════════ */
  const getDocSummary = (driver: DriverData) => {
    const docs = driver.documents;
    const approved = Object.values(docs).filter((s) => s === 'approved').length;
    const rejected = Object.values(docs).filter((s) => s === 'rejected').length;
    const pending = Object.values(docs).filter((s) => s === 'pending').length;
    return { approved, rejected, pending, total: driver.docCount };
  };

  /* ═════════════════════════════════════════════════════════
     RENDER
     ═════════════════════════════════════════════════════════ */
  if (loading) return <DriversSkeleton />;

  return (
    <div className="space-y-6">
      {/* ─── Stats Bar ────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Conductores', value: statsData.total, icon: Users, color: 'text-white' },
          { label: 'Online Ahora', value: statsData.online, icon: Car, color: 'text-cyan-400' },
          { label: 'Pendientes Aprob.', value: statsData.pending, icon: Clock, color: 'text-amber-400' },
          { label: 'Suspendidos', value: statsData.suspended, icon: ShieldOff, color: 'text-red-400' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            className="glass rounded-xl p-4"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
              <p className="text-xs text-gray-500 uppercase tracking-wider">{stat.label}</p>
            </div>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* ─── Header ──────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Conductores</h1>
          <p className="text-gray-400 mt-1">{drivers.length} conductores registrados</p>
        </div>
        <button
          onClick={fetchDrivers}
          className="flex items-center gap-2 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Actualizar
        </button>
      </div>

      {/* ─── Search & Filters ───────────────────────────── */}
      <div className="glass rounded-2xl p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar por nombre o placa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-cyan-500 text-white placeholder:text-gray-600 outline-none text-sm transition-all"
          />
        </div>
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
          {filterTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveFilter(tab)}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                activeFilter === tab
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-transparent'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Driver Cards ───────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AnimatePresence mode="popLayout">
          {filteredDrivers.map((driver, i) => {
            const cfg = statusConfig[driver.status] || statusConfig.offline;
            const DriverIcon = cfg.icon;
            const summary = getDocSummary(driver);

            return (
              <motion.div
                key={driver.id}
                layout
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ delay: i * 0.03 }}
                className="glass rounded-2xl p-5 hover:bg-white/[0.07] transition-all group"
              >
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className="relative">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold ${
                        driver.status === 'rejected' || driver.status === 'suspended'
                          ? 'bg-red-500/20 text-red-400'
                          : driver.status === 'online'
                          ? 'bg-gradient-to-br from-cyan-600 to-emerald-500 text-white'
                          : driver.status === 'pending'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-white/10 text-gray-400'
                      }`}
                    >
                      {driver.avatar}
                    </div>
                    {driver.status === 'online' && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-[#0a0e1a]" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-white">{driver.name}</h3>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border ${cfg.color}`}
                      >
                        <DriverIcon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1 flex items-center gap-1.5">
                      {driver.vehicle} &bull; {driver.plate}
                      {driver.vehicleId && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                          driver.vehicleVerified
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                        }`}>
                          {driver.vehicleVerified ? 'Vehiculo verificado' : 'Vehiculo sin aprobar'}
                        </span>
                      )}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs">
                      <span className="flex items-center gap-1 text-amber-400">
                        <Star className="w-3 h-3 fill-amber-400" /> {driver.rating.toFixed(1)}
                      </span>
                      <span className="text-gray-500">{driver.totalRides} viajes</span>
                      <span className="text-emerald-400 font-medium">{driver.earnings}</span>
                    </div>

                    {/* Document summary badges */}
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      {driver.docCount > 0 ? (
                        <>
                          <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                            {summary.approved} aprobados
                          </span>
                          {summary.rejected > 0 && (
                            <span className="text-[10px] text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">
                              {summary.rejected} rechazados
                            </span>
                          )}
                          {summary.pending > 0 && (
                            <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                              {summary.pending} pendientes
                            </span>
                          )}
                          <span className="text-[10px] text-gray-500">
                            ({summary.total} documentos)
                          </span>
                        </>
                      ) : (
                        <span className="text-[10px] text-gray-500 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Sin documentos
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions Menu */}
                  <div className="relative flex-shrink-0">
                    <button
                      onClick={() => setOpenMenu(openMenu === driver.id ? null : driver.id)}
                      className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                    <AnimatePresence>
                      {openMenu === driver.id && (
                        <motion.div
                          initial={{ opacity: 0, y: -5, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -5, scale: 0.95 }}
                          className="absolute right-0 top-10 w-52 glass-strong rounded-xl py-1.5 z-20 shadow-xl"
                        >
                          <button
                            onClick={() => openDetail(driver)}
                            className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                          >
                            <Eye className="w-4 h-4 text-cyan-400" /> Ver detalles
                          </button>

                          <button
                            onClick={() => openReview(driver)}
                            className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                          >
                            <FileCheck className="w-4 h-4 text-blue-400" /> Documentos
                            <ChevronRight className="w-3 h-3 ml-auto" />
                          </button>

                          <div className="h-px bg-white/10 my-1" />

                          {(driver.status === 'pending' || driver.status === 'rejected') && (
                            <button
                              onClick={() => quickApprove(driver.id, driver.name)}
                              className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                            >
                              <ShieldCheck className="w-4 h-4" /> Aprobar rapido
                            </button>
                          )}

                          {driver.vehicleId && !driver.vehicleVerified && (
                            <button
                              onClick={() => approveVehicle(driver.id, driver.vehicleId!, driver.name, driver.plate)}
                              className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-blue-400 hover:bg-blue-500/10 transition-colors"
                            >
                              <FileCheck className="w-4 h-4" /> Aprobar vehiculo
                            </button>
                          )}

                          {driver.vehicleId && driver.vehicleVerified && (
                            <button
                              onClick={() => rejectVehicle(driver.id, driver.vehicleId!, driver.name, driver.plate)}
                              className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-amber-400 hover:bg-amber-500/10 transition-colors"
                            >
                              <ShieldX className="w-4 h-4" /> Desaprobar vehiculo
                            </button>
                          )}

                          {(driver.status === 'online' || driver.status === 'offline' || driver.status === 'busy' || driver.status === 'verified') && (
                            <button
                              onClick={() => toggleSuspend(driver.id, driver.name, driver.status)}
                              className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                            >
                              <ShieldX className="w-4 h-4" /> Suspender
                            </button>
                          )}

                          {driver.status === 'suspended' && (
                            <button
                              onClick={() => toggleSuspend(driver.id, driver.name, driver.status)}
                              className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                            >
                              <ShieldCheck className="w-4 h-4" /> Reactivar
                            </button>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {filteredDrivers.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          <Car className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No se encontraron conductores</p>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          DETAIL MODAL
          ═══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {selectedDriver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedDriver(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="glass-strong rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="sticky top-0 glass-strong rounded-t-2xl p-5 border-b border-white/10 flex items-center justify-between z-10">
                <h2 className="text-lg font-bold text-white">Detalle del Conductor</h2>
                <button
                  onClick={() => setSelectedDriver(null)}
                  className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-5">
                {detailLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
                  </div>
                ) : (
                  <>
                    {/* Driver Info */}
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold ${
                          selectedDriver.status === 'suspended' || selectedDriver.status === 'rejected'
                            ? 'bg-red-500/20 text-red-400'
                            : selectedDriver.status === 'online'
                            ? 'bg-gradient-to-br from-cyan-600 to-emerald-500 text-white'
                            : selectedDriver.status === 'pending'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-white/10 text-gray-400'
                        }`}
                      >
                        {selectedDriver.avatar}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white">{selectedDriver.name}</h3>
                        <p className="text-sm text-gray-400">{selectedDriver.phone}</p>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border mt-1 ${
                            (statusConfig[selectedDriver.status] || statusConfig.offline).color
                          }`}
                        >
                          {(statusConfig[selectedDriver.status] || statusConfig.offline).label}
                        </span>
                        {selectedDriver.vehicleId && (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border mt-1 ml-1 ${
                            selectedDriver.vehicleVerified
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
                              : 'bg-amber-500/15 text-amber-400 border-amber-500/20'
                          }`}>
                            {selectedDriver.vehicleVerified ? 'Vehiculo verificado' : 'Vehiculo sin aprobar'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Info Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div className="bg-white/5 rounded-xl p-3">
                        <p className="text-xs text-gray-500">Vehiculo</p>
                        <p className="text-sm text-white mt-0.5">{selectedDriver.vehicle}</p>
                      </div>
                      <div className="bg-white/5 rounded-xl p-3">
                        <p className="text-xs text-gray-500">Placa</p>
                        <p className="text-sm text-white mt-0.5">{selectedDriver.plate}</p>
                      </div>
                      {selectedDriver.vehicleId && (
                        <div className={`rounded-xl p-3 flex flex-col justify-between ${
                          selectedDriver.vehicleVerified
                            ? 'bg-emerald-500/10 border border-emerald-500/20'
                            : 'bg-amber-500/10 border border-amber-500/20'
                        }`}>
                          <p className="text-xs text-gray-500">Estado Vehiculo</p>
                          <div className="flex items-center justify-between mt-0.5">
                            <span className={`text-sm font-medium ${
                              selectedDriver.vehicleVerified ? 'text-emerald-400' : 'text-amber-400'
                            }`}>
                              {selectedDriver.vehicleVerified ? 'Verificado' : 'Sin aprobar'}
                            </span>
                            {selectedDriver.vehicleId && !selectedDriver.vehicleVerified && (
                              <button
                                onClick={() => approveVehicle(selectedDriver.id, selectedDriver.vehicleId!, selectedDriver.name, selectedDriver.plate)}
                                className="text-[10px] px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors font-medium"
                              >
                                Aprobar
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                      <div className="bg-white/5 rounded-xl p-3">
                        <p className="text-xs text-gray-500">Calificacion</p>
                        <p className="text-sm text-amber-400 mt-0.5 flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 fill-amber-400" /> {selectedDriver.rating.toFixed(1)}
                        </p>
                      </div>
                      <div className="bg-white/5 rounded-xl p-3">
                        <p className="text-xs text-gray-500">Total Viajes</p>
                        <p className="text-sm text-white mt-0.5">{selectedDriver.totalRides}</p>
                      </div>
                      <div className="bg-white/5 rounded-xl p-3">
                        <p className="text-xs text-gray-500">Ganancias</p>
                        <p className="text-sm text-emerald-400 mt-0.5">{formatCurrency(selectedDriver.totalEarnings)}</p>
                      </div>
                      <div className="bg-white/5 rounded-xl p-3">
                        <p className="text-xs text-gray-500">Registro</p>
                        <p className="text-sm text-white mt-0.5">
                          {selectedDriver.joined
                            ? new Date(selectedDriver.joined).toLocaleDateString('es-CR', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })
                            : 'N/A'}
                        </p>
                      </div>
                    </div>

                    {/* Earnings History */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-cyan-400" />
                        Historial de Ganancias ({earningsHistory.length})
                      </h4>
                      {earningsHistory.length > 0 ? (
                        <div className="max-h-48 overflow-y-auto space-y-2">
                          {earningsHistory.map((entry, i) => (
                            <div key={i} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
                              <span className="text-xs text-gray-400">
                                {new Date(entry.date).toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </span>
                              <span className="text-sm text-emerald-400 font-medium">+{formatCurrency(entry.amount)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="bg-white/5 rounded-xl p-4 text-center">
                          <p className="text-sm text-gray-500">Sin historial de ganancias</p>
                        </div>
                      )}
                    </div>

                    {/* Documents Section */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium text-gray-300">
                          Documentos ({driverDocs.length})
                        </h4>
                        <button
                          onClick={() => {
                            setSelectedDriver(null);
                            openReview(selectedDriver);
                          }}
                          className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                        >
                          <FileCheck className="w-3.5 h-3.5" /> Revision completa
                        </button>
                      </div>

                      {driverDocs.length === 0 ? (
                        <div className="bg-white/5 rounded-xl p-6 text-center">
                          <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                          <p className="text-sm text-gray-400">Este conductor no ha subido documentos</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {driverDocs.map((doc) => {
                            const typeInfo = DOCUMENT_TYPES.find((dt) => dt.type === doc.type);
                            const status = docStatusConfig[doc.status as DocStatus] || docStatusConfig.pending;
                            const StatusIcon = status.icon;
                            const imgUrl = signedUrls[doc.type];

                            return (
                              <div
                                key={doc.id}
                                className={`rounded-xl overflow-hidden border ${docStatusBg[doc.status as DocStatus] || docStatusBg.pending}`}
                              >
                                <div
                                  className="aspect-square bg-black/30 relative cursor-pointer"
                                  onClick={() => {
                                    if (imgUrl) {
                                      setViewerUrl(imgUrl);
                                      setViewerLabel(typeInfo?.label || doc.type);
                                    }
                                  }}
                                >
                                  {imgUrl ? (
                                    <img src={imgUrl} alt={typeInfo?.label} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <FileCheck className="w-8 h-8 text-gray-600" />
                                    </div>
                                  )}
                                  <div className="absolute bottom-1 right-1">
                                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium ${status.color}`}>
                                      <StatusIcon className="w-2.5 h-2.5" />
                                      {status.label}
                                    </span>
                                  </div>
                                </div>
                                <div className="px-2 py-1.5 bg-black/20">
                                  <p className="text-[10px] text-gray-300 truncate">{typeInfo?.label || doc.type}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════
          DOCUMENT REVIEW MODAL
          ═══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {reviewDriver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setReviewDriver(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="glass-strong rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 glass-strong rounded-t-2xl p-5 border-b border-white/10 flex items-center justify-between z-10">
                <div>
                  <h2 className="text-lg font-bold text-white">Revision de Documentos</h2>
                  <p className="text-sm text-gray-400 mt-0.5">{reviewDriver.name}</p>
                </div>
                <button
                  onClick={() => setReviewDriver(null)}
                  className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-5">
                {reviewLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
                  </div>
                ) : (
                  <>
                    {reviewDocs.length === 0 ? (
                      <div className="text-center py-12">
                        <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-400">No hay documentos para revisar</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {reviewDocs.map((doc) => {
                          const typeInfo = DOCUMENT_TYPES.find((dt) => dt.type === doc.type);
                          const action = reviewActions[doc.type];
                          const imgUrl = reviewUrls[doc.type];

                          return (
                            <div
                              key={doc.id}
                              className={`rounded-xl overflow-hidden border transition-colors ${
                                action === 'approve'
                                  ? 'border-emerald-500/50 ring-1 ring-emerald-500/20'
                                  : action === 'reject'
                                  ? 'border-red-500/50 ring-1 ring-red-500/20'
                                  : 'border-white/10'
                              }`}
                            >
                              {/* Image */}
                              <div
                                className="aspect-square bg-black/30 relative cursor-pointer"
                                onClick={() => {
                                  if (imgUrl) {
                                    setViewerUrl(imgUrl);
                                    setViewerLabel(typeInfo?.label || doc.type);
                                  }
                                }}
                              >
                                {imgUrl ? (
                                  <img src={imgUrl} alt={typeInfo?.label} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <FileCheck className="w-8 h-8 text-gray-600" />
                                  </div>
                                )}
                                {/* Current status badge */}
                                <div className="absolute top-1 left-1">
                                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-black/60 ${
                                    doc.status === 'pending' ? 'text-amber-400' : doc.status === 'approved' ? 'text-emerald-400' : 'text-red-400'
                                  }`}>
                                    {(docStatusConfig[doc.status as DocStatus] || docStatusConfig.pending).label}
                                  </span>
                                </div>
                              </div>

                              {/* Label + Actions */}
                              <div className="p-2.5 bg-black/20 space-y-2">
                                <p className="text-xs text-white font-medium truncate">{typeInfo?.label || doc.type}</p>
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => setAction(doc.type, 'approve')}
                                    className={`flex-1 py-1 rounded-lg text-[10px] font-medium flex items-center justify-center gap-1 transition-all ${
                                      action === 'approve'
                                        ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/50'
                                        : 'bg-white/5 text-gray-400 hover:text-emerald-400 border border-transparent'
                                    }`}
                                  >
                                    <CheckCircle2 className="w-3 h-3" /> Aprobar
                                  </button>
                                  <button
                                    onClick={() => setAction(doc.type, 'reject')}
                                    className={`flex-1 py-1 rounded-lg text-[10px] font-medium flex items-center justify-center gap-1 transition-all ${
                                      action === 'reject'
                                        ? 'bg-red-500/30 text-red-300 border border-red-500/50'
                                        : 'bg-white/5 text-gray-400 hover:text-red-400 border border-transparent'
                                    }`}
                                  >
                                    <XCircle className="w-3 h-3" /> Rechazar
                                  </button>
                                </div>

                                {/* Rejection reason input */}
                                {action === 'reject' && (
                                  <input
                                    type="text"
                                    placeholder="Motivo del rechazo..."
                                    value={reviewReasons[doc.type] || ''}
                                    onChange={(e) => setReviewReasons(prev => ({ ...prev, [doc.type]: e.target.value }))}
                                    className="w-full px-2 py-1 rounded-lg bg-white/5 border border-red-500/20 text-xs text-white placeholder:text-gray-600 outline-none focus:border-red-500/50"
                                  />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* General comment */}
                    <div>
                      <label className="text-xs text-gray-400 block mb-1.5">Comentario general (opcional)</label>
                      <textarea
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                        placeholder="Agregar un comentario para el conductor..."
                        rows={2}
                        className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-gray-600 outline-none focus:border-cyan-500/50 resize-none"
                      />
                    </div>

                    {/* Submit */}
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => setReviewDriver(null)}
                        className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-300 text-sm hover:bg-white/5 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={submitReview}
                        disabled={submittingReview || Object.keys(reviewActions).length === 0}
                        className="flex-1 py-2.5 rounded-xl btn-neon text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {submittingReview ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Guardando...
                          </>
                        ) : (
                          'Enviar Revision'
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════
          IMAGE VIEWER
          ═══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {viewerUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[60] flex flex-col items-center justify-center p-4"
            onClick={() => setViewerUrl(null)}
          >
            <div className="flex items-center justify-between w-full max-w-4xl mb-3">
              <span className="text-sm text-gray-400">{viewerLabel}</span>
              <button
                onClick={() => setViewerUrl(null)}
                className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <motion.img
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              src={viewerUrl}
              alt={viewerLabel}
              className="max-w-full max-h-[80vh] rounded-xl object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
