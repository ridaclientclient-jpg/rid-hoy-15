import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthClient } from '@/lib/authClient';

// ─── GET: Listar rutas favoritas + destinos recientes inteligentes ──────────
export async function GET(request: Request) {
  try {
    // Auth
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
    const userId = user.id;
    const currentHour = new Date().getHours();

    // Fetch favorite routes
    const { data: favoriteRoutes, error: favError } = await db.rpc(
      'get_favorite_routes',
      { p_user_id: userId }
    );
    if (favError) throw favError;

    // Fetch smart recent destinations
    const { data: recentDestinations, error: recentError } = await db.rpc(
      'get_recent_smart_destinations',
      { p_user_id: userId, p_current_hour: currentHour }
    );
    if (recentError) throw recentError;

    return NextResponse.json({
      success: true,
      favorite_routes: favoriteRoutes || [],
      recent_destinations: recentDestinations || [],
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al obtener rutas favoritas';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─── POST: Guardar nueva ruta favorita ──────────────────────────────────────
export async function POST(request: Request) {
  try {
    // Auth
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
    const body = await request.json();

    // Validate required fields
    const {
      label,
      origin_address,
      origin_lat,
      origin_lng,
      dest_address,
      dest_lat,
      dest_lng,
      typical_price,
      typical_distance_km,
      typical_duration_min,
    } = body;

    if (!label || !origin_address || !dest_address) {
      return NextResponse.json(
        { error: 'Etiqueta, direccion de origen y destino son requeridos' },
        { status: 400 }
      );
    }

    if (origin_lat == null || origin_lng == null || dest_lat == null || dest_lng == null) {
      return NextResponse.json(
        { error: 'Las coordenadas de origen y destino son requeridas' },
        { status: 400 }
      );
    }

    // Save favorite route via RPC
    const { data: savedRoute, error: rpcError } = await db.rpc(
      'save_favorite_route',
      {
        p_user_id: user.id,
        p_label: label,
        p_origin_address: origin_address,
        p_origin_lat: origin_lat,
        p_origin_lng: origin_lng,
        p_dest_address: dest_address,
        p_dest_lat: dest_lat,
        p_dest_lng: dest_lng,
        p_typical_price: typical_price ?? null,
        p_typical_distance_km: typical_distance_km ?? null,
        p_typical_duration_min: typical_duration_min ?? null,
      }
    );

    if (rpcError) throw rpcError;

    return NextResponse.json(
      { success: true, route: savedRoute, message: 'Ruta favorita guardada exitosamente' },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al guardar ruta favorita';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─── DELETE: Eliminar ruta favorita ─────────────────────────────────────────
export async function DELETE(request: Request) {
  try {
    // Auth
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
    const body = await request.json();
    const { route_id } = body;

    if (!route_id) {
      return NextResponse.json(
        { error: 'El ID de la ruta es requerido' },
        { status: 400 }
      );
    }

    // Verify ownership before deleting
    const { data: existingRoute, error: fetchError } = await db
      .from('favorite_routes')
      .select('id, user_id')
      .eq('id', route_id)
      .single();

    if (fetchError || !existingRoute) {
      return NextResponse.json(
        { error: 'Ruta favorita no encontrada' },
        { status: 404 }
      );
    }

    if (existingRoute.user_id !== user.id) {
      return NextResponse.json(
        { error: 'No puedes eliminar una ruta que no te pertenece' },
        { status: 403 }
      );
    }

    // Delete the favorite route
    const { error: deleteError } = await db
      .from('favorite_routes')
      .delete()
      .eq('id', route_id);

    if (deleteError) throw deleteError;

    return NextResponse.json({
      success: true,
      message: 'Ruta favorita eliminada exitosamente',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al eliminar ruta favorita';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
