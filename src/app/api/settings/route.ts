import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthClient } from '@/lib/authClient';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('*');

    if (error) throw error;
    return NextResponse.json({ settings: data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { updates } = await request.json();

    const authHeader = request.headers.get('Authorization');
    if (!authHeader) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const db = getAuthClient(token);

    // Verify admin role
    const { data: profile } = await db
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Solo admin puede modificar configuracion' }, { status: 403 });
    }

    // Update each setting
    for (const [key, value] of Object.entries(updates)) {
      await db
        .from('settings')
        .update({ value: String(value) })
        .eq('key', key);
    }

    return NextResponse.json({ success: true, message: 'Configuracion actualizada' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
