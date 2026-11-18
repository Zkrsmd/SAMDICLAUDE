import Link from 'next/link';
import { ProductImage } from '@/components/product/ProductImage';
import { QuickAdd } from '@/components/product/QuickAdd';
import { formatPrice } from '@/lib/format';
import type { CardData } from '@/lib/catalog';

const GLOW = ['rgba(120,160,130,.55)', 'rgba(176,146,98,.55)', 'rgba(96,150,196,.55)'];

/** The three flagship objects as quiet plates: name, price and a + straight to the bag. */
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
            <div className="group">
              <Link href={`/product/${p.slug}`} className="block" aria-label={`${p.brandName} ${p.name}`}>
                <div className="arena tilt relative aspect-[4/5]" data-reveal="" data-tilt="" style={{ ['--d' as string]: `${i * 120}ms` }}>
                  <div aria-hidden className="absolute inset-0 -z-[2]" style={{ background: `radial-gradient(60% 48% at 50% 55%, ${GLOW[i % 3]!.replace(/[\d.]+\)$/, '0.3)')}, transparent 72%), linear-gradient(180deg, #F7F8FA, #E9ECF0)` }} />
                  <span aria-hidden className="display pointer-events-none absolute -bottom-[0.12em] left-3 text-[38cqw] leading-none text-ink/[0.05] [container-type:inline-size]">0{i + 1}</span>
                  <span className="mono absolute left-4 top-4 rounded-full border border-ink/10 bg-white/80 px-3 py-1 text-[11px] text-ink backdrop-blur">0{i + 1}</span>
                  <div className="absolute inset-[10%] transition-transform duration-[1000ms] ease-[var(--ease-expo)] [transform:translateZ(40px)] group-hover:-translate-y-3 group-hover:scale-[1.07] group-hover:-rotate-[5deg]">
                    <ProductImage slug={p.slug} colorId={p.colors[0]!.id} alt="" sizes="(max-width:768px) 82vw, 34vw" className="float-product" />
                  </div>
                </div>
              </Link>
              <div className="mt-4 flex items-center justify-between gap-4 px-1">
                <Link href={`/product/${p.slug}`} className="min-w-0" tabIndex={-1}>
                  <h3 className="line-clamp-1 text-[17px] font-semibold tracking-[-0.01em] transition-colors group-hover:text-cobalt">{p.name}</h3>
                  <p className="mono mt-1 text-[13px] text-muted">{formatPrice(p.price)}</p>
                </Link>
                <QuickAdd slug={p.slug} name={p.name} colorId={p.colors[0]!.id} sizes={p.sizes} />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
