'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

/**
 * Hook que obtiene o crea automáticamente el registro `vendors` para el usuario actual.
 * Tiene 3 estrategias de fallback:
 *   1. RPC get_or_create_vendor (SECURITY DEFINER)
 *   2. Query directa a tabla vendors
 *   3. Insert directo si no existe
 *
 * Retorna:
 *   - vendorId: string | null  → ID del vendor
 *   - loading: boolean         → true mientras carga
 *   - error: string | null     → mensaje de error si algo falla
 *   - refetch: () => void      → para forzar recarga
 */
export function useVendorId() {
  const { user } = useAuthStore();
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const ensureVendor = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // ── Estrategia 1: RPC ─────────────────────────────────
      try {
        const { data: rows, error: rpcErr } = await supabase.rpc('get_or_create_vendor', {
          p_user_id: user.id,
        });

        if (!rpcErr && rows && rows.length > 0 && (rows[0].id || rows[0].out_id)) {
          const vid = rows[0].out_id || rows[0].id;
          setVendorId(vid);
          console.log('[useVendorId] RPC success, vendorId:', vid);
          return;
        }
        console.warn('[useVendorId] RPC failed or empty, trying fallback...', rpcErr?.message);
      } catch (rpcCatch) {
        console.warn('[useVendorId] RPC exception, trying fallback:', rpcCatch);
      }

      // ── Estrategia 2: Query directa ───────────────────────
      try {
        const { data: vendorRows, error: queryErr } = await supabase
          .from('vendors')
          .select('id')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true })
          .limit(1);

        if (!queryErr && vendorRows && vendorRows.length > 0 && vendorRows[0].id) {
          setVendorId(vendorRows[0].id);
          console.log('[useVendorId] Direct query success, vendorId:', vendorRows[0].id);
          return;
        }
        console.warn('[useVendorId] Vendor not found, creating...', queryErr?.message);
      } catch (queryCatch) {
        console.warn('[useVendorId] Direct query exception, trying insert...', queryCatch);
      }

      // ── Estrategia 3: Insert directo ──────────────────────
      try {
        const { data: newVendor, error: insertErr } = await supabase
          .from('vendors')
          .insert({
            user_id: user.id,
            store_name: 'Mi Tienda',
            category: 'other',
            is_approved: true,
            is_active: true,
            rating: 5.0,
          })
          .select('id')
          .single();

        if (!insertErr && newVendor?.id) {
          setVendorId(newVendor.id);
          console.log('[useVendorId] Insert success, vendorId:', newVendor.id);
          return;
        }
        console.error('[useVendorId] Insert failed:', insertErr);
        setError('No se pudo crear tu tienda: ' + (insertErr?.message || 'Error desconocido'));
      } catch (insertCatch) {
        console.error('[useVendorId] Insert exception:', insertCatch);
        setError('Error de conexion al crear tienda');
      }
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    ensureVendor();
  }, [ensureVendor]);

  return { vendorId, loading, error, refetch: ensureVendor };
}
