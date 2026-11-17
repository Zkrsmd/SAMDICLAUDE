import { brand } from '@/config/brand';

/** Temporary editable word-mark. Swap for the final logo SVG once the brand is named. */
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`display inline-flex items-baseline gap-[0.18em] leading-none ${className}`} aria-label={brand.name}>
      <span aria-hidden className="inline-block h-[0.62em] w-[0.62em] translate-y-[0.02em] rounded-full bg-orange" />
      <span aria-hidden className="tracking-[0.02em]">
        {brand.name}
      </span>
    </span>
  );
}
