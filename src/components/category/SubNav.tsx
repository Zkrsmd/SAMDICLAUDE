'use client';
import Link from 'next/link';
import { ProductImage } from '@/components/product/ProductImage';
import { useT } from '@/i18n/client';

export interface SubTile {
  slug: string;
  name: string;
  count: number;
  showroom?: string;
  image?: { slug: string; color: string };
  /** where the tile goes (default: /<sport>/<slug>) */
  href?: string;
}

/**
 * Sub-category circles — the same round, cut-out tiles as the homepage's "Choose your sport"
 * (`.sport-tile`, globals.css). The first one, "All", holds a small collage of the categories.
 * Tapping one records where the product "burst" should originate.
 */
export function SubNav({ sport, subs, active }: { sport: string; subs: SubTile[]; active?: string }) {
  const t = useT();
  const remember = (e: React.MouseEvent) => {
    try {
      sessionStorage.setItem('yb-burst', JSON.stringify({ x: e.clientX, y: e.clientY, t: Date.now() }));
    } catch {
      /* ignore */
    }
  };
  const total = subs.reduce((n, s) => n + s.count, 0);
  const collage = subs.filter((s) => s.image).slice(0, 3);
  return (
    <nav aria-label={t('Categories')} className="relative">
      <ul className="sport-tiles cat-tiles">
        <li style={{ ['--i' as string]: 0 }}>
          <Link href={`/${sport}`} onClick={remember} aria-current={!active ? 'page' : undefined} className="sport-tile">
            <span className="sport-tile-orb cat-all-orb" aria-hidden>
              {collage.map((s, i) => (
                <span key={s.slug} className="cat-all-obj" data-n={i}>
                  <ProductImage slug={s.image!.slug} colorId={s.image!.color} alt="" sizes="60px" />
                </span>
              ))}
            </span>
            <span className="sport-tile-name">{t('All')}</span>
            <span className="sport-tile-count mono">{t('{n} products', { n: total })}</span>
          </Link>
        </li>
        {subs.map((s, i) => (
          <li key={s.slug} style={{ ['--i' as string]: i + 1 }}>
            <Link href={s.href ?? `/${sport}/${s.slug}`} onClick={remember} aria-current={active === s.slug ? 'page' : undefined} className="sport-tile">
              <span className="sport-tile-orb" aria-hidden>
                {s.image && (
                  <span className="sport-tile-obj">
                    <ProductImage slug={s.image.slug} colorId={s.image.color} alt="" sizes="120px" />
                  </span>
                )}
              </span>
              <span className="sport-tile-name">{s.name}</span>
              <span className="sport-tile-count mono">
                {t('{n} products', { n: s.count })}
                {s.showroom ? ' · Showroom' : ''}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
