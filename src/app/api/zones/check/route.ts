import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * GET /api/zones/check?lat=9.9281&lng=-84.0907
 * Returns zones that contain the given point, including restrictions and surge multipliers.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = parseFloat(searchParams.get('lat') || '');
    const lng = parseFloat(searchParams.get('lng') || '');

    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 });
    }

    // Use the RPC function for point-in-polygon check
    const { data: zones, error: zonesError } = await supabase.rpc('get_zones_for_point', {
      p_lat: lat,
      p_lng: lng,
    });

    if (zonesError) {
      console.error('get_zones_for_point error:', zonesError.message);
      return NextResponse.json({
        zones: [],
        is_restricted: false,
        max_surge: 1.00,
      });
    }

    // Check restrictions
    const { data: restrictions, error: restError } = await supabase.rpc('check_point_restriction', {
      p_lat: lat,
      p_lng: lng,
    });

    // Get max surge from surge_zones only
    const surgeZones = (zones || []).filter((z: any) => z.area_type === 'surge_zone');
    const maxSurge = surgeZones.length > 0
      ? Math.max(...surgeZones.map((z: any) => z.surge_multiplier || 1))
      : 1.00;

    return NextResponse.json({
      zones: zones || [],
      is_restricted: (restrictions || []).length > 0,
      restrictions: restrictions || [],
      max_surge: maxSurge,
    });
  } catch (err: any) {
    console.error('Zone check error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
