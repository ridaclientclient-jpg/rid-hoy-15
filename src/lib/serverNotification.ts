/**
 * serverNotification.ts — Server-only notification creation WITH push
 *
 * IMPORTANTE: Solo usar desde API routes (server-side).
 * NO importar desde componentes cliente ('use client').
 *
 * Envuelve createNotification() + sendPushToUser() en una sola llamada.
 */

import { createNotification } from './notificationHelper';

interface ServerNotificationInput {
  user_id: string | string[];
  title: string;
  message: string;
  type: string;
  data?: Record<string, unknown>;
  is_read?: boolean;
}

/**
 * Crea notificacion en DB + envia push
 * Solo para uso en API routes (server-side)
 */
export async function createNotificationWithPush(
  supabase: any,
  notification: ServerNotificationInput
): Promise<void> {
  const { title, message, type, data } = notification;

  // 1. Insertar en DB (ambas tablas)
  await createNotification(supabase, notification);

  // 2. Enviar push (server-only)
  const userIds = Array.isArray(notification.user_id)
    ? [...new Set(notification.user_id)]
    : [notification.user_id];

  try {
    const { sendPushToUsers } = await import('./push-server');
    await sendPushToUsers(supabase, userIds, title, message, data, type);
  } catch (err) {
    // Push no disponible, no bloquear
    console.error('[serverNotification] Push error:', err);
  }
}
