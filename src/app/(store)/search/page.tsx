import type { Metadata } from 'next';
import { Listing } from '@/components/category/Listing';
import { SearchBox } from '@/components/search/SearchBox';
import { getAllProducts } from '@/lib/catalog';
import { ListingParamsSchema } from '@/lib/validation/catalog';

export const metadata: Metadata = { title: 'Search' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function SearchPage({ searchParams }: Props) {
  const sp = await searchParams;
  const { q } = ListingParamsSchema.parse(sp);
  return (
    <>
      <header className="container-x" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 88px)' }}>
        <p className="eyebrow text-muted">Search</p>
        <h1 className="display mt-3 text-[clamp(40px,9vw,96px)]">{q ? `“${q}”` : 'All products'}</h1>
        <div className="mt-6 max-w-xl">
          <SearchBox initial={q} />
        </div>
      </header>
      <Listing base={getAllProducts()} searchParams={sp} revealKey={`search:${q}`} title={q ? 'Results' : 'Everything'} />
    </>
  );
}
