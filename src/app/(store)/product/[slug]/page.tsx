import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductExperience } from '@/components/product/ProductExperience';
import { ProductGrid, RecentlyViewed } from '@/components/product/ProductRail';
import { brandName } from '@/data/brands';
import { boughtWith, getAllProducts, getProduct, getSport, getSub, moreFromCollection, toCard } from '@/lib/catalog';
import { ensureStore } from '@/lib/catalog';
import { boughtTogether } from '@/lib/store/copurchase';
import { getT } from '@/i18n/server';
import { brand } from '@/config/brand';
import { COURIER } from '@/data/delivery/wilayas';
import { getWilayas } from '@/lib/delivery';
import { formatPrice } from '@/lib/format';
import { JsonLd } from '@/components/seo/JsonLd';
import { breadcrumbLd, productImages, productLd, productTitle } from '@/lib/seo';

// pages for products/sports added in the admin render on first visit (unknown ones still 404)
export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await ensureStore();
  const p = getProduct((await params).slug);
  if (!p) return {};
  const t = await getT();
  const name = productTitle(brandName(p.brand), p.name);
  const title = `${name} — ${t('price in Algeria')}`;
  const description = `${t(p.short)} ${formatPrice(p.price)} · ${t('Cash on delivery to all 58 wilayas.')}`;
  const images = productImages(p).slice(0, 2);
  return {
    title,
    description,
    alternates: { canonical: `/product/${p.slug}` },
    openGraph: { type: 'website', title, description, url: `/product/${p.slug}`, images },
    twitter: { card: 'summary_large_image', title, description, images },
  };
}

export default async function ProductPage({ params }: Props) {
  const t = await getT();
  await ensureStore();
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) notFound();
  const sport = getSport(product.sport)!;
  const sub = getSub(product.sport, product.sub)!;
  // what goes with it (three picks from the categories it pairs with), then more of the same kind
  // the shop's picks, nudged over time by what customers buy together (src/lib/store/copurchase.ts)
  const kit = boughtWith(product, await boughtTogether(product.slug), 3);
  const same = moreFromCollection(product, 8);
  // the catalogue's generated lines read in the visitor's language (texts written in the admin stay as written)
  const tail = ' Cash on delivery anywhere in Algeria.';
  const shown = {
    ...product,
    short: t(product.short),
    description:
      product.description.endsWith(tail) && product.description.includes(product.short)
        ? product.description.replace(product.short, t(product.short)).replace(tail, ` ${t('Cash on delivery anywhere in Algeria.')}`)
        : product.description,
  };

  return (
    <>
      <JsonLd data={productLd(product, brandName(product.brand), shown.description, `${t(sport.name)} > ${t(sub.name)}`)} />
      <JsonLd
        data={breadcrumbLd([
          { name: 'STRYKE', path: '/' },
          { name: t(sport.name), path: `/${sport.slug}` },
          { name: t(sub.name), path: `/${sport.slug}/${sub.slug}` },
          { name: productTitle(brandName(product.brand), product.name), path: `/product/${product.slug}` },
        ])}
      />
      <ProductExperience key={product.slug} product={shown} brandName={brandName(product.brand)}
        checkout={{ wilayas: getWilayas().map(({ code, name, ar, home, desk }) => ({ code, name, ar, home, desk })), courier: COURIER, confirmCall: brand.commerce.confirmCall }}
      />

      {kit.length > 0 && (
        <section aria-labelledby="kit-title" className="container-x pt-16 md:pt-24">
          <p className="eyebrow text-muted">{t('Buy it with')}</p>
          <h2 id="kit-title" className="display mt-2 text-[clamp(28px,5.6vw,64px)]">
            {t('Complete')} <span className="holo-text">{t('the look')}</span>
          </h2>
          <div className="mt-7">
            <ProductGrid items={kit.map(toCard)} cols={3} />
          </div>
        </section>
      )}

      {same.length > 0 && (
        <section aria-labelledby="same-title" className="container-x pb-6 pt-16 md:pt-24">
          <p className="eyebrow text-muted">{t(sport.name)}</p>
          <h2 id="same-title" className="display mt-2 text-[clamp(28px,5.6vw,64px)]">
            {t('More')} <span className="holo-text">{t(sub.name).toLowerCase()}</span>
          </h2>
          <div className="mt-7">
            <ProductGrid items={same.map(toCard)} />
          </div>
        </section>
      )}
      <RecentlyViewed exclude={product.slug} />
    </>
  );
}
