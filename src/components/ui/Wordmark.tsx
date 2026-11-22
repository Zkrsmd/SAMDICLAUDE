import { brand } from '@/config/brand';

/**
 * The REVO logo is the name itself: heavy, condensed italic type (the display face), ink with a
 * cobalt "O". The favicon (src/app/icon.svg) is the "R" alone.
 */
export function Wordmark({ className = '' }: { className?: string; glow?: boolean }) {
  return (
    <span className={`inline-flex items-center leading-none ${className}`} aria-label={brand.name} dir="ltr">
      <span aria-hidden className="display whitespace-nowrap text-[1.15em] tracking-[0.04em]">
        REV<span className="text-cobalt">O</span>
      </span>
    </span>
  );
}
