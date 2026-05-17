'use client';

/**
 * ServiceWorkerRegistrar — Registra el Service Worker al cargar la app
 *
 * Se monta en el root layout para asegurar que el SW esta registrado
 * antes de que cualquier hook intente usarlo.
 */

import { useEffect } from 'react';

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    // Registrar service worker
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.log('[SW] Registrado correctamente, scope:', registration.scope);

        // Verificar actualizaciones
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'activated') {
                console.log('[SW] Nueva version activada');
              }
            });
          }
        });
      })
      .catch((err) => {
        console.warn('[SW] Error al registrar:', err.message);
      });
  }, []);

  return null;
}
