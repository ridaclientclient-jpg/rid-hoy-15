import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthClient } from '@/lib/authClient';

/**
 * POST /api/drivers/destination-mode
 * Toggle destination mode for drivers — only receive rides along their route
 */
export async function POST(request: Request) {
  try {
    const { enabled, destLat, destLng, destinationAddress } = await request.json();

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
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (driverError || !driver) {
      return NextResponse.json({ error: 'Conductor no encontrado' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {
      destination_mode: enabled,
    };

    if (enabled) {
      if (!destLat || !destLng) {
        return NextResponse.json({ error: 'Coordenadas de destino requeridas' }, { status: 400 });
      }
      updateData.dest_lat = destLat;
      updateData.dest_lng = destLng;
      updateData.destination_address = destinationAddress || null;
    } else {
      updateData.dest_lat = null;
      updateData.dest_lng = null;
      updateData.destination_address = null;
    }

    const { error: updateError } = await db
      .from('drivers')
      .update(updateData)
      .eq('id', driver.id);

    if (updateError) {
      console.error('[DestinationMode] Error:', updateError.message);
      return NextResponse.json({ error: 'Error al actualizar destino' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: enabled ? 'Modo destino activado — solo recibiras viajes en tu ruta' : 'Modo destino desactivado — recibiras todos los viajes',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al actualizar destino';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
