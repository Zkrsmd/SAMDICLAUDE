'use client';
import { useEffect, useState } from 'react';
import type { CardData } from '@/lib/catalog';

const memo = new Map<string, CardData>();
const gone = new Set<string>();

/** Cards for these slugs, fetched from /api/cards (remembered for the visit). */
export function useCards(slugs: string[]): CardData[] | null {
  const key = slugs.slice(0, 60).join(',');
  const [, bump] = useState(0);
  const missing = slugs.filter((s) => !memo.has(s) && !gone.has(s));
  useEffect(() => {
    if (!key) return;
    const need = key.split(',').filter((s) => !memo.has(s) && !gone.has(s));
    if (!need.length) return;
    let live = true;
    fetch(`/api/cards?s=${need.join(',')}`)
      .then((r) => (r.ok ? (r.json() as Promise<CardData[]>) : []))
      .then((list) => {
        for (const c of list) memo.set(c.slug, c);
        // slugs that no longer exist: remember them as gone so we don't ask again
        for (const s of need) if (!memo.has(s)) gone.add(s);
        if (live) bump((n) => n + 1);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [key]);
  if (missing.length && key) return null;
  return slugs.map((s) => memo.get(s)).filter((c): c is CardData => !!c);
}
