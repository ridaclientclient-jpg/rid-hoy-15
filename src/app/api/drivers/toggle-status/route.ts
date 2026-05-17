import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthClient } from '@/lib/authClient';

export async function POST(request: Request) {
  try {
    const { status, latitude, longitude } = await request.json();

    const authHeader = request.headers.get('Authorization');
    if (!authHeader) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const db = getAuthClient(token);

    // Check work hours constraint
    if (status === 'online') {
      const { data: driver } = await db
        .from('drivers')
        .select('work_hours_today, is_on_break')
        .eq('user_id', user.id)
        .single();

      if (driver && driver.work_hours_today >= 12) {
        return NextResponse.json({
          error: 'Has alcanzado el maximo de 12 horas de trabajo. Descansa al menos 6 horas.'
        }, { status: 400 });
      }
    }

    const updateData: Record<string, unknown> = { status, last_online_at: new Date().toISOString() };

    if (latitude && longitude) {
      updateData.current_location = `SRID=4326;POINT(${longitude} ${latitude})`;
    }

    const { error } = await db
      .from('drivers')
      .update(updateData)
      .eq('user_id', user.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
