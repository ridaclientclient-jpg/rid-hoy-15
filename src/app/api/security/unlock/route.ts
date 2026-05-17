import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthClient } from '@/lib/authClient';

export async function POST(request: Request) {
  try {
    const { user_id } = await request.json();

    if (!user_id) {
      return NextResponse.json({ error: 'user_id requerido' }, { status: 400 });
    }

    // Verify requester is admin
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const db = getAuthClient(token);

    // Check admin role
    const { data: profile } = await db
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Solo administradores pueden desbloquear cuentas' }, { status: 403 });
    }

    // Reset account
    const { error } = await db
      .from('profiles')
      .update({
        login_attempts: 0,
        locked_until: null,
        is_active: true,
      })
      .eq('id', user_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log the unlock
    await db.from('security_logs').insert({
      user_id,
      event_type: 'account_unlocked',
      details: `Cuenta desbloqueada por admin ${user.id}`,
    });

    // Notify the user
    await db.from('notifications').insert({
      user_id,
      title: 'Cuenta desbloqueada',
      message: 'Tu cuenta ha sido desbloqueada por un administrador. Ya puedes iniciar sesion.',
      type: 'system',
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
