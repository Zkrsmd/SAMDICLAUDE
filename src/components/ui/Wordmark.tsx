import { brand } from '@/config/brand';

/**
 * The STRYKE logo is the name itself: heavy, condensed italic type (the display face), ink with a
 * cobalt "Y" (the strike). The favicon (src/app/icon.svg) is the "S" alone.
 */
export function Wordmark({ className = '' }: { className?: string; glow?: boolean }) {
  return (
    <span className={`inline-flex items-center leading-none ${className}`} aria-label={brand.name} dir="ltr">
      <span aria-hidden className="display whitespace-nowrap text-[1.15em] tracking-[0.04em]">
        STR<span className="wm-o text-cobalt">Y</span>KE
      </span>
    </span>
  );
}
