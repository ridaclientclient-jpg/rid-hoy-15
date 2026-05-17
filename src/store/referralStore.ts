import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

interface Referral {
  id: string;
  referrer_id: string;
  referred_id: string | null;
  referral_code: string;
  referred_email: string | null;
  referred_phone: string | null;
  status: string;
  reward_amount: number;
  referrer_reward_amount: number;
  referred_reward_amount: number;
  created_at: string;
  first_ride_at: string | null;
  rewarded_at: string | null;
  expires_at: string | null;
  // Joined profile data
  referred_name?: string;
  referred_avatar?: string;
}

interface ReferralState {
  myCode: string | null;
  referrals: Referral[];
  totalEarned: number;
  pendingCount: number;
  completedCount: number;
  rewardedCount: number;
  isLoading: boolean;

  fetchMyReferralData: (userId: string) => Promise<void>;
  generateCode: (userId: string) => Promise<string | null>;
  applyReferralCode: (userId: string, code: string) => Promise<{ success: boolean; message: string }>;
  shareCode: (code: string) => Promise<void>;
}

function generateUniqueCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'RIDA-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export const useReferralStore = create<ReferralState>((set, get) => ({
  myCode: null,
  referrals: [],
  totalEarned: 0,
  pendingCount: 0,
  completedCount: 0,
  rewardedCount: 0,
  isLoading: false,

  fetchMyReferralData: async (userId: string) => {
    set({ isLoading: true });
    try {
      // Fetch the user's own referral code — find the most recent pending code they created
      const { data: ownReferral, error: codeError } = await supabase
        .from('referrals')
        .select('referral_code')
        .eq('referrer_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!codeError && ownReferral && ownReferral.length > 0) {
        set({ myCode: ownReferral[0].referral_code });
      }

      // Fetch all referrals made by this user with joined profile data of the referred person
      const { data: referralData, error: refError } = await supabase
        .from('referrals')
        .select(`
          id,
          referrer_id,
          referred_id,
          referral_code,
          referred_email,
          referred_phone,
          status,
          reward_amount,
          referrer_reward_amount,
          referred_reward_amount,
          created_at,
          first_ride_at,
          rewarded_at,
          expires_at
        `)
        .eq('referrer_id', userId)
        .order('created_at', { ascending: false });

      if (refError) {
        console.error('Error fetching referrals:', refError.message);
        set({ isLoading: false });
        return;
      }

      // For each referral that has a referred_id, fetch the referred user's profile
      const enrichedReferrals: Referral[] = [];
      if (referralData && referralData.length > 0) {
        const referredIds = referralData
          .filter(r => r.referred_id)
          .map(r => r.referred_id as string);

        // Batch fetch profiles
        let profilesMap: Record<string, { name: string; avatar?: string }> = {};
        if (referredIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, name, avatar')
            .in('id', referredIds);

          if (profiles) {
            profilesMap = profiles.reduce((acc, p) => {
              acc[p.id] = { name: p.name, avatar: p.avatar };
              return acc;
            }, {} as Record<string, { name: string; avatar?: string }>);
          }
        }

        for (const ref of referralData) {
          const profile = ref.referred_id ? profilesMap[ref.referred_id] : null;
          enrichedReferrals.push({
            ...ref,
            referred_name: profile?.name || ref.referred_email || 'Invitado',
            referred_avatar: profile?.avatar,
          });
        }
      }

      // Calculate stats
      const totalEarned = enrichedReferrals
        .filter(r => r.status === 'rewarded')
        .reduce((sum, r) => sum + (r.referrer_reward_amount || 0), 0);

      const pendingCount = enrichedReferrals.filter(r =>
        r.status === 'pending' || r.status === 'registered'
      ).length;

      const completedCount = enrichedReferrals.filter(r =>
        r.status === 'first_ride_completed' || r.status === 'rewarded'
      ).length;

      const rewardedCount = enrichedReferrals.filter(r =>
        r.status === 'rewarded'
      ).length;

      set({
        referrals: enrichedReferrals,
        totalEarned,
        pendingCount,
        completedCount,
        rewardedCount,
        isLoading: false,
      });
    } catch (err) {
      console.error('fetchMyReferralData error:', err);
      set({ isLoading: false });
    }
  },

  generateCode: async (userId: string) => {
    try {
      // Check if user already has a code
      const { data: existing } = await supabase
        .from('referrals')
        .select('referral_code')
        .eq('referrer_id', userId)
        .limit(1);

      if (existing && existing.length > 0) {
        set({ myCode: existing[0].referral_code });
        return existing[0].referral_code;
      }

      // Generate unique code (max 10 attempts to avoid collision)
      for (let attempt = 0; attempt < 10; attempt++) {
        const code = generateUniqueCode();

        // Check if code already exists
        const { data: codeCheck, error: checkError } = await supabase
          .from('referrals')
          .select('id')
          .eq('referral_code', code)
          .limit(1);

        if (checkError) {
          console.error('Error checking code uniqueness:', checkError.message);
          continue;
        }

        if (codeCheck && codeCheck.length > 0) {
          // Code already taken, try again
          continue;
        }

        // Fetch referral settings for reward amounts
        let referrerReward = 3000;
        let referredReward = 1500;
        let expiresDays = 30;

        try {
          const { data: settings } = await supabase
            .from('settings')
            .select('key, value')
            .in('key', ['referrer_reward', 'referred_reward', 'referral_expires_days']);

          if (settings) {
            for (const s of settings) {
              if (s.key === 'referrer_reward') referrerReward = Number(s.value) || 3000;
              if (s.key === 'referred_reward') referredReward = Number(s.value) || 1500;
              if (s.key === 'referral_expires_days') expiresDays = Number(s.value) || 30;
            }
          }
        } catch {
          // Settings may not exist yet, use defaults
        }

        // Insert new referral record with status 'pending'
        const { data: newReferral, error: insertError } = await supabase
          .from('referrals')
          .insert({
            referrer_id: userId,
            referral_code: code,
            status: 'pending',
            reward_amount: referrerReward,
            referrer_reward_amount: referrerReward,
            referred_reward_amount: referredReward,
            expires_at: new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000).toISOString(),
          })
          .select('referral_code')
          .single();

        if (insertError) {
          console.error('Error inserting referral:', insertError.message);
          return null;
        }

        if (newReferral) {
          set({ myCode: newReferral.referral_code });
          return newReferral.referral_code;
        }
      }

      // Could not generate unique code after 10 attempts
      return null;
    } catch (err) {
      console.error('generateCode error:', err);
      return null;
    }
  },

  applyReferralCode: async (userId: string, code: string) => {
    try {
      // Find the referral code
      const { data: referral, error: findError } = await supabase
        .from('referrals')
        .select('*')
        .eq('referral_code', code.toUpperCase().trim())
        .eq('status', 'pending')
        .limit(1);

      if (findError) {
        return { success: false, message: 'Error al buscar el codigo de invitacion.' };
      }

      if (!referral || referral.length === 0) {
        return { success: false, message: 'Codigo de invitacion invalido o expirado.' };
      }

      const ref = referral[0];

      // Check it's not the user's own code
      if (ref.referrer_id === userId) {
        return { success: false, message: 'No puedes usar tu propio codigo de invitacion.' };
      }

      // Check if already used by this user
      const { data: existingUse } = await supabase
        .from('referrals')
        .select('id')
        .eq('referral_code', code.toUpperCase().trim())
        .eq('referred_id', userId)
        .limit(1);

      if (existingUse && existingUse.length > 0) {
        return { success: false, message: 'Ya usaste este codigo de invitacion.' };
      }

      // Fetch user profile for email/phone
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, phone')
        .eq('id', userId)
        .single();

      // Update: set referred_id, referred_email, status = 'registered'
      const { error: updateError } = await supabase
        .from('referrals')
        .update({
          referred_id: userId,
          referred_email: profile?.email || null,
          referred_phone: profile?.phone || null,
          status: 'registered',
          updated_at: new Date().toISOString(),
        })
        .eq('id', ref.id);

      if (updateError) {
        console.error('Error applying referral code:', updateError.message);
        return { success: false, message: 'Error al aplicar el codigo. Intenta de nuevo.' };
      }

      return {
        success: true,
        message: 'Codigo de invitacion aplicado! Recibiras ₡1,500 cuando completes tu primer viaje.',
      };
    } catch (err) {
      console.error('applyReferralCode error:', err);
      return { success: false, message: 'Error de conexion. Intenta de nuevo.' };
    }
  },

  shareCode: async (code: string) => {
    const text = `Unete a RIDA! Usa mi codigo ${code} y gana ₡1,500 en tu primer viaje. Descarga la app ahora.`;
    const whatsappUrl = `https://wa.me/50687838329?text=${encodeURIComponent(text)}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Invitacion RIDA',
          text,
          url: window.location.origin,
        });
      } catch {
        // User cancelled or share failed, fallback to clipboard
        await navigator.clipboard.writeText(text);
      }
    } else {
      await navigator.clipboard.writeText(text);
    }
  },
}));
