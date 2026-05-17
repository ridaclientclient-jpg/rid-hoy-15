'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  Users, MapPin, Car, DollarSign, TrendingUp, Activity,
  AlertTriangle, CheckCircle2, Clock, Eye, Star,
  RefreshCw, ShieldAlert, Wallet, FileCheck, ZoomIn, ZoomOut, Crosshair
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { loadGoogleMaps } from '@/lib/googleMaps';
import { Skeleton } from '@/components/ui/skeleton';

// ─── Types ───────────────────────────────────────────────────────────────────

interface StatCard {
  label: string;
  value: string;
  change: string | null;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgGlow: string;
}

interface RecentRideRow {
  id: string;
  realId: string;
  passenger: string;
  driver: string;
  origin: string;
  destination: string;
  status: string;
  price: number;
}

interface ActivityItem {
  text: string;
  time: string;
  type: 'online' | 'success' | 'info' | 'alert' | 'warning';
  icon: React.ComponentType<{ className?: string }>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return `₡${Math.round(amount).toLocaleString('es-CR')}`;
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Ahora mismo';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Hace ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  return `Hace ${diffDays} d`;
}

// ─── Real Demand Map Component ──────────────────────────────────────────────

const CR_CENTER = { lat: 9.9281, lng: -84.0907 };

function DemandMap({ rides }: { rides: { origin_lat: number; origin_lng: number; dest_lat?: number; dest_lng?: number }[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const heatmapRef = useRef<google.maps.visualization.HeatmapLayer | null>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!mapRef.current) return;

    loadGoogleMaps().then((google) => {
      if (!mapRef.current) return;

      const map = new google.maps.Map(mapRef.current, {
        center: CR_CENTER,
        zoom: 11,
        disableDefaultUI: true,
        zoomControl: false,
        gestureHandling: 'greedy',
        styles: [
          { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
          { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
          { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
          { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#98a5be' }] },
          { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#26465e' }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
          { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4e6d70' }] },
          { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#283d6a' }] },
          { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2f3948' }] },
        ],
      });

      mapInstanceRef.current = map;

      const heatmap = new google.maps.visualization.HeatmapLayer({
        data: [],
        map: map,
        options: {
          radius: 25,
          opacity: 0.7,
          gradient: [
            'rgba(0, 0, 0, 0)',
            'rgba(16, 185, 129, 0.3)',
            'rgba(16, 185, 129, 0.5)',
            'rgba(245, 158, 11, 0.5)',
            'rgba(245, 158, 11, 0.7)',
            'rgba(239, 68, 68, 0.7)',
            'rgba(239, 68, 68, 0.9)',
          ],
        },
      });

      heatmapRef.current = heatmap;
      setMapReady(true);
    }).catch(() => setMapReady(false));

    return () => {
      if (heatmapRef.current) { heatmapRef.current.setMap(null); heatmapRef.current = null; }
      if (mapInstanceRef.current) mapInstanceRef.current = null;
    };
  }, []);

  // Update heatmap data when rides change
  useEffect(() => {
    if (!heatmapRef.current || !mapReady) return;

    const google = window as any;
    if (!google.google?.maps) return;

    const points: { location: google.maps.LatLng; weight: number }[] = [];

    rides.forEach(r => {
      if (r.origin_lat && r.origin_lng) {
        points.push({ location: new google.google.maps.LatLng(r.origin_lat, r.origin_lng), weight: 3 });
      }
      if (r.dest_lat && r.dest_lng) {
        points.push({ location: new google.google.maps.LatLng(r.dest_lat, r.dest_lng), weight: 2 });
      }
    });

    heatmapRef.current.setData(points);

    // Fit bounds if we have data
    if (points.length > 0 && mapInstanceRef.current) {
      const bounds = new google.google.maps.LatLngBounds();
      points.forEach(p => bounds.extend(p.location));
      mapInstanceRef.current.fitBounds(bounds, { padding: 40 });
    }
  }, [rides, mapReady]);

  const zoomIn = () => { if (mapInstanceRef.current) mapInstanceRef.current.setZoom((mapInstanceRef.current.getZoom() || 10) + 1); };
  const zoomOut = () => { if (mapInstanceRef.current) mapInstanceRef.current.setZoom((mapInstanceRef.current.getZoom() || 10) - 1); };
  const resetView = () => { if (mapInstanceRef.current) { mapInstanceRef.current.setCenter(CR_CENTER); mapInstanceRef.current.setZoom(11); } };

  return (
    <div className="relative rounded-xl overflow-hidden" style={{ height: '320px' }}>
      <div ref={mapRef} className="absolute inset-0" />
      {!mapReady && (
        <div className="absolute inset-0 bg-rida-dark/60 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
        </div>
      )}
      {/* Zoom controls */}
      <div className="absolute top-2 right-2 z-10 flex flex-col gap-0.5">
        <button type="button" onClick={zoomIn} className="w-7 h-7 rounded glass-strong flex items-center justify-center text-gray-400 hover:text-white transition-colors"><ZoomIn className="w-3.5 h-3.5" /></button>
        <button type="button" onClick={zoomOut} className="w-7 h-7 rounded glass-strong flex items-center justify-center text-gray-400 hover:text-white transition-colors"><ZoomOut className="w-3.5 h-3.5" /></button>
        <button type="button" onClick={resetView} className="w-7 h-7 rounded glass-strong flex items-center justify-center text-gray-400 hover:text-white transition-colors mt-0.5"><Crosshair className="w-3.5 h-3.5" /></button>
      </div>
      {/* Info overlay */}
      <div className="absolute bottom-2 left-2 z-10 glass-strong rounded-lg px-2.5 py-1.5">
        <div className="flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Recogidas</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Destinos</span>
          <span className="text-gray-500">{rides.length} puntos</span>
        </div>
      </div>
    </div>
  );
}

// ─── Status / Activity UI helpers ────────────────────────────────────────────

function getStatusBadge(status: string) {
  switch (status) {
    case 'completed':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          Completado
        </span>
      );
    case 'in_progress':
    case 'started':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          En curso
        </span>
      );
    case 'cancelled':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">
          <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
          Cancelado
        </span>
      );
    case 'searching':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          Buscando
        </span>
      );
    case 'assigned':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
          Asignado
        </span>
      );
    case 'arriving':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30">
          <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
          Llegando
        </span>
      );
    default:
      return <span className="text-xs text-gray-400">{status}</span>;
  }
}

function getActivityColor(type: string) {
  switch (type) {
    case 'online': return 'border-l-cyan-500 bg-cyan-500/5';
    case 'success': return 'border-l-emerald-500 bg-emerald-500/5';
    case 'info': return 'border-l-blue-500 bg-blue-500/5';
    case 'alert': return 'border-l-red-500 bg-red-500/5';
    case 'warning': return 'border-l-amber-500 bg-amber-500/5';
    default: return 'border-l-gray-500 bg-gray-500/5';
  }
}

function getActivityIconColor(type: string) {
  switch (type) {
    case 'online': return 'text-cyan-400';
    case 'success': return 'text-emerald-400';
    case 'info': return 'text-blue-400';
    case 'alert': return 'text-red-400';
    case 'warning': return 'text-amber-400';
    default: return 'text-gray-400';
  }
}

// ─── Loading Skeleton ────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-9 w-64 bg-white/10" />
        <Skeleton className="h-5 w-80 mt-2 bg-white/5" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="glass rounded-2xl p-5">
            <div className="flex items-start justify-between mb-3">
              <Skeleton className="w-11 h-11 rounded-xl bg-white/10" />
              <Skeleton className="w-16 h-5 rounded-full bg-white/5" />
            </div>
            <Skeleton className="h-8 w-24 mb-1 bg-white/10" />
            <Skeleton className="h-4 w-32 bg-white/5" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 glass rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
            <Skeleton className="h-6 w-36 bg-white/10" />
            <Skeleton className="h-4 w-16 bg-white/5" />
          </div>
          <div className="p-5 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full bg-white/5" />
            ))}
          </div>
        </div>
        <div className="glass rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5">
            <Skeleton className="h-6 w-36 bg-white/10" />
          </div>
          <div className="p-5 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full bg-white/5" />
            ))}
          </div>
        </div>
      </div>
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-6 w-36 bg-white/10" />
          <Skeleton className="h-4 w-48 bg-white/5" />
        </div>
        <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(10, 1fr)' }}>
          {Array.from({ length: 80 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-md bg-white/5" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

const REFRESH_INTERVAL = 30;

export default function AdminDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StatCard[]>([]);
  const [recentRides, setRecentRides] = useState<RecentRideRow[]>([]);
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);
  const [mapRides, setMapRides] = useState<{ origin_lat: number; origin_lng: number; dest_lat?: number; dest_lng?: number }[]>([]);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString();

      const [
        profilesRes,
        todayRidesRes,
        yesterdayRidesRes,
        onlineDriversRes,
        todayRevenueRes,
        yesterdayRevenueRes,
        todayCommissionRes,
        recentRidesRes,
        notificationsRes,
        allRidesRes,
        sosActiveRes,
        withdrawalQueueRes,
        pendingDocsRes,
      ] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('rides').select('id', { count: 'exact', head: true })
          .gte('created_at', todayStart)
          .neq('status', 'cancelled'),
        supabase.from('rides').select('id', { count: 'exact', head: true })
          .gte('created_at', yesterdayStart)
          .lt('created_at', todayStart)
          .neq('status', 'cancelled'),
        supabase.from('drivers').select('id', { count: 'exact', head: true })
          .eq('status', 'online'),
        supabase.from('rides').select('price')
          .gte('created_at', todayStart)
          .eq('status', 'completed'),
        supabase.from('rides').select('price')
          .gte('created_at', yesterdayStart)
          .lt('created_at', todayStart)
          .eq('status', 'completed'),
        supabase.from('rides').select('commission')
          .gte('created_at', todayStart)
          .eq('status', 'completed'),
        supabase.from('rides').select(`
          id, status, origin, destination, price, origin_lat, origin_lng, created_at, driver_id,
          profiles!rider_id(name, email)
        `)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase.from('notifications').select('id, title, message, type, created_at')
          .order('created_at', { ascending: false })
          .limit(15),
        supabase.from('rides').select('origin_lat, origin_lng')
          .not('origin_lat', 'is', null)
          .not('origin_lng', 'is', null)
          .order('created_at', { ascending: false })
          .limit(200),
        supabase.from('sos_events').select('id', { count: 'exact', head: true })
          .eq('status', 'active'),
        supabase.from('withdrawal_queue').select('id', { count: 'exact', head: true })
          .in('status', ['queued', 'processing']),
        supabase.from('documents').select('id', { count: 'exact', head: true })
          .eq('status', 'pending'),
      ]);

      // ── Process Stats ────────────────────────────────────────
      const totalUsers = profilesRes.count ?? 0;
      const ridesToday = todayRidesRes.count ?? 0;
      const ridesYesterday = yesterdayRidesRes.count ?? 0;
      const driversOnline = onlineDriversRes.count ?? 0;
      const revenueToday = (todayRevenueRes.data ?? []).reduce((sum, r) => sum + (r.price ?? 0), 0);
      const revenueYesterday = (yesterdayRevenueRes.data ?? []).reduce((sum, r) => sum + (r.price ?? 0), 0);
      const commissionToday = (todayCommissionRes.data ?? []).reduce((sum, r) => sum + (Number(r.commission) || 0), 0);
      const sosActive = sosActiveRes.count ?? 0;
      const withdrawalQueue = withdrawalQueueRes.count ?? 0;
      const pendingDocs = pendingDocsRes.count ?? 0;

      // Calculate real change percentages
      const ridesChange = ridesYesterday > 0
        ? `${(((ridesToday - ridesYesterday) / ridesYesterday) * 100).toFixed(0)}%`
        : null;
      const revenueChange = revenueYesterday > 0
        ? `${(((revenueToday - revenueYesterday) / revenueYesterday) * 100).toFixed(0)}%`
        : null;

      setStats([
        {
          label: 'Total Usuarios',
          value: totalUsers.toLocaleString(),
          change: null,
          icon: Users,
          color: 'from-blue-600 to-cyan-500',
          bgGlow: 'shadow-blue-500/20',
        },
        {
          label: 'Viajes Hoy',
          value: ridesToday.toLocaleString(),
          change: ridesChange ? (ridesChange.startsWith('-') ? ridesChange : `+${ridesChange}`) : null,
          icon: MapPin,
          color: 'from-cyan-500 to-emerald-500',
          bgGlow: 'shadow-emerald-500/20',
        },
        {
          label: 'Conductores Online',
          value: driversOnline.toLocaleString(),
          change: null,
          icon: Car,
          color: 'from-amber-500 to-orange-500',
          bgGlow: 'shadow-amber-500/20',
        },
        {
          label: 'Ingresos Hoy',
          value: formatCurrency(revenueToday),
          change: revenueChange ? (revenueChange.startsWith('-') ? revenueChange : `+${revenueChange}`) : null,
          icon: DollarSign,
          color: 'from-purple-600 to-blue-600',
          bgGlow: 'shadow-purple-500/20',
        },
        {
          label: 'Alertas SOS',
          value: sosActive.toLocaleString(),
          change: sosActive > 0 ? 'Activo' : null,
          icon: ShieldAlert,
          color: sosActive > 0 ? 'from-red-600 to-red-500' : 'from-gray-600 to-gray-500',
          bgGlow: 'shadow-red-500/20',
        },
        {
          label: 'Cola Retiros',
          value: withdrawalQueue.toLocaleString(),
          change: null,
          icon: Wallet,
          color: 'from-amber-600 to-amber-500',
          bgGlow: 'shadow-amber-500/20',
        },
        {
          label: 'Docs Pendientes',
          value: pendingDocs.toLocaleString(),
          change: null,
          icon: FileCheck,
          color: 'from-amber-500 to-orange-500',
          bgGlow: 'shadow-amber-500/20',
        },
        {
          label: 'Comision Hoy',
          value: formatCurrency(commissionToday),
          change: null,
          icon: TrendingUp,
          color: 'from-emerald-600 to-cyan-500',
          bgGlow: 'shadow-emerald-500/20',
        },
      ]);

      // ── Process Recent Rides (with driver names) ─────────────
      const rawRides = recentRidesRes.data ?? [];

      // Fetch driver names
      const driverIdsSet = new Set<string>();
      rawRides.forEach((r: any) => { if (r.driver_id) driverIdsSet.add(r.driver_id); });
      const driverIdsList = [...driverIdsSet];

      let driverNameMap: Record<string, string> = {};
      if (driverIdsList.length > 0) {
        const { data: driverRecords } = await supabase
          .from('drivers')
          .select('id, user_id')
          .in('id', driverIdsList);

        if (driverRecords && driverRecords.length > 0) {
          const driverUserIds = driverRecords.map(d => d.user_id).filter(Boolean);
          const driverIdToUserId: Record<string, string> = {};
          driverRecords.forEach(d => { driverIdToUserId[d.id] = d.user_id; });

          const { data: driverProfiles } = await supabase
            .from('profiles')
            .select('id, name')
            .in('id', driverUserIds);

          if (driverProfiles) {
            const userProfMap: Record<string, string> = {};
            driverProfiles.forEach(p => { userProfMap[p.id] = p.name; });
            Object.entries(driverIdToUserId).forEach(([dId, uId]) => {
              driverNameMap[dId] = userProfMap[uId] || 'Conductor';
            });
          }
        }
      }

      const rows: RecentRideRow[] = rawRides.map((ride: any) => ({
        id: `R-${ride.id.substring(0, 6).toUpperCase()}`,
        realId: ride.id,
        passenger: ride.profiles?.name ?? 'Usuario',
        driver: ride.driver_id ? (driverNameMap[ride.driver_id] || '—') : 'Sin asignar',
        origin: ride.origin || '—',
        destination: ride.destination || '—',
        status: ride.status ?? 'searching',
        price: ride.price ?? 0,
      }));
      setRecentRides(rows);

      // ── Process Activity Feed ────────────────────────────────
      const rawNotifs = notificationsRes.data ?? [];

      if (rawNotifs.length > 0) {
        const feed: ActivityItem[] = rawNotifs.map((n: any) => {
          let type: ActivityItem['type'] = 'info';
          let icon: React.ComponentType<{ className?: string }> = Activity;

          switch (n.type) {
            case 'sos':
              type = 'alert'; icon = AlertTriangle; break;
            case 'ride':
              type = 'success'; icon = CheckCircle2; break;
            case 'payment':
              type = 'info'; icon = DollarSign; break;
            case 'warning':
              type = 'warning'; icon = Clock; break;
            case 'system':
              type = 'info'; icon = Activity; break;
            default:
              type = 'info'; icon = Activity;
          }

          return {
            text: n.title || n.message || 'Actividad registrada',
            time: timeAgo(n.created_at),
            type,
            icon,
          };
        });
        setActivityFeed(feed);
      } else {
        const derivedFeed: ActivityItem[] = [];
        for (const ride of rawRides.slice(0, 8)) {
          const status = ride.status;
          if (status === 'completed') {
            derivedFeed.push({
              text: `Viaje R-${ride.id.substring(0, 6).toUpperCase()} completado — ${ride.profiles?.name ?? 'Pasajero'}`,
              time: timeAgo(ride.created_at),
              type: 'success',
              icon: CheckCircle2,
            });
          } else if (status === 'cancelled') {
            derivedFeed.push({
              text: `Viaje R-${ride.id.substring(0, 6).toUpperCase()} cancelado`,
              time: timeAgo(ride.created_at),
              type: 'warning',
              icon: Clock,
            });
          } else if (status === 'started') {
            derivedFeed.push({
              text: `Viaje en curso — ${ride.origin} → ${ride.destination}`,
              time: timeAgo(ride.created_at),
              type: 'info',
              icon: MapPin,
            });
          } else {
            derivedFeed.push({
              text: `Nuevo viaje creado — ${ride.profiles?.name ?? 'Pasajero'}`,
              time: timeAgo(ride.created_at),
              type: 'info',
              icon: Activity,
            });
          }
        }
        setActivityFeed(derivedFeed);
      }

      // ── Process Map Data (real ride coordinates) ────────────
      const heatmapRides = allRidesRes.data ?? [];
      setMapRides(heatmapRides.map((r: any) => ({
        origin_lat: r.origin_lat,
        origin_lng: r.origin_lng,
        dest_lat: r.dest_lat || null,
        dest_lng: r.dest_lng || null,
      })));

      setLoading(false);
    } catch (error) {
      console.error('Error cargando dashboard:', error);
      setStats([]);
      setRecentRides([]);
      setActivityFeed([]);
      setMapRides([]);
      setLoading(false);
    }
  }, []);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    fetchDashboardData();

    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) return REFRESH_INTERVAL;
        return prev - 1;
      });
    }, 1000);

    refreshRef.current = setInterval(() => {
      fetchDashboardData();
      setCountdown(REFRESH_INTERVAL);
    }, REFRESH_INTERVAL * 1000);

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (refreshRef.current) clearInterval(refreshRef.current);
    };
  }, [fetchDashboardData]);

  // ── Loading State ───────────────────────────────────────────
  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Panel de Administración</h1>
          <p className="text-gray-400 mt-1">Bienvenido de vuelta. Aquí tienes el resumen del sistema.</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Auto-refresh indicator */}
          <div className="flex items-center gap-2 glass rounded-lg px-3 py-2">
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${countdown <= 5 ? 'animate-spin' : ''}`} />
            <div className="flex flex-col items-start">
              <span className="text-[10px] text-gray-500 leading-none">Auto-refresh</span>
              <span className="text-xs text-cyan-400 font-mono font-medium leading-none mt-0.5">{countdown}s</span>
            </div>
            {/* Progress bar */}
            <div className="w-12 h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-500/60 rounded-full transition-all duration-1000 linear"
                style={{ width: `${((REFRESH_INTERVAL - countdown) / REFRESH_INTERVAL) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 lg:grid-cols-4 gap-4">
        {stats.length > 0 ? stats.map((stat, i) => (
          <motion.div
            key={i}
            className={`glass rounded-2xl p-5 hover:glow-cyan/30 transition-all duration-300 group ${stat.label === 'Alertas SOS' && stat.value !== '0' ? 'ring-1 ring-red-500/30' : ''}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            whileHover={{ y: -2 }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-lg ${stat.bgGlow}`}>
                <stat.icon className="w-5 h-5 text-white" />
              </div>
              {stat.change && (
                <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                  stat.change === 'Activo'
                    ? 'text-red-400 bg-red-500/10'
                    : stat.change.startsWith('-')
                    ? 'text-red-400 bg-red-500/10'
                    : 'text-emerald-400 bg-emerald-500/10'
                }`}>
                  {stat.change === 'Activo' ? (
                    <AlertTriangle className="w-3 h-3" />
                  ) : (
                    <TrendingUp className="w-3 h-3" />
                  )}
                  {stat.change}
                </span>
              )}
            </div>
            <p className="text-2xl font-bold text-white">{stat.value}</p>
            <p className="text-sm text-gray-400 mt-0.5">{stat.label}</p>
          </motion.div>
        )) : (
          <div className="xl:col-span-4 glass rounded-2xl p-8 text-center">
            <p className="text-gray-500">Sin datos disponibles</p>
          </div>
        )}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Recent Rides Table */}
        <motion.div
          className="xl:col-span-2 glass rounded-2xl overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-cyan-400" />
              Viajes Recientes
            </h2>
            <button
              onClick={() => router.push('/admin/rides')}
              className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              Ver todos
            </button>
          </div>
          <div className="overflow-x-auto">
            {recentRides.length > 0 ? (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">ID</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Pasajero</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider hidden lg:table-cell">Conductor</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider hidden md:table-cell">Origen</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Estado</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Precio</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRides.map((ride, i) => (
                    <motion.tr
                      key={ride.id}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + i * 0.05 }}
                      onClick={() => router.push('/admin/rides')}
                    >
                      <td className="px-5 py-3 text-sm text-cyan-400 font-mono">{ride.id}</td>
                      <td className="px-5 py-3">
                        <p className="text-sm text-white">{ride.passenger}</p>
                      </td>
                      <td className="px-5 py-3 hidden lg:table-cell">
                        <p className="text-sm text-gray-400">{ride.driver}</p>
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-300 hidden md:table-cell max-w-[200px] truncate">{ride.origin}</td>
                      <td className="px-5 py-3">{getStatusBadge(ride.status)}</td>
                      <td className="px-5 py-3 text-sm text-white text-right font-medium">{formatCurrency(ride.price)}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="px-5 py-12 text-center">
                <MapPin className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">Sin viajes recientes</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Activity Feed */}
        <motion.div
          className="glass rounded-2xl overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="px-5 py-4 border-b border-white/5">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-cyan-400" />
              Actividad en Vivo
            </h2>
          </div>
          <div className="max-h-[480px] overflow-y-auto">
            {activityFeed.length > 0 ? activityFeed.map((item, i) => (
              <motion.div
                key={i}
                className={`flex items-start gap-3 px-5 py-3 border-l-2 ${getActivityColor(item.type)}`}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.05 }}
              >
                <item.icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${getActivityIconColor(item.type)}`} />
                <div className="min-w-0">
                  <p className="text-sm text-gray-300">{item.text}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{item.time}</p>
                </div>
              </motion.div>
            )) : (
              <div className="px-5 py-12 text-center">
                <Activity className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">Sin actividad reciente</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Real Demand Map */}
      <motion.div
        className="glass rounded-2xl p-5"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Eye className="w-5 h-5 text-cyan-400" />
            Mapa de Demanda
          </h2>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-gray-500">{mapRides.filter(r => r.origin_lat && r.origin_lng).length} viajes con ubicacion</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-full bg-emerald-500/70" /> Baja</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-full bg-amber-500/70" /> Alta</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-full bg-red-500/70" /> Muy Alta</span>
          </div>
        </div>
        {mapRides.filter(r => r.origin_lat && r.origin_lng).length > 0 ? (
          <>
            <DemandMap rides={mapRides} />
            <p className="text-xs text-gray-500 mt-3 text-center">
              Mapa de calor basado en recogidas y destinos de viajes reales
            </p>
          </>
        ) : (
          <div className="rounded-xl bg-white/[0.02] border border-white/5 py-16 text-center">
            <MapPin className="w-10 h-10 text-gray-700 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">Sin datos de ubicacion de viajes</p>
            <p className="text-xs text-gray-600 mt-1">El mapa se llenara cuando se completen viajes con coordenadas GPS</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
