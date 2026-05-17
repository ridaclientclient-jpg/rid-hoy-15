import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPER_ADMIN_EMAIL = 'kardellridclient@outlook.com';

function getSupabase(token?: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: token ? {
      headers: { Authorization: `Bearer ${token}` }
    } : undefined,
  });
}

async function verifySuperAdmin(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.replace('Bearer ', '');
  // Use authenticated client so RLS policies see the correct auth.uid()
  const supabase = getSupabase(token);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, email')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'super_admin') return null;
  return { user, profile, token };
}

// GET: Listar admins + estado bloqueado + log de actividades
export async function GET(request: NextRequest) {
  const auth = await verifySuperAdmin(request);
  if (!auth) {
    return NextResponse.json({ error: 'Acceso denegado - Solo Super Admin' }, { status: 403 });
  }

  const supabase = getSupabase(auth.token);
  const { searchParams } = new URL(request.url);
  const view = searchParams.get('view');

  // Si piden log de actividades
  if (view === 'activity-log') {
    const limit = parseInt(searchParams.get('limit') || '50');
    const { data, error } = await supabase.rpc('get_admin_activity_log', { p_limit: limit });

    if (error) {
      return NextResponse.json({ error: 'Error al cargar log: ' + error.message }, { status: 500 });
    }

    return NextResponse.json({ log: data });
  }

  // Listar admins
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .in('role', ['admin', 'super_admin'])
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Error al consultar administradores' }, { status: 500 });
  }

  return NextResponse.json({
    admins: data,
    super_admin_email: SUPER_ADMIN_EMAIL,
    current_email: auth.user.email
  });
}

// POST: Crear nuevo admin (solo super admin)
export async function POST(request: NextRequest) {
  const auth = await verifySuperAdmin(request);
  if (!auth) {
    return NextResponse.json({ error: 'Acceso denegado - Solo Super Admin' }, { status: 403 });
  }

  const { name, email, password, action } = await request.json();

  const supabase = getSupabase(auth.token);

  // Accion de bloquear
  if (action === 'block') {
    const { userId, reason } = await request.json();
    if (!userId) return NextResponse.json({ error: 'ID de usuario requerido' }, { status: 400 });

    const { data, error } = await supabase.rpc('block_admin_user', {
      p_target_user_id: userId,
      p_reason: reason || 'Bloqueado por Super Admin'
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(data);
  }

  // Accion de desbloquear
  if (action === 'unblock') {
    const { userId } = await request.json();
    if (!userId) return NextResponse.json({ error: 'ID de usuario requerido' }, { status: 400 });

    const { data, error } = await supabase.rpc('unblock_admin_user', {
      p_target_user_id: userId
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(data);
  }

  // Crear nuevo admin
  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Nombre, correo y contraseña son requeridos' }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 });
  }

  // Check if email already exists
  const { data: existing } = await supabase
    .from('profiles')
    .select('id, email, role')
    .eq('email', email.toLowerCase().trim())
    .single();

  if (existing) {
    return NextResponse.json({ error: 'Este correo ya está registrado en el sistema' }, { status: 400 });
  }

  // Log de actividad antes de crear
  await supabase.rpc('create_new_admin', {
    p_name: name.trim(),
    p_email: email.toLowerCase().trim()
  });

  // Create user via Supabase Auth
  const { error } = await supabase.auth.signUp({
    email: email.toLowerCase().trim(),
    password,
    options: {
      data: { name: name.trim(), role: 'admin' }
    }
  });

  if (error) {
    return NextResponse.json({ error: 'Error al crear: ' + error.message }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    message: 'Administrador creado exitosamente'
  });
}

// DELETE: Eliminar admin (solo super admin puede)
export async function DELETE(request: NextRequest) {
  const auth = await verifySuperAdmin(request);
  if (!auth) {
    return NextResponse.json({ error: 'Acceso denegado - Solo Super Admin' }, { status: 403 });
  }

  const { userId } = await request.json();

  if (!userId) {
    return NextResponse.json({ error: 'ID de usuario requerido' }, { status: 400 });
  }

  const supabase = getSupabase(auth.token);

  const { data, error } = await supabase.rpc('remove_admin_access', {
    p_target_user_id: userId
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data);
}
