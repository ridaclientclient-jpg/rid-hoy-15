import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthClient } from '@/lib/authClient';

/**
 * POST /api/drivers/log-action
 * Registra una acción del conductor con un viaje (accepted, declined, cancelled)
 * Usado por la app del conductor para tracking de cancelaciones/declinaciones
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { driver_id, ride_id, action, reason } = body;

    // Validaciones
    if (!driver_id || !ride_id || !action) {
      return NextResponse.json(
        { error: 'driver_id, ride_id y action son requeridos' },
        { status: 400 }
      );
    }

    if (!['accepted', 'declined', 'cancelled'].includes(action)) {
      return NextResponse.json(
        { error: 'action debe ser accepted, declined o cancelled' },
        { status: 400 }
      );
    }

    // Verificar autenticación
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Token invalido' }, { status: 401 });
    }

    const db = getAuthClient(token);

    // Verificar que el usuario es el conductor del driver_id
    const { data: driver, error: driverError } = await db
      .from('drivers')
      .select('id, user_id, status')
      .eq('id', driver_id)
      .eq('user_id', user.id)
      .single();

    if (driverError || !driver) {
      return NextResponse.json(
        { error: 'Conductor no encontrado o no autorizado' },
        { status: 403 }
      );
    }

    // Verificar que el conductor no está bloqueado
    const { data: blockData } = await db.rpc('check_driver_block', {
      p_driver_id: driver_id,
    });

    const isBlocked = blockData && blockData.length > 0 && blockData[0].is_active === true;
    if (isBlocked && action !== 'cancelled') {
      return NextResponse.json(
        { error: 'Conductor bloqueado. No puede aceptar ni declinar viajes.', blocked: true },
        { status: 403 }
      );
    }

    // Registrar la acción via RPC
    const { error: rpcError } = await db.rpc('log_driver_ride_action', {
      p_driver_id: driver_id,
      p_ride_id: ride_id,
      p_action: action,
      p_reason: reason || '',
    });

    if (rpcError) {
      console.error('Error logging driver action:', rpcError);
      return NextResponse.json(
        { error: `Error al registrar accion: ${rpcError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Accion "${action}" registrada exitosamente`,
    });

  } catch (err) {
    console.error('Driver log action error:', err);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
