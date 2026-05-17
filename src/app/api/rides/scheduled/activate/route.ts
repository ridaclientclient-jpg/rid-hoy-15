import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthClient } from '@/lib/authClient';

/**
 * POST /api/rides/scheduled/activate
 * Activates scheduled rides whose time has arrived
 * Can be called by a cron or manually
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

    // Verify is admin
    const { data: profile } = await db
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || (profile.role !== 'admin' && user.email !== 'kardellridclient@outlook.com')) {
      return NextResponse.json({ error: 'Solo administradores pueden activar viajes programados manualmente' }, { status: 403 });
    }

    // Activate scheduled rides
    const { data, error } = await db.rpc('activate_scheduled_rides');

    if (error) {
      console.error('[Activate Scheduled] RPC error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const result = Array.isArray(data) ? data[0] : data;

    // Also send reminders
    const { data: reminderData } = await db.rpc('send_schedule_reminders');
    const reminderResult = Array.isArray(reminderData) ? reminderData[0] : reminderData;

    return NextResponse.json({
      success: true,
      activated: result?.activated_count || 0,
      reminded: reminderResult?.reminded_count || 0,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al activar viajes programados';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
