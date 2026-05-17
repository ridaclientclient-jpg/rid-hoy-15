import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthClient } from '@/lib/authClient';

export async function POST(request: Request) {
  try {
    const { ride_id, type, description, images } = await request.json();

    if (!type || !description) {
      return NextResponse.json({ error: 'tipo y descripcion son requeridos' }, { status: 400 });
    }

    const validTypes = ['incident', 'fraud', 'complaint', 'driver_report', 'rider_report'];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: 'tipo de reporte invalido' }, { status: 400 });
    }

    if (description.length < 10) {
      return NextResponse.json({ error: 'La descripcion debe tener al menos 10 caracteres' }, { status: 400 });
    }

    if (description.length > 2000) {
      return NextResponse.json({ error: 'La descripcion no puede superar 2000 caracteres' }, { status: 400 });
    }

    // Auth
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const db = getAuthClient(token);

    // Insert report
    const { data: report, error } = await db
      .from('reports')
      .insert({
        user_id: user.id,
        ride_id: ride_id || null,
        type,
        description,
        images: images && images.length > 0 ? images : null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Notify admins
    const { data: admins } = await db
      .from('profiles')
      .select('id')
      .in('role', ['admin', 'super_admin']);

    if (admins && admins.length > 0) {
      const typeLabels: Record<string, string> = {
        incident: 'Incidente',
        fraud: 'Fraude',
        complaint: 'Queja',
        driver_report: 'Reporte de conductor',
        rider_report: 'Reporte de pasajero',
      };

      const notifs = admins.map(admin => ({
        user_id: admin.id,
        title: `Nuevo reporte: ${typeLabels[type] || type}`,
        message: `Un usuario ha enviado un reporte de tipo "${typeLabels[type] || type}". ID: ${report.id}`,
        type: 'warning' as const,
        data: { report_id: report.id, report_type: type },
      }));
      await db.from('notifications').insert(notifs);
    }

    return NextResponse.json({ success: true, report });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
