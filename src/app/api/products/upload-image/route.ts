import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Server-side client with service role for storage
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const vendorId = formData.get('vendor_id') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó ninguna imagen' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Tipo de archivo no permitido. Usa JPG, PNG o WebP' }, { status: 400 });
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'La imagen no puede ser mayor a 5MB' }, { status: 400 });
    }

    // Get auth header to determine user
    const authHeader = request.headers.get('authorization');
    let userId = vendorId || 'unknown';

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      try {
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user) userId = user.id;
      } catch { /* use vendorId fallback */ }
    }

    // Generate unique filename
    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to Supabase Storage 'products' bucket
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('products')
      .upload(fileName, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json({ error: 'Error al subir la imagen' }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('products')
      .getPublicUrl(uploadData.path);

    return NextResponse.json({
      url: urlData.publicUrl,
      path: uploadData.path,
    });
  } catch (error: any) {
    console.error('Upload API error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
