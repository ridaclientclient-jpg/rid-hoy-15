import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { password } = await request.json();

    if (!password || password.length < 6) {
      return NextResponse.json({ error: 'La contrasena debe tener al menos 6 caracteres' }, { status: 400 });
    }

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Contrasena actualizada' });
  } catch (error) {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
