import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAdminClient } from '@/lib/adminClient';

export async function GET(request: Request) {
  try {
    // 1. Verify admin auth
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const db = getAdminClient();

    // 2. Verify admin role
    const { data: admin } = await db
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!admin || (admin.role !== 'admin' && admin.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Solo administradores' }, { status: 403 });
    }

    // 3. Fetch pending withdrawals
    const { data, error } = await db
      .from('withdrawal_queue')
      .select('*')
      .in('status', ['queued', 'processing'])
      .order('created_at', { ascending: true });

    if (error) throw error;

    // 4. Get user info for each withdrawal
    const userIds = [...new Set((data || []).map((w: any) => w.user_id).filter(Boolean))];
    const profileMap: Record<string, { name: string; phone?: string }> = {};

    if (userIds.length > 0) {
      const { data: profiles } = await db
        .from('profiles')
        .select('id, name, phone')
        .in('id', userIds);
      if (profiles) {
        profiles.forEach((p: any) => { profileMap[p.id] = { name: p.name, phone: p.phone }; });
      }
    }

    const withdrawals = (data || []).map((w: any) => ({
      id: w.id,
      user_id: w.user_id,
      wallet_id: w.wallet_id,
      amount: w.amount,
      status: w.status,
      created_at: w.created_at,
      processed_at: w.processed_at,
      error_message: w.error_message,
      user_name: profileMap[w.user_id]?.name || 'Desconocido',
      user_phone: profileMap[w.user_id]?.phone || '',
    }));

    return NextResponse.json({ withdrawals });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error';
    console.error('[Admin Withdrawals]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
