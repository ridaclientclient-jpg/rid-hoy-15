import { NextResponse } from 'next/server';

/**
 * GET /api/push/vapid-key
 * Retorna la VAPID public key para que el cliente genere suscripciones push
 */
export async function GET() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
    'BKky1yRkVtMVMgCK6c9DqIsFH-LwXIu4EmzU_jXAu_ayZt7z-HyX5AXlhPvPpLTCbWNsOCkakTQmAhel2UK4cKA';

  return NextResponse.json({ publicKey });
}
