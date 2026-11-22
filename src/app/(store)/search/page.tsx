import type { Metadata } from 'next';
import { Listing } from '@/components/category/Listing';
import { SearchBox } from '@/components/search/SearchBox';
import { getAllProducts } from '@/lib/catalog';
import { ListingParamsSchema } from '@/lib/validation/catalog';
import { ensureStore } from '@/lib/catalog';
import { getT } from '@/i18n/server';

export const dynamic = 'force-dynamic';

// results pages are for people, not for the index
export const metadata: Metadata = { title: 'Search', robots: { index: false, follow: true } };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function SearchPage({ searchParams }: Props) {
  const t = await getT();
  await ensureStore();
  const sp = await searchParams;
  const { q } = ListingParamsSchema.parse(sp);
  return (
    <>
      <header className="container-x" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 88px)' }}>
        <p className="eyebrow text-muted">{t('Search')}</p>
        <h1 className="display mt-3 text-[clamp(40px,9vw,96px)]">{q ? `“${q}”` : t('All products')}</h1>
        <div className="mt-6 max-w-xl">
          <SearchBox initial={q} />
        </div>
      </header>
      <Listing base={getAllProducts()} searchParams={sp} revealKey={`search:${q}`} title={q ? t('Results') : t('Everything')} />
    </>
  );
}
