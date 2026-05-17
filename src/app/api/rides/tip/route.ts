import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthClient } from '@/lib/authClient';

type TipMethod = 'cash' | 'wallet';

// ─── Auth Helper ────────────────────────────────────────────────
async function authenticateRequest(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return { user: null, token: null, error: 'No autorizado: se requiere token de autenticación' };
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return { user: null, token: null, error: 'No autorizado: token inválido o expirado' };
  }

  return { user, token, error: null };
}

// ─── POST /api/rides/tip ────────────────────────────────────────
// Add a tip to a completed ride
export async function POST(request: Request) {
  try {
    // Authenticate
    const { user, token, error: authError } = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json({ error: authError }, { status: 401 });
    }

    const db = getAuthClient(token!);

    // Parse and validate body
    const body = await request.json();
    const { ride_id, amount, method } = body;

    if (!ride_id) {
      return NextResponse.json(
        { error: 'El ID del viaje es requerido' },
        { status: 400 }
      );
    }

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { error: 'El monto de la propina debe ser un número mayor a 0' },
        { status: 400 }
      );
    }

    if (amount > 100000) {
      return NextResponse.json(
        { error: 'El monto máximo de propina es de ₡100,000' },
        { status: 400 }
      );
    }

    if (!method || !['cash', 'wallet'].includes(method)) {
      return NextResponse.json(
        { error: 'El método de propina debe ser "cash" o "wallet"' },
        { status: 400 }
      );
    }

    // Verify the ride belongs to this rider and is completed
    const { data: ride, error: rideFetchError } = await db
      .from('rides')
      .select('id, rider_id, driver_id, status, tip_amount, tip_processed')
      .eq('id', ride_id)
      .single();

    if (rideFetchError || !ride) {
      return NextResponse.json(
        { error: 'Viaje no encontrado' },
        { status: 404 }
      );
    }

    if (ride.rider_id !== user.id) {
      return NextResponse.json(
        { error: 'Solo el pasajero del viaje puede agregar una propina' },
        { status: 403 }
      );
    }

    if (ride.status !== 'completed') {
      return NextResponse.json(
        { error: 'Solo se puede agregar propina a viajes completados' },
        { status: 400 }
      );
    }

    if (ride.tip_processed) {
      return NextResponse.json(
        { error: 'Este viaje ya tiene una propina procesada' },
        { status: 400 }
      );
    }

    // If tipping via wallet, check rider balance
    if (method === 'wallet') {
      const { data: wallet, error: walletError } = await db
        .from('wallets')
        .select('balance')
        .eq('user_id', user.id)
        .single();

      if (walletError || !wallet) {
        return NextResponse.json(
          { error: 'No se pudo verificar el saldo de la billetera' },
          { status: 500 }
        );
      }

      if (wallet.balance < amount) {
        return NextResponse.json(
          { error: `Saldo insuficiente en la billetera. Saldo actual: ₡${wallet.balance.toLocaleString()}` },
          { status: 400 }
        );
      }
    }

    // Call the RPC to add tip to ride
    const { data, error } = await db.rpc('add_tip_to_ride', {
      p_ride_id: ride_id,
      p_amount: amount,
      p_method: method as TipMethod,
    });

    if (error) {
      console.error('[AddTip] RPC error:', error.message);
      return NextResponse.json(
        { error: `Error al procesar la propina: ${error.message}` },
        { status: 500 }
      );
    }

    const result = Array.isArray(data) ? data[0] : data;

    if (!result?.success) {
      return NextResponse.json(
        { error: result?.message || 'No se pudo agregar la propina al viaje' },
        { status: 400 }
      );
    }

    // Create notification for the driver
    if (ride.driver_id) {
      const methodLabel = method === 'cash' ? 'en efectivo' : 'desde billetera';
      await db.from('notifications').insert({
        user_id: ride.driver_id,
        title: '¡Propina recibida! 🎉',
        message: `Recibiste una propina de ₡${amount.toLocaleString()} ${methodLabel} por el viaje completado.`,
        type: 'payment',
        data: {
          ride_id,
          tip_amount: amount,
          tip_method: method,
        },
      });
    }

    return NextResponse.json({
      success: true,
      tip_amount: Number(amount),
      tip_method: method,
      tip_processed: true,
      message: `Propina de ₡${amount.toLocaleString()} agregada exitosamente`,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Error al agregar propina';
    console.error('[AddTip] Unexpected error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─── GET /api/rides/tip?ride_id=xxx ─────────────────────────────
// Check if a ride already has a tip
export async function GET(request: Request) {
  try {
    // Authenticate
    const { user, token, error: authError } = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json({ error: authError }, { status: 401 });
    }

    const db = getAuthClient(token!);

    // Parse query params
    const { searchParams } = new URL(request.url);
    const ride_id = searchParams.get('ride_id');

    if (!ride_id) {
      return NextResponse.json(
        { error: 'El parámetro ride_id es requerido' },
        { status: 400 }
      );
    }

    // Fetch ride tip info — restrict to rides belonging to the current user
    const { data: ride, error: rideFetchError } = await db
      .from('rides')
      .select(
        'id, rider_id, driver_id, status, tip_amount, tip_method, tip_processed, price'
      )
      .eq('id', ride_id)
      .single();

    if (rideFetchError || !ride) {
      return NextResponse.json(
        { error: 'Viaje no encontrado' },
        { status: 404 }
      );
    }

    // Only the rider or driver of this ride can query tip info
    if (ride.rider_id !== user.id && ride.driver_id !== user.id) {
      return NextResponse.json(
        { error: 'No tienes permiso para ver la información de este viaje' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      ride_id: ride.id,
      tip_amount: ride.tip_amount ?? 0,
      tip_method: ride.tip_method ?? null,
      tip_processed: ride.tip_processed ?? false,
      ride_price: ride.price,
      status: ride.status,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : 'Error al consultar la propina del viaje';
    console.error('[GetTip] Unexpected error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
