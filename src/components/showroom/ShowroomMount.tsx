'use client';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import type { ShowItem } from './Showroom';

const Showroom = dynamic(() => import('./Showroom'), {
  ssr: false,
  loading: () => <div className="h-[74svh] w-full animate-pulse bg-[#F3F1EC] md:h-[86vh]" />,
});

/** Loads the 3D showroom only when WebGL is available; otherwise the listing carries the page. */
export function ShowroomMount({ items, mount }: { items: ShowItem[]; mount: 'wall' | 'hooks' | 'plinths' }) {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    try {
      const c = document.createElement('canvas');
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOk(!!(c.getContext('webgl2') ?? c.getContext('webgl')));
    } catch {
      setOk(false);
    }
  }, []);
  if (ok === false) return null;
  if (ok === null) return <div className="h-[74svh] w-full bg-[#F3F1EC] md:h-[86vh]" />;
  return (
    <section aria-label="3D showroom" className="relative">
      <Showroom items={items} mount={mount} />
      <a href="#listing" className="sr-only-focusable absolute left-4 top-12 z-10 bg-ink px-3 py-2 text-white">
        Skip to product list
      </a>
    </section>
  );
}
