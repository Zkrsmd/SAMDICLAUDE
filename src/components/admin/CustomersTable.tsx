'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { CustomerRow } from '@/lib/admin/orders';
import { AIcon, Empty, day, money } from './ui';

type Sort = 'spent' | 'orders' | 'last' | 'name';

export function CustomersTable({ rows }: { rows: CustomerRow[] }) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('spent');
  const view = useMemo(() => {
    const t = q.toLowerCase();
    const out = rows.filter((c) => !t || `${c.name} ${c.email} ${c.phone ?? ''} ${c.city}`.toLowerCase().includes(t));
    const by: Record<Sort, (a: CustomerRow, b: CustomerRow) => number> = {
      spent: (a, b) => b.spent - a.spent,
      orders: (a, b) => b.orders - a.orders,
      last: (a, b) => b.last.localeCompare(a.last),
      name: (a, b) => a.name.localeCompare(b.name),
    };
    return out.sort(by[sort]);
  }, [rows, q, sort]);
  const total = rows.reduce((s, c) => s + c.spent, 0);
  const repeat = rows.filter((c) => c.orders > 1).length;
  return (
    <>
      <div className="mb-3 grid grid-cols-3 gap-3">
        {[
          ['Customers', String(rows.length)],
          ['Repeat customers', `${Math.round((repeat / Math.max(1, rows.length)) * 100)}%`],
          ['Average spend', money(Math.round(total / Math.max(1, rows.length)))],
        ].map(([l, v]) => (
          <div key={l} className="adm-card adm-card-pad">
            <p className="text-[12.5px] text-[#66707c]">{l}</p>
            <p className="num mt-1 text-[18px] font-bold">{v}</p>
          </div>
        ))}
      </div>
      <div className="adm-card overflow-hidden">
        <div className="adm-toolbar">
          <div className="relative min-w-[200px] flex-1">
            <AIcon name="search" size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8a939e]" />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search customers" className="adm-input !pl-8" aria-label="Search customers" />
          </div>
          <select className="adm-select !w-auto" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort customers">
            <option value="spent">Most spent</option>
            <option value="orders">Most orders</option>
            <option value="last">Last order</option>
            <option value="name">Name</option>
          </select>
        </div>
        {view.length ? (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th className="hidden md:table-cell">Location</th>
                  <th>Orders</th>
                  <th className="hidden sm:table-cell">Last order</th>
                  <th className="r">Amount spent</th>
                </tr>
              </thead>
              <tbody>
                {view.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#e6ecff] text-[12px] font-bold text-[#1a3fd6]">
                          {c.name
                            .split(' ')
                            .map((w) => w[0])
                            .join('')}
                        </span>
                        <span className="min-w-0">
                          <span className="block font-semibold">{c.name}</span>
                          <span className="block truncate text-[12px] text-[#66707c]">{c.email || c.phone}</span>
                        </span>
                      </div>
                    </td>
                    <td className="hidden whitespace-nowrap text-[#4a525c] md:table-cell">
                      {c.city}, {c.country}
                    </td>
                    <td>
                      <Link href={`/admin/orders?q=${encodeURIComponent(c.name)}`} className="hover:underline">
                        {c.orders} order{c.orders === 1 ? '' : 's'}
                      </Link>
                    </td>
                    <td className="hidden whitespace-nowrap text-[#4a525c] sm:table-cell">{day(c.last)}</td>
                    <td className="num r font-medium">{money(c.spent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No customers found" />
        )}
      </div>
    </>
  );
}
