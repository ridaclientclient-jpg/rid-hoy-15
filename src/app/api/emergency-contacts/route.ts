import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Create an admin client for auth verification (no RLS issues)
const supabaseAdmin = createClient(supabaseUrl, supabaseAnonKey);

// Create a client with the user's JWT so RLS policies allow the operation
function createUserClient(token: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

// ─── GET: Listar contactos de emergencia del usuario ──────────────────────────
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Use user's JWT client so RLS allows reading their own contacts
    const userClient = createUserClient(token);
    const { data: contacts, error } = await userClient
      .from('emergency_contacts')
      .select('*')
      .eq('user_id', user.id)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      contacts: contacts || [],
      count: contacts?.length ?? 0,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al obtener contactos de emergencia';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─── POST: Agregar nuevo contacto de emergencia ──────────────────────────────
export async function POST(request: Request) {
  try {
    // Auth
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { name, phone, relation } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'El nombre del contacto es requerido' },
        { status: 400 }
      );
    }

    if (!phone || !phone.trim()) {
      return NextResponse.json(
        { error: 'El numero de telefono es requerido' },
        { status: 400 }
      );
    }

    // Use user's JWT client for all DB operations (RLS bypass)
    const userClient = createUserClient(token);

    const { data: existingContacts, error: countError } = await userClient
      .from('emergency_contacts')
      .select('id')
      .eq('user_id', user.id);

    if (countError) throw countError;

    if (existingContacts && existingContacts.length >= 5) {
      return NextResponse.json(
        { error: 'No puedes tener mas de 5 contactos de emergencia. Elimina uno existente primero.' },
        { status: 400 }
      );
    }

    const isFirstContact = !existingContacts || existingContacts.length === 0;
    const isPrimaryRequested = relation?.toLowerCase() === 'primary';
    const shouldSetPrimary = isFirstContact || isPrimaryRequested;

    if (shouldSetPrimary) {
      await userClient
        .from('emergency_contacts')
        .update({ is_primary: false })
        .eq('user_id', user.id)
        .eq('is_primary', true);
    }

    const { data: contact, error } = await userClient
      .from('emergency_contacts')
      .insert({
        user_id: user.id,
        name: name.trim(),
        phone: phone.trim(),
        relation: relation?.trim() || null,
        is_primary: shouldSetPrimary,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(
      {
        success: true,
        contact,
        message: shouldSetPrimary
          ? 'Contacto de emergencia agregado como principal'
          : 'Contacto de emergencia agregado exitosamente',
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al agregar contacto de emergencia';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─── PUT: Actualizar contacto de emergencia ──────────────────────────────────
export async function PUT(request: Request) {
  try {
    // Auth
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { contact_id, name, phone, relation, is_primary } = body;

    if (!contact_id) {
      return NextResponse.json(
        { error: 'El ID del contacto es requerido' },
        { status: 400 }
      );
    }

    const userClient = createUserClient(token);

    const { data: existingContact, error: fetchError } = await userClient
      .from('emergency_contacts')
      .select('id, user_id')
      .eq('id', contact_id)
      .single();

    if (fetchError || !existingContact) {
      return NextResponse.json(
        { error: 'Contacto de emergencia no encontrado' },
        { status: 404 }
      );
    }

    if (existingContact.user_id !== user.id) {
      return NextResponse.json(
        { error: 'No puedes modificar un contacto que no te pertenece' },
        { status: 403 }
      );
    }

    if (is_primary === true) {
      await userClient
        .from('emergency_contacts')
        .update({ is_primary: false })
        .eq('user_id', user.id)
        .eq('is_primary', true);
    }

    const updatePayload: Record<string, unknown> = {};
    if (name !== undefined) updatePayload.name = name.trim();
    if (phone !== undefined) updatePayload.phone = phone.trim();
    if (relation !== undefined) updatePayload.relation = relation.trim() || null;
    if (is_primary !== undefined) updatePayload.is_primary = is_primary;

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json(
        { error: 'No se proporcionaron campos para actualizar' },
        { status: 400 }
      );
    }

    const { data: updatedContact, error } = await userClient
      .from('emergency_contacts')
      .update(updatePayload)
      .eq('id', contact_id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      contact: updatedContact,
      message: 'Contacto de emergencia actualizado exitosamente',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al actualizar contacto de emergencia';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─── DELETE: Eliminar contacto de emergencia ─────────────────────────────────
export async function DELETE(request: Request) {
  try {
    // Auth
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { contact_id } = body;

    if (!contact_id) {
      return NextResponse.json(
        { error: 'El ID del contacto es requerido' },
        { status: 400 }
      );
    }

    const userClient = createUserClient(token);

    const { data: existingContact, error: fetchError } = await userClient
      .from('emergency_contacts')
      .select('id, user_id, is_primary')
      .eq('id', contact_id)
      .single();

    if (fetchError || !existingContact) {
      return NextResponse.json(
        { error: 'Contacto de emergencia no encontrado' },
        { status: 404 }
      );
    }

    if (existingContact.user_id !== user.id) {
      return NextResponse.json(
        { error: 'No puedes eliminar un contacto que no te pertenece' },
        { status: 403 }
      );
    }

    const wasPrimary = existingContact.is_primary;

    const { error } = await userClient
      .from('emergency_contacts')
      .delete()
      .eq('id', contact_id);

    if (error) throw error;

    if (wasPrimary) {
      const { data: remainingContacts } = await userClient
        .from('emergency_contacts')
        .select('id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1);

      if (remainingContacts && remainingContacts.length > 0) {
        await userClient
          .from('emergency_contacts')
          .update({ is_primary: true })
          .eq('id', remainingContacts[0].id);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Contacto de emergencia eliminado exitosamente',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al eliminar contacto de emergencia';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
