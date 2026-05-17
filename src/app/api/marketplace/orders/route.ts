import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/* ═══════════════════════════════════════════════════════════════════════════════
   FRAUD CHECK ENGINE
   ═══════════════════════════════════════════════════════════════════════════════ */

interface FraudResult {
  score: number;
  reasons: string[];
  action: 'pass' | 'review' | 'block';
}

function runFraudCheck(params: {
  customerId: string;
  vendorId: string;
  items: Array<{ product_id: string; name: string; price: number; quantity: number; category: string }>;
  total: number;
  deliveryAddress: string;
  paymentMethod: string;
}): FraudResult {
  const { customerId, items, total, deliveryAddress, paymentMethod } = params;
  const reasons: string[] = [];
  let score = 0;

  // Rule 1: Very high value orders (>₡100,000)
  if (total > 100000) {
    score += 30;
    reasons.push('Orden de alto valor');
  }

  // Rule 2: Many items in single order (>10)
  const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);
  if (totalQty > 10) {
    score += 15;
    reasons.push('Muchos productos en un pedido');
  }

  // Rule 3: Very low value but many items (potential test/abuse)
  if (totalQty > 5 && total < 2000) {
    score += 25;
    reasons.push('Patron inusual: muchos items bajo valor');
  }

  // Rule 4: Empty or very short delivery address
  if (deliveryAddress.trim().length < 5) {
    score += 20;
    reasons.push('Direccion de entrega muy corta');
  }

  // Rule 5: Suspicious item quantities (>5 of same item)
  for (const item of items) {
    if (item.quantity > 5) {
      score += 15;
      reasons.push(`Cantidad inusual: ${item.quantity}x ${item.name}`);
    }
  }

  // Rule 6: Suspiciously round total amounts (potential testing)
  if (total > 0 && [1000, 5000, 10000, 50000, 100000].includes(total)) {
    score += 10;
    reasons.push('Monto redondo sospechoso');
  }

  // Rule 7: Rate limiting - check recent orders from this customer
  // (This would ideally be a DB query, but for now we score it lightly)
  if (items.some(i => i.price <= 0)) {
    score += 40;
    reasons.push('Precio invalido detectado');
  }

  // Determine action based on score
  let action: FraudResult['action'] = 'pass';
  if (score >= 50) {
    action = 'block';
  } else if (score >= 25) {
    action = 'review';
  }

  return { score, reasons, action };
}

/* ═══════════════════════════════════════════════════════════════════════════════
   ORDER CREATION ENDPOINT
   ═══════════════════════════════════════════════════════════════════════════════ */

export async function POST(request: NextRequest) {
  try {
    // Get auth token from header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    // Verify session with Supabase
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Sesion invalida o expirada' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const {
      vendor_id,
      items,
      delivery_address,
      delivery_lat,
      delivery_lng,
      customer_lat,
      customer_lng,
      payment_method,
      notes,
      customer_name,
      customer_phone,
    } = body as {
      vendor_id: string;
      items: Array<{ product_id: string; name: string; price: number; quantity: number; category: string }>;
      delivery_address: string;
      delivery_lat?: number;
      delivery_lng?: number;
      customer_lat?: number;
      customer_lng?: number;
      payment_method: 'efectivo' | 'tarjeta' | 'sinpe' | 'billetera';
      notes?: string;
      customer_name?: string;
      customer_phone?: string;
    };

    // Validate required fields
    if (!vendor_id) {
      return NextResponse.json(
        { success: false, error: 'Se requiere vendor_id' },
        { status: 400 }
      );
    }

    if (!items || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'El pedido debe tener al menos un producto' },
        { status: 400 }
      );
    }

    if (!delivery_address?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Se requiere direccion de entrega' },
        { status: 400 }
      );
    }

    const validPaymentMethods = ['efectivo', 'tarjeta', 'sinpe', 'billetera'];
    if (!payment_method || !validPaymentMethods.includes(payment_method)) {
      return NextResponse.json(
        { success: false, error: 'Metodo de pago invalido' },
        { status: 400 }
      );
    }

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const DELIVERY_FEE_PCT = 0.1;
    const MIN_DELIVERY_FEE = 500;
    const MAX_DELIVERY_FEE = 3000;
    const deliveryFee = subtotal > 0
      ? Math.max(MIN_DELIVERY_FEE, Math.min(Math.round(subtotal * DELIVERY_FEE_PCT), MAX_DELIVERY_FEE))
      : 0;
    const total = subtotal + deliveryFee;

    // ─── Run Fraud Check ──────────────────────────────────────────────
    const fraud = runFraudCheck({
      customerId: user.id,
      vendorId: vendor_id,
      items,
      total,
      deliveryAddress: delivery_address,
      paymentMethod: payment_method,
    });

    // If blocked, return immediately
    if (fraud.action === 'block') {
      return NextResponse.json({
        success: false,
        error: 'Pedido bloqueado por el sistema de seguridad',
        fraud,
      }, { status: 403 });
    }

    // ─── Build order items for DB ─────────────────────────────────────
    const deliveryItems = items.map((item) => ({
      id: item.product_id,
      name: item.name,
      price: item.price,
      qty: item.quantity,
      category: item.category,
    }));

    // ─── Create the delivery/order record ─────────────────────────────
    const orderData: Record<string, unknown> = {
      customer_id: user.id,
      vendor_id,
      status: 'pending',
      delivery_address: delivery_address.trim(),
      items: deliveryItems,
      subtotal,
      delivery_fee: deliveryFee,
      total,
      payment_method,
      is_marketplace: true,
      payment_status: 'pending',
      review_status: fraud.action === 'review' ? 'flagged' : 'normal',
      fraud_score: fraud.score > 0 ? fraud.score : null,
      fraud_reasons: fraud.reasons.length > 0 ? fraud.reasons : null,
      auto_blocked: false,
    };

    // Optional fields
    if (delivery_lat != null) orderData.delivery_lat = delivery_lat;
    if (delivery_lng != null) orderData.delivery_lng = delivery_lng;
    if (customer_lat != null) orderData.customer_lat = customer_lat;
    if (customer_lng != null) orderData.customer_lng = customer_lng;
    if (notes?.trim()) orderData.notes = notes.trim();
    if (customer_name?.trim()) orderData.customer_name = customer_name.trim();
    if (customer_phone?.trim()) orderData.customer_phone = customer_phone.trim();

    // Marketplace metadata
    orderData.marketplace_metadata = {
      source: 'marketplace_app',
      payment_method,
      item_count: items.length,
      total_quantity: items.reduce((sum, i) => sum + i.quantity, 0),
    };

    const { data: order, error: insertError } = await supabase
      .from('deliveries')
      .insert(orderData)
      .select('id, status, payment_status, review_status, total, created_at')
      .single();

    if (insertError) {
      console.error('Order insert error:', insertError);
      return NextResponse.json(
        { success: false, error: 'Error al crear el pedido: ' + insertError.message },
        { status: 500 }
      );
    }

    // ─── Auto-assign courier (optional, best effort) ──────────────────
    try {
      const { data: availableCourier } = await supabase
        .from('couriers')
        .select('id')
        .eq('status', 'online')
        .limit(1)
        .single();

      if (availableCourier && order) {
        await supabase
          .from('deliveries')
          .update({ courier_id: availableCourier.id, status: 'assigned' })
          .eq('id', order.id);

        await supabase
          .from('couriers')
          .update({ status: 'busy' })
          .eq('id', availableCourier.id);
      }
    } catch {
      // Courier assignment is optional
    }

    // ─── Return success ───────────────────────────────────────────────
    const response: Record<string, unknown> = {
      success: true,
      order: {
        id: order.id,
        status: order.status,
        payment_status: order.payment_status,
        review_status: order.review_status,
        total: order.total,
        created_at: order.created_at,
      },
    };

    if (fraud.action === 'review') {
      response.fraud = fraud;
    }

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Orders API error:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
