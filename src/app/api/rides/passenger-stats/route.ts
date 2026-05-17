import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthClient } from '@/lib/authClient';

/**
 * GET /api/rides/passenger-stats?month=YYYY-MM
 *
 * Returns monthly spending statistics for the authenticated passenger.
 * Uses the Supabase RPC `get_monthly_passenger_stats`.
 *
 * Query params:
 *   month — optional, format "YYYY-MM", defaults to current month.
 */
export async function GET(request: Request) {
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

    // ── Parse month param ───────────────────────────────────────
    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get('month');

    let year: number;
    let month: number;

    if (monthParam) {
      // Validate YYYY-MM format
      const match = monthParam.match(/^(\d{4})-(\d{2})$/);
      if (!match) {
        return NextResponse.json(
          { error: 'Formato de mes inválido. Use el formato YYYY-MM (ejemplo: 2025-01)' },
          { status: 400 },
        );
      }

      year = parseInt(match[1], 10);
      month = parseInt(match[2], 10);

      if (month < 1 || month > 12) {
        return NextResponse.json(
          { error: 'Mes inválido. Debe ser un valor entre 01 y 12' },
          { status: 400 },
        );
      }
    } else {
      const now = new Date();
      year = now.getFullYear();
      month = now.getMonth() + 1; // getMonth() is 0-indexed
    }

    const formattedMonth = `${year}-${String(month).padStart(2, '0')}`;

    // ── Call RPC ────────────────────────────────────────────────
    const { data: stats, error: rpcError } = await db.rpc(
      'get_monthly_passenger_stats',
      {
        p_user_id: user.id,
        p_month: formattedMonth,
      },
    );

    if (rpcError) {
      console.error('Error en RPC get_monthly_passenger_stats:', rpcError.message);
      return NextResponse.json(
        { error: `Error al obtener estadísticas del pasajero: ${rpcError.message}` },
        { status: 500 },
      );
    }

    // ── Build response ──────────────────────────────────────────
    const totalRides = stats?.total_rides ?? 0;
    const totalSpent = stats?.total_spent ?? 0;
    const totalTips = stats?.total_tips ?? 0;
    const totalDistanceKm = stats?.total_distance_km ?? 0;
    const avgFare = stats?.avg_fare ?? 0;
    const completed = stats?.completed ?? 0;
    const cancelled = stats?.cancelled ?? 0;
    const mostCommonType = stats?.most_common_type ?? null;

    return NextResponse.json({
      success: true,
      period: formattedMonth,
      currency: 'CRC',
      stats: {
        total_rides: totalRides,
        total_spent: totalSpent,
        total_spent_formatted: `₡${totalSpent.toLocaleString('es-CR')}`,
        total_tips: totalTips,
        total_tips_formatted: `₡${totalTips.toLocaleString('es-CR')}`,
        total_distance_km: Math.round(totalDistanceKm * 10) / 10,
        avg_fare: Math.round(avgFare),
        avg_fare_formatted: `₡${Math.round(avgFare).toLocaleString('es-CR')}`,
        completed,
        cancelled,
        cancellation_rate:
          totalRides > 0
            ? Math.round((cancelled / totalRides) * 100 * 10) / 10
            : 0,
        most_common_type: mostCommonType,
      },
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : 'Error al obtener las estadísticas del pasajero';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
