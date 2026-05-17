'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ShoppingCart, Minus, Plus, Trash2,
  Truck, ShoppingBag, ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useCartStore, type CartItem } from '@/store/cartStore';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';

// ─── Category badge colors (match market page) ────────────────────────────────

const categoryBadgeColors: Record<string, string> = {
  Farmacia: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  Comida: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  Tiendas: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
};

// ─── Cart Item Row ────────────────────────────────────────────────────────────

function CartItemRow({ item }: { item: CartItem }) {
  const { updateQuantity, removeItem } = useCartStore();

  const lineTotal = item.price * item.quantity;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20, height: 0 }}
      className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-colors"
    >
      {/* Category icon area */}
      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-500/15 to-amber-500/10 flex items-center justify-center flex-shrink-0 border border-orange-500/10">
        <ShoppingBag className="w-5 h-5 text-orange-400/70" />
      </div>

      {/* Product info */}
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-semibold text-white truncate leading-tight">{item.name}</h4>
        
        {/* Selected Options (New) */}
        {item.selectedOptions && item.selectedOptions.length > 0 && (
          <div className="mt-1 space-y-0.5">
            {item.selectedOptions.map((opt, i) => (
              <p key={i} className="text-[10px] text-gray-500 font-medium">
                + {opt.name} {opt.price > 0 ? `(₡${opt.price.toLocaleString()})` : ''}
              </p>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 mt-1.5">
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-medium ${categoryBadgeColors[item.category] || 'bg-gray-500/15 text-gray-400 border-gray-500/30'}`}>
            {item.category}
          </span>
          <span className="text-[10px] text-gray-500">
            ₡{item.price.toLocaleString()} c/u
          </span>
        </div>
      </div>

      {/* Quantity controls + line total */}
      <div className="flex flex-col items-end gap-2 flex-shrink-0">
        <span className="text-sm font-bold text-white">
          ₡{lineTotal.toLocaleString()}
        </span>
        <div className="flex items-center gap-1.5 bg-white/[0.04] rounded-xl p-0.5">
          <button
            type="button"
            onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)}
            className="w-7 h-7 rounded-lg bg-white/[0.06] hover:bg-white/10 flex items-center justify-center transition-all text-gray-400 hover:text-white"
          >
            {item.quantity === 1 ? (
              <Trash2 className="w-3 h-3 text-red-400" />
            ) : (
              <Minus className="w-3 h-3" />
            )}
          </button>
          <span className="w-6 text-center text-xs font-bold text-white">
            {item.quantity}
          </span>
          <button
            type="button"
            onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}
            className="w-7 h-7 rounded-lg bg-orange-500/15 hover:bg-orange-500/25 flex items-center justify-center transition-all text-orange-400"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Empty Cart State ─────────────────────────────────────────────────────────

function EmptyCart() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-orange-500/10 to-amber-500/5 flex items-center justify-center mb-5 border border-orange-500/10">
        <ShoppingCart className="w-9 h-9 text-orange-400/40" />
      </div>
      <h3 className="text-base font-bold text-white mb-1.5">Tu carrito esta vacio</h3>
      <p className="text-sm text-gray-500 text-center max-w-xs">
        Explora el Marketplace y agrega productos a tu carrito
      </p>
    </div>
  );
}

// ─── Main CartSheet Component ─────────────────────────────────────────────────

export default function CartSheet() {
  const router = useRouter();
  const { user } = useAuthStore();
  const {
    items, isOpen, closeCart,
    clearCart, itemCount, subtotal, deliveryFee, total,
  } = useCartStore();

  const sheetRef = useRef<HTMLDivElement>(null);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) closeCart();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, closeCart]);

  const count = itemCount();
  const sub = subtotal();
  const fee = deliveryFee();
  const serviceFee = Math.round(sub * 0.05); // 5% Service fee
  const tot = sub + fee + serviceFee;

  const [instructions, setInstructions] = useState('Encuéntrame en la puerta');
  const [paymentMethod, setPaymentMethod] = useState('efectivo');

  const handleCheckout = async () => {
    if (!user?.id) {
      toast.error('Inicia sesion para hacer un pedido');
      router.push('/client/login');
      closeCart();
      return;
    }

    if (items.length === 0) return;

    try {
      // 1. If using wallet, check balance first
      if (paymentMethod === 'billetera') {
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('balance')
          .eq('id', user.id)
          .single();
        
        if (profileErr || !profile) {
          toast.error('Error al verificar saldo de billetera');
          return;
        }

        if ((profile.balance || 0) < tot) {
          toast.error('Saldo insuficiente en tu billetera Rid@', {
            description: `Te faltan ₡${(tot - (profile.balance || 0)).toLocaleString()} para completar este pedido.`,
          });
          return;
        }
      }
      // Build delivery items array for Supabase
      const deliveryItems = items.map((i) => ({
        id: i.id,
        name: i.name,
        price: i.price,
        base_price: i.basePrice,
        qty: i.quantity,
        category: i.category,
        selected_options: i.selectedOptions || [],
      }));

      const { data: delivery, error } = await supabase
        .from('deliveries')
        .insert({
          customer_id: user.id,
          vendor_id: items[0].vendorId,
          status: 'pending',
          delivery_address: 'Direccion del cliente',
          items: deliveryItems,
          subtotal: sub,
          delivery_fee: fee,
          service_fee: serviceFee,
          total: tot,
          payment_method: paymentMethod,
          instructions: instructions,
        })
        .select()
        .single();

      if (error) {
        console.warn('Delivery insert error:', error.message);
        throw error;
      }

      // 3. If wallet payment was successful, register the debit transaction
      if (paymentMethod === 'billetera' && delivery) {
        const { error: transErr } = await supabase
          .from('wallet_transactions')
          .insert({
            user_id: user.id,
            amount: tot,
            type: 'debit',
            category: 'payment',
            description: `Pago de pedido #${delivery.id.slice(0, 5)}`,
            reference_id: delivery.id
          });
        
        if (transErr) {
          console.error('Wallet transaction error:', transErr);
        }
      }

      // Try auto-assign courier (if we got the delivery object)
      if (delivery) {
        const { data: availableCourier } = await supabase
          .from('couriers')
          .select('id')
          .eq('status', 'online')
          .limit(1)
          .single();

        if (availableCourier) {
          await supabase
            .from('deliveries')
            .update({ courier_id: availableCourier.id, status: 'assigned' })
            .eq('id', delivery.id);
        }
      }

      toast.success('Pedido realizado con éxito!', {
        description: `Total: ₡${tot.toLocaleString()}`,
        duration: 4000,
      });

      clearCart();
      closeCart();
      
      if (delivery?.id) {
        router.push(`/client/market/tracking/${delivery.id}`);
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      toast.error('Error al procesar el pedido: ' + (err?.message || 'Intenta de nuevo'));
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeCart}
          />

          {/* Sheet */}
          <motion.div
            ref={sheetRef}
            className="fixed inset-x-0 bottom-0 z-[80] max-w-md mx-auto"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 350 }}
          >
            <div className="bg-[#0c1018] border-t border-white/[0.08] rounded-t-[28px] max-h-[88vh] flex flex-col shadow-2xl shadow-black/40">

              {/* ── Drag Handle ───────────────────────────────────────── */}
              <div className="flex justify-center pt-3.5 pb-1">
                <div className="w-10 h-1 rounded-full bg-white/15" />
              </div>

              {/* ── Header ────────────────────────────────────────────── */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-orange-500/20 to-amber-500/10 flex items-center justify-center border border-orange-500/15">
                    <ShoppingCart className="w-5 h-5 text-orange-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Mi Carrito</h2>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {count === 0 ? 'Sin productos' : `${count} producto${count > 1 ? 's' : ''} en tu carrito`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {items.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        clearCart();
                        toast.info('Carrito vaciado');
                      }}
                      className="px-3.5 py-2 rounded-xl text-[11px] font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors border border-red-500/15"
                    >
                      Vaciar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={closeCart}
                    className="w-10 h-10 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center transition-colors border border-white/[0.06]"
                  >
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>
              </div>

              {/* ── Cart Items (scrollable) ────────────────────────────── */}
              <div className="flex-1 overflow-y-auto px-4 py-4">
                {items.length === 0 ? (
                  <EmptyCart />
                ) : (
                  <div className="space-y-3">
                    <AnimatePresence mode="popLayout">
                      {items.map((item) => (
                        <CartItemRow key={item.id} item={item} />
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              {/* ── Checkout Details (Instructions & Payment) ─────────── */}
              {items.length > 0 && (
                <div className="px-5 py-3 space-y-4 border-t border-white/[0.06]">
                  {/* Delivery Instructions */}
                  <div className="space-y-2">
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Instrucciones de entrega</p>
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                      {['Encuéntrame en la puerta', 'Dejar en la puerta', 'Cerca de portería'].map((opt) => (
                        <button
                          key={opt}
                          onClick={() => setInstructions(opt)}
                          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all ${
                            instructions === opt 
                              ? 'bg-orange-500/20 border-orange-500/50 text-orange-400' 
                              : 'bg-white/5 border-white/10 text-gray-400'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Payment Method */}
                  <div className="space-y-2">
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Metodo de pago</p>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setPaymentMethod('efectivo')}
                        className={`flex-1 flex items-center justify-between p-3 rounded-2xl border transition-all ${
                          paymentMethod === 'efectivo' ? 'bg-white/10 border-orange-500/50' : 'bg-white/5 border-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                            <span className="text-emerald-400 text-xs font-bold">₡</span>
                          </div>
                          <span className="text-xs font-bold text-white">Efectivo</span>
                        </div>
                        {paymentMethod === 'efectivo' && <div className="w-4 h-4 rounded-full bg-orange-500 border-4 border-white/20" />}
                      </button>
                      <button 
                        onClick={() => setPaymentMethod('billetera')}
                        className={`flex-1 flex items-center justify-between p-3 rounded-2xl border transition-all ${
                          paymentMethod === 'billetera' ? 'bg-white/10 border-orange-500/50' : 'bg-white/5 border-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                            <span className="text-blue-400 text-[10px] font-bold">RID@</span>
                          </div>
                          <span className="text-xs font-bold text-white">Billetera</span>
                        </div>
                        {paymentMethod === 'billetera' && <div className="w-4 h-4 rounded-full bg-orange-500 border-4 border-white/20" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Order Summary (sticky bottom) ──────────────────────── */}
              {items.length > 0 && (
                <div className="border-t border-white/[0.06] px-5 py-5 space-y-4 bg-[#0c1018] flex-shrink-0">
                  {/* Line items */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Subtotal ({count} producto{count > 1 ? 's' : ''})</span>
                      <span className="text-sm font-medium text-gray-200">₡{sub.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Envio</span>
                      <span className="text-sm font-medium text-gray-200">₡{fee.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Cuota de servicio</span>
                      <span className="text-sm font-medium text-gray-200">₡{serviceFee.toLocaleString()}</span>
                    </div>
                    <div className="h-px bg-white/[0.06]" />
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-base font-bold text-white">Total a pagar</span>
                      <span className="text-xl font-extrabold bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">₡{tot.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Checkout button */}
                  <motion.button
                    type="button"
                    onClick={handleCheckout}
                    className="w-full py-4 rounded-2xl text-sm font-bold flex items-center justify-center gap-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white transition-all shadow-lg shadow-orange-500/25 active:scale-[0.98]"
                    whileTap={{ scale: 0.97 }}
                  >
                    <ShoppingCart className="w-4 h-4" />
                    Realizar pedido — ₡{tot.toLocaleString()}
                    <ChevronRight className="w-4 h-4" />
                  </motion.button>

                  <p className="text-center text-[10px] text-gray-600 flex items-center justify-center gap-1.5">
                    Se asignara un conductor para la entrega
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
