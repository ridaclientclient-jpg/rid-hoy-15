import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/adminClient';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    // 1. Verify Super Admin Session
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const db = getAdminClient();
    const { data: admin } = await db.from('profiles').select('role').eq('id', user.id).single();
    
    if (!admin || admin.role !== 'super_admin') {
      return NextResponse.json({ error: 'Solo el Super Admin puede realizar esta accion' }, { status: 403 });
    }

    // 2. Parse Body
    const body = await request.json();
    const { userId, action, status } = body;

    if (!userId || !action) {
      return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 });
    }

    // 3. Execute Action using the RPC we created in SQL
    if (action === 'delete') {
      const { error } = await db.rpc('super_admin_manage_user', { 
        target_user_id: userId, 
        should_delete: true 
      });
      if (error) throw error;
      return NextResponse.json({ success: true, message: 'Usuario eliminado correctamente' });
    } 
    
    if (action === 'block') {
      const { error } = await db.rpc('super_admin_manage_user', { 
        target_user_id: userId, 
        new_status: status // true to activate, false to block
      });
      if (error) throw error;
      return NextResponse.json({ success: true, message: status ? 'Usuario reactivado' : 'Usuario bloqueado' });
    }

    return NextResponse.json({ error: 'Accion no valida' }, { status: 400 });

  } catch (error: any) {
    console.error('[Admin Users API Error]:', error);
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}
