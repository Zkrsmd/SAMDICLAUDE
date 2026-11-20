'use client';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { updateOrders } from '@/app/admin/actions';
import { AIcon, Badge, Empty, StatusBadge, dateTime, money } from './ui';
import { toast } from './client';

export interface OrderRow {
  id: string;
  number: number;
  createdAt: string;
  customer: string;
  channel: string;
  items: number;
  total: number;
  payment: string;
  fulfillment: string;
  archived: boolean;
  /** website orders: new / confirmed / shipped / delivered / returned / cancelled */
  status?: string;
  phone?: string;
  wilaya?: string;
}
const TABS = [
  { id: 'all', label: 'All' },
  { id: 'confirm', label: 'To confirm' },
  { id: 'unfulfilled', label: 'Unfulfilled' },
  { id: 'unpaid', label: 'Unpaid' },
  { id: 'archived', label: 'Archived' },
] as const;
const PAGE = 50;

const inTab = (o: OrderRow, tab: string) => {
  if (tab === 'archived') return o.archived;
  if (o.archived) return false;
  if (tab === 'confirm') return o.status === 'new';
  if (tab === 'unfulfilled') return o.fulfillment === 'unfulfilled' && o.payment !== 'refunded' && o.payment !== 'void';
  if (tab === 'unpaid') return o.payment === 'pending' || o.payment === 'cod';
  return true;
};

export function OrdersTable({ rows }: { rows: OrderRow[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [q, setQ] = useState(params.get('q') ?? '');
  const tab = params.get('tab') ?? 'all';
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1);

  const set = (patch: Record<string, string | null>) => {
    const n = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (!v) n.delete(k);
      else n.set(k, v);
    }
    if (!('page' in patch)) n.delete('page');
    router.replace(`${path}${n.size ? `?${n}` : ''}`, { scroll: false });
    setSelected(new Set());
  };

  const filtered = useMemo(() => {
    const t = (params.get('q') ?? '').toLowerCase().replace(/^#/, '');
    const digits = t.replace(/\D/g, '');
    return rows.filter(
      (o) => inTab(o, tab) && (!t || String(o.number).includes(t) || o.customer.toLowerCase().includes(t) || (digits.length >= 4 && (o.phone ?? '').includes(digits))),
    );
  }, [rows, params, tab]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const p = Math.min(page, pages);
  const view = filtered.slice((p - 1) * PAGE, p * PAGE);
  const allOn = view.length > 0 && view.every((o) => selected.has(o.id));

  const run = (patch: Parameters<typeof updateOrders>[1], done: string) =>
    start(async () => {
      const res = await updateOrders([...selected], patch);
      if (res.ok) {
        toast(done);
        setSelected(new Set());
        router.refresh();
      } else toast(res.error, 'bad');
    });

  return (
    <div className="adm-card overflow-hidden">
      <div className="adm-tabs" role="tablist" aria-label="Order status">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className="adm-tab" onClick={() => set({ tab: t.id === 'all' ? null : t.id })}>
            {t.label} <span className="num ml-1 text-[11.5px] text-[#8a939e]">{rows.filter((o) => inTab(o, t.id)).length}</span>
          </button>
        ))}
      </div>
      <div className="adm-toolbar">
        <form
          role="search"
          className="relative min-w-[200px] flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            set({ q: q.trim() || null });
          }}
        >
          <AIcon name="search" size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8a939e]" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onBlur={() => q.trim() !== (params.get('q') ?? '') && set({ q: q.trim() || null })}
            placeholder="Search by order number, customer or phone"
            className="adm-input !pl-8"
            aria-label="Search orders"
          />
        </form>
      </div>
      {selected.size > 0 && (
        <div className="adm-bulkbar" role="region" aria-label="Bulk actions">
          <span className="mr-2 font-semibold">{selected.size} selected</span>
          {/* website orders move by their own statuses, on the order page */}
          {!rows.some((o) => o.status) && (
            <>
              <button type="button" className="adm-btn adm-btn-sm" disabled={pending} onClick={() => run({ fulfillment: 'fulfilled' }, 'Marked as fulfilled')}>
                <AIcon name="truck" size={14} /> Mark as fulfilled
              </button>
              <button type="button" className="adm-btn adm-btn-sm" disabled={pending} onClick={() => run({ fulfillment: 'unfulfilled' }, 'Marked as unfulfilled')}>
                Mark as unfulfilled
              </button>
            </>
          )}
          {tab === 'archived' ? (
            <button type="button" className="adm-btn adm-btn-sm" disabled={pending} onClick={() => run({ archived: false }, 'Unarchived')}>
              Unarchive
            </button>
          ) : (
            <button type="button" className="adm-btn adm-btn-sm" disabled={pending} onClick={() => run({ archived: true }, 'Archived')}>
              Archive
            </button>
          )}
          <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm ml-auto" onClick={() => setSelected(new Set())}>
            Deselect
          </button>
        </div>
      )}
      {view.length ? (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th className="w-10">
                  <input
                    type="checkbox"
                    className="adm-check"
                    checked={allOn}
                    aria-label="Select all orders on this page"
                    onChange={() => setSelected((s) => (allOn ? new Set([...s].filter((x) => !view.some((o) => o.id === x))) : new Set([...s, ...view.map((o) => o.id)])))}
                  />
                </th>
                <th>Order</th>
                <th>Date</th>
                <th>Customer</th>
                <th className="hidden lg:table-cell">Wilaya</th>
                <th className="r">Total</th>
                <th>Payment</th>
                <th>Status</th>
                <th className="hidden md:table-cell">Items</th>
              </tr>
            </thead>
            <tbody>
              {view.map((o) => (
                <tr key={o.id} data-selected={selected.has(o.id) ? '' : undefined}>
                  <td>
                    <input
                      type="checkbox"
                      className="adm-check"
                      checked={selected.has(o.id)}
                      aria-label={`Select order ${o.number}`}
                      onChange={() =>
                        setSelected((s) => {
                          const n = new Set(s);
                          if (n.has(o.id)) n.delete(o.id);
                          else n.add(o.id);
                          return n;
                        })
                      }
                    />
                  </td>
                  <td>
                    <Link href={`/admin/orders/${o.id}`} className="font-semibold hover:underline">
                      #{o.number}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap text-[#4a525c]">{dateTime(o.createdAt)}</td>
                  <td className="whitespace-nowrap">{o.customer}</td>
                  <td className="hidden whitespace-nowrap text-[#4a525c] lg:table-cell">{o.wilaya ?? o.channel}</td>
                  <td className="num r whitespace-nowrap font-medium">{money(o.total)}</td>
                  <td>
                    <StatusBadge status={o.payment} />
                  </td>
                  <td>{o.archived ? <Badge>Archived</Badge> : <StatusBadge status={o.status ?? o.fulfillment} />}</td>
                  <td className="hidden text-[#4a525c] md:table-cell">
                    {o.items} item{o.items === 1 ? '' : 's'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title="No orders here">Try another tab or search.</Empty>
      )}
      <div className="adm-sep flex items-center justify-between px-4 py-3 text-[12.5px] text-[#66707c]">
        <span>{filtered.length} orders</span>
        <span className="flex items-center gap-1">
          <button type="button" className="adm-icon-btn" disabled={p <= 1} onClick={() => set({ page: String(p - 1) })} aria-label="Previous page">
            <AIcon name="chevron-left" size={16} />
          </button>
          <span className="num">
            {p} / {pages}
          </span>
          <button type="button" className="adm-icon-btn" disabled={p >= pages} onClick={() => set({ page: String(p + 1) })} aria-label="Next page">
            <AIcon name="chevron-right" size={16} />
          </button>
        </span>
      </div>
    </div>
  );
}
