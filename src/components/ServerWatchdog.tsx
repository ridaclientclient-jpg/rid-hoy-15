'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Wifi, WifiOff } from 'lucide-react';

/**
 * ServerWatchdog — detects when the Next.js server is down and shows
 * a user-friendly "reconnecting" overlay instead of a blank page.
 *
 * Root cause: the Node.js server can crash (OOM, Turbopack bug, sandbox kill).
 * When that happens during a client-side navigation (e.g. after login),
 * the RSC payload fetch fails and the user sees a blank white screen.
 * This component prevents that by detecting the failure and showing a
 * recovery UI.
 */
export default function ServerWatchdog() {
  const [isDown, setIsDown] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [checkCount, setCheckCount] = useState(0);

  const checkServer = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const res = await fetch('/?_health=1', {
        signal: controller.signal,
        cache: 'no-store',
        headers: { 'Accept': 'text/html' },
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        if (isDown) {
          // Server came back — reload to restore full functionality
          window.location.reload();
        }
        setIsDown(false);
      } else {
        setIsDown(true);
      }
    } catch {
      setIsDown(true);
    }
    setCheckCount(c => c + 1);
  }, [isDown]);

  useEffect(() => {
    // Initial check after mount
    const initTimeout = setTimeout(checkServer, 2000);
    // Periodic check every 15 seconds
    const interval = setInterval(checkServer, 15000);

    return () => {
      clearTimeout(initTimeout);
      clearInterval(interval);
    };
  }, [checkServer]);

  // Listen for failed navigations (Next.js RSC fetch failures)
  useEffect(() => {
    const handleError = (e: Event) => {
      const target = e.target as XMLHttpRequest | undefined;
      if (target?.status === 0 || target?.status >= 500) {
        setIsDown(true);
      }
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  // Listen for unhandled fetch failures
  useEffect(() => {
    const originalFetch = window.fetch;
    let failedCount = 0;

    window.fetch = async (...args: Parameters<typeof fetch>) => {
      try {
        const res = await originalFetch(...args);
        failedCount = 0;
        return res;
      } catch {
        failedCount++;
        if (failedCount >= 2) {
          setIsDown(true);
        }
        throw new Error('Server unavailable');
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  const handleRetry = async () => {
    setIsRetrying(true);
    await checkServer();
    setTimeout(() => {
      setIsRetrying(false);
      window.location.reload();
    }, 2000);
  };

  if (!isDown) return null;

  return (
    <div className="fixed inset-0 z-[99999] bg-[#0a0e1a] flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-6">
          <WifiOff className="w-10 h-10 text-red-400" />
        </div>

        <h2 className="text-xl font-bold text-white mb-2">
          Sin conexion al servidor
        </h2>
        <p className="text-sm text-gray-400 mb-6">
          El servidor se desconecto. Esto puede ocurrir temporalmente.
          Intenta recargar la pagina para reconectarte.
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50"
          >
            {isRetrying ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Reconectando...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Recargar pagina
              </>
            )}
          </button>
        </div>

        <p className="text-xs text-gray-600 mt-6">
          Verificacion #{checkCount} &middot; RIDA SUPREME SYSTEM
        </p>
      </div>
    </div>
  );
}
