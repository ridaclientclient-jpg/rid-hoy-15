import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * POST /api/ml/track-event
 *
 * Endpoint para que TODAS las apps (client, driver, courier, marketplace)
 * envíen eventos de comportamiento al sistema ML de anti-fraude.
 *
 * Cada evento registra la actividad del usuario y ejecuta detección anómala
 * comparando contra su perfil de comportamiento histórico.
 *
 * Body:
 *   user_id: UUID (requerido)
 *   user_type: 'client' | 'vendor' | 'courier' | 'driver' (requerido)
 *   event_type: 'order_placed' | 'ride_requested' | 'ride_completed' |
 *               'delivery_completed' | 'withdrawal_requested' |
 *               'payment_attempt' | 'payment_failed' | 'refund_requested' |
 *               'location_update' | 'route_completed' (requerido)
 *   amount?: number
 *   location_zone?: string
 *   location_lat?: number
 *   location_lng?: number
 *   source_app?: 'client' | 'driver' | 'courier' | 'marketplace' | 'admin'
 *   event_data?: Record<string, any>
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      user_id,
      user_type,
      event_type,
      amount,
      location_zone,
      location_lat,
      location_lng,
      source_app,
      event_data,
    } = body;

    // Validaciones
    if (!user_id || !user_type || !event_type) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: user_id, user_type, event_type' },
        { status: 400 }
      );
    }

    const validUserTypes = ['client', 'vendor', 'courier', 'driver'];
    if (!validUserTypes.includes(user_type)) {
      return NextResponse.json(
        { error: `user_type debe ser uno de: ${validUserTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const validEventTypes = [
      'order_placed', 'ride_requested', 'ride_completed',
      'delivery_completed', 'withdrawal_requested',
      'payment_attempt', 'payment_failed', 'refund_requested',
      'location_update', 'route_completed',
    ];
    if (!validEventTypes.includes(event_type)) {
      return NextResponse.json(
        { error: `event_type invalido: ${event_type}` },
        { status: 400 }
      );
    }

    // Ejecutar ml_track_event RPC
    const { data, error } = await supabase.rpc('ml_track_event', {
      p_user_id: user_id,
      p_user_type: user_type,
      p_event_type: event_type,
      p_event_data: event_data || {},
      p_amount: amount || null,
      p_location_zone: location_zone || null,
      p_location_lat: location_lat || null,
      p_location_lng: location_lng || null,
      p_source_app: source_app || 'unknown',
    });

    if (error) {
      console.error('ml_track_event error:', error);
      return NextResponse.json(
        { error: 'Error al procesar evento ML: ' + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (err) {
    console.error('ml/track-event error:', err);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
