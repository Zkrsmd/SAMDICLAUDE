'use client';
import Link from 'next/link';
import { ProductGrid, RecentlyViewed } from './ProductRail';
import { useWishlist } from '@/stores/lists';
import { useHydrated } from '@/hooks/useHydrated';
import { useCards } from '@/hooks/useCards';
import type { CardData } from '@/lib/catalog';
import { useT } from '@/i18n/client';

export function WishlistView() {
  const t = useT();
  const hydrated = useHydrated();
  const slugs = useWishlist((s) => s.slugs);
  const cards = useCards(hydrated ? slugs : []);
  const items: CardData[] = cards ?? [];
  return (
    <>
      <div className="container-x pb-10" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 88px)' }}>
        <h1 className="display text-[clamp(40px,9vw,96px)]">{t('Wishlist')}</h1>
        <p className="mt-2 text-muted">{t('Saved on this device.')}</p>
        <div className="mt-8">
          {!hydrated || !cards ? (
            <p className="text-muted">{t('Loading…')}</p>
          ) : items.length ? (
            <ProductGrid items={items} />
          ) : (
            <div className="py-16 text-center">
              <p className="display text-[44px] text-ink/20">{t('Nothing saved yet')}</p>
              <Link href="/" className="btn btn-ink mt-6 h-12">
                {t('Discover the collection')}
              </Link>
            </div>
          )}
        </div>
      </div>
      <RecentlyViewed />
    </>
  );
}
