import type { Metadata } from 'next';
import { CodCheckout } from '@/components/checkout/CodCheckout';
import { brand } from '@/config/brand';
import { COURIER } from '@/data/delivery/wilayas';
import { getWilayas } from '@/lib/delivery';
import { ensureStore } from '@/lib/catalog';

export const metadata: Metadata = { title: 'Checkout · cash on delivery', robots: { index: false } };
// delivery prices can change in the admin at any time
export const dynamic = 'force-dynamic';

export default async function CheckoutPage() {
  await ensureStore();
  const wilayas = getWilayas().map(({ code, name, ar, home, desk }) => ({ code, name, ar, home, desk }));
  return <CodCheckout wilayas={wilayas} courier={COURIER} confirmCall={brand.commerce.confirmCall} />;
}
