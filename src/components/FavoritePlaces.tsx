'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, MapPin, Check, Loader2, Trash2, ChevronRight, Search } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useFavoritePlacesStore } from '@/store/favoritePlacesStore';
import { toast } from 'sonner';
import PlacesAutocomplete from '@/components/PlacesAutocomplete';

const PRESET_ICONS = [
  { icon: '🏠', label: 'Casa' },
  { icon: '🏢', label: 'Trabajo' },
  { icon: '💪', label: 'Gym' },
  { icon: '🏫', label: 'Universidad' },
  { icon: '🏥', label: 'Hospital' },
  { icon: '🛒', label: 'Super' },
  { icon: '🍕', label: 'Comida' },
  { icon: '❤️', label: 'Familia' },
];

export default function FavoritePlaces() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { places, isLoading, fetchPlaces, addPlace, deletePlace, setPrefill } = useFavoritePlacesStore();

  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedIcon, setSelectedIcon] = useState('📍');
  const [customName, setCustomName] = useState('');
  const [placeAddress, setPlaceAddress] = useState('');
  const [placeLat, setPlaceLat] = useState<number | null>(null);
  const [placeLng, setPlaceLng] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const modalInputRef = useRef<HTMLInputElement>(null);

  // Fetch places on mount
  useEffect(() => {
    if (user?.id) {
      fetchPlaces(user.id);
    }
  }, [user?.id, fetchPlaces]);

  // Auto-focus name input when modal opens
  useEffect(() => {
    if (showAddModal) {
      setTimeout(() => modalInputRef.current?.focus(), 300);
    }
  }, [showAddModal]);

  const handleSelectIcon = (icon: string, label: string) => {
    setSelectedIcon(icon);
    // Auto-fill name if user hasn't typed anything yet
    if (!customName.trim()) {
      setCustomName(label);
    }
  };

  const handleAddressChange = (val: string, _placeId?: string, lat?: number, lng?: number) => {
    setPlaceAddress(val);
    if (lat !== undefined && lng !== undefined) {
      setPlaceLat(lat);
      setPlaceLng(lng);
    } else {
      setPlaceLat(null);
      setPlaceLng(null);
    }
  };

  const handleSave = async () => {
    if (!user?.id) {
      toast.error('Debes iniciar sesion');
      return;
    }
    if (!customName.trim()) {
      toast.error('Escribe un nombre para el lugar');
      return;
    }
    if (!placeAddress.trim()) {
      toast.error('Busca y selecciona una direccion');
      return;
    }

    setIsSaving(true);
    try {
      const success = await addPlace(user.id, customName.trim(), placeAddress.trim(), selectedIcon, placeLat, placeLng);
      if (success) {
        toast.success('Lugar guardado');
        setShowAddModal(false);
        setCustomName('');
        setPlaceAddress('');
        setPlaceLat(null);
        setPlaceLng(null);
        setSelectedIcon('📍');
      } else {
        toast.error('No se pudo guardar el lugar. Intenta de nuevo.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (placeId: string, placeName: string) => {
    await deletePlace(placeId);
    toast.success(`"${placeName}" eliminado`);
  };

  const handlePlaceClick = (place: typeof places[0]) => {
    setPrefill(place.address, place.lat, place.lng, 'destination');
    router.push('/client/ride');
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setCustomName('');
    setPlaceAddress('');
    setPlaceLat(null);
    setPlaceLng(null);
    setSelectedIcon('📍');
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-400">Lugares Frecuentes</h2>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-400 text-xs font-medium hover:bg-cyan-500/20 transition-colors"
          >
            <Plus className="w-3 h-3" />
            Agregar
          </button>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
          </div>
        )}

        {/* Empty state */}
        {!isLoading && places.length === 0 && (
          <div className="glass rounded-xl p-4 text-center">
            <MapPin className="w-8 h-8 text-gray-600 mx-auto mb-2" />
            <p className="text-xs text-gray-500">No tienes lugares guardados</p>
            <p className="text-[10px] text-gray-600 mt-1">Toca &quot;Agregar&quot; para guardar tus lugares favoritos</p>
          </div>
        )}

        {/* Places list */}
        {!isLoading && places.length > 0 && (
          <div className="space-y-2">
            {places.map((place) => (
              <div key={place.id} className="relative group">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => handlePlaceClick(place)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handlePlaceClick(place); }}
                  className="w-full glass rounded-xl p-3 flex items-center gap-3 hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <span className="text-xl shrink-0">{place.icon}</span>
                  <div className="text-left flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{place.name}</p>
                    <p className="text-xs text-gray-500 truncate">{place.address}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Delete button — always visible on mobile */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(place.id, place.name);
                      }}
                      className="p-1.5 rounded-lg hover:bg-red-500/20 text-gray-600 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <ChevronRight className="w-4 h-4 text-gray-600" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Add Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-end justify-center z-[100] p-0"
            onClick={handleCloseModal}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="w-full max-w-md glass-strong rounded-t-3xl p-5 space-y-4 max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white">Nuevo Lugar Frecuente</h3>
                <button
                  onClick={handleCloseModal}
                  className="p-2 rounded-xl hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Name input */}
              <div>
                <label className="text-xs font-medium text-gray-400 mb-1.5 block">Nombre del lugar</label>
                <input
                  ref={modalInputRef}
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Ej: Casa de mama"
                  maxLength={50}
                  className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>

              {/* Icon selector */}
              <div>
                <label className="text-xs font-medium text-gray-400 mb-2 block">Elige un icono</label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_ICONS.map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => handleSelectIcon(preset.icon, preset.label)}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all ${
                        selectedIcon === preset.icon
                          ? 'bg-cyan-500/20 border-2 border-cyan-500/60 scale-110'
                          : 'bg-white/5 border border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {preset.icon}
                    </button>
                  ))}
                </div>
              </div>

              {/* Address search */}
              <div>
                <label className="text-xs font-medium text-gray-400 mb-1.5 block">Direccion</label>
                <PlacesAutocomplete
                  value={placeAddress}
                  onChange={handleAddressChange}
                  placeholder="Buscar direccion..."
                  dotColor=""
                />
              </div>

              {/* Save button */}
              <button
                onClick={handleSave}
                disabled={isSaving || !customName.trim() || !placeAddress.trim()}
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Guardar Lugar
                  </>
                )}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
