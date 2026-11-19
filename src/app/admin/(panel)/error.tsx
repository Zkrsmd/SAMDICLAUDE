'use client';
import { Empty } from '@/components/admin/ui';

/** Never shows internal details; the server log has them. */
export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="adm-page">
      <div className="adm-card">
        <Empty
          title="Something went wrong"
          action={
            <button type="button" className="adm-btn" onClick={() => reset()}>
              Try again
            </button>
          }
        >
          The page couldn’t load. Try again, or check the server log.
        </Empty>
      </div>
    </div>
  );
}
