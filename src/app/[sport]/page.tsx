import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CategoryHero } from '@/components/category/CategoryHero';
import { SubNav } from '@/components/category/SubNav';
import { Listing } from '@/components/category/Listing';
import { getSport, getSports, productsFor } from '@/lib/catalog';

export const dynamicParams = false;
export function generateStaticParams() {
  return getSports().map((s) => ({ sport: s.slug }));
}

type Props = { params: Promise<{ sport: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const s = getSport((await params).sport);
  return s ? { title: s.name, description: s.description } : {};
}

export default async function SportPage({ params, searchParams }: Props) {
  const { sport } = await params;
  const s = getSport(sport);
  if (!s) notFound();
  const all = productsFor(s.slug);
  const hero = all.find((p) => p.featured) ?? all.find((p) => p.bestSeller) ?? all[0];
  const subs = s.subs.map((sub) => {
    const list = productsFor(s.slug, sub.slug);
    const pick = list.find((p) => p.featured) ?? list.find((p) => p.bestSeller) ?? list[0];
    return { slug: sub.slug, name: sub.name, count: list.length, showroom: sub.showroom, image: pick ? { slug: pick.slug, color: pick.colors[0]!.id } : undefined };
  });
  return (
    <>
      <CategoryHero
        sport={s.slug}
        title={s.name}
        description={s.description}
        count={all.length}
        crumbs={[{ label: 'Home', href: '/' }, { label: s.name }]}
        hero={hero ? { slug: hero.slug, color: hero.colors[0]!.id, name: hero.name } : undefined}
      />
      <div className="container-x pt-8">
        <SubNav sport={s.slug} subs={subs} />
      </div>
      <Listing base={all} searchParams={await searchParams} revealKey={s.slug} title={`All ${s.name.toLowerCase()}`} />
    </>
  );
}
