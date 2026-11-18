import { brand } from '@/config/brand';

/**
 * SMADI hand mark: an open palm with speed-cut fingers in graphite-to-chrome, like polished steel.
 * Replace with a final designed logo file when available.
 */
export function HandMark({ className = '', glow = true }: { className?: string; glow?: boolean }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <defs>
        <linearGradient id="smadi-holo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0F1216" />
          <stop offset="0.45" stopColor="#3A4350" />
          <stop offset="0.72" stopColor="#9AA5B2" />
          <stop offset="1" stopColor="#2B59FF" />
        </linearGradient>
        <filter id="smadi-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g fill="url(#smadi-holo)" filter={glow ? 'url(#smadi-glow)' : undefined}>
        {/* fingers — cut on a forward slant like speed lines */}
        <path d="M14.5 21.5 14 9.2a2.6 2.6 0 0 1 5.2-.3l.6 12.4Z" />
        <path d="M20.6 20.6 20.5 5.6a2.7 2.7 0 0 1 5.4 0l.2 15Z" />
        <path d="M26.9 20.8 27.6 7.8a2.6 2.6 0 0 1 5.2.3l-.6 13Z" />
        <path d="M33 22.4 34.4 12.9a2.5 2.5 0 0 1 5 .6l-1.5 10.2Z" />
        {/* thumb */}
        <path d="M8.1 24.3a2.6 2.6 0 0 1 3.6-.6l5.4 3.8-2.9 4.2-5.4-3.8a2.6 2.6 0 0 1-.7-3.6Z" />
        {/* palm */}
        <path d="M13.6 22.3h24.6l-.9 9.6c-.6 6.3-5.9 11.1-12.2 11.1h-.3c-5.5 0-10.3-3.7-11.6-9.1Z" />
      </g>
      {/* speed cuts */}
      <g stroke="#F3F4F6" strokeWidth="1.6" strokeLinecap="round" opacity="0.95">
        <path d="M18 30.5h12.5" />
        <path d="M20.5 35h9" />
      </g>
    </svg>
  );
}

/** Logo lock-up: hand mark + SMADI word-mark. */
export function Wordmark({ className = '', glow = true }: { className?: string; glow?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-[0.35em] leading-none ${className}`} aria-label={brand.name}>
      <HandMark className="h-[1.35em] w-[1.35em] shrink-0" glow={glow} />
      <span aria-hidden className="display tracking-[0.08em]">
        {brand.name}
      </span>
    </span>
  );
}
