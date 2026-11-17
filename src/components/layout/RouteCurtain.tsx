'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useCurtain } from '@/stores/curtain';

/** Full-screen sport-coloured wipe between routes. Keeps normal routing + back/forward. */
export function RouteCurtain() {
  const { phase, color, ink, word, x, y, set } = useCurtain();
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (phase === 'hold' || phase === 'in') {
      const t = window.setTimeout(() => set({ phase: 'out' }), 260);
      const t2 = window.setTimeout(() => set({ phase: 'idle' }), 1100);
      return () => {
        window.clearTimeout(t);
        window.clearTimeout(t2);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // safety: never leave the curtain covering the page
  useEffect(() => {
    if (phase !== 'hold') return;
    const t = window.setTimeout(() => set({ phase: 'out' }), 2600);
    return () => window.clearTimeout(t);
  }, [phase, set]);

  if (phase === 'idle') return null;
  const r = phase === 'in' ? '0px' : '150vmax';
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[85]">
      <div
        className="absolute inset-0 flex items-center justify-center overflow-hidden"
        style={{
          background: color,
          clipPath: phase === 'out' ? 'inset(0 0 100% 0)' : `circle(${r} at ${x}px ${y}px)`,
          transition:
            phase === 'out' ? 'clip-path .75s cubic-bezier(.76,0,.24,1)' : 'clip-path .6s cubic-bezier(.65,0,.35,1)',
        }}
        ref={(el) => {
          if (el && phase === 'in') requestAnimationFrame(() => requestAnimationFrame(() => set({ phase: 'hold' })));
        }}
      >
        <span className="display text-[clamp(72px,24vw,320px)]" style={{ color: ink, animation: 'rise-in .7s var(--ease-expo) both' }}>
          {word}
        </span>
      </div>
    </div>
  );
}

/** Link that plays the curtain before navigating (falls back to a normal link without JS). */
export function CurtainLink({
  href,
  color,
  ink,
  word,
  className,
  children,
  ...rest
}: React.ComponentProps<typeof Link> & { href: string; color: string; ink?: string; word: string }) {
  const router = useRouter();
  const start = useCurtain((s) => s.start);
  return (
    <Link
      href={href}
      className={className}
      {...rest}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        e.preventDefault();
        start({ color, ink, word, x: e.clientX || window.innerWidth / 2, y: e.clientY || window.innerHeight / 2 });
        window.setTimeout(() => router.push(href), 520);
      }}
    >
      {children}
    </Link>
  );
}
