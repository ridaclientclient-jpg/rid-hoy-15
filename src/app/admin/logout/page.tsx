'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Standalone admin logout page.
 *
 * Why a dedicated page instead of a route handler redirect?
 * The previous approach used a GET route handler that returned NextResponse.redirect(307).
 * However, when the browser followed that 307 → /admin/login, the framer-motion JS chunk
 * sometimes failed to hydrate properly, leaving the login form at opacity:0 (invisible).
 *
 * This page:
 * 1. Signs out from Supabase (clears the session)
 * 2. Uses window.location.replace() for a guaranteed full-page reload
 * 3. Shows a visible "Cerrando sesion..." message (no framer-motion)
 * 4. Has a safety timeout to redirect even if signOut fails
 */
export default function AdminLogoutPage() {
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    // Attempt sign-out in background (don't await — redirect immediately)
    supabase.auth.signOut().catch(() => {
      // Ignore: we redirect regardless
    });

    // Small delay to let signOut start, then full redirect
    // Using window.location.replace to ensure a clean browser navigation
    // (no Next.js router involved, no cached JS chunks from previous page)
    const timer = setTimeout(() => {
      window.location.replace('/admin/login');
    }, 300);

    return () => clearTimeout(timer);
  }, []);

  // Extremely simple UI — NO framer-motion, NO fancy components
  // Just plain HTML so it always renders, even if JS partially fails
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0a0f1a',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            width: 40,
            height: 40,
            border: '3px solid rgba(6,182,212,0.3)',
            borderTopColor: '#06b6d4',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px',
          }}
        />
        <p style={{ color: '#9ca3af', fontSize: 14, fontFamily: 'system-ui, sans-serif' }}>
          Cerrando sesion...
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
