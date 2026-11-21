import type { Metadata } from 'next';
import { WishlistView } from '@/components/product/WishlistView';
import { getAllProducts, toCard } from '@/lib/catalog';
import { ensureStore } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Wishlist', robots: { index: false } };

export default async function WishlistPage() {
  await ensureStore();
  return <WishlistView />;
}
