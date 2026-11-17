import type { Metadata } from 'next';
import { DemoCheckout } from '@/components/cart/DemoCheckout';

export const metadata: Metadata = { title: 'Checkout (demonstration)', robots: { index: false } };

export default function CheckoutPage() {
  return <DemoCheckout />;
}
