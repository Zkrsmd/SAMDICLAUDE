import Link from 'next/link';
import { formatPrice } from '@/lib/format';

/* Shared admin primitives (server- and client-safe: no hooks here). */

export const money = (cents: number) => formatPrice(cents);
export const moneyShort = (cents: number) => {
  const v = cents / 100;
  return v >= 10_000 ? `${(v / 1000).toFixed(v >= 100_000 ? 0 : 1)}k DA` : formatPrice(cents);
};
// dates are shown in UTC so the server and the browser always print the same thing
const dtf = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const dtfTime = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
const dtfLong = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
export const day = (iso: string) => dtf.format(new Date(iso));
export const dateTime = (iso: string) => dtfTime.format(new Date(iso));
export const longDate = (iso: string) => dtfLong.format(new Date(iso));
export const pct = (v: number | null) => (v === null ? '—' : `${v > 0 ? '+' : ''}${(v * 100).toFixed(Math.abs(v) < 0.1 ? 1 : 0)}%`);

type IconName =
  | 'home'
  | 'orders'
  | 'products'
  | 'inventory'
  | 'collections'
  | 'customers'
  | 'analytics'
  | 'settings'
  | 'store'
  | 'logout'
  | 'search'
  | 'plus'
  | 'image'
  | 'upload'
  | 'more'
  | 'external'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-down'
  | 'sort'
  | 'close'
  | 'check'
  | 'menu'
  | 'trash'
  | 'copy'
  | 'download'
  | 'alert'
  | 'truck'
  | 'tag'
  | 'note'
  | 'printer'
  | 'bell'
  | 'bell-off';

const P: Record<IconName, React.ReactNode> = {
  home: <path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z" />,
  orders: (
    <>
      <path d="M5 4h14v16l-3-2-2 2-2-2-2 2-2-2-3 2z" />
      <path d="M9 9h6M9 13h6" />
    </>
  ),
  products: (
    <>
      <path d="M12 3 4 7v10l8 4 8-4V7z" />
      <path d="m4 7 8 4 8-4M12 11v10" />
    </>
  ),
  inventory: (
    <>
      <rect x="4" y="4" width="16" height="7" rx="1.5" />
      <rect x="4" y="13" width="16" height="7" rx="1.5" />
      <path d="M10 7.5h4M10 16.5h4" />
    </>
  ),
  collections: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </>
  ),
  customers: (
    <>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),
  analytics: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4 5.3 5.3" />
    </>
  ),
  store: (
    <>
      <path d="M4 9.5 5.5 4h13L20 9.5" />
      <path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0" />
      <path d="M5.5 12v8h13v-8M10 20v-5h4v5" />
    </>
  ),
  logout: (
    <>
      <path d="M14 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4" />
      <path d="M10 16l-4-4 4-4M6 12h9" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  image: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m4 17 5-4.5 4 3.5 3-2.5 4 3.5" />
    </>
  ),
  upload: <path d="M12 16V5M7.5 9.5 12 5l4.5 4.5M5 19h14" />,
  more: (
    <>
      <circle cx="6" cy="12" r="1.2" fill="currentColor" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
      <circle cx="18" cy="12" r="1.2" fill="currentColor" />
    </>
  ),
  external: <path d="M14 5h5v5M19 5l-8 8M17 14v5H5V7h5" />,
  'chevron-left': <path d="m14.5 6-6 6 6 6" />,
  'chevron-right': <path d="m9.5 6 6 6-6 6" />,
  'chevron-down': <path d="m6 9.5 6 6 6-6" />,
  sort: <path d="M8 9.5 12 5.5l4 4M8 14.5l4 4 4-4" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  trash: <path d="M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13" />,
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
    </>
  ),
  download: <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19h14" />,
  alert: (
    <>
      <path d="M12 4 2.5 20h19z" />
      <path d="M12 10v4.5M12 17.2v.3" />
    </>
  ),
  printer: (
    <>
      <path d="M7 9V4h10v5" />
      <path d="M7 17H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2" />
      <path d="M7 14h10v6H7z" />
    </>
  ),
  bell: (
    <>
      <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </>
  ),
  'bell-off': (
    <>
      <path d="M6 16V11a6 6 0 0 1 9.5-4.9M18 11v5l1.5 2H8" />
      <path d="M10 20.5a2 2 0 0 0 4 0M4 4l16 16" />
    </>
  ),
  truck: (
    <>
      <path d="M3 6h11v10H3zM14 10h4l3 3v3h-7" />
      <circle cx="7" cy="18" r="1.8" />
      <circle cx="17" cy="18" r="1.8" />
    </>
  ),
  tag: (
    <>
      <path d="M3.5 12.5V4.5h8l9 9-8 8z" />
      <circle cx="8" cy="9" r="1.4" />
    </>
  ),
  note: (
    <>
      <path d="M5 4h14v11l-5 5H5z" />
      <path d="M14 20v-5h5M8.5 9h7M8.5 12.5h4" />
    </>
  ),
};

export function AIcon({ name, size = 18, className = '' }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      {P[name]}
    </svg>
  );
}
export type { IconName };

export function Card({ title, action, children, className = '', pad = true }: { title?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={`adm-card ${pad ? 'adm-card-pad' : ''} ${className}`}>
      {(title || action) && (
        <div className={`mb-3 flex items-center justify-between gap-3 ${pad ? '' : 'px-4 pt-4'}`}>
          {title ? <h2 className="adm-card-title">{title}</h2> : <span />}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageHead({ title, back, children, meta }: { title: React.ReactNode; back?: string; children?: React.ReactNode; meta?: React.ReactNode }) {
  return (
    <div className="adm-head">
      <div className="flex min-w-0 items-center gap-2">
        {back && (
          <Link href={back} className="adm-icon-btn -ml-2" aria-label="Back">
            <AIcon name="chevron-left" />
          </Link>
        )}
        <h1 className="adm-title truncate">{title}</h1>
        {meta}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export type Tone = 'good' | 'warn' | 'bad' | 'info' | undefined;
export function Badge({ tone, children, plain }: { tone?: Tone; children: React.ReactNode; plain?: boolean }) {
  return (
    <span className="adm-badge" data-tone={tone} data-plain={plain ? '' : undefined}>
      {children}
    </span>
  );
}

const TONES: Record<string, Tone> = {
  active: 'good',
  draft: 'info',
  archived: undefined,
  paid: 'good',
  pending: 'warn',
  refunded: 'bad',
  fulfilled: undefined,
  unfulfilled: 'warn',
  // cash on delivery
  cod: 'warn',
  void: undefined,
  new: 'bad',
  no_answer: 'warn',
  confirmed: 'info',
  preparing: 'info',
  shipped: 'info',
  delivered: 'good',
  returned: 'bad',
  cancelled: undefined,
};
export const statusTone = (s: string): Tone => TONES[s];
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const LABEL: Record<string, string> = { paid: 'Paid', pending: 'Payment pending', cod: 'Cash on delivery', void: 'Not collected', new: 'To confirm', no_answer: 'No answer' };

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={statusTone(status)}>{LABEL[status] ?? cap(status)}</Badge>;
}

export function Thumb({ src, alt = '' }: { src: string; alt?: string }) {
  return (
    <span className="adm-thumb">
      {/* eslint-disable-next-line @next/next/no-img-element -- tiny admin thumbnails, served as-is */}
      <img src={src} alt={alt} loading="lazy" decoding="async" />
    </span>
  );
}

export function SampleNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="adm-banner mb-4" data-tone="info" role="note">
      <AIcon name="alert" size={16} className="mt-0.5 shrink-0" />
      <p>{children}</p>
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="grid place-items-center px-6 py-16 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-[#eceef1] text-[#66707c]">
        <AIcon name="search" />
      </div>
      <p className="mt-4 text-[15px] font-semibold">{title}</p>
      {children && <p className="mt-1 max-w-sm text-[#66707c]">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** 7 / 30 / 90 days, kept in the address (?range=) */
export function RangeTabs({ range, base }: { range: string; base: string }) {
  return (
    <div className="adm-card flex gap-0.5 p-1" role="group" aria-label="Date range">
      {(['7', '30', '90'] as const).map((k) => (
        <Link key={k} href={`${base}?range=${k}`} className="adm-tab !h-8 leading-8" aria-current={k === range ? 'page' : undefined}>
          {k} days
        </Link>
      ))}
    </div>
  );
}
