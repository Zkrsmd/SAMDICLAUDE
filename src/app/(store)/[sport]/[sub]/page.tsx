import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { SubNav } from '@/components/category/SubNav';
import { Listing } from '@/components/category/Listing';
import { Showroom } from '@/components/showroom/Showroom';
import { brandName } from '@/data/brands';
import { getSport, getSports, getSub, productsFor } from '@/lib/catalog';
import { ensureStore } from '@/lib/catalog';
import { getT } from '@/i18n/server';

// pages for products/sports added in the admin render on first visit (unknown ones still 404)
export const dynamic = 'force-dynamic';
type Props = {
  params: Promise<{ sport: string; sub: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await ensureStore();
  const { sport, sub } = await params;
  const s = getSport(sport);
  const x = getSub(sport, sub);
  const t = await getT();
  if (!s || !x) return {};
  const title = `${t(x.name)} ${t(s.name)} — ${t('price in Algeria')}`;
  const description = `${t(x.blurb)} ${t('Prices in DA, cash on delivery to all 58 wilayas.')}`;
  const path = `/${s.slug}/${x.slug}`;
  return { title, description, alternates: { canonical: path }, openGraph: { title, description, url: path } };
}

const ACCENT: Record<string, string> = { football: '#89C94A', boxing: '#C8A451', swimming: '#64D7D1' };

export default async function SubPage({ params, searchParams }: Props) {
  const t = await getT();
  await ensureStore();
  const { sport, sub } = await params;
  const s = getSport(sport);
  const x = getSub(sport, sub);
  if (!s || !x) notFound();
  const list = productsFor(s.slug, x.slug);
  const subs = s.subs.map((y) => {
    const l = productsFor(s.slug, y.slug);
    const pick = l.find((p) => p.featured) ?? l.find((p) => p.bestSeller) ?? l[0];
    return { slug: y.slug, name: t(y.name), count: l.length, showroom: y.showroom, image: pick ? { slug: pick.slug, color: pick.colors[0]!.id } : undefined };
  });
  const showItems = x.showroom
    ? list.map((p) => ({
        slug: p.slug,
        name: p.name,
        brandName: brandName(p.brand),
        price: p.price,
      }))
    : [];

  return (
    <>
      <header className="container-x pb-6" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 84px)' }}>
        <Breadcrumbs items={[{ label: t('Home'), href: '/' }, { label: t(s.name), href: `/${s.slug}` }, { label: t(x.name) }]} label={t('Breadcrumb')} />
        <div className="mt-5 flex items-end justify-between gap-6">
          <h1 className="display text-[clamp(40px,9vw,96px)]" style={{ animation: 'rise-in .8s var(--ease-expo) both' }}>
            {t(x.name)}
          </h1>
          <span className="mono mb-3 hidden shrink-0 text-[12px] uppercase tracking-[0.14em] text-muted md:block">{t('{n} products', { n: list.length })}</span>
        </div>
        <p className="mt-3 max-w-md text-[16px] text-muted">
          <span className="me-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: ACCENT[s.slug] ?? s.accent }} />
          {t(x.blurb)}
        </p>
        <div className="mt-6">
          <SubNav sport={s.slug} subs={subs} active={x.slug} />
        </div>
      </header>
      {x.showroom && showItems.length > 0 && <Showroom items={showItems} mount={x.showroom} sport={t(s.name)} />}
      <Listing base={list} searchParams={await searchParams} revealKey={`${s.slug}/${x.slug}`} title={x.showroom ? t('The full collection') : t('Products')} />
    </>
  );
}
