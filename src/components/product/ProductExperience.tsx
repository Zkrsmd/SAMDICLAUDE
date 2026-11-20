'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { HoloEdge } from '@/components/ui/HoloEdge';
import { ProductImage } from './ProductImage';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { useCart } from '@/stores/cart';
import { useRecent, useWishlist } from '@/stores/lists';
import { useTransitionStore, useUi } from '@/stores/ui';
import { useHydrated, useReducedMotion } from '@/hooks/useHydrated';
import { useDialog } from '@/hooks/useDialog';
import { formatPrice, renderUrl } from '@/lib/format';
import { useScrollAssist } from '@/hooks/useScrollAssist';
import type { Product } from '@/types/catalog';

/** Per-chapter pose of the floating cut-out (rotation in deg, scale). */
const POSES = [
  { r: -8, s: 1 },
  { r: 6, s: 1.12 },
  { r: -14, s: 0.96 },
  { r: 2, s: 1.2 },
];

export function ProductExperience({
  product,
  brandName,
  sportName,
  subName,
}: {
  product: Product;
  brandName: string;
  sportName: string;
  subName: string;
}) {
  const router = useRouter();
  const hydrated = useHydrated();
  const reduced = useReducedMotion();
  const [colorId, setColorId] = useState(product.colors[0]!.id);
  const [size, setSize] = useState<string | null>(product.sizes.length === 1 ? product.sizes[0]! : null);
  const [qty, setQty] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const [view, setView] = useState(0);
  const [inspect, setInspect] = useState(false);
  const [chapter, setChapter] = useState(0);
  const [barOn, setBarOn] = useState(false);
  const add = useCart((s) => s.add);
  const pushRecent = useRecent((s) => s.push);
  const wished = useWishlist((s) => s.slugs.includes(product.slug));
  const toggleWish = useWishlist((s) => s.toggle);
  const setUi = useUi((s) => s.set);
  const setPending = useTransitionStore((s) => s.setPending);
  const color = product.colors.find((c) => c.id === colorId)!;
  // coming soon (admin switch) wins over stock; out of stock = every size at 0
  const avail: 'in' | 'out' | 'soon' = product.comingSoon
    ? 'soon'
    : product.stock && product.sizes.every((s) => (product.stock?.[s] ?? 0) <= 0)
      ? 'out'
      : 'in';
  const images = product.images?.length ? product.images : [renderUrl(product.slug)];
  const exhibit = useRef<HTMLDivElement>(null);
  const purchase = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const shown = useRef<HTMLButtonElement>(null);
  const flyer = useRef<HTMLDivElement>(null);
  const slotImg = useRef<HTMLDivElement>(null);
  /** resting points for the scroll assist: each chapter, then the product landed in the tray */
  const rest = useRef<number[] | null>(null);
  const tilt = useRef<HTMLDivElement>(null);
  const imgSlot = useRef<HTMLDivElement>(null);
  const inspectRef = useRef<HTMLDivElement>(null);
  const zoomImg = useRef<HTMLImageElement>(null);
  useDialog(inspectRef, inspect, () => setInspect(false));

  const chapters = [
    { title: 'The silhouette', text: product.short },
    ...product.features.slice(0, 3).map((f, i) => ({ title: ['Built in', 'Made to', 'Finished with'][i] ?? 'Detail', text: f })),
  ].slice(0, 4);
  const pose = POSES[chapter % POSES.length]!;

  useEffect(() => {
    pushRecent(product.slug);
    setPending(null);
    const wanted = new URLSearchParams(window.location.search).get('color');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (wanted && product.colors.some((c) => c.id === wanted)) setColorId(wanted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.slug]);

  // scroll choreography: chapters re-pose the product; on phones the end of the exhibit drops the
  // product out of the viewer and into the purchase tray — one continuous fall, scrubbed by scroll
  // (the photo never fades out: the same picture travels from the stage to the tray and back)
  useEffect(() => {
    const clamp = (v: number) => Math.min(1, Math.max(0, v));
    const fall = (q: number) => (q < 0.8 ? (q / 0.8) ** 2 : 1 - 0.06 * Math.sin((Math.PI * (q - 0.8)) / 0.2));
    const onScroll = () => {
      const el = exhibit.current;
      if (!el) return;
      const vh = window.innerHeight;
      const r = el.getBoundingClientRect();
      const span = Math.max(1, r.height - vh);
      const p = clamp(-r.top / span);
      {
        const top = r.top + window.scrollY;
        const n = chapters.length;
        const pts = Array.from({ length: n }, (_, i) => top + (span * i) / (n * 1.05));
        const slot = imgSlot.current?.getBoundingClientRect();
        const mobileDrop = window.innerWidth < 1024 && slot && slot.height > 0;
        pts.push(mobileDrop ? slot.top + window.scrollY + slot.height / 2 - vh * 0.58 : top + span);
        rest.current = pts;
      }
      setChapter(Math.min(chapters.length - 1, Math.floor(p * chapters.length * 1.05)));
      const pr = purchase.current?.getBoundingClientRect();
      if (pr) setBarOn(pr.bottom < 0);

      const src = shown.current;
      const dst = imgSlot.current;
      const f = flyer.current;
      const si = slotImg.current;
      if (!src || !dst || !f || !si) return;
      const mobile = window.innerWidth < 1024 && !reduced;
      if (!mobile) {
        f.style.visibility = 'hidden';
        src.style.opacity = '';
        si.style.opacity = '1';
        return;
      }
      const d = dst.getBoundingClientRect();
      // from 80% through the exhibit until the tray sits a little above the middle of the screen
      const y = window.scrollY;
      const start = r.top + y + span * 0.8;
      const end = d.top + y + d.height / 2 - vh * 0.58;
      const q = clamp((y - start) / Math.max(1, end - start));
      if (q <= 0 || q >= 1) {
        f.style.visibility = 'hidden';
        src.style.opacity = q >= 1 ? '0' : '';
        si.style.opacity = q >= 1 ? '1' : '0';
        si.classList.toggle('is-landed', q >= 1);
        dst.style.setProperty('--near', q >= 1 ? '1' : '0');
        return;
      }
      const s = src.getBoundingClientRect();
      const sm = (a: number, b: number, t: number) => {
        const x = clamp((t - a) / (b - a));
        return x * x * (3 - 2 * x);
      };
      const e = sm(0, 1, q);
      const k = fall(q);
      const w = s.width + (d.width - s.width) * e;
      const h = s.height + (d.height - s.height) * e;
      const cx = s.left + s.width / 2 + (d.left + d.width / 2 - (s.left + s.width / 2)) * e;
      // anticipation: it lifts a touch before it lets go
      const lift = sm(0, 0.14, q) * (1 - sm(0.14, 0.34, q));
      const cy = s.top + s.height / 2 + (d.top + d.height / 2 - (s.top + s.height / 2)) * k - lift * 28;
      // stretch with speed on the way down, squash on impact, settle
      const stretch = 0.07 * sm(0.3, 0.62, q) * (1 - sm(0.7, 0.8, q));
      const squash = q > 0.8 ? 0.1 * Math.sin(clamp((q - 0.8) / 0.14) * Math.PI) : 0;
      const sx = (1 + lift * 0.04) * (1 - stretch * 0.6 + squash);
      const sy = (1 + lift * 0.04) * (1 + stretch - squash);
      const rot = -18 * Math.sin(clamp(q / 0.82) * Math.PI) + lift * 4;
      src.style.opacity = '0';
      si.style.opacity = '0';
      si.classList.remove('is-landed');
      dst.style.setProperty('--near', sm(0.45, 0.95, q).toFixed(3));
      f.style.visibility = 'visible';
      f.style.width = `${w.toFixed(1)}px`;
      f.style.height = `${h.toFixed(1)}px`;
      f.style.transform = `translate3d(${(cx - w / 2).toFixed(1)}px, ${(cy - h / 2).toFixed(1)}px, 0) rotate(${rot.toFixed(2)}deg) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [chapters.length, reduced]);

  // mouse tilt (desktop) and horizontal swipe between photos (touch); vertical scroll stays native
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    let sx = 0;
    let sy = 0;
    let lock: 'h' | 'v' | null = null;
    let down = false;
    const move = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && tilt.current && !reduced) {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        tilt.current.style.transform = `perspective(1200px) rotateY(${x * 22}deg) rotateX(${-y * 16}deg)`;
        el.style.setProperty('--gx', `${(x + 0.5) * 100}%`);
        el.style.setProperty('--gy', `${(y + 0.5) * 100}%`);
      }
      if (!down || lock) return;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      if (Math.hypot(dx, dy) > 10) {
        lock = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'h' : 'v';
        if (lock === 'h') setView((v) => (v + (dx < 0 ? 1 : -1) + images.length) % images.length);
      }
    };
    const leave = () => {
      if (tilt.current) tilt.current.style.transform = '';
    };
    const pd = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return;
      down = true;
      lock = null;
      sx = e.clientX;
      sy = e.clientY;
    };
    const pu = () => {
      down = false;
    };
    el.addEventListener('pointermove', move, { passive: true });
    el.addEventListener('pointerleave', leave);
    el.addEventListener('pointerdown', pd);
    window.addEventListener('pointerup', pu);
    return () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', leave);
      el.removeEventListener('pointerdown', pd);
      window.removeEventListener('pointerup', pu);
    };
  }, [images.length, reduced]);

  // a small scroll moves to the next chapter / finishes the drop instead of stopping half-way
  useScrollAssist(() => rest.current);

  const addToCart = (buyNow = false) => {
    if (!size) {
      setError('Please choose a size.');
      document.querySelector<HTMLInputElement>('input[name="pdp-size"]')?.focus();
      return false;
    }
    setError(null);
    add({ productId: product.slug, colorId, size, qty });
    const rect = imgSlot.current?.getBoundingClientRect();
    setUi({ flyFrom: { x: rect ? rect.left + rect.width / 2 : window.innerWidth / 2, y: rect ? rect.top + rect.height / 2 : window.innerHeight / 2, src: images[0]! } });
    setAdded(true);
    if (buyNow) router.push('/checkout');
    return true;
  };

  return (
    <div className="lg:grid lg:grid-cols-[1.15fr_1fr]">
      {/* ------------------------------ exhibit ------------------------------ */}
      <div ref={exhibit} className="pdp-exhibit relative lg:order-1" style={{ ['--exh' as string]: `calc(100svh + ${chapters.length * 55}svh)` }}>
        <div
          ref={stage}
          className="sticky top-0 h-[100svh] overflow-hidden"
          style={{
            touchAction: 'pan-y',
            background:
              'radial-gradient(500px circle at var(--gx, 50%) var(--gy, 40%), rgba(255,255,255,1), transparent 70%), radial-gradient(90% 60% at 50% 45%, #FFFFFF, #ECE9E1 75%)',
          }}
        >
          {/* brand word as architecture behind the product */}
          <div aria-hidden className="pdp-word display pointer-events-none absolute inset-x-0 top-[22%] select-none text-center text-[30vw] leading-none text-ink/[0.05] lg:text-[17vw]">
            {brandName}
          </div>
          <div aria-hidden className="pointer-events-none absolute left-1/2 top-[48%] h-[46vmin] w-[46vmin] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-40 blur-3xl" style={{ background: 'var(--holo-conic)', animation: reduced ? undefined : 'spin-a 9s linear infinite' }} />

          <button
            ref={shown}
            data-pdp-hero={product.slug}
            style={{ viewTransitionName: 'pdp-hero' }}
            type="button"
            onClick={() => setInspect(true)}
            aria-label="Zoom into the product photo"
            className="absolute inset-x-[6%] top-[13%] bottom-[24svh] cursor-zoom-in lg:inset-x-[8%] lg:bottom-[12%] lg:top-[14%]"
          >
            <div ref={tilt} className="h-full w-full transition-transform duration-300 ease-out [transform-style:preserve-3d]">
              <div
                className="h-full w-full transition-transform duration-[900ms] ease-[var(--ease-expo)]"
                style={{ transform: reduced ? undefined : `rotate(${pose.r}deg) scale(${pose.s})` }}
              >
                {images.map((src, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={src}
                    src={src}
                    alt={i === view ? `${brandName} ${product.name}${i ? ` — view ${i + 1}` : ''}` : ''}
                    draggable={false}
                    className={`absolute inset-0 h-full w-full object-contain transition-[opacity,transform,filter] duration-700 ease-[var(--ease-expo)] ${i === view ? 'float-product opacity-100' : 'scale-90 opacity-0'}`}
                  />
                ))}
              </div>
            </div>
          </button>
          <span aria-hidden className="absolute bottom-[22svh] left-1/2 h-6 w-[40%] -translate-x-1/2 rounded-[50%] bg-ink/15 blur-xl lg:bottom-[9%]" />

          {/* chapter caption (mobile) */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[18svh] px-4 lg:hidden">
            <div key={chapter} className="glass rounded-2xl p-3" style={{ animation: 'rise-in .6s var(--ease-expo) both' }}>
              <p className="eyebrow text-muted">
                {String(chapter + 1).padStart(2, '0')} / {String(chapters.length).padStart(2, '0')} · {chapters[chapter]?.title}
              </p>
              <p className="mt-1 line-clamp-2 text-[15px] font-medium leading-snug">{chapters[chapter]?.text}</p>
            </div>
          </div>

          {/* photo switcher */}
          {images.length > 1 && (
            <div className="absolute right-3 top-[84px] flex flex-col gap-2 lg:right-6 lg:top-[100px]" role="group" aria-label="Product photos">
              {images.map((src, i) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setView(i)}
                  aria-label={`Photo ${i + 1}`}
                  aria-pressed={i === view}
                  className={`glass relative h-16 w-16 overflow-hidden rounded-xl p-1.5 transition-all ${i === view ? 'ring-2 ring-ink' : 'opacity-70 hover:opacity-100'}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-full w-full object-contain" draggable={false} />
                </button>
              ))}
            </div>
          )}
          <p className="eyebrow pointer-events-none absolute bottom-[19svh] left-1/2 -translate-x-1/2 whitespace-nowrap text-ink/60 lg:bottom-6">
            {images.length > 1 ? 'Swipe for more · tap to zoom' : 'Tap to zoom'}
          </p>
        </div>
      </div>

      {/* the product in flight between the viewer and the tray (phones) */}
      <div ref={flyer} aria-hidden className="pdp-flyer" style={{ visibility: 'hidden' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={images[view] ?? images[0]} alt="" draggable={false} />
      </div>

      {/* ------------------------------ info + purchase ------------------------------ */}
      <div className="relative z-10 bg-bg lg:order-2">
        <div className="pdp-build container-x lg:px-10 lg:pb-16 lg:pt-24">
          <div className="pt-8 lg:pt-0">
            <Breadcrumbs
              items={[
                { label: sportName, href: `/${product.sport}` },
                { label: subName, href: `/${product.sport}/${product.sub}` },
                { label: product.name },
              ]}
            />
            <p className="eyebrow mt-6 text-muted">{brandName}</p>
            <h1 className="display mt-2 text-[clamp(30px,6.2vw,56px)] leading-[0.86]">{product.name}</h1>
            <div className="mt-4 flex items-center gap-3">
              <span className="mono text-[20px] font-semibold">{formatPrice(product.price)}</span>
              {product.compareAt ? (
                <s className="mono text-[15px] text-muted" aria-label={`Was ${formatPrice(product.compareAt)}`}>
                  {formatPrice(product.compareAt)}
                </s>
              ) : null}
              {product.verified ? (
                <span className="eyebrow rounded-[2px] bg-ink px-2 py-1 text-[10px] text-white">Model verified</span>
              ) : (
                <span className="eyebrow rounded-[2px] border border-line px-2 py-1 text-[10px] text-muted">Demo listing</span>
              )}
            </div>
            <p className="mt-4 max-w-prose text-[16px] text-ink-2">{product.description}</p>
          </div>

          {/* the product drops into this tray as you scroll */}
          <div ref={purchase} className="pdp-buy mt-7">
            <div ref={imgSlot} className="pdp-tray relative mx-auto -mt-1 mb-3 h-44 w-full overflow-visible lg:hidden" aria-hidden>
              <span className="pdp-tray-floor" />
              <span className="pdp-tray-shadow" />
              <div ref={slotImg} className="pdp-slot absolute inset-0" style={{ opacity: 0 }}>
                <ProductImage slug={product.slug} colorId={colorId} alt="" sizes="60vw" />
              </div>
            </div>

            <fieldset>
              <legend className="eyebrow text-muted">
                Colour — <span className="text-ink">{color.name}</span>
              </legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {product.colors.map((c) => (
                  <label key={c.id} className="cursor-pointer">
                    <input type="radio" name="pdp-colour" value={c.id} checked={c.id === colorId} onChange={() => setColorId(c.id)} className="peer sr-only" />
                    <span className="sr-only">{c.name}</span>
                    <span
                      aria-hidden
                      className={`block h-11 w-11 rounded-full border-2 p-0.5 transition-transform peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink ${
                        c.id === colorId ? 'scale-110 border-ink' : 'border-line'
                      }`}
                    >
                      <span className="block h-full w-full rounded-full" style={{ background: `conic-gradient(${c.swatch[0]} 0 50%, ${c.swatch[1] ?? c.swatch[0]} 50% 75%, ${c.swatch[2] ?? c.swatch[0]} 75%)` }} />
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="mt-6">
              <legend className="eyebrow text-muted">Size {size ? <span className="text-ink">— {size}</span> : null}</legend>
              <div id="size-group" tabIndex={-1} className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6" aria-invalid={!!error} aria-describedby={error ? 'size-error' : undefined}>
                {product.sizes.map((s) => (
                  <label key={s} className={product.stock && (product.stock[s] ?? 0) <= 0 ? 'cursor-not-allowed' : 'cursor-pointer'}>
                    <input
                      type="radio"
                      name="pdp-size"
                      value={s}
                      checked={size === s}
                      onChange={() => setSize(s)}
                      disabled={!!product.stock && (product.stock[s] ?? 0) <= 0}
                      className="peer sr-only"
                    />
                    <span
                      className="chip h-11 w-full justify-center px-1 text-[13px] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink peer-disabled:text-ink/30 peer-disabled:line-through"
                      data-active={size === s}
                    >
                      {s}
                      {product.stock && (product.stock[s] ?? 0) <= 0 ? <span className="sr-only"> (sold out)</span> : null}
                    </span>
                  </label>
                ))}
              </div>
              {error && (
                <p id="size-error" role="alert" className="mt-2 text-[14px] text-red-700">
                  {error}
                </p>
              )}
            </fieldset>

            {avail !== 'in' ? (
              <div className="mt-6" role="status">
                <div className="flex items-center gap-3">
                  <p className={`flex h-12 flex-1 items-center justify-center rounded-full text-[15px] font-semibold ${avail === 'soon' ? 'bg-ink text-white' : 'border border-line bg-white text-muted'}`}>
                    {avail === 'soon' ? 'Coming soon' : 'Out of stock'}
                  </p>
                  <button
                    type="button"
                    className="grid h-12 w-12 place-items-center rounded-full border border-line bg-white"
                    aria-pressed={hydrated ? wished : false}
                    aria-label="Save to wishlist"
                    onClick={() => toggleWish(product.slug)}
                  >
                    <Icon name={hydrated && wished ? 'heart-fill' : 'heart'} size={20} className={hydrated && wished ? 'text-cobalt' : ''} />
                  </button>
                </div>
                <p className="mt-3 text-[14px] text-muted">
                  {avail === 'soon'
                    ? 'This product arrives soon and can’t be ordered yet. Save it to your wishlist to find it again.'
                    : 'Sold out for now. Save it to your wishlist to find it again when it’s back.'}
                </p>
              </div>
            ) : (
            <>
            <div className="mt-6 flex items-center gap-3">
              <div className="flex items-center rounded-full border border-line bg-white" role="group" aria-label="Quantity">
                <button type="button" className="grid h-12 w-11 place-items-center disabled:opacity-30" aria-label="Decrease quantity" disabled={qty <= 1} onClick={() => setQty((q) => q - 1)}>
                  <Icon name="minus" size={16} />
                </button>
                <span className="mono w-8 text-center" aria-live="polite">
                  {qty}
                </span>
                <button type="button" className="grid h-12 w-11 place-items-center disabled:opacity-30" aria-label="Increase quantity" disabled={qty >= 10} onClick={() => setQty((q) => q + 1)}>
                  <Icon name="plus" size={16} />
                </button>
              </div>
              <button type="button" className="btn-holo h-12 flex-1" onClick={() => addToCart()} data-edge="">
                <HoloEdge halo={false} variant="btn" />
                Add to bag
              </button>
              <button
                type="button"
                className="grid h-12 w-12 place-items-center rounded-full border border-line bg-white"
                aria-pressed={hydrated ? wished : false}
                aria-label="Save to wishlist"
                onClick={() => toggleWish(product.slug)}
              >
                <Icon name={hydrated && wished ? 'heart-fill' : 'heart'} size={20} className={hydrated && wished ? 'text-cobalt' : ''} />
              </button>
            </div>
            <button type="button" className="btn btn-line mt-3 h-12 w-full rounded-full" onClick={() => addToCart(true)}>
              Buy now
            </button>
            </>
            )}
            {added && (
              <p className="mt-3 text-[14px]" role="status">
                Added to your bag.{' '}
                <button type="button" className="underline" onClick={() => setUi({ cartOpen: true })}>
                  View bag
                </button>
              </p>
            )}
            <dl className="mt-6 space-y-2 border-t border-line pt-4 text-[13px] text-muted">
              <div className="flex justify-between gap-4">
                <dt>Availability</dt>
                <dd className={`text-right ${avail === 'in' ? 'text-ink' : ''}`}>{avail === 'soon' ? 'Coming soon' : avail === 'out' ? 'Out of stock' : 'In stock'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Delivery</dt>
                <dd className="text-right">ZR Express to all 58 wilayas · home or stop desk</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Payment</dt>
                <dd className="text-right">Cash on delivery</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Returns</dt>
                <dd className="text-right">Returns policy placeholder</dd>
              </div>
            </dl>
          </div>

          {/* chapters on desktop scroll alongside the sticky viewer */}
          <ol className="mt-10 hidden space-y-3 lg:block">
            {chapters.map((c, i) => (
              <li key={i} className={`border-l-2 py-1 pl-4 transition-colors ${i === chapter ? 'border-ink' : 'border-line text-muted'}`}>
                <p className="eyebrow">{String(i + 1).padStart(2, '0')} · {c.title}</p>
                <p className="mt-1 text-[15px]">{c.text}</p>
              </li>
            ))}
          </ol>

          <section aria-labelledby="specs-title" className="mt-10 pb-6">
            <h2 id="specs-title" className="eyebrow text-muted">
              Specifications
            </h2>
            <dl className="mt-3 divide-y divide-line border-y border-line">
              {[...product.specs, { label: 'Brand', value: brandName }, { label: 'Category', value: `${sportName} · ${subName}` }].map((s) => (
                <div key={s.label} className="flex justify-between gap-6 py-3 text-[14px]">
                  <dt className="text-muted">{s.label}</dt>
                  <dd className="text-right">{s.value}</dd>
                </div>
              ))}
            </dl>
            {product.features.length > 0 && (
              <ul className="mt-6 space-y-2 text-[15px]">
                {product.features.map((f) => (
                  <li key={f} className="flex gap-3">
                    <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cobalt" />
                    {f}
                  </li>
                ))}
              </ul>
            )}
            {product.sourceNote && <p className="mono mt-6 text-[11px] leading-relaxed text-muted">Source: {product.sourceNote}</p>}
          </section>
        </div>
      </div>

      {/* sticky purchase bar (mobile) */}
      <div
        className={`fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 backdrop-blur transition-transform duration-500 ease-[var(--ease-expo)] lg:hidden ${
          barOn ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-hidden={!barOn}
        inert={!barOn}
      >
        <div className="container-x flex items-center gap-3 py-2.5">
          <span className="relative h-12 w-12 shrink-0 bg-stone">
            <ProductImage slug={product.slug} colorId={colorId} alt="" sizes="48px" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-medium">{product.name}</p>
            <p className="mono text-[13px]">
              {formatPrice(product.price)} {size ? `· ${size}` : ''}
            </p>
          </div>
          {avail !== 'in' ? (
            <span className="eyebrow rounded-full border border-line px-4 py-3 text-muted">{avail === 'soon' ? 'Coming soon' : 'Out of stock'}</span>
          ) : (
            <button
              type="button"
              className="btn btn-ink h-11 px-4"
              onClick={() => {
                if (!addToCart()) purchase.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
            >
              Add to bag
            </button>
          )}
        </div>
      </div>

      {inspect && (
        <div
          ref={inspectRef}
          role="dialog"
          aria-modal="true"
          aria-label="Zoomed product photo"
          className="fixed inset-0 z-[90] cursor-zoom-out overflow-hidden bg-[#F4F2EC]"
          onClick={() => setInspect(false)}
          onPointerMove={(e) => {
            if (!zoomImg.current) return;
            zoomImg.current.style.transformOrigin = `${(e.clientX / window.innerWidth) * 100}% ${(e.clientY / window.innerHeight) * 100}%`;
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img ref={zoomImg} src={images[view]} alt={`${brandName} ${product.name}, enlarged`} className="h-full w-full scale-[1.9] object-contain p-6 transition-transform duration-200" draggable={false} />
          <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4" style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
            <p className="eyebrow text-muted">Move to explore · tap to close</p>
            <button type="button" className="btn btn-ink h-11 px-4" onClick={() => setInspect(false)} autoFocus>
              Close <Icon name="close" size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
