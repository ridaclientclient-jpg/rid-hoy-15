import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthClient } from '@/lib/authClient';

export async function POST(request: Request) {
  try {
    const { origin, destination, originLat, originLng, destLat, destLng, ride_type } = await request.json();

    if (!origin || !destination) {
      return NextResponse.json({ error: 'Origen y destino son requeridos' }, { status: 400 });
    }

    // Get current user from auth header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const db = getAuthClient(token);

    // Get pricing settings
    const { data: settings } = await db
      .from('settings')
      .select('key, value')
      .in('key', ['base_price', 'price_per_km', 'price_per_minute', 'surge_enabled']);

    const basePrice = Number(settings?.find(s => s.key === 'base_price')?.value || 1500);
    const pricePerKm = Number(settings?.find(s => s.key === 'price_per_km')?.value || 500);
    const pricePerMin = Number(settings?.find(s => s.key === 'price_per_minute')?.value || 50);
    const multiplier = Number(settings?.find(s => s.key === `price_multiplier_${ride_type || 'standard'}`)?.value || 1.0);

    // Calculate distance
    const distance = originLat && originLng && destLat && destLng
      ? calculateHaversine(originLat, originLng, destLat, destLng)
      : Math.random() * 15 + 3;

    const duration = Math.round(distance * 3);
    const rawPrice = basePrice + (distance * pricePerKm) + (duration * pricePerMin);
    const price = Math.round(Math.max(Number(settings?.find(s => s.key === 'min_fare')?.value || 1000), Math.min(Number(settings?.find(s => s.key === 'max_fare')?.value || 50000), rawPrice * multiplier)));

    // Calculate ETA
    const etaSpeed = Number(settings?.find(s => s.key === 'eta_speed_kmh')?.value || 30);
    const etaMinutes = Math.max(1, Math.round((distance / etaSpeed) * 60));

    // Create ride
    const { data: ride, error } = await db
      .from('rides')
      .insert({
        rider_id: user.id,
        status: 'searching',
        origin,
        origin_lat: originLat,
        origin_lng: originLng,
        destination,
        dest_lat: destLat,
        dest_lng: destLng,
        price,
        fare_estimate: price,
        distance: Math.round(distance * 10) / 10,
        duration,
        eta_minutes: etaMinutes,
        ride_type: ride_type || 'standard',
      })
      .select()
      .single();

    if (error) throw error;

    // Create notification for user
    await db.from('notifications').insert({
      user_id: user.id,
      title: 'Viaje creado',
      message: `Tu viaje de ${origin} a ${destination} ha sido creado. Buscando conductor...`,
      type: 'ride',
    });

    // Fire-and-forget: trigger server-side driver matching
    // This ensures the ride gets assigned even if client-side Realtime misses it
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || '';
    if (ride.id) {
      fetch(`${appUrl}/api/rides/match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ride_id: ride.id }),
      }).catch((matchErr) => {
        console.error('[Create Ride] Match fire-and-forget failed:', matchErr);
      });
    }

    return NextResponse.json({ success: true, ride });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al crear viaje';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function calculateHaversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
