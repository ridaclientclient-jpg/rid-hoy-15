import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthClient } from '@/lib/authClient';

/**
 * POST /api/rides/cancel
 * Cancels a ride with optional cancellation fee
 */
export async function POST(request: Request) {
  try {
    const { ride_id, reason } = await request.json();

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

    const { data, error } = await db.rpc('cancel_ride_with_fee', {
      p_ride_id: ride_id,
      p_cancelled_by: user.id,
      p_reason: reason || null,
    });

    if (error) {
      console.error('[CancelRide] RPC error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const result = Array.isArray(data) ? data[0] : data;

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    // Notify the other party
    if (result.success) {
      const { data: ride } = await db
        .from('rides')
        .select('rider_id, driver_id')
        .eq('id', ride_id)
        .single();

      if (ride) {
        const notifyUserId = user.id === ride.rider_id ? ride.driver_id : ride.rider_id;
        if (notifyUserId) {
          await db.from('notifications').insert({
            user_id: notifyUserId,
            title: 'Viaje cancelado',
            message: reason
              ? `El viaje ha sido cancelado. Razon: ${reason}`
              : 'El viaje ha sido cancelado',
            type: 'ride',
            data: { ride_id, reason },
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      fee_applied: Number(result.fee_applied),
      message: result.message,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al cancelar viaje';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
