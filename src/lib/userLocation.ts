// Shared geolocation utility for all apps
// Default center: Costa Rica (San Jose area)

export interface UserLocation {
  lat: number;
  lng: number;
  accuracy?: number;
  source: 'gps' | 'ip' | 'default';
}

const CR_CENTER: UserLocation = { lat: 9.9281, lng: -84.0907, source: 'default' };

// Cache the location so we don't re-fetch on every component mount
let cachedLocation: UserLocation | null = null;
let locationPromise: Promise<UserLocation> | null = null;

/**
 * Get the user's current location using:
 * 1. Browser Geolocation API (GPS)
 * 2. Fallback to IP-based geolocation
 * 3. Fallback to CR_CENTER default
 */
export function getUserLocation(options?: { timeout?: number }): Promise<UserLocation> {
  // Return cached location if available
  if (cachedLocation) return Promise.resolve(cachedLocation);

  // Return existing promise if already fetching
  if (locationPromise) return locationPromise;

  locationPromise = _fetchLocation(options || { timeout: 8000 }).then((loc) => {
    cachedLocation = loc;
    return loc;
  });

  return locationPromise;
}

async function _fetchLocation(options: { timeout: number }): Promise<UserLocation> {
  // 1. Try Browser Geolocation API
  if (typeof navigator !== 'undefined' && navigator.geolocation) {
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: options.timeout,
          maximumAge: 60000, // Use cache up to 1 minute
        });
      });

      return {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        source: 'gps',
      };
    } catch (err) {
      console.warn('Geolocation API failed, trying IP fallback:', err);
    }
  }

  // 2. Try IP-based geolocation (free, no API key needed)
  try {
    const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      if (data.latitude && data.longitude) {
        return {
          lat: data.latitude,
          lng: data.longitude,
          source: 'ip',
        };
      }
    }
  } catch {
    console.warn('IP geolocation failed, using default');
  }

  // 3. Fallback to CR_CENTER
  return { ...CR_CENTER };
}

/**
 * Get cached location synchronously (may be default if not yet fetched)
 */
export function getCachedLocation(): UserLocation {
  return cachedLocation || CR_CENTER;
}

/**
 * Clear cached location (e.g., after logout)
 */
export function clearLocationCache(): void {
  cachedLocation = null;
  locationPromise = null;
}

export { CR_CENTER };
