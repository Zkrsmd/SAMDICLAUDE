'use client';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface WishlistState {
  slugs: string[];
  toggle: (slug: string) => void;
  has: (slug: string) => boolean;
}

export const useWishlist = create<WishlistState>()(
  persist(
    (set, get) => ({
      slugs: [],
      toggle: (slug) =>
        set((s) => ({ slugs: s.slugs.includes(slug) ? s.slugs.filter((x) => x !== slug) : [slug, ...s.slugs].slice(0, 100) })),
      has: (slug) => get().slugs.includes(slug),
    }),
    { name: 'yb-wishlist-v1', storage: createJSONStorage(() => localStorage) },
  ),
);

interface RecentState {
  slugs: string[];
  push: (slug: string) => void;
}

export const useRecent = create<RecentState>()(
  persist(
    (set) => ({
      slugs: [],
      push: (slug) => set((s) => ({ slugs: [slug, ...s.slugs.filter((x) => x !== slug)].slice(0, 12) })),
    }),
    { name: 'yb-recent-v1', storage: createJSONStorage(() => localStorage) },
  ),
);
