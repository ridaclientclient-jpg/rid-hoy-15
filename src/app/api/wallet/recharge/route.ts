import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthClient } from '@/lib/authClient';

/** Allowed recharge methods */
const VALID_METHODS = ['sinpe', 'card'] as const;
type RechargeMethod = (typeof VALID_METHODS)[number];

/** Minimum and maximum recharge amounts in ₡ CRC */
const MIN_AMOUNT = 1000;
const MAX_AMOUNT = 100000;

/**
 * POST /api/wallet/recharge
 *
 * Recharges the authenticated user's wallet.
 * Uses the Supabase RPC `recharge_wallet`.
 *
 * Body params:
 *   amount — number (required), between 1,000 and 100,000 ₡
 *   method — 'sinpe' | 'card' (optional, default 'sinpe')
 */
export async function POST(request: Request) {
  try {
    // ── Auth ────────────────────────────────────────────────────
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'No autorizado: se requiere token de autenticación' },
        { status: 401 },
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json(
        { error: 'No autorizado: token inválido o expirado' },
        { status: 401 },
      );
    }

    const db = getAuthClient(token);

    // ── Parse body ──────────────────────────────────────────────
    const body = await request.json();
    const { amount, method: rawMethod } = body;

    // Validate amount
    if (amount === undefined || amount === null) {
      return NextResponse.json(
        { error: 'El monto es requerido' },
        { status: 400 },
      );
    }

    const numericAmount = Number(amount);

    if (Number.isNaN(numericAmount) || !Number.isFinite(numericAmount)) {
      return NextResponse.json(
        { error: 'El monto debe ser un número válido' },
        { status: 400 },
      );
    }

    if (numericAmount < MIN_AMOUNT) {
      return NextResponse.json(
        {
          error: `El monto mínimo de recarga es ₡${MIN_AMOUNT.toLocaleString('es-CR')}`,
        },
        { status: 400 },
      );
    }

    if (numericAmount > MAX_AMOUNT) {
      return NextResponse.json(
        {
          error: `El monto máximo de recarga es ₡${MAX_AMOUNT.toLocaleString('es-CR')}`,
        },
        { status: 400 },
      );
    }

    // Validate method
    const method: RechargeMethod = VALID_METHODS.includes(rawMethod)
      ? rawMethod
      : 'sinpe';

    // ── Call RPC ────────────────────────────────────────────────
    const { data: result, error: rpcError } = await db.rpc(
      'recharge_wallet',
      {
        p_user_id: user.id,
        p_amount: numericAmount,
        p_method: method,
      },
    );

    if (rpcError) {
      console.error('Error en RPC recharge_wallet:', rpcError.message);
      return NextResponse.json(
        { error: `Error al procesar la recarga: ${rpcError.message}` },
        { status: 500 },
      );
    }

    const newBalance = result?.new_balance ?? result ?? 0;

    // ── Build response ──────────────────────────────────────────
    return NextResponse.json({
      success: true,
      message: `Recarga de ₡${numericAmount.toLocaleString('es-CR')} realizada con éxito`,
      currency: 'CRC',
      recharge: {
        amount: numericAmount,
        amount_formatted: `₡${numericAmount.toLocaleString('es-CR')}`,
        method,
        method_label: method === 'sinpe' ? 'SINPE Móvil' : 'Tarjeta',
      },
      new_balance: Number(newBalance),
      new_balance_formatted: `₡${Number(newBalance).toLocaleString('es-CR')}`,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : 'Error al procesar la recarga';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
