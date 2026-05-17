'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Flame, Loader2, ZoomIn, ZoomOut, Crosshair, Maximize2,
  Calendar, Clock, TrendingUp, Activity, MapPin, BarChart3,
  RefreshCw, Layers, ChevronRight, ArrowLeft
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { loadGoogleMaps } from '@/lib/googleMaps';

/* ─── Types ────────────────────────────────────────────────── */
interface HeatDataPoint {
  id: string;
  latitude: number;
  longitude: number;
  weight: number;
  location_type: 'pickup' | 'dropoff' | 'search';
  created_at: string;
}

const CR_CENTER = { lat: 9.9281, lng: -84.0907 };

const timePeriods = [
  { key: 'today', label: 'Hoy' },
  { key: 'week', label: 'Esta Semana' },
  { key: 'month', label: 'Este Mes' },
  { key: 'all', label: 'Todo' },
] as const;

type TimePeriod = (typeof timePeriods)[number]['key'];

/* ─── Loading Skeleton ──────────────────────────────────────── */
function LoadingSkeleton() {
  return (
    <div className="absolute inset-0 bg-rida-dark/80 z-10 animate-pulse">
      <div className="absolute inset-0 bg-white/5" />
      {/* Control panel skeleton */}
      <div className="absolute top-4 left-4 w-[240px]">
        <div className="glass-strong rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="h-3 w-16 bg-white/5 rounded" />
            <div className="w-6 h-6 rounded bg-white/5" />
          </div>
          <div className="h-3 w-20 bg-white/5 rounded" />
          <div className="flex gap-1">
            {[1, 2, 3, 4].map(i => <div key={i} className="flex-1 h-7 bg-white/5 rounded-lg" />)}
          </div>
          <div className="h-2 w-full bg-white/5 rounded-full" />
          <div className="h-2 w-full bg-white/5 rounded-full" />
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/5 rounded-lg p-2">
              <div className="h-2 w-16 bg-white/5 rounded" />
              <div className="h-5 w-10 bg-white/5 rounded mt-1" />
            </div>
            <div className="bg-white/5 rounded-lg p-2">
              <div className="h-2 w-16 bg-white/5 rounded" />
              <div className="h-5 w-10 bg-white/5 rounded mt-1" />
            </div>
          </div>
        </div>
      </div>
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

function getDateFilter(period: TimePeriod): string | null {
  if (period === 'today') {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  } else if (period === 'week') {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString();
  } else if (period === 'month') {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString();
  }
  return null;
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export default function HeatMapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const heatmapRef = useRef<google.maps.visualization.HeatmapLayer | null>(null);

  const [dataPoints, setDataPoints] = useState<HeatDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapLoading, setMapLoading] = useState(true);
  const [period, setPeriod] = useState<TimePeriod>('week');
  const [intensity, setIntensity] = useState(0.6);
  const [radius, setRadius] = useState(20);
  const [showPickups, setShowPickups] = useState(true);
  const [showDropoffs, setShowDropoffs] = useState(true);
  const [showSearches, setShowSearches] = useState(true);
  const [panelOpen, setPanelOpen] = useState(true);

  /* ─── Fetch Heat Data ─────────────────────────────────── */
  const fetchHeatData = useCallback(async (currentPeriod: TimePeriod) => {
    setLoading(true);
    try {
      const dateFilter = getDateFilter(currentPeriod);

      let query = supabase
        .from('heat_map_data')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5000);

      if (dateFilter) {
        query = query.gte('created_at', dateFilter);
      }

      const { data, error } = await query;

      if (error) {
        console.warn('heat_map_data query error:', error.message);
        // Fallback: try to use rides table for basic data
        const rideQuery = supabase
          .from('rides')
          .select('id, origin_lat, origin_lng, dest_lat, dest_lng, created_at, status')
          .eq('status', 'completed');

        if (dateFilter) {
          rideQuery.gte('created_at', dateFilter);
        }

        const { data: rideData, error: rideErr } = await rideQuery.limit(3000);
        if (!rideErr && rideData) {
          const points: HeatDataPoint[] = [];
          rideData.forEach(ride => {
            if (ride.origin_lat && ride.origin_lng) {
              points.push({
                id: ride.id + '-pickup',
                latitude: ride.origin_lat,
                longitude: ride.origin_lng,
                weight: 2,
                location_type: 'pickup',
                created_at: ride.created_at,
              });
            }
            if (ride.dest_lat && ride.dest_lng) {
              points.push({
                id: ride.id + '-dropoff',
                latitude: ride.dest_lat,
                longitude: ride.dest_lng,
                weight: 2,
                location_type: 'dropoff',
                created_at: ride.created_at,
              });
            }
          });
          setDataPoints(points);
        } else {
          setDataPoints([]);
        }
      } else {
        setDataPoints(data || []);
      }
    } catch (err) {
      console.error('Error fetching heat map data:', err);
      setDataPoints([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHeatData(period);
  }, [period, fetchHeatData]);

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
          zoom: 11,
          styles: darkMapStyle,
          disableDefaultUI: true,
          zoomControl: false,
          gestureHandling: 'greedy',
        });

        mapInstanceRef.current = map;

        // Create empty heatmap layer
        const heatmap = new google.maps.visualization.HeatmapLayer({
          data: [],
          map: map,
          options: {
            radius: 20,
            opacity: 0.6,
            gradient: [
              'rgba(0, 0, 0, 0)',
              'rgba(6, 182, 212, 0.3)',
              'rgba(6, 182, 212, 0.5)',
              'rgba(245, 158, 11, 0.6)',
              'rgba(239, 68, 68, 0.7)',
              'rgba(239, 68, 68, 0.9)',
            ],
          },
        });

        heatmapRef.current = heatmap;
        setMapLoading(false);
      })
      .catch((err) => {
        console.error('Map load error:', err);
        setMapLoading(false);
        toast.error('Error al cargar el mapa de calor');
      });

    return () => {
      if (heatmapRef.current) {
        heatmapRef.current.setMap(null);
        heatmapRef.current = null;
      }
      if (mapInstanceRef.current) mapInstanceRef.current = null;
    };
  }, []);

  /* ─── Update Heatmap Data ─────────────────────────────── */
  useEffect(() => {
    if (!heatmapRef.current || !mapInstanceRef.current || mapLoading) return;

    const google = window as any;
    if (!google.google?.maps) return;

    // Filter by type
    let filtered = dataPoints;
    if (!showPickups) filtered = filtered.filter(p => p.location_type !== 'pickup');
    if (!showDropoffs) filtered = filtered.filter(p => p.location_type !== 'dropoff');
    if (!showSearches) filtered = filtered.filter(p => p.location_type !== 'search');

    // Create weighted locations
    const heatmapData = filtered.map(point => ({
      location: new google.google.maps.LatLng(point.latitude, point.longitude),
      weight: point.weight,
    }));

    heatmapRef.current.setData(heatmapData);
    heatmapRef.current.setOptions({
      radius: radius,
      opacity: intensity,
    });

    // Fit bounds if we have data
    if (heatmapData.length > 0 && mapInstanceRef.current) {
      const bounds = new google.google.maps.LatLngBounds();
      heatmapData.forEach(d => bounds.extend(d.location));
      mapInstanceRef.current.fitBounds(bounds, { padding: 60 });
    }
  }, [dataPoints, mapLoading, intensity, radius, showPickups, showDropoffs, showSearches]);

  /* ─── Map Controls ────────────────────────────────────── */
  const zoomIn = () => { if (mapInstanceRef.current) mapInstanceRef.current.setZoom((mapInstanceRef.current.getZoom() || 10) + 1); };
  const zoomOut = () => { if (mapInstanceRef.current) mapInstanceRef.current.setZoom((mapInstanceRef.current.getZoom() || 10) - 1); };
  const resetView = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setCenter(CR_CENTER);
      mapInstanceRef.current.setZoom(11);
    }
  };

  // Stats
  const pickupCount = dataPoints.filter(p => p.location_type === 'pickup').length;
  const dropoffCount = dataPoints.filter(p => p.location_type === 'dropoff').length;
  const searchCount = dataPoints.filter(p => p.location_type === 'search').length;

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
        <span className="text-white font-medium">Mapa de Calor</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <Flame className="w-7 h-7 text-orange-400" />
            Heat Map
          </h1>
          <p className="text-gray-400 mt-1">Mapa de calor de demanda y actividad de viajes</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchHeatData(period)}
            className="px-3 py-2 rounded-lg bg-white/5 text-gray-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all text-xs font-medium flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refrescar
          </button>
        </div>
      </div>

      {/* Map Container */}
      <div className="flex-1 relative rounded-2xl overflow-hidden glass" style={{ minHeight: '400px' }}>
        <div ref={mapRef} className="absolute inset-0" />

        {mapLoading && <LoadingSkeleton />}

        {/* Control Panel */}
        <motion.div
          className="absolute top-4 left-4 z-10"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="glass-strong rounded-xl p-4 min-w-[240px] space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-white flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-orange-400" />
                Controles
              </h3>
              <button
                type="button"
                onClick={() => setPanelOpen(!panelOpen)}
                className="w-6 h-6 rounded bg-white/5 flex items-center justify-center text-gray-500 hover:text-white transition-colors text-[10px]"
              >
                {panelOpen ? '−' : '+'}
              </button>
            </div>

            {panelOpen && (
              <>
                {/* Time Period */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-500 font-medium flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Periodo
                  </label>
                  <div className="flex gap-1">
                    {timePeriods.map(tp => (
                      <button
                        key={tp.key}
                        type="button"
                        onClick={() => setPeriod(tp.key)}
                        className={`flex-1 text-[10px] py-1.5 rounded-lg transition-all ${
                          period === tp.key
                            ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                            : 'bg-white/5 text-gray-500 hover:text-white border border-transparent'
                        }`}
                      >
                        {tp.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Intensity */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] text-gray-500 font-medium">Intensidad</label>
                    <span className="text-[10px] text-orange-400 font-mono">{Math.round(intensity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.1"
                    value={intensity}
                    onChange={e => setIntensity(parseFloat(e.target.value))}
                    className="w-full h-1.5 rounded-full appearance-none bg-white/10 accent-orange-500"
                  />
                </div>

                {/* Radius */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] text-gray-500 font-medium">Radio</label>
                    <span className="text-[10px] text-cyan-400 font-mono">{radius}px</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="50"
                    step="5"
                    value={radius}
                    onChange={e => setRadius(parseInt(e.target.value))}
                    className="w-full h-1.5 rounded-full appearance-none bg-white/10 accent-cyan-500"
                  />
                </div>

                {/* Type Toggles */}
                <div className="space-y-1.5 pt-2 border-t border-white/10">
                  <label className="text-[10px] text-gray-500 font-medium flex items-center gap-1">
                    <Layers className="w-3 h-3" /> Capas
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPickups(!showPickups)}
                    className={`w-full flex items-center gap-2 text-[10px] px-2 py-1.5 rounded-lg transition-all ${
                      showPickups ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-gray-500'
                    }`}
                  >
                    <div className={`w-2.5 h-2.5 rounded-sm ${showPickups ? 'bg-emerald-400' : 'bg-gray-600'}`} />
                    Recogidas ({pickupCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDropoffs(!showDropoffs)}
                    className={`w-full flex items-center gap-2 text-[10px] px-2 py-1.5 rounded-lg transition-all ${
                      showDropoffs ? 'bg-red-500/10 text-red-400' : 'bg-white/5 text-gray-500'
                    }`}
                  >
                    <div className={`w-2.5 h-2.5 rounded-sm ${showDropoffs ? 'bg-red-400' : 'bg-gray-600'}`} />
                    Destinos ({dropoffCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSearches(!showSearches)}
                    className={`w-full flex items-center gap-2 text-[10px] px-2 py-1.5 rounded-lg transition-all ${
                      showSearches ? 'bg-blue-500/10 text-blue-400' : 'bg-white/5 text-gray-500'
                    }`}
                  >
                    <div className={`w-2.5 h-2.5 rounded-sm ${showSearches ? 'bg-blue-400' : 'bg-gray-600'}`} />
                    Busquedas ({searchCount})
                  </button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10">
                  <div className="bg-white/5 rounded-lg p-2">
                    <p className="text-[10px] text-gray-500">Total Puntos</p>
                    <p className="text-base font-bold text-white">{dataPoints.length}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-2">
                    <p className="text-[10px] text-gray-500">Peso Prom.</p>
                    <p className="text-base font-bold text-orange-400">
                      {dataPoints.length > 0
                        ? (dataPoints.reduce((sum, p) => sum + p.weight, 0) / dataPoints.length).toFixed(1)
                        : '0'}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </motion.div>

        {/* Legend */}
        <motion.div
          className="absolute bottom-4 left-4 z-10"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="glass-strong rounded-xl p-3">
            <p className="text-[10px] text-gray-400 font-medium mb-2">Intensidad de Demanda</p>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500">Baja</span>
              <div className="w-32 h-3 rounded-full" style={{
                background: 'linear-gradient(to right, rgba(6,182,212,0.3), rgba(6,182,212,0.5), rgba(245,158,11,0.6), rgba(239,68,68,0.7), rgba(239,68,68,0.9))'
              }} />
              <span className="text-[10px] text-gray-500">Alta</span>
            </div>
          </div>
        </motion.div>

        {/* Map Controls */}
        <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-1">
          <button type="button" onClick={zoomIn} className="w-9 h-9 rounded-lg glass-strong flex items-center justify-center text-gray-400 hover:text-white transition-colors">
            <ZoomIn className="w-4 h-4" />
          </button>
          <button type="button" onClick={zoomOut} className="w-9 h-9 rounded-lg glass-strong flex items-center justify-center text-gray-400 hover:text-white transition-colors">
            <ZoomOut className="w-4 h-4" />
          </button>
          <div className="h-px bg-white/10 my-1" />
          <button type="button" onClick={resetView} className="w-9 h-9 rounded-lg glass-strong flex items-center justify-center text-gray-400 hover:text-white transition-colors" title="Vista central">
            <Crosshair className="w-4 h-4" />
          </button>
        </div>

        {/* No Data */}
        {!loading && dataPoints.length === 0 && !mapLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-5 pointer-events-none">
            <div className="glass-strong rounded-2xl p-8 text-center pointer-events-auto max-w-sm">
              <Flame className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-400">Sin datos de demanda</p>
              <p className="text-xs text-gray-600 mt-1">
                Los datos del mapa de calor se generan a partir de las ubicaciones
                de recogidas, destinos y busquedas de los viajes completados.
                <br /><br />
                Asegurate de que la tabla <code className="text-cyan-400/60 bg-white/5 px-1 rounded">heat_map_data</code> tenga registros
                o que la tabla <code className="text-cyan-400/60 bg-white/5 px-1 rounded">rides</code> contenga campos de coordenadas.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
