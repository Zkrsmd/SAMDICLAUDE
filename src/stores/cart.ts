'use client';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/** The cart stores identifiers and quantities only. Prices always come from the server quote. */
export interface CartLine {
  productId: string;
  colorId: string;
  size: string;
  qty: number;
}

interface CartState {
  lines: CartLine[];
  add: (line: CartLine) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
}

export const lineKey = (l: Pick<CartLine, 'productId' | 'colorId' | 'size'>) => `${l.productId}::${l.colorId}::${l.size}`;

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      add: (line) =>
        set((s) => {
          const k = lineKey(line);
          const existing = s.lines.find((l) => lineKey(l) === k);
          if (existing)
            return { lines: s.lines.map((l) => (lineKey(l) === k ? { ...l, qty: Math.min(5, l.qty + line.qty) } : l)) };
          return { lines: [...s.lines, { ...line, qty: Math.min(5, Math.max(1, line.qty)) }].slice(-50) };
        }),
      setQty: (key, qty) =>
        set((s) => ({
          lines: s.lines.map((l) => (lineKey(l) === key ? { ...l, qty: Math.min(5, Math.max(1, Math.round(qty))) } : l)),
        })),
      remove: (key) => set((s) => ({ lines: s.lines.filter((l) => lineKey(l) !== key) })),
      clear: () => set({ lines: [] }),
    }),
    { name: 'yb-cart-v1', storage: createJSONStorage(() => localStorage), version: 1 },
  ),
);

export const useCartCount = () => useCart((s) => s.lines.reduce((n, l) => n + l.qty, 0));
