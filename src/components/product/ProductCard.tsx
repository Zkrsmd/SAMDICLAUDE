'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef } from 'react';
import { ProductImage } from './ProductImage';
import { QuickAdd } from './QuickAdd';
import { Icon } from '@/components/ui/Icon';
import { useWishlist } from '@/stores/lists';
import { useHydrated } from '@/hooks/useHydrated';
import { formatPrice, shortName } from '@/lib/format';
import type { CardData } from '@/lib/catalog';
import { useT } from '@/i18n/client';

/**
 * Product card: the cut-out floats on a soft studio ground, and everything you need sits inside the
 * card itself: a short name, the price (and the was-price on sale) and the + that puts it in the bag.
 */
export function ProductCard({
  p,
  size = 'md',
  priority,
  className = '',
  style,
}: {
  p: CardData;
  size?: 'sm' | 'md' | 'lg';
  priority?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const t = useT();
  const hydrated = useHydrated();
  const wished = useWishlist((s) => s.slugs.includes(p.slug));
  const toggle = useWishlist((s) => s.toggle);
  const colorId = p.colors[0]!.id;
  const href = `/product/${p.slug}`;
  const router = useRouter();
  const img = useRef<HTMLSpanElement>(null);

  // open the product as one continuous shot: this exact photo morphs into the product page's photo
  // (View Transitions API) while the page builds around it. Plain navigation without support,
  // with reduced motion, or for new-tab / modified clicks.
  const open = (e: React.MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const doc = document as Document & {
      startViewTransition?: (cb: () => Promise<void>) => { finished: Promise<void>; ready: Promise<void>; updateCallbackDone: Promise<void> };
    };
    if (!doc.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    e.preventDefault();
    const el = img.current;
    // only one element may carry the name: on a product page, its own photo steps aside
    document.querySelectorAll<HTMLElement>('[data-pdp-hero]').forEach((n) => (n.style.viewTransitionName = 'none'));
    if (el) el.style.viewTransitionName = 'pdp-hero';
    document.documentElement.classList.add('vt-product');
    const t = doc.startViewTransition(
      () =>
        new Promise<void>((resolve) => {
          router.push(href);
          const t0 = performance.now();
          // the new page is ready when its photo is in the document
          const ready = () => {
            const next = document.querySelector<HTMLElement>(`[data-pdp-hero="${p.slug}"]`);
            if (next) {
              if (el) el.style.viewTransitionName = '';
              next.style.viewTransitionName = 'pdp-hero';
              resolve();
            } else if (performance.now() - t0 > 2500) resolve(); // never hold the page (browsers abort at 4 s)
            // (a timer, not requestAnimationFrame: rendering is paused while a transition waits)
            else window.setTimeout(ready, 16);
          };
          ready();
        }),
    );
    // a skipped/aborted transition is not an error: the navigation itself always happens
    t.ready.catch(() => {});
    t.updateCallbackDone.catch(() => {});
    t.finished.catch(() => {}).finally(() => {
      if (el) el.style.viewTransitionName = '';
      document.documentElement.classList.remove('vt-product');
    });
  };
  return (
    <article className={`pcard group ${className}`} style={style} data-availability={p.availability}>
      <Link href={href} className="pcard-media" aria-label={`${p.brandName} ${p.name}`} onClick={open}>
        <span className="pcard-stage">
          <span className="pcard-shadow" aria-hidden />
          <span ref={img} className="pcard-img">
            <ProductImage src={p.image} slug={p.slug} colorId={colorId} alt="" priority={priority} sizes={size === 'lg' ? '(max-width: 768px) 90vw, 40vw' : '(max-width: 768px) 50vw, 24vw'} />
          </span>
        </span>
      </Link>
      <div className="pointer-events-none absolute left-2.5 top-2.5 flex gap-1.5">
        {p.availability === 'soon' ? (
          <span className="pcard-badge pcard-badge-soon">{t('Coming soon')}</span>
        ) : p.availability === 'out' ? (
          <span className="pcard-badge">{t('Out of stock')}</span>
        ) : (
          <>
            {p.isNew && <span className="pcard-badge pcard-badge-new">{t('New')}</span>}
            {p.compareAt ? <span className="pcard-badge pcard-badge-new">{t('Sale')}</span> : null}
            {p.bestSeller && <span className="pcard-badge">{t('Best seller')}</span>}
          </>
        )}
      </div>
      <button
        type="button"
        onClick={() => toggle(p.slug)}
        aria-pressed={hydrated ? wished : false}
        aria-label={t('Save {name} to wishlist', { name: p.name })}
        className="absolute right-1.5 top-1.5 grid h-10 w-10 place-items-center rounded-full text-ink/60 transition-colors hover:text-cobalt"
      >
        <Icon name={hydrated && wished ? 'heart-fill' : 'heart'} size={19} className={hydrated && wished ? 'text-cobalt' : ''} />
      </button>
      {/* on the card itself, not in a box: a short name, the price and the + */}
      <div className="pcard-info">
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-[13px] font-semibold leading-tight tracking-[-0.01em] md:line-clamp-1 md:text-[14px]" title={p.name}>
            <Link href={href} tabIndex={-1} className="hover:text-cobalt">
              {shortName(p.name)}
            </Link>
          </h3>
          <span className="mono mt-1 flex flex-wrap items-baseline gap-x-1.5 text-[12px] font-semibold text-ink/65">
            {formatPrice(p.price)}
            {p.compareAt ? (
              <s className="text-[11px] font-normal text-ink/40" aria-label={t('Was {price}', { price: formatPrice(p.compareAt) })}>
                {formatPrice(p.compareAt)}
              </s>
            ) : null}
          </span>
        </div>
        <QuickAdd slug={p.slug} name={p.name} colorId={colorId} sizes={p.sizes} soldOut={p.soldOutSizes} availability={p.availability} />
      </div>
    </article>
  );
}
