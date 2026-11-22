'use client';
import Link from 'next/link';
import { useEffect } from 'react';

/** The bar above the receipt (hidden on paper): print, and A4 or 80 mm ticket. Opens the print dialog once on arrival. */
export function PrintBar({ id, ticket }: { id: string; ticket: boolean }) {
  useEffect(() => {
    const t = window.setTimeout(() => window.print(), 600);
    return () => window.clearTimeout(t);
  }, [ticket]);
  return (
    <div className="rc-bar">
      <Link href={`/admin/orders/${id}`} className="rc-btn">
        ← Order
      </Link>
      <span className="rc-seg" role="group" aria-label="Paper">
        <Link href={`/admin/print/${id}`} aria-current={!ticket ? 'page' : undefined}>
          A4 page
        </Link>
        <Link href={`/admin/print/${id}?f=ticket`} aria-current={ticket ? 'page' : undefined}>
          Ticket 80 mm
        </Link>
      </span>
      <button type="button" className="rc-btn rc-btn-main" onClick={() => window.print()}>
        Print
      </button>
    </div>
  );
}
