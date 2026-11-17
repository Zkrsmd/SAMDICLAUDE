'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ProductImage } from './ProductImage';
import { Icon } from '@/components/ui/Icon';
import { useWishlist } from '@/stores/lists';
import { useHydrated } from '@/hooks/useHydrated';
import { formatPrice } from '@/lib/format';
import type { CardData } from '@/lib/catalog';

/** Museum-placard product card: render on stone, mono price, colour swatches, wishlist. */
export function ProductCard({
  p,
  size = 'md',
  priority,
  className = '',
  style,
}: {
  p: CardData;
  size?: 'sm' | 'md' | 'lg';
  priority?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [color, setColor] = useState(p.colors[0]!.id);
  const hydrated = useHydrated();
  const wished = useWishlist((s) => s.slugs.includes(p.slug));
  const toggle = useWishlist((s) => s.toggle);
  const colorName = p.colors.find((c) => c.id === color)?.name;
  return (
    <article className={`group relative flex flex-col ${className}`} style={style}>
      <Link
        href={`/product/${p.slug}${color !== p.colors[0]!.id ? `?color=${color}` : ''}`}
        className="relative block overflow-hidden rounded-[2px] bg-stone"
        aria-label={`${p.brandName} ${p.name}${colorName ? `, ${colorName}` : ''}`}
      >
        <div className={`relative w-full ${size === 'lg' ? 'aspect-[4/5]' : size === 'sm' ? 'aspect-square' : 'aspect-[5/6]'}`}>
          <div className="absolute inset-[8%] transition-transform duration-700 ease-[var(--ease-expo)] group-hover:-translate-y-2 group-hover:scale-[1.04]">
            <ProductImage
              slug={p.slug}
              colorId={color}
              alt=""
              priority={priority}
              sizes={size === 'lg' ? '(max-width: 768px) 90vw, 40vw' : '(max-width: 768px) 50vw, 22vw'}
            />
          </div>
          <span aria-hidden className="absolute inset-x-[18%] bottom-[7%] h-3 rounded-[50%] bg-ink/10 blur-md transition-all duration-700 group-hover:inset-x-[24%] group-hover:opacity-60" />
        </div>
        <div className="absolute left-2.5 top-2.5 flex gap-1.5">
          {p.bestSeller && <span className="eyebrow rounded-[2px] bg-white px-1.5 py-1 text-[9.5px]">Best seller</span>}
          {p.verified && <span className="eyebrow rounded-[2px] bg-ink px-1.5 py-1 text-[9.5px] text-white">Verified</span>}
        </div>
      </Link>
      <button
        type="button"
        onClick={() => toggle(p.slug)}
        aria-pressed={hydrated ? wished : false}
        aria-label={`${hydrated && wished ? 'Remove' : 'Save'} ${p.name} ${hydrated && wished ? 'from' : 'to'} wishlist`}
        className="absolute right-1.5 top-1.5 grid h-10 w-10 place-items-center rounded-full text-ink/70 transition-colors hover:text-orange"
      >
        <Icon name={hydrated && wished ? 'heart-fill' : 'heart'} size={20} className={hydrated && wished ? 'text-orange' : ''} />
      </button>
      <div className="flex flex-1 flex-col pt-3">
        <span className="eyebrow text-muted">{p.brandName}</span>
        <h3 className={`mt-1 font-medium leading-snug ${size === 'lg' ? 'text-[18px]' : 'text-[15px]'}`}>
          <Link href={`/product/${p.slug}`} className="hover:text-orange">
            {p.name}
          </Link>
        </h3>
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <span className="mono text-[14px] font-semibold">{formatPrice(p.price)}</span>
          {p.colors.length > 1 && (
            <div className="flex gap-1" role="radiogroup" aria-label="Colour">
              {p.colors.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={c.id === color}
                  aria-label={c.name}
                  onClick={() => setColor(c.id)}
                  className={`h-5 w-5 rounded-full border transition-transform ${c.id === color ? 'scale-110 border-ink' : 'border-line'}`}
                  style={{ background: `linear-gradient(135deg, ${c.swatch[0]} 50%, ${c.swatch[1] ?? c.swatch[0]} 50%)` }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
