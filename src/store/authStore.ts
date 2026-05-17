import { create } from 'zustand';
import { supabase, clearStaleAuthData, ensureAuthListener, type Profile } from '@/lib/supabase';
import type { User as SupaUser, Session } from '@supabase/supabase-js';

interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'client' | 'driver' | 'admin' | 'super_admin' | 'vendor' | 'courier';
  avatar?: string;
  isVerified?: boolean;
}

interface AuthState {
  user: AuthUser | null;
  supaUser: SupaUser | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginAttempts: number;
  isLocked: boolean;
  lockedUntil: Date | null;

  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, phone: string, password: string, role: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  initAuth: () => Promise<void>;
  setLoading: (loading: boolean) => void;
  updateProfile: (updates: Partial<AuthUser>) => Promise<void>;
}

function profileToUser(profile: Profile): AuthUser {
  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    phone: profile.phone,
    role: profile.role,
    avatar: profile.avatar,
    isVerified: profile.is_verified,
  };
}

// Shared promise to deduplicate concurrent initAuth() calls
let _initAuthPromise: Promise<void> | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  supaUser: null,
  session: null,
  isAuthenticated: false,
  isLoading: false,
  loginAttempts: 0,
  isLocked: false,
  lockedUntil: null,

  initAuth: async () => {
    // Deduplicate concurrent calls
    if (_initAuthPromise) {
      try {
        const result = await Promise.race([
          _initAuthPromise.then(() => 'resolved'),
          new Promise<string>((r) => setTimeout(() => r('pending'), 0)),
        ]);
        if (result === 'resolved') {
          _initAuthPromise = null;
        }
      } catch {
        _initAuthPromise = null;
      }
    }

    _initAuthPromise = (async () => {
      const alreadyAuthed = get().isAuthenticated;
      if (!alreadyAuthed) {
        set({ isLoading: true });
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const sessionUser = session.user;
          let profile = null;

          try {
            const { data: existingProfile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', sessionUser.id)
              .single();

            if (existingProfile) {
              profile = existingProfile;
            } else {
              const meta = sessionUser.user_metadata || {};
              const newProfile = {
                id: sessionUser.id,
                name: meta.name || sessionUser.email?.split('@')[0] || 'Usuario',
                email: sessionUser.email || '',
                phone: meta.phone || '',
                role: meta.role || 'client',
                is_verified: sessionUser.email_confirmed_at ? true : false,
              };
              const { data: createdProfile } = await supabase
                .from('profiles')
                .upsert(newProfile, { onConflict: 'id' })
                .select()
                .single();
              profile = createdProfile;
            }
          } catch (profileErr) {
            console.warn('Profile fetch failed, using session metadata:', profileErr);
          }

          if (profile) {
            set({
              user: profileToUser(profile),
              supaUser: sessionUser,
              session,
              isAuthenticated: true,
              isLoading: false,
            });
          } else {
            const meta = sessionUser.user_metadata || {};
            const fallbackUser: AuthUser = {
              id: sessionUser.id,
              name: meta.name || sessionUser.email?.split('@')[0] || 'Usuario',
              email: sessionUser.email || '',
              phone: meta.phone || '',
              role: (meta.role || 'client') as AuthUser['role'],
              isVerified: sessionUser.email_confirmed_at ? true : false,
            };
            console.warn('Using fallback user from session metadata:', fallbackUser.email, 'role:', fallbackUser.role);
            set({
              user: fallbackUser,
              supaUser: sessionUser,
              session,
              isAuthenticated: true,
              isLoading: false,
            });
          }
        } else {
          set({ isLoading: false });
        }
      } catch (error) {
        console.error('Auth init error:', error);
        // getSession() threw — clear stale tokens and reset state
        clearStaleAuthData();
        set({ user: null, supaUser: null, session: null, isAuthenticated: false, isLoading: false });
      }

      // Set up the auth state change listener ONCE (survives HMR via globalThis)
      if ((get() as any)._authListenerSetup) return;
      (get() as any)._authListenerSetup = true;

      // Register the singleton listener in supabase.ts
      ensureAuthListener(set as (partial: Record<string, unknown>) => void);

      // Also set up the store-level listener for INITIAL_SESSION / SIGNED_IN / TOKEN_REFRESHED
      supabase.auth.onAuthStateChange(async (event, session) => {
        if ((event === 'INITIAL_SESSION' || event === 'SIGNED_IN') && session?.user) {
          const sessionUser = session.user;
          let profile = null;

          try {
            const { data: existingProfile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', sessionUser.id)
              .single();

            if (existingProfile) {
              profile = existingProfile;
            } else {
              const meta = sessionUser.user_metadata || {};
              const newProfile = {
                id: sessionUser.id,
                name: meta.name || sessionUser.email?.split('@')[0] || 'Usuario',
                email: sessionUser.email || '',
                phone: meta.phone || '',
                role: meta.role || 'client',
                is_verified: sessionUser.email_confirmed_at ? true : false,
              };
              const { data: createdProfile } = await supabase
                .from('profiles')
                .upsert(newProfile, { onConflict: 'id' })
                .select()
                .single();
              profile = createdProfile;
            }
          } catch (profileErr) {
            console.warn('Profile fetch in onAuthStateChange failed:', profileErr);
          }

          if (profile) {
            set({
              user: profileToUser(profile),
              supaUser: sessionUser,
              session,
              isAuthenticated: true,
              isLoading: false,
            });
          } else {
            const meta = sessionUser.user_metadata || {};
            const fallbackUser: AuthUser = {
              id: sessionUser.id,
              name: meta.name || sessionUser.email?.split('@')[0] || 'Usuario',
              email: sessionUser.email || '',
              phone: meta.phone || '',
              role: (meta.role || 'client') as AuthUser['role'],
              isVerified: sessionUser.email_confirmed_at ? true : false,
            };
            set({
              user: fallbackUser,
              supaUser: sessionUser,
              session,
              isAuthenticated: true,
              isLoading: false,
            });
          }
        } else if (event === 'TOKEN_REFRESHED') {
          if (session?.user) {
            set({
              supaUser: session.user,
              session,
              isAuthenticated: true,
            });
          } else {
            // Token refresh returned no session — refresh token was invalid
            clearStaleAuthData();
            set({ user: null, supaUser: null, session: null, isAuthenticated: false, isLoading: false });
          }
        } else if (event === 'SIGNED_OUT') {
          if ((get() as any)._isLoggingOut) return;
          set({ user: null, supaUser: null, session: null, isAuthenticated: false, isLoading: false });
        }
      });
    })()
    .finally(() => { _initAuthPromise = null; });
  },

  login: async (email: string, password: string) => {
    const state = get();
    if (state.isLocked) {
      const now = new Date();
      if (state.lockedUntil && now < state.lockedUntil) {
        return { success: false, error: `Cuenta bloqueada. Intenta en ${Math.ceil((state.lockedUntil.getTime() - now.getTime()) / 60000)} minutos.` };
      }
      set({ isLocked: false, lockedUntil: null, loginAttempts: 0 });
    }

    // NOTE: Do NOT call clearStaleAuthData() here!
    // signInWithPassword doesn't use the stored token, and clearing
    // localStorage would remove PKCE verifiers that might be needed.

    set({ isLoading: true });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        const newAttempts = state.loginAttempts + 1;
        if (newAttempts >= 5) {
          set({
            loginAttempts: newAttempts,
            isLocked: true,
            lockedUntil: new Date(Date.now() + 15 * 60 * 1000),
            isLoading: false,
          });
          supabase.from('login_logs').insert({
            email,
            method: 'email',
            status: 'blocked',
          }).then(() => {}).catch(() => {});
          return { success: false, error: 'Cuenta bloqueada por 15 minutos. Demasiados intentos.' };
        }
        set({ loginAttempts: newAttempts, isLoading: false });
        supabase.from('login_logs').insert({
          email,
          method: 'email',
          status: 'failed',
        }).then(() => {}).catch(() => {});
        return { success: false, error: error.message === 'Invalid login credentials'
          ? `Credenciales incorrectas. Intentos restantes: ${5 - newAttempts}`
          : error.message
        };
      }

      if (data.session?.user) {
        const sessionUser = data.session.user;
        let profile = null;

        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', sessionUser.id)
          .single();

        if (existingProfile) {
          profile = existingProfile;
        } else {
          const meta = sessionUser.user_metadata || {};
          const newProfile = {
            id: sessionUser.id,
            name: meta.name || sessionUser.email?.split('@')[0] || 'Usuario',
            email: sessionUser.email || '',
            phone: meta.phone || '',
            role: meta.role || 'client',
            is_verified: sessionUser.email_confirmed_at ? true : false,
          };
          const { data: createdProfile, error: createError } = await supabase
            .from('profiles')
            .upsert(newProfile, { onConflict: 'id' })
            .select()
            .single();

          if (createError) {
            console.error('Error creating profile:', createError.message, createError.details);
            set({ isLoading: false });
            return { success: false, error: 'Error al crear perfil: ' + createError.message };
          }
          profile = createdProfile;
        }

        if (profile) {
          set({
            user: profileToUser(profile),
            supaUser: sessionUser,
            session: data.session,
            isAuthenticated: true,
            isLoading: false,
            loginAttempts: 0,
          });
          supabase.from('profiles').update({
            last_login_at: new Date().toISOString(),
            login_count: (profile.login_count || 0) + 1,
          }).eq('id', sessionUser.id).then(() => {}).catch(() => {});
          supabase.from('login_logs').insert({
            user_id: sessionUser.id,
            email,
            method: 'email',
            status: 'success',
          }).then(() => {}).catch(() => {});
          return { success: true };
        }
      }

      set({ isLoading: false });
      return { success: false, error: 'Error al obtener perfil' };
    } catch (err) {
      set({ isLoading: false });
      return { success: false, error: 'Error de conexion' };
    }
  },

  register: async (name: string, email: string, phone: string, password: string, role: string) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            phone,
            role,
          },
        },
      });

      if (error) {
        set({ isLoading: false });
        return { success: false, error: error.message };
      }

      if (data.user) {
        set({
          user: {
            id: data.user.id,
            name,
            email,
            phone,
            role: role as AuthUser['role'],
            isVerified: false,
          },
          supaUser: data.user,
          session: data.session,
          isAuthenticated: !!data.session,
          isLoading: false,
        });
        return { success: true };
      }

      set({ isLoading: false });
      return { success: false, error: 'Error al crear cuenta' };
    } catch (err) {
      set({ isLoading: false });
      return { success: false, error: 'Error de conexion' };
    }
  },

  logout: async () => {
    (get() as any)._isLoggingOut = true;
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Error signing out from Supabase:', err);
    }
    // Clear stale tokens AFTER signOut
    clearStaleAuthData();
    set({
      user: null,
      supaUser: null,
      session: null,
      isAuthenticated: false,
      isLoading: false,
      loginAttempts: 0,
    });
    setTimeout(() => { (get() as any)._isLoggingOut = false; }, 500);
  },

  setLoading: (loading: boolean) => set({ isLoading: loading }),

  updateProfile: async (updates: Partial<AuthUser>) => {
    const state = get();
    if (!state.user) return;

    const updatesDB: Record<string, unknown> = {};
    if (updates.name) updatesDB.name = updates.name;
    if (updates.phone) updatesDB.phone = updates.phone;
    if (updates.avatar) updatesDB.avatar = updates.avatar;

    const { error } = await supabase
      .from('profiles')
      .update(updatesDB)
      .eq('id', state.user.id);

    if (!error) {
      set({ user: { ...state.user, ...updates } });
    }
  },
}));
