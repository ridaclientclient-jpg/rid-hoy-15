import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthClient } from '@/lib/authClient';

/**
 * POST /api/rides/share
 * Generates or returns a share token for a live ride
 */
export async function POST(request: Request) {
  try {
    const { ride_id } = await request.json();

    if (!ride_id) {
      return NextResponse.json({ error: 'ride_id es requerido' }, { status: 400 });
    }

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

    // Check user is rider or driver of this ride
    const { data: ride, error: rideError } = await db
      .from('rides')
      .select('id, rider_id, driver_id, share_token, status')
      .eq('id', ride_id)
      .single();

    if (rideError || !ride) {
      return NextResponse.json({ error: 'Viaje no encontrado' }, { status: 404 });
    }

    if (ride.rider_id !== user.id && ride.driver_id !== user.id) {
      return NextResponse.json({ error: 'No tienes permiso para compartir este viaje' }, { status: 403 });
    }

    if (!['assigned', 'arriving', 'started'].includes(ride.status)) {
      return NextResponse.json({ error: 'Solo puedes compartir viajes activos' }, { status: 400 });
    }

    let shareToken = ride.share_token;
    if (!shareToken) {
      const { data: tokenData, error: tokenError } = await db.rpc('generate_share_token', {
        p_ride_id: ride_id,
      });
      if (tokenError) {
        console.error('[ShareRide] RPC error:', tokenError.message);
        return NextResponse.json({ error: 'Error al generar enlace' }, { status: 500 });
      }
      shareToken = tokenData;
    }

    const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://rida.app'}/client/ride/${ride_id}?share=${shareToken}`;

    return NextResponse.json({
      success: true,
      share_token: shareToken,
      share_url: shareUrl,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al generar enlace';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
