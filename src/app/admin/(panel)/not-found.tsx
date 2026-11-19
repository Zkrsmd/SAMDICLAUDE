import Link from 'next/link';
import { Empty } from '@/components/admin/ui';

export default function AdminNotFound() {
  return (
    <div className="adm-page">
      <div className="adm-card">
        <Empty title="Not found" action={<Link href="/admin" className="adm-btn">Back to Home</Link>}>
          This product or order doesn’t exist (it may have been deleted).
        </Empty>
      </div>
    </div>
  );
}
