import { Suspense } from 'react';
import { Filters } from './Filters';
import { RevealGrid } from './RevealGrid';
import { applyListing, facetsFor, toCard } from '@/lib/catalog';
import { ListingParamsSchema } from '@/lib/validation/catalog';
import type { Product } from '@/types/catalog';

/** Server-side filtered + sorted listing. Search params are untrusted and validated with Zod. */
export function Listing({
  base,
  searchParams,
  revealKey,
  title = 'All products',
}: {
  base: Product[];
  searchParams: Record<string, string | string[] | undefined>;
  revealKey: string;
  title?: string;
}) {
  const params = ListingParamsSchema.parse(searchParams);
  const items = applyListing(base, params).map(toCard);
  const facets = facetsFor(base);
  return (
    <section id="listing" aria-labelledby="listing-title" className="container-x scroll-mt-20 py-10">
      <h2 id="listing-title" className="display mb-5 text-[clamp(26px,5.4vw,50px)]">
        {title}
      </h2>
      <Suspense fallback={<div className="h-12" />}>
        <Filters facets={facets} total={items.length} />
      </Suspense>
      <div className="mt-6">
        <RevealGrid items={items} revealKey={revealKey} />
      </div>
    </section>
  );
}
