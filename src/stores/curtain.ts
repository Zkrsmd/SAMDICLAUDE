'use client';
import { create } from 'zustand';

/** Route transition curtain: a sport-coloured circle that expands from the tap point. */
interface CurtainState {
  phase: 'idle' | 'in' | 'hold' | 'out';
  color: string;
  ink: string;
  word: string;
  x: number;
  y: number;
  start: (o: { color: string; ink?: string; word: string; x: number; y: number }) => void;
  set: (p: Partial<CurtainState>) => void;
}

export const useCurtain = create<CurtainState>()((set) => ({
  phase: 'idle',
  color: '#89C94A',
  ink: '#171A18',
  word: '',
  x: 0,
  y: 0,
  start: (o) => set({ phase: 'in', color: o.color, ink: o.ink ?? '#171A18', word: o.word, x: o.x, y: o.y }),
  set: (p) => set(p),
}));
