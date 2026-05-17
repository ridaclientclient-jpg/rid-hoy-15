'use client';

import { useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import { Bell, Package, Truck, CheckCircle2, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function NotificationListener() {
  const { user } = useAuthStore();
  const router = useRouter();

  const playNotificationSound = useCallback((type: 'order' | 'status') => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      if (type === 'order') {
        // Tono de alerta para pedido nuevo (más insistente)
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
        oscillator.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.5);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.5);
      } else {
        // Tono suave para actualización de estado
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
        gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.3);
      }
    } catch (e) {
      console.warn('Audio play failed', e);
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    // 1. Escuchar cambios en la tabla de entregas (Deliveries)
    const channel = supabase
      .channel('realtime_notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'deliveries',
        },
        async (payload) => {
          const newOrder = payload.new as any;
          const oldOrder = payload.old as any;

          // LOGICA PARA REPARTIDORES: Pedido nuevo disponible
          if (payload.eventType === 'INSERT' && newOrder.status === 'pending') {
            // Solo avisar a couriers o si el usuario es admin
            playNotificationSound('order');
            toast('¡Nuevo pedido disponible!', {
              description: `Hay un pedido cerca de ti. Toca para ver.`,
              icon: <Package className="text-orange-500 w-5 h-5" />,
              action: {
                label: 'Ver Pedidos',
                onClick: () => router.push('/courier/deliveries'),
              },
              duration: 10000,
            });
          }

          // LOGICA PARA CLIENTES: Cambio de estado de su pedido
          if (payload.eventType === 'UPDATE' && newOrder.customer_id === user.id) {
            if (newOrder.status !== oldOrder.status) {
              playNotificationSound('status');
              
              const statusMessages: Record<string, { title: string, icon: any, color: string }> = {
                assigned: { title: 'Repartidor asignado', icon: <Truck />, color: 'text-blue-400' },
                picked_up: { title: 'Tu pedido está siendo preparado', icon: <Package />, color: 'text-amber-400' },
                in_transit: { title: '¡Pedido en camino!', icon: <Truck />, color: 'text-purple-400' },
                delivered: { title: '¡Pedido entregado!', icon: <CheckCircle2 />, color: 'text-emerald-400' },
                cancelled: { title: 'Pedido cancelado', icon: <AlertCircle />, color: 'text-red-400' },
              };

              const msg = statusMessages[newOrder.status];
              if (msg) {
                toast(msg.title, {
                  description: `Tu pedido #${newOrder.id.slice(0, 5)} cambió a ${newOrder.status}`,
                  icon: <div className={msg.color}>{msg.icon}</div>,
                  action: {
                    label: 'Rastrear',
                    onClick: () => router.push(`/client/market/tracking/${newOrder.id}`),
                  },
                });
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, playNotificationSound, router]);

  return null; // Este componente no renderiza nada, es un "worker"
}
