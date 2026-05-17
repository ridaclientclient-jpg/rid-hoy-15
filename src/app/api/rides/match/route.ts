import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * POST /api/rides/match
 * Enhanced driver matching using RPC with ETA, destination mode, and rating scoring
 */
export async function POST(request: Request) {
  try {
    const { ride_id, radius_km } = await request.json();

    if (!ride_id) {
      return NextResponse.json({ error: 'ride_id es requerido' }, { status: 400 });
    }

    const radius = radius_km || 5;

    // Fetch ride details to get origin
    const { data: ride, error: rideFetchErr } = await supabase
      .from('rides')
      .select('rider_id, origin, destination, price, origin_lat, origin_lng')
      .eq('id', ride_id)
      .single();

    if (rideFetchErr || !ride) {
      return NextResponse.json({ success: false, message: 'Viaje no encontrado' }, { status: 404 });
    }

    // Call the new progressive matching RPC
    const { data: drivers, error: matchError } = await supabase.rpc('get_nearby_drivers_progressive', {
      p_lat: ride.origin_lat,
      p_lng: ride.origin_lng,
      p_radius_km: radius,
    });

    if (matchError) {
      console.error('[Match] RPC error:', matchError.message);
      return NextResponse.json({ success: false, message: 'Error al buscar conductores' }, { status: 500 });
    }

    if (!drivers || drivers.length === 0) {
      return NextResponse.json({ success: false, message: 'No se encontraron conductores en este radio' });
    }

    // Take the best driver (first in the list)
    const bestDriver = drivers[0];

    // Update ride with assigned driver
    const { error: updateError } = await supabase
      .from('rides')
      .update({
        driver_id: bestDriver.driver_id,
        status: 'assigned',
        assigned_at: new Date().toISOString(),
      })
      .eq('id', ride_id);

    if (updateError) {
      console.error('[Match] Update error:', updateError.message);
      return NextResponse.json({ success: false, message: 'Error al asignar conductor' }, { status: 500 });
    }

    // Update driver status
    await supabase.from('drivers').update({ status: 'busy' }).eq('id', bestDriver.driver_id);

    // Notifications
    try {
      // Notify the driver
      await supabase.from('notifications').insert({
        user_id: bestDriver.user_id,
        title: 'Nuevo viaje asignado',
        message: `Viaje de ${ride.origin} a ${ride.destination}. Precio: ₡${ride.price}`,
        type: 'ride',
        data: { ride_id, origin: ride.origin, destination: ride.destination, price: ride.price },
      });

      // Notify the rider
      await supabase.from('notifications').insert({
        user_id: ride.rider_id,
        title: 'Conductor encontrado',
        message: `${bestDriver.driver_name} esta en camino.`,
        type: 'ride',
        data: { ride_id },
      });
    } catch (notifyErr) {
      console.error('[Match] Notification error:', notifyErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Conductor asignado exitosamente',
      driver: {
        id: bestDriver.driver_id,
        name: bestDriver.driver_name,
        distance_km: bestDriver.distance_km,
        rating: bestDriver.rating,
        vehicle: bestDriver.vehicle_info,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al buscar conductor';
    console.error('[Match] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
