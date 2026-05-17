import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/recharges/list
 * Lists recharge requests for admin panel.
 * Query params: status (optional, filter by status)
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const token = authHeader.replace('Bearer ', '');

    // Create a client with the user's token for RLS
    const userClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user }, error: authError } = await userClient.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { data: admin } = await userClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!admin || !['admin', 'super_admin'].includes(admin.role)) {
      return NextResponse.json({ error: 'Solo administradores' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');

    let query = userClient
      .from('recharge_requests')
      .select(`
        id,
        user_id,
        amount,
        method,
        sinpe_phone,
        card_last_four,
        status,
        admin_note,
        reviewed_at,
        created_at,
        profiles:user_id (name, phone, email)
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (statusFilter && ['pending', 'approved', 'rejected'].includes(statusFilter)) {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
