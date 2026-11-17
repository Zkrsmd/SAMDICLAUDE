'use client';
import { useEffect, useMemo, useState } from 'react';
import type { CartLine } from '@/stores/cart';
import type { QuoteResponse } from '@/app/api/cart/quote/route';

/** Fetches a server-side price quote for the cart lines (debounced). */
export function useQuote(lines: CartLine[], enabled = true) {
  const [data, setData] = useState<QuoteResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const body = useMemo(() => JSON.stringify({ items: lines }), [lines]);

  useEffect(() => {
    if (!enabled) return;
    if (!lines.length) {
      setData({ lines: [], rejected: [], subtotal: 0, currency: 'EUR' });
      setError(null);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch('/api/cart/quote', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body,
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(res.status === 429 ? 'Too many requests — try again shortly.' : 'Could not price your bag.');
        setData((await res.json()) as QuoteResponse);
        setError(null);
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setError((e as Error).message);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 120);
    return () => {
      ctrl.abort();
      window.clearTimeout(t);
    };
  }, [body, enabled, lines.length]);

  return { data, error, loading };
}
