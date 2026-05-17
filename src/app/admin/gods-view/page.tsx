'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Eye, Car, MapPin, Users, Navigation, Loader2,
  RefreshCw, ZoomIn, ZoomOut, Crosshair, Maximize2,
  Activity, Clock, TrendingUp, Search, User, Star,
  Monitor, Wifi, ChevronRight, ArrowLeft,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { loadGoogleMaps } from '@/lib/googleMaps';
import { Skeleton } from '@/components/ui/skeleton';

/* ─── Types ────────────────────────────────────────────────── */

interface OnlineDriver {
  id: string;
  user_id?: string;
  status: string;
  current_latitude?: number;
  current_longitude?: number;
  rating?: number;
  total_rides?: number;
  updated_at?: string;
  driver_name?: string;
  driver_phone?: string;
  vehicle_plate?: string;
  vehicle_model?: string;
  vehicle_color?: string;
  active_ride_id?: string;
  active_ride_status?: string;
  active_ride_origin?: string;
  active_ride_destination?: string;
  type: 'driver' | 'courier';
  vehicle_type?: string;
}

/* ─── Loading Skeleton ──────────────────────────────────────── */
function LoadingSkeleton() {
  return (
    <div className="absolute inset-0 bg-rida-dark/80 z-10 animate-pulse">
      <div className="absolute inset-0 bg-white/5" />
      {/* Center loading indicator */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-white/5 mx-auto mb-3" />
          <div className="h-4 w-40 bg-white/5 rounded mx-auto" />
        </div>
      </div>
    </div>
  );
}

const CR_CENTER = { lat: 9.9281, lng: -84.0907 };

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export default function GodsViewPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const driverMarkersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  const [drivers, setDrivers] = useState<OnlineDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapLoading, setMapLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [search, setSearch] = useState('');
  const [showDriversOnMap, setShowDriversOnMap] = useState(true);
  const [selectedDriver, setSelectedDriver] = useState<OnlineDriver | null>(null);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');

  /* ─── Fetch Data ──────────────────────────────────────── */
  const fetchData = useCallback(async () => {
    try {
      // 1. Fetch online drivers and couriers
      const [driversRes, couriersRes] = await Promise.all([
        supabase
          .from('drivers')
          .select('id, user_id, status, current_latitude, current_longitude, rating, total_rides, updated_at')
          .in('status', ['online', 'busy'])
          .order('updated_at', { ascending: false }),
        supabase
          .from('couriers')
          .select('id, user_id, status, current_lat, current_lng, rating, total_deliveries, vehicle_type, vehicle_model, vehicle_color, vehicle_plate, last_online_at')
          .in('status', ['online', 'delivering', 'busy'])
      ]);

      const onlineDrivers = driversRes.data || [];
      const onlineCouriers = couriersRes.data || [];

      if (onlineDrivers.length === 0 && onlineCouriers.length === 0) {
        setDrivers([]);
        setLastRefresh(new Date());
        return;
      }

      // 2. Enrich with profile names and vehicle info
      const allUsers = [
        ...onlineDrivers.map(d => d.user_id),
        ...onlineCouriers.map(c => c.user_id)
      ].filter(Boolean) as string[];

      const driverIds = onlineDrivers.map(d => d.id);
      const courierIds = onlineCouriers.map(c => c.id);

      const profileMap: Record<string, { name: string; phone?: string }> = {};
      const vehicleMap: Record<string, { plate: string; model: string; color: string }> = {};

      // Fetch profiles
      if (allUsers.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, phone')
          .in('id', allUsers);
        if (profiles) {
          profiles.forEach(p => { profileMap[p.id] = { name: p.name, phone: p.phone }; });
        }
      }

      // Fetch vehicles (drivers)
      if (driverIds.length > 0) {
        const { data: vehicles } = await supabase
          .from('vehicles')
          .select('id, driver_id, plate, model, color')
          .in('driver_id', driverIds);
        if (vehicles) {
          vehicles.forEach(v => { vehicleMap[v.driver_id] = { plate: v.plate, model: v.model, color: v.color }; });
        }
      }

      // 3. Fetch active rides for these drivers
      const activeRideMap: Record<string, { id: string; status: string; origin?: string; destination?: string }> = {};
      if (driverIds.length > 0) {
        const { data: activeRides } = await supabase
          .from('rides')
          .select('id, driver_id, status, origin, destination')
          .in('driver_id', driverIds)
          .in('status', ['assigned', 'arriving', 'started', 'in_progress']);

        if (activeRides) {
          activeRides.forEach(r => {
            activeRideMap[r.driver_id] = {
              id: r.id,
              status: r.status,
              origin: r.origin,
              destination: r.destination,
            };
          });
        }
      }
      
      // Fetch active deliveries for these couriers
      const activeDeliveryMap: Record<string, { id: string; status: string; origin?: string; destination?: string }> = {};
      if (courierIds.length > 0) {
        const { data: activeDeliveries } = await supabase
          .from('deliveries')
          .select('id, courier_id, status, pickup_address, delivery_address')
          .in('courier_id', courierIds)
          .in('status', ['assigned', 'picked_up', 'in_transit']);

        if (activeDeliveries) {
          activeDeliveries.forEach(d => {
            if (d.courier_id) {
              activeDeliveryMap[d.courier_id] = {
                id: d.id,
                status: d.status,
                origin: d.pickup_address,
                destination: d.delivery_address,
              };
            }
          });
        }
      }

      // Build enriched driver list
      const enrichedDrivers: OnlineDriver[] = onlineDrivers
        .filter(d => d.current_latitude && d.current_longitude)
        .map(d => {
          const profile = profileMap[d.user_id || ''];
          const vehicle = vehicleMap[d.id];
          const activeRide = activeRideMap[d.id];

          return {
            id: d.id,
            user_id: d.user_id,
            status: d.status,
            current_latitude: d.current_latitude,
            current_longitude: d.current_longitude,
            rating: d.rating,
            total_rides: d.total_rides,
            updated_at: d.updated_at,
            driver_name: profile?.name || 'Conductor',
            driver_phone: profile?.phone || '',
            vehicle_plate: vehicle?.plate || '',
            vehicle_model: vehicle?.model || '',
            vehicle_color: vehicle?.color || '',
            active_ride_id: activeRide?.id,
            active_ride_status: activeRide?.status,
            active_ride_origin: activeRide?.origin,
            active_ride_destination: activeRide?.destination,
            type: 'driver' as const,
          };
        });
        
      const enrichedCouriers: OnlineDriver[] = onlineCouriers
        .filter(c => c.current_lat && c.current_lng)
        .map(c => {
          const profile = profileMap[c.user_id || ''];
          const activeDelivery = activeDeliveryMap[c.id];

          return {
            id: c.id,
            user_id: c.user_id,
            status: c.status === 'delivering' ? 'busy' : c.status,
            current_latitude: c.current_lat,
            current_longitude: c.current_lng,
            rating: c.rating,
            total_rides: c.total_deliveries,
            updated_at: c.last_online_at || new Date().toISOString(),
            driver_name: profile?.name || 'Repartidor',
            driver_phone: profile?.phone || '',
            vehicle_plate: c.vehicle_plate || '',
            vehicle_model: c.vehicle_model || '',
            vehicle_color: c.vehicle_color || '',
            active_ride_id: activeDelivery?.id,
            active_ride_status: activeDelivery?.status,
            active_ride_origin: activeDelivery?.origin,
            active_ride_destination: activeDelivery?.destination,
            type: 'courier' as const,
            vehicle_type: c.vehicle_type,
          };
        });

      setDrivers([...enrichedDrivers, ...enrichedCouriers]);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Error fetching God View data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ─── Auto Refresh every 15 seconds ───────────────────── */
  useEffect(() => {
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  /* ─── Initialize Map ──────────────────────────────────── */
  useEffect(() => {
    if (!mapRef.current) return;

    loadGoogleMaps()
      .then((google) => {
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
          center: CR_CENTER,
          zoom: 12,
          styles: darkMapStyle,
          disableDefaultUI: true,
          zoomControl: false,
          gestureHandling: 'greedy',
        });

        infoWindowRef.current = new google.maps.InfoWindow();
        mapInstanceRef.current = map;
        setMapLoading(false);
      })
      .catch(() => { setMapLoading(false); });

    return () => {
      driverMarkersRef.current.forEach(m => m.setMap(null));
      driverMarkersRef.current.clear();
      if (infoWindowRef.current) infoWindowRef.current.close();
      if (mapInstanceRef.current) mapInstanceRef.current = null;
    };
  }, []);

  /* ─── Render Driver Markers ───────────────────────────── */
  useEffect(() => {
    if (!mapInstanceRef.current || mapLoading) return;

    const g = window as any;
    if (!g.google?.maps) return;

    driverMarkersRef.current.forEach(m => m.setMap(null));
    driverMarkersRef.current.clear();
    if (!showDriversOnMap) return;

    drivers.forEach(driver => {
      if (!driver.current_latitude || !driver.current_longitude) return;

      const isBusy = driver.status === 'busy' || !!driver.active_ride_id;
      const color = isBusy ? '#f59e0b' : '#06b6d4';

      const svgIcon = driver.type === 'courier' ? `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
        <defs>
          <filter id="ds${driver.id.slice(0,6)}" x="-30%" y="-20%" width="160%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.4"/>
          </filter>
        </defs>
        <path d="M16 2C8.268 2 2 8.268 2 16c0 10 14 22 14 22s14-12 14-22C30 8.268 23.732 2 16 2z" fill="${color}" filter="url(#ds${driver.id.slice(0,6)})"/>
        <circle cx="16" cy="15" r="8" fill="rgba(255,255,255,0.2)"/>
        <text x="16" y="19" text-anchor="middle" font-size="10" font-weight="bold" fill="#fff" font-family="system-ui">D</text>
      </svg>` : `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
        <defs>
          <filter id="ds${driver.id.slice(0,6)}" x="-30%" y="-20%" width="160%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.4"/>
          </filter>
        </defs>
        <path d="M16 2C8.268 2 2 8.268 2 16c0 10 14 22 14 22s14-12 14-22C30 8.268 23.732 2 16 2z" fill="${color}" filter="url(#ds${driver.id.slice(0,6)})"/>
        <circle cx="16" cy="15" r="8" fill="rgba(255,255,255,0.2)"/>
        <text x="16" y="19" text-anchor="middle" font-size="10" font-weight="bold" fill="#fff" font-family="system-ui">C</text>
      </svg>`;

      const marker = new g.google.maps.Marker({
        map: mapInstanceRef.current,
        position: { lat: driver.current_latitude, lng: driver.current_longitude },
        title: driver.driver_name || 'Conductor',
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svgIcon),
          scaledSize: new g.google.maps.Size(32, 40),
          anchor: new g.google.maps.Point(16, 40),
        },
        zIndex: isBusy ? 100 : 200,
      });

      marker.addListener('click', () => {
        if (infoWindowRef.current && mapInstanceRef.current) {
          const rideInfo = driver.active_ride_id
            ? `<div style="margin-top:6px; padding-top:6px; border-top:1px solid #ddd;">
                <strong style="font-size:11px; color:#10b981;">${driver.type === 'courier' ? 'Entrega activa' : 'Viaje activo'}</strong><br/>
                <span style="font-size:10px; color:#666;">${driver.active_ride_status || ''}</span><br/>
                ${driver.active_ride_origin ? `<span style="font-size:10px;">De: ${driver.active_ride_origin}</span><br/>` : ''}
                ${driver.active_ride_destination ? `<span style="font-size:10px;">A: ${driver.active_ride_destination}</span>` : ''}
              </div>`
            : '';

          const vehicleInfo = driver.vehicle_plate
            ? `<div style="margin-top:4px; font-size:10px; color:#888;">
                ${driver.type === 'courier' ? '📦' : '🚗'} ${driver.vehicle_color} ${driver.vehicle_model || driver.vehicle_type || ''} (${driver.vehicle_plate})
              </div>`
            : '';

          infoWindowRef.current.setContent(`
            <div style="padding:8px; color:#1a1a1a; font-family:system-ui; min-width:200px;">
              <strong style="font-size:13px;">${driver.driver_name}</strong>
              ${driver.rating ? `<span style="font-size:11px; color:#f59e0b;"> ★ ${driver.rating.toFixed(1)}</span>` : ''}
              <br/>
              <span style="font-size:11px; color:#666;">
                ${isBusy ? '🟡 En viaje' : '🟢 Disponible'}
              </span>
              ${vehicleInfo}
              ${rideInfo}
            </div>
          `);
          infoWindowRef.current.open(mapInstanceRef.current, marker);
          setSelectedDriver(driver);
        }
      });

      driverMarkersRef.current.set(driver.id, marker);
    });

    // Fit bounds
    if (drivers.length > 0 && mapInstanceRef.current) {
      const bounds = new g.google.maps.LatLngBounds();
      drivers.forEach(d => {
        if (d.current_latitude && d.current_longitude) {
          bounds.extend(new g.google.maps.LatLng(d.current_latitude, d.current_longitude));
        }
      });
      if (!bounds.isEmpty()) {
        mapInstanceRef.current.fitBounds(bounds, { padding: 60 });
      }
    }
  }, [drivers, mapLoading, showDriversOnMap]);

  /* ─── Map Controls ────────────────────────────────────── */
  const zoomIn = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.setZoom((mapInstanceRef.current.getZoom() || 10) + 1);
  };
  const zoomOut = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.setZoom((mapInstanceRef.current.getZoom() || 10) - 1);
  };
  const fitAll = () => {
    const g = window as any;
    if (!mapInstanceRef.current || !g.google?.maps) return;
    const bounds = new g.google.maps.LatLngBounds();
    driverMarkersRef.current.forEach(m => { const pos = m.getPosition(); if (pos) bounds.extend(pos); });
    if (!bounds.isEmpty()) mapInstanceRef.current.fitBounds(bounds, { padding: 60 });
  };
  const resetView = () => {
    if (mapInstanceRef.current) { mapInstanceRef.current.setCenter(CR_CENTER); mapInstanceRef.current.setZoom(12); }
  };

  /* ─── Stats ───────────────────────────────────────────── */
  const onlineCount = drivers.length;
  const busyCount = drivers.filter(d => d.status === 'busy' || !!d.active_ride_id).length;
  const availableCount = onlineCount - busyCount;
  const avgRating = drivers.length > 0
    ? (drivers.reduce((s, d) => s + (d.rating || 0), 0) / drivers.filter(d => d.rating).length).toFixed(1)
    : '0.0';

  /* ─── Filtered drivers (for list view + search) ───────── */
  const filteredDrivers = search.trim()
    ? drivers.filter(d =>
        d.driver_name?.toLowerCase().includes(search.toLowerCase()) ||
        d.vehicle_plate?.toLowerCase().includes(search.toLowerCase())
      )
    : drivers;

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
        <span className="text-white font-medium">Vista Dios</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <Eye className="w-7 h-7 text-cyan-400" />
            God&apos;s View
          </h1>
          <p className="text-gray-400 mt-1">Vista en tiempo real de conductores en linea</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex gap-1 p-1 rounded-xl bg-white/5">
            <button
              type="button"
              onClick={() => setViewMode('map')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                viewMode === 'map' ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400 hover:text-white'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              Mapa
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                viewMode === 'list' ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              Lista
            </button>
          </div>

          <button
            type="button"
            onClick={fetchData}
            className="px-3 py-2 rounded-lg bg-white/5 text-gray-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all text-xs font-medium flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refrescar
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Map / List Area */}
        <div className="flex-1 relative rounded-2xl overflow-hidden glass min-w-0">
          {/* Map View */}
          {viewMode === 'map' && (
            <>
              <div ref={mapRef} className="absolute inset-0" />

              {mapLoading && <LoadingSkeleton />}

              {/* Map Controls */}
              {viewMode === 'map' && !mapLoading && (
                <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-1">
                  <button type="button" onClick={zoomIn} className="w-9 h-9 rounded-lg glass-strong flex items-center justify-center text-gray-400 hover:text-white transition-colors">
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={zoomOut} className="w-9 h-9 rounded-lg glass-strong flex items-center justify-center text-gray-400 hover:text-white transition-colors">
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <div className="h-px bg-white/10 my-1" />
                  <button type="button" onClick={fitAll} className="w-9 h-9 rounded-lg glass-strong flex items-center justify-center text-gray-400 hover:text-white transition-colors" title="Ajustar a conductores">
                    <Maximize2 className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={resetView} className="w-9 h-9 rounded-lg glass-strong flex items-center justify-center text-gray-400 hover:text-white transition-colors" title="Vista central">
                    <Crosshair className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* No Data on Map */}
              {!loading && drivers.length === 0 && !mapLoading && (
                <div className="absolute inset-0 flex items-center justify-center z-5 pointer-events-none">
                  <div className="glass-strong rounded-2xl p-8 text-center pointer-events-auto">
                    <Eye className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-sm text-gray-400">Sin conductores en linea</p>
                    <p className="text-xs text-gray-600 mt-1">Los datos aparecen cuando los conductores se conectan.</p>
                  </div>
                </div>
              )}
            </>
          )}

          {/* List View */}
          {viewMode === 'list' && (
            <div className="absolute inset-0 overflow-hidden flex flex-col">
              {/* Search */}
              <div className="p-3 border-b border-white/5 flex-shrink-0">
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
              </div>

              {/* Driver Table */}
              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="p-4 space-y-3">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
                        <Skeleton className="w-10 h-10 rounded-full bg-white/10" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-32 bg-white/10" />
                          <Skeleton className="h-3 w-48 bg-white/5" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredDrivers.length > 0 ? (
                  <div className="divide-y divide-white/5">
                    {filteredDrivers.map((driver, i) => {
                      const isBusy = driver.status === 'busy' || !!driver.active_ride_id;
                      return (
                        <motion.div
                          key={driver.id}
                          className="px-4 py-3 hover:bg-white/[0.03] transition-colors"
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.02 }}
                        >
                          <div className="flex items-start gap-3">
                            <div className="relative flex-shrink-0">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                isBusy ? 'bg-amber-500/20 ring-2 ring-amber-500/50' : 'bg-cyan-500/20 ring-2 ring-cyan-500/50'
                              }`}>
                                {driver.type === 'courier' ? (
                                  <span className={`text-lg ${isBusy ? 'text-amber-400' : 'text-cyan-400'}`}>📦</span>
                                ) : (
                                  <Car className={`w-4 h-4 ${isBusy ? 'text-amber-400' : 'text-cyan-400'}`} />
                                )}
                              </div>
                              {isBusy && (
                                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-amber-400 border-2 border-[#0a0e1a]" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-white">{driver.driver_name}</span>
                                {driver.rating && (
                                  <span className="flex items-center gap-0.5 text-xs text-amber-400">
                                    <Star className="w-3 h-3 fill-amber-400" />
                                    {driver.rating.toFixed(1)}
                                  </span>
                                )}
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                  isBusy ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'
                                }`}>
                                  {isBusy ? 'En viaje' : 'Disponible'}
                                </span>
                              </div>
                              {driver.vehicle_plate && (
                                <p className="text-xs text-gray-500 mt-0.5">
                                  {driver.type === 'courier' ? '📦 ' : '🚗 '}
                                  {driver.vehicle_color} {driver.vehicle_model || driver.vehicle_type || ''} ({driver.vehicle_plate})
                                </p>
                              )}
                              {driver.active_ride_id && (
                                <div className="mt-1.5 bg-white/[0.03] rounded-lg px-2.5 py-1.5 text-xs space-y-0.5">
                                  <div className="flex items-center gap-1.5">
                                    <Navigation className="w-3 h-3 text-cyan-400" />
                                    <span className="font-mono text-cyan-400">{driver.active_ride_id.slice(0, 8).toUpperCase()}</span>
                                    <span className="text-gray-500">— {driver.active_ride_status}</span>
                                  </div>
                                  {driver.active_ride_origin && (
                                    <p className="text-gray-500">
                                      <span className="text-emerald-400">De:</span> {driver.active_ride_origin}
                                    </p>
                                  )}
                                  {driver.active_ride_destination && (
                                    <p className="text-gray-500">
                                      <span className="text-red-400">A:</span> {driver.active_ride_destination}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="flex-shrink-0 text-right">
                              <a
                                href={`https://www.google.com/maps?q=${driver.current_latitude},${driver.current_longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 text-cyan-400 text-[10px] hover:bg-cyan-500/10 transition-colors"
                              >
                                <MapPin className="w-3 h-3" />
                                GPS
                              </a>
                              <p className="text-[10px] text-gray-600 mt-1 font-mono">
                                {driver.current_latitude?.toFixed(4)}, {driver.current_longitude?.toFixed(4)}
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                    <Search className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">{search ? 'No se encontraron conductores' : 'Sin conductores en linea'}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar - Stats Panel */}
        <div className="hidden xl:block w-[300px] flex-shrink-0 space-y-4">
          {/* Live Stats */}
          <motion.div
            className="glass rounded-2xl p-4"
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                En Vivo
              </h3>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] text-emerald-400">LIVE</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white/5 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Wifi className="w-3 h-3 text-cyan-400" />
                  <p className="text-[10px] text-gray-500">En Linea</p>
                </div>
                <p className="text-xl font-bold text-cyan-400">{onlineCount}</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Navigation className="w-3 h-3 text-amber-400" />
                  <p className="text-[10px] text-gray-500">En Viaje</p>
                </div>
                <p className="text-xl font-bold text-amber-400">{busyCount}</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <User className="w-3 h-3 text-emerald-400" />
                  <p className="text-[10px] text-gray-500">Disponibles</p>
                </div>
                <p className="text-xl font-bold text-emerald-400">{availableCount}</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Star className="w-3 h-3 text-amber-400" />
                  <p className="text-[10px] text-gray-500">Rating Prom.</p>
                </div>
                <p className="text-xl font-bold text-amber-400">{avgRating}</p>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-white/10 text-center">
              <div className="flex items-center justify-center gap-1.5 text-[10px] text-gray-600">
                <Clock className="w-3 h-3" />
                Actualizado: {lastRefresh.toLocaleTimeString('es-CR')}
                <span className="text-gray-700">(cada 15s)</span>
              </div>
            </div>
          </motion.div>

          {/* Selected Driver Detail */}
          {selectedDriver && viewMode === 'map' && (
            <motion.div
              className="glass rounded-2xl p-4"
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h3 className="text-xs font-semibold text-white mb-3 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-purple-400" />
                Conductor Seleccionado
              </h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    selectedDriver.status === 'busy' ? 'bg-amber-500/20' : 'bg-cyan-500/20'
                  }`}>
                    {selectedDriver.type === 'courier' ? (
                      <span className={`text-sm ${selectedDriver.status === 'busy' ? 'text-amber-400' : 'text-cyan-400'}`}>📦</span>
                    ) : (
                      <Car className={`w-4 h-4 ${selectedDriver.status === 'busy' ? 'text-amber-400' : 'text-cyan-400'}`} />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{selectedDriver.driver_name}</p>
                    {selectedDriver.rating && (
                      <p className="text-xs text-amber-400">★ {selectedDriver.rating.toFixed(1)} · {selectedDriver.total_rides || 0} viajes</p>
                    )}
                  </div>
                </div>
                {selectedDriver.driver_phone && (
                  <a
                    href={`tel:${selectedDriver.driver_phone}`}
                    className="flex items-center gap-1.5 text-xs text-cyan-400 hover:underline"
                  >
                    📞 {selectedDriver.driver_phone}
                  </a>
                )}
                {selectedDriver.vehicle_plate && (
                  <p className="text-xs text-gray-400">
                    {selectedDriver.type === 'courier' ? '📦' : '🚗'} {selectedDriver.vehicle_color} {selectedDriver.vehicle_model || selectedDriver.vehicle_type || ''} ({selectedDriver.vehicle_plate})
                  </p>
                )}
                <div className="bg-white/5 rounded-lg p-2 text-xs text-gray-500 font-mono">
                  {selectedDriver.current_latitude?.toFixed(6)}, {selectedDriver.current_longitude?.toFixed(6)}
                </div>
                <a
                  href={`https://www.google.com/maps?q=${selectedDriver.current_latitude},${selectedDriver.current_longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-medium hover:bg-cyan-500/20 transition-all"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  Ver en Google Maps
                </a>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
