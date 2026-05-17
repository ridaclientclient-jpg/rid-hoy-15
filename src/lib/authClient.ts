import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Creates a Supabase client that carries the user's JWT in the Authorization header.
 * This is critical for API routes: the default `supabase` singleton from `@/lib/supabase`
 * is created with only the anon key and no session, so `auth.uid()` in RLS policies
 * always returns `null`. By creating a client with the user's token, `auth.uid()`
 * resolves correctly and Row Level Security policies work as intended.
 *
 * Usage in API routes:
 *   const authClient = getAuthClient(token);
 *   const { data } = await authClient.from('drivers').select('*').eq('user_id', user.id).single();
 */
export function getAuthClient(token: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}
