import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CategoryHero } from '@/components/category/CategoryHero';
import { SubNav } from '@/components/category/SubNav';
import { Listing } from '@/components/category/Listing';
import { getSport, getSports, productsFor } from '@/lib/catalog';
import { ensureStore } from '@/lib/catalog';
import { getT } from '@/i18n/server';
import { getWorld, type World } from '@/config/worlds';
import type { Product, SportSlug } from '@/types/catalog';

// pages for products/sports added in the admin render on first visit (unknown ones still 404)
export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ sport: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await ensureStore();
  const slug = (await params).sport;
  const s = getSport(slug);
  const t = await getT();
  const w = getWorld(slug);
  if (w) {
    const title = t('{sport} in Algeria', { sport: t(w.name) });
    const description = `${t(w.description)} ${t('Prices in DA, cash on delivery to all 58 wilayas.')}`;
    return { title, description, alternates: { canonical: `/${w.slug}` }, openGraph: { title, description, url: `/${w.slug}` } };
  }
  if (!s) return {};
  const title = t('{sport} gear in Algeria', { sport: t(s.name) });
  const description = `${t(s.description)} ${t('Prices in DA, cash on delivery to all 58 wilayas.')}`;
  // one canonical address per sport, whatever filters are in the URL
  return { title, description, alternates: { canonical: `/${s.slug}` }, openGraph: { title, description, url: `/${s.slug}` } };
}

export default async function SportPage({ params, searchParams }: Props) {
  const t = await getT();
  await ensureStore();
  const { sport } = await params;
  const world = getWorld(sport);
  if (world) return <WorldPage world={world} searchParams={await searchParams} />;
  const s = getSport(sport);
  if (!s) notFound();
  const all = productsFor(s.slug);
  const hero = all.find((p) => p.featured) ?? all.find((p) => p.bestSeller) ?? all[0];
  const subs = s.subs.map((sub) => {
    const list = productsFor(s.slug, sub.slug);
    const pick = list.find((p) => p.featured) ?? list.find((p) => p.bestSeller) ?? list[0];
    return { slug: sub.slug, name: t(sub.name), count: list.length, showroom: sub.showroom, image: pick ? { slug: pick.slug, color: pick.colors[0]!.id } : undefined };
  });
  return (
    <>
      <CategoryHero
        sport={s.slug}
        title={t(s.name)}
        description={t(s.description)}
        count={all.length}
        crumbs={[{ label: t('Home'), href: '/' }, { label: t(s.name) }]}
        hero={hero ? { slug: hero.slug, color: hero.colors[0]!.id, name: hero.name } : undefined}
      />
      <div className="container-x pt-8">
        <SubNav sport={s.slug} subs={subs} />
      </div>
      <Listing base={all} searchParams={await searchParams} revealKey={s.slug} title={t('All {name}', { name: t(s.name).toLowerCase() })} />
    </>
  );
}

/**
 * A page gathering several sports or categories (src/config/worlds.ts): every product of its parts,
 * with a tile per category (linking to that category's own page).
 */
async function WorldPage({ world, searchParams }: { world: World; searchParams: Record<string, string | string[] | undefined> }) {
  const t = await getT();
  const seen = new Set<string>();
  const all: Product[] = [];
  const subs: { slug: string; name: string; count: number; href: string; image?: { slug: string; color: string } }[] = [];
  for (const part of world.parts) {
    const [sportSlug, subSlug] = part.split('/') as [SportSlug, string | undefined];
    const sp = getSport(sportSlug);
    if (!sp) continue;
    for (const sub of sp.subs) {
      if (subSlug && sub.slug !== subSlug) continue;
      const list = productsFor(sp.slug, sub.slug);
      if (!list.length) continue;
      for (const p of list) {
        if (seen.has(p.slug)) continue;
        seen.add(p.slug);
        all.push(p);
      }
      const pick = list.find((p) => p.featured) ?? list.find((p) => p.bestSeller) ?? list[0]!;
      subs.push({ slug: `${sp.slug}-${sub.slug}`, name: t(sub.name), count: list.length, href: `/${sp.slug}/${sub.slug}`, image: { slug: pick.slug, color: pick.colors[0]!.id } });
    }
  }
  const hero = all.find((p) => p.featured) ?? all.find((p) => p.bestSeller) ?? all[0];
  return (
    <>
      <CategoryHero
        sport={world.slug}
        media={world.media}
        title={t(world.name)}
        description={t(world.description)}
        count={all.length}
        crumbs={[{ label: t('Home'), href: '/' }, { label: t(world.name) }]}
        hero={hero ? { slug: hero.slug, color: hero.colors[0]!.id, name: hero.name } : undefined}
      />
      <div className="container-x pt-8">
        <SubNav sport={world.slug} subs={subs} />
      </div>
      <Listing base={all} searchParams={searchParams} revealKey={world.slug} title={t('All {name}', { name: t(world.name).toLowerCase() })} />
    </>
  );
}
