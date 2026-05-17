import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthClient } from '@/lib/authClient';

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Token invalido' }, { status: 401 });
    }

    const db = getAuthClient(token);

    const body = await req.json();
    const { amount } = body;
    const withdrawalAmount = Number(amount);

    // Validate amount
    if (!withdrawalAmount || withdrawalAmount < 10000) {
      return NextResponse.json({ error: 'El monto minimo de retiro es ₡10,000' }, { status: 400 });
    }
    if (withdrawalAmount % 10000 !== 0) {
      return NextResponse.json({ error: 'Los montos deben ser multiplos de ₡10,000' }, { status: 400 });
    }

    // Get courier profile
    const { data: courier, error: courierErr } = await db
      .from('couriers')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (courierErr || !courier) {
      return NextResponse.json({ error: 'Perfil de repartidor no encontrado' }, { status: 404 });
    }

    // Try RPC first
    const { data: rpcResult, error: rpcError } = await db.rpc('request_courier_withdrawal', {
      p_courier_id: courier.id,
      p_amount: withdrawalAmount,
    });

    if (!rpcError && rpcResult) {
      return NextResponse.json({
        success: true,
        message: 'Solicitud de retiro creada exitosamente',
        amount: withdrawalAmount,
        processable_at: rpcResult.processable_at,
      });
    }

    // Fallback: manual insert
    console.warn('RPC request_courier_withdrawal failed, using manual insert:', rpcError?.message);

    // Calculate available balance
    const { data: delivered } = await db
      .from('deliveries')
      .select('delivery_fee')
      .eq('courier_id', courier.id)
      .eq('status', 'delivered');
    const totalEarned = (delivered || []).reduce((s: number, d: any) => s + (Number(d.delivery_fee) || 0), 0);

    const { data: existing } = await db
      .from('withdrawal_requests')
      .select('amount')
      .eq('courier_id', courier.id)
      .in('status', ['completed', 'queued', 'processing']);
    const totalUsed = (existing || []).reduce((s: number, w: any) => s + (Number(w.amount) || 0), 0);

    const available = totalEarned - totalUsed;
    if (withdrawalAmount > available) {
      return NextResponse.json({
        error: `Saldo insuficiente. Disponible: ₡${Math.max(0, available).toLocaleString()}`,
      }, { status: 400 });
    }

    // 48 hours from now
    const processableAt = new Date();
    processableAt.setHours(processableAt.getHours() + 48);

    const { error: insertError } = await db
      .from('withdrawal_requests')
      .insert({
        courier_id: courier.id,
        user_id: user.id,
        amount: withdrawalAmount,
        status: 'queued',
        processable_at: processableAt.toISOString(),
      });

    if (insertError) {
      console.error('Withdrawal insert error:', insertError);
      return NextResponse.json({ error: 'Error al crear solicitud de retiro' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Solicitud de retiro creada exitosamente',
      amount: withdrawalAmount,
      processable_at: processableAt.toISOString(),
    });
  } catch (err: any) {
    console.error('Courier withdraw error:', err);
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
  }
}
