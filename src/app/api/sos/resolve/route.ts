import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthClient } from '@/lib/authClient';

export async function POST(request: Request) {
  try {
    const { sos_id } = await request.json();

    if (!sos_id) {
      return NextResponse.json({ error: 'sos_id requerido' }, { status: 400 });
    }

    // Verify admin
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const db = getAuthClient(token);

    const { data: admin } = await db
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!admin || (admin.role !== 'admin' && admin.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Solo administradores' }, { status: 403 });
    }

    // Resolve SOS
    const { error } = await db
      .from('sos_events')
      .update({
        status: 'resolved',
        resolved_by: user.id,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', sos_id)
      .eq('status', 'active');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Notify the user who triggered SOS
    const { data: sosEvent } = await db
      .from('sos_events')
      .select('user_id')
      .eq('id', sos_id)
      .single();

    if (sosEvent) {
      await db.from('notifications').insert({
        user_id: sosEvent.user_id,
        title: 'SOS Resuelto',
        message: 'Tu alerta de emergencia ha sido atendida por un administrador. Estas a salvo.',
        type: 'sos',
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
