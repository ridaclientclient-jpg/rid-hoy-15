/**
 * push-server.ts — Servidor Web Push para RIDA SUPREME
 *
 * Funciones server-side para enviar notificaciones push
 * via Web Push Protocol con VAPID.
 */

import webpush from 'web-push';

// VAPID keys — en produccion mover a .env
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  'BKky1yRkVtMVMgCK6c9DqIsFH-LwXIu4EmzU_jXAu_ayZt7z-HyX5AXlhPvPpLTCbWNsOCkakTQmAhel2UK4cKA';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ||
  'C8csjUmc8x7oicZZhFXXRuyljjrhmqkla6kC6-9u_K4';

const VAPID_SUBJECT = 'mailto:soporte@ridasupreme.com';

// Configurar VAPID
webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

interface PushSubscriptionInfo {
  endpoint: string;
  p256dh_key: string;
  auth_key: string;
}

interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  tag?: string;
  icon?: string;
  badge?: string;
  vibrate?: number[];
  requireInteraction?: boolean;
  actions?: Array<{ action: string; title: string }>;
}

/**
 * Convierte una suscripcion de la DB al formato que espera web-push
 */
function toWebPushSubscription(sub: PushSubscriptionInfo): webpush.PushSubscription {
  return {
    endpoint: sub.endpoint,
    keys: {
      p256dh: sub.p256dh_key,
      auth: sub.auth_key,
    },
  };
}

/**
 * Envia notificacion push a un solo usuario
 * @returns numero de notificaciones enviadas exitosamente
 */
export async function sendPushToUser(
  supabase: any,
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
  tag?: string
): Promise<number> {
  try {
    const { data: subs, error } = await supabase.rpc('get_user_push_subscriptions', {
      p_user_id: userId,
    });

    if (error || !subs || subs.length === 0) return 0;

    return await sendPushToSubscriptions(supabase, subs, {
      title,
      body,
      data,
      tag: tag || `rida-${Date.now()}-${userId.slice(0, 8)}`,
      icon: '/logo.svg',
      badge: '/logo.svg',
      vibrate: [200, 100, 200],
      requireInteraction: data?.type === 'sos',
      actions: [
        { action: 'view', title: 'Ver' },
        { action: 'dismiss', title: 'Cerrar' },
      ],
    });
  } catch (err) {
    console.error('[PushServer] sendPushToUser error:', err);
    return 0;
  }
}

/**
 * Envia notificacion push a multiples usuarios
 * @returns numero total de notificaciones enviadas
 */
export async function sendPushToUsers(
  supabase: any,
  userIds: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>,
  tag?: string
): Promise<number> {
  try {
    const { data: subs, error } = await supabase.rpc('get_push_subscriptions_bulk', {
      p_user_ids: userIds,
    });

    if (error || !subs || subs.length === 0) return 0;

    return await sendPushToSubscriptions(supabase, subs, {
      title,
      body,
      data,
      tag: tag || `rida-${Date.now()}-bulk`,
      icon: '/logo.svg',
      badge: '/logo.svg',
      vibrate: [200, 100, 200],
      requireInteraction: data?.type === 'sos',
      actions: [
        { action: 'view', title: 'Ver' },
        { action: 'dismiss', title: 'Cerrar' },
      ],
    });
  } catch (err) {
    console.error('[PushServer] sendPushToUsers error:', err);
    return 0;
  }
}

/**
 * Envia push a un array de suscripciones
 */
async function sendPushToSubscriptions(
  supabase: any,
  subscriptions: PushSubscriptionInfo[],
  payload: PushPayload
): Promise<number> {
  let sent = 0;
  const payloadStr = JSON.stringify(payload);

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        toWebPushSubscription(sub),
        payloadStr,
        {
          TTL: 86400, // 24 horas
          urgency: payload.requireInteraction ? 'high' : 'normal',
        }
      );
      sent++;
    } catch (err: any) {
      console.error('[PushServer] Send failed:', err.statusCode, err.message);

      // Limpiar suscripciones expiradas (404 = Gone, 410 = Gone)
      if (err.statusCode === 404 || err.statusCode === 410) {
        try {
          await supabase.rpc('cleanup_expired_subscription', {
            p_endpoint: sub.endpoint,
          });
        } catch (cleanupErr) {
          console.error('[PushServer] Cleanup failed:', cleanupErr);
        }
      }
    }
  }

  return sent;
}

/**
 * Obtiene la VAPID public key para el cliente
 */
export function getVapidPublicKey(): string {
  return VAPID_PUBLIC_KEY;
}
