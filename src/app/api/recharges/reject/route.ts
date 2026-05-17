import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/recharges/reject
 * Admin rejects a recharge request.
 * Body: { request_id: string, reason: string }
 */
export async function POST(request: Request) {
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

    const { request_id, reason } = await request.json();
    if (!request_id) {
      return NextResponse.json({ error: 'request_id requerido' }, { status: 400 });
    }

    const { data: result, error: rpcError } = await userClient.rpc(
      'reject_recharge',
      {
        p_request_id: request_id,
        p_admin_id: user.id,
        p_reason: reason || null,
      },
    );

    if (rpcError) throw rpcError;

    if (!result?.success) {
      return NextResponse.json(
        { error: result?.error || 'No se pudo rechazar la solicitud' },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
