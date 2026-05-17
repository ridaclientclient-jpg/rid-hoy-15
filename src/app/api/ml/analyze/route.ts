import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * POST /api/ml/analyze
 *
 * Trigger manual del escaneo ML de toda la actividad reciente.
 * El admin puede usar este endpoint para forzar un análisis.
 */
export async function POST(request: NextRequest) {
  try {
    // Ejecutar escaneo batch
    const { data, error } = await supabase.rpc('ml_scan_all_recent');

    if (error) {
      console.error('ml_scan_all_recent error:', error);
      return NextResponse.json(
        { error: 'Error en escaneo ML: ' + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (err) {
    console.error('ml/analyze error:', err);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
