import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthClient } from '@/lib/authClient';

export async function POST(request: Request) {
  try {
    const { ride_id } = await request.json();
    if (!ride_id)
      return NextResponse.json({ error: 'ride_id es requerido' }, { status: 400 });

    // Auth
    const authHeader = request.headers.get('Authorization');
    if (!authHeader)
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user)
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    // Authenticated client — carries user's JWT so RLS policies see auth.uid()
    const db = getAuthClient(token);

    // Get driver record
    const { data: driver } = await db
      .from('drivers')
      .select('id, status, is_verified, rating')
      .eq('user_id', user.id)
      .single();

    if (!driver)
      return NextResponse.json({ error: 'No tienes perfil de conductor' }, { status: 404 });
    if (!driver.is_verified)
      return NextResponse.json({ error: 'Tu cuenta no esta verificada. Sube tus documentos.' }, { status: 403 });
    if (driver.status === 'busy')
      return NextResponse.json({ error: 'Ya tienes un viaje activo' }, { status: 400 });
    if (driver.status === 'suspended')
      return NextResponse.json({ error: 'Tu cuenta esta suspendida' }, { status: 403 });

    // Check minimum rating
    const { data: minRatingSetting } = await db
      .from('settings')
      .select('value')
      .eq('key', 'driver_min_rating')
      .single();
    const minRating = Number(minRatingSetting?.value || 4.0);
    if (driver.rating > 0 && driver.rating < minRating)
      return NextResponse.json({ error: `Tu calificacion es muy baja (${driver.rating.toFixed(1)}). Minimo requerido: ${minRating}` }, { status: 400 });

    // Atomic: try to claim the ride (race condition safe)
    const { data: ride, error: rideError } = await db
      .from('rides')
      .update({
        driver_id: driver.id,
        status: 'assigned',
      })
      .eq('id', ride_id)
      .eq('status', 'searching')
      .select('*, profiles!rides_rider_id_fkey(name, phone)')
      .single();

    if (rideError) {
      console.error('[Accept Ride] DB error:', rideError.message);
      return NextResponse.json({ error: 'Error al aceptar viaje' }, { status: 500 });
    }

    if (!ride) {
      return NextResponse.json({
        success: false,
        message: 'El viaje ya no esta disponible. Otro conductor lo acepto o fue cancelado.',
      });
    }

    // Set driver to busy
    await db
      .from('drivers')
      .update({
        status: 'busy',
        accepted_rides: (driver.accepted_rides || 0) + 1,
      })
      .eq('id', driver.id);

    // Notify rider
    await db.from('notifications').insert({
      user_id: ride.rider_id,
      title: 'Conductor encontrado!',
      message: 'Un conductor ha aceptado tu viaje. Espera detalles...',
      type: 'ride',
      data: { ride_id: ride.id, status: 'assigned' },
    });

    // Notify driver
    await db.from('app_notifications').insert({
      user_id: user.id,
      title: 'Viaje aceptado',
      message: `Viaje de ${ride.origin} a ${ride.destination} - ₡${ride.price.toLocaleString()}`,
      type: 'ride',
      data: { ride_id: ride.id },
    });

    // Log activity
    try {
      await db.from('driver_activity_log').insert({
        driver_id: driver.id,
        user_id: user.id,
        action: 'ride_accepted',
        details: { ride_id: ride.id, origin: ride.origin, destination: ride.destination, price: ride.price },
      });
    } catch {}

    return NextResponse.json({
      success: true,
      ride: {
        id: ride.id,
        rider_id: ride.rider_id,
        rider_name: (ride as any).profiles?.name || 'Pasajero',
        rider_phone: (ride as any).profiles?.phone || '',
        origin: ride.origin,
        destination: ride.destination,
        origin_lat: ride.origin_lat,
        origin_lng: ride.origin_lng,
        dest_lat: ride.dest_lat,
        dest_lng: ride.dest_lng,
        price: ride.price,
        distance: ride.distance,
        duration: ride.duration,
        ride_type: ride.ride_type,
        payment_method: ride.payment_method,
        status: 'assigned',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al aceptar viaje';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
