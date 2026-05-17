'use client';

import { create } from 'zustand';

/**
 * Sound & Alert System for RIDA SUPREME
 *
 * - Custom sounds per event type using Web Audio API (no external files needed)
 * - Critical sounds (SOS, emergency) CANNOT be muted
 * - User can mute non-critical sounds
 * - Works in foreground and background (via notification service)
 * - Minimalist/tech aesthetic tones
 */

export type SoundEvent =
  | 'ride_assigned'      // Conductor asignado al viaje
  | 'ride_arriving'      // Conductor llegando
  | 'ride_started'       // Viaje iniciado
  | 'ride_completed'     // Viaje completado
  | 'ride_cancelled'     // Viaje cancelado
  | 'sos'                // SOS activado (CRITICAL - cannot mute)
  | 'notification'       // Notificacion general
  | 'warning'            // Alerta/advertencia
  | 'payment'            // Pago/transaccion
  | 'error'              // Error del sistema
  | 'new_ride_request'   // Nueva solicitud de viaje (conductor)
  | 'message';           // Mensaje recibido

interface SoundState {
  isMuted: boolean;
  volume: number; // 0 to 1

  toggleMute: () => void;
  setVolume: (volume: number) => void;
  play: (event: SoundEvent) => void;
}

// CRITICAL events that can never be muted
const CRITICAL_EVENTS: SoundEvent[] = ['sos'];

// Audio context singleton
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Sound definitions using Web Audio API oscillators.
 * Each sound is a sequence of tones with frequency, duration, and type.
 * Designed to be minimalist and tech-sounding.
 */
interface ToneSequence {
  type: OscillatorType;
  frequency: number;
  startTime: number;
  duration: number;
  gainStart: number;
  gainEnd: number;
}

function getToneSequence(event: SoundEvent): ToneSequence[] {
  switch (event) {
    case 'ride_assigned':
      // Rising two-tone: friendly "you got a ride"
      return [
        { type: 'sine', frequency: 523, startTime: 0, duration: 0.12, gainStart: 0.25, gainEnd: 0.2 },
        { type: 'sine', frequency: 659, startTime: 0.13, duration: 0.12, gainStart: 0.25, gainEnd: 0.2 },
        { type: 'sine', frequency: 784, startTime: 0.26, duration: 0.2, gainStart: 0.3, gainEnd: 0 },
      ];

    case 'ride_arriving':
      // Quick ping-ping
      return [
        { type: 'sine', frequency: 880, startTime: 0, duration: 0.1, gainStart: 0.2, gainEnd: 0.15 },
        { type: 'sine', frequency: 880, startTime: 0.15, duration: 0.1, gainStart: 0.2, gainEnd: 0.15 },
        { type: 'sine', frequency: 1100, startTime: 0.3, duration: 0.15, gainStart: 0.25, gainEnd: 0 },
      ];

    case 'ride_started':
      // Ascending sweep
      return [
        { type: 'triangle', frequency: 330, startTime: 0, duration: 0.15, gainStart: 0.2, gainEnd: 0.2 },
        { type: 'triangle', frequency: 440, startTime: 0.15, duration: 0.15, gainStart: 0.2, gainEnd: 0.2 },
        { type: 'triangle', frequency: 550, startTime: 0.3, duration: 0.15, gainStart: 0.2, gainEnd: 0.2 },
        { type: 'triangle', frequency: 660, startTime: 0.45, duration: 0.25, gainStart: 0.25, gainEnd: 0 },
      ];

    case 'ride_completed':
      // Success chime: three ascending tones
      return [
        { type: 'sine', frequency: 523, startTime: 0, duration: 0.15, gainStart: 0.2, gainEnd: 0.2 },
        { type: 'sine', frequency: 659, startTime: 0.18, duration: 0.15, gainStart: 0.2, gainEnd: 0.2 },
        { type: 'sine', frequency: 784, startTime: 0.36, duration: 0.3, gainStart: 0.25, gainEnd: 0 },
      ];

    case 'ride_cancelled':
      // Descending tone: mild disappointment
      return [
        { type: 'sine', frequency: 440, startTime: 0, duration: 0.2, gainStart: 0.2, gainEnd: 0.15 },
        { type: 'sine', frequency: 349, startTime: 0.22, duration: 0.3, gainStart: 0.2, gainEnd: 0 },
      ];

    case 'sos':
      // ALARM: urgent alternating high/low (CANNOT be muted)
      return [
        { type: 'square', frequency: 880, startTime: 0, duration: 0.15, gainStart: 0.35, gainEnd: 0.35 },
        { type: 'square', frequency: 440, startTime: 0.18, duration: 0.15, gainStart: 0.35, gainEnd: 0.35 },
        { type: 'square', frequency: 880, startTime: 0.36, duration: 0.15, gainStart: 0.35, gainEnd: 0.35 },
        { type: 'square', frequency: 440, startTime: 0.54, duration: 0.15, gainStart: 0.35, gainEnd: 0.35 },
        { type: 'square', frequency: 880, startTime: 0.72, duration: 0.15, gainStart: 0.35, gainEnd: 0.35 },
        { type: 'square', frequency: 440, startTime: 0.9, duration: 0.2, gainStart: 0.35, gainEnd: 0 },
      ];

    case 'notification':
      // Soft ping
      return [
        { type: 'sine', frequency: 587, startTime: 0, duration: 0.15, gainStart: 0.15, gainEnd: 0 },
      ];

    case 'warning':
      // Low warning buzz
      return [
        { type: 'triangle', frequency: 330, startTime: 0, duration: 0.2, gainStart: 0.2, gainEnd: 0.15 },
        { type: 'triangle', frequency: 330, startTime: 0.25, duration: 0.25, gainStart: 0.2, gainEnd: 0 },
      ];

    case 'payment':
      // Cash register ascending
      return [
        { type: 'sine', frequency: 523, startTime: 0, duration: 0.08, gainStart: 0.2, gainEnd: 0.2 },
        { type: 'sine', frequency: 659, startTime: 0.1, duration: 0.08, gainStart: 0.2, gainEnd: 0.2 },
        { type: 'sine', frequency: 784, startTime: 0.2, duration: 0.15, gainStart: 0.25, gainEnd: 0 },
      ];

    case 'error':
      // Short low buzz
      return [
        { type: 'sawtooth', frequency: 150, startTime: 0, duration: 0.15, gainStart: 0.15, gainEnd: 0.1 },
        { type: 'sawtooth', frequency: 120, startTime: 0.18, duration: 0.2, gainStart: 0.15, gainEnd: 0 },
      ];

    case 'new_ride_request':
      // Alert: two-tone attention grabber
      return [
        { type: 'sine', frequency: 700, startTime: 0, duration: 0.12, gainStart: 0.25, gainEnd: 0.2 },
        { type: 'sine', frequency: 900, startTime: 0.15, duration: 0.12, gainStart: 0.25, gainEnd: 0.2 },
        { type: 'sine', frequency: 700, startTime: 0.3, duration: 0.12, gainStart: 0.25, gainEnd: 0.2 },
        { type: 'sine', frequency: 900, startTime: 0.45, duration: 0.2, gainStart: 0.3, gainEnd: 0 },
      ];

    case 'message':
      // Short soft notification
      return [
        { type: 'sine', frequency: 660, startTime: 0, duration: 0.08, gainStart: 0.15, gainEnd: 0 },
      ];

    default:
      return [
        { type: 'sine', frequency: 587, startTime: 0, duration: 0.1, gainStart: 0.15, gainEnd: 0 },
      ];
  }
}

function executeToneSequence(sequences: ToneSequence[], volume: number) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    for (const tone of sequences) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = tone.type;
      osc.frequency.setValueAtTime(tone.frequency, now + tone.startTime);

      gain.gain.setValueAtTime(tone.gainStart * volume, now + tone.startTime);
      gain.gain.linearRampToValueAtTime(tone.gainEnd * volume, now + tone.startTime + tone.duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + tone.startTime);
      osc.stop(now + tone.startTime + tone.duration + 0.01);
    }
  } catch {
    // Audio not available
  }
}

export const useSoundStore = create<SoundState>((set, get) => ({
  isMuted: false,
  volume: 0.7,

  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),

  setVolume: (volume: number) => {
    const clamped = Math.max(0, Math.min(1, volume));
    set({ volume: clamped });
    // Save to localStorage
    try { localStorage.setItem('rida-sound-volume', String(clamped)); } catch { /* Ignore */ }
  },

  play: (event: SoundEvent) => {
    const { isMuted, volume } = get();

    // CRITICAL events bypass mute
    if (isMuted && !CRITICAL_EVENTS.includes(event)) return;

    const sequences = getToneSequence(event);
    executeToneSequence(sequences, volume);
  },
}));

/**
 * Helper: Map notification type to sound event
 */
export function notificationTypeToSound(type: string): SoundEvent {
  const mapping: Record<string, SoundEvent> = {
    ride: 'notification',
    payment: 'payment',
    sos: 'sos',
    warning: 'warning',
    system: 'notification',
    info: 'notification',
  };
  return mapping[type] || 'notification';
}
