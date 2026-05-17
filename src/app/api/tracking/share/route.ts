import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * GET /api/tracking/share?token=TOKEN
 * Public endpoint to get share data and latest tracking point.
 * No auth required — anyone with the link can see the location.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Token requerido' }, { status: 400 });
  }

  try {
    const { data, error } = await supabase.rpc('get_share_data', { p_token: token });

    if (error) {
      console.error('get_share_data error:', error);
      return NextResponse.json({ error: 'Error al obtener datos' }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Enlace expirado o no valido', expired: true }, { status: 404 });
    }

    const share = data[0];

    return NextResponse.json({
      share_id: share.share_id,
      ride_id: share.ride_id,
      rider_name: share.rider_name,
      driver_name: share.driver_name,
      driver_phone: share.driver_phone,
      vehicle_info: share.vehicle_info,
      origin: share.origin,
      destination: share.destination,
      status: share.share_status,
      location: share.latest_lat && share.latest_lng ? {
        lat: share.latest_lat,
        lng: share.latest_lng,
        speed: share.latest_speed,
        heading: share.latest_heading,
        recorded_at: share.latest_recorded,
      } : null,
      total_points: share.total_points,
      expires_at: share.share_expires_at,
    });
  } catch (err) {
    console.error('Tracking share error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
