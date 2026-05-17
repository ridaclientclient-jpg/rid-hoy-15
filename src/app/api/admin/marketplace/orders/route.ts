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

    const db = getAdminClient();

    const { data: admin, error: adminErr } = await db
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (adminErr) {
      console.error('[Admin Orders GET] Profile error:', JSON.stringify(adminErr));
    }
    console.log('[Admin Orders GET] user:', user.id, 'admin data:', JSON.stringify(admin));

    if (!admin || (admin.role !== 'admin' && admin.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Solo administradores', debug: { userId: user.id, adminData: admin, adminError: adminErr ? adminErr.message : null } }, { status: 403 });
    }

    const url = new URL(request.url);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);

    const { data, error } = await db
      .from('deliveries')
      .select(`
        *,
        profiles:customer_id(name, email, phone),
        vendor:vendor_id(store_name, category),
        courier:courier_id(
          id, 
          vehicle_type, 
          profiles(name, phone)
        )
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return NextResponse.json({
      orders: data || [],
      hasMore: (data || []).length === limit,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error';
    console.error('[Admin Orders]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const db = getAdminClient();

    const { data: admin } = await db
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!admin || (admin.role !== 'admin' && admin.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Solo administradores' }, { status: 403 });
    }

    const body = await request.json();
    const { order_id, status } = body;

    if (!order_id || !status) {
      return NextResponse.json({ error: 'order_id y status requeridos' }, { status: 400 });
    }

    const validStatuses = ['pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Status no valido' }, { status: 400 });
    }

    console.log('[Admin Order Update] order_id:', order_id, 'status:', status, 'user:', user.id);

    const { data, error } = await db
      .from('deliveries')
      .update({ status })
      .eq('id', order_id)
      .select();

    if (error) {
      console.error('[Admin Order Update] Supabase error:', JSON.stringify(error));
      throw new Error(error.message || JSON.stringify(error));
    }

    console.log('[Admin Order Update] Success:', JSON.stringify(data));

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    let message = 'Error desconocido';
    if (error instanceof Error) {
      message = error.message;
    } else if (typeof error === 'object' && error !== null) {
      message = JSON.stringify(error);
    }
    console.error('[Admin Order Update] Catch:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
