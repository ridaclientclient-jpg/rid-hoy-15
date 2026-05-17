import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthClient } from '@/lib/authClient';

export async function GET(req: NextRequest) {
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

    // Get courier profile
    const { data: courier, error: courierErr } = await db
      .from('couriers')
      .select('id, total_earnings, total_deliveries, rating')
      .eq('user_id', user.id)
      .single();

    if (courierErr || !courier) {
      return NextResponse.json({ error: 'Perfil de repartidor no encontrado' }, { status: 404 });
    }

    // Try to get wallet balance
    let walletBalance = courier.total_earnings || 0;
    let availableForWithdrawal = 0;

    const { data: wallet } = await db
      .from('courier_wallets')
      .select('balance, available_balance, frozen_balance')
      .eq('courier_id', courier.id)
      .single();

    if (wallet) {
      walletBalance = Number(wallet.balance) || 0;
      availableForWithdrawal = Number(wallet.available_balance) || 0;
    } else {
      // Fallback: calculate from deliveries minus withdrawals
      const { data: delivered } = await db
        .from('deliveries')
        .select('delivery_fee')
        .eq('courier_id', courier.id)
        .eq('status', 'delivered');
      const earnings = (delivered || []).reduce((s: number, d: any) => s + (Number(d.delivery_fee) || 0), 0);

      const { data: completed } = await db
        .from('withdrawal_requests')
        .select('amount')
        .eq('courier_id', courier.id)
        .in('status', ['completed']);
      const withdrawn = (completed || []).reduce((s: number, w: any) => s + (Number(w.amount) || 0), 0);

      const { data: pending } = await db
        .from('withdrawal_requests')
        .select('amount')
        .eq('courier_id', courier.id)
        .in('status', ['queued', 'processing']);
      const pendingAmt = (pending || []).reduce((s: number, w: any) => s + (Number(w.amount) || 0), 0);

      availableForWithdrawal = earnings - withdrawn - pendingAmt;
      walletBalance = earnings - withdrawn;
    }

    // Recent deliveries as transactions
    const { data: recentDeliveries } = await db
      .from('deliveries')
      .select('id, delivery_fee, status, created_at, delivery_address')
      .eq('courier_id', courier.id)
      .in('status', ['delivered', 'cancelled'])
      .order('created_at', { ascending: false })
      .limit(20);

    const txDeliveries = (recentDeliveries || []).map((d: any) => ({
      id: d.id,
      desc: d.status === 'delivered'
        ? `Entrega #${d.id.slice(-6)} - ${d.delivery_address?.slice(0, 25) || 'Pedido'}`
        : `Cancelada #${d.id.slice(-6)}`,
      amount: d.status === 'delivered' ? (Number(d.delivery_fee) || 0) : 0,
      time: d.created_at,
      type: d.status === 'delivered' ? 'delivery' : 'cancelled',
    }));

    // Pending withdrawals
    const { data: pendingReqs } = await db
      .from('withdrawal_requests')
      .select('id, amount, status, created_at')
      .eq('courier_id', courier.id)
      .in('status', ['queued', 'processing'])
      .order('created_at', { ascending: false });

    const txWithdrawals = (pendingReqs || []).map((w: any) => ({
      id: w.id,
      desc: `Retiro #${w.id.slice(-6)}`,
      amount: -Number(w.amount),
      time: w.created_at,
      type: 'withdraw',
      status: w.status,
    }));

    const transactions = [...txWithdrawals, ...txDeliveries]
      .sort((a: any, b: any) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 20);

    return NextResponse.json({
      walletBalance,
      availableForWithdrawal,
      totalEarnings: courier.total_earnings || 0,
      totalDeliveries: courier.total_deliveries || 0,
      rating: courier.rating || 0,
      transactions,
    });
  } catch (err: any) {
    console.error('Courier wallet error:', err);
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
  }
}
