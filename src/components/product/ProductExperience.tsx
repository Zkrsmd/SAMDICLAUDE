'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { ProductImage } from './ProductImage';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { QuickBuy } from '@/components/checkout/QuickBuy';
import type { CheckoutWilaya } from '@/components/checkout/CodCheckout';
import { useCart } from '@/stores/cart';
import { useRecent, useWishlist } from '@/stores/lists';
import { useTransitionStore, useUi } from '@/stores/ui';
import { useHydrated, useReducedMotion } from '@/hooks/useHydrated';
import { useDialog } from '@/hooks/useDialog';
import { formatPrice, renderUrl } from '@/lib/format';
import type { Product } from '@/types/catalog';
import { useT } from '@/i18n/client';

/** the cut-out's resting pose: a slight tilt, like it's placed on display */
const POSE = 'rotate(-6deg)';

export function ProductExperience({
  product,
  brandName,
  sportName,
  subName,
  checkout,
}: {
  product: Product;
  brandName: string;
  sportName: string;
  subName: string;
  /** the order form on the page: delivery prices per wilaya, the courier, when we call */
  checkout: { wilayas: CheckoutWilaya[]; courier: string; confirmCall: string };
}) {
  const t = useT();
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
  const purchase = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const shown = useRef<HTMLButtonElement>(null);
  const tilt = useRef<HTMLDivElement>(null);
  const inspectRef = useRef<HTMLDivElement>(null);
  const zoomImg = useRef<HTMLImageElement>(null);
  useDialog(inspectRef, inspect, () => setInspect(false));

  useEffect(() => {
    pushRecent(product.slug);
    setPending(null);
    const wanted = new URLSearchParams(window.location.search).get('color');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (wanted && product.colors.some((c) => c.id === wanted)) setColorId(wanted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.slug]);

  // the slim purchase bar (phones) shows once the purchase box has scrolled away above
  useEffect(() => {
    const box = purchase.current;
    if (!box) return;
    const io = new IntersectionObserver(([e]) => setBarOn(!!e && !e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(box);
    return () => io.disconnect();
  }, []);

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

  /** the order form asks for this before ordering */
  const ensureSize = () => {
    if (size) return true;
    setError(t('Please choose a size.'));
    document.querySelector<HTMLInputElement>('input[name="pdp-size"]')?.focus();
    return false;
  };

  const addToCart = (buyNow = false) => {
    if (!size) {
      setError(t('Please choose a size.'));
      document.querySelector<HTMLInputElement>('input[name="pdp-size"]')?.focus();
      return false;
    }
    setError(null);
    add({ productId: product.slug, colorId, size, qty });
    const rect = shown.current?.getBoundingClientRect();
    setUi({ flyFrom: { x: rect ? rect.left + rect.width / 2 : window.innerWidth / 2, y: rect ? rect.top + rect.height / 2 : window.innerHeight / 2, src: images[0]! } });
    setAdded(true);
    if (buyNow) router.push('/checkout');
    return true;
  };

  return (
    <div className="lg:grid lg:grid-cols-[1.15fr_1fr]">
      {/* ------------------------------ exhibit ------------------------------ */}
      <div className="relative lg:order-1">
        <div
          ref={stage}
          className="pdp-stage relative overflow-hidden lg:sticky lg:top-0"
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
          <div aria-hidden className="pdp-glow pointer-events-none absolute left-1/2 top-[48%] h-[60vmin] w-[60vmin] -translate-x-1/2 -translate-y-1/2 rounded-full" />

          <button
            ref={shown}
            data-pdp-hero={product.slug}
            style={{ viewTransitionName: 'pdp-hero' }}
            type="button"
            onClick={() => setInspect(true)}
            aria-label={t('Zoom into the product photo')}
            className="absolute inset-x-[8%] top-[16%] bottom-[11%] cursor-zoom-in lg:inset-x-[8%] lg:bottom-[12%] lg:top-[14%]"
          >
            <div ref={tilt} className="h-full w-full transition-transform duration-300 ease-out [transform-style:preserve-3d]">
              <div
                className="h-full w-full"
                style={{ transform: reduced ? undefined : POSE }}
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
          <span aria-hidden className="absolute bottom-[8%] left-1/2 h-6 w-[40%] -translate-x-1/2 rounded-[50%] bg-ink/15 blur-xl lg:bottom-[9%]" />

          {/* photo switcher */}
          {images.length > 1 && (
            <div className="absolute end-3 top-[84px] flex flex-col gap-2 lg:end-6 lg:top-[100px]" role="group" aria-label={t('Product photos')}>
              {images.map((src, i) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setView(i)}
                  aria-label={t('Photo {n}', { n: i + 1 })}
                  aria-pressed={i === view}
                  className={`glass relative h-16 w-16 overflow-hidden rounded-xl p-1.5 transition-all ${i === view ? 'ring-2 ring-ink' : 'opacity-70 hover:opacity-100'}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-full w-full object-contain" draggable={false} />
                </button>
              ))}
            </div>
          )}
          <p className="eyebrow pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-ink/60 lg:bottom-6">
            {images.length > 1 ? t('Swipe for more · tap to zoom') : t('Tap to zoom')}
          </p>
        </div>
      </div>

      {/* ------------------------------ info + purchase ------------------------------ */}
      <div className="relative z-10 bg-bg lg:order-2">
        <div className="pdp-build container-x lg:px-10 lg:pb-16 lg:pt-24">
          <div className="pt-8 lg:pt-0">
            <Breadcrumbs label={t('Breadcrumb')}
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
                <s className="mono text-[15px] text-muted" aria-label={t('Was {price}', { price: formatPrice(product.compareAt) })}>
                  {formatPrice(product.compareAt)}
                </s>
              ) : null}
              {avail !== 'in' ? (
                <span className="eyebrow rounded-[2px] border border-line px-2 py-1 text-[10px] text-muted">{avail === 'soon' ? t('Coming soon') : t('Out of stock')}</span>
              ) : product.verified ? (
                <span className="eyebrow rounded-[2px] bg-ink px-2 py-1 text-[10px] text-white">{t('Model verified')}</span>
              ) : null}
            </div>
          </div>

          {/* straight to choosing: colour, size, then add to bag or order */}
          <div ref={purchase} className="pdp-buy mt-6">
            <fieldset>
              <legend className="eyebrow text-muted">
                {t('Colour')} — <span className="text-ink">{t(color.name)}</span>
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
              <legend className="eyebrow text-muted">{t('Size')} {size ? <span className="text-ink">— {size}</span> : null}</legend>
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
                      {product.stock && (product.stock[s] ?? 0) <= 0 ? <span className="sr-only"> {t('(sold out)')}</span> : null}
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
                    {avail === 'soon' ? t('Coming soon') : t('Out of stock')}
                  </p>
                  <button
                    type="button"
                    className="grid h-12 w-12 place-items-center rounded-full border border-line bg-white"
                    aria-pressed={hydrated ? wished : false}
                    aria-label={t('Save to wishlist')}
                    onClick={() => toggleWish(product.slug)}
                  >
                    <Icon name={hydrated && wished ? 'heart-fill' : 'heart'} size={20} className={hydrated && wished ? 'text-cobalt' : ''} />
                  </button>
                </div>
                <p className="mt-3 text-[14px] text-muted">
                  {avail === 'soon'
                    ? t('This product arrives soon and can’t be ordered yet. Save it to your wishlist to find it again.')
                    : t('Sold out for now. Save it to your wishlist to find it again when it’s back.')}
                </p>
              </div>
            ) : (
            <>
            <div className="mt-6 flex items-center gap-3">
              <div className="flex items-center rounded-full border border-line bg-white" role="group" aria-label={t('Quantity')}>
                <button type="button" className="grid h-12 w-11 place-items-center disabled:opacity-30" aria-label={t('Decrease quantity')} disabled={qty <= 1} onClick={() => setQty((q) => q - 1)}>
                  <Icon name="minus" size={16} />
                </button>
                <span className="mono w-8 text-center" aria-live="polite">
                  {qty}
                </span>
                <button type="button" className="grid h-12 w-11 place-items-center disabled:opacity-30" aria-label={t('Increase quantity')} disabled={qty >= 10} onClick={() => setQty((q) => q + 1)}>
                  <Icon name="plus" size={16} />
                </button>
              </div>
              <button type="button" className="pdp-add h-12 flex-1" onClick={() => addToCart()}>
                <Icon name="bag" size={16} />
                {t('Add to bag')}
              </button>
              <button
                type="button"
                className="grid h-12 w-12 place-items-center rounded-full border border-line bg-white"
                aria-pressed={hydrated ? wished : false}
                aria-label={t('Save to wishlist')}
                onClick={() => toggleWish(product.slug)}
              >
                <Icon name={hydrated && wished ? 'heart-fill' : 'heart'} size={20} className={hydrated && wished ? 'text-cobalt' : ''} />
              </button>
            </div>
            <QuickBuy
              productId={product.slug}
              colorId={colorId}
              size={size}
              qty={qty}
              unitPrice={product.price}
              wilayas={checkout.wilayas}
              courier={checkout.courier}
              confirmCall={checkout.confirmCall}
              ensureSize={ensureSize}
            />
            </>
            )}
            {added && (
              <p className="mt-3 text-[14px]" role="status">
                {t('Added to your bag.')}{' '}
                <button type="button" className="underline" onClick={() => setUi({ cartOpen: true })}>
                  {t('View bag')}
                </button>
              </p>
            )}
          </div>

          <section className="mt-10 pb-6">
            <p className="max-w-prose text-[16px] text-ink-2">{product.description}</p>
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
            <span className="eyebrow rounded-full border border-line px-4 py-3 text-muted">{avail === 'soon' ? t('Coming soon') : t('Out of stock')}</span>
          ) : (
            <button
              type="button"
              className="btn btn-ink h-11 px-4"
              onClick={() => {
                if (!addToCart()) purchase.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
            >
              {t('Add to bag')}
            </button>
          )}
        </div>
      </div>

      {inspect && (
        <div
          ref={inspectRef}
          role="dialog"
          aria-modal="true"
          aria-label={t('Zoomed product photo')}
          className="fixed inset-0 z-[90] cursor-zoom-out overflow-hidden bg-[#F4F2EC]"
          onClick={() => setInspect(false)}
          onPointerMove={(e) => {
            if (!zoomImg.current) return;
            zoomImg.current.style.transformOrigin = `${(e.clientX / window.innerWidth) * 100}% ${(e.clientY / window.innerHeight) * 100}%`;
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img ref={zoomImg} src={images[view]} alt={t('{name}, enlarged', { name: `${brandName} ${product.name}` })} className="h-full w-full scale-[1.9] object-contain p-6 transition-transform duration-200" draggable={false} />
          <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4" style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
            <p className="eyebrow text-muted">{t('Move to explore · tap to close')}</p>
            <button type="button" className="btn btn-ink h-11 px-4" onClick={() => setInspect(false)} autoFocus>
              {t('Close')} <Icon name="close" size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
