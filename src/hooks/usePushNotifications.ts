'use client';

/**
 * usePushNotifications — Hook para gestionar suscripciones push del navegador
 *
 * Se usa DENTRO de useBrowserNotifications cuando el usuario otorga permiso.
 * Registra el service worker, genera la suscripcion push y la envia al servidor.
 */

import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  'BKky1yRkVtMVMgCK6c9DqIsFH-LwXIu4EmzU_jXAu_ayZt7z-HyX5AXlhPvPpLTCbWNsOCkakTQmAhel2UK4cKA';

/**
 * Convierte la VAPID public key de base64 a Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const user = useAuthStore(s => s.user);
  const isRegisteredRef = useRef(false);

  /**
   * Registra el service worker
   */
  const registerServiceWorker = useCallback(async (): Promise<ServiceWorkerRegistration | null> => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      console.log('[Push] Service Worker no soportado');
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });
      console.log('[Push] Service Worker registrado:', registration.scope);

      // Esperar a que el SW este activo
      if (registration.installing) {
        await new Promise<void>((resolve) => {
          registration.installing!.addEventListener('statechange', (e) => {
            if ((e.target as any).state === 'activated') resolve();
          });
        });
      }

      return registration;
    } catch (err) {
      console.error('[Push] Error registrando Service Worker:', err);
      return null;
    }
  }, []);

  /**
   * Suscribe al usuario a push notifications
   */
  const subscribeToPush = useCallback(async (): Promise<boolean> => {
    if (!user || isRegisteredRef.current) return false;

    try {
      // 1. Registrar Service Worker
      const registration = await registerServiceWorker();
      if (!registration) return false;

      // 2. Verificar soporte de push
      if (!registration.pushManager) {
        console.log('[Push] PushManager no disponible');
        return false;
      }

      // 3. Verificar permiso
      if (Notification.permission !== 'granted') {
        console.log('[Push] Permiso de notificacion no otorgado');
        return false;
      }

      // 4. Obtener token de autenticacion
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.log('[Push] No hay sesion activa');
        return false;
      }

      // 5. Verificar suscripcion existente
      const existingSub = await registration.pushManager.getSubscription();
      if (existingSub) {
        // Ya esta suscrito, verificar que esta registrada en el servidor
        const key = await arrayBufferToBase64(existingSub.getKey('p256dh')!);
        console.log('[Push] Suscripcion ya existe, endpoint:', existingSub.endpoint);
        isRegisteredRef.current = true;
        return true;
      }

      // 6. Crear nueva suscripcion
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      // 7. Enviar suscripcion al servidor
      const p256dhKey = await arrayBufferToBase64(subscription.getKey('p256dh')!);
      const authKey = await arrayBufferToBase64(subscription.getKey('auth')!);

      const response = await fetch('/api/push/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: p256dhKey,
            auth: authKey,
          },
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        console.error('[Push] Error registrando en servidor:', err);
        return false;
      }

      isRegisteredRef.current = true;
      console.log('[Push] Suscripcion registrada exitosamente');
      return true;
    } catch (err) {
      console.error('[Push] Error en subscribeToPush:', err);
      return false;
    }
  }, [user, registerServiceWorker]);

  /**
   * Cancelar suscripcion push
   */
  const unsubscribeFromPush = useCallback(async (): Promise<boolean> => {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) return true;

      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) return true;

      // Notificar al servidor
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          await fetch('/api/push/register', {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ endpoint: subscription.endpoint }),
          });
        }
      } catch {}

      await subscription.unsubscribe();
      isRegisteredRef.current = false;
      console.log('[Push] Suscripcion cancelada');
      return true;
    } catch (err) {
      console.error('[Push] Error cancelando suscripcion:', err);
      return false;
    }
  }, []);

  /**
   * Registrar automaticamente cuando el usuario tiene permiso y esta logueado
   */
  useEffect(() => {
    if (user && Notification.permission === 'granted' && !isRegisteredRef.current) {
      // Pequeno delay para asegurar que el SW del layout este registrado
      const timer = setTimeout(() => {
        subscribeToPush();
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [user, subscribeToPush]);

  return {
    subscribeToPush,
    unsubscribeFromPush,
    registerServiceWorker,
    isRegistered: isRegisteredRef.current,
  };
}

/**
 * Convierte ArrayBuffer a Base64
 */
async function arrayBufferToBase64(buffer: ArrayBuffer): Promise<string> {
  const uint8Array = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary);
}
