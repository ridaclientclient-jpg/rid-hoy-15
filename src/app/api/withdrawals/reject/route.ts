import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAdminClient } from '@/lib/adminClient';

export async function POST(request: Request) {
  try {
    const { withdrawal_id, reason } = await request.json();

    if (!withdrawal_id) {
      return NextResponse.json({ error: 'withdrawal_id requerido' }, { status: 400 });
    }

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

    // 3. Get withdrawal details (using admin client to bypass RLS)
    const { data: withdrawal, error: fetchErr } = await db
      .from('withdrawal_queue')
      .select('*')
      .eq('id', withdrawal_id)
      .in('status', ['queued', 'processing'])
      .single();

    if (fetchErr || !withdrawal) {
      return NextResponse.json({ error: 'Retiro no encontrado o ya procesado' }, { status: 404 });
    }

    // 4. Update withdrawal status (using admin client to bypass RLS)
    const { error: updateErr } = await db
      .from('withdrawal_queue')
      .update({
        status: 'failed',
        error_message: reason || 'Retiro rechazado por administracion',
        processed_at: new Date().toISOString(),
      })
      .eq('id', withdrawal_id);

    if (updateErr) throw updateErr;

    // 5. Refund the amount back to wallet (using admin client to bypass RLS)
    if (withdrawal.wallet_id) {
      const { data: wallet } = await db
        .from('wallets')
        .select('balance')
        .eq('id', withdrawal.wallet_id)
        .single();

      if (wallet) {
        await db
          .from('wallets')
          .update({ balance: wallet.balance + withdrawal.amount })
          .eq('id', withdrawal.wallet_id);
      }
    }

    // 6. Notify the user (using admin client to bypass RLS)
    await db.from('notifications').insert({
      user_id: withdrawal.user_id,
      title: 'Retiro Rechazado',
      message: `Tu solicitud de retiro de ₡${withdrawal.amount.toLocaleString()} ha sido rechazada. Motivo: ${reason || 'Decision administrativa'}. El monto ha sido devuelto a tu billetera.`,
      type: 'payment',
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error';
    console.error('[Withdrawal Reject]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
