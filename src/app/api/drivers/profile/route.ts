import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAdminClient } from '@/lib/adminClient';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const adminDb = getAdminClient();
    const { data: driver, error: dbError } = await adminDb
      .from('drivers')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (dbError) {
      console.error('[API/drivers/profile] Database error:', dbError);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, driver });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno';
    console.error('[API/drivers/profile] Internal error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
