import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthClient } from '@/lib/authClient';

// ─── Auth helper ────────────────────────────────────────────────

async function authenticate(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return { user: null, token: null, error: NextResponse.json({ error: 'No autorizado: se requiere token de autenticación' }, { status: 401 }) };
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return { user: null, token: null, error: NextResponse.json({ error: 'No autorizado: token inválido o expirado' }, { status: 401 }) };
  }

  return { user, token, error: null };
}

// ─── POST — Submit detailed ride rating ─────────────────────────

/**
 * POST /api/rides/rating
 * Submits a detailed multi-category rating for a completed ride.
 * Only ride participants (rider or driver) may rate.
 *
 * Body params:
 *   ride_id           — UUID
 *   overall_rating    — 1-5
 *   cleanliness       — 1-5
 *   punctuality       — 1-5
 *   driving_style     — 1-5
 *   communication     — 1-5
 *   navigation        — 1-5
 *   vehicle_condition — 1-5
 *   comment           — string (optional)
 *   tags              — string[] (e.g. ["amable", "musica agradable"])
 */
export async function POST(request: Request) {
  try {
    const auth = await authenticate(request);
    if (auth.error) return auth.error;

    const db = getAuthClient(auth.token!);

    const body = await request.json();

    const {
      ride_id,
      overall_rating,
      cleanliness,
      punctuality,
      driving_style,
      communication,
      navigation,
      vehicle_condition,
      comment,
      tags,
    } = body;

    // ── Validation ──
    if (!ride_id) {
      return NextResponse.json({ error: 'El ID del viaje es requerido' }, { status: 400 });
    }

    if (overall_rating === undefined || overall_rating < 1 || overall_rating > 5) {
      return NextResponse.json(
        { error: 'La calificación general debe ser un valor entre 1 y 5' },
        { status: 400 }
      );
    }

    const categoryFields = { cleanliness, punctuality, driving_style, communication, navigation, vehicle_condition };
    for (const [field, value] of Object.entries(categoryFields)) {
      if (value !== undefined && (value < 1 || value > 5)) {
        return NextResponse.json(
          { error: `El campo ${field} debe ser un valor entre 1 y 5` },
          { status: 400 }
        );
      }
    }

    if (tags && !Array.isArray(tags)) {
      return NextResponse.json(
        { error: 'Las etiquetas deben ser una lista de texto' },
        { status: 400 }
      );
    }

    // ── Verify the user is a participant of the ride ──
    const { data: ride, error: rideError } = await db
      .from('rides')
      .select('rider_id, driver_id, status')
      .eq('id', ride_id)
      .single();

    if (rideError || !ride) {
      return NextResponse.json({ error: 'Viaje no encontrado' }, { status: 404 });
    }

    const isParticipant = auth.user!.id === ride.rider_id || auth.user!.id === ride.driver_id;
    if (!isParticipant) {
      return NextResponse.json(
        { error: 'Solo los participantes del viaje pueden dejar una calificación' },
        { status: 403 }
      );
    }

    if (ride.status !== 'completed') {
      return NextResponse.json(
        { error: 'Solo se pueden calificar viajes completados' },
        { status: 400 }
      );
    }

    // ── Submit detailed rating via RPC ──
    const { data, error } = await db.rpc('submit_detailed_rating', {
      p_ride_id: ride_id,
      p_reviewer_id: auth.user!.id,
      p_overall_rating: overall_rating,
      p_cleanliness: cleanliness ?? null,
      p_punctuality: punctuality ?? null,
      p_driving_style: driving_style ?? null,
      p_communication: communication ?? null,
      p_navigation: navigation ?? null,
      p_vehicle_condition: vehicle_condition ?? null,
      p_comment: comment ?? null,
      p_tags: tags ?? [],
    });

    if (error) {
      console.error('[Rating] submit_detailed_rating RPC error:', error.message);
      return NextResponse.json(
        { error: 'Error al enviar la calificación detallada' },
        { status: 500 }
      );
    }

    const result = Array.isArray(data) ? data[0] : data;

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Calificación enviada exitosamente',
      rating_id: result.rating_id ?? null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al enviar la calificación';
    console.error('[Rating] POST error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─── GET — Driver detailed ratings breakdown ────────────────────

/**
 * GET /api/rides/rating?driver_id=xxx
 * Returns the detailed ratings breakdown for a specific driver.
 *
 * Query params:
 *   driver_id — UUID of the driver
 *
 * Response includes category averages and top tags.
 */
export async function GET(request: Request) {
  try {
    const auth = await authenticate(request);
    if (auth.error) return auth.error;

    const db = getAuthClient(auth.token!);

    const { searchParams } = new URL(request.url);
    const driverId = searchParams.get('driver_id');

    if (!driverId) {
      return NextResponse.json(
        { error: 'El ID del conductor es requerido (parámetro driver_id)' },
        { status: 400 }
      );
    }

    const { data, error } = await db.rpc('get_driver_detailed_ratings', {
      p_driver_id: driverId,
    });

    if (error) {
      console.error('[Rating] get_driver_detailed_ratings RPC error:', error.message);
      return NextResponse.json(
        { error: 'Error al obtener las calificaciones del conductor' },
        { status: 500 }
      );
    }

    const result = Array.isArray(data) ? data[0] : data;

    return NextResponse.json({
      success: true,
      driver_id: driverId,
      ratings: result ?? {},
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al obtener las calificaciones del conductor';
    console.error('[Rating] GET error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
