'use client';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { bulkProducts } from '@/app/admin/actions';
import type { AdminProduct, BulkAction } from '@/lib/validation/admin';
import { AIcon, Badge, Empty, StatusBadge, Thumb, money } from './ui';
import { ConfirmDialog, toast } from './client';

export type ProductRow = Pick<
  AdminProduct,
  'slug' | 'name' | 'brand' | 'brandName' | 'sport' | 'sportName' | 'sub' | 'subName' | 'price' | 'compareAt' | 'status' | 'sizes' | 'stock' | 'image' | 'bestSeller' | 'isNew' | 'comingSoon' | 'sku' | 'createdAt' | 'created'
>;

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'draft', label: 'Draft' },
  { id: 'archived', label: 'Archived' },
] as const;
type SortKey = 'title' | 'price' | 'stock' | 'vendor' | 'created';
const PAGE = 50;

const units = (p: ProductRow) => p.sizes.reduce((s, x) => s + (p.stock[x] ?? 0), 0);

/**
 * The product index (Shopify-style): status tabs, search, filters (sport, category, vendor, stock),
 * sortable columns, select rows for bulk actions, CSV export and paging. Filters live in the
 * address so a view can be bookmarked or shared.
 */
export function ProductsTable({ rows, sports, vendors }: { rows: ProductRow[]; sports: { slug: string; name: string; subs: { slug: string; name: string }[] }[]; vendors: { id: string; name: string }[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [q, setQ] = useState(params.get('q') ?? '');

  const tab = (params.get('tab') ?? 'all') as (typeof TABS)[number]['id'];
  const sport = params.get('sport') ?? '';
  const sub = params.get('sub') ?? '';
  const vendor = params.get('vendor') ?? '';
  const stock = params.get('stock') ?? '';
  const sort = (params.get('sort') ?? 'created') as SortKey;
  const dir = params.get('dir') === 'asc' ? 'asc' : 'desc';
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1);

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') next.delete(k);
      else next.set(k, v);
    }
    if (!('page' in patch)) next.delete('page');
    router.replace(`${path}${next.size ? `?${next}` : ''}`, { scroll: false });
    setSelected(new Set());
  };

  const filtered = useMemo(() => {
    const terms = (params.get('q') ?? '').toLowerCase().split(/\s+/).filter(Boolean);
    const out = rows.filter((p) => {
      if (tab !== 'all' && p.status !== tab) return false;
      if (sport && p.sport !== sport) return false;
      if (sub && p.sub !== sub) return false;
      if (vendor && p.brand !== vendor) return false;
      const u = units(p);
      if (stock === 'out' && u > 0) return false;
      if (stock === 'low' && !p.sizes.some((s) => (p.stock[s] ?? 0) <= 3)) return false;
      if (stock === 'in' && u === 0) return false;
      const hay = `${p.name} ${p.brandName} ${p.sku} ${p.slug} ${p.subName}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
    const k = dir === 'asc' ? 1 : -1;
    const by: Record<SortKey, (a: ProductRow, b: ProductRow) => number> = {
      title: (a, b) => a.name.localeCompare(b.name),
      price: (a, b) => a.price - b.price,
      stock: (a, b) => units(a) - units(b),
      vendor: (a, b) => a.brandName.localeCompare(b.brandName),
      created: (a, b) => a.createdAt.localeCompare(b.createdAt) || rows.indexOf(a) - rows.indexOf(b),
    };
    return out.sort((a, b) => by[sort](a, b) * k);
  }, [rows, params, tab, sport, sub, vendor, stock, sort, dir]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const view = filtered.slice((Math.min(page, pages) - 1) * PAGE, Math.min(page, pages) * PAGE);
  const allOnPage = view.length > 0 && view.every((p) => selected.has(p.slug));
  const counts = Object.fromEntries(TABS.map((t) => [t.id, t.id === 'all' ? rows.length : rows.filter((p) => p.status === t.id).length]));
  const subs = sports.find((s) => s.slug === sport)?.subs ?? [];

  const toggleAll = () => setSelected((s) => (allOnPage ? new Set([...s].filter((x) => !view.some((p) => p.slug === x))) : new Set([...s, ...view.map((p) => p.slug)])));
  const toggle = (slug: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(slug)) n.delete(slug);
      else n.add(slug);
      return n;
    });

  const run = (action: BulkAction, done: string) =>
    start(async () => {
      const res = await bulkProducts([...selected], action);
      if (res.ok) {
        toast(done);
        setSelected(new Set());
        setConfirmDelete(false);
        router.refresh();
      } else toast(res.error, 'bad');
    });

  const sortBtn = (key: SortKey, label: string, right = false) => (
    <button
      type="button"
      className={`adm-sort ${right ? 'ml-auto' : ''}`}
      onClick={() => set({ sort: key, dir: sort === key && dir === 'desc' ? 'asc' : 'desc' })}
      aria-label={`Sort by ${label}`}
    >
      {label}
      <AIcon name={sort === key ? 'chevron-down' : 'sort'} size={13} className={sort === key && dir === 'asc' ? 'rotate-180' : sort === key ? '' : 'opacity-40'} />
    </button>
  );

  const exportCsv = () => {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const head = ['Handle', 'Title', 'Vendor', 'Sport', 'Category', 'Status', 'Price', 'Compare-at price', 'SKU', 'Sizes', 'Inventory'];
    const lines = filtered.map((p) =>
      [p.slug, p.name, p.brandName, p.sportName, p.subName, p.status, (p.price / 100).toFixed(2), p.compareAt ? (p.compareAt / 100).toFixed(2) : '', p.sku, p.sizes.join(' | '), units(p)].map(esc).join(','),
    );
    const blob = new Blob([[head.map(esc).join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `smadi-products-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const filtersOn = !!(sport || vendor || stock || params.get('q'));

  return (
    <>
      <div className="mb-3 flex justify-end">
        <button type="button" className="adm-btn adm-btn-sm" onClick={exportCsv}>
          <AIcon name="download" size={15} /> Export CSV
        </button>
      </div>
      <div className="adm-card overflow-hidden">
        <div className="adm-tabs" role="tablist" aria-label="Product status">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className="adm-tab" onClick={() => set({ tab: t.id === 'all' ? null : t.id })}>
              {t.label} <span className="num ml-1 text-[11.5px] text-[#8a939e]">{counts[t.id]}</span>
            </button>
          ))}
        </div>
        <div className="adm-toolbar">
          <form
            className="relative min-w-[200px] flex-1"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              set({ q: q.trim() || null });
            }}
          >
            <AIcon name="search" size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8a939e]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onBlur={() => q.trim() !== (params.get('q') ?? '') && set({ q: q.trim() || null })}
              placeholder="Search by title, vendor, SKU"
              className="adm-input !pl-8"
              aria-label="Search products"
              type="search"
            />
          </form>
          <select className="adm-select !w-auto" value={sport} onChange={(e) => set({ sport: e.target.value || null, sub: null })} aria-label="Filter by sport">
            <option value="">All sports</option>
            {sports.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.name}
              </option>
            ))}
          </select>
          {subs.length > 0 && (
            <select className="adm-select !w-auto" value={sub} onChange={(e) => set({ sub: e.target.value || null })} aria-label="Filter by category">
              <option value="">All categories</option>
              {subs.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
          <select className="adm-select !w-auto" value={vendor} onChange={(e) => set({ vendor: e.target.value || null })} aria-label="Filter by vendor">
            <option value="">All vendors</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
          <select className="adm-select !w-auto" value={stock} onChange={(e) => set({ stock: e.target.value || null })} aria-label="Filter by stock">
            <option value="">Any stock</option>
            <option value="in">In stock</option>
            <option value="low">Low stock (≤ 3)</option>
            <option value="out">Sold out</option>
          </select>
          {filtersOn && (
            <button
              type="button"
              className="adm-btn adm-btn-ghost adm-btn-sm"
              onClick={() => {
                setQ('');
                set({ q: null, sport: null, sub: null, vendor: null, stock: null });
              }}
            >
              Clear
            </button>
          )}
        </div>

        {selected.size > 0 && (
          <div className="adm-bulkbar" role="region" aria-label="Bulk actions">
            <span className="mr-2 font-semibold">{selected.size} selected</span>
            <button type="button" className="adm-btn adm-btn-sm" disabled={pending} onClick={() => run('active', 'Set to active')}>
              Set active
            </button>
            <button type="button" className="adm-btn adm-btn-sm" disabled={pending} onClick={() => run('draft', 'Set to draft')}>
              Set draft
            </button>
            <button type="button" className="adm-btn adm-btn-sm" disabled={pending} onClick={() => run('archived', 'Archived')}>
              Archive
            </button>
            <button type="button" className="adm-btn adm-btn-sm" disabled={pending} onClick={() => run('best-on', 'Marked as best sellers')}>
              Best seller
            </button>
            <button type="button" className="adm-btn adm-btn-sm" disabled={pending} onClick={() => run('best-off', 'Best seller removed')}>
              Not best seller
            </button>
            <button type="button" className="adm-btn adm-btn-sm" disabled={pending} onClick={() => run('new-on', 'Marked as new')}>
              Mark new
            </button>
            <button type="button" className="adm-btn adm-btn-sm" disabled={pending} onClick={() => run('soon-on', 'Marked as coming soon')}>
              Coming soon
            </button>
            <button type="button" className="adm-btn adm-btn-sm" disabled={pending} onClick={() => run('soon-off', 'Now on sale')}>
              Not coming soon
            </button>
            <button type="button" className="adm-btn adm-btn-sm adm-btn-danger" disabled={pending} onClick={() => setConfirmDelete(true)}>
              Delete
            </button>
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
                    <input type="checkbox" className="adm-check" checked={allOnPage} onChange={toggleAll} aria-label="Select all products on this page" />
                  </th>
                  <th>{sortBtn('title', 'Product')}</th>
                  <th>Status</th>
                  <th>{sortBtn('stock', 'Inventory')}</th>
                  <th className="hidden md:table-cell">Category</th>
                  <th className="hidden md:table-cell">{sortBtn('vendor', 'Vendor')}</th>
                  <th className="r">{sortBtn('price', 'Price', true)}</th>
                </tr>
              </thead>
              <tbody>
                {view.map((p) => {
                  const u = units(p);
                  const outSizes = p.sizes.filter((s) => (p.stock[s] ?? 0) <= 0).length;
                  return (
                    <tr key={p.slug} data-selected={selected.has(p.slug) ? '' : undefined}>
                      <td>
                        <input type="checkbox" className="adm-check" checked={selected.has(p.slug)} onChange={() => toggle(p.slug)} aria-label={`Select ${p.name}`} />
                      </td>
                      <td className="min-w-[240px]">
                        <Link href={`/admin/products/${p.slug}`} className="group flex items-center gap-3">
                          <Thumb src={p.image} />
                          <span className="min-w-0">
                            <span className="line-clamp-2 font-semibold group-hover:underline">{p.name}</span>
                            <span className="mt-0.5 flex flex-wrap gap-1">
                              {p.bestSeller && (
                                <Badge plain tone="info">
                                  Best seller
                                </Badge>
                              )}
                              {p.isNew && <Badge plain>New</Badge>}
                              {p.compareAt && (
                                <Badge plain tone="warn">
                                  On sale
                                </Badge>
                              )}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td>
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="whitespace-nowrap">
                        {p.comingSoon ? (
                          <span className="mr-1.5">
                            <Badge tone="info">Coming soon</Badge>
                          </span>
                        ) : u === 0 ? (
                          <span className="mr-1.5">
                            <Badge tone="bad">Out of stock</Badge>
                          </span>
                        ) : null}
                        <span className={u === 0 ? 'font-semibold text-[#b42318]' : ''}>{u} in stock</span>
                        <span className="block text-[12px] text-[#66707c]">
                          {p.sizes.length} variant{p.sizes.length === 1 ? '' : 's'}
                          {outSizes > 0 && u > 0 ? ` · ${outSizes} sold out` : ''}
                        </span>
                      </td>
                      <td className="hidden whitespace-nowrap text-[#4a525c] md:table-cell">
                        {p.sportName} · {p.subName}
                      </td>
                      <td className="hidden text-[#4a525c] md:table-cell">{p.brandName}</td>
                      <td className="num r whitespace-nowrap font-medium">
                        {money(p.price)}
                        {p.compareAt ? <s className="block text-[11.5px] font-normal text-[#8a939e]">{money(p.compareAt)}</s> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No products found" action={filtersOn ? undefined : <Link href="/admin/products/new" className="adm-btn adm-btn-primary">Add product</Link>}>
            Try changing the filters or the search.
          </Empty>
        )}

        <div className="adm-sep flex items-center justify-between gap-3 px-4 py-3 text-[12.5px] text-[#66707c]">
          <span>
            {filtered.length ? `${(Math.min(page, pages) - 1) * PAGE + 1}–${Math.min(Math.min(page, pages) * PAGE, filtered.length)} of ${filtered.length}` : '0 products'}
          </span>
          <span className="flex items-center gap-1">
            <button type="button" className="adm-icon-btn" disabled={page <= 1} onClick={() => set({ page: String(page - 1) })} aria-label="Previous page">
              <AIcon name="chevron-left" size={16} />
            </button>
            <span className="num">
              {Math.min(page, pages)} / {pages}
            </span>
            <button type="button" className="adm-icon-btn" disabled={page >= pages} onClick={() => set({ page: String(page + 1) })} aria-label="Next page">
              <AIcon name="chevron-right" size={16} />
            </button>
          </span>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${selected.size} product${selected.size === 1 ? '' : 's'}?`}
        body="They are removed from the store and the admin. To keep them but hide them from the store, archive them instead."
        confirm="Delete"
        danger
        busy={pending}
        onConfirm={() => run('delete', 'Deleted')}
        onClose={() => setConfirmDelete(false)}
      />
    </>
  );
}
