'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  MapPin, Search, Plus, Edit2, Trash2, Loader2, X,
  ChevronDown, Filter, ToggleLeft, ToggleRight, MapPinned,
  Eye, Save, Crosshair, ChevronRight, ArrowLeft, Navigation2,
  Copy, ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { loadGoogleMaps } from '@/lib/googleMaps';

/* ─── Types ────────────────────────────────────────────────── */
interface AdminPlace {
  id: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  zone_type: 'restriction' | 'surge_zone' | 'hotspot' | 'service_area' | 'airport_zone';
  is_active: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
}

type ZoneFilter = 'todos' | 'restriction' | 'surge_zone' | 'hotspot' | 'service_area' | 'airport_zone';
type StatusFilter = 'todos' | 'activos' | 'inactivos';

const zoneLabels: Record<string, string> = {
  restriction: 'Zona Restringida',
  surge_zone: 'Zona Surge',
  hotspot: 'Zona Popular',
  service_area: 'Area de Servicio',
  airport_zone: 'Zona Aeropuerto',
};

const zoneColors: Record<string, { bg: string; text: string; dot: string; stroke: string; light: string }> = {
  restriction: { bg: 'bg-red-500/15', text: 'text-red-400', dot: 'bg-red-400', stroke: '#ef4444', light: 'border-red-500/30' },
  surge_zone: { bg: 'bg-amber-500/15', text: 'text-amber-400', dot: 'bg-amber-400', stroke: '#f59e0b', light: 'border-amber-500/30' },
  hotspot: { bg: 'bg-orange-500/15', text: 'text-orange-400', dot: 'bg-orange-400', stroke: '#f97316', light: 'border-orange-500/30' },
  service_area: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', dot: 'bg-emerald-400', stroke: '#10b981', light: 'border-emerald-500/30' },
  airport_zone: { bg: 'bg-cyan-500/15', text: 'text-cyan-400', dot: 'bg-cyan-400', stroke: '#06b6d4', light: 'border-cyan-500/30' },
};

const CR_CENTER = { lat: 9.9281, lng: -84.0907 };

const emptyPlace = (): Omit<AdminPlace, 'id' | 'created_at' | 'updated_at'> => ({
  name: '',
  address: '',
  lat: null,
  lng: null,
  zone_type: 'service_area',
  is_active: true,
  notes: '',
});

/* ═══════════════════════════════════════════════════════════════
   MINI MAP PICKER — click to select coordinates
   ═══════════════════════════════════════════════════════════════ */
function MiniMapPicker({
  lat,
  lng,
  onPick,
  zoneType,
}: {
  lat: number | null;
  lng: number | null;
  onPick: (lat: number, lng: number) => void;
  zoneType: string;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!mapRef.current) return;

    loadGoogleMaps().then((google) => {
      if (!mapRef.current) return;

      const center = lat && lng ? { lat, lng } : CR_CENTER;

      const map = new google.maps.Map(mapRef.current, {
        center,
        zoom: lat && lng ? 15 : 12,
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

      const colors = zoneColors[zoneType] || zoneColors.service_area;

      // Click to place marker
      map.addListener('click', (e: google.maps.MapMouseEvent) => {
        const clickLat = e.latLng!.lat();
        const clickLng = e.latLng!.lng();
        onPick(clickLat, clickLng);
      });

      // If existing coords, place marker
      if (lat && lng) {
        markerRef.current = new google.maps.Marker({
          position: { lat, lng },
          map,
          draggable: true,
          icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
              `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
                <path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 24 16 24s16-12 16-24C32 7.16 24.84 0 16 0z" fill="${colors.stroke}" stroke="#fff" stroke-width="2"/>
                <circle cx="16" cy="16" r="6" fill="#fff"/>
              </svg>`
            ),
            scaledSize: new google.maps.Size(32, 40),
            anchor: new google.maps.Point(16, 40),
          },
        });

        markerRef.current.addListener('dragend', (e: any) => {
          onPick(e.latLng.lat(), e.latLng.lng());
        });
      }

      setMapReady(true);
    }).catch(() => {
      toast.error('Error al cargar el mapa');
    });

    return () => {
      if (markerRef.current) { markerRef.current.setMap(null); markerRef.current = null; }
      if (mapInstanceRef.current) mapInstanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update marker when lat/lng change from outside
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    const google = window as any;
    if (!google.google?.maps) return;

    if (markerRef.current) markerRef.current.setMap(null);

    if (lat && lng) {
      const colors = zoneColors[zoneType] || zoneColors.service_area;
      markerRef.current = new google.maps.Marker({
        position: { lat, lng },
        map: mapInstanceRef.current,
        draggable: true,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
            `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
              <path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 24 16 24s16-12 16-24C32 7.16 24.84 0 16 0z" fill="${colors.stroke}" stroke="#fff" stroke-width="2"/>
              <circle cx="16" cy="16" r="6" fill="#fff"/>
            </svg>`
          ),
          scaledSize: new google.maps.Size(32, 40),
          anchor: new google.maps.Point(16, 40),
        },
      });

      markerRef.current!.addListener('dragend', (e: any) => {
        onPick(e.latLng.lat(), e.latLng.lng());
      });

      mapInstanceRef.current.panTo({ lat, lng });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, mapReady, zoneType]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Crosshair className="w-3 h-3 text-gray-500" />
        <span className="text-[10px] text-gray-500">
          Haz clic en el mapa o arrastra el pin para seleccionar ubicación
        </span>
        {lat && lng && (
          <span className="text-[10px] text-gray-400 ml-auto font-mono">
            {Number(lat).toFixed(5)}, {Number(lng).toFixed(5)}
          </span>
        )}
      </div>
      <div className="rounded-xl overflow-hidden border border-white/10" style={{ height: '220px' }}>
        <div ref={mapRef} className="w-full h-full" />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAP VIEW — all places as markers on one map
   ═══════════════════════════════════════════════════════════════ */
function AllPlacesMap({ places, onClose }: { places: AdminPlace[]; onClose: () => void }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);

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

      places.forEach((place) => {
        if (!place.lat || !place.lng) return;

        const colors = zoneColors[place.zone_type] || zoneColors.service_area;
        const pos = { lat: place.lat, lng: place.lng };
        bounds.extend(pos);
        hasBounds = true;

        const marker = new google.maps.Marker({
          position: pos,
          map,
          title: place.name,
          icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
              `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
                <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.27 21.73 0 14 0z" fill="${colors.stroke}" stroke="#fff" stroke-width="1.5"/>
                <circle cx="14" cy="14" r="5" fill="#fff"/>
              </svg>`
            ),
            scaledSize: new google.maps.Size(28, 36),
            anchor: new google.maps.Point(14, 36),
          },
        });

        const infoWindow = new google.maps.InfoWindow({
          content: `
            <div style="font-family:system-ui;padding:4px 8px;max-width:200px;">
              <div style="font-weight:600;font-size:13px;color:#111;">${place.name}</div>
              ${place.address ? `<div style="font-size:11px;color:#555;margin-top:2px;">${place.address}</div>` : ''}
              <div style="margin-top:4px;">
                <span style="display:inline-block;font-size:10px;padding:2px 6px;border-radius:9999px;background:${colors.stroke}20;color:${colors.stroke};font-weight:600;">${zoneLabels[place.zone_type]}</span>
              </div>
            </div>
          `,
        });

        marker.addListener('click', () => infoWindow.open(map, marker));
        markersRef.current.push(marker);
      });

      if (hasBounds) {
        map.fitBounds(bounds, { padding: 60 });
      }
    }).catch(() => toast.error('Error al cargar el mapa'));

    return () => {
      markersRef.current.forEach(m => m.setMap(null));
      markersRef.current = [];
      if (mapInstanceRef.current) mapInstanceRef.current = null;
    };
  }, [places]);

  return (
    <div className="rounded-2xl overflow-hidden border border-white/10 relative" style={{ height: '500px' }}>
      <div ref={mapRef} className="w-full h-full" />
      <button type="button" onClick={onClose}
        className="absolute top-3 right-3 z-10 w-8 h-8 rounded-lg bg-black/70 flex items-center justify-center text-gray-300 hover:text-white transition-colors">
        <X className="w-4 h-4" />
      </button>
      <div className="absolute bottom-3 left-3 z-10 glass-strong rounded-xl p-3 max-w-[220px]">
        <p className="text-[10px] font-semibold text-white mb-1.5">Leyenda de Zonas</p>
        {Object.entries(zoneColors).map(([key, c]) => (
          <div key={key} className="flex items-center gap-2 mb-1 last:mb-0">
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: c.stroke }} />
            <span className="text-[10px] text-gray-300">{zoneLabels[key]}</span>
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
    <div className="space-y-6 animate-pulse">
      <div className="glass rounded-2xl p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="h-10 flex-1 rounded-xl bg-white/5" />
          <div className="h-10 w-40 rounded-xl bg-white/5" />
          <div className="h-10 w-32 rounded-xl bg-white/5" />
        </div>
      </div>
      <div className="glass rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-white/10">
          <div className="flex gap-4">
            <div className="h-3 w-24 rounded bg-white/5" />
            <div className="h-3 w-20 rounded bg-white/5" />
            <div className="h-3 w-20 rounded bg-white/5" />
            <div className="h-3 w-16 rounded bg-white/5" />
          </div>
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-white/5">
            <div className="w-8 h-8 rounded-lg bg-white/5 flex-shrink-0" />
            <div className="flex-1">
              <div className="h-4 w-32 rounded bg-white/5 mb-1" />
              <div className="h-3 w-24 rounded bg-white/5" />
            </div>
            <div className="h-5 w-24 rounded-full bg-white/5" />
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
export default function PlacesPage() {
  const [places, setPlaces] = useState<AdminPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [zoneFilter, setZoneFilter] = useState<ZoneFilter>('todos');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editingPlace, setEditingPlace] = useState<AdminPlace | null>(null);
  const [formData, setFormData] = useState(emptyPlace());
  const [formSaving, setFormSaving] = useState(false);

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  /* ── Load ── */
  const loadPlaces = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('admin_places')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Error al cargar lugares');
      console.error(error);
    } else {
      setPlaces(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadPlaces(); }, [loadPlaces]);

  /* ── Filter ── */
  const filteredPlaces = places.filter(p => {
    const matchSearch = !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.address.toLowerCase().includes(search.toLowerCase());
    const matchZone = zoneFilter === 'todos' || p.zone_type === zoneFilter;
    const matchStatus = statusFilter === 'todos' ||
      (statusFilter === 'activos' && p.is_active) ||
      (statusFilter === 'inactivos' && !p.is_active);
    return matchSearch && matchZone && matchStatus;
  });

  /* ── CRUD ── */
  const openCreate = () => {
    setEditingPlace(null);
    setFormData(emptyPlace());
    setShowModal(true);
  };

  const openEdit = (place: AdminPlace) => {
    setEditingPlace(place);
    setFormData({
      name: place.name,
      address: place.address || '',
      lat: place.lat,
      lng: place.lng,
      zone_type: place.zone_type,
      is_active: place.is_active,
      notes: place.notes || '',
    });
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
        address: formData.address,
        lat: formData.lat,
        lng: formData.lng,
        zone_type: formData.zone_type,
        is_active: formData.is_active,
        notes: formData.notes,
      };

      if (editingPlace) {
        const { error } = await supabase
          .from('admin_places')
          .update(payload)
          .eq('id', editingPlace.id);
        if (error) throw error;
        toast.success('Lugar actualizado');
      } else {
        const { error } = await supabase
          .from('admin_places')
          .insert(payload);
        if (error) throw error;
        toast.success('Lugar creado');
      }
      setShowModal(false);
      loadPlaces();
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar');
    } finally {
      setFormSaving(false);
    }
  };

  const toggleActive = async (place: AdminPlace) => {
    try {
      const { error } = await supabase
        .from('admin_places')
        .update({ is_active: !place.is_active })
        .eq('id', place.id);
      if (error) throw error;
      toast.success(`"${place.name}" ${place.is_active ? 'desactivado' : 'activado'}`);
      loadPlaces();
    } catch (err: any) {
      toast.error(err.message || 'Error al cambiar estado');
    }
  };

  const deletePlace = async (id: string) => {
    try {
      const { error } = await supabase
        .from('admin_places')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast.success('Lugar eliminado');
      setDeleteConfirm(null);
      loadPlaces();
    } catch (err: any) {
      toast.error(err.message || 'Error al eliminar');
    }
  };

  const copyCoords = (place: AdminPlace) => {
    if (place.lat && place.lng) {
      navigator.clipboard.writeText(`${place.lat}, ${place.lng}`);
      toast.success('Coordenadas copiadas');
    }
  };

  const openInGoogle = (place: AdminPlace) => {
    if (place.lat && place.lng) {
      window.open(`https://www.google.com/maps?q=${place.lat},${place.lng}`, '_blank');
    }
  };

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('es-CR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  /* ── Stats ── */
  const stats = {
    total: places.length,
    active: places.filter(p => p.is_active).length,
    byZone: Object.keys(zoneLabels).reduce((acc, key) => {
      acc[key] = places.filter(p => p.zone_type === key).length;
      return acc;
    }, {} as Record<string, number>),
  };

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
          <span className="text-white font-medium">Mapas y Zonas</span>
        </div>
        <h1 className="text-3xl font-bold text-white">Lugares y Ubicaciones</h1>
        <p className="text-gray-400 mt-1">Gestiona lugares y ubicaciones asociados a zonas del sistema</p>
      </div>

      {/* Stats Cards */}
      {!loading && (
        <motion.div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3"
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="glass rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-white">{stats.total}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">Total</p>
          </div>
          <div className="glass rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-emerald-400">{stats.active}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">Activos</p>
          </div>
          {Object.entries(zoneLabels).map(([key, label]) => {
            const c = zoneColors[key];
            return (
              <div key={key} className="glass rounded-xl p-3 text-center">
                <p className={`text-2xl font-bold ${c.text}`}>{stats.byZone[key] || 0}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">{label}</p>
              </div>
            );
          })}
        </motion.div>
      )}

      {/* Loading */}
      {loading && <LoadingSkeleton />}

      {!loading && (
        <>
          {/* Filters */}
          <motion.div className="glass rounded-2xl p-4" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar lugar o dirección..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 transition-colors" />
              </div>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                <select value={zoneFilter} onChange={e => setZoneFilter(e.target.value as ZoneFilter)}
                  className="bg-white/5 border border-white/10 rounded-xl pl-10 pr-8 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-cyan-500/50 appearance-none cursor-pointer min-w-[160px]">
                  <option value="todos" className="bg-[#111827]">Todas las Zonas</option>
                  <option value="restriction" className="bg-[#111827]">Restriccion</option>
                  <option value="surge_zone" className="bg-[#111827]">Zona Surge</option>
                  <option value="hotspot" className="bg-[#111827]">Zona Popular</option>
                  <option value="service_area" className="bg-[#111827]">Area Servicio</option>
                  <option value="airport_zone" className="bg-[#111827]">Zona Aeropuerto</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
              </div>
              <div className="relative">
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)}
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-cyan-500/50 appearance-none cursor-pointer min-w-[130px]">
                  <option value="todos" className="bg-[#111827]">Todos</option>
                  <option value="activos" className="bg-[#111827]">Activos</option>
                  <option value="inactivos" className="bg-[#111827]">Inactivos</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
              </div>
              <button type="button" onClick={openCreate}
                className="py-2.5 px-5 rounded-xl btn-neon text-white text-sm font-semibold flex items-center gap-2 flex-shrink-0">
                <Plus className="w-4 h-4" /> AGREGAR LUGAR
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
                      <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Lugar</th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3 hidden sm:table-cell">Zona</th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3 hidden md:table-cell">Dirección</th>
                      <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3 hidden lg:table-cell">Coords</th>
                      <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Estado</th>
                      <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3 hidden lg:table-cell">Creado</th>
                      <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredPlaces.map((place, i) => {
                      const zc = zoneColors[place.zone_type] || zoneColors.service_area;
                      return (
                        <motion.tr key={place.id} className="hover:bg-white/[0.02] transition-colors"
                          initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className={`w-8 h-8 rounded-lg ${zc.bg} flex items-center justify-center flex-shrink-0`}>
                                <MapPinned className={`w-4 h-4 ${zc.text}`} />
                              </div>
                              <div>
                                <span className="text-sm font-medium text-white">{place.name}</span>
                                {place.notes && <p className="text-[10px] text-gray-600 truncate max-w-[140px]">{place.notes}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${zc.bg} ${zc.text}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${zc.dot}`} />
                              {zoneLabels[place.zone_type]}
                            </span>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <span className="text-xs text-gray-400 truncate block max-w-[180px]">{place.address || '—'}</span>
                          </td>
                          <td className="px-4 py-3 text-center hidden lg:table-cell">
                            {place.lat && place.lng ? (
                              <div className="flex items-center justify-center gap-1">
                                <span className="text-[10px] text-gray-400 font-mono">
                                  {Number(place.lat).toFixed(4)}, {Number(place.lng).toFixed(4)}
                                </span>
                                <button type="button" onClick={() => copyCoords(place)}
                                  className="w-5 h-5 rounded flex items-center justify-center text-gray-600 hover:text-cyan-400 transition-colors"
                                  title="Copiar coordenadas">
                                  <Copy className="w-3 h-3" />
                                </button>
                                <button type="button" onClick={() => openInGoogle(place)}
                                  className="w-5 h-5 rounded flex items-center justify-center text-gray-600 hover:text-cyan-400 transition-colors"
                                  title="Ver en Google Maps">
                                  <ExternalLink className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-600">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button type="button" onClick={() => toggleActive(place)} className="inline-flex items-center">
                              {place.is_active
                                ? <ToggleRight className="w-5 h-5 text-emerald-400" />
                                : <ToggleLeft className="w-5 h-5 text-gray-500" />}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-center hidden lg:table-cell">
                            <span className="text-xs text-gray-500">{formatDate(place.created_at)}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1">
                              <button type="button" onClick={() => openEdit(place)}
                                className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all"
                                title="Editar">
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              {deleteConfirm === place.id ? (
                                <div className="flex items-center gap-1">
                                  <button type="button" onClick={() => deletePlace(place.id)}
                                    className="text-[10px] px-2 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors">Confirmar</button>
                                  <button type="button" onClick={() => setDeleteConfirm(null)}
                                    className="text-[10px] px-2 py-1 rounded bg-white/5 text-gray-400 hover:bg-white/10 transition-colors">No</button>
                                </div>
                              ) : (
                                <button type="button" onClick={() => setDeleteConfirm(place.id)}
                                  className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                                  title="Eliminar">
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
              {filteredPlaces.length === 0 && (
                <div className="p-12 text-center">
                  <MapPin className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">No se encontraron lugares</p>
                  <p className="text-gray-600 text-xs mt-1">Agrega tu primer lugar con el boton de arriba</p>
                </div>
              )}
            </motion.div>
          )}

          {/* MAP VIEW */}
          {viewMode === 'map' && (
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <AllPlacesMap places={filteredPlaces} onClose={() => setViewMode('list')} />
            </motion.div>
          )}
        </>
      )}

      {/* Toggle list/map */}
      {!loading && viewMode === 'list' && filteredPlaces.length > 0 && (
        <div className="flex justify-center">
          <button type="button" onClick={() => setViewMode('map')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl glass text-xs text-gray-400 hover:text-cyan-400 transition-colors">
            <Eye className="w-3.5 h-3.5" />
            Ver en mapa ({filteredPlaces.filter(p => p.lat && p.lng).length} con coordenadas)
          </button>
        </div>
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
                <h2 className="text-lg font-bold text-white">{editingPlace ? 'Editar Lugar' : 'Agregar Lugar'}</h2>
                <button type="button" onClick={() => setShowModal(false)}
                  className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-400">Nombre del lugar *</label>
                  <input type="text" value={formData.name}
                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50"
                    placeholder="Ej: Hospital Calderon Guardia, Mall San Pedro..." />
                </div>

                {/* Address */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-400">Direccion</label>
                  <input type="text" value={formData.address}
                    onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50"
                    placeholder="Direccion completa o referencia..." />
                </div>

                {/* Zone Type + Active */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-400">Tipo de Zona</label>
                    <select value={formData.zone_type}
                      onChange={e => setFormData(prev => ({ ...prev, zone_type: e.target.value as any }))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500/50 appearance-none">
                      <option value="service_area" className="bg-[#111827]">Area de Servicio</option>
                      <option value="restriction" className="bg-[#111827]">Zona Restringida</option>
                      <option value="surge_zone" className="bg-[#111827]">Zona Surge</option>
                      <option value="hotspot" className="bg-[#111827]">Zona Popular</option>
                      <option value="airport_zone" className="bg-[#111827]">Zona Aeropuerto</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-400">Estado</label>
                    <button type="button" onClick={() => setFormData(prev => ({ ...prev, is_active: !prev.is_active }))}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-colors ${
                        formData.is_active
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                          : 'border-white/10 bg-white/5 text-gray-500'
                      }`}>
                      {formData.is_active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                      <span className="text-sm">{formData.is_active ? 'Activo' : 'Inactivo'}</span>
                    </button>
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-400">Notas (opcional)</label>
                  <input type="text" value={formData.notes}
                    onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50"
                    placeholder="Nota o referencia adicional..." />
                </div>

                {/* Map Picker */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-400 flex items-center gap-1.5">
                    <Navigation2 className="w-3.5 h-3.5" />
                    Ubicacion en el mapa (opcional)
                  </label>
                  <MiniMapPicker
                    lat={formData.lat}
                    lng={formData.lng}
                    zoneType={formData.zone_type}
                    onPick={(lat, lng) => setFormData(prev => ({ ...prev, lat, lng }))}
                  />
                </div>

                {/* Manual Coords */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-400">Latitud</label>
                    <input type="number" step="0.000001" value={formData.lat ?? ''}
                      onChange={e => setFormData(prev => ({ ...prev, lat: e.target.value ? Number(e.target.value) : null }))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 font-mono"
                      placeholder="9.928100" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-400">Longitud</label>
                    <input type="number" step="0.000001" value={formData.lng ?? ''}
                      onChange={e => setFormData(prev => ({ ...prev, lng: e.target.value ? Number(e.target.value) : null }))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 font-mono"
                      placeholder="-84.090700" />
                  </div>
                </div>

                {/* Zone color indicator */}
                <div className={`rounded-xl border p-3 ${zoneColors[formData.zone_type]?.bg || ''} ${zoneColors[formData.zone_type]?.light || ''}`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${zoneColors[formData.zone_type]?.dot || ''}`} />
                    <span className={`text-xs font-medium ${zoneColors[formData.zone_type]?.text || ''}`}>
                      {zoneLabels[formData.zone_type]}
                    </span>
                  </div>
                </div>

                {/* Save */}
                <div className="flex items-center gap-3 pt-2">
                  <button type="button" onClick={handleSave} disabled={formSaving}
                    className="flex-1 py-3 rounded-xl btn-neon text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
                    {formSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {formSaving ? 'Guardando...' : (editingPlace ? 'Guardar Cambios' : 'Crear Lugar')}
                  </button>
                  <button type="button" onClick={() => setShowModal(false)}
                    className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-sm font-medium hover:bg-white/10 transition-colors">
                    Cancelar
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
