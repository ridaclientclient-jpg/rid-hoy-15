import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthClient } from '@/lib/authClient';

/**
 * GET /api/drivers/wallet
 * Returns driver's wallet info: balance, earnings, transactions
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const db = getAuthClient(token);

    // Get driver record
    const { data: driver, error: driverError } = await db
      .from('drivers')
      .select('id, user_id, available_balance, frozen_balance, total_earnings, total_withdrawn, total_tips')
      .eq('user_id', user.id)
      .single();

    if (driverError || !driver) {
      return NextResponse.json({ error: 'No se encontro perfil de conductor' }, { status: 404 });
    }

    // Get wallet data via RPC
    const { data: walletData, error: rpcError } = await db.rpc('get_driver_wallet', {
      p_driver_id: driver.id,
    });

    if (rpcError) {
      console.error('[DriverWallet] RPC error:', rpcError.message);
      return NextResponse.json({
        success: true,
        available_balance: Number(driver.available_balance || 0),
        frozen_balance: Number(driver.frozen_balance || 0),
        total_earnings: Number(driver.total_earnings || 0),
        total_withdrawn: Number(driver.total_withdrawn || 0),
        total_tips: Number(driver.total_tips || 0),
        pending_withdrawals: 0,
        recent_transactions: [],
      });
    }

    const result = Array.isArray(walletData) ? walletData[0] : walletData;

    return NextResponse.json({
      success: true,
      available_balance: Number(result.available_balance || 0),
      frozen_balance: Number(result.frozen_balance || 0),
      total_earnings: Number(result.total_earnings || 0),
      total_withdrawn: Number(result.total_withdrawn || 0),
      total_tips: Number(result.total_tips || 0),
      pending_withdrawals: Number(result.pending_withdrawals || 0),
      recent_transactions: result.recent_transactions || [],
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al obtener billetera';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
