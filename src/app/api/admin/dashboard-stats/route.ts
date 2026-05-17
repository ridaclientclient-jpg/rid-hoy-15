import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

/**
 * GET /api/admin/dashboard-stats
 *
 * Returns real percentage-change values for the admin dashboard stat cards.
 *
 * Computed comparisons:
 *  - Total users  → new signups this week vs last week
 *  - Rides today   → today (non-cancelled) vs yesterday (non-cancelled)
 *  - Revenue today → completed-ride sum today vs yesterday
 */
export async function GET() {
  try {
    const now = new Date();

    // ── Date boundaries ──────────────────────────────────────────
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);

    // Monday of the current week
    const dayOfWeek = now.getDay(); // 0 = Sun
    const thisWeekStart = new Date(todayStart);
    thisWeekStart.setDate(thisWeekStart.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    // ── Parallel queries ─────────────────────────────────────────
    const [
      usersThisWeekRes,
      usersLastWeekRes,
      ridesTodayRes,
      ridesYesterdayRes,
      revenueTodayRes,
      revenueYesterdayRes,
    ] = await Promise.all([
      // New users this week
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', thisWeekStart.toISOString()),

      // New users last week
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', lastWeekStart.toISOString())
        .lt('created_at', thisWeekStart.toISOString()),

      // Rides today (non-cancelled)
      supabase
        .from('rides')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', todayStart.toISOString())
        .neq('status', 'cancelled'),

      // Rides yesterday (non-cancelled)
      supabase
        .from('rides')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', yesterdayStart.toISOString())
        .lt('created_at', todayStart.toISOString())
        .neq('status', 'cancelled'),

      // Revenue today (completed rides)
      supabase
        .from('rides')
        .select('price')
        .gte('created_at', todayStart.toISOString())
        .eq('status', 'completed'),

      // Revenue yesterday (completed rides)
      supabase
        .from('rides')
        .select('price')
        .gte('created_at', yesterdayStart.toISOString())
        .lt('created_at', todayStart.toISOString())
        .eq('status', 'completed'),
    ]);

    // ── Compute percentage changes ───────────────────────────────
    function computeChange(current: number, previous: number): string | null {
      if (previous === 0 && current === 0) return null;
      if (previous === 0) return current > 0 ? '+100%' : null;
      const pct = ((current - previous) / previous) * 100;
      const rounded = Math.round(pct);
      return rounded >= 0 ? `+${rounded}%` : `${rounded}%`;
    }

    const usersChange = computeChange(
      usersThisWeekRes.count ?? 0,
      usersLastWeekRes.count ?? 0,
    );

    const ridesChange = computeChange(
      ridesTodayRes.count ?? 0,
      ridesYesterdayRes.count ?? 0,
    );

    const revenueTodaySum = (revenueTodayRes.data ?? []).reduce(
      (sum, r) => sum + (r.price ?? 0),
      0,
    );
    const revenueYesterdaySum = (revenueYesterdayRes.data ?? []).reduce(
      (sum, r) => sum + (r.price ?? 0),
      0,
    );
    const revenueChange = computeChange(revenueTodaySum, revenueYesterdaySum);

    return NextResponse.json({
      usersChange,
      ridesChange,
      revenueChange,
    });
  } catch (error) {
    console.error('Error computing dashboard stats:', error);
    // Return nulls so the UI falls back to showing "—"
    return NextResponse.json({
      usersChange: null,
      ridesChange: null,
      revenueChange: null,
    });
  }
}
