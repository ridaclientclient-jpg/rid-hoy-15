import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

/** Accepted period values */
const VALID_PERIODS = ['today', 'week', 'month', 'year'] as const;
type Period = (typeof VALID_PERIODS)[number];

/**
 * GET /api/drivers/earnings-detail?period=today|week|month|year
 *
 * Returns a detailed earnings breakdown for the authenticated driver.
 * Uses the Supabase RPC `get_driver_earnings_detail`.
 *
 * Query params:
 *   period — 'today' | 'week' | 'month' | 'year' (default: 'week')
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

    // ── Create authenticated Supabase client with user JWT ─────
    // This is critical: the default supabase client uses the anon key,
    // so RLS policies evaluating auth.uid() would return null.
    // By creating a client with the user's JWT, auth.uid() resolves correctly.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    // ── Parse period param ──────────────────────────────────────
    const { searchParams } = new URL(request.url);
    const rawPeriod = searchParams.get('period') ?? 'week';

    if (!VALID_PERIODS.includes(rawPeriod as Period)) {
      return NextResponse.json(
        {
          error:
            'Período inválido. Los valores permitidos son: today, week, month, year',
        },
        { status: 400 },
      );
    }

    const period = rawPeriod as Period;

    // ── Get driver record ───────────────────────────────────────
    const { data: driver, error: driverError } = await authClient
      .from('drivers')
      .select('id, user_id, status')
      .eq('user_id', user.id)
      .single();

    if (driverError || !driver) {
      return NextResponse.json(
        { error: 'Perfil de conductor no encontrado' },
        { status: 404 },
      );
    }

    // ── Call RPC ────────────────────────────────────────────────
    const { data: rpcResult, error: rpcError } = await authClient.rpc(
      'get_driver_earnings_detail',
      {
        p_driver_id: driver.id,
        p_period: period,
      },
    );

    if (rpcError) {
      console.error('Error en RPC get_driver_earnings_detail:', rpcError.message);
      return NextResponse.json(
        { error: `Error al obtener detalle de ganancias: ${rpcError.message}` },
        { status: 500 },
      );
    }

    // ── Build response ──────────────────────────────────────────
    const daily: Array<{
      date: string;
      rides: number;
      earnings: number;
      tips: number;
      distance: number;
      avg_fare: number;
    }> = (rpcResult?.daily ?? []).map((d: Record<string, unknown>) => ({
      date: d.date as string,
      rides: (d.rides as number) ?? 0,
      earnings: (d.earnings as number) ?? 0,
      tips: (d.tips as number) ?? 0,
      distance: Math.round(((d.distance as number) ?? 0) * 10) / 10,
      avg_fare: Math.round((d.avg_fare as number) ?? 0),
    }));

    const totalRides = rpcResult?.total_rides ?? 0;
    const totalEarnings = rpcResult?.total_earnings ?? 0;
    const totalTips = rpcResult?.total_tips ?? 0;
    const totalDistance = rpcResult?.total_distance_km ?? 0;

    return NextResponse.json({
      success: true,
      period,
      currency: 'CRC',
      driver_id: driver.id,
      daily,
      summary: {
        total_rides: totalRides,
        total_earnings: totalEarnings,
        total_earnings_formatted: `₡${Math.round(totalEarnings).toLocaleString('es-CR')}`,
        total_tips: totalTips,
        total_tips_formatted: `₡${Math.round(totalTips).toLocaleString('es-CR')}`,
        total_distance_km: Math.round(totalDistance * 10) / 10,
        avg_daily_earnings:
          daily.length > 0
            ? Math.round(totalEarnings / daily.length)
            : 0,
        avg_daily_earnings_formatted:
          daily.length > 0
            ? `₡${Math.round(totalEarnings / daily.length).toLocaleString('es-CR')}`
            : '₡0',
        avg_fare:
          totalRides > 0
            ? Math.round(totalEarnings / totalRides)
            : 0,
        avg_fare_formatted:
          totalRides > 0
            ? `₡${Math.round(totalEarnings / totalRides).toLocaleString('es-CR')}`
            : '₡0',
      },
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : 'Error al obtener el detalle de ganancias';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
