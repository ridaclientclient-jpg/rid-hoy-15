'use client';

import { useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Browser Notification Service
 * Handles Web Push API permission request, notification display, and click handling.
 * Sound playback is delegated to the SoundSystem (Module 10) when available.
 */

interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  type?: 'info' | 'warning' | 'ride' | 'payment' | 'sos' | 'system';
  data?: Record<string, unknown>;
  onClick?: () => void;
}

let permissionGranted: NotificationPermission | null = null;

/** Check if browser notifications are supported */
export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/** Request notification permission from user */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) return 'denied';

  if (permissionGranted) return permissionGranted;

  try {
    permissionGranted = await Notification.requestPermission();
    return permissionGranted;
  } catch {
    return 'denied';
  }
}

/** Show a browser notification */
export async function showBrowserNotification(options: NotificationOptions): Promise<void> {
  if (!isNotificationSupported()) return;

  if (permissionGranted !== 'granted') {
    permissionGranted = await requestNotificationPermission();
    if (permissionGranted !== 'granted') return;
  }

  try {
    const notification = new Notification(options.title, {
      body: options.body,
      icon: options.icon || '/favicon.ico',
      tag: options.tag || `rida-${Date.now()}`,
      silent: options.type !== 'sos', // SOS plays sound
      data: options.data,
    });

    notification.onclick = () => {
      window.focus();
      if (options.onClick) options.onClick();
      notification.close();
    };

    // Auto-close after 5 seconds (except SOS)
    if (options.type !== 'sos') {
      setTimeout(() => notification.close(), 5000);
    }
  } catch {
    // Notification API might fail in some contexts
  }
}

/** Play a beep sound for notifications (basic fallback, no external files needed) */
export function playNotificationBeep(type: 'info' | 'ride' | 'sos' | 'payment' | 'warning' = 'info'): void {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    switch (type) {
      case 'sos':
        // Urgent alarm: two-tone high-low repeating
        oscillator.frequency.setValueAtTime(880, ctx.currentTime);
        oscillator.frequency.setValueAtTime(440, ctx.currentTime + 0.15);
        oscillator.frequency.setValueAtTime(880, ctx.currentTime + 0.3);
        oscillator.frequency.setValueAtTime(440, ctx.currentTime + 0.45);
        gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
        gainNode.gain.setValueAtTime(0, ctx.currentTime + 0.6);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.6);
        break;
      case 'ride':
        // Friendly two-tone: ding-ding
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(660, ctx.currentTime);
        oscillator.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
        gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
        gainNode.gain.setValueAtTime(0, ctx.currentTime + 0.3);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.3);
        break;
      case 'payment':
        // Cash register: quick ascending tones
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(523, ctx.currentTime);
        oscillator.frequency.setValueAtTime(659, ctx.currentTime + 0.08);
        oscillator.frequency.setValueAtTime(784, ctx.currentTime + 0.16);
        gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
        gainNode.gain.setValueAtTime(0, ctx.currentTime + 0.3);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.3);
        break;
      case 'warning':
        // Low warning tone
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(330, ctx.currentTime);
        gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
        gainNode.gain.setValueAtTime(0, ctx.currentTime + 0.4);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.4);
        break;
      default:
        // Default info: soft ping
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(587, ctx.currentTime);
        gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
        gainNode.gain.setValueAtTime(0, ctx.currentTime + 0.2);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.2);
    }
  } catch {
    // Audio context not available
  }
}

/**
 * React hook to set up notification service
 * Integrates with Supabase realtime notification subscriptions
 */
export function useNotificationService(userId: string | undefined) {
  const handleNewNotification = useCallback((notif: any) => {
    if (!notif || notif.is_read) return;

    // Play sound based on type
    playNotificationBeep(notif.type || 'info');

    // Show browser notification
    showBrowserNotification({
      title: notif.title,
      body: notif.message,
      type: notif.type,
      tag: `rida-notif-${notif.id}`,
      data: notif.data,
    });
  }, []);

  useEffect(() => {
    if (!userId) return;

    // Request permission on mount
    requestNotificationPermission().catch(() => {});

    // Subscribe to new notifications
    const channel = supabase
      .channel(`push-notifs-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          handleNewNotification(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, handleNewNotification]);
}
