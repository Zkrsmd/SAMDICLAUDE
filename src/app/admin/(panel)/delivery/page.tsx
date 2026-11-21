import type { Metadata } from 'next';
import { DeliveryTable } from '@/components/admin/DeliveryTable';
import { PageHead } from '@/components/admin/ui';
import { COURIER, WILAYAS } from '@/data/delivery/wilayas';
import { requireAdmin } from '@/lib/admin/auth';
import { getWilayas } from '@/lib/delivery';
import { storeWritable } from '@/lib/store/overrides';
import { loadAdminData } from '@/lib/admin/orders';

export const metadata: Metadata = { title: 'Delivery' };

export default async function DeliveryPage() {
  await loadAdminData();
  await requireAdmin();
  const rows = getWilayas().map((w) => {
    const s = WILAYAS.find((x) => x.code === w.code)!;
    return { code: w.code, name: w.name, ar: w.ar, home: w.home, desk: w.desk, start: { home: s.home, desk: s.desk }, estimate: s.estimate };
  });
  return (
    <div className="adm-page">
      <PageHead title="Delivery" />
      <p className="-mt-3 mb-4 text-[#66707c]">Cash on delivery with {COURIER}. The checkout shows these prices and adds them to the order.</p>
      <DeliveryTable rows={rows} writable={storeWritable()} courier={COURIER} />
    </div>
  );
}
