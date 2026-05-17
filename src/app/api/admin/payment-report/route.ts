import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAdminClient } from '@/lib/adminClient';

export async function GET(request: Request) {
  try {
    // 1. Verify admin auth
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const db = getAdminClient();

    // 2. Verify admin role
    const { data: admin } = await db
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!admin || (admin.role !== 'admin' && admin.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Solo administradores' }, { status: 403 });
    }

    // 3. Fetch completed rides
    const { data: allCompleted, error: ridesErr } = await db
      .from('rides')
      .select('*')
      .eq('status', 'completed')
      .order('created_at', { ascending: false });

    if (ridesErr) throw ridesErr;

    // Build profile maps
    const riderIds = [...new Set((allCompleted || []).map((r: any) => r.rider_id).filter(Boolean))];
    const driverIds = [...new Set((allCompleted || []).map((r: any) => r.driver_id).filter(Boolean))];
    const profileMap: Record<string, string> = {};
    const driverNameMap: Record<string, string> = {};

    if (riderIds.length > 0) {
      const { data: riderProfiles } = await db
        .from('profiles')
        .select('id, name')
        .in('id', riderIds);
      if (riderProfiles) riderProfiles.forEach((p: any) => { profileMap[p.id] = p.name; });
    }

    if (driverIds.length > 0) {
      const { data: driverRecords } = await db
        .from('drivers')
        .select('id, user_id')
        .in('id', driverIds);
      if (driverRecords) {
        const dUserIds = driverRecords.map((d: any) => d.user_id).filter(Boolean);
        if (dUserIds.length > 0) {
          const { data: dProfiles } = await db
            .from('profiles')
            .select('id, name')
            .in('id', dUserIds);
          if (dProfiles) {
            const dMap: Record<string, string> = {};
            dProfiles.forEach((p: any) => { dMap[p.id] = p.name; });
            driverRecords.forEach((d: any) => { driverNameMap[d.id] = dMap[d.user_id || ''] || 'Sin asignar'; });
          }
        }
      }
    }

    const mappedRides = (allCompleted || []).map((r: any) => ({
      id: r.id,
      created_at: r.created_at,
      rider_id: r.rider_id,
      driver_id: r.driver_id,
      price: r.price || 0,
      commission_rate: r.commission_rate || 0.15,
      driver_earnings: r.driver_earnings ?? (r.price || 0) * (1 - (r.commission_rate || 0.15)),
      payment_method: r.payment_method || 'cash',
      payment_status: r.payment_status || 'paid',
      rider_name: profileMap[r.rider_id] || 'Desconocido',
      driver_name: driverNameMap[r.driver_id || ''] || 'Sin asignar',
    }));

    // 4. Fetch daily revenue for last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentRides, error: recentErr } = await db
      .from('rides')
      .select('price, created_at')
      .eq('status', 'completed')
      .gte('created_at', thirtyDaysAgo);

    const dailyRevenue: { date: string; revenue: number }[] = [];
    if (!recentErr && recentRides) {
      const dailyMap: Record<string, number> = {};
      recentRides.forEach((r: any) => {
        const day = r.created_at.split('T')[0];
        dailyMap[day] = (dailyMap[day] || 0) + (r.price || 0);
      });
      for (let i = 29; i >= 0; i--) {
        const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const key = d.toISOString().split('T')[0];
        dailyRevenue.push({ date: key, revenue: dailyMap[key] || 0 });
      }
    }

    // 5. Fetch transactions
    const { data: txData, error: txErr } = await db
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5000);

    let transactions: any[] = [];
    if (!txErr && txData) {
      const walletIds = [...new Set(txData.map((t: any) => t.wallet_id).filter(Boolean))];
      let txUserMap: Record<string, { name: string; phone?: string }> = {};
      let walletsData: { id: string; user_id: string }[] | null = null;

      if (walletIds.length > 0) {
        const { data: wallets } = await db
          .from('wallets')
          .select('id, user_id')
          .in('id', walletIds);
        if (wallets) {
          walletsData = wallets;
          const txUserIds = wallets.map((w: any) => w.user_id).filter(Boolean);
          if (txUserIds.length > 0) {
            const { data: txProfiles } = await db
              .from('profiles')
              .select('id, name, phone')
              .in('id', txUserIds);
            if (txProfiles) {
              txProfiles.forEach((p: any) => { txUserMap[p.id] = { name: p.name, phone: p.phone }; });
            }
          }
        }
      }

      const walletToUser: Record<string, string> = {};
      if (walletsData) {
        walletsData.forEach((w: any) => { walletToUser[w.id] = w.user_id; });
      }

      transactions = txData.map((t: any) => ({
        id: t.id,
        created_at: t.created_at,
        amount: t.amount,
        type: t.type,
        status: t.status,
        description: t.description,
        user_name: txUserMap[walletToUser[t.wallet_id] || '']?.name || 'Desconocido',
      }));
    }

    // 6. Fetch total wallet balances
    const { data: walletBalances, error: walletErr } = await db
      .from('wallets')
      .select('balance');

    const totalWallets = (!walletErr && walletBalances)
      ? walletBalances.reduce((sum: number, w: any) => sum + (w.balance || 0), 0)
      : 0;

    return NextResponse.json({
      rides: mappedRides,
      dailyRevenue,
      transactions,
      totalWallets,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('[Admin Payment Report]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
