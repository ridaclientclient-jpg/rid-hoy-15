import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

interface EnvEntry {
  name: string;
  envVar: string;
  isPublic: boolean;
}

/**
 * Mask a value showing first 8 and last 4 characters, with "..." in between.
 * If the value is shorter than 14 chars, show first half and last 3.
 */
function maskValue(value: string): string {
  if (value.length <= 14) {
    const half = Math.ceil(value.length / 2);
    return value.slice(0, half) + '...' + value.slice(-3);
  }
  return value.slice(0, 8) + '...' + value.slice(-4);
}

const envEntries: EnvEntry[] = [
  { name: 'Google Maps API', envVar: 'NEXT_PUBLIC_GOOGLE_MAPS_KEY', isPublic: true },
  { name: 'Supabase URL', envVar: 'NEXT_PUBLIC_SUPABASE_URL', isPublic: true },
  { name: 'Supabase Anon Key', envVar: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', isPublic: true },
  { name: 'Stripe Secret Key', envVar: 'STRIPE_SECRET_KEY', isPublic: false },
  { name: 'Stripe Publishable Key', envVar: 'NEXT_PUBLIC_STRIPE_KEY', isPublic: true },
  { name: 'WebSocket Server', envVar: 'NEXT_PUBLIC_WS_URL', isPublic: true },
];

export async function GET(request: Request) {
  try {
    // Auth check — require admin
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user },
    } = await supabase.auth.getUser(token);
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
      return NextResponse.json(
        { error: 'Solo administradores pueden acceder' },
        { status: 403 }
      );
    }

    // Build response — never expose full secret keys
    const keys = envEntries.map((entry) => {
      const raw = process.env[entry.envVar];

      if (!raw) {
        return {
          name: entry.name,
          configured: false,
          masked: null,
          isPublic: entry.isPublic,
        };
      }

      // For non-public keys, just confirm they exist (never send value or masked)
      if (!entry.isPublic) {
        return {
          name: entry.name,
          configured: true,
          masked: null,
          isPublic: false,
        };
      }

      // Public keys: send masked version
      return {
        name: entry.name,
        configured: true,
        masked: maskValue(raw),
        isPublic: true,
      };
    });

    return NextResponse.json({ keys });
  } catch (error) {
    console.error('Error checking env status:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
