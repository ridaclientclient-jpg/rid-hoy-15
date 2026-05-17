'use client';

/**
 * ThemeContext — Proveedor de tema (dark/light) para RIDA SUPREME
 * 
 * Persiste en localStorage y Supabase.
 * Se integra en el root layout.
 */

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  toggleTheme: () => {},
  setTheme: () => {},
  isDark: true,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const user = useAuthStore(s => s.user);
  const [theme, setThemeState] = useState<Theme>('dark');
  const [mounted, setMounted] = useState(false);

  // Leer tema guardado al montar
  useEffect(() => {
    setMounted(true);
    
    // 1. Intentar desde localStorage primero (rapido)
    const saved = localStorage.getItem('rida-theme') as Theme;
    if (saved === 'light' || saved === 'dark') {
      setThemeState(saved);
      document.documentElement.classList.toggle('dark', saved === 'dark');
      return;
    }

    // 2. Si hay usuario, intentar desde Supabase
    if (user) {
      supabase.rpc('get_user_theme', { p_user_id: user.id })
        .then(({ data }) => {
          const t = (data === 'light' || data === 'dark') ? data : 'dark';
          setThemeState(t);
          localStorage.setItem('rida-theme', t);
          document.documentElement.classList.toggle('dark', t === 'dark');
        })
        .then(() => {}, () => {
          document.documentElement.classList.add('dark');
        });
    } else {
      document.documentElement.classList.add('dark');
    }
  }, [user]);

  // Aplicar tema al DOM cuando cambia
  useEffect(() => {
    if (!mounted) return;
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('rida-theme', theme);
  }, [theme, mounted]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
    localStorage.setItem('rida-theme', newTheme);

    // Guardar en Supabase si hay usuario
    if (user) {
      supabase.rpc('save_user_theme', {
        p_user_id: user.id,
        p_theme: newTheme,
      }).then(() => {}, () => {});
    }
  }, [user]);

  const toggleTheme = useCallback(() => {
    setThemeState(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      document.documentElement.classList.toggle('dark', next === 'dark');
      localStorage.setItem('rida-theme', next);

      if (user) {
        supabase.rpc('save_user_theme', {
          p_user_id: user.id,
          p_theme: next,
        }).then(() => {}, () => {});
      }

      return next;
    });
  }, [user]);

  // Prevenir flash de tema incorrecto
  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, isDark: theme === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      theme: 'dark' as Theme,
      toggleTheme: () => {},
      setTheme: (_: Theme) => {},
      isDark: true,
    };
  }
  return ctx;
}
