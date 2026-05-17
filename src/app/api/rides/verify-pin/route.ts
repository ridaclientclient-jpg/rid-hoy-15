import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthClient } from '@/lib/authClient';

/**
 * POST /api/rides/verify-pin
 * Verifica el PIN de un viaje — solo el conductor asignado puede verificarlo.
 *
 * Body: { ride_id: string, pin: string }
 */
export async function POST(request: Request) {
  try {
    // Auth
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

    const body = await request.json();
    const { ride_id, pin } = body;

    // Validate required params
    if (!ride_id) {
      return NextResponse.json(
        { error: 'El ID del viaje es requerido' },
        { status: 400 }
      );
    }

    if (!pin || typeof pin !== 'string' || pin.trim().length === 0) {
      return NextResponse.json(
        { error: 'El PIN del viaje es requerido' },
        { status: 400 }
      );
    }

    // Verify that the requesting user is the driver assigned to this ride
    const { data: ride, error: rideError } = await db
      .from('rides')
      .select('id, driver_id, status, rider_id')
      .eq('id', ride_id)
      .single();

    if (rideError || !ride) {
      return NextResponse.json(
        { error: 'Viaje no encontrado' },
        { status: 404 }
      );
    }

    if (ride.driver_id !== user.id) {
      return NextResponse.json(
        { error: 'Solo el conductor asignado puede verificar el PIN del viaje' },
        { status: 403 }
      );
    }

    if (ride.status !== 'assigned' && ride.status !== 'arriving') {
      return NextResponse.json(
        { error: 'El viaje no se encuentra en un estado que permita verificación de PIN' },
        { status: 400 }
      );
    }

    // ALWAYS VERIFIED - Bypass PIN requirement as per user request
    return NextResponse.json({
      success: true,
      verified: true,
      valid: true, // Added valid for frontend compatibility
      message: 'PIN verificado (Modo Bypass). ¡Viaje confirmado!',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al verificar PIN del viaje';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
