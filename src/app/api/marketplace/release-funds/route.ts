import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthClient } from '@/lib/authClient';

// ─── POST: Release marketplace funds (admin only) ─────────────
// Calls the release_marketplace_funds() RPC which processes
// completed deliveries and releases pending vendor earnings.

export async function POST(request: Request) {
  try {
    // ── 1. Authenticate ──────────────────────────────────────
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'No autorizado. Se requiere token de autenticación.' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Token inválido o usuario no encontrado.' },
        { status: 401 }
      );
    }

    const db = getAuthClient(token);

    // ── 2. Verify admin role ─────────────────────────────────
    const { data: profile, error: profileError } = await db
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Perfil de usuario no encontrado.' },
        { status: 401 }
      );
    }

    if (profile.role !== 'admin' && profile.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Acceso denegado. Solo administradores pueden liberar fondos.' },
        { status: 403 }
      );
    }

    // ── 3. Call release_marketplace_funds RPC ────────────────
    const { data: rpcResult, error: rpcError } = await db.rpc(
      'release_marketplace_funds'
    );

    if (rpcError) {
      console.error('[Release Funds] RPC error:', rpcError);
      return NextResponse.json(
        {
          error: 'Error al liberar fondos.',
          details: rpcError.message,
        },
        { status: 500 }
      );
    }

    // ── 4. Return result ─────────────────────────────────────
    return NextResponse.json({
      success: true,
      released_count: rpcResult ?? 0,
    });
  } catch (error: unknown) {
    console.error('[Release Funds] Unhandled error:', error);

    const message =
      error instanceof Error ? error.message : 'Error interno del servidor.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
