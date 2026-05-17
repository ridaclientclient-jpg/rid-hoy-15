import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthClient } from '@/lib/authClient';

/**
 * POST /api/push/register
 * Registra una suscripcion push del navegador
 */
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
    const { endpoint, keys } = body;

    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
      return NextResponse.json(
        { error: 'Suscripcion push invalida: se requiere endpoint, keys.p256dh y keys.auth' },
        { status: 400 }
      );
    }

    // Registrar via RPC (SECURITY DEFINER)
    const { data: subId, error } = await db.rpc('register_push_subscription', {
      p_endpoint: endpoint,
      p_p256dh_key: keys.p256dh,
      p_auth_key: keys.auth,
      p_user_agent: request.headers.get('user-agent') || null,
    });

    if (error) {
      console.error('[PushRegister] RPC error:', error.message);
      return NextResponse.json({ error: 'Error al registrar suscripcion' }, { status: 500 });
    }

    return NextResponse.json({ success: true, subscription_id: subId });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al registrar';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/push/register
 * Elimina una suscripcion push
 */
export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { endpoint } = body;

    if (!endpoint) {
      return NextResponse.json({ error: 'Endpoint requerido' }, { status: 400 });
    }

    const { error } = await supabase.rpc('unregister_push_subscription', {
      p_endpoint: endpoint,
    });

    if (error) {
      return NextResponse.json({ error: 'Error al eliminar suscripcion' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
