'use client';
import { create } from 'zustand';

interface UiState {
  cartOpen: boolean;
  searchOpen: boolean;
  menuOpen: boolean;
  /** Set by the intro loader; the hero waits for it before playing its timeline. */
  introDone: boolean;
  /** Last added product, used by the fly-to-cart animation. */
  flyFrom: { x: number; y: number; src: string; n?: number } | null;
  set: (patch: Partial<Omit<UiState, 'set'>>) => void;
}

export const useUi = create<UiState>()((set) => ({
  cartOpen: false,
  searchOpen: false,
  menuOpen: false,
  introDone: false,
  flyFrom: null,
  set: (patch) => set(patch),
}));

/**
 * Camera hand-off from the showroom to the product page: the product page reads it once
 * to open from the same close-up framing, then clears it.
 */
interface TransitionState {
  pending: { slug: string; at: number } | null;
  setPending: (slug: string | null) => void;
}

export const useTransitionStore = create<TransitionState>()((set) => ({
  pending: null,
  setPending: (slug) => set({ pending: slug ? { slug, at: Date.now() } : null }),
}));
