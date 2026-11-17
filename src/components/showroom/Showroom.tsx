'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { formatPrice, renderUrl } from '@/lib/format';
import { Icon } from '@/components/ui/Icon';
import { useReducedMotion } from '@/hooks/useHydrated';

export interface ShowItem {
  slug: string;
  name: string;
  brandName: string;
  price: number;
}
export type Mount = 'wall' | 'hooks' | 'plinths';

const TITLE: Record<Mount, string> = { wall: 'The boot wall', hooks: 'The glove room', plinths: 'The lens bar' };

/**
 * Lit gallery wall of real product cut-outs. Hover (or focus) switches on a spotlight above the
 * piece, lifts it and shows its placard. Choosing one "zooms the camera" into it: the cut-out
 * flies from the wall to fill the screen while the room dims, then the product page opens.
 * Mobile: a snapping horizontal rail. Every item is a real link, so the wall is never the only route.
 */
export function Showroom({ items, mount, sport }: { items: ShowItem[]; mount: Mount; sport: string }) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const [active, setActive] = useState<number | null>(null);
  const [zoom, setZoom] = useState<{ slug: string; from: DOMRect; go: boolean } | null>(null);
  const room = useRef<HTMLDivElement>(null);

  // spotlight follows the mouse across the wall (CSS variables only)
  useEffect(() => {
    const el = room.current;
    if (!el) return;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--lx', `${e.clientX - r.left}px`);
      el.style.setProperty('--ly', `${e.clientY - r.top}px`);
    };
    el.addEventListener('pointermove', onMove, { passive: true });
    return () => el.removeEventListener('pointermove', onMove);
  }, []);

  // zoom: start at the item rect, next frame expand to the viewport, then navigate
  useEffect(() => {
    if (!zoom) return;
    if (!zoom.go) {
      const r = requestAnimationFrame(() => setZoom((z) => (z ? { ...z, go: true } : z)));
      return () => cancelAnimationFrame(r);
    }
    const t = window.setTimeout(() => router.push(`/product/${zoom.slug}`), 650);
    return () => window.clearTimeout(t);
  }, [zoom, router]);

  const open = (e: React.MouseEvent<HTMLAnchorElement>, slug: string) => {
    if (reduced || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    const img = e.currentTarget.querySelector('img');
    if (!img) return;
    e.preventDefault();
    router.prefetch(`/product/${slug}`);
    setZoom({ slug, from: img.getBoundingClientRect(), go: false });
  };

  return (
    <section aria-label={TITLE[mount]} className="relative">
      <a href="#listing" className="sr-only-focusable absolute left-4 top-4 z-20 bg-ink px-3 py-2 text-white">
        Skip to product list
      </a>
      <div
        ref={room}
        className="group/room relative overflow-hidden bg-[#EFEDE6]"
        style={{
          backgroundImage:
            'radial-gradient(700px circle at var(--lx, 50%) var(--ly, 30%), rgba(255,255,255,.9), transparent 60%), linear-gradient(180deg, #F6F4EE 0%, #ECE9E1 100%)',
        }}
      >
        {/* architectural wall: soft panel seams + skirting */}
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60" style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent 0 calc(25% - 1px), rgba(23,26,24,.06) calc(25% - 1px) 25%)' }} />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/[0.07] to-transparent" />
        <div aria-hidden className="display pointer-events-none absolute inset-x-0 top-[6%] select-none text-center text-[22vw] leading-none text-ink/[0.045] md:text-[15vw]">
          {sport}
        </div>

        <div className="container-x relative pt-10 md:pt-14">
          <div className="flex items-end justify-between">
            <div>
              <p className="eyebrow text-muted">Showroom</p>
              <h2 className="display mt-2 text-[clamp(36px,8vw,76px)]">{TITLE[mount]}</h2>
            </div>
            <p className="mono hidden text-[11px] uppercase tracking-[0.16em] text-muted md:block">Hover to light · click to step closer</p>
          </div>
        </div>

        <ul
          className="relative mt-6 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-10 [scrollbar-width:none] md:container-x md:grid md:snap-none md:grid-cols-4 md:gap-x-6 md:gap-y-2 md:overflow-visible md:pb-16"
          onMouseLeave={() => setActive(null)}
        >
          {items.map((it, i) => {
            const on = active === i;
            const dim = active !== null && !on;
            return (
              <li key={it.slug} className="relative w-[72vw] shrink-0 snap-center sm:w-[44vw] md:w-auto">
                <a
                  href={`/product/${it.slug}`}
                  onClick={(e) => open(e, it.slug)}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  className="group relative block outline-none"
                  aria-label={`${it.brandName} ${it.name}, ${formatPrice(it.price)}`}
                >
                  {/* spotlight cone */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-[-10%] top-[-30%] h-[110%] transition-opacity duration-500"
                    style={{
                      opacity: on ? 1 : 0,
                      background: 'conic-gradient(from 180deg at 50% 0%, transparent 155deg, rgba(255,247,225,.85) 172deg, rgba(255,255,255,.95) 180deg, rgba(255,247,225,.85) 188deg, transparent 205deg)',
                      filter: 'blur(14px)',
                      mixBlendMode: 'screen',
                    }}
                  />
                  {/* lamp */}
                  <span aria-hidden className="absolute left-1/2 top-0 h-1.5 w-10 -translate-x-1/2 rounded-b-full bg-ink/80 transition-shadow duration-500" style={{ boxShadow: on ? '0 6px 30px 8px rgba(255,236,190,.9)' : 'none' }} />
                  <span className="relative block aspect-square p-[12%] pt-[16%]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={renderUrl(it.slug)}
                      alt=""
                      loading={i < 8 ? 'eager' : 'lazy'}
                      draggable={false}
                      className="h-full w-full object-contain transition-[transform,filter,opacity] duration-700 ease-[var(--ease-expo)]"
                      style={{
                        transform: on ? 'translateY(-6%) scale(1.08) rotate(-4deg)' : 'none',
                        filter: on ? 'drop-shadow(0 30px 24px rgba(0,0,0,.28)) saturate(1.1)' : 'drop-shadow(0 14px 12px rgba(0,0,0,.18)) saturate(.92)',
                        opacity: zoom?.slug === it.slug ? 0 : dim ? 0.45 : 1,
                      }}
                    />
                  </span>
                  {/* shelf */}
                  <span aria-hidden className="block h-2 rounded-[2px] bg-gradient-to-b from-white to-[#DAD6CC] shadow-[0_10px_18px_-8px_rgba(0,0,0,.35)]" />
                  {/* placard */}
                  <span className={`mt-3 block transition-all duration-500 ${on ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-70 md:opacity-0'}`}>
                    <span className="mono block text-[10px] uppercase tracking-[0.16em] text-muted">{it.brandName}</span>
                    <span className="mt-0.5 line-clamp-1 block text-[14px] font-semibold">{it.name}</span>
                    <span className="mt-1 flex items-center justify-between">
                      <span className="mono text-[13px]">{formatPrice(it.price)}</span>
                      <span className="inline-flex items-center gap-1 text-[12px] font-semibold">
                        View <Icon name="arrow-right" size={14} />
                      </span>
                    </span>
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      </div>

      {zoom && (
        <div aria-hidden className="fixed inset-0 z-[90]">
          <div className="absolute inset-0 transition-[background,backdrop-filter] duration-500" style={{ background: zoom.go ? 'rgba(250,250,247,.96)' : 'rgba(250,250,247,0)', backdropFilter: zoom.go ? 'blur(12px)' : 'none' }} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={renderUrl(zoom.slug)}
            alt=""
            className="absolute object-contain transition-all duration-[650ms] ease-[cubic-bezier(.77,0,.18,1)]"
            style={
              zoom.go
                ? { left: '8vw', top: '18vh', width: '84vw', height: '64vh', filter: 'drop-shadow(0 40px 40px rgba(0,0,0,.3))' }
                : { left: zoom.from.left, top: zoom.from.top, width: zoom.from.width, height: zoom.from.height }
            }
          />
        </div>
      )}
    </section>
  );
}
