/**
 * notificationHelper.ts — Helper centralizado para crear notificaciones (DB only)
 *
 * Inserta en ambas tablas (notifications + app_notifications) para compatibilidad.
 * Seguro para usar tanto en server-side (API routes) como client-side (componentes).
 *
 * Para push notifications reales, los API routes deben llamar tambien
 * sendPushToUser() de push-server.ts DESPUES de createNotification().
 */

interface SingleNotification {
  user_id: string;
  title: string;
  message: string;
  type: string;
  data?: Record<string, unknown>;
  is_read?: boolean;
}

interface BulkNotification {
  user_id: string[];
  title: string;
  message: string;
  type: string;
  data?: Record<string, unknown>;
  is_read?: boolean;
}

type NotificationInput = SingleNotification | BulkNotification;

/**
 * Crea notificacion en la DB (ambas tablas)
 * Soporta user_id individual (string) o multiple (string[])
 */
export async function createNotification(
  supabase: any,
  notification: NotificationInput
): Promise<void> {
  const { title, message, type, data, is_read = false } = notification;
  const isBulk = Array.isArray(notification.user_id);

  const dbPromises: Promise<any>[] = [];

  if (isBulk) {
    const userIds = notification.user_id as string[];

    dbPromises.push(
      supabase.from('notifications').insert(
        userIds.map(uid => ({ user_id: uid, title, message, type, data }))
      ).catch((e: any) => {
        console.error('[createNotification] notifications insert error:', e.message);
      })
    );
    dbPromises.push(
      supabase.from('app_notifications').insert(
        userIds.map(uid => ({ user_id: uid, title, body: message, type, data, is_read }))
      ).catch((e: any) => {
        console.error('[createNotification] app_notifications insert error:', e.message);
      })
    );
  } else {
    const userId = notification.user_id as string;

    dbPromises.push(
      supabase.from('notifications').insert({
        user_id: userId, title, message, type, data,
      }).catch((e: any) => {
        console.error('[createNotification] notifications insert error:', e.message);
      })
    );
    dbPromises.push(
      supabase.from('app_notifications').insert({
        user_id: userId, title, body: message, type, data, is_read,
      }).catch((e: any) => {
        console.error('[createNotification] app_notifications insert error:', e.message);
      })
    );
  }

  await Promise.allSettled(dbPromises);
}
