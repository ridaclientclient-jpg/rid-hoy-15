'use client';

/**
 * NotificationPermissionBanner — Banner para solicitar permiso de notificaciones
 * Aparece una sola vez en la parte inferior de la app
 */

import { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { useBrowserNotifications } from '@/hooks/useBrowserNotifications';

export default function NotificationPermissionBanner() {
  const { requestPermission, permission } = useBrowserNotifications();
  const [dismissed, setDismissed] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Solo mostrar si el permiso es 'default' (no ha sido pedido aun)
    // y no ha sido descartado antes
    const wasDismissed = localStorage.getItem('rida-notif-dismissed');
    if (permission === 'default' && !wasDismissed) {
      // Esperar 3 segundos antes de mostrar
      const timer = setTimeout(() => setShow(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [permission]);

  const handleAllow = async () => {
    await requestPermission();
    setShow(false);
  };

  const handleDismiss = () => {
    setShow(false);
    setDismissed(true);
    localStorage.setItem('rida-notif-dismissed', 'true');
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-in slide-in-from-bottom-4">
      <div className="glass-strong rounded-2xl p-4 shadow-xl border border-cyan-500/20">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-cyan-500/10 rounded-xl">
            <Bell className="w-5 h-5 text-cyan-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">
              Activar notificaciones
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Recibe alertas de viajes, pagos y actualizaciones en tiempo real incluso cuando la app esta en segundo plano.
            </p>
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={handleAllow}
                className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-medium rounded-lg transition-colors"
              >
                Activar
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="px-4 py-1.5 text-muted-foreground hover:text-foreground text-xs font-medium rounded-lg transition-colors"
              >
                Ahora no
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
