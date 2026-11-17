'use client';
import Link from 'next/link';
import { ProductGrid, RecentlyViewed } from './ProductRail';
import { useWishlist } from '@/stores/lists';
import { useHydrated } from '@/hooks/useHydrated';
import type { CardData } from '@/lib/catalog';

export function WishlistView({ cards }: { cards: CardData[] }) {
  const hydrated = useHydrated();
  const slugs = useWishlist((s) => s.slugs);
  const items = slugs.map((s) => cards.find((c) => c.slug === s)).filter((c): c is CardData => !!c);
  return (
    <>
      <div className="container-x pb-10" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 88px)' }}>
        <h1 className="display text-[clamp(52px,15vw,150px)]">Wishlist</h1>
        <p className="mt-2 text-muted">Saved on this device.</p>
        <div className="mt-8">
          {!hydrated ? (
            <p className="text-muted">Loading…</p>
          ) : items.length ? (
            <ProductGrid items={items} />
          ) : (
            <div className="py-16 text-center">
              <p className="display text-[44px] text-ink/20">Nothing saved yet</p>
              <Link href="/" className="btn btn-ink mt-6 h-12">
                Discover the collection
              </Link>
            </div>
          )}
        </div>
      </div>
      <RecentlyViewed cards={cards} />
    </>
  );
}
