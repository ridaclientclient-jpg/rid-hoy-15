import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * POST /api/rides/fare-estimate
 * Returns estimated price, distance, duration, and ETA before booking
 */
export async function POST(request: Request) {
  try {
    const { originLat, originLng, destLat, destLng, rideType } = await request.json();

    if (!originLat || !originLng || !destLat || !destLng) {
      return NextResponse.json({ error: 'Coordenadas requeridas' }, { status: 400 });
    }

    const { data, error } = await supabase.rpc('calculate_fare_estimate', {
      p_origin_lat: originLat,
      p_origin_lng: originLng,
      p_dest_lat: destLat,
      p_dest_lng: destLng,
      p_ride_type: rideType || 'standard',
    });

    if (error) {
      console.error('[FareEstimate] RPC error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const result = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({
      success: true,
      estimated_price: Number(result.estimated_price),
      estimated_distance: Number(result.estimated_distance),
      estimated_duration: Number(result.estimated_duration),
      eta_to_pickup: Number(result.eta_to_pickup),
      currency: 'CRC',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al calcular tarifa';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
