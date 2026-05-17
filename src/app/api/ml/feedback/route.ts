import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * POST /api/ml/feedback
 *
 * Envía feedback del admin sobre una alerta ML para aprendizaje.
 * - confirmed_fraud: confirma que es fraude → modelo se hace más sensible
 * - false_positive: descarta como falso positivo → modelo se hace menos sensible
 *
 * Body:
 *   alert_id: UUID (requerido)
 *   action: 'confirmed_fraud' | 'false_positive' (requerido)
 *   notes?: string
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { alert_id, action, notes } = body;

    if (!alert_id || !action) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: alert_id, action' },
        { status: 400 }
      );
    }

    const validActions = ['confirmed_fraud', 'false_positive'];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: `action debe ser uno de: ${validActions.join(', ')}` },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.rpc('ml_feedback', {
      p_alert_id: alert_id,
      p_action: action,
      p_notes: notes || '',
    });

    if (error) {
      console.error('ml_feedback error:', error);
      return NextResponse.json(
        { error: 'Error al procesar feedback: ' + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (err) {
    console.error('ml/feedback error:', err);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
