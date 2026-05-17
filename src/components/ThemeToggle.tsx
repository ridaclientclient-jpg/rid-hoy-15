'use client';

/**
 * ThemeToggle — Boton para alternar dark/light mode
 * Se integra en todas las layouts (header)
 */

import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggleTheme, isDark } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`relative p-2 rounded-xl hover:bg-white/10 dark:hover:bg-white/10 
        transition-all duration-300 group ${className}`}
      title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
    >
      {isDark ? (
        <Sun className="w-5 h-5 text-yellow-400 group-hover:rotate-45 transition-transform duration-300" />
      ) : (
        <Moon className="w-5 h-5 text-blue-600 group-hover:-rotate-12 transition-transform duration-300" />
      )}
    </button>
  );
}
