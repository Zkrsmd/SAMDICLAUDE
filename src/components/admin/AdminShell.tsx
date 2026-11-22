'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { logout } from '@/app/admin/actions';
import { AIcon, type IconName } from './ui';
import { Toaster } from './client';
import { OrderAlerts } from './OrderAlerts';

export interface ShellIndex {
  products: { slug: string; name: string; brandName: string; image: string; status: string }[];
  orders: { id: string; number: number; customer: string }[];
}

const NAV: { href: string; label: string; icon: IconName; count?: 'orders'; subs?: { href: string; label: string }[] }[] = [
  { href: '/admin', label: 'Home', icon: 'home' },
  { href: '/admin/orders', label: 'Orders', icon: 'orders', count: 'orders' },
  {
    href: '/admin/products',
    label: 'Products',
    icon: 'products',
    subs: [
      { href: '/admin/collections', label: 'Collections' },
      { href: '/admin/inventory', label: 'Inventory' },
    ],
  },
  { href: '/admin/customers', label: 'Customers', icon: 'customers' },
  { href: '/admin/delivery', label: 'Delivery', icon: 'truck' },
  { href: '/admin/analytics', label: 'Analytics', icon: 'analytics' },
];

const PAGES = [...NAV.flatMap((n) => [{ href: n.href, label: n.label }, ...(n.subs ?? [])]), { href: '/admin/products/new', label: 'Add product' }, { href: '/admin/settings', label: 'Settings' }];

/**
 * The admin frame (Shopify-style): an ink top bar with search (⌘K / Ctrl K anywhere), a left
 * navigation that becomes a drawer on phones, and the page.
 */
export function AdminShell({ children, unfulfilled, index, writable }: { children: React.ReactNode; unfulfilled: number; index: ShellIndex; writable: boolean }) {
  const path = usePathname();
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);
  const [prevPath, setPrevPath] = useState(path);
  // close the drawer when the page changes (adjusting state during render, not in an effect)
  if (prevPath !== path) {
    setPrevPath(path);
    setDrawer(false);
  }

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette(true);
      }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);

  const active = (href: string) => (href === '/admin' ? path === '/admin' : path === href || path.startsWith(`${href}/`));

  const nav = (
    <nav aria-label="Admin" className="flex h-full flex-col">
      <ul className="space-y-0.5">
        {NAV.map((n) => (
          <li key={n.href}>
            <Link href={n.href} className="adm-nav-link" aria-current={active(n.href) ? 'page' : undefined}>
              <AIcon name={n.icon} />
              {n.label}
              {n.count && unfulfilled > 0 ? <span className="adm-nav-count">{unfulfilled}</span> : null}
            </Link>
            {n.subs && (active(n.href) || n.subs.some((s) => active(s.href))) && (
              <div className="adm-nav-sub">
                {n.subs.map((s) => (
                  <Link key={s.href} href={s.href} aria-current={active(s.href) ? 'page' : undefined}>
                    {s.label}
                  </Link>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
      <p className="mono mt-6 px-2.5 text-[10.5px] uppercase tracking-[0.14em] text-[#8a939e]">Sales channels</p>
      <ul className="mt-1.5">
        <li>
          <Link href="/" className="adm-nav-link" target="_blank" rel="noopener">
            <AIcon name="store" />
            Online store
            <AIcon name="external" size={14} className="ml-auto opacity-50" />
          </Link>
        </li>
      </ul>
      <div className="mt-auto space-y-0.5 pt-6">
        <Link href="/admin/settings" className="adm-nav-link" aria-current={active('/admin/settings') ? 'page' : undefined}>
          <AIcon name="settings" />
          Settings
        </Link>
        <form action={logout}>
          <button type="submit" className="adm-nav-link w-full">
            <AIcon name="logout" />
            Log out
          </button>
        </form>
      </div>
    </nav>
  );

  return (
    <div className="adm">
      <a href="#adm-main" className="sr-only-focusable fixed left-3 top-3 z-[100] rounded bg-white px-4 py-2 text-ink">
        Skip to content
      </a>
      <header className="adm-top">
        <button type="button" className="adm-icon-btn text-white hover:!bg-white/10 lg:hidden" aria-label="Menu" aria-expanded={drawer} onClick={() => setDrawer((d) => !d)}>
          <AIcon name={drawer ? 'close' : 'menu'} />
        </button>
        <Link href="/admin" className="adm-brand">
          <span className="adm-brand-mark display text-[15px]">S</span>
          <span className="hidden sm:inline">STRYKE</span>
          <span className="mono hidden rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-white/70 sm:inline">Admin</span>
        </Link>
        <button type="button" className="adm-search" onClick={() => setPalette(true)} aria-label="Search the admin">
          <AIcon name="search" size={16} />
          <span className="truncate">Search</span>
          <span className="adm-kbd hidden sm:inline">Ctrl K</span>
        </button>
        <OrderAlerts />
        <Link href="/" target="_blank" rel="noopener" className="adm-icon-btn text-white hover:!bg-white/10" aria-label="View store">
          <AIcon name="store" />
        </Link>
      </header>
      {!writable && (
        <div className="adm-banner rounded-none px-4" role="note">
          <AIcon name="alert" size={16} className="mt-0.5 shrink-0" />
          <p>
            The store database can’t be reached right now, so changes can’t be saved. Try again in a moment.
          </p>
        </div>
      )}
      <div className="adm-frame">
        <aside className="adm-nav">{nav}</aside>
        {drawer && (
          <>
            <div className="adm-scrim lg:hidden" onClick={() => setDrawer(false)} aria-hidden />
            <aside className="adm-nav-drawer lg:hidden">{nav}</aside>
          </>
        )}
        <main id="adm-main" className="adm-main">
          {children}
        </main>
      </div>
      <Palette open={palette} onClose={() => setPalette(false)} index={index} />
      <Toaster />
    </div>
  );
}

type Hit = { href: string; label: string; hint: string; image?: string };

function Palette({ open, onClose, index }: { open: boolean; onClose: () => void; index: ShellIndex }) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [q, setQ] = useState('');
  const [at, setAt] = useState(0);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const hits = useMemo<Hit[]>(() => {
    const t = q.trim().toLowerCase();
    const pages = PAGES.filter((p) => !t || p.label.toLowerCase().includes(t)).map((p) => ({ href: p.href, label: p.label, hint: 'Page' }));
    if (!t) return pages.slice(0, 8);
    const terms = t.split(/\s+/);
    const products = index.products
      .filter((p) => terms.every((w) => `${p.name} ${p.brandName} ${p.slug}`.toLowerCase().includes(w)))
      .slice(0, 6)
      .map((p) => ({ href: `/admin/products/${p.slug}`, label: p.name, hint: `${p.brandName} · ${p.status}`, image: p.image }));
    const num = t.replace(/^#/, '');
    const orders = index.orders
      .filter((o) => String(o.number).startsWith(num) || o.customer.toLowerCase().includes(t))
      .slice(0, 5)
      .map((o) => ({ href: `/admin/orders/${o.id}`, label: `Order #${o.number}`, hint: o.customer }));
    return [...pages.slice(0, 3), ...products, ...orders];
  }, [q, index]);

  const go = (h: Hit | undefined) => {
    if (!h) return;
    onClose();
    router.push(h.href);
  };

  return (
    <dialog
      ref={ref}
      className="adm-dialog adm-palette"
      aria-label="Search"
      onClose={() => {
        setQ('');
        setAt(0);
        onClose();
      }}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <div className="flex items-center gap-2 border-b border-[rgb(15_18_22/0.09)] px-4">
        <AIcon name="search" size={17} className="text-[#66707c]" />
        <input
          autoFocus
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setAt(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setAt((a) => Math.min(hits.length - 1, a + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setAt((a) => Math.max(0, a - 1));
            } else if (e.key === 'Enter') go(hits[at]);
          }}
          placeholder="Search products, orders, pages"
          className="h-12 w-full bg-transparent text-[15px] outline-none"
          aria-label="Search products, orders and pages"
          role="combobox"
          aria-expanded="true"
          aria-controls="adm-palette-list"
          aria-activedescendant={hits[at] ? `adm-hit-${at}` : undefined}
        />
      </div>
      <ul id="adm-palette-list" role="listbox" className="max-h-[52vh] overflow-y-auto p-2">
        {hits.length ? (
          hits.map((h, i) => (
            <li key={h.href + i} id={`adm-hit-${i}`} role="option" aria-selected={i === at}>
              <button type="button" className="adm-palette-item" data-active={i === at ? '' : undefined} onMouseEnter={() => setAt(i)} onClick={() => go(h)}>
                {h.image ? (
                  <span className="adm-thumb !h-8 !w-8">
                    {/* eslint-disable-next-line @next/next/no-img-element -- tiny admin thumbnail */}
                    <img src={h.image} alt="" />
                  </span>
                ) : (
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#f1f3f5] text-[#66707c]">
                    <AIcon name={h.hint === 'Page' ? 'chevron-right' : 'orders'} size={15} />
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate font-medium">{h.label}</span>
                <span className="shrink-0 text-[12px] text-[#66707c]">{h.hint}</span>
              </button>
            </li>
          ))
        ) : (
          <li className="px-3 py-8 text-center text-[#66707c]">Nothing found for “{q}”</li>
        )}
      </ul>
    </dialog>
  );
}
