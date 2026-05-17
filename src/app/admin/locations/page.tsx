'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  MapPin, Search, Plus, Edit2, Trash2, Loader2, X,
  ChevronDown, Filter, ToggleLeft, ToggleRight, MapPinned, Crosshair,
  Eye, Save, Map, List, ChevronRight, ArrowLeft
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
  updated_at: string;
}

type AreaTypeFilter = 'todos' | 'restriction' | 'surge_zone' | 'hotspot' | 'service_area' | 'airport_zone';
type StatusFilter = 'todos' | 'activas' | 'inactivas';

const areaTypeLabels: Record<string, string> = {
  restriction: 'Zona Restringida',
  surge_zone: 'Zona Surge',
  hotspot: 'Zona Popular',
  service_area: 'Area de Servicio',
  airport_zone: 'Zona Aeropuerto',
};

const areaTypeColors: Record<string, { bg: string; text: string; dot: string; fill: string; stroke: string }> = {
  restriction: { bg: 'bg-red-500/15', text: 'text-red-400', dot: 'bg-red-400', fill: 'rgba(239,68,68,0.15)', stroke: '#ef4444' },
  surge_zone: { bg: 'bg-amber-500/15', text: 'text-amber-400', dot: 'bg-amber-400', fill: 'rgba(245,158,11,0.15)', stroke: '#f59e0b' },
  hotspot: { bg: 'bg-orange-500/15', text: 'text-orange-400', dot: 'bg-orange-400', fill: 'rgba(249,115,22,0.15)', stroke: '#f97316' },
  service_area: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', dot: 'bg-emerald-400', fill: 'rgba(16,185,129,0.15)', stroke: '#10b981' },
  airport_zone: { bg: 'bg-cyan-500/15', text: 'text-cyan-400', dot: 'bg-cyan-400', fill: 'rgba(6,182,212,0.15)', stroke: '#06b6d4' },
};

interface CoordPair { lat: string; lng: string; }

function parseCoords(jsonStr: string): CoordPair[] {
  try {
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed)) {
      return parsed.map((c: any) => ({
        lat: String(c[0] ?? ''),
        lng: String(c[1] ?? ''),
      }));
    }
  } catch { /* ignore */ }
  return [];
}

function stringifyCoords(pairs: CoordPair[]): string {
  return JSON.stringify(pairs.map(p => [Number(p.lat) || 0, Number(p.lng) || 0]));
}

const emptyArea = (): Omit<LocationArea, 'id' | 'created_at' | 'updated_at'> => ({
  name: '',
  area_type: 'service_area',
  country: 'Costa Rica',
  coordinates: '[]',
  is_active: true,
  notes: '',
  surge_multiplier: 1.00,
});

const CR_CENTER = { lat: 9.9281, lng: -84.0907 };

/* ═══════════════════════════════════════════════════════════════
   MAP EDITOR SUB-COMPONENT
   ═══════════════════════════════════════════════════════════════ */
function MapEditor({
  existingCoords,
  onCoordsChange,
  areaType,
}: {
  existingCoords: CoordPair[];
  onCoordsChange: (c: CoordPair[]) => void;
  areaType: string;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const polygonRef = useRef<google.maps.Polygon | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const drawingMode = useRef(true);
  const tempPolylineRef = useRef<google.maps.Polyline | null>(null);

  // Ref to always have latest coords in click/drag listeners (stale closure fix)
  const coordsRef = useRef(existingCoords);
  // Ref for onCoordsChange so the initial useEffect always calls the latest version
  const onCoordsChangeRef = useRef(onCoordsChange);
  // Ref for colors so drawPolygon always uses current area type colors
  const colorsRef = useRef(areaTypeColors[areaType] || areaTypeColors.service_area);

  useEffect(() => {
    coordsRef.current = existingCoords;
    onCoordsChangeRef.current = onCoordsChange;
    colorsRef.current = areaTypeColors[areaType] || areaTypeColors.service_area;
  }, [existingCoords, onCoordsChange, areaType]);

  const colors = areaTypeColors[areaType] || areaTypeColors.service_area;

  useEffect(() => {
    if (!mapRef.current) return;

    loadGoogleMaps().then((google) => {
      if (!mapRef.current) return;

      const map = new google.maps.Map(mapRef.current, {
        center: existingCoords.length > 0
          ? { lat: Number(existingCoords[0].lat), lng: Number(existingCoords[0].lng) }
          : CR_CENTER,
        zoom: existingCoords.length > 0 ? 14 : 12,
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: 'greedy',
        styles: [
          { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
          { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
          { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
          { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#98a5be' }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
          { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#283d6a' }] },
        ],
      });

      mapInstanceRef.current = map;

      // Click on map to add point — use refs to avoid stale closures
      map.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (!drawingMode.current || !mapInstanceRef.current) return;
        const lat = e.latLng!.lat();
        const lng = e.latLng!.lng();
        const newCoords = [...coordsRef.current, { lat: String(lat), lng: String(lng) }];
        coordsRef.current = newCoords; // update ref immediately so rapid clicks work
        onCoordsChangeRef.current(newCoords);
      });

      // Draw existing markers and polygon
      if (existingCoords.length > 0) {
        drawPolygon(google, map, existingCoords);
      }

      setMapReady(true);
    }).catch(() => {
      setMapReady(false);
      toast.error('Error al cargar el mapa');
    });

    return () => {
      markersRef.current.forEach(m => m.setMap(null));
      markersRef.current = [];
      if (polygonRef.current) { polygonRef.current.setMap(null); polygonRef.current = null; }
      if (tempPolylineRef.current) { tempPolylineRef.current.setMap(null); tempPolylineRef.current = null; }
      if (mapInstanceRef.current) mapInstanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const drawPolygon = (google: any, map: google.maps.Map, coords: CoordPair[]) => {
    // Always read the latest colors from ref to avoid stale closure
    const currentColors = colorsRef.current;

    // Clear previous
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    if (polygonRef.current) { polygonRef.current.setMap(null); polygonRef.current = null; }
    if (tempPolylineRef.current) { tempPolylineRef.current.setMap(null); tempPolylineRef.current = null; }

    // Sync ref with latest coords
    coordsRef.current = coords;

    const path = coords.map(c => ({ lat: Number(c.lat), lng: Number(c.lng) }));

    // Add markers
    coords.forEach((c, idx) => {
      const marker = new google.maps.Marker({
        position: { lat: Number(c.lat), lng: Number(c.lng) },
        map: map,
        label: { text: String(idx + 1), color: '#fff', fontSize: '10px', fontWeight: 'bold' },
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
            `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" fill="${currentColors.stroke}" stroke="#fff" stroke-width="2"/>
              <text x="12" y="16" text-anchor="middle" fill="#fff" font-size="10" font-weight="bold">${idx + 1}</text>
            </svg>`
          ),
          scaledSize: new google.maps.Size(24, 24),
          anchor: new google.maps.Point(12, 12),
        },
        draggable: true,
        zIndex: 100,
      });

      marker.addListener('drag', (e: any) => {
        const newCoords = [...coordsRef.current];
        newCoords[idx] = { lat: String(e.latLng.lat()), lng: String(e.latLng.lng()) };
        coordsRef.current = newCoords; // update ref immediately during drag
        onCoordsChangeRef.current(newCoords);
      });

      marker.addListener('dragend', (e: any) => {
        const newCoords = [...coordsRef.current];
        newCoords[idx] = { lat: String(e.latLng.lat()), lng: String(e.latLng.lng()) };
        coordsRef.current = newCoords;
        onCoordsChangeRef.current(newCoords);
        drawPolygon(google, map, newCoords);
      });

      markersRef.current.push(marker);
    });

    // Draw polygon if 3+ points
    if (coords.length >= 3) {
      polygonRef.current = new google.maps.Polygon({
        paths: path,
        fillColor: currentColors.stroke,
        fillOpacity: 0.2,
        strokeColor: currentColors.stroke,
        strokeOpacity: 0.8,
        strokeWeight: 2,
        map: map,
      });
    } else if (coords.length >= 2) {
      tempPolylineRef.current = new google.maps.Polyline({
        path: path,
        strokeColor: currentColors.stroke,
        strokeOpacity: 0.6,
        strokeWeight: 2,
        icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 }, offset: '0', repeat: '16px' }],
        map: map,
      });
    }
  };

  // Redraw when coords or areaType change from outside
  useEffect(() => {
    if (mapReady && mapInstanceRef.current) {
      const google = window as any;
      if (google.google?.maps) {
        drawPolygon(google, mapInstanceRef.current, existingCoords);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingCoords, mapReady, areaType]);

  const removeLastPoint = () => {
    if (existingCoords.length === 0) return;
    const newCoords = existingCoords.slice(0, -1);
    coordsRef.current = newCoords; // update ref immediately
    onCoordsChange(newCoords);
    if (mapInstanceRef.current && newCoords.length > 0) {
      mapInstanceRef.current.panTo({ lat: Number(newCoords[newCoords.length - 1].lat), lng: Number(newCoords[newCoords.length - 1].lng) });
    }
  };

  const clearAll = () => {
    coordsRef.current = []; // update ref immediately
    onCoordsChange([]);
  };

  const fitBounds = () => {
    if (!mapInstanceRef.current || existingCoords.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    existingCoords.forEach(c => bounds.extend({ lat: Number(c.lat), lng: Number(c.lng) }));
    mapInstanceRef.current.fitBounds(bounds, { padding: 50 });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] text-gray-500 flex items-center gap-1">
          <Crosshair className="w-3 h-3" />
          Haz clic en el mapa para agregar puntos ({existingCoords.length} pts)
        </span>
        {existingCoords.length > 0 && (
          <div className="flex items-center gap-1 ml-auto">
            <button type="button" onClick={fitBounds} className="text-[10px] px-2 py-1 rounded bg-white/5 text-gray-400 hover:text-white transition-colors">
              Ajustar vista
            </button>
            <button type="button" onClick={removeLastPoint} className="text-[10px] px-2 py-1 rounded bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 transition-colors">
              Quitar ultimo
            </button>
            <button type="button" onClick={clearAll} className="text-[10px] px-2 py-1 rounded bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors">
              Limpiar todo
            </button>
          </div>
        )}
      </div>
      <div className="rounded-xl overflow-hidden border border-white/10" style={{ height: '300px' }}>
        <div ref={mapRef} className="w-full h-full" />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAP VIEWER SUB-COMPONENT (preview a single area)
   ═══════════════════════════════════════════════════════════════ */
function ZoneMapPreview({ area, onClose }: { area: LocationArea; onClose: () => void }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!mapRef.current) return;

    loadGoogleMaps().then((google) => {
      if (!mapRef.current) return;

      const coords: [number, number][] = JSON.parse(area.coordinates || '[]');
      const center = coords.length > 0 ? { lat: coords[0][0], lng: coords[0][1] } : CR_CENTER;

      const map = new google.maps.Map(mapRef.current, {
        center,
        zoom: 14,
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: 'greedy',
        styles: [
          { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
          { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
          { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
          { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#283d6a' }] },
        ],
      });

      mapInstanceRef.current = map;

      const colors = areaTypeColors[area.area_type] || areaTypeColors.service_area;

      if (coords.length >= 3) {
        const path = coords.map(([lat, lng]) => ({ lat, lng }));
        const bounds = new google.maps.LatLngBounds();
        path.forEach(p => bounds.extend(p));

        new google.maps.Polygon({
          paths: path,
          fillColor: colors.stroke,
          fillOpacity: 0.25,
          strokeColor: colors.stroke,
          strokeOpacity: 0.9,
          strokeWeight: 3,
          map: map,
        });

        map.fitBounds(bounds, { padding: 50 });
      }

      setReady(true);
    }).catch(() => setReady(false));

    return () => {
      if (mapInstanceRef.current) mapInstanceRef.current = null;
    };
  }, [area]);

  return (
    <div className="rounded-xl overflow-hidden border border-white/10 relative" style={{ height: '300px' }}>
      <div ref={mapRef} className="w-full h-full" />
      <button
        type="button"
        onClick={onClose}
        className="absolute top-2 right-2 z-10 w-7 h-7 rounded-lg bg-black/60 flex items-center justify-center text-gray-300 hover:text-white transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ALL AREAS MAP VIEWER (renders each area as a SEPARATE polygon)
   ═══════════════════════════════════════════════════════════════ */
function AllAreasMapPreview({ areas, onClose }: { areas: LocationArea[]; onClose: () => void }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    loadGoogleMaps().then((google) => {
      if (!mapRef.current) return;

      const map = new google.maps.Map(mapRef.current, {
        center: CR_CENTER,
        zoom: 11,
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: 'greedy',
        styles: [
          { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
          { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
          { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
          { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#283d6a' }] },
        ],
      });

      mapInstanceRef.current = map;
      const bounds = new google.maps.LatLngBounds();
      let hasBounds = false;

      // Render each area as its own separate polygon with its own color
      areas.forEach((area) => {
        try {
          const coords: [number, number][] = JSON.parse(area.coordinates || '[]');
          if (coords.length < 3) return;

          const colors = areaTypeColors[area.area_type] || areaTypeColors.service_area;
          const path = coords.map(([lat, lng]) => ({ lat, lng }));

          // Extend bounds to include this area
          path.forEach(p => { bounds.extend(p); hasBounds = true; });

          new google.maps.Polygon({
            paths: path,
            fillColor: colors.stroke,
            fillOpacity: 0.2,
            strokeColor: colors.stroke,
            strokeOpacity: 0.85,
            strokeWeight: 2,
            map: map,
          });
        } catch {
          // skip invalid coordinates
        }
      });

      if (hasBounds) {
        map.fitBounds(bounds, { padding: 50 });
      }
    }).catch(() => {
      toast.error('Error al cargar el mapa');
    });

    return () => {
      if (mapInstanceRef.current) mapInstanceRef.current = null;
    };
  }, [areas]);

  return (
    <div className="rounded-2xl overflow-hidden border border-white/10 relative" style={{ height: '500px' }}>
      <div ref={mapRef} className="w-full h-full" />
      <button
        type="button"
        onClick={onClose}
        className="absolute top-3 right-3 z-10 w-8 h-8 rounded-lg bg-black/70 flex items-center justify-center text-gray-300 hover:text-white transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
      <div className="absolute bottom-3 left-3 z-10 glass-strong rounded-xl p-3 max-w-[220px]">
        <p className="text-[10px] font-semibold text-white mb-1.5">Leyenda</p>
        {Object.entries(areaTypeColors).map(([key, c]) => (
          <div key={key} className="flex items-center gap-2 mb-1 last:mb-0">
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: c.stroke }} />
            <span className="text-[10px] text-gray-300">{areaTypeLabels[key]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   LOADING SKELETON
   ═══════════════════════════════════════════════════════════════ */
function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Filters bar skeleton */}
      <div className="glass rounded-2xl p-4 animate-pulse">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <div className="h-10 w-full rounded-xl bg-white/5" />
          </div>
          <div className="h-10 w-40 rounded-xl bg-white/5" />
          <div className="h-10 w-32 rounded-xl bg-white/5" />
        </div>
      </div>
      {/* Table skeleton */}
      <div className="glass rounded-2xl overflow-hidden animate-pulse">
        <div className="p-4 border-b border-white/10">
          <div className="flex gap-4">
            <div className="h-3 w-24 rounded bg-white/5" />
            <div className="h-3 w-20 rounded bg-white/5" />
            <div className="h-3 w-20 rounded bg-white/5" />
            <div className="h-3 w-16 rounded bg-white/5" />
          </div>
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-white/5">
            <div className="w-8 h-8 rounded-lg bg-white/5 flex-shrink-0" />
            <div className="flex-1">
              <div className="h-4 w-36 rounded bg-white/5 mb-1" />
              <div className="h-3 w-20 rounded bg-white/5" />
            </div>
            <div className="h-5 w-24 rounded-full bg-white/5" />
            <div className="h-3 w-16 rounded bg-white/5" />
            <div className="w-5 h-5 rounded-full bg-white/5" />
            <div className="flex gap-1">
              <div className="w-8 h-8 rounded-lg bg-white/5" />
              <div className="w-8 h-8 rounded-lg bg-white/5" />
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
export default function LocationsPage() {
  const [areas, setAreas] = useState<LocationArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<AreaTypeFilter>('todos');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editingArea, setEditingArea] = useState<LocationArea | null>(null);
  const [formData, setFormData] = useState(emptyArea());
  const [coords, setCoords] = useState<CoordPair[]>([]);
  const [formSaving, setFormSaving] = useState(false);

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Preview
  const [previewArea, setPreviewArea] = useState<LocationArea | null>(null);

  const loadAreas = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('location_areas')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Error al cargar areas geograficas');
      console.error(error);
    } else {
      setAreas(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadAreas(); }, [loadAreas]);

  const filteredAreas = areas.filter(area => {
    const matchSearch = !search || area.name.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'todos' || area.area_type === typeFilter;
    const matchStatus = statusFilter === 'todos' ||
      (statusFilter === 'activas' && area.is_active) ||
      (statusFilter === 'inactivas' && !area.is_active);
    return matchSearch && matchType && matchStatus;
  });

  const openCreateModal = () => {
    setEditingArea(null);
    setFormData(emptyArea());
    setCoords([]);
    setShowModal(true);
  };

  const openEditModal = (area: LocationArea) => {
    setEditingArea(area);
    setFormData({
      name: area.name,
      area_type: area.area_type,
      country: area.country || 'Costa Rica',
      coordinates: area.coordinates,
      is_active: area.is_active,
      notes: area.notes || '',
      surge_multiplier: area.surge_multiplier || 1.00,
    });
    setCoords(parseCoords(area.coordinates));
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }

    setFormSaving(true);
    try {
      const payload = {
        name: formData.name,
        area_type: formData.area_type,
        country: formData.country,
        coordinates: stringifyCoords(coords),
        is_active: formData.is_active,
        notes: formData.notes,
        surge_multiplier: formData.surge_multiplier,
      };

      if (editingArea) {
        const { error } = await supabase
          .from('location_areas')
          .update(payload)
          .eq('id', editingArea.id);
        if (error) throw error;
        toast.success('Area actualizada');
      } else {
        const { error } = await supabase
          .from('location_areas')
          .insert(payload);
        if (error) throw error;
        toast.success('Area creada');
      }
      setShowModal(false);
      loadAreas();
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar');
    } finally {
      setFormSaving(false);
    }
  };

  const toggleActive = async (area: LocationArea) => {
    try {
      const { error } = await supabase
        .from('location_areas')
        .update({ is_active: !area.is_active })
        .eq('id', area.id);
      if (error) throw error;
      toast.success(`"${area.name}" ${area.is_active ? 'desactivada' : 'activada'}`);
      loadAreas();
    } catch (err: any) {
      toast.error(err.message || 'Error al cambiar estado');
    }
  };

  const deleteArea = async (id: string) => {
    try {
      const { error } = await supabase
        .from('location_areas')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast.success('Area eliminada');
      setDeleteConfirm(null);
      loadAreas();
    } catch (err: any) {
      toast.error(err.message || 'Error al eliminar');
    }
  };

  const getCoordCount = (jsonStr: string): number => parseCoords(jsonStr).length;

  const formatDate = (date: string) => new Date(date).toLocaleDateString('es-CR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/admin" className="hover:text-white transition-colors flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" />
            Panel
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-white font-medium">Zonas Geográficas</span>
        </div>
        <h1 className="text-3xl font-bold text-white">Areas Geograficas</h1>
        <p className="text-gray-400 mt-1">Gestion de zonas de servicio, restricciones, surge y areas especiales</p>
      </div>

      {/* Loading Skeleton */}
      {loading && <LoadingSkeleton />}

      {!loading && (
        <>
      {/* Filters */}
      <motion.div className="glass rounded-2xl p-4" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar area por nombre..."
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as AreaTypeFilter)}
              className="bg-white/5 border border-white/10 rounded-xl pl-10 pr-8 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-cyan-500/50 appearance-none cursor-pointer min-w-[160px]">
              <option value="todos" className="bg-[#111827]">Todos</option>
              <option value="restriction" className="bg-[#111827]">Restriccion</option>
              <option value="surge_zone" className="bg-[#111827]">Zona Surge</option>
              <option value="hotspot" className="bg-[#111827]">Hotspot</option>
              <option value="service_area" className="bg-[#111827]">Area Servicio</option>
              <option value="airport_zone" className="bg-[#111827]">Zona Aeropuerto</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          </div>
          <div className="relative">
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-cyan-500/50 appearance-none cursor-pointer min-w-[130px]">
              <option value="todos" className="bg-[#111827]">Todos</option>
              <option value="activas" className="bg-[#111827]">Activas</option>
              <option value="inactivas" className="bg-[#111827]">Inactivas</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          </div>
          {/* View toggle */}
          <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1">
            <button type="button" onClick={() => setViewMode('list')}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${viewMode === 'list' ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-500 hover:text-white'}`}>
              <List className="w-3.5 h-3.5" /> Lista
            </button>
            <button type="button" onClick={() => setViewMode('map')}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${viewMode === 'map' ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-500 hover:text-white'}`}>
              <Map className="w-3.5 h-3.5" /> Mapa
            </button>
          </div>
          <button type="button" onClick={openCreateModal}
            className="py-2.5 px-5 rounded-xl btn-neon text-white text-sm font-semibold flex items-center gap-2 flex-shrink-0">
            <Plus className="w-4 h-4" /> CREAR AREA
          </button>
        </div>
      </motion.div>

      {/* LIST VIEW */}
      {viewMode === 'list' && (
        <motion.div className="glass rounded-2xl overflow-hidden" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Nombre</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3 hidden sm:table-cell">Tipo</th>
                  <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3 hidden md:table-cell">Coordenadas</th>
                  <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3 hidden lg:table-cell">Surge</th>
                  <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Estado</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3 hidden lg:table-cell">Creado</th>
                  <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredAreas.map((area, i) => {
                  const typeColor = areaTypeColors[area.area_type] || areaTypeColors.service_area;
                  return (
                    <motion.tr key={area.id} className="hover:bg-white/[0.02] transition-colors"
                      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg ${typeColor.bg} flex items-center justify-center flex-shrink-0`}>
                            <MapPinned className={`w-4 h-4 ${typeColor.text}`} />
                          </div>
                          <div>
                            <span className="text-sm font-medium text-white">{area.name}</span>
                            {area.country && <p className="text-[10px] text-gray-600">{area.country}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${typeColor.bg} ${typeColor.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${typeColor.dot}`} />
                          {areaTypeLabels[area.area_type]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center hidden md:table-cell">
                        <span className="text-xs text-gray-400">{getCoordCount(area.coordinates)} puntos</span>
                      </td>
                      <td className="px-4 py-3 text-center hidden lg:table-cell">
                        <span className={`text-xs font-mono ${area.surge_multiplier > 1 ? 'text-amber-400' : 'text-gray-500'}`}>
                          x{area.surge_multiplier || 1.00}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button type="button" onClick={() => toggleActive(area)} className="inline-flex items-center">
                          {area.is_active ? <ToggleRight className="w-5 h-5 text-emerald-400" /> : <ToggleLeft className="w-5 h-5 text-gray-500" />}
                        </button>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-xs text-gray-500">{formatDate(area.created_at)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button type="button" onClick={() => setPreviewArea(area)}
                            className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all" title="Ver en mapa">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" onClick={() => openEditModal(area)}
                            className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all" title="Editar">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {deleteConfirm === area.id ? (
                            <div className="flex items-center gap-1">
                              <button type="button" onClick={() => deleteArea(area.id)}
                                className="text-[10px] px-2 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors">Confirmar</button>
                              <button type="button" onClick={() => setDeleteConfirm(null)}
                                className="text-[10px] px-2 py-1 rounded bg-white/5 text-gray-400 hover:bg-white/10 transition-colors">No</button>
                            </div>
                          ) : (
                            <button type="button" onClick={() => setDeleteConfirm(area.id)}
                              className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all" title="Eliminar">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredAreas.length === 0 && (
            <div className="p-12 text-center">
              <MapPin className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No se encontraron areas geograficas</p>
            </div>
          )}
        </motion.div>
      )}

      {/* MAP VIEW - Preview all areas as separate polygons */}
      {viewMode === 'map' && <AllAreasMapPreview areas={filteredAreas} onClose={() => setViewMode('list')} />}
        </>
      )}

      {/* ===================== FORM MODAL ===================== */}
      <AnimatePresence>
        {showModal && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/60" onClick={() => setShowModal(false)} />
            <motion.div className="relative glass-strong rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto z-10"
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-white">{editingArea ? 'Editar Area' : 'Crear Area'}</h2>
                <button type="button" onClick={() => setShowModal(false)}
                  className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-400">Nombre *</label>
                  <input type="text" value={formData.name} onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50"
                    placeholder="Nombre del area" />
                </div>

                {/* Row: Type + Country */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-400">Tipo de Area</label>
                    <select value={formData.area_type} onChange={e => setFormData(prev => ({ ...prev, area_type: e.target.value as any }))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500/50 appearance-none">
                      <option value="service_area" className="bg-[#111827]">Area de Servicio</option>
                      <option value="restriction" className="bg-[#111827]">Zona Restringida</option>
                      <option value="surge_zone" className="bg-[#111827]">Zona Surge</option>
                      <option value="hotspot" className="bg-[#111827]">Zona Popular</option>
                      <option value="airport_zone" className="bg-[#111827]">Zona Aeropuerto</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-400">Pais</label>
                    <input type="text" value={formData.country} onChange={e => setFormData(prev => ({ ...prev, country: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50"
                      placeholder="Costa Rica" />
                  </div>
                </div>

                {/* Row: Surge + Active Toggle */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-400">Multiplicador Surge</label>
                    <input type="number" step="0.1" min="0" max="5" value={formData.surge_multiplier}
                      onChange={e => setFormData(prev => ({ ...prev, surge_multiplier: parseFloat(e.target.value) || 1 }))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 font-mono"
                      placeholder="1.00" />
                    <p className="text-[10px] text-gray-600">Ej: 1.5 = 50% mas caro en esta zona</p>
                  </div>
                  <div className="flex items-center justify-between bg-white/5 rounded-xl p-3">
                    <div>
                      <p className="text-sm text-white font-medium">Estado Activo</p>
                      <p className="text-xs text-gray-500">Disponible para el sistema</p>
                    </div>
                    <button type="button" onClick={() => setFormData(prev => ({ ...prev, is_active: !prev.is_active }))}
                      className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${formData.is_active ? 'bg-cyan-500' : 'bg-white/10'}`}>
                      <motion.div className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md"
                        animate={{ left: formData.is_active ? 'calc(100% - 22px)' : '2px' }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
                    </button>
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-400">Notas</label>
                  <textarea value={formData.notes} onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))} rows={2}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 resize-none"
                    placeholder="Notas adicionales..." />
                </div>

                {/* Map Editor */}
                <MapEditor existingCoords={coords} onCoordsChange={setCoords} areaType={formData.area_type} />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 mt-6">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-sm font-medium hover:bg-white/10 transition-all">
                  Cancelar
                </button>
                <button type="button" onClick={handleSave} disabled={formSaving}
                  className="flex-1 py-2.5 rounded-xl btn-neon text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
                  {formSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : <><Save className="w-4 h-4" />{editingArea ? 'Actualizar' : 'Crear'}</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===================== PREVIEW MODAL ===================== */}
      <AnimatePresence>
        {previewArea && previewArea.id !== '__all__' && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/60" onClick={() => setPreviewArea(null)} />
            <motion.div className="relative glass-strong rounded-2xl p-6 w-full max-w-lg z-10"
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">{previewArea.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs ${areaTypeColors[previewArea.area_type]?.text}`}>
                      {areaTypeLabels[previewArea.area_type]}
                    </span>
                    <span className="text-[10px] text-gray-500">x{previewArea.surge_multiplier || 1.00}</span>
                  </div>
                </div>
                <button type="button" onClick={() => setPreviewArea(null)}
                  className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ZoneMapPreview area={previewArea} onClose={() => setPreviewArea(null)} />
              {previewArea.notes && (
                <p className="text-xs text-gray-500 mt-3">{previewArea.notes}</p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
