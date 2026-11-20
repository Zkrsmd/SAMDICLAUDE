import type { Metadata } from 'next';
import { CustomersTable } from '@/components/admin/CustomersTable';
import { PageHead, SampleNote } from '@/components/admin/ui';
import { requireAdmin } from '@/lib/admin/auth';
import { getCustomers, showingSamples } from '@/lib/admin/orders';

export const metadata: Metadata = { title: 'Customers' };

export default async function CustomersPage() {
  await requireAdmin();
  return (
    <div className="adm-page">
      <PageHead title="Customers" />
      {showingSamples() ? <SampleNote>Sample customers, made from the sample orders. Real customers replace them once the first real order comes in.</SampleNote> : null}
      <CustomersTable rows={getCustomers()} />
    </div>
  );
}
