'use client';

/**
 * useBrowserNotifications — Hook de notificaciones push para RIDA SUPREME
 *
 * Usa la Browser Notification API nativa + Web Audio API para sonidos.
 * Se conecta a Supabase Realtime para escuchar nuevas notificaciones.
 * Integra Web Push para notificaciones en background.
 *
 * Integrar en: client, driver, courier, marketplace layouts
 */

import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { useSoundStore, notificationTypeToSound } from '@/store/soundStore';
import { usePushNotifications } from './usePushNotifications';

interface NotificationPreferences {
  ride_notifications: boolean;
  payment_notifications: boolean;
  promo_notifications: boolean;
  system_notifications: boolean;
  sos_notifications: boolean;
  sound_enabled: boolean;
  browser_permission: string;
}

const DEFAULT_PREFS: NotificationPreferences = {
  ride_notifications: true,
  payment_notifications: true,
  promo_notifications: true,
  system_notifications: true,
  sos_notifications: true,
  sound_enabled: true,
  browser_permission: 'default',
};

export function useBrowserNotifications() {
  const user = useAuthStore(s => s.user);
  const play = useSoundStore(s => s.play);
  const prefsRef = useRef<NotificationPreferences>({ ...DEFAULT_PREFS });
  const channelsRef = useRef<ReturnType<typeof supabase.channel>[]>([]);
  const isSetupRef = useRef(false);

  // Push notifications hook
  const { subscribeToPush } = usePushNotifications();

  // Cargar preferencias desde Supabase
  const loadPreferences = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase.rpc('get_notification_preferences', {
        p_user_id: user.id,
      });
      if (data) {
        prefsRef.current = { ...DEFAULT_PREFS, ...data };
      }
    } catch {
      // Si falla, usar defaults
    }
  }, [user]);

  // Solicitar permiso de notificaciones del navegador + registrar push
  const requestPermission = useCallback(async (): Promise<string> => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';

    const permission = await Notification.requestPermission();

    // Actualizar en Supabase
    if (user) {
      try {
        await supabase.rpc('update_browser_permission', {
          p_user_id: user.id,
          p_permission: permission,
        });
      } catch {
        // Ignorar error
      }
    }

    // Si el usuario concedio permiso, registrar suscripcion push
    if (permission === 'granted') {
      subscribeToPush().then((success) => {
        if (success) {
          console.log('[Notifications] Push subscription activada');
        }
      });
    }

    prefsRef.current.browser_permission = permission;
    return permission;
  }, [user, subscribeToPush]);

  // Mostrar notificacion del navegador
  const showNotification = useCallback((title: string, body: string, type: string = 'info', data?: Record<string, string>) => {
    if (typeof window === 'undefined') return;
    if (Notification.permission !== 'granted') return;

    // Verificar preferencias del usuario
    const typeMap: Record<string, keyof NotificationPreferences> = {
      ride: 'ride_notifications',
      payment: 'payment_notifications',
      promo: 'promo_notifications',
      system: 'system_notifications',
      sos: 'sos_notifications',
      alert: 'system_notifications',
      warning: 'system_notifications',
      info: 'system_notifications',
    };
    const prefKey = typeMap[type] || 'system_notifications';
    if (prefsRef.current[prefKey] === false) return;

    // Mostrar notificacion nativa
    try {
      const notification = new Notification(title, {
        body,
        icon: '/logo.svg',
        badge: '/logo.svg',
        tag: `rida-${Date.now()}`,
        requireInteraction: type === 'sos',
        data: data || {},
      });

      // Al hacer clic, navegar a la pagina correcta
      notification.onclick = () => {
        window.focus();
        notification.close();

        // Navegar basado en tipo
        const url = getNotificationUrl(type, data);
        if (url && url !== '/') {
          window.location.href = url;
        }
      };

      // Auto-cerrar despues de 8 segundos (excepto SOS)
      if (type !== 'sos') {
        setTimeout(() => notification.close(), 8000);
      }
    } catch {
      // Fallback: intentar con service worker
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then(reg => {
          if (reg) {
            reg.showNotification(title, {
              body,
              icon: '/logo.svg',
              tag: `rida-${Date.now()}`,
              data: data || {},
            });
          }
        }).catch(() => {});
      }
    }

    // Reproducir sonido
    if (prefsRef.current.sound_enabled) {
      play(notificationTypeToSound(type));
    }
  }, [play]);

  // Escuchar notificaciones en realtime (tabla app_notifications)
  useEffect(() => {
    if (!user || isSetupRef.current) return;
    isSetupRef.current = true;

    // Cargar preferencias primero
    loadPreferences().then(() => {
      // Suscribirse a app_notifications
      const ch1 = supabase
        .channel(`browser-push-app-${user.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'app_notifications',
          filter: `user_id=eq.${user.id}`,
        }, (payload) => {
          const notif = payload.new as Record<string, unknown>;
          const title = (notif.title as string) || 'Nueva notificacion';
          const body = (notif.message as string) || (notif.body as string) || '';
          const type = (notif.type as string) || 'info';
          showNotification(title, body, type);
        })
        .subscribe();
      channelsRef.current.push(ch1);

      // Suscribirse a notifications (tabla alternativa)
      const ch2 = supabase
        .channel(`browser-push-notif-${user.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        }, (payload) => {
          const notif = payload.new as Record<string, unknown>;
          const title = (notif.title as string) || 'Nueva notificacion';
          const body = (notif.message as string) || '';
          const type = (notif.type as string) || 'info';
          showNotification(title, body, type);
        })
        .subscribe();
      channelsRef.current.push(ch2);
    });

    return () => {
      channelsRef.current.forEach(ch => {
        try { supabase.removeChannel(ch); } catch {}
      });
      channelsRef.current = [];
      isSetupRef.current = false;
    };
  }, [user, loadPreferences, showNotification]);

  return {
    requestPermission,
    showNotification,
    permission: typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'unsupported',
    prefs: prefsRef.current,
  };
}

/**
 * Determina la URL de destino basada en el tipo de notificacion
 */
function getNotificationUrl(type: string, data?: Record<string, string>): string {
  if (!data) return '/';
  const rideId = data.ride_id;
  if (type === 'ride' && rideId) return `/client/ride/${rideId}`;
  if (type === 'payment') return '/client/wallet';
  if (type === 'sos') return '/admin';
  if (type === 'verification') return '/client/verification';
  return '/';
}
