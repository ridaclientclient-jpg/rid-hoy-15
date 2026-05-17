import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// This API route is used to seed demo heat map data
// It must be called by an authenticated admin user
export async function POST(request: Request) {
  try {
    // Get the user's session from the Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No authorization header' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');

    // Create a Supabase client with the user's token to verify admin role
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Check admin role
    const { data: profile } = await userClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Generate demo heat map data points for Costa Rica
    const points: Array<{
      latitude: number;
      longitude: number;
      weight: number;
      location_type: string;
    }> = [
      // San José Centro - highest demand
      { latitude: 9.9281, longitude: -84.0907, weight: 8, location_type: 'pickup' },
      { latitude: 9.9295, longitude: -84.0880, weight: 7, location_type: 'pickup' },
      { latitude: 9.9270, longitude: -84.0885, weight: 9, location_type: 'pickup' },
      { latitude: 9.9300, longitude: -84.0900, weight: 7, location_type: 'pickup' },
      { latitude: 9.9310, longitude: -84.0920, weight: 5, location_type: 'dropoff' },
      { latitude: 9.9290, longitude: -84.0910, weight: 8, location_type: 'dropoff' },
      { latitude: 9.9265, longitude: -84.0855, weight: 6, location_type: 'search' },
      { latitude: 9.9330, longitude: -84.0945, weight: 9, location_type: 'pickup' },
      { latitude: 9.9285, longitude: -84.0895, weight: 5, location_type: 'search' },
      { latitude: 9.9315, longitude: -84.0870, weight: 4, location_type: 'dropoff' },
      // Paseo Colón
      { latitude: 9.9335, longitude: -84.0765, weight: 7, location_type: 'pickup' },
      { latitude: 9.9320, longitude: -84.0750, weight: 6, location_type: 'dropoff' },
      { latitude: 9.9340, longitude: -84.0775, weight: 5, location_type: 'pickup' },
      { latitude: 9.9310, longitude: -84.0740, weight: 4, location_type: 'dropoff' },
      { latitude: 9.9325, longitude: -84.0760, weight: 3, location_type: 'search' },
      // Sabana / Hospital
      { latitude: 9.9360, longitude: -84.0970, weight: 5, location_type: 'pickup' },
      { latitude: 9.9345, longitude: -84.0955, weight: 4, location_type: 'dropoff' },
      { latitude: 9.9375, longitude: -84.0985, weight: 3, location_type: 'pickup' },
      { latitude: 9.9355, longitude: -84.0735, weight: 4, location_type: 'pickup' },
      { latitude: 9.9340, longitude: -84.0720, weight: 3, location_type: 'dropoff' },
      // Multiplaza
      { latitude: 9.9260, longitude: -84.1010, weight: 6, location_type: 'pickup' },
      { latitude: 9.9250, longitude: -84.1000, weight: 7, location_type: 'dropoff' },
      { latitude: 9.9270, longitude: -84.1020, weight: 4, location_type: 'search' },
      // Escazú
      { latitude: 9.9200, longitude: -84.1400, weight: 5, location_type: 'pickup' },
      { latitude: 9.9180, longitude: -84.1380, weight: 4, location_type: 'dropoff' },
      { latitude: 9.9215, longitude: -84.1420, weight: 3, location_type: 'search' },
      { latitude: 9.9190, longitude: -84.1390, weight: 3, location_type: 'pickup' },
      // Santa Ana
      { latitude: 9.9330, longitude: -84.1800, weight: 6, location_type: 'pickup' },
      { latitude: 9.9310, longitude: -84.1780, weight: 5, location_type: 'dropoff' },
      { latitude: 9.9350, longitude: -84.1820, weight: 4, location_type: 'search' },
      { latitude: 9.9320, longitude: -84.1790, weight: 3, location_type: 'pickup' },
      { latitude: 9.9340, longitude: -84.1810, weight: 4, location_type: 'dropoff' },
      // Heredia
      { latitude: 9.9980, longitude: -84.1170, weight: 5, location_type: 'pickup' },
      { latitude: 9.9995, longitude: -84.1190, weight: 4, location_type: 'dropoff' },
      { latitude: 9.9965, longitude: -84.1150, weight: 5, location_type: 'pickup' },
      { latitude: 10.0010, longitude: -84.1210, weight: 3, location_type: 'search' },
      { latitude: 9.9975, longitude: -84.1180, weight: 4, location_type: 'dropoff' },
      // Alajuela
      { latitude: 10.0160, longitude: -84.2140, weight: 5, location_type: 'pickup' },
      { latitude: 10.0145, longitude: -84.2120, weight: 4, location_type: 'dropoff' },
      { latitude: 10.0175, longitude: -84.2160, weight: 4, location_type: 'pickup' },
      { latitude: 10.0150, longitude: -84.2130, weight: 3, location_type: 'search' },
      { latitude: 10.0185, longitude: -84.2170, weight: 3, location_type: 'dropoff' },
      // Cartago
      { latitude: 9.8630, longitude: -83.9270, weight: 4, location_type: 'pickup' },
      { latitude: 9.8645, longitude: -83.9290, weight: 3, location_type: 'dropoff' },
      { latitude: 9.8620, longitude: -83.9255, weight: 3, location_type: 'pickup' },
      { latitude: 9.8655, longitude: -83.9305, weight: 2, location_type: 'search' },
      // Extra density for SJ Centro
      { latitude: 9.9290, longitude: -84.0890, weight: 6, location_type: 'pickup' },
      { latitude: 9.9305, longitude: -84.0905, weight: 5, location_type: 'dropoff' },
      { latitude: 9.9275, longitude: -84.0875, weight: 4, location_type: 'search' },
      { latitude: 9.9325, longitude: -84.0915, weight: 7, location_type: 'pickup' },
      { latitude: 9.9280, longitude: -84.0860, weight: 5, location_type: 'pickup' },
      { latitude: 9.9315, longitude: -84.0895, weight: 4, location_type: 'dropoff' },
    ];

    // Insert using the user's authenticated client (RLS allows admins to insert)
    const { error } = await userClient.from('heat_map_data').insert(points);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Verify count
    const { count } = await userClient
      .from('heat_map_data')
      .select('*', { count: 'exact', head: true });

    return NextResponse.json({
      success: true,
      inserted: points.length,
      total: count,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
