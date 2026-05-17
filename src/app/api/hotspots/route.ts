import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * GET /api/hotspots
 * Returns active demand hotspots for drivers.
 * Public endpoint — no auth required.
 *
 * Query params:
 *   ?calculate=true  — forces a fresh recalculation before returning results
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const shouldCalculate = searchParams.get('calculate') === 'true';

    // Optionally trigger a fresh hotspot calculation first
    if (shouldCalculate) {
      const { error: calcError } = await supabase.rpc('calculate_demand_hotspots');

      if (calcError) {
        console.error('[Hotspots] calculate_demand_hotspots RPC error:', calcError.message);
        return NextResponse.json(
          { error: 'Error al recalcular los puntos de alta demanda' },
          { status: 500 }
        );
      }
    }

    // Fetch active demand hotspots
    const { data, error } = await supabase.rpc('get_demand_hotspots');

    if (error) {
      console.error('[Hotspots] get_demand_hotspots RPC error:', error.message);
      return NextResponse.json(
        { error: 'Error al obtener los puntos de alta demanda' },
        { status: 500 }
      );
    }

    const hotspots = Array.isArray(data) ? data : data ? [data] : [];

    return NextResponse.json({
      success: true,
      hotspots,
      count: hotspots.length,
      calculated: shouldCalculate,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al obtener puntos de alta demanda';
    console.error('[Hotspots] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
