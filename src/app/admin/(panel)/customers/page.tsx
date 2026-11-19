import type { Metadata } from 'next';
import { CustomersTable } from '@/components/admin/CustomersTable';
import { PageHead, SampleNote } from '@/components/admin/ui';
import { requireAdmin } from '@/lib/admin/auth';
import { getCustomers } from '@/lib/admin/orders';

export const metadata: Metadata = { title: 'Customers' };

export default async function CustomersPage() {
  await requireAdmin();
  return (
    <div className="adm-page">
      <PageHead title="Customers" />
      <SampleNote>Sample customers, made from the sample orders. Real customers appear once the checkout takes orders.</SampleNote>
      <CustomersTable rows={getCustomers()} />
    </div>
  );
}
