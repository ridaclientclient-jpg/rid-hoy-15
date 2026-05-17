import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const SYSTEM_PROMPT = `Eres el asistente virtual de RIDA SUPREME, una aplicacion de transporte (tipo Uber/Didi) en Costa Rica.
Tu nombre es "RIDA AI". Respondes SIEMPRE en espanol.

Reglas:
- Eres amable, profesional y conciso.
- Puedes ayudar con: uso de la app, seguridad, tarifas, metodos de pago, SOS, reportes, soporte, consejos de viaje.
- Si preguntan por clima, indica que no tienes acceso a datos meteorologicos en tiempo real pero sugiere revisar el IMN de Costa Rica.
- Si preguntan sobre rutas, sugiere usar la funcion de Google Maps integrada en la app.
- Para emergencias, indica que usen el boton SOS dentro del viaje o llamen al 911.
- Numero de soporte: +506 2200-0000.
- Email: soporte@ridasupreme.com.
- WhatsApp: https://wa.me/50622000000.
- No inventes datos del usuario. Solo respondes con la informacion que te proporcionen.
- Mantén respuestas cortas (2-4 oraciones maximo) a menos que pidan explicacion detallada.`;

export async function POST(request: Request) {
  try {
    const { message, context } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Mensaje requerido' }, { status: 400 });
    }

    if (message.length > 500) {
      return NextResponse.json({ error: 'Mensaje muy largo (max 500 caracteres)' }, { status: 400 });
    }

    // Optional auth check (works for both auth and non-auth users)
    let userName = 'Usuario';
    let userRole = 'client';
    const authHeader = request.headers.get('Authorization');

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      try {
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('name, role')
            .eq('id', user.id)
            .single();
          if (profile) {
            userName = profile.name;
            userRole = profile.role;
          }
        }
      } catch {
        // Continue without auth context
      }
    }

    // Build messages array with context
    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: `${SYSTEM_PROMPT}\n\nContexto del usuario: Nombre=${userName}, Rol=${userRole}.` },
    ];

    // Add conversation history if provided
    if (context && Array.isArray(context)) {
      const recentHistory = context.slice(-6); // Last 3 exchanges
      for (const msg of recentHistory) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({ role: msg.role, content: msg.content });
        }
      }
    }

    // Add current message
    messages.push({ role: 'user', content: message });

    // Call AI via z-ai-web-dev-sdk
    let response: string;
    try {
      const ZAI = (await import('z-ai-web-dev-sdk')).default;
      const zai = await ZAI.create();

      const completion = await zai.chat.completions.create({
        messages: messages as any,
        temperature: 0.7,
        max_tokens: 200,
      });

      response = completion.choices?.[0]?.message?.content || 'Lo siento, no pude generar una respuesta. Intenta de nuevo.';
    } catch (aiError: any) {
      console.error('[AI Chat] SDK Error:', aiError?.message || aiError);
      response = getFallbackResponse(message);
    }

    return NextResponse.json({ success: true, response });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno';
    console.error('[AI Chat] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Fallback responses when AI SDK is unavailable */
function getFallbackResponse(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes('precio') || lower.includes('tarifa') || lower.includes('costo')) {
    return 'Las tarifas se calculan automaticamente segun distancia y tipo de viaje (Standard, Premium, SUV, Moto, Grua, Flete). La tarifa base es configurable por el administrador.';
  }
  if (lower.includes('sos') || lower.includes('emergencia') || lower.includes('ayuda')) {
    return 'En caso de emergencia, usa el boton SOS rojo durante un viaje activo. Esto alerta inmediatamente a los administradores con tu ubicacion GPS. Tambien puedes llamar al 911.';
  }
  if (lower.includes('pago') || lower.includes('billetera') || lower.includes('dinero')) {
    return 'RIDA SUPREME usa un sistema de billetera virtual. Puedes recargar saldo y solicitar retiros desde la seccion de Billetera. El minimo de retiro es configurable.';
  }
  if (lower.includes('soporte') || lower.includes('contacto') || lower.includes('ayuda')) {
    return 'Puedes contactarnos por: Email: soporte@ridasupreme.com, WhatsApp: +506 2200-0000, o desde la seccion de Soporte en la app.';
  }
  if (lower.includes('seguro') || lower.includes('seguridad')) {
    return 'RIDA SUPREME cuenta con: verificacion de documentos, sistema SOS en tiempo real, deteccion de viajes externos, reportes de incidentes con fotos, y calificacion de usuarios.';
  }
  if (lower.includes('hola') || lower.includes('buenas') || lower.includes('hi')) {
    return 'Hola! Soy RIDA AI, tu asistente virtual. En que puedo ayudarte hoy?';
  }
  return 'Gracias por tu mensaje. Para ayuda inmediata, contacta a soporte@ridasupreme.com o WhatsApp +506 2200-0000. Tambien puedes usar la seccion de Soporte en la app.';
}
