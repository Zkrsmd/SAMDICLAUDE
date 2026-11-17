import type { Metadata } from 'next';
import { CartView } from '@/components/cart/CartView';
import { RecentlyViewed } from '@/components/product/ProductRail';
import { getAllProducts, toCard } from '@/lib/catalog';

export const metadata: Metadata = { title: 'Your bag', robots: { index: false } };

export default function CartPage() {
  return (
    <>
      <CartView />
      <RecentlyViewed cards={getAllProducts().map(toCard)} title="Pick up where you left off" />
    </>
  );
}
