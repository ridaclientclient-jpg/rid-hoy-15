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

  // Check role from JWT metadata first (fast, no DB)
  const jwtRole = user.user_metadata?.role || user.app_metadata?.role;
  if (jwtRole === 'admin' || jwtRole === 'super_admin') {
    return { user, profile: { role: jwtRole } };
  }

  // Fallback: check from profiles
  await sb.auth.setSession({ access_token: token, refresh_token: token });
  const { data: profile } = await sb
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) return null;
  return { user, profile };
}

// GET: Fetch all profiles (admin)
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (!auth) {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  }

  const sb = getSupabase();

  try {
    const { data, error } = await sb
      .from('profiles')
      .select('id, name, email, phone, role, is_active, is_verified, created_at')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      console.error('[Admin Users API] Error:', error.code, error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ users: data || [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH: Update user role or active status
export async function PATCH(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (!auth) {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  }

  const sb = getSupabase();

  try {
    const { userId, role, is_active } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'ID de usuario requerido' }, { status: 400 });
    }

    const updates: Record<string, any> = {};
    if (role) updates.role = role;
    if (is_active !== undefined) updates.is_active = is_active;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No hay cambios' }, { status: 400 });
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await sb
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select('id, name, email, phone, role, is_active, is_verified, created_at')
      .single();

    if (error) {
      console.error('[Admin Users API] Update error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, user: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
