import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * GET /api/fares/location-wise?source_id=&destination_id=&vehicle_type_id=
 * Returns the flat fare for a specific route (source → destination + vehicle type).
 * If no fare exists, returns { fare: null } so the app uses the normal calculation.
 *
 * This is called by the client app when creating a ride to check if a
 * location-wise flat fare applies to the route.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sourceId = searchParams.get('source_id');
    const destinationId = searchParams.get('destination_id');
    const vehicleTypeId = searchParams.get('vehicle_type_id');

    if (!sourceId || !destinationId) {
      return NextResponse.json(
        { error: 'source_id y destination_id son requeridos' },
        { status: 400 }
      );
    }

    // Try exact match first (source → dest with vehicle type)
    const { data, error } = await supabase.rpc('get_location_wise_fare', {
      p_source_place_id: sourceId,
      p_dest_place_id: destinationId,
      p_vehicle_type_id: vehicleTypeId || null,
    });

    if (error) {
      console.error('[LocationFare] RPC error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // The RPC returns a table; null/empty means no fare configured
    const result = Array.isArray(data) && data.length > 0 ? data[0] : null;

    return NextResponse.json({
      success: true,
      fare: result ? {
        fare_id: result.fare_id,
        source_name: result.source_name,
        destination_name: result.destination_name,
        vehicle_type_name: result.vehicle_type_name,
        flat_fare: Number(result.flat_fare),
        currency: 'CRC',
      } : null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al consultar tarifa';
    console.error('[LocationFare] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
