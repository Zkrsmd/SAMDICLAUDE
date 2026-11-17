'use client';
import { useEffect, useMemo, useState } from 'react';
import type { CartLine } from '@/stores/cart';
import type { QuoteResponse } from '@/app/api/cart/quote/route';

const EMPTY: QuoteResponse = { lines: [], rejected: [], subtotal: 0, currency: 'EUR' };

/** Fetches a server-side price quote for the cart lines (debounced). The client never sends prices. */
export function useQuote(lines: CartLine[], enabled = true) {
  const body = useMemo(() => JSON.stringify({ items: lines }), [lines]);
  const [state, setState] = useState<{ key: string; data: QuoteResponse | null; error: string | null }>({ key: '', data: null, error: null });

  useEffect(() => {
    if (!enabled || !lines.length) return;
    const ctrl = new AbortController();
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch('/api/cart/quote', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body,
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(res.status === 429 ? 'Too many requests — try again shortly.' : 'Could not price your bag.');
        const data = (await res.json()) as QuoteResponse;
        setState({ key: body, data, error: null });
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setState((s) => ({ key: body, data: s.data, error: (e as Error).message }));
      }
    }, 120);
    return () => {
      ctrl.abort();
      window.clearTimeout(t);
    };
  }, [body, enabled, lines.length]);

  if (!lines.length) return { data: EMPTY, error: null, loading: false };
  return { data: state.data, error: state.error, loading: state.key !== body };
}
