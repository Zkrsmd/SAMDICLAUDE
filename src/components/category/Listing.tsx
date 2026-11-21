import Link from 'next/link';
import { Suspense } from 'react';
import { Filters } from './Filters';
import { RevealGrid } from './RevealGrid';
import { applyListing, facetsFor, toCard } from '@/lib/catalog';
import { ListingParamsSchema } from '@/lib/validation/catalog';
import type { Product } from '@/types/catalog';
import { getT } from '@/i18n/server';

const PAGE = 48;

/** Server-side filtered + sorted listing. Search params are untrusted and validated with Zod. */
export async function Listing({
  base,
  searchParams,
  revealKey,
  title,
}: {
  base: Product[];
  searchParams: Record<string, string | string[] | undefined>;
  revealKey: string;
  title?: string;
}) {
  const t = await getT();
  const params = ListingParamsSchema.parse(searchParams);
  const all = applyListing(base, params);
  // 48 at a time: "Show more" is a real link (?page=2…), so it works without JavaScript too
  const page = Math.min(50, Math.max(1, Number.parseInt(String(searchParams.page ?? '1'), 10) || 1));
  const items = all.slice(0, PAGE * page).map(toCard);
  const facets = facetsFor(base);
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (k === 'page' || v === undefined) continue;
    for (const x of Array.isArray(v) ? v : [v]) next.append(k, x);
  }
  next.set('page', String(page + 1));
  return (
    <section id="listing" aria-labelledby="listing-title" className="container-x scroll-mt-20 py-10">
      <h2 id="listing-title" className="display mb-5 text-[clamp(26px,5.4vw,50px)]">
        {title ?? t('All products')}
      </h2>
      <Suspense fallback={<div className="h-12" />}>
        <Filters facets={facets} total={all.length} />
      </Suspense>
      <div className="mt-6">
        <RevealGrid items={items} revealKey={revealKey} />
      </div>
      <div className="mt-8 flex flex-col items-center gap-2">
        <p className="mono text-[12px] text-muted">
          {t('Showing {a} of {b}', { a: items.length, b: all.length })}
        </p>
        {items.length < all.length && (
          <Link href={`?${next.toString()}`} scroll={false} className="btn-holo h-12 px-7" data-testid="listing-more">
            {t('Show more')}
          </Link>
        )}
      </div>
    </section>
  );
}
