'use client';

/**
 * NavigateButton — Boton para abrir ruta en Waze o Google Maps
 * 
 * Usa coordenadas reales del viaje para generar deep links.
 * Se integra en driver rides y client ride tracking.
 */

import { useState } from 'react';
import { ExternalLink, Navigation } from 'lucide-react';

interface NavigateButtonProps {
  destLat: number;
  destLng: number;
  destName?: string;
  originLat?: number;
  originLng?: number;
  originName?: string;
  compact?: boolean;
}

function openWaze(destLat: number, destLng: number, destName?: string) {
  const name = encodeURIComponent(destName || 'Destino RIDA');
  window.open(`https://waze.com/ul?ll=${destLat},${destLng}&navigate=yes&q=${name}&z=14`, '_blank');
}

function openGoogleMaps(originLat: number | undefined, originLng: number | undefined, destLat: number, destLng: number, destName?: string) {
  const dest = encodeURIComponent(destName || 'Destino RIDA');
  if (originLat && originLng) {
    window.open(`https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${destLat},${destLng}&destination_place_id=${dest}&travelmode=driving`, '_blank');
  } else {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}&destination_place_id=${dest}&travelmode=driving`, '_blank');
  }
}

export default function NavigateButton({
  destLat,
  destLng,
  destName,
  originLat,
  originLng,
  originName,
  compact = false,
}: NavigateButtonProps) {
  const [showOptions, setShowOptions] = useState(false);

  if (!destLat || !destLng) return null;

  if (compact) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowOptions(!showOptions)}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl font-medium transition-all text-sm"
        >
          <Navigation className="w-4 h-4" />
          Navegar
        </button>
        {showOptions && (
          <div className="absolute bottom-full right-0 mb-2 flex flex-col gap-1 bg-gray-900 border border-white/10 rounded-xl p-1.5 shadow-xl z-50 min-w-[180px]">
            <button
              type="button"
              onClick={() => { openWaze(destLat, destLng, destName); setShowOptions(false); }}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-white/10 text-sm text-white transition-colors text-left"
            >
              <ExternalLink className="w-4 h-4 text-cyan-400" />
              Abrir en Waze
            </button>
            <button
              type="button"
              onClick={() => { openGoogleMaps(originLat, originLng, destLat, destLng, destName); setShowOptions(false); }}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-white/10 text-sm text-white transition-colors text-left"
            >
              <ExternalLink className="w-4 h-4 text-blue-400" />
              Abrir en Google Maps
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Navegar al destino</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => openWaze(destLat, destLng, destName)}
          className="flex items-center gap-2 bg-[#00aaff] hover:bg-[#0088dd] text-white px-4 py-3 rounded-xl font-medium transition-all text-sm shadow-lg"
        >
          <Navigation className="w-4 h-4" />
          Waze
        </button>
        <button
          type="button"
          onClick={() => openGoogleMaps(originLat, originLng, destLat, destLng, destName)}
          className="flex items-center gap-2 bg-[#4285f4] hover:bg-[#3367d6] text-white px-4 py-3 rounded-xl font-medium transition-all text-sm shadow-lg"
        >
          <ExternalLink className="w-4 h-4" />
          Google Maps
        </button>
      </div>
      {originLat && originLng && originName && (
        <button
          type="button"
          onClick={() => openWaze(originLat, originLng, originName)}
          className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors mt-1"
        >
          Tambien navegar al punto de recogida ({originName})
        </button>
      )}
    </div>
  );
}
