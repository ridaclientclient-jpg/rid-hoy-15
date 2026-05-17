'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  MapPin, Loader2, X, MapPinned, ZoomIn, ZoomOut,
  Maximize2, Layers, ChevronDown, Info, Crosshair, Filter,
  Car, Users, RefreshCw, Activity, ChevronRight, ArrowLeft
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { loadGoogleMaps } from '@/lib/googleMaps';

/* ─── Types ────────────────────────────────────────────────── */
interface LocationArea {
  id: string;
  name: string;
  area_type: 'restriction' | 'surge_zone' | 'hotspot' | 'service_area' | 'airport_zone';
  country: string;
  coordinates: string;
  is_active: boolean;
  notes: string;
  surge_multiplier: number;
  created_at: string;
}

interface DriverLoc {
  id: string;
  driver_id: string;
  latitude: number;
  longitude: number;
  heading: number;
  speed: number;
  is_online: boolean;
  updated_at: string;
  driver_name?: string;
  driver_status?: string;
}

interface ActiveTrip {
  id: string;
  rider_id: string;
  driver_id: string;
  status: string;
  origin: string;
  destination: string;
  origin_lat?: number;
  origin_lng?: number;
  dest_lat?: number;
  dest_lng?: number;
  price: number;
  created_at: string;
  rider_name?: string;
  driver_name?: string;
}

type AreaType = LocationArea['area_type'];

/* ─── Configs ──────────────────────────────────────────────── */
const areaTypeLabels: Record<string, string> = {
  restriction: 'Zona Restringida',
  surge_zone: 'Zona Surge',
  hotspot: 'Zona Popular',
  service_area: 'Area de Servicio',
  airport_zone: 'Zona Aeropuerto',
};

const areaTypeColors: Record<string, { fill: string; stroke: string; text: string; dot: string }> = {
  restriction: { fill: 'rgba(239, 68, 68, 0.15)', stroke: '#ef4444', text: 'text-red-400', dot: 'bg-red-400' },
  surge_zone: { fill: 'rgba(245, 158, 11, 0.15)', stroke: '#f59e0b', text: 'text-amber-400', dot: 'bg-amber-400' },
  hotspot: { fill: 'rgba(249, 115, 22, 0.15)', stroke: '#f97316', text: 'text-orange-400', dot: 'bg-orange-400' },
  service_area: { fill: 'rgba(16, 185, 129, 0.15)', stroke: '#10b981', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  airport_zone: { fill: 'rgba(6, 182, 212, 0.15)', stroke: '#06b6d4', text: 'text-cyan-400', dot: 'bg-cyan-400' },
};

const CR_CENTER = { lat: 9.9281, lng: -84.0907 };

/* ─── Loading Skeleton ──────────────────────────────────────── */
function LoadingSkeleton() {
  return (
    <div className="absolute inset-0 bg-rida-dark/80 z-10 animate-pulse">
      <div className="absolute inset-0 bg-white/5" />
      {/* Live stats skeleton */}
      <div className="absolute top-4 left-4 w-[180px]">
        <div className="glass-strong rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-white/5" />
            <div className="h-3 w-14 bg-white/5 rounded" />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div className="bg-white/5 rounded-lg p-2">
              <div className="h-2 w-16 bg-white/5 rounded" />
              <div className="h-4 w-8 bg-white/5 rounded mt-1" />
            </div>
            <div className="bg-white/5 rounded-lg p-2">
              <div className="h-2 w-12 bg-white/5 rounded" />
              <div className="h-4 w-8 bg-white/5 rounded mt-1" />
            </div>
          </div>
        </div>
      </div>
      {/* Center loading indicator */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-white/5 mx-auto mb-3" />
          <div className="h-4 w-32 bg-white/5 rounded mx-auto" />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export default function GeoMapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const polygonsRef = useRef<google.maps.Polygon[]>([]);
  const driverMarkersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const tripMarkersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  const [areas, setAreas] = useState<LocationArea[]>([]);
  const [drivers, setDrivers] = useState<DriverLoc[]>([]);
  const [activeTrips, setActiveTrips] = useState<ActiveTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapLoading, setMapLoading] = useState(true);
  const [selectedArea, setSelectedArea] = useState<LocationArea | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Filters
  const [typeFilters, setTypeFilters] = useState<Set<AreaType>>(
    new Set(['restriction', 'surge_zone', 'hotspot', 'service_area', 'airport_zone'])
  );
  const [showInactive, setShowInactive] = useState(false);
  const [showDrivers, setShowDrivers] = useState(true);
  const [showTrips, setShowTrips] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const autoRefreshRef = useRef<NodeJS.Timeout | null>(null);

  /* ─── Fetch Areas + Drivers + Trips ─────────────────────── */
  const fetchData = useCallback(async () => {
    try {
      // 1. Areas
      const { data: areaData, error: areaErr } = await supabase
        .from('location_areas').select('*').order('created_at', { ascending: false });
      if (!areaErr) setAreas(areaData || []);
      else console.warn('location_areas error:', areaErr.message);

      // 2. Driver locations
      const { data: locs, error: locErr } = await supabase
        .from('driver_locations').select('*').eq('is_online', true).order('updated_at', { ascending: false }).limit(200);

      if (!locErr && locs && locs.length > 0) {
        const dIds = locs.map(l => l.driver_id);
        const driverMap: Record<string, { name: string; status: string }> = {};
        const { data: dRecs } = await supabase.from('drivers').select('id, user_id, status').in('id', dIds);
        if (dRecs) {
          const uIds = dRecs.map(d => d.user_id).filter(Boolean);
          const pMap: Record<string, string> = {};
          if (uIds.length > 0) {
            const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', uIds);
            if (profiles) profiles.forEach(p => { pMap[p.id] = p.name; });
          }
          const dUMap: Record<string, string> = {};
          dRecs.forEach(d => { dUMap[d.id] = d.user_id; });
          dRecs.forEach(d => { driverMap[d.id] = { name: pMap[dUMap[d.id] || ''] || 'Conductor', status: d.status || 'online' }; });
        }
        setDrivers((locs || []).map(l => ({
          ...l,
          driver_name: driverMap[l.driver_id]?.name || 'Conductor',
          driver_status: driverMap[l.driver_id]?.status || 'online',
        })));
      } else if (locErr) {
        // Fallback to drivers table
        const { data: drvData } = await supabase.from('drivers').select('id, user_id, status, current_latitude, current_longitude')
          .in('status', ['online', 'busy']);
        if (drvData) {
          const uIds = drvData.map(d => d.user_id).filter(Boolean);
          const pMap: Record<string, string> = {};
          if (uIds.length > 0) {
            const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', uIds);
            if (profiles) profiles.forEach(p => { pMap[p.id] = p.name; });
          }
          setDrivers(drvData.filter(d => d.current_latitude && d.current_longitude).map(d => ({
            id: d.id,
            driver_id: d.id,
            latitude: d.current_latitude,
            longitude: d.current_longitude,
            heading: 0, speed: 0, is_online: true,
            updated_at: new Date().toISOString(),
            driver_name: pMap[d.user_id || ''] || 'Conductor',
            driver_status: d.status,
          })));
        }
      }

      // 3. Active trips
      const { data: trips, error: tripErr } = await supabase
        .from('rides').select('*')
        .in('status', ['pending', 'searching', 'assigned', 'arriving', 'started', 'in_progress'])
        .order('created_at', { ascending: false }).limit(50);

      if (!tripErr && trips) {
        const rIds = [...new Set(trips.map(t => t.rider_id).filter(Boolean))];
        const dIds2 = [...new Set(trips.map(t => t.driver_id).filter(Boolean))];
        const rMap: Record<string, string> = {};
        const dMap: Record<string, string> = {};
        if (rIds.length > 0) {
          const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', rIds);
          if (profiles) profiles.forEach(p => { rMap[p.id] = p.name; });
        }
        if (dIds2.length > 0) {
          const { data: dRecs } = await supabase.from('drivers').select('id, user_id').in('id', dIds2);
          if (dRecs) {
            const dUIds = dRecs.map(d => d.user_id).filter(Boolean);
            if (dUIds.length > 0) {
              const { data: dProfiles } = await supabase.from('profiles').select('id, name').in('id', dUIds);
              if (dProfiles) {
                const dpMap: Record<string, string> = {};
                dProfiles.forEach(p => { dpMap[p.id] = p.name; });
                dRecs.forEach(d => { dMap[d.id] = dpMap[d.user_id || ''] || 'Conductor'; });
              }
            }
          }
        }
        setActiveTrips(trips.map(t => ({
          id: t.id, rider_id: t.rider_id, driver_id: t.driver_id, status: t.status,
          origin: t.origin || t.origin_address || '-', destination: t.destination || t.dest_address || '-',
          origin_lat: t.origin_lat || null, origin_lng: t.origin_lng || null,
          dest_lat: t.dest_lat || null, dest_lng: t.dest_lng || null,
          price: t.price || 0, created_at: t.created_at,
          rider_name: rMap[t.rider_id] || 'Pasajero', driver_name: dMap[t.driver_id || ''] || 'Sin asignar',
        })));
      }

      setLastRefresh(new Date());
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ─── Auto Refresh ────────────────────────────────────── */
  useEffect(() => {
    if (autoRefresh) {
      autoRefreshRef.current = setInterval(fetchData, 20000);
    }
    return () => { if (autoRefreshRef.current) clearInterval(autoRefreshRef.current); };
  }, [autoRefresh, fetchData]);

  /* ─── Initialize Map ──────────────────────────────────── */
  useEffect(() => {
    if (!mapRef.current) return;

    loadGoogleMaps().then((google) => {
      if (!mapRef.current) return;

      const darkMapStyle: google.maps.MapTypeStyle[] = [
        { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
        { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#98a5be' }] },
        { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#26465e' }] },
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
        { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4e6d70' }] },
        { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#283d6a' }] },
        { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#6f9ba5' }] },
        { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2f3948' }] },
        { featureType: 'transit', elementType: 'labels.text.fill', stylers: [{ color: '#8a9bb5' }] },
      ];

      const map = new google.maps.Map(mapRef.current, {
        center: CR_CENTER, zoom: 11, styles: darkMapStyle,
        disableDefaultUI: true, zoomControl: false,
        mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
        gestureHandling: 'greedy',
      });

      mapInstanceRef.current = map;
      infoWindowRef.current = new google.maps.InfoWindow();
      setMapLoading(false);
    }).catch(() => {
      setMapLoading(false);
      toast.error('Error al cargar el mapa');
    });

    return () => {
      polygonsRef.current.forEach(p => p.setMap(null));
      polygonsRef.current = [];
      driverMarkersRef.current.forEach(m => m.setMap(null));
      driverMarkersRef.current.clear();
      tripMarkersRef.current.forEach(m => m.setMap(null));
      tripMarkersRef.current.clear();
      if (infoWindowRef.current) infoWindowRef.current.close();
      if (mapInstanceRef.current) mapInstanceRef.current = null;
    };
  }, []);

  /* ─── Draw Polygons ───────────────────────────────────── */
  useEffect(() => {
    if (!mapInstanceRef.current || mapLoading) return;

    polygonsRef.current.forEach(p => p.setMap(null));
    polygonsRef.current = [];

    const filtered = areas.filter(a => {
      if (!showInactive && !a.is_active) return false;
      if (!typeFilters.has(a.area_type)) return false;
      return true;
    });

    const google = window as any;
    if (!google.google?.maps) return;

    filtered.forEach(area => {
      try {
        const coords: [number, number][] = JSON.parse(area.coordinates);
        if (coords.length < 3) return;

        const path = coords.map(([lat, lng]) => new google.google.maps.LatLng(lat, lng));
        const colors = areaTypeColors[area.area_type] || areaTypeColors.service_area;

        const polygon = new google.google.maps.Polygon({
          paths: path,
          fillColor: colors.stroke, fillOpacity: 0.2,
          strokeColor: colors.stroke, strokeOpacity: 0.8, strokeWeight: 2,
          clickable: true, map: mapInstanceRef.current,
        });

        polygon.addListener('click', (e: any) => {
          if (infoWindowRef.current && mapInstanceRef.current) {
            infoWindowRef.current.setContent(`
              <div style="padding:8px;color:#1a1a1a;font-family:system-ui;min-width:180px;">
                <strong style="font-size:14px;">${area.name}</strong><br/>
                <span style="font-size:12px;color:#666;">${areaTypeLabels[area.area_type]}</span><br/>
                <span style="font-size:11px;color:#999;">${area.country || 'Costa Rica'} - ${area.is_active ? 'Activa' : 'Inactiva'}</span><br/>
                <span style="font-size:11px;color:#f59e0b;font-weight:600;">Surge: x${area.surge_multiplier || 1.00}</span>
                ${area.notes ? `<br/><span style="font-size:11px;color:#888;">${area.notes}</span>` : ''}
              </div>
            `);
            infoWindowRef.current.setPosition(e.latLng);
            infoWindowRef.current.open(mapInstanceRef.current);
          }
          setSelectedArea(area);
        });

        polygonsRef.current.push(polygon);
      } catch {}
    });
  }, [areas, mapLoading, typeFilters, showInactive]);

  /* ─── Render Driver Markers ───────────────────────────── */
  useEffect(() => {
    if (!mapInstanceRef.current || mapLoading) return;
    const google = window as any;
    if (!google.google?.maps) return;

    driverMarkersRef.current.forEach(m => m.setMap(null));
    driverMarkersRef.current.clear();
    if (!showDrivers) return;

    drivers.forEach(driver => {
      if (!driver.latitude || !driver.longitude) return;
      const isBusy = driver.driver_status === 'busy';
      const color = isBusy ? '#f59e0b' : '#06b6d4';

      const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
        <path d="M14 2C7.37 2 2 7.37 2 14c0 9 12 20 12 20s12-11 12-20C26 7.37 20.63 2 14 2z" fill="${color}" opacity="0.9"/>
        <text x="14" y="17" text-anchor="middle" font-size="10" font-weight="bold" fill="#fff" font-family="system-ui">C</text>
      </svg>`;

      const marker = new google.google.maps.Marker({
        map: mapInstanceRef.current,
        position: { lat: driver.latitude, lng: driver.longitude },
        title: driver.driver_name || 'Conductor',
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svgIcon),
          scaledSize: new google.google.maps.Size(28, 36),
          anchor: new google.google.maps.Point(14, 36),
        },
        zIndex: isBusy ? 80 : 90,
      });

      marker.addListener('click', () => {
        if (infoWindowRef.current && mapInstanceRef.current) {
          infoWindowRef.current.setContent(`
            <div style="padding:6px;color:#1a1a1a;font-family:system-ui;">
              <strong style="font-size:12px;">${driver.driver_name}</strong><br/>
              <span style="font-size:11px;color:#666;">${isBusy ? 'Ocupado' : 'Disponible'}</span>
            </div>
          `);
          infoWindowRef.current.open(mapInstanceRef.current, marker);
        }
      });

      driverMarkersRef.current.set(driver.id, marker);
    });
  }, [drivers, mapLoading, showDrivers]);

  /* ─── Render Trip Lines ───────────────────────────────── */
  useEffect(() => {
    if (!mapInstanceRef.current || mapLoading) return;
    const google = window as any;
    if (!google.google?.maps) return;

    tripMarkersRef.current.forEach(m => m.setMap(null));
    tripMarkersRef.current.clear();
    if (!showTrips) return;

    activeTrips.forEach(trip => {
      const hasOrig = trip.origin_lat != null && trip.origin_lng != null;
      const hasDest = trip.dest_lat != null && trip.dest_lng != null;
      if (hasOrig && hasDest) {
        const line = new google.google.maps.Polyline({
          path: [{ lat: trip.origin_lat!, lng: trip.origin_lng! }, { lat: trip.dest_lat!, lng: trip.dest_lng! }],
          geodesic: true, strokeColor: '#3b82f6', strokeOpacity: 0.5, strokeWeight: 2,
          map: mapInstanceRef.current,
        });
        tripMarkersRef.current.set(`line-${trip.id}`, line as any);
      }
    });
  }, [activeTrips, mapLoading, showTrips]);

  /* ─── Toggle Type Filter ──────────────────────────────── */
  const toggleTypeFilter = (type: AreaType) => {
    setTypeFilters(prev => { const next = new Set(prev); if (next.has(type)) next.delete(type); else next.add(type); return next; });
  };

  /* ─── Map Controls ────────────────────────────────────── */
  const zoomIn = () => { if (mapInstanceRef.current) mapInstanceRef.current.setZoom((mapInstanceRef.current.getZoom() || 10) + 1); };
  const zoomOut = () => { if (mapInstanceRef.current) mapInstanceRef.current.setZoom((mapInstanceRef.current.getZoom() || 10) - 1); };
  const resetView = () => { if (mapInstanceRef.current) { mapInstanceRef.current.setCenter(CR_CENTER); mapInstanceRef.current.setZoom(11); } };
  const fitAllAreas = () => {
    if (!mapInstanceRef.current) return;
    const bounds = new google.maps.LatLngBounds();
    let hasPts = false;
    polygonsRef.current.forEach(p => p.getPath().forEach(ll => { bounds.extend(ll); hasPts = true; }));
    driverMarkersRef.current.forEach(m => { const pos = m.getPosition(); if (pos) { bounds.extend(pos); hasPts = true; } });
    if (hasPts) mapInstanceRef.current.fitBounds(bounds, { padding: 50 });
  };

  /* ─── Render ──────────────────────────────────────────── */
  return (
    <div className="space-y-4 h-[calc(100vh-140px)] flex flex-col">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
        <Link href="/admin" className="hover:text-white transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          Panel
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-white font-medium">Mapa Geográfico</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-white">Mapa de Zonas</h1>
          <p className="text-gray-400 mt-1">Zonas geograficas + conductores en vivo + viajes activos</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{drivers.length} conductores | {activeTrips.length} viajes | {lastRefresh.toLocaleTimeString('es-CR')}</span>
          <button type="button" onClick={fetchData}
            className="px-3 py-2 rounded-lg bg-white/5 text-gray-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all text-xs font-medium flex items-center gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refrescar
          </button>
          <button type="button" onClick={() => setSidebarOpen(!sidebarOpen)}
            className="px-3 py-2 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-all text-xs font-medium flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" /> {sidebarOpen ? 'Ocultar' : 'Panel'}
          </button>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative rounded-2xl overflow-hidden glass" style={{ minHeight: '400px' }}>
        <div ref={mapRef} className="absolute inset-0" />

        {mapLoading && <LoadingSkeleton />}

        {/* Zoom Controls */}
        <div className="absolute top-4 right-4 z-10 flex flex-col gap-1">
          <button type="button" onClick={zoomIn} className="w-9 h-9 rounded-lg glass-strong flex items-center justify-center text-gray-400 hover:text-white transition-colors"><ZoomIn className="w-4 h-4" /></button>
          <button type="button" onClick={zoomOut} className="w-9 h-9 rounded-lg glass-strong flex items-center justify-center text-gray-400 hover:text-white transition-colors"><ZoomOut className="w-4 h-4" /></button>
          <div className="h-px bg-white/10 my-1" />
          <button type="button" onClick={fitAllAreas} className="w-9 h-9 rounded-lg glass-strong flex items-center justify-center text-gray-400 hover:text-white transition-colors" title="Ajustar"><Maximize2 className="w-4 h-4" /></button>
          <button type="button" onClick={resetView} className="w-9 h-9 rounded-lg glass-strong flex items-center justify-center text-gray-400 hover:text-white transition-colors" title="Vista inicial"><Crosshair className="w-4 h-4" /></button>
        </div>

        {/* Live Stats Badge */}
        <div className="absolute top-4 left-4 z-10">
          <div className="glass-strong rounded-xl p-3 space-y-2 min-w-[180px]">
            <div className="flex items-center gap-1.5">
              <Activity className="w-3 h-3 text-emerald-400" />
              <span className="text-[10px] text-emerald-400 font-medium">EN VIVO</span>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-auto" />
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="bg-white/5 rounded-lg p-2">
                <p className="text-[10px] text-gray-500">Conductores</p>
                <p className="text-sm font-bold text-cyan-400">{drivers.length}</p>
              </div>
              <div className="bg-white/5 rounded-lg p-2">
                <p className="text-[10px] text-gray-500">Viajes</p>
                <p className="text-sm font-bold text-emerald-400">{activeTrips.length}</p>
              </div>
            </div>
            {/* Layer toggles */}
            <div className="space-y-1 pt-1 border-t border-white/10">
              <button type="button" onClick={() => setShowDrivers(!showDrivers)}
                className={`w-full flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-lg transition-all ${showDrivers ? 'bg-cyan-500/10 text-cyan-400' : 'bg-white/5 text-gray-500'}`}>
                <Car className="w-3 h-3" /> Conductores
              </button>
              <button type="button" onClick={() => setShowTrips(!showTrips)}
                className={`w-full flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-lg transition-all ${showTrips ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-gray-500'}`}>
                <MapPin className="w-3 h-3" /> Viajes Activos
              </button>
              <button type="button" onClick={() => setAutoRefresh(!autoRefresh)}
                className={`w-full flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-lg transition-all ${autoRefresh ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-gray-500'}`}>
                <RefreshCw className="w-3 h-3" /> Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="absolute bottom-4 left-4 z-10">
          <div className="glass-strong rounded-xl p-3 space-y-1.5">
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mb-1">Zonas</p>
            {Object.entries(areaTypeLabels).map(([type, label]) => {
              const c = areaTypeColors[type];
              return (
                <button key={type} type="button" onClick={() => toggleTypeFilter(type as AreaType)}
                  className={`flex items-center gap-2 text-[11px] transition-opacity ${typeFilters.has(type) ? 'opacity-100' : 'opacity-30'}`}>
                  <span className="w-3 h-3 rounded-sm border-2" style={{ backgroundColor: c.stroke + '33', borderColor: c.stroke }} />
                  <span className={c.text}>{label}</span>
                </button>
              );
            })}
            <div className="border-t border-white/10 pt-1 mt-1">
              <div className="flex items-center gap-2 text-[10px] text-gray-500">
                <div className="w-2.5 h-2.5 rounded-full bg-cyan-500" /> Conductor disponible
              </div>
              <div className="flex items-center gap-2 text-[10px] text-gray-500">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Conductor ocupado
              </div>
              <div className="flex items-center gap-2 text-[10px] text-gray-500">
                <div className="w-4 h-0.5 bg-blue-500 rounded" /> Ruta de viaje
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div className="absolute top-4 left-1/2 -translate-x-1/2 bottom-4 w-72 z-10 glass-strong rounded-xl overflow-hidden flex flex-col"
              initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}>
              <div className="p-3 border-b border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-white flex items-center gap-2">
                    <MapPinned className="w-4 h-4 text-cyan-400" /> Zonas ({areas.length})
                  </h3>
                  <button type="button" onClick={() => setSidebarOpen(false)}
                    className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <button type="button" onClick={() => setShowInactive(!showInactive)}
                  className={`text-[10px] px-2.5 py-1 rounded-lg transition-all ${showInactive ? 'bg-white/10 text-white' : 'bg-white/5 text-gray-500'}`}>
                  {showInactive ? 'Mostrando inactivas' : 'Solo activas'}
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                {loading ? (
                  <div className="space-y-1.5 p-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="animate-pulse p-2.5 rounded-xl bg-white/5">
                        <div className="flex items-start gap-2">
                          <div className="w-7 h-7 rounded-lg bg-white/5" />
                          <div className="flex-1 space-y-1.5">
                            <div className="h-3 w-24 bg-white/5 rounded" />
                            <div className="h-2 w-32 bg-white/5 rounded" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : areas.filter(a => typeFilters.has(a.area_type) && (showInactive || a.is_active)).length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" /><p className="text-xs">No hay zonas</p>
                  </div>
                ) : (
                  areas.filter(a => typeFilters.has(a.area_type) && (showInactive || a.is_active)).map(area => {
                    const c = areaTypeColors[area.area_type] || areaTypeColors.service_area;
                    const ptCount = (() => { try { return JSON.parse(area.coordinates).length; } catch { return 0; } })();
                    return (
                      <button key={area.id} type="button" onClick={() => {
                        setSelectedArea(area);
                        try {
                          const coords: [number, number][] = JSON.parse(area.coordinates);
                          if (coords.length > 0 && mapInstanceRef.current) {
                            const bounds = new google.maps.LatLngBounds();
                            coords.forEach(([lat, lng]) => bounds.extend(new google.maps.LatLng(lat, lng)));
                            mapInstanceRef.current.fitBounds(bounds, { padding: 80 });
                          }
                        } catch {}
                      }}
                        className={`w-full text-left p-2.5 rounded-xl transition-all ${selectedArea?.id === area.id ? 'bg-white/10 border border-cyan-500/30' : 'bg-white/5 hover:bg-white/[0.07] border border-transparent'}`}>
                        <div className="flex items-start gap-2">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: c.stroke + '20' }}>
                            <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: c.stroke }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-medium text-white truncate">{area.name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={`text-[10px] ${c.text}`}>{areaTypeLabels[area.area_type]}</span>
                              <span className="text-[10px] text-gray-600">x{area.surge_multiplier || 1.00}</span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-gray-600">
                              <span>{ptCount} pts</span>
                              {!area.is_active && <span>(inactiva)</span>}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
              <div className="p-2.5 border-t border-white/10 flex items-center justify-between text-[10px] text-gray-600">
                <span>{areas.filter(a => a.is_active).length} activas</span>
                <span className="flex items-center gap-1"><Info className="w-3 h-3" /> Clic en zona = detalles</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
