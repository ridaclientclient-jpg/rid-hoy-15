import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * GET /api/leaderboard?period=week&limit=20
 * Returns driver leaderboard for admin or public view
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'week';
    const limit = parseInt(searchParams.get('limit') || '20');

    const { data, error } = await supabase.rpc('get_driver_leaderboard', {
      p_period: period,
      p_limit: limit,
    });

    if (error) {
      console.error('[Leaderboard] RPC error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      period,
      drivers: (data || []).map((d: any) => ({
        rank: d.rank,
        driver_id: d.driver_id,
        driver_name: d.driver_name || 'Conductor',
        avatar_url: d.avatar_url,
        vehicle: d.vehicle_model ? `${d.vehicle_model} ${d.vehicle_color || ''}`.trim() : null,
        plate: d.vehicle_plate,
        total_rides: d.total_rides || 0,
        total_earnings: Number(d.total_earnings || 0),
        avg_rating: Number(d.avg_rating || 0),
        acceptance_rate: Number(d.acceptance_rate || 100),
        level: d.level_name || 'Basico',
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al obtener leaderboard';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
