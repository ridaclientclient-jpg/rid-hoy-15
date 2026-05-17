import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CartItem {
  cartItemId: string; // Unique for each entry in cart (even same product with different options)
  id: string; // Product ID
  vendorId: string; // Vendor ID
  name: string;
  description: string;
  price: number; // Final price including options
  basePrice: number; // Original product price
  category: string;
  quantity: number;
  selectedOptions?: Array<{
    group: string;
    name: string;
    price: number;
  }>;
}

interface CartState {
  items: CartItem[];
  isOpen: boolean;

  // Actions
  addItem: (product: Omit<CartItem, 'quantity' | 'cartItemId'>) => void;
  removeItem: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;

  // Computed (as getters)
  itemCount: () => number;
  subtotal: () => number;
  deliveryFee: () => number;
  total: () => number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DELIVERY_FEE_RATE = 0.10; // 10% del subtotal
const MIN_DELIVERY_FEE = 500;   // Minimo ₡500
const MAX_DELIVERY_FEE = 3000;  // Maximo ₡3,000
const MAX_ITEM_QTY = 20;

// ─── Store ────────────────────────────────────────────────────────────────────

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      addItem: (product) => {
        const { items } = get();
        
        // Find if an identical item (same ID AND same options) exists
        const existingIndex = items.findIndex((i) => {
          if (i.id !== product.id) return false;
          // Compare options
          const iOpts = i.selectedOptions || [];
          const pOpts = product.selectedOptions || [];
          if (iOpts.length !== pOpts.length) return false;
          return pOpts.every(po => iOpts.some(io => io.name === po.name && io.group === po.group));
        });

        if (existingIndex > -1) {
          const existing = items[existingIndex];
          if (existing.quantity >= MAX_ITEM_QTY) return;
          
          const newItems = [...items];
          newItems[existingIndex] = { ...existing, quantity: existing.quantity + 1 };
          set({ items: newItems });
        } else {
          const cartItemId = `${product.id}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
          set({ items: [...items, { ...product, cartItemId, quantity: 1 }] });
        }
      },

      removeItem: (cartItemId) => {
        set({ items: get().items.filter((i) => i.cartItemId !== cartItemId) });
      },

      updateQuantity: (cartItemId, quantity) => {
        if (quantity < 1) {
          set({ items: get().items.filter((i) => i.cartItemId !== cartItemId) });
          return;
        }
        if (quantity > MAX_ITEM_QTY) return;
        set({
          items: get().items.map((i) =>
            i.cartItemId === cartItemId ? { ...i, quantity } : i
          ),
        });
      },

      clearCart: () => set({ items: [] }),
      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),
      toggleCart: () => set({ isOpen: !get().isOpen }),

      itemCount: () => {
        return get().items.reduce((sum, i) => sum + i.quantity, 0);
      },

      subtotal: () => {
        return get().items.reduce((sum, i) => sum + i.price * i.quantity, 0);
      },

      deliveryFee: () => {
        const sub = get().subtotal();
        if (sub === 0) return 0;
        const fee = Math.round(sub * DELIVERY_FEE_RATE);
        return Math.max(MIN_DELIVERY_FEE, Math.min(fee, MAX_DELIVERY_FEE));
      },

      total: () => {
        return get().subtotal() + get().deliveryFee();
      },
    }),
    {
      name: 'rida-cart', // localStorage key
      partialize: (state) => ({ items: state.items }), // Only persist items
    }
  )
);
