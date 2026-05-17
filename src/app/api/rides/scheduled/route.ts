import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthClient } from '@/lib/authClient';

/**
 * GET /api/rides/scheduled — List user's scheduled rides
 * POST /api/rides/scheduled — Cancel or reschedule a scheduled ride
 */
export async function GET(request: Request) {
  try {
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

    const { data, error } = await db.rpc('list_user_scheduled_rides', {
      p_user_id: user.id,
    });

    if (error) {
      console.error('[Scheduled] RPC error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, rides: data || [] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al obtener viajes programados';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
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
    const { action, ride_id, reason, new_scheduled_at } = body;

    if (!ride_id) {
      return NextResponse.json({ error: 'ride_id es requerido' }, { status: 400 });
    }

    if (action === 'cancel') {
      const { data, error } = await db.rpc('cancel_scheduled_ride', {
        p_ride_id: ride_id,
        p_reason: reason || null,
      });

      if (error) {
        console.error('[Scheduled] Cancel error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const result = Array.isArray(data) ? data[0] : data;
      return NextResponse.json({
        success: result.success,
        message: result.message,
      });
    }

    if (action === 'reschedule') {
      if (!new_scheduled_at) {
        return NextResponse.json({ error: 'new_scheduled_at es requerido para reprogramar' }, { status: 400 });
      }

      const { data, error } = await db.rpc('reschedule_ride', {
        p_ride_id: ride_id,
        p_new_scheduled_at: new_scheduled_at,
      });

      if (error) {
        console.error('[Scheduled] Reschedule error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const result = Array.isArray(data) ? data[0] : data;
      return NextResponse.json({
        success: result.success,
        message: result.message,
      });
    }

    return NextResponse.json({ error: 'Accion no valida. Usa: cancel o reschedule' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al procesar solicitud';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
