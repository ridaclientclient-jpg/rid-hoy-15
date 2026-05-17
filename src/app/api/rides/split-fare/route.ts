import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthClient } from '@/lib/authClient';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function authenticate(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return { user: null, token: null, error: NextResponse.json({ error: 'No autorizado: se requiere token de acceso' }, { status: 401 }) };
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return { user: null, token: null, error: NextResponse.json({ error: 'No autorizado: token inválido o expirado' }, { status: 401 }) };
  }

  return { user, token, error: null };
}

function serverError(message: string) {
  return NextResponse.json({ error: message }, { status: 500 });
}

// ─── POST: Split a ride fare among passengers ─────────────────────────────────

export async function POST(request: Request) {
  try {
    const { user, token, error: authErr } = await authenticate(request);
    if (authErr) return authErr;

    const db = getAuthClient(token!);

    const { ride_id, user_ids, percentages } = await request.json();

    // ── Validation ─────────────────────────────────────────────
    if (!ride_id || !user_ids || !percentages) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: ride_id, user_ids y percentages son obligatorios' },
        { status: 400 },
      );
    }

    if (!Array.isArray(user_ids) || user_ids.length === 0) {
      return NextResponse.json(
        { error: 'user_ids debe ser un arreglo con al menos un UUID' },
        { status: 400 },
      );
    }

    if (!Array.isArray(percentages) || percentages.length === 0) {
      return NextResponse.json(
        { error: 'percentages debe ser un arreglo con al menos un valor numérico' },
        { status: 400 },
      );
    }

    if (user_ids.length !== percentages.length) {
      return NextResponse.json(
        { error: 'La cantidad de user_ids no coincide con la cantidad de percentages' },
        { status: 400 },
      );
    }

    const totalPercentage = percentages.reduce((sum: number, p: number) => sum + p, 0);
    if (totalPercentage !== 100) {
      return NextResponse.json(
        { error: `Los porcentajes deben sumar exactamente 100. Total actual: ${totalPercentage}%` },
        { status: 400 },
      );
    }

    for (const percentage of percentages) {
      if (typeof percentage !== 'number' || percentage <= 0 || percentage > 100) {
        return NextResponse.json(
          { error: 'Cada porcentaje debe ser un número mayor a 0 y menor o igual a 100' },
          { status: 400 },
        );
      }
    }

    // ── Verify the ride belongs to the current user ────────────
    const { data: ride, error: rideError } = await db
      .from('rides')
      .select('id, rider_id, status, price, origin, destination')
      .eq('id', ride_id)
      .single();

    if (rideError || !ride) {
      return NextResponse.json({ error: 'Viaje no encontrado' }, { status: 404 });
    }

    if (ride.rider_id !== user!.id) {
      return NextResponse.json(
        { error: 'Solo el pasajero que creó el viaje puede dividir la tarifa' },
        { status: 403 },
      );
    }

    const allowedStatuses = ['assigned', 'arriving', 'started'];
    if (!allowedStatuses.includes(ride.status)) {
      return NextResponse.json(
        { error: `La tarifa solo puede dividirse cuando el viaje está en estado: ${allowedStatuses.join(', ')}. Estado actual: ${ride.status}` },
        { status: 400 },
      );
    }

    // ── Call RPC to split the fare ─────────────────────────────
    const { data, error: rpcError } = await db.rpc('split_ride_fare', {
      p_ride_id: ride_id,
      p_user_ids: user_ids,
      p_percentages: percentages,
    });

    if (rpcError) {
      console.error('[SplitFare] RPC error:', rpcError.message);
      return NextResponse.json(
        { error: `Error al dividir la tarifa: ${rpcError.message}` },
        { status: 500 },
      );
    }

    const result = Array.isArray(data) ? data[0] : data;

    if (result && !result.success) {
      return NextResponse.json({ error: result.message || 'No se pudo dividir la tarifa' }, { status: 400 });
    }

    // ── Notify each invited user ───────────────────────────────
    for (const userId of user_ids) {
      const sharePercent = percentages[user_ids.indexOf(userId)];
      const shareAmount = Math.round(ride.price * (sharePercent / 100));

      await db.from('notifications').insert({
        user_id: userId,
        title: 'Invitación a dividir tarifa',
        message: `Has sido invitado a pagar ₡${shareAmount.toLocaleString('es-CR')} (${sharePercent}%) del viaje de ${ride.origin} a ${ride.destination}.`,
        type: 'payment',
        data: { ride_id, share_percent: sharePercent, share_amount: shareAmount },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Tarifa dividida exitosamente',
      ride_id,
      splits: result?.splits ?? result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al dividir la tarifa del viaje';
    console.error('[SplitFare]', message);
    return serverError(message);
  }
}

// ─── GET: Retrieve split info and invites for a ride ──────────────────────────

export async function GET(request: Request) {
  try {
    const { user, token, error: authErr } = await authenticate(request);
    if (authErr) return authErr;

    const db = getAuthClient(token!);

    const { searchParams } = new URL(request.url);
    const ride_id = searchParams.get('ride_id');

    if (!ride_id) {
      return NextResponse.json(
        { error: 'El parámetro ride_id es requerido en la consulta' },
        { status: 400 },
      );
    }

    // ── Verify the user is involved in this ride ───────────────
    const { data: ride, error: rideError } = await db
      .from('rides')
      .select('id, rider_id, driver_id, status, price, origin, destination, created_at')
      .eq('id', ride_id)
      .single();

    if (rideError || !ride) {
      return NextResponse.json({ error: 'Viaje no encontrado' }, { status: 404 });
    }

    const isRider = ride.rider_id === user!.id;
    const isDriver = ride.driver_id === user!.id;

    // Check if user is an invited split participant
    let isInvitee = false;
    if (!isRider && !isDriver) {
      const { data: inviteCheck } = await db
        .from('fare_split_invites')
        .select('id')
        .eq('ride_id', ride_id)
        .eq('user_id', user!.id)
        .maybeSingle();
      isInvitee = !!inviteCheck;
    }

    if (!isRider && !isDriver && !isInvitee) {
      return NextResponse.json(
        { error: 'No tienes permiso para ver la información de este viaje' },
        { status: 403 },
      );
    }

    // ── Fetch fare splits ──────────────────────────────────────
    const { data: splits, error: splitsError } = await db
      .from('ride_fare_splits')
      .select(`
        *,
        profiles:user_id (
          id,
          name,
          avatar
        )
      `)
      .eq('ride_id', ride_id)
      .order('percentage', { ascending: false });

    if (splitsError) {
      console.error('[SplitFare/GET] Error fetching splits:', splitsError.message);
      return serverError('Error al obtener la información de la división de tarifa');
    }

    // ── Fetch split invites ────────────────────────────────────
    const { data: invites, error: invitesError } = await db
      .from('fare_split_invites')
      .select(`
        *,
        profiles:user_id (
          id,
          name,
          avatar
        )
      `)
      .eq('ride_id', ride_id)
      .order('created_at', { ascending: true });

    if (invitesError) {
      console.error('[SplitFare/GET] Error fetching invites:', invitesError.message);
      return serverError('Error al obtener las invitaciones de división de tarifa');
    }

    // ── Enrich splits with calculated CRC amounts ──────────────
    const enrichedSplits = (splits ?? []).map((split) => ({
      ...split,
      amount_crc: Math.round(ride.price * (split.percentage / 100)),
      amount_formatted: `₡${Math.round(ride.price * (split.percentage / 100)).toLocaleString('es-CR')}`,
      percentage_label: `${split.percentage}%`,
    }));

    const enrichedInvites = (invites ?? []).map((invite) => ({
      ...invite,
      amount_crc: Math.round(ride.price * (invite.percentage / 100)),
      amount_formatted: `₡${Math.round(ride.price * (invite.percentage / 100)).toLocaleString('es-CR')}`,
      percentage_label: `${invite.percentage}%`,
    }));

    const paidTotal = enrichedSplits
      .filter((s) => s.status === 'paid')
      .reduce((sum, s) => sum + s.amount_crc, 0);

    return NextResponse.json({
      success: true,
      ride: {
        id: ride.id,
        status: ride.status,
        price: ride.price,
        price_formatted: `₡${ride.price.toLocaleString('es-CR')}`,
        origin: ride.origin,
        destination: ride.destination,
        created_at: ride.created_at,
      },
      splits: enrichedSplits,
      invites: enrichedInvites,
      summary: {
        total_fare_crc: ride.price,
        total_fare_formatted: `₡${ride.price.toLocaleString('es-CR')}`,
        total_splits: enrichedSplits.length,
        total_invites: enrichedInvites.length,
        paid_splits: enrichedSplits.filter((s) => s.status === 'paid').length,
        pending_invites: enrichedInvites.filter((i) => i.status === 'pending').length,
        paid_total_crc: paidTotal,
        paid_total_formatted: `₡${paidTotal.toLocaleString('es-CR')}`,
        remaining_crc: ride.price - paidTotal,
        remaining_formatted: `₡${(ride.price - paidTotal).toLocaleString('es-CR')}`,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al obtener la información de la tarifa';
    console.error('[SplitFare/GET]', message);
    return serverError(message);
  }
}

// ─── PATCH: Accept (paid) or decline a split invite ───────────────────────────

export async function PATCH(request: Request) {
  try {
    const { user, token, error: authErr } = await authenticate(request);
    if (authErr) return authErr;

    const db = getAuthClient(token!);

    const { split_id, action } = await request.json();

    // ── Validation ─────────────────────────────────────────────
    if (!split_id) {
      return NextResponse.json(
        { error: 'El campo split_id es requerido' },
        { status: 400 },
      );
    }

    if (!action || !['paid', 'declined'].includes(action)) {
      return NextResponse.json(
        { error: 'La acción debe ser "paid" o "declined"' },
        { status: 400 },
      );
    }

    // ── Fetch the invite and verify ownership ──────────────────
    const { data: invite, error: inviteError } = await db
      .from('fare_split_invites')
      .select('id, ride_id, user_id, percentage, status')
      .eq('id', split_id)
      .single();

    if (inviteError || !invite) {
      return NextResponse.json({ error: 'Invitación de división no encontrada' }, { status: 404 });
    }

    if (invite.user_id !== user!.id) {
      return NextResponse.json(
        { error: 'Solo el usuario invitado puede aceptar o rechazar esta división' },
        { status: 403 },
      );
    }

    if (invite.status !== 'pending') {
      return NextResponse.json(
        { error: `Esta invitación ya fue procesada. Estado actual: ${invite.status}` },
        { status: 400 },
      );
    }

    // ── Get ride info for the notification ─────────────────────
    const { data: ride } = await db
      .from('rides')
      .select('id, rider_id, price, origin, destination')
      .eq('id', invite.ride_id)
      .single();

    // ── Update invite status ───────────────────────────────────
    const newStatus = action === 'paid' ? 'paid' : 'declined';

    const { data: updatedInvite, error: updateError } = await db
      .from('fare_split_invites')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', split_id)
      .select(`
        *,
        profiles:user_id (id, name, avatar)
      `)
      .single();

    if (updateError) {
      console.error('[SplitFare/PATCH] Update error:', updateError.message);
      return serverError('Error al actualizar el estado de la invitación');
    }

    // ── If accepted (paid), also create/update the fare split ──
    if (action === 'paid' && ride) {
      const shareAmount = Math.round(ride.price * (invite.percentage / 100));

      await db
        .from('ride_fare_splits')
        .upsert({
          ride_id: invite.ride_id,
          user_id: invite.user_id,
          percentage: invite.percentage,
          amount: shareAmount,
          status: 'paid',
        }, { onConflict: 'ride_id,user_id' });
    }

    // ── Notify the ride owner ──────────────────────────────────
    if (ride) {
      const shareAmount = Math.round(ride.price * (invite.percentage / 100));

      await db.from('notifications').insert({
        user_id: ride.rider_id,
        title: action === 'paid'
          ? 'División de tarifa aceptada'
          : 'División de tarifa rechazada',
        message: action === 'paid'
          ? `Un pasajero aceptó pagar ₡${shareAmount.toLocaleString('es-CR')} (${invite.percentage}%) del viaje a ${ride.destination}.`
          : `Un pasajero rechazó la invitación para dividir ₡${shareAmount.toLocaleString('es-CR')} del viaje a ${ride.destination}.`,
        type: 'payment',
        data: { ride_id: ride.id, split_id, action },
      });
    }

    return NextResponse.json({
      success: true,
      message: action === 'paid'
        ? 'Has aceptado la división de tarifa exitosamente'
        : 'Has rechazado la invitación de división de tarifa',
      invite: {
        ...updatedInvite,
        amount_crc: ride ? Math.round(ride.price * (invite.percentage / 100)) : 0,
        amount_formatted: ride
          ? `₡${Math.round(ride.price * (invite.percentage / 100)).toLocaleString('es-CR')}`
          : '₡0',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al procesar la solicitud de división';
    console.error('[SplitFare/PATCH]', message);
    return serverError(message);
  }
}
