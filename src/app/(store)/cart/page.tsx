import type { Metadata } from 'next';
import { CartView } from '@/components/cart/CartView';
import { RecentlyViewed } from '@/components/product/ProductRail';
import { getAllProducts, toCard } from '@/lib/catalog';
import { ensureStore } from '@/lib/catalog';
import { getT } from '@/i18n/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Your bag', robots: { index: false } };

export default async function CartPage() {
  const t = await getT();
  await ensureStore();
  return (
    <>
      <CartView />
      <RecentlyViewed title={t('Pick up where you left off')} />
    </>
  );
}
