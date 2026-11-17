import Link from 'next/link';
import { ProductImage } from '@/components/product/ProductImage';
import { Icon } from '@/components/ui/Icon';
import { formatPrice } from '@/lib/format';
import type { CardData } from '@/lib/catalog';

const BG = ['world-turf', 'world-gym', 'world-water'];

/** The three researched flagship products, presented as editorial plates. */
export function Icons({ items }: { items: CardData[] }) {
  return (
    <section aria-labelledby="icons-title" className="py-16 md:py-24">
      <div className="container-x flex items-end justify-between">
        <div>
          <p className="eyebrow text-muted">The icons</p>
          <h2 id="icons-title" className="display mt-3 text-[clamp(44px,11vw,120px)]">
            Three objects. Three worlds.
          </h2>
        </div>
      </div>
      <ul className="no-scrollbar container-x mt-10 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-3 md:overflow-visible">
        {items.map((p, i) => (
          <li key={p.slug} className="w-[82vw] shrink-0 snap-center md:w-auto">
            <Link href={`/product/${p.slug}`} className="group block">
              <div className={`world ${BG[i % 3]} relative aspect-[4/5] overflow-hidden rounded-[2px]`}>
                <div aria-hidden className="world-fx absolute inset-0" />
                <span className="mono absolute left-3 top-3 rounded-[2px] bg-white/90 px-2 py-1 text-[11px]">0{i + 1}</span>
                <div className="absolute inset-[10%] transition-transform duration-[900ms] ease-[var(--ease-expo)] group-hover:scale-[1.06] group-hover:-rotate-3">
                  <ProductImage slug={p.slug} colorId={p.colors[0]!.id} alt={`${p.brandName} ${p.name}`} sizes="(max-width:768px) 80vw, 33vw" className="drop-shadow-[0_30px_30px_rgba(0,0,0,0.22)]" />
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
