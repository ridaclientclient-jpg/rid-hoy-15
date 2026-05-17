import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const SUPABASE_STORAGE_KEY = 'rida-auth-token';

/**
 * Clears stale auth data from localStorage.
 * Only call this AFTER signOut, never during login.
 */
export function clearStaleAuthData() {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(SUPABASE_STORAGE_KEY);
      // Clear PKCE code verifier keys
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('sb-')) {
          localStorage.removeItem(key);
        }
      });
    }
  } catch {
    // Ignore
  }
}

/**
 * Make the Supabase client a TRUE singleton using globalThis.
 * This is critical for Turbopack HMR — without it, every hot reload
 * creates a new client with its own auto-refresh timer, and old timers
 * keep trying to refresh dead tokens, causing "Refresh Token Not Found" errors.
 */
const globalForSupabase = globalThis as unknown as {
  __ridaSupabase: ReturnType<typeof createClient> | undefined;
  __ridaAuthListenerSetup: boolean;
};

if (!globalForSupabase.__ridaSupabase) {
  // Suppress the specific AuthApiError for invalid refresh tokens
  // so it doesn't spam the console. We handle it ourselves in onAuthStateChange.
  if (typeof window !== 'undefined') {
    const _origConsoleError = console.error;
    console.error = (...args: unknown[]) => {
      const first = String(args[0] ?? '');
      if (first.includes('Invalid Refresh Token') || first.includes('Refresh Token Not Found')) {
        return; // Silently suppress — we handle it in onAuthStateChange
      }
      _origConsoleError.apply(console, args);
    };
  }

  globalForSupabase.__ridaSupabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      storageKey: SUPABASE_STORAGE_KEY,
      flowType: 'pkce',
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
    global: {
      headers: {
        'x-client-info': 'rida-supreme',
      },
    },
  });

  globalForSupabase.__ridaAuthListenerSetup = false;
}

export const supabase = globalForSupabase.__ridaSupabase;

/**
 * Register the global auth state change listener. Only runs ONCE
 * thanks to the globalThis guard, surviving HMR re-evaluations.
 */
export function ensureAuthListener(storeSet: (partial: Record<string, unknown>) => void) {
  if (globalForSupabase.__ridaAuthListenerSetup) return;
  globalForSupabase.__ridaAuthListenerSetup = true;

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' && !session) {
      // When Supabase signs out due to an invalid refresh token,
      // clear ALL stored auth data so the next getSession() returns null
      // instead of trying to refresh the dead token again.
      console.warn('[Supabase] Session ended — clearing stale tokens');
      clearStaleAuthData();
    }
  });
}

// Type helpers
export type Profile = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'client' | 'driver' | 'admin' | 'super_admin' | 'vendor' | 'courier';
  avatar?: string;
  balance?: number;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Driver = {
  id: string;
  user_id: string;
  status: 'offline' | 'online' | 'busy' | 'suspended';
  is_verified: boolean;
  rating: number;
  total_rides: number;
  total_earnings: number;
  work_hours_today: number;
  is_on_break: boolean;
  last_online_at?: string;
  current_location?: string;
  accepted_rides?: number;
  cancelled_rides?: number;
  rejected_rides?: number;
  reward_level?: string;
  previous_level?: string;
  level_updated_at?: string;
  acceptance_rate?: number;
  cancellation_rate?: number;
  active_streak_days?: number;
  last_notified_level?: string;
  daily_goal?: number;
  total_tips?: number;
  current_lat?: number;
  current_lng?: number;
  vehicle_type?: string;
  created_at: string;
  updated_at?: string;
  profiles?: Profile;
  vehicles?: Vehicle;
};

export type Vehicle = {
  id: string;
  driver_id: string;
  plate: string;
  model: string;
  color: string;
  year?: number;
  verified: boolean;
};

export type PaymentMethodType = 'cash' | 'wallet' | 'card' | 'sinpe';

export type Ride = {
  id: string;
  rider_id: string;
  driver_id?: string;
  status: 'searching' | 'assigned' | 'arriving' | 'started' | 'completed' | 'cancelled';
  origin: string;
  origin_address?: string;
  origin_lat?: number;
  origin_lng?: number;
  destination: string;
  dest_address?: string;
  dest_lat?: number;
  dest_lng?: number;
  price: number;
  distance?: number;
  duration?: number;
  surge_multiplier: number;
  commission_rate: number;
  driver_earnings?: number;
  rider_rating?: number;
  driver_rating?: number;
  review?: string;
  is_third_party: boolean;
  payment_method?: PaymentMethodType;
  payment_status?: string;
  card_last_four?: string;
  sinpe_phone?: string;
  created_at: string;
  profiles?: Profile;
  drivers?: Driver;
};

export type Wallet = {
  id: string;
  user_id: string;
  balance: number;
  total_earnings: number;
  total_withdrawn: number;
};

export type Transaction = {
  id: string;
  wallet_id: string;
  amount: number;
  type: 'credit' | 'debit' | 'withdrawal' | 'commission' | 'ride_payment';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  description?: string;
  ride_id?: string;
  created_at: string;
};

export type AppNotification = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'ride' | 'payment' | 'sos' | 'system';
  is_read: boolean;
  data?: Record<string, unknown>;
  created_at: string;
};

export type Document = {
  id: string;
  user_id: string;
  type: string;
  url: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string;
  created_at: string;
};

export type Vendor = {
  id: string;
  user_id: string;
  store_name: string;
  description?: string;
  category: 'pharmacy' | 'food' | 'stores' | 'other';
  is_approved: boolean;
  is_active?: boolean;
  rating: number;
  logo_url?: string;
  phone?: string;
  address?: string;
  opening_hours?: Record<string, { open: string; close: string; active: boolean }>;
  min_order_amount?: number;
  delivery_radius_km?: number;
  delivery_fee?: number;
  latitude?: number;
  longitude?: number;
  created_at?: string;
  updated_at?: string;
  profiles?: Profile;
};

export type Product = {
  id: string;
  vendor_id: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  image_url?: string;
  in_stock: boolean;
  stock_quantity?: number;
  sold_count?: number;
  is_featured?: boolean;
  avg_rating?: number;
  options?: Array<{
    name: string;
    required: boolean;
    values: Array<{ name: string; price: number }>;
  }>;
  created_at?: string;
  updated_at?: string;
  vendors?: Vendor;
};

export type Settings = {
  id: string;
  key: string;
  value: string;
  type: 'string' | 'number' | 'boolean' | 'json';
};

export type MarketplaceCategory = {
  id: string;
  name: string;
  icon?: string;
  image_url?: string;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
};

export type VendorWallet = {
  id: string;
  vendor_id: string;
  balance: number;
  total_earned: number;
  total_withdrawn: number;
  pending_balance: number;
  created_at?: string;
  updated_at?: string;
};

export type VendorTransaction = {
  id: string;
  vendor_id: string;
  wallet_id: string;
  type: 'earning' | 'withdrawal' | 'adjustment';
  amount: number;
  description?: string;
  delivery_id?: string;
  status: 'pending' | 'completed' | 'failed';
  created_at?: string;
};

export type ProductReview = {
  id: string;
  product_id: string;
  customer_id: string;
  delivery_id?: string;
  rating: number;
  comment?: string;
  created_at?: string;
};

export type SOS = {
  id: string;
  user_id: string;
  ride_id?: string;
  latitude: number;
  longitude: number;
  status: 'active' | 'resolved';
  created_at: string;
};

// ─── Chat System Types ───────────────────────────────────────

export type SupportChat = {
  id: string;
  user_id: string;
  user_name?: string;
  user_role: 'client' | 'driver' | 'vendor' | 'courier';
  subject: string;
  status: 'open' | 'closed' | 'resolved';
  last_message_at: string;
  last_message_preview: string;
  unread_by_admin: number;
  unread_by_user: number;
  created_at: string;
  updated_at: string;
};

export type ChatMessage = {
  id: string;
  chat_id: string;
  sender_type: 'user' | 'admin';
  sender_id?: string;
  content: string;
  message_type: 'text' | 'image' | 'system';
  created_at: string;
};

export type SavedCard = {
  id: string;
  user_id: string;
  card_number: string;
  card_holder: string;
  card_expiry: string;
  card_brand: 'visa' | 'mastercard' | 'amex' | 'other';
  last_four: string;
  is_default: boolean;
  created_at: string;
};

// ─── Courier Wallet Types ──────────────────────────────────────

export type CourierWallet = {
  id: string;
  courier_id: string;
  balance: number;
  available_balance: number;
  pending_balance: number;
  total_earned: number;
  total_withdrawn: number;
  created_at?: string;
  updated_at?: string;
};

export type CourierTransaction = {
  id: string;
  courier_id: string;
  wallet_id: string;
  type: 'earning' | 'withdrawal' | 'adjustment' | 'commission';
  amount: number;
  description?: string;
  delivery_id?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'queued';
  queue_position?: number;
  created_at?: string;
};

export type WithdrawalRequest = {
  id: string;
  courier_id: string;
  wallet_id: string;
  amount: number;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  queue_position?: number;
  requested_at: string;
  processable_at: string;
  processed_at?: string;
  notes?: string;
  courier_name?: string;
  courier_phone?: string;
};

// ─── Courier System Types ──────────────────────────────────────

export type Courier = {
  id: string;
  user_id: string;
  vehicle_type: 'moto' | 'bici' | 'carro';
  is_online: boolean;
  status: 'offline' | 'online' | 'busy' | 'delivering' | 'suspended';
  is_verified: boolean;
  rating: number;
  total_deliveries: number;
  total_earnings: number;
  current_lat?: number;
  current_lng?: number;
  last_online_at?: string;
  created_at: string;
  profiles?: Profile;
  vehicle_model?: string;
  vehicle_color?: string;
  vehicle_plate?: string;
};

export type Delivery = {
  id: string;
  courier_id?: string;
  customer_id: string;
  vendor_id?: string;
  status: 'pending' | 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled';
  pickup_address?: string;
  pickup_lat?: number;
  pickup_lng?: number;
  delivery_address: string;
  delivery_lat?: number;
  delivery_lng?: number;
  items: any[];
  subtotal: number;
  delivery_fee: number;
  total: number;
  payment_method: string;
  service_fee?: number;
  instructions?: string;
  delivery_type?: string;
  customer_rating?: number;
  courier_rating?: number;
  notes?: string;
  created_at: string;
  profiles?: Profile;
  couriers?: Courier;
  vendors?: Vendor;
};

export interface Rating {
  id: string;
  delivery_id: string;
  customer_id: string;
  vendor_id?: string;
  courier_id?: string;
  vendor_rating?: number;
  courier_rating?: number;
  comment?: string;
  created_at?: string;
}

// ─── Anti-Fraud System Types ────────────────────────────────────

export type FraudRule = {
  id: string;
  name: string;
  description?: string;
  user_type: 'client' | 'vendor' | 'courier' | 'driver';
  condition_key: string;
  threshold_params: Record<string, any>;
  points: number;
  auto_action: 'none' | 'alert' | 'block' | 'freeze_withdrawals';
  is_active: boolean;
  created_at?: string;
};

export type FraudAlert = {
  id: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  user_phone?: string;
  user_type: 'client' | 'vendor' | 'courier' | 'driver';
  user_role?: string;
  rule_name?: string;
  alert_type: string;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  description?: string;
  status: 'active' | 'under_review' | 'approved' | 'dismissed' | 'blocked';
  risk_score: number;
  withdrawals_frozen: boolean;
  user_risk_score?: number;
  user_status?: string;
  details?: Record<string, any>;
  created_at: string;
  resolved_at?: string;
  resolution_notes?: string;
};

export type FraudUserScore = {
  id: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  user_phone?: string;
  user_type: 'client' | 'vendor' | 'courier' | 'driver';
  risk_score: number;
  status: 'normal' | 'suspicious' | 'high_risk' | 'blocked';
  alert_count: number;
  resolved_count: number;
  blocked_count: number;
  withdrawals_frozen: boolean;
  last_alert_at?: string;
  user_is_active?: boolean;
};

export type FraudDashboard = {
  active_alerts: number;
  under_review: number;
  blocked_users: number;
  frozen_withdrawals: number;
  high_risk_users: number;
  suspicious_users: number;
  total_alerts_today: number;
  total_rules: number;
  client_high_risk: number;
  vendor_high_risk: number;
  courier_high_risk: number;
  driver_high_risk: number;
};
