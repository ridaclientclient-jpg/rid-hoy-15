import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthClient } from '@/lib/authClient';

/**
 * POST /api/drivers/withdraw
 * Driver requests a withdrawal
 */
export async function POST(request: Request) {
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

    const { amount, method, sinpe_phone, bank_name, bank_account } = await request.json();

    if (!amount || amount < 5000) {
      return NextResponse.json({ error: 'El retiro minimo es ₡5,000' }, { status: 400 });
    }

    const db = getAuthClient(token);

    // Get driver record
    const { data: driver, error: driverError } = await db
      .from('drivers')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (driverError || !driver) {
      return NextResponse.json({ error: 'No se encontro perfil de conductor' }, { status: 404 });
    }

    // Call RPC
    const { data, error } = await db.rpc('request_driver_withdrawal', {
      p_driver_id: driver.id,
      p_amount: amount,
      p_method: method || 'sinpe',
      p_sinpe_phone: sinpe_phone || null,
      p_bank_name: bank_name || null,
      p_bank_account: bank_account || null,
    });

    if (error) {
      console.error('[DriverWithdraw] RPC error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const result = Array.isArray(data) ? data[0] : data;

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al procesar retiro';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
