import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthClient } from '@/lib/authClient';

/**
 * GET /api/drivers/metrics
 * Returns performance metrics for the authenticated driver
 */
export async function GET(request: Request) {
  try {
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

    const { data: driver, error: driverError } = await db
      .from('drivers')
      .select('id, rating, total_rides, total_earnings, weekly_rides, weekly_earnings, weekly_rating, weekly_acceptance_rate, total_accepted, total_cancelled, destination_mode, daily_goal')
      .eq('user_id', user.id)
      .single();

    if (driverError || !driver) {
      return NextResponse.json({ error: 'Conductor no encontrado' }, { status: 404 });
    }

    // Get today's stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: todayRides } = await db
      .from('rides')
      .select('id, status, driver_earnings, price, rating, created_at, completed_at')
      .eq('driver_id', driver.id)
      .gte('created_at', today.toISOString());

    const completedToday = todayRides?.filter(r => r.status === 'completed') || [];
    const cancelledToday = todayRides?.filter(r => r.status === 'cancelled') || [];
    const todayEarnings = completedToday.reduce((sum, r) => sum + (r.driver_earnings || 0), 0);
    const todayRatings = completedToday.filter(r => r.rating > 0);
    const avgRatingToday = todayRatings.length > 0
      ? todayRatings.reduce((sum, r) => sum + r.rating, 0) / todayRatings.length
      : 0;

    // Calculate average ride duration today
    const durationsToday = completedToday
      .filter(r => r.created_at && r.completed_at)
      .map(r => {
        const start = new Date(r.created_at).getTime();
        const end = new Date(r.completed_at!).getTime();
        return (end - start) / 60000; // minutes
      });
    const avgDuration = durationsToday.length > 0
      ? Math.round(durationsToday.reduce((a, b) => a + b, 0) / durationsToday.length)
      : 0;

    // Get this week's streak
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const { data: weekRides } = await db
      .from('rides')
      .select('created_at::date as ride_date')
      .eq('driver_id', driver.id)
      .eq('status', 'completed')
      .gte('created_at', weekAgo.toISOString());

    const uniqueDays = new Set(weekRides?.map(r => r.ride_date) || []);

    return NextResponse.json({
      success: true,
      driver: {
        id: driver.id,
        overall_rating: driver.rating || 0,
        today_rating: Number(avgRatingToday.toFixed(2)),
        total_rides: driver.total_rides || 0,
        total_earnings: driver.total_earnings || 0,
        daily_goal: driver.daily_goal || 50000,
        destination_mode: driver.destination_mode || false,
      },
      today: {
        rides: completedToday.length,
        cancelled: cancelledToday.length,
        earnings: todayEarnings,
        total_requests: (todayRides?.length || 0),
        acceptance_rate: (todayRides?.length || 0) > 0
          ? Number(((completedToday.length / todayRides.length) * 100).toFixed(1))
          : 100,
        avg_duration_min: avgDuration,
      },
      weekly: {
        rides: driver.weekly_rides || 0,
        earnings: driver.weekly_earnings || 0,
        rating: driver.weekly_rating || 0,
        acceptance_rate: driver.weekly_acceptance_rate || 100,
        active_days: uniqueDays.size,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al obtener metricas';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
