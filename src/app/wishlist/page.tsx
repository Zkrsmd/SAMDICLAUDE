import type { Metadata } from 'next';
import { WishlistView } from '@/components/product/WishlistView';
import { getAllProducts, toCard } from '@/lib/catalog';

export const metadata: Metadata = { title: 'Wishlist', robots: { index: false } };

export default function WishlistPage() {
  return <WishlistView cards={getAllProducts().map(toCard)} />;
}
