import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthClient } from '@/lib/authClient';

/**
 * GET /api/preferences
 * Returns the rider preferences for the authenticated user.
 */
export async function GET(request: Request) {
  try {
    // ── Auth ────────────────────────────────────────────────────
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado: se requiere token de autenticación' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado: token inválido o expirado' }, { status: 401 });
    }

    const db = getAuthClient(token);

    // ── Fetch preferences ───────────────────────────────────────
    const { data: preferences, error } = await db
      .from('client_preferences')
      .select(
        'preferred_temperature, preferred_music, conversation_level, pet_friendly, smoking_allowed',
      )
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json(
        { error: `Error al obtener preferencias: ${error.message}` },
        { status: 500 },
      );
    }

    // Return defaults when no row exists yet
    return NextResponse.json({
      success: true,
      preferences: preferences ?? {
        preferred_temperature: 22,
        preferred_music: 'none',
        conversation_level: 'neutral',
        pet_friendly: false,
        smoking_allowed: false,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al obtener preferencias';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PUT /api/preferences
 * Updates (or creates) rider preferences for the authenticated user.
 * The preferences are also stored as rider_preferences JSONB on the
 * next ride creation via the upserted client_preferences record.
 */
export async function PUT(request: Request) {
  try {
    // ── Auth ────────────────────────────────────────────────────
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado: se requiere token de autenticación' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado: token inválido o expirado' }, { status: 401 });
    }

    const db = getAuthClient(token);

    // ── Parse & validate body ───────────────────────────────────
    const body = await request.json();
    const {
      preferred_temperature,
      preferred_music,
      conversation_level,
      pet_friendly,
      smoking_allowed,
    } = body;

    // Build the preferences payload — only include fields that were
    // explicitly provided (allows partial updates)
    const payload: Record<string, unknown> = { user_id: user.id };

    if (preferred_temperature !== undefined) {
      const temp = Number(preferred_temperature);
      if (isNaN(temp) || temp < 16 || temp > 30) {
        return NextResponse.json(
          { error: 'La temperatura preferida debe estar entre 16°C y 30°C' },
          { status: 400 },
        );
      }
      payload.preferred_temperature = temp;
    }

    if (preferred_music !== undefined) {
      const validMusic = ['none', 'pop', 'rock', 'jazz', 'classical', 'reggaeton', 'lo-fi', 'other'];
      if (!validMusic.includes(preferred_music)) {
        return NextResponse.json(
          { error: `Género musical inválido. Opciones: ${validMusic.join(', ')}` },
          { status: 400 },
        );
      }
      payload.preferred_music = preferred_music;
    }

    if (conversation_level !== undefined) {
      const validLevels = ['none', 'low', 'neutral', 'chatty'];
      if (!validLevels.includes(conversation_level)) {
        return NextResponse.json(
          { error: `Nivel de conversación inválido. Opciones: ${validLevels.join(', ')}` },
          { status: 400 },
        );
      }
      payload.conversation_level = conversation_level;
    }

    if (pet_friendly !== undefined) {
      if (typeof pet_friendly !== 'boolean') {
        return NextResponse.json({ error: 'pet_friendly debe ser un valor booleano' }, { status: 400 });
      }
      payload.pet_friendly = pet_friendly;
    }

    if (smoking_allowed !== undefined) {
      if (typeof smoking_allowed !== 'boolean') {
        return NextResponse.json({ error: 'smoking_allowed debe ser un valor booleano' }, { status: 400 });
      }
      payload.smoking_allowed = smoking_allowed;
    }

    // Remove user_id from the data column (it's the conflict target)
    const { user_id: _, ...dataFields } = payload;

    if (Object.keys(dataFields).length === 0) {
      return NextResponse.json(
        { error: 'No se proporcionaron campos para actualizar' },
        { status: 400 },
      );
    }

    // ── Upsert preferences ──────────────────────────────────────
    const { data: upserted, error } = await db
      .from('client_preferences')
      .upsert(
        {
          user_id: user.id,
          ...dataFields,
        },
        { onConflict: 'user_id' },
      )
      .select(
        'preferred_temperature, preferred_music, conversation_level, pet_friendly, smoking_allowed',
      )
      .single();

    if (error) {
      return NextResponse.json(
        { error: `Error al guardar preferencias: ${error.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Preferencias actualizadas exitosamente',
      preferences: upserted,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al actualizar preferencias';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
