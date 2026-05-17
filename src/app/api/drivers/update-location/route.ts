import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthClient } from '@/lib/authClient';

/**
 * POST /api/drivers/update-location
 * Updates the driver's current GPS location.
 * Called periodically (every 10s) when driver is online.
 *
 * Body: { latitude: number, longitude: number }
 */
export async function POST(request: Request) {
  try {
    const { latitude, longitude } = await request.json();

    if (!latitude || !longitude) {
      return NextResponse.json({ error: 'Latitud y longitud son requeridas' }, { status: 400 });
    }

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return NextResponse.json({ error: 'Coordenadas invalidas' }, { status: 400 });
    }

    // Validate Costa Rica bounds (roughly)
    if (latitude < 7.5 || latitude > 11.5 || longitude < -87 || longitude > -82) {
      return NextResponse.json({ error: 'Coordenadas fuera del rango de Costa Rica' }, { status: 400 });
    }

    // Get auth
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

    // Update driver location (both PostGIS point and simple lat/lng columns)
    const updateData: Record<string, unknown> = {
      current_lat: latitude,
      current_lng: longitude,
      current_location: `SRID=4326;POINT(${longitude} ${latitude})`,
    };

    const { error } = await db
      .from('drivers')
      .update(updateData)
      .eq('user_id', user.id);

    if (error) {
      console.error('[UpdateLocation] Error:', error.message);
      return NextResponse.json({ error: 'Error al actualizar ubicacion' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al actualizar ubicacion';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
