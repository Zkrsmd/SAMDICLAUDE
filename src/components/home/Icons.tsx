import Link from 'next/link';
import { ProductImage } from '@/components/product/ProductImage';
import { Icon } from '@/components/ui/Icon';
import { formatPrice } from '@/lib/format';
import type { CardData } from '@/lib/catalog';

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
              <div className="arena tilt relative aspect-[4/5]" data-reveal="" data-tilt="" style={{ ['--d' as string]: `${i * 120}ms` }}>
                <div aria-hidden className="absolute inset-0 -z-[2]" style={{ background: `radial-gradient(55% 45% at 50% 55%, ${GLOW[i % 3]!.replace(/[\d.]+\)$/, '0.32)')}, transparent 70%)` }} />
                <span aria-hidden className="display pointer-events-none absolute -bottom-[0.12em] left-3 text-[38cqw] leading-none text-ink/[0.05] [container-type:inline-size]">0{i + 1}</span>
                <span className="mono absolute left-4 top-4 rounded-full border border-ink/10 bg-white/80 px-3 py-1 text-[11px] text-ink backdrop-blur">0{i + 1}</span>
                <div className="absolute inset-[10%] transition-transform duration-[900ms] ease-[var(--ease-expo)] [transform:translateZ(40px)] group-hover:-translate-y-3 group-hover:scale-[1.08] group-hover:-rotate-6">
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
