import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthClient } from '@/lib/authClient';

export async function POST(request: Request) {
  try {
    const { ride_id, latitude, longitude } = await request.json();

    const authHeader = request.headers.get('Authorization');
    if (!authHeader) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const db = getAuthClient(token);

    // Create SOS event
    const { error } = await db.from('sos_events').insert({
      user_id: user.id,
      ride_id,
      latitude,
      longitude,
      status: 'active',
    });

    if (error) throw error;

    // Notify all admins (admin + super_admin)
    const { data: admins } = await db
      .from('profiles')
      .select('id')
      .in('role', ['admin', 'super_admin']);

    if (admins && admins.length > 0) {
      const notifications = admins.map(admin => ({
        user_id: admin.id,
        title: 'SOS ACTIVADO',
        message: `Usuario ${user.id} ha activado SOS. Lat: ${latitude}, Lng: ${longitude}`,
        type: 'sos' as const,
      }));
      await db.from('notifications').insert(notifications);
    }

    return NextResponse.json({ success: true, message: 'SOS activado, ayuda en camino' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
