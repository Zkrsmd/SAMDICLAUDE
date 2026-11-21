'use client';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { ProductImage } from './ProductImage';
import { formatPrice } from '@/lib/format';
import type { CardData } from '@/lib/catalog';
import { useT } from '@/i18n/client';

/** MORE FROM THIS COLLECTION — renders floating in a bright gallery band, drifting with scroll. */
export function FloatingCollection({ items, title }: { items: CardData[]; title: string }) {
  const t = useT();
  const band = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const el = band.current;
    if (!el) return;
    let raf = 0;
    const loop = () => {
      const r = el.getBoundingClientRect();
      const p = (window.innerHeight - r.top) / (window.innerHeight + r.height);
      const kids = el.children;
      for (let i = 0; i < kids.length; i++) (kids[i] as HTMLElement).style.setProperty('--fy', `${Math.sin(p * Math.PI * 2 + i * 1.3) * 18}px`);
      raf = requestAnimationFrame(loop);
    };
    const io = new IntersectionObserver(([e]) => {
      cancelAnimationFrame(raf);
      if (e?.isIntersecting) raf = requestAnimationFrame(loop);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <section aria-labelledby="coll-title" className="relative overflow-hidden py-16" style={{ background: 'radial-gradient(70% 90% at 50% 40%, #FFFFFF, #EFEEE8)' }}>
      <div className="container-x">
        <p className="eyebrow text-muted">{t('More from this collection')}</p>
        <h2 id="coll-title" className="display mt-3 text-[clamp(30px,6.2vw,72px)]">
          {title}
        </h2>
      </div>
      <ul ref={band} className="no-scrollbar container-x mt-10 flex snap-x gap-6 overflow-x-auto pb-6">
        {items.map((p, i) => (
          <li key={p.slug} className="w-[62vw] shrink-0 snap-center md:w-[24vw]" style={{ transform: 'translate3d(0, var(--fy, 0px), 0)' }}>
            <Link href={`/product/${p.slug}`} className="group block">
              <div className="relative aspect-square" style={{ animation: `float-y ${5 + (i % 3)}s ease-in-out ${i * 0.4}s infinite`, ['--r' as string]: `${i % 2 ? 4 : -4}deg` }}>
                <ProductImage slug={p.slug} colorId={p.colors[0]!.id} alt="" sizes="(max-width:768px) 62vw, 24vw" className="drop-shadow-[0_34px_28px_rgba(0,0,0,0.18)] transition-transform duration-700 group-hover:scale-110" />
              </div>
              <div className="mt-4 text-center">
                <p className="eyebrow text-muted">{p.brandName}</p>
                <p className="mt-1 text-[15px] font-medium group-hover:text-cobalt">{p.name}</p>
                <p className="mono text-[13px]">{formatPrice(p.price)}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
