import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthClient } from '@/lib/authClient';

export async function POST(request: Request) {
  try {
    const { amount } = await request.json();

    const authHeader = request.headers.get('Authorization');
    if (!authHeader) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const db = getAuthClient(token);

    // Get minimum withdrawal amount from settings
    const { data: settings } = await db
      .from('settings')
      .select('key, value')
      .eq('key', 'min_withdrawal_amount')
      .single();

    const minAmount = Number(settings?.value || 10000);

    if (amount < minAmount) {
      return NextResponse.json({
        error: `Monto minimo de retiro: ₡${minAmount.toLocaleString()}`
      }, { status: 400 });
    }

    // Get wallet
    const { data: wallet } = await db
      .from('wallets')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!wallet) {
      return NextResponse.json({ error: 'Billetera no encontrada' }, { status: 404 });
    }

    if (wallet.balance < amount) {
      return NextResponse.json({ error: 'Saldo insuficiente' }, { status: 400 });
    }

    // Check daily withdrawal limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count: todayWithdrawals } = await db
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('wallet_id', wallet.id)
      .eq('type', 'withdrawal')
      .gte('created_at', today.toISOString());

    if ((todayWithdrawals || 0) >= 1) {
      return NextResponse.json({
        error: 'Ya realizaste un retiro hoy. Maximo 1 retiro por dia.'
      }, { status: 400 });
    }

    // Create withdrawal transaction
    const { error: txError } = await db
      .from('transactions')
      .insert({
        wallet_id: wallet.id,
        amount: -amount,
        type: 'withdrawal',
        status: 'processing',
        description: `Retiro de ₡${amount.toLocaleString()} - Procesando en 24h`,
      });

    if (txError) throw txError;

    // Update wallet balance
    await db
      .from('wallets')
      .update({ balance: wallet.balance - amount })
      .eq('id', wallet.id);

    return NextResponse.json({
      success: true,
      message: 'Retiro iniciado. Procesando en 24 horas.'
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
