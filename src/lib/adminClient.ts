import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Creates a Supabase client that bypasses Row Level Security (RLS).
 * Uses the service_role key which has full access to all data.
 * This is REQUIRED for admin operations like:
 * - Viewing all withdrawals, transactions, wallets across all users
 * - Approving/rejecting withdrawals that belong to other users
 * - Accessing financial reports for the entire platform
 * - Updating order statuses in marketplace
 */
export function getAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (serviceRoleKey) {
    return createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  // Fallback: use anon key (RLS will apply)
  console.warn(
    '[AdminClient] SUPABASE_SERVICE_ROLE_KEY not set. Admin operations may fail.'
  );
  return createClient(supabaseUrl, supabaseAnonKey);
}
