import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getSupabase() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

async function verifyAdmin(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.replace('Bearer ', '');
  const sb = getSupabase();
  const { data: { user }, error: authError } = await sb.auth.getUser(token);
  if (authError || !user) return null;

  // 1. Check role from JWT metadata (fast, no DB query, bypasses RLS)
  const jwtRole = user.user_metadata?.role || user.app_metadata?.role;
  if (jwtRole === 'admin' || jwtRole === 'super_admin') {
    return { user, profile: { role: jwtRole, name: user.user_metadata?.name || '' } };
  }

  // 2. Set session context so RLS works for profiles query
  await sb.auth.setSession({ access_token: token, refresh_token: token });

  const { data: profile } = await sb
    .from('profiles')
    .select('role, name')
    .eq('id', user.id)
    .single();

  if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) return null;
  return { user, profile };
}

// GET: Fetch all reports with profile info
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (!auth) {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  }

  const supabase = getSupabase();

  try {
    // Use SECURITY DEFINER function to bypass RLS
    const { data, error } = await supabase.rpc('admin_get_all_reports');

    if (error) {
      console.error('[Admin Reports API] RPC error:', error.code, error.message);

      // Table might not exist
      if (error.message?.includes('does not exist') || error.code === '42883') {
        return NextResponse.json({
          reports: [],
          warning: 'Funcion admin_get_all_reports no existe. Ejecuta el SQL en Supabase.'
        });
      }

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Enrich with profile names
    const reports = data || [];
    const userIds = [...new Set(reports.map((r: any) => r.user_id).filter(Boolean))];
    const profileMap: Record<string, string> = {};

    if (userIds.length > 0) {
      // Set session for RLS context
      const authHeader = request.headers.get('Authorization');
      const token = authHeader?.replace('Bearer ', '') || '';
      if (token) await supabase.auth.setSession({ access_token: token, refresh_token: token });

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', userIds);
      if (profiles) {
        profiles.forEach((p: any) => { profileMap[p.id] = p.name; });
      }
    }

    const enriched = reports.map((r: any) => ({
      ...r,
      profiles: { name: profileMap[r.user_id] || 'Usuario desconocido' }
    }));

    return NextResponse.json({ reports: enriched });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Admin Reports API] Unexpected error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH: Update report status
export async function PATCH(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (!auth) {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  }

  try {
    const { id, status } = await request.json();

    if (!id || !status) {
      return NextResponse.json({ error: 'ID y status son requeridos' }, { status: 400 });
    }

    const validStatuses = ['pending', 'reviewed', 'resolved'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Status invalido' }, { status: 400 });
    }

    // Use SECURITY DEFINER function to bypass RLS
    const sb = getSupabase();
    const { data, error } = await sb.rpc('admin_update_report_status', {
      p_report_id: id,
      p_new_status: status
    });

    if (error) {
      console.error('[Admin Reports API] Update RPC error:', error.code, error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, report: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
