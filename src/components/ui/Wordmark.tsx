import { brand } from '@/config/brand';

/**
 * MODE S mark: a forward-slanted chrome badge (graphite → steel → cobalt, like polished metal) with a
 * white italic "S" drawn as one continuous stroke, and two speed lines trailing it.
 * The same drawing is the favicon (src/app/icon.svg).
 */
export function BrandMark({ className = '', glow = true }: { className?: string; glow?: boolean }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <defs>
        <linearGradient id="modes-chrome" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0F1216" />
          <stop offset="0.5" stopColor="#3A4350" />
          <stop offset="0.8" stopColor="#8E99A8" />
          <stop offset="1" stopColor="#2B59FF" />
        </linearGradient>
        <filter id="modes-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* the badge, slanted forward */}
      <path
        d="M13 4h29.5a3 3 0 0 1 2.9 3.8l-9.2 33.5a4 4 0 0 1-3.9 2.7H3.5a3 3 0 0 1-2.9-3.8L9.1 6.7A4 4 0 0 1 13 4Z"
        fill="url(#modes-chrome)"
        filter={glow ? 'url(#modes-glow)' : undefined}
      />
      {/* the S: one stroke, italic */}
      <path
        d="M33.2 12.6H22.4c-3.3 0-5.6 1.9-6.2 4.6-.6 2.8 1.1 5 4.4 5h6.6c3.3 0 5 2.2 4.4 5-.6 2.7-2.9 4.6-6.2 4.6H13.2"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="4.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* speed lines */}
      <g stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" opacity="0.75">
        <path d="M6.4 37.4h9" />
        <path d="M9.6 8.6h6.5" />
      </g>
    </svg>
  );
}

/** Logo lock-up: mark + MODE S word-mark. */
export function Wordmark({ className = '', glow = true }: { className?: string; glow?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-[0.35em] leading-none ${className}`} aria-label={brand.name} dir="ltr">
      <BrandMark className="h-[1.35em] w-[1.35em] shrink-0" glow={glow} />
      <span aria-hidden className="display whitespace-nowrap tracking-[0.06em]">
        MODE<span className="text-cobalt"> S</span>
      </span>
    </span>
  );
}
