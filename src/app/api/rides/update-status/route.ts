import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthClient } from '@/lib/authClient';

/**
 * POST /api/rides/update-status
 * Allows drivers to transition ride status.
 * Validates that the user is the assigned driver for this ride.
 *
 * Valid transitions:
 *   assigned -> arriving   (driver is heading to pickup)
 *   arriving -> started    (driver picked up rider)
 *   started  -> completed  (ride finished)
 *
 * Riders can also call to complete a ride.
 */
export async function POST(request: Request) {
  try {
    const { ride_id, new_status } = await request.json();

    if (!ride_id || !new_status) {
      return NextResponse.json({ error: 'ride_id y new_status son requeridos' }, { status: 400 });
    }

    const validStatuses = ['assigned', 'arriving', 'started', 'completed', 'cancelled'];
    if (!validStatuses.includes(new_status)) {
      return NextResponse.json({ error: 'Estado invalido' }, { status: 400 });
    }

    // Get auth
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

    // Get the ride
    const { data: ride, error: rideError } = await db
      .from('rides')
      .select('*')
      .eq('id', ride_id)
      .single();

    if (rideError || !ride) {
      return NextResponse.json({ error: 'Viaje no encontrado' }, { status: 404 });
    }

    // Verify user is the driver or rider of this ride
    let isDriver = false;
    if (ride.driver_id) {
      const { data: driverRecord } = await db
        .from('drivers')
        .select('id')
        .eq('id', ride.driver_id)
        .eq('user_id', user.id)
        .single();
      isDriver = !!driverRecord;
    }

    const isRider = ride.rider_id === user.id;

    if (!isDriver && !isRider) {
      return NextResponse.json({ error: 'No tienes permiso para actualizar este viaje' }, { status: 403 });
    }

    // Validate status transition
    const validTransitions: Record<string, string[]> = {
      assigned: ['arriving', 'cancelled'],
      arriving: ['started', 'cancelled'],
      started: ['completed'],
    };

    // Riders can complete or cancel
    if (isRider) {
      if (new_status === 'completed' && ride.status === 'started') {
        // Allow rider to complete
      } else if (new_status === 'cancelled' && ['searching', 'assigned'].includes(ride.status)) {
        // Allow rider to cancel
      } else {
        return NextResponse.json({ error: 'Transicion de estado no valida para el pasajero' }, { status: 400 });
      }
    } else if (isDriver) {
      const allowed = validTransitions[ride.status];
      if (!allowed || !allowed.includes(new_status)) {
        return NextResponse.json({
          error: `Transicion invalida: ${ride.status} -> ${new_status}. Permitidas: ${allowed?.join(', ') || 'ninguna'}`
        }, { status: 400 });
      }
    }

    // Calculate driver earnings if completing
    let updateData: Record<string, unknown> = { status: new_status };

    // Set timestamps based on status transitions
    if (new_status === 'assigned' && !ride.matched_at) {
      updateData.matched_at = new Date().toISOString();
    }
    if (new_status === 'started' && !ride.started_at) {
      updateData.started_at = new Date().toISOString();
    }
    if (new_status === 'completed') {
      updateData.completed_at = new Date().toISOString();
      const commissionRate = ride.commission_rate || 15;
      const driverEarnings = Math.round(ride.price * (1 - commissionRate / 100));
      updateData.driver_earnings = driverEarnings;

      // Update driver stats
      if (ride.driver_id) {
        try {
          await db.rpc('increment_driver_stats', {
            p_driver_id: ride.driver_id,
            p_earnings: driverEarnings,
          });
        } catch {
          // RPC may not exist, ignore
        }

        // Set driver back to online
        await db
          .from('drivers')
          .update({ status: 'online' })
          .eq('id', ride.driver_id);
      }
    }

    if (new_status === 'cancelled' && ride.driver_id) {
      // Set driver back to online when ride is cancelled
      await db
        .from('drivers')
        .update({ status: 'online' })
        .eq('id', ride.driver_id);
      // Update cancellation tracking
      updateData.cancelled_by = user.id;
      updateData.cancelled_at = new Date().toISOString();
    }

    // Update ride status
    const { error: updateError } = await db
      .from('rides')
      .update(updateData)
      .eq('id', ride_id);

    if (updateError) {
      console.error('[UpdateStatus] Error:', updateError.message);
      return NextResponse.json({ error: 'Error al actualizar estado' }, { status: 500 });
    }

    // Notify the other party
    const notifyUserId = isDriver ? ride.rider_id : ride.driver_id;
    if (notifyUserId) {
      const statusMessages: Record<string, string> = {
        arriving: 'El conductor esta en camino al punto de recogida',
        started: 'El viaje ha comenzado',
        completed: 'El viaje ha sido completado',
        cancelled: 'El viaje ha sido cancelado',
      };

      await db.from('notifications').insert({
        user_id: notifyUserId,
        title: 'Actualizacion de viaje',
        message: statusMessages[new_status] || `Estado actualizado: ${new_status}`,
        type: 'ride',
        data: { ride_id, new_status },
      });
    }

    return NextResponse.json({ success: true, message: `Estado actualizado a ${new_status}` });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al actualizar estado';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
