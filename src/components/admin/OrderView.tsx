'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { addOrderNote, setOrderStatus, updateOrderCustomer, updateOrders } from '@/app/admin/actions';
import { COD_STATUS, OFF_SHELF, PIPELINE, STATUS_INFO, type CodStatus } from '@/lib/order-status';
import { AIcon, StatusBadge } from './ui';
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

/** the next step on the main road, with the button's words */
const NEXT_STEP: Partial<Record<CodStatus, { to: CodStatus; label: string; done: string }>> = {
  new: { to: 'confirmed', label: 'Confirmed on the phone', done: 'Order confirmed' },
  no_answer: { to: 'confirmed', label: 'Confirmed on the phone', done: 'Order confirmed' },
  confirmed: { to: 'preparing', label: 'Start preparing', done: 'Being prepared' },
  preparing: { to: 'shipped', label: 'Hand to the courier', done: 'Marked as shipped' },
  shipped: { to: 'delivered', label: 'Delivered · cash collected', done: 'Marked as delivered' },
};

/**
 * Website (cash on delivery) orders: where the order is on its road (to confirm → confirmed →
 * preparing → shipped → delivered), the next step as one button, and any status from the list
 * (no answer, cancelled, returned…). Cancelled and returned put the stock back; reopening takes it again.
 */
export function CodActions({ id, status, archived, writable }: { id: string; status: CodStatus; archived: boolean; writable: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  // the list shows the order's status; while a change is being saved, the one just picked
  const [picked, setPick] = useState<{ from: CodStatus; to: CodStatus } | null>(null);
  const pick = picked && picked.from === status ? picked.to : status;
  const go = (to: CodStatus, done: string) =>
    start(async () => {
      const res = await setOrderStatus(id, to);
      if (res.ok) {
        toast(done);
        router.refresh();
      } else {
        toast(res.error, 'bad');
        setPick(null);
      }
    });
  const next = NEXT_STEP[status];
  const at = PIPELINE.indexOf(status === 'no_answer' ? 'new' : status);
  const off = OFF_SHELF.has(status);
  return (
    <div className="adm-sep mt-1 pt-3">
      <ol className="ord-road" aria-label="Order progress">
        {PIPELINE.map((s, i) => (
          <li key={s} data-done={!off && i < at ? '' : undefined} data-now={!off && i === at ? '' : undefined}>
            <span className="ord-dot" aria-hidden />
            <span className="ord-step">{STATUS_INFO[s].label}</span>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-[12.5px] text-[#4a525c]" data-testid="status-hint">
        <StatusBadge status={status} /> <span className="ms-1">{STATUS_INFO[status].hint}</span>
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        <label className="me-auto flex items-center gap-2 text-[12.5px] text-[#4a525c]">
          Status
          <select
            className="adm-select !w-auto"
            value={pick}
            disabled={pending || !writable}
            aria-label="Change the order status"
            onChange={(e) => {
              const to = e.target.value as CodStatus;
              setPick({ from: status, to });
              if (to !== status) go(to, `Status: ${STATUS_INFO[to].label}`);
            }}
          >
            {COD_STATUS.map((s) => (
              <option key={s} value={s}>
                {STATUS_INFO[s].label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="adm-btn" disabled={pending || !writable} onClick={() => start(async () => {
          const res = await updateOrders([id], { archived: !archived });
          if (res.ok) {
            toast(archived ? 'Unarchived' : 'Archived');
            router.refresh();
          } else toast(res.error, 'bad');
        })}>
          {archived ? 'Unarchive' : 'Archive'}
        </button>
        {status === 'new' && (
          <button type="button" className="adm-btn" disabled={pending || !writable} onClick={() => go('no_answer', 'Marked: no answer')}>
            No answer
          </button>
        )}
        {(status === 'new' || status === 'no_answer' || status === 'confirmed' || status === 'preparing') && (
          <button type="button" className="adm-btn" disabled={pending || !writable} onClick={() => go('cancelled', 'Order cancelled, stock put back')}>
            Cancel order
          </button>
        )}
        {(status === 'shipped' || status === 'delivered') && (
          <button type="button" className="adm-btn" disabled={pending || !writable} onClick={() => go('returned', 'Marked as returned, stock put back')}>
            Returned
          </button>
        )}
        {off && (
          <button type="button" className="adm-btn adm-btn-primary" disabled={pending || !writable} onClick={() => go('confirmed', 'Order reopened')}>
            Reopen
          </button>
        )}
        {next && (
          <button type="button" className="adm-btn adm-btn-primary" disabled={pending || !writable} onClick={() => go(next.to, next.done)}>
            {next.to === 'shipped' ? <AIcon name="truck" size={15} /> : null}
            {next.label}
          </button>
        )}
      </div>
    </div>
  );
}

export interface EditableCustomer {
  name: string;
  phone: string;
  wilaya: number;
  commune: string;
  method: 'home' | 'desk';
  note: string;
}

/** Correct the customer's details on a website order; the delivery price follows the wilaya. */
export function EditCustomer({ id, initial, wilayas, writable }: { id: string; initial: EditableCustomer; wilayas: { code: number; name: string; home: number | null; desk: number | null }[]; writable: boolean }) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  const w = wilayas.find((x) => x.code === v.wilaya);
  const field = (k: string) => (errors[k] ? <span className="mt-1 block text-[12px] text-[#c4321f]">{errors[k]}</span> : null);
  return (
    <>
      <button type="button" className="adm-link text-[12.5px]" disabled={!writable} onClick={() => {
        setV(initial);
        setErrors({});
        setOpen(true);
      }}>
        Edit
      </button>
      <dialog ref={ref} className="adm-dialog" onClose={() => setOpen(false)} aria-labelledby="edit-cust-title">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const words = v.name.trim().split(/\s+/).filter(Boolean);
            start(async () => {
              const res = await updateOrderCustomer(id, {
                firstName: words[0] ?? '',
                lastName: words.slice(1).join(' '),
                phone: v.phone,
                wilaya: v.wilaya,
                commune: v.commune,
                method: v.method,
                note: v.note,
              });
              if (res.ok) {
                toast('Customer details saved');
                setOpen(false);
                router.refresh();
              } else {
                const f = res.fields ?? {};
                setErrors({ ...f, name: f.firstName ?? f.lastName ?? '' });
                toast(res.error, 'bad');
              }
            });
          }}
        >
          <div className="grid gap-3 p-5">
            <h2 id="edit-cust-title" className="text-[16px] font-bold">
              Edit customer details
            </h2>
            <label className="grid gap-1">
              <span className="text-[12.5px] font-semibold text-[#4a525c]">Full name</span>
              <input className="adm-input" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
              {field('name')}
            </label>
            <label className="grid gap-1">
              <span className="text-[12.5px] font-semibold text-[#4a525c]">Phone</span>
              <input className="adm-input num" inputMode="tel" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} />
              {field('phone')}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1">
                <span className="text-[12.5px] font-semibold text-[#4a525c]">Wilaya</span>
                <select className="adm-select" value={v.wilaya} onChange={(e) => setV({ ...v, wilaya: Number(e.target.value) })}>
                  {wilayas.map((x) => (
                    <option key={x.code} value={x.code}>
                      {String(x.code).padStart(2, '0')} · {x.name}
                    </option>
                  ))}
                </select>
                {field('wilaya')}
              </label>
              <label className="grid gap-1">
                <span className="text-[12.5px] font-semibold text-[#4a525c]">Commune</span>
                <input className="adm-input" value={v.commune} onChange={(e) => setV({ ...v, commune: e.target.value })} />
                {field('commune')}
              </label>
            </div>
            <fieldset className="grid grid-cols-2 gap-2">
              <legend className="mb-1 text-[12.5px] font-semibold text-[#4a525c]">Delivery</legend>
              {(['home', 'desk'] as const).map((m) => (
                <label key={m} className="flex items-center gap-2 rounded-[9px] border border-[#e3e6ea] px-3 py-2">
                  <input type="radio" name="edit-method" checked={v.method === m} disabled={w ? w[m] === null : false} onChange={() => setV({ ...v, method: m })} />
                  <span>
                    {m === 'home' ? 'Home' : 'Stop desk'}{' '}
                    <span className="num text-[12px] text-[#66707c]">{w && w[m] !== null ? `${w[m]} DA` : w ? 'not offered' : ''}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            {field('method')}
            <label className="grid gap-1">
              <span className="text-[12.5px] font-semibold text-[#4a525c]">Customer note</span>
              <textarea className="adm-input min-h-[64px]" maxLength={300} value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} />
            </label>
            <p className="text-[12px] text-[#66707c]">Changing the wilaya or the delivery kind updates the delivery price and the total.</p>
          </div>
          <div className="adm-sep flex justify-end gap-2 bg-[#f7f8fa] px-5 py-3">
            <button type="button" className="adm-btn" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="adm-btn adm-btn-primary" disabled={pending}>
              {pending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
