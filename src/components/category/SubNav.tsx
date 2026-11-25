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

/** Sub-category tiles. Tapping one records where the product "burst" should originate. */
export function SubNav({ sport, subs, active }: { sport: string; subs: SubTile[]; active?: string }) {
  const t = useT();
  const remember = (e: React.MouseEvent) => {
    try {
      sessionStorage.setItem('yb-burst', JSON.stringify({ x: e.clientX, y: e.clientY, t: Date.now() }));
    } catch {
      /* ignore */
    }
  };
  return (
    <nav aria-label={t('Categories')} className="relative">
      <ul className="no-scrollbar -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
        <li className="shrink-0 snap-start">
          <Link
            href={`/${sport}`}
            onClick={remember}
            aria-current={!active ? 'page' : undefined}
            className="chip h-full min-h-[96px] w-[112px] flex-col items-start justify-between p-3 aria-[current=page]:border-ink aria-[current=page]:bg-ink aria-[current=page]:text-white"
          >
            <span className="eyebrow">{t('All')}</span>
            <span className="mono text-[11px] opacity-70">{subs.reduce((n, s) => n + s.count, 0)}</span>
          </Link>
        </li>
        {subs.map((s, i) => (
          <li key={s.slug} className="shrink-0 snap-start" style={{ animation: `tile-in .7s ${0.1 + i * 0.05}s var(--ease-expo) both` }}>
            <Link
              href={s.href ?? `/${sport}/${s.slug}`}
              onClick={remember}
              aria-current={active === s.slug ? 'page' : undefined}
              className="group relative flex h-[96px] w-[168px] items-end overflow-hidden rounded-[2px] border border-line bg-white p-3 transition-colors hover:border-ink aria-[current=page]:border-ink aria-[current=page]:bg-ink aria-[current=page]:text-white"
            >
              {s.image && (
                <span className="absolute -right-3 -top-2 h-[78px] w-[86px] transition-transform duration-500 group-hover:-translate-y-1 group-hover:rotate-[-6deg]">
                  <ProductImage slug={s.image.slug} colorId={s.image.color} alt="" sizes="90px" />
                </span>
              )}
              <span className="relative">
                <span className="block text-[14px] font-medium leading-tight">{s.name}</span>
                <span className="mono mt-0.5 block text-[11px] opacity-60">
                  {s.count} {s.showroom ? '· Showroom' : ''}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
