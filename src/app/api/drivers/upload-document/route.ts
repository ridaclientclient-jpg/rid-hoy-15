import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthClient } from '@/lib/authClient';

/**
 * POST /api/drivers/upload-document
 * Uploads a file (avatar or document) to Supabase Storage and updates the DB.
 * Body: FormData with fields: file (File), userId (string), type (string: 'avatar' | document type)
 */
export async function POST(request: Request) {
  try {
    // ── Auth ────────────────────────────────────────────────────
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado: se requiere token' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado: token invalido o expirado' }, { status: 401 });
    }

    const db = getAuthClient(token);

    // ── Parse FormData ──────────────────────────────────────────
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const userId = formData.get('userId') as string | null;
    const docType = formData.get('type') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No se proporciono ningun archivo' }, { status: 400 });
    }

    if (!userId || userId !== user.id) {
      return NextResponse.json({ error: 'ID de usuario invalido' }, { status: 400 });
    }

    if (!docType) {
      return NextResponse.json({ error: 'No se especifico el tipo de documento' }, { status: 400 });
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'El archivo no puede superar 10MB' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Tipo de archivo no soportado. Usa JPG, PNG o WebP.' }, { status: 400 });
    }

    // ── Upload to Supabase Storage ──────────────────────────────
    const bucket = docType === 'avatar' ? 'avatars' : 'documents';
    const fileExt = file.name.split('.').pop() || 'jpg';
    const filePath = `${userId}/${docType}_${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, { contentType: file.type, upsert: true });

    if (uploadError) {
      console.error('[Upload] Storage error:', uploadError.message);
      return NextResponse.json({ error: `Error al subir archivo: ${uploadError.message}` }, { status: 500 });
    }

    // ── Get public URL ──────────────────────────────────────────
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
    const publicUrl = urlData.publicUrl;

    // ── Update database based on type ──────────────────────────
    if (docType === 'avatar') {
      // Update profile avatar
      const { error: profileError } = await db
        .from('profiles')
        .update({ avatar: publicUrl })
        .eq('id', user.id);

      if (profileError) {
        console.error('[Upload] Profile update error:', profileError.message);
        return NextResponse.json({ error: 'Error al actualizar perfil' }, { status: 500 });
      }
    } else {
      // Insert/upsert into documents table
      const { error: insertError } = await db
        .from('documents')
        .upsert(
          { user_id: user.id, type: docType, url: filePath, status: 'pending' },
          { onConflict: 'user_id,type' },
        );

      if (insertError) {
        console.error('[Upload] Document insert error:', insertError.message);
        // File is uploaded but DB record failed — still return URL
        return NextResponse.json({
          url: publicUrl,
          warning: 'Archivo subido pero no se pudo guardar el registro en la base de datos',
        });
      }
    }

    return NextResponse.json({ success: true, url: publicUrl });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al subir archivo';
    console.error('[Upload] Unexpected error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
