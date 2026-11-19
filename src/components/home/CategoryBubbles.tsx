import Link from 'next/link';
import { ProductImage } from '@/components/product/ProductImage';

export interface Bubble {
  href: string;
  name: string;
  count: number;
  /** product slug whose cut-out sits in the bubble */
  thumb: string;
}

/**
 * Categories as small bubbles: a round product cut-out and a short label, straight to that part
 * of the store. `tone="glass"` is the frosted version that sits on the hero's 3D world.
 */
export function CategoryBubbles({ items, tone = 'page', label }: { items: Bubble[]; tone?: 'page' | 'glass'; label: string }) {
  return (
    <ul aria-label={label} className={`bubbles no-scrollbar ${tone === 'glass' ? 'bubbles-glass' : ''}`}>
      {items.map((b, i) => (
        <li key={b.href} style={{ ['--i' as string]: i }}>
          <Link href={b.href} className="bubble group" aria-label={`${b.name}, ${b.count} products`}>
            <span className="bubble-disc">
              <span className="bubble-img">
                <ProductImage slug={b.thumb} colorId="standard" alt="" sizes="72px" />
              </span>
            </span>
            <span className="bubble-label">{b.name}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
