import Link from 'next/link';
import { ProductImage } from '@/components/product/ProductImage';
import { Icon } from '@/components/ui/Icon';
import { formatPrice } from '@/lib/format';
import type { CardData } from '@/lib/catalog';

const BG = ['/media/cat-football.webp', '/media/cat-boxing.webp', '/media/cat-swimming.webp'];
const GLOW = ['rgba(255,106,43,.6)', 'rgba(231,184,90,.6)', 'rgba(94,231,223,.6)'];

/** The three researched flagship products, presented as editorial plates. */
export function Icons({ items }: { items: CardData[] }) {
  return (
    <section aria-labelledby="icons-title" className="py-16 md:py-24">
      <div className="container-x flex items-end justify-between">
        <div>
          <p className="eyebrow text-muted">The icons</p>
          <h2 id="icons-title" className="display mt-3 text-[clamp(36px,9.4vw,128px)]">
            Three objects. <span className="holo-text">Three worlds.</span>
          </h2>
        </div>
      </div>
      <ul className="no-scrollbar container-x mt-10 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-3 md:overflow-visible">
        {items.map((p, i) => (
          <li key={p.slug} className="w-[82vw] shrink-0 snap-center md:w-auto">
            <Link href={`/product/${p.slug}`} className="group block">
              <div className="relative isolate aspect-[4/5] overflow-hidden rounded-[22px] bg-ink" data-reveal="" style={{ ['--d' as string]: `${i * 120}ms` }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={BG[i % 3]} alt="" loading="lazy" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-70 blur-[2px] transition-all duration-[1400ms] ease-[var(--ease-expo)] group-hover:scale-110 group-hover:opacity-90 group-hover:blur-0" />
                <div aria-hidden className="absolute inset-0 -z-10" style={{ background: `radial-gradient(55% 45% at 50% 55%, ${GLOW[i % 3]}, transparent 70%), linear-gradient(180deg, transparent 50%, rgba(0,0,0,.6))` }} />
                <span aria-hidden className="holo-ring opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                <span className="mono absolute left-4 top-4 rounded-full border border-white/40 bg-white/15 px-3 py-1 text-[11px] text-white backdrop-blur">0{i + 1}</span>
                <div className="absolute inset-[10%] transition-transform duration-[900ms] ease-[var(--ease-expo)] group-hover:-translate-y-3 group-hover:scale-[1.1] group-hover:-rotate-6">
                  <ProductImage slug={p.slug} colorId={p.colors[0]!.id} alt={`${p.brandName} ${p.name}`} sizes="(max-width:768px) 80vw, 33vw" className="float-product" />
                </div>
              </div>
              <div className="mt-4 flex items-start justify-between gap-4">
                <div>
                  <p className="eyebrow text-muted">{p.brandName}</p>
                  <h3 className="mt-1 text-[18px] font-medium leading-snug group-hover:text-orange">{p.name}</h3>
                  <p className="mt-1 text-[14px] text-muted">{p.short}</p>
                </div>
                <span className="mono shrink-0 text-[14px] font-semibold">{formatPrice(p.price)}</span>
              </div>
              <span className="eyebrow mt-3 inline-flex items-center gap-2 text-ink">
                View product <Icon name="arrow-right" size={14} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
