'use client';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { addOrderNote, setOrderStatus, updateOrders } from '@/app/admin/actions';
import { AIcon } from './ui';
import { toast } from './client';

export function OrderActions({ id, fulfillment, archived, refunded, writable }: { id: string; fulfillment: string; archived: boolean; refunded: boolean; writable: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (patch: Parameters<typeof updateOrders>[1], done: string) =>
    start(async () => {
      const res = await updateOrders([id], patch);
      if (res.ok) {
        toast(done);
        router.refresh();
      } else toast(res.error, 'bad');
    });
  return (
    <div className="adm-sep mt-1 flex flex-wrap justify-end gap-2 pt-3">
      <button type="button" className="adm-btn" disabled={pending || !writable} onClick={() => run({ archived: !archived }, archived ? 'Unarchived' : 'Archived')}>
        {archived ? 'Unarchive' : 'Archive'}
      </button>
      {fulfillment === 'unfulfilled' ? (
        <button type="button" className="adm-btn adm-btn-primary" disabled={pending || !writable || refunded} onClick={() => run({ fulfillment: 'fulfilled' }, 'Marked as fulfilled')}>
          <AIcon name="truck" size={15} /> Mark as fulfilled
        </button>
      ) : (
        <button type="button" className="adm-btn" disabled={pending || !writable} onClick={() => run({ fulfillment: 'unfulfilled' }, 'Marked as unfulfilled')}>
          Mark as unfulfilled
        </button>
      )}
    </div>
  );
}

export function OrderNotes({ id, writable }: { id: string; writable: boolean }) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [pending, start] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        start(async () => {
          const res = await addOrderNote(id, text);
          if (res.ok) {
            setText('');
            toast('Note added');
            router.refresh();
          } else toast(res.error, 'bad');
        });
      }}
      className="flex gap-2"
    >
      <label htmlFor="order-note" className="sr-only">
        Leave a note
      </label>
      <input id="order-note" className="adm-input" value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} placeholder="Leave a note…" />
      <button type="submit" className="adm-btn" disabled={pending || !text.trim() || !writable}>
        {pending ? 'Posting…' : 'Post'}
      </button>
    </form>
  );
}

const NEXT: Record<string, { to: string; label: string; primary?: boolean; done: string }[]> = {
  new: [
    { to: 'confirmed', label: 'Confirm order', primary: true, done: 'Order confirmed' },
    { to: 'cancelled', label: 'Cancel', done: 'Order cancelled, stock put back' },
  ],
  confirmed: [
    { to: 'shipped', label: 'Mark as shipped', primary: true, done: 'Marked as shipped' },
    { to: 'cancelled', label: 'Cancel', done: 'Order cancelled, stock put back' },
  ],
  shipped: [
    { to: 'delivered', label: 'Delivered · cash collected', primary: true, done: 'Marked as delivered' },
    { to: 'returned', label: 'Returned', done: 'Marked as returned, stock put back' },
  ],
  delivered: [{ to: 'returned', label: 'Returned', done: 'Marked as returned, stock put back' }],
  returned: [{ to: 'confirmed', label: 'Reopen', done: 'Order reopened' }],
  cancelled: [{ to: 'confirmed', label: 'Reopen', done: 'Order reopened' }],
};

/** Website (cash on delivery) orders: confirm after the call/SMS, ship, deliver — or cancel / return. */
export function CodActions({ id, status, archived, writable }: { id: string; status: string; archived: boolean; writable: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const go = (fn: () => ReturnType<typeof setOrderStatus>, done: string) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        toast(done);
        router.refresh();
      } else toast(res.error, 'bad');
    });
  return (
    <div className="adm-sep mt-1 flex flex-wrap justify-end gap-2 pt-3">
      <button type="button" className="adm-btn" disabled={pending || !writable} onClick={() => go(() => updateOrders([id], { archived: !archived }), archived ? 'Unarchived' : 'Archived')}>
        {archived ? 'Unarchive' : 'Archive'}
      </button>
      {(NEXT[status] ?? []).map((n) => (
        <button
          key={n.to}
          type="button"
          className={`adm-btn ${n.primary ? 'adm-btn-primary' : ''}`}
          disabled={pending || !writable}
          onClick={() => go(() => setOrderStatus(id, n.to as Parameters<typeof setOrderStatus>[1]), n.done)}
        >
          {n.primary && n.to === 'shipped' ? <AIcon name="truck" size={15} /> : null}
          {n.label}
        </button>
      ))}
    </div>
  );
}
