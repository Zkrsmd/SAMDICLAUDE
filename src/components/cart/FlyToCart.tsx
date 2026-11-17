'use client';
import { useEffect, useRef } from 'react';
import { useUi } from '@/stores/ui';

/** Flies the product render from its on-screen position into the header bag icon. */
export function FlyToCart() {
  const flyFrom = useUi((s) => s.flyFrom);
  const set = useUi((s) => s.set);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!flyFrom || !imgRef.current) return;
    const img = imgRef.current;
    const target = document.getElementById('cart-button')?.getBoundingClientRect();
    if (!target || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      set({ flyFrom: null });
      return;
    }
    img.src = flyFrom.src;
    const tx = target.left + target.width / 2 - flyFrom.x;
    const ty = target.top + target.height / 2 - flyFrom.y;
    const anim = img.animate(
      [
        { transform: `translate(${flyFrom.x - 80}px, ${flyFrom.y - 80}px) scale(1) rotate(0deg)`, opacity: 1 },
        {
          transform: `translate(${flyFrom.x - 80 + tx * 0.45}px, ${flyFrom.y - 80 + ty * 0.2 - 120}px) scale(0.7) rotate(-18deg)`,
          opacity: 1,
          offset: 0.45,
        },
        { transform: `translate(${flyFrom.x - 80 + tx}px, ${flyFrom.y - 80 + ty}px) scale(0.1) rotate(-30deg)`, opacity: 0.4 },
      ],
      { duration: 900, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'forwards' },
    );
    anim.onfinish = () => {
      set({ flyFrom: null });
      const btn = document.getElementById('cart-button');
      btn?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }], {
        duration: 420,
        easing: 'cubic-bezier(.2,1.6,.4,1)',
      });
    };
    return () => anim.cancel();
  }, [flyFrom, set]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={imgRef}
      alt=""
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[90] h-40 w-40 object-contain"
      style={{ display: flyFrom ? 'block' : 'none' }}
    />
  );
}
