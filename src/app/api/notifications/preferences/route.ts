import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthClient } from '@/lib/authClient';

/**
 * GET /api/notifications/preferences
 * Obtiene las preferencias de notificaciones del usuario
 */
export async function GET() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const db = getAuthClient(session.access_token);

    const { data, error } = await db.rpc('get_notification_preferences', {
      p_user_id: session.user.id,
    });

    if (error) throw error;
    return NextResponse.json({ preferences: data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PUT /api/notifications/preferences
 * Actualiza las preferencias de notificaciones del usuario
 */
export async function PUT(request: Request) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const db = getAuthClient(session.access_token);

    const body = await request.json();
    const { data, error } = await db.rpc('update_notification_preferences', {
      p_user_id: session.user.id,
      p_ride: body.ride,
      p_payment: body.payment,
      p_promo: body.promo,
      p_system: body.system,
      p_sos: body.sos,
      p_sound: body.sound,
    });

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
