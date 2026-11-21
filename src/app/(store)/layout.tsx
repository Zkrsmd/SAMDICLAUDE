import { StoreChrome } from '@/components/layout/StoreChrome';
import { ensureStore } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  await ensureStore();
  return <StoreChrome>{children}</StoreChrome>;
}
