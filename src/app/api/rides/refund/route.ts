import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthClient } from '@/lib/authClient';

async function verifyAdmin(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.replace('Bearer ', '');
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) return null;

  const db = getAuthClient(token);
  const { data: profile } = await db
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin'))
    return null;
  return { user, profile, token };
}

export async function POST(request: NextRequest) {
  try {
    // 1. Verify the requester is admin or super_admin
    const auth = await verifyAdmin(request);
    if (!auth) {
      return NextResponse.json(
        { error: 'Acceso denegado - Solo administradores' },
        { status: 403 }
      );
    }

    const db = getAuthClient(auth.token);

    // 2. Get rideId from request body
    const { rideId } = await request.json();
    if (!rideId) {
      return NextResponse.json(
        { error: 'ID del viaje es requerido' },
        { status: 400 }
      );
    }

    // 3. Fetch the ride with rider_id, driver_id, price, driver_earnings, payment_method, payment_status
    const { data: ride, error: rideError } = await db
      .from('rides')
      .select('id, rider_id, driver_id, price, driver_earnings, payment_method, payment_status')
      .eq('id', rideId)
      .single();

    if (rideError || !ride) {
      return NextResponse.json(
        { error: 'Viaje no encontrado' },
        { status: 404 }
      );
    }

    // 4. Validate: payment_status must be 'paid' or 'completed'
    if (ride.payment_status !== 'paid' && ride.payment_status !== 'completed') {
      return NextResponse.json(
        { error: 'Solo se pueden reembolsar viajes pagados' },
        { status: 400 }
      );
    }

    // 5. Find the rider's wallet
    const { data: wallet, error: walletError } = await db
      .from('wallets')
      .select('id, balance, total_earnings')
      .eq('user_id', ride.rider_id)
      .single();

    if (walletError || !wallet) {
      return NextResponse.json(
        { error: 'Billetera del pasajero no encontrada' },
        { status: 404 }
      );
    }

    const refundAmount = ride.price;
    const shortId = rideId.slice(0, 8).toUpperCase();
    const driverEarnings = ride.driver_earnings || 0;

    // 6. Create a credit transaction for the rider (refund)
    const { error: txError } = await db.from('transactions').insert({
      wallet_id: wallet.id,
      amount: refundAmount,
      type: 'credit',
      status: 'completed',
      description: `Reembolso viaje #${shortId}`,
      ride_id: rideId,
    });

    if (txError) {
      console.error('Error creating refund transaction:', txError);
      return NextResponse.json(
        { error: 'Error al crear transaccion de reembolso' },
        { status: 500 }
      );
    }

    // 7. Update rider wallet: balance += ride.price
    const { error: walletUpdateError } = await db
      .from('wallets')
      .update({
        balance: wallet.balance + refundAmount,
      })
      .eq('id', wallet.id);

    if (walletUpdateError) {
      console.error('Error updating rider wallet:', walletUpdateError);
      return NextResponse.json(
        { error: 'Error al actualizar billetera del pasajero' },
        { status: 500 }
      );
    }

    // 8. Reverse driver earnings — deduct from driver's wallet
    if (ride.driver_id && driverEarnings > 0) {
      const { data: driverWallet, error: dwError } = await db
        .from('wallets')
        .select('id, balance, total_earnings')
        .eq('user_id', ride.driver_id)
        .single();

      if (!dwError && driverWallet) {
        // Create debit transaction for driver
        await db.from('transactions').insert({
          wallet_id: driverWallet.id,
          amount: -driverEarnings,
          type: 'debit',
          status: 'completed',
          description: `Reversion ganancia viaje #${shortId} (reembolso)`,
          ride_id: rideId,
        });

        // Deduct from driver wallet (ensure balance doesn't go negative)
        const newDriverBalance = Math.max(0, driverWallet.balance - driverEarnings);
        const newTotalEarnings = Math.max(0, (driverWallet.total_earnings || 0) - driverEarnings);
        await db
          .from('wallets')
          .update({
            balance: newDriverBalance,
            total_earnings: newTotalEarnings,
          })
          .eq('id', driverWallet.id);
      }
    }

    // 9. Update ride: payment_status = 'refunded'
    const { error: rideUpdateError } = await db
      .from('rides')
      .update({ payment_status: 'refunded' })
      .eq('id', rideId);

    if (rideUpdateError) {
      console.error('Error updating ride status:', rideUpdateError);
      return NextResponse.json(
        { error: 'Error al actualizar estado del viaje' },
        { status: 500 }
      );
    }

    // 10. Return success with breakdown
    const resultMessage = driverEarnings > 0
      ? `Reembolso de ₡${refundAmount.toLocaleString()} procesado. Ganancias de ₡${driverEarnings.toLocaleString()} revertidas al conductor.`
      : `Reembolso de ₡${refundAmount.toLocaleString()} procesado exitosamente.`;

    return NextResponse.json({
      success: true,
      message: resultMessage,
      breakdown: {
        refundAmount,
        driverEarningsReversed: driverEarnings,
      },
    });
  } catch (error: unknown) {
    console.error('Refund error:', error);
    const message =
      error instanceof Error ? error.message : 'Error al procesar reembolso';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
