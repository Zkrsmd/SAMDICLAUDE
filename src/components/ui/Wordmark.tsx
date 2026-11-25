import { brand } from '@/config/brand';

/**
 * The STRYKE logo (owner-supplied): the name in white italic capitals on a night-navy slanted
 * block, a cobalt slash, "by SMADI" underneath. Cut from the owner's artwork into
 * public/brand/: `stryke-logo.webp` (for light backgrounds), `stryke-logo-light.webp` ("by SMADI"
 * in white, for the dark header). Size it with a height class; the width follows.
 */
export function Wordmark({ className = 'h-9', tone = 'dark' }: { className?: string; tone?: 'dark' | 'light'; glow?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a small fixed logo, served as-is
    <img
      src={tone === 'light' ? '/brand/stryke-logo-light.webp' : '/brand/stryke-logo.webp'}
      alt={brand.name}
      width={900}
      height={191}
      className={`block w-auto max-w-none select-none ${className}`}
      draggable={false}
      decoding="async"
      fetchPriority="high"
    />
  );
}
