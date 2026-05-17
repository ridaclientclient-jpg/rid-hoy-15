// Google Maps API — using direct script injection (no Loader class)
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || '';

let loadPromise: Promise<typeof google> | null = null;

export async function loadGoogleMaps(): Promise<typeof google> {
  // If already loaded globally, resolve immediately
  if (typeof window !== 'undefined' && (window as any).google?.maps?.places) {
    return (window as any).google;
  }

  // If currently loading, wait for existing promise
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    if (!API_KEY) {
      console.error('Google Maps API key not configured (NEXT_PUBLIC_GOOGLE_MAPS_KEY)');
      reject(new Error('Google Maps API key not configured'));
      return;
    }

    // Remove any existing Google Maps script to prevent duplicates
    const existing = document.querySelector('script[src*="maps.googleapis.com/maps"]');
    if (existing) existing.remove();

    const script = document.createElement('script');
    // Only load libraries we use: places (autocomplete), geometry (distance calc)
    // No 'marker' library — we use classic google.maps.Marker
    script.id = 'google-maps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places,geometry,visualization`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      // Small delay to ensure the API is fully initialized
      setTimeout(() => {
        if ((window as any).google?.maps?.places) {
          resolve((window as any).google);
        } else {
          loadPromise = null; // Allow retry
          reject(new Error('Google Maps loaded but API not available'));
        }
      }, 200);
    };

    script.onerror = () => {
      loadPromise = null; // Allow retry
      console.error('Google Maps script failed to load');
      reject(new Error('Google Maps script failed to load'));
    };

    // Safety timeout
    setTimeout(() => {
      if (!(window as any).google?.maps?.places) {
        loadPromise = null; // Allow retry
        reject(new Error('Google Maps load timed out'));
      }
    }, 15000);

    document.head.appendChild(script);
  });

  try {
    return await loadPromise;
  } catch (err) {
    // Clear and retry once
    console.warn('Google Maps first attempt failed, retrying...', err);
    loadPromise = null;
    return (loadPromise = new Promise((resolve, reject) => {
      const existing = document.getElementById('google-maps-script');
      if (existing) existing.remove();

      const script = document.createElement('script');
      script.id = 'google-maps-script';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places,geometry,visualization`;
      script.async = true;
      script.defer = true;

      script.onload = () => {
        setTimeout(() => {
          if ((window as any).google?.maps?.places) {
            resolve((window as any).google);
          } else {
            reject(new Error('Google Maps retry failed'));
          }
        }, 200);
      };

      script.onerror = () => {
        reject(new Error('Google Maps retry failed'));
      };

      document.head.appendChild(script);
    }));
  }
}

export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number; formattedAddress: string } | null> {
  try {
    const google = await loadGoogleMaps();
    const geocoder = new google.maps.Geocoder();

    return new Promise((resolve) => {
      geocoder.geocode({ address, region: 'CR' }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          resolve({
            lat: results[0].geometry.location.lat(),
            lng: results[0].geometry.location.lng(),
            formattedAddress: results[0].formatted_address,
          });
        } else {
          resolve(null);
        }
      });
    });
  } catch (error) {
    console.error('Geocode error:', error);
    return null;
  }
}

export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const google = await loadGoogleMaps();
    const geocoder = new google.maps.Geocoder();

    return new Promise((resolve) => {
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          resolve(results[0].formatted_address);
        } else {
          resolve(null);
        }
      });
    });
  } catch (error) {
    console.error('Reverse geocode error:', error);
    return null;
  }
}

export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
