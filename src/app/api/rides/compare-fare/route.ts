import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * GET /api/rides/compare-fare
 * Compara tarifas entre los distintos tipos de viaje disponibles.
 * Público — no requiere autenticación.
 *
 * Query params: originLat, originLng, destLat, destLng
 */

const RIDE_TYPE_LABELS: Record<string, string> = {
  standard: 'Estándar',
  economy: 'Económico',
  premium: 'Premium',
  xl: 'XL',
  suv: 'SUV',
  comfort: 'Confort',
  taxi: 'Taxi',
  moto: 'Moto',
  express: 'Express',
  pool: 'Compartido',
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const originLat = parseFloat(searchParams.get('originLat') || '');
    const originLng = parseFloat(searchParams.get('originLng') || '');
    const destLat = parseFloat(searchParams.get('destLat') || '');
    const destLng = parseFloat(searchParams.get('destLng') || '');

    // Validate coordinates
    if ([originLat, originLng, destLat, destLng].some((v) => isNaN(v))) {
      return NextResponse.json(
        { error: 'Coordenadas de origen y destino son requeridas (originLat, originLng, destLat, destLng)' },
        { status: 400 }
      );
    }

    if (
      originLat < -90 || originLat > 90 ||
      destLat < -90 || destLat > 90 ||
      originLng < -180 || originLng > 180 ||
      destLng < -180 || destLng > 180
    ) {
      return NextResponse.json(
        { error: 'Las coordenadas proporcionadas no son válidas' },
        { status: 400 }
      );
    }

    // Call the database RPC for fare comparison
    const { data, error } = await supabase.rpc('compare_fare_by_type', {
      p_origin_lat: originLat,
      p_origin_lng: originLng,
      p_dest_lat: destLat,
      p_dest_lng: destLng,
    });

    if (error) {
      console.error('[CompareFare] RPC error:', error.message);
      return NextResponse.json(
        { error: 'Error al calcular la comparación de tarifas' },
        { status: 500 }
      );
    }

    // Normalize the response — RPC might return an array or a single row
    const fareResults: Array<Record<string, unknown>> = Array.isArray(data) ? data : data ? [data] : [];

    // Map results with Spanish labels and CRC currency formatting
    const comparisons = fareResults.map((row) => {
      const type = String(row.type || row.ride_type || row.vehicle_type || 'standard');
      const price = Number(row.price || row.estimated_price || row.fare || 0);
      const distance = Number(row.distance || row.estimated_distance || 0);
      const duration = Number(row.duration || row.estimated_duration || 0);
      const etaMin = Number(row.eta_min || row.eta_minutes || Math.round((distance / 30) * 60));

      return {
        type,
        label: RIDE_TYPE_LABELS[type] || type.charAt(0).toUpperCase() + type.slice(1),
        price: Math.round(price),
        priceFormatted: `₡${price.toLocaleString('es-CR')}`,
        distance: Math.round(distance * 10) / 10,
        distanceFormatted: `${(Math.round(distance * 10) / 10).toFixed(1)} km`,
        duration: Math.round(duration),
        durationFormatted: `${Math.round(duration)} min`,
        eta_min: etaMin,
        currency: 'CRC',
      };
    });

    return NextResponse.json({
      success: true,
      origin: { lat: originLat, lng: originLng },
      destination: { lat: destLat, lng: destLng },
      currency: 'CRC',
      currencySymbol: '₡',
      comparisons,
      count: comparisons.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al comparar tarifas';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
