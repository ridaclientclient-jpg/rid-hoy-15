'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { loadGoogleMaps } from '@/lib/googleMaps';
import { MapPin, Crosshair, Navigation } from 'lucide-react';

interface MarkerData {
  lat: number;
  lng: number;
  label?: string;
  icon?: string;
  color?: string;
  animation?: 'BOUNCE' | 'DROP';
}

export interface DraggablePinData {
  position: { lat: number; lng: number };
  color: string;         // e.g. '#10b981' for origin, '#ef4444' for destination
  label?: string;       // e.g. 'A' or 'B'
  title?: string;       // tooltip shown on hover
}

interface GoogleMapProps {
  center?: { lat: number; lng: number };
  zoom?: number;
  markers?: MarkerData[];
  onMapClick?: (lat: number, lng: number) => void;
  onMapLoaded?: (map: google.maps.Map) => void;
  onUserLocation?: (location: { lat: number; lng: number } | null) => void;
  showRoute?: { origin: { lat: number; lng: number }; destination: { lat: number; lng: number } };
  waypoints?: { lat: number; lng: number }[];
  showDirections?: boolean;
  className?: string;
  style?: React.CSSProperties;
  showUserLocation?: boolean;
  height?: string;
  /** Draggable precision pin */
  draggablePin?: DraggablePinData | null;
  onDragPinEnd?: (lat: number, lng: number) => void;
}

const CR_CENTER = { lat: 9.7489, lng: -83.7534 };

export default function GoogleMap({
  center = CR_CENTER,
  zoom = 14,
  markers = [],
  onMapClick,
  onMapLoaded,
  onUserLocation,
  showRoute,
  waypoints = [],
  showDirections = false,
  className = '',
  style = {},
  showUserLocation = true,
  height = '100%',
  draggablePin = null,
  onDragPinEnd,
}: GoogleMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const userMarkerRef = useRef<google.maps.Marker | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const hasCenteredOnUserRef = useRef(false);
  const gpsResolvedRef = useRef(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<'searching' | 'found' | 'denied' | 'unavailable'>('searching');
  const draggableMarkerRef = useRef<google.maps.Marker | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const addUserMarker = useCallback((map: google.maps.Map, position: { lat: number; lng: number }) => {
    if (userMarkerRef.current) {
      userMarkerRef.current.setPosition(position);
      return;
    }
    const m = new google.maps.Marker({
      map,
      position,
      title: 'Tu ubicacion',
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: '#06b6d4',
        fillOpacity: 1,
        strokeColor: '#fff',
        strokeWeight: 3,
        scale: 12,
      },
      zIndex: 1000,
    });
    userMarkerRef.current = m;
  }, []);

  // Get user position — uses getCurrentPosition first for instant result, then watchPosition for live updates
  const getUserPosition = useCallback((map: google.maps.Map) => {
    if (!navigator.geolocation) {
      setLocationStatus('unavailable');
      return;
    }

    setLocationStatus('searching');
    gpsResolvedRef.current = false;

    const onGPSSuccess = (lat: number, lng: number) => {
      const userPos = { lat, lng };
      setUserLocation(userPos);
      setLocationStatus('found');
      gpsResolvedRef.current = true;
      // Notify parent of user location
      if (onUserLocation) onUserLocation(userPos);

      // Center map on user location (only first time)
      if (!hasCenteredOnUserRef.current) {
        hasCenteredOnUserRef.current = true;
        map.panTo(userPos);
        // Small delay then zoom in for a smooth feel
        setTimeout(() => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.setZoom(showUserLocation ? 16 : zoom);
          }
        }, 300);
      }

      addUserMarker(map, userPos);
    };

    const onGPSError = (error: GeolocationPositionError) => {
      console.warn('Geolocation error:', error.message, 'code:', error.code);

      // Only update status if GPS hasn't resolved yet from another call
      if (gpsResolvedRef.current) return;

      if (error.code === 1) {
        // PERMISSION_DENIED
        setLocationStatus('denied');
      } else {
        // TIMEOUT or POSITION_UNAVAILABLE — try again with relaxed options
        navigator.geolocation.getCurrentPosition(
          (retryPos) => {
            onGPSSuccess(retryPos.coords.latitude, retryPos.coords.longitude);
          },
          (retryError) => {
            console.warn('Geolocation retry failed:', retryError.message);
            setLocationStatus('unavailable');
            // Fallback: use the provided center prop
            map.setCenter(center);
            map.setZoom(zoom);
          },
          {
            enableHighAccuracy: false, // relaxed
            timeout: 20000,
            maximumAge: 120000, // accept up to 2min cached
          }
        );
      }
    };

    // STEP 1: Get current position IMMEDIATELY (one-shot) — high accuracy first
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onGPSSuccess(position.coords.latitude, position.coords.longitude);
      },
      onGPSError,
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000, // accept up to 1min cached for faster load
      }
    );

    // STEP 2: Watch for live position updates (for continuous tracking)
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const pos = { lat, lng };
        setUserLocation(pos);
        // Notify parent of user location update
        if (onUserLocation) onUserLocation(pos);

        if (!gpsResolvedRef.current) {
          // watchPosition resolved before getCurrentPosition
          onGPSSuccess(lat, lng);
        } else {
          // Already centered — just update marker, don't recenter
          setLocationStatus('found');
          addUserMarker(map, pos);
        }
      },
      (error) => {
        // Only update status if GPS hasn't resolved from getCurrentPosition
        if (!gpsResolvedRef.current) {
          if (error.code === 1) setLocationStatus('denied');
          else setLocationStatus('unavailable');
        }
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 }
    );
  }, [addUserMarker, center, zoom, showUserLocation, onUserLocation]);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current) return;

    // Cleanup previous watch
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    hasCenteredOnUserRef.current = false;
    gpsResolvedRef.current = false;

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

        // Start with CR center as placeholder — will move to user location once GPS resolves
        const map = new google.maps.Map(mapRef.current, {
          center: CR_CENTER,
          zoom: 12,
          styles: darkMapStyle,
          disableDefaultUI: true,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: 'greedy',
        });

        mapInstanceRef.current = map;
        setIsLoaded(true);

        // Get user location and center map
        if (showUserLocation) {
          getUserPosition(map);
        } else {
          // No user tracking — use provided center
          map.setCenter(center);
          map.setZoom(zoom);
        }

        // Map click handler
        if (onMapClick) {
          map.addListener('click', (e: google.maps.MapMouseEvent) => {
            if (e.latLng) {
              onMapClick(e.latLng.lat(), e.latLng.lng());
            }
          });
        }

        if (onMapLoaded) onMapLoaded(map);
      })
      .catch((err) => {
        console.error('Google Maps load error:', err);
        setHasError(true);
        setErrorMsg(err?.message || 'Error desconocido');
      });

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (directionsRendererRef.current) {
        directionsRendererRef.current.setMap(null);
      }
      if (userMarkerRef.current) {
        userMarkerRef.current.setMap(null);
        userMarkerRef.current = null;
      }
      if (draggableMarkerRef.current) {
        draggableMarkerRef.current.setMap(null);
        draggableMarkerRef.current = null;
      }
      markersRef.current.forEach(m => m.setMap(null));
      markersRef.current = [];
      if (mapInstanceRef.current) {
        mapInstanceRef.current = null;
      }
      // Notify parent that location is no longer available
      if (onUserLocation) onUserLocation(null);
      setUserLocation(null);
      setLocationStatus('searching');
      hasCenteredOnUserRef.current = false;
      gpsResolvedRef.current = false;
    };
  }, []);

  // Update markers
  useEffect(() => {
    if (!mapInstanceRef.current || !isLoaded) return;

    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    loadGoogleMaps().then((google) => {
      markers.forEach((markerData) => {
        const m = new google.maps.Marker({
          map: mapInstanceRef.current!,
          position: { lat: markerData.lat, lng: markerData.lng },
          title: markerData.label,
          icon: {
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            fillColor: markerData.color || '#06b6d4',
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 2,
            scale: 6,
            rotation: 0,
          },
          label: markerData.label || undefined,
          labelClass: 'text-white text-xs font-bold',
        });
        markersRef.current.push(m);
      });
    });
  }, [markers, isLoaded]);

  // Stable key for route
  const routeKey = useMemo(() => {
    if (!showRoute) return '';
    return `${showRoute.origin.lat},${showRoute.origin.lng}-${showRoute.destination.lat},${showRoute.destination.lng}-${JSON.stringify(waypoints)}`;
  }, [showRoute, waypoints]);

  // Show directions
  useEffect(() => {
    if (directionsRendererRef.current) {
      directionsRendererRef.current.setMap(null);
      directionsRendererRef.current = null;
    }

    if (!mapInstanceRef.current || !showRoute || !showDirections || !isLoaded || !routeKey) return;

    // Validate coordinates before requesting directions
    const { origin, destination } = showRoute;
    if (!origin?.lat || !origin?.lng || !destination?.lat || !destination?.lng) return;
    if (origin.lat === 0 && origin.lng === 0) return;
    if (destination.lat === 0 && destination.lng === 0) return;
    // Skip if origin and destination are essentially the same point
    if (Math.abs(origin.lat - destination.lat) < 0.0001 && Math.abs(origin.lng - destination.lng) < 0.0001) return;

    loadGoogleMaps().then((google) => {
      if (!mapInstanceRef.current) return;
      const directionsService = new google.maps.DirectionsService();
      const directionsRenderer = new google.maps.DirectionsRenderer({
        map: mapInstanceRef.current,
        polylineOptions: {
          strokeColor: '#06b6d4',
          strokeWeight: 4,
          strokeOpacity: 0.8,
        },
        suppressMarkers: false,
        markerOptions: {
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: '#06b6d4',
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 2,
            scale: 6,
          },
        },
      });

      directionsRendererRef.current = directionsRenderer;

      // Retry logic for transient errors (max 2 retries, 1.5s delay)
      const requestDirections = (attempt: number = 0) => {
        directionsService.route(
          {
            origin,
            destination,
            waypoints: waypoints.map(wp => ({ location: wp, stopover: true })),
            optimizeWaypoints: false,
            travelMode: google.maps.TravelMode.DRIVING,
          },
          (result, status) => {
            if (status === 'OK' && result) {
              directionsRenderer.setDirections(result);
            } else if (status === 'UNKNOWN_ERROR' && attempt < 2) {
              // Retry on transient Google server error
              setTimeout(() => requestDirections(attempt + 1), 1500);
            } else if (status !== 'OK' && directionsRendererRef.current) {
              directionsRendererRef.current.setMap(null);
              directionsRendererRef.current = null;
              if (status !== 'ZERO_RESULTS' && status !== 'NOT_FOUND') {
                console.warn(`[Directions API] Error: ${status} — origin:`, origin, 'destination:', destination);
              }
            }
          }
        );
      };

      requestDirections();
    });

    return () => {
      if (directionsRendererRef.current) {
        directionsRendererRef.current.setMap(null);
        directionsRendererRef.current = null;
      }
    };
  }, [routeKey, showRoute, showDirections, waypoints, isLoaded]);

  // ─── Draggable Precision Pin ─────────────────────────────────
  useEffect(() => {
    if (!mapInstanceRef.current || !isLoaded) return;

    // Remove existing draggable marker
    if (draggableMarkerRef.current) {
      draggableMarkerRef.current.setMap(null);
      draggableMarkerRef.current = null;
    }

    // If no draggable pin data, nothing to do
    if (!draggablePin?.position) return;

    loadGoogleMaps().then(() => {
      if (!mapInstanceRef.current || !draggablePin?.position) return;

      const pinColor = draggablePin.color || '#06b6d4';
      const pinLabel = draggablePin.label || '';
      const pinTitle = draggablePin.title || 'Arrastra para ajustar la posicion';

      // Build a custom SVG push-pin icon (alfiler) — small circle head + thin point
      const svgPin = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="32" viewBox="0 0 22 32">
        <defs>
          <filter id="s" x="-30%" y="-20%" width="160%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-color="#000" flood-opacity="0.35"/>
          </filter>
        </defs>
        <circle cx="11" cy="8" r="7" fill="${pinColor}" stroke="#fff" stroke-width="1.8" filter="url(#s)"/>
        <circle cx="11" cy="8" r="4" fill="#fff" opacity="0.92"/>
        ${pinLabel ? `<text x="11" y="11.5" text-anchor="middle" font-size="7" font-weight="bold" fill="${pinColor}">${pinLabel}</text>` : ''}
        <path d="M11 15 L8 30 L11 27 L14 30 Z" fill="${pinColor}"/>
      </svg>`;

      const marker = new google.maps.Marker({
        map: mapInstanceRef.current,
        position: draggablePin.position,
        title: pinTitle,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svgPin),
          scaledSize: new google.maps.Size(22, 32),
          anchor: new google.maps.Point(11, 30),
        },
        draggable: true,
        zIndex: 2000,
        animation: google.maps.Animation.DROP,
      });

      // Center map on pin when placed
      mapInstanceRef.current.panTo(draggablePin.position);
      mapInstanceRef.current.setZoom(17);

      // Handle drag events
      marker.addListener('dragstart', () => {
        setIsDragging(true);
      });

      marker.addListener('drag', () => {
        // Live feedback — could update label here if needed
      });

      marker.addListener('dragend', () => {
        setIsDragging(false);
        const pos = marker.getPosition();
        if (pos && onDragPinEnd) {
          onDragPinEnd(pos.lat(), pos.lng());
        }
      });

      draggableMarkerRef.current = marker;
    });

    return () => {
      if (draggableMarkerRef.current) {
        draggableMarkerRef.current.setMap(null);
        draggableMarkerRef.current = null;
      }
      setIsDragging(false);
    };
  }, [draggablePin?.position?.lat, draggablePin?.position?.lng, draggablePin?.color, draggablePin?.label, isLoaded, onDragPinEnd]);

  // Re-center on user location
  const handleRecenter = useCallback(() => {
    if (!mapInstanceRef.current || !userLocation) return;
    mapInstanceRef.current.panTo(userLocation);
    mapInstanceRef.current.setZoom(16);
  }, [userLocation]);

  // Error fallback — show map placeholder with error info
  if (hasError) {
    return (
      <div
        className={`w-full h-full flex items-center justify-center bg-gradient-to-b from-blue-900/20 to-rida-dark ${className}`}
        style={{ height, borderRadius: '16px', overflow: 'hidden', ...style }}
      >
        <div className="text-center p-4">
          <div className="w-20 h-20 rounded-full bg-cyan-500/10 flex items-center justify-center mx-auto mb-3 animate-pulse-glow">
            <MapPin className="w-10 h-10 text-cyan-400" />
          </div>
          <p className="text-sm text-gray-400">Cargando mapa...</p>
          <p className="text-xs text-gray-600 mt-1">Costa Rica</p>
          <button
            onClick={() => { setHasError(false); setErrorMsg(''); window.location.reload(); }}
            className="mt-3 text-[10px] text-cyan-400/70 hover:text-cyan-400 underline"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full">
      <div
        ref={mapRef}
        className={`w-full h-full ${className}`}
        style={{ height, borderRadius: '16px', overflow: 'hidden', ...style }}
      />

      {/* Location status indicator */}
      {showUserLocation && (
        <div className="absolute top-3 left-3 z-10">
          {locationStatus === 'searching' && (
            <div className="glass-strong rounded-lg px-3 py-1.5 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-[10px] text-gray-300">Obteniendo ubicacion...</span>
            </div>
          )}
          {locationStatus === 'found' && userLocation && (
            <div className="glass-strong rounded-lg px-3 py-1.5 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-400" />
              <span className="text-[10px] text-emerald-400">
                {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
              </span>
            </div>
          )}
          {locationStatus === 'denied' && (
            <div className="glass-strong rounded-lg px-3 py-1.5 flex items-center gap-2 border border-red-500/30">
              <Crosshair className="w-3 h-3 text-red-400" />
              <span className="text-[10px] text-red-400">GPS denegado - Habilita ubicacion</span>
            </div>
          )}
          {locationStatus === 'unavailable' && (
            <div className="glass-strong rounded-lg px-3 py-1.5 flex items-center gap-2 border border-amber-500/30">
              <Navigation className="w-3 h-3 text-amber-400" />
              <span className="text-[10px] text-amber-400">GPS no disponible</span>
            </div>
          )}
        </div>
      )}

      {/* Re-center button — only show when location found */}
      {showUserLocation && locationStatus === 'found' && userLocation && !draggablePin && (
        <button
          onClick={handleRecenter}
          className="absolute bottom-3 right-3 z-10 glass-strong rounded-xl p-2.5 text-gray-400 hover:text-cyan-400 transition-colors"
          title="Mi ubicacion"
        >
          <Crosshair className="w-5 h-5" />
        </button>
      )}

      {/* Draggable Pin Mode Banner */}
      {draggablePin && (
        <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-center pointer-events-none">
          <div className="glass-strong rounded-xl px-4 py-2 flex items-center gap-2 border border-cyan-500/30 pointer-events-auto">
            <div className={`w-3 h-3 rounded-full ${isDragging ? 'bg-amber-400 animate-pulse' : 'bg-cyan-400'} ${!isDragging ? 'animate-bounce' : ''}`} />
            <span className="text-[11px] text-white font-medium">
              {isDragging ? 'Suelta el pin en la posicion exacta...' : 'Arrastra el pin para ajustar la ubicacion'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
