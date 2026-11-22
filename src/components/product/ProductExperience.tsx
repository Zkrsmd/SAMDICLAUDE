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
import { useScrollAssist } from '@/hooks/useScrollAssist';
import type { Product } from '@/types/catalog';
import { useT } from '@/i18n/client';

/** Per-chapter pose of the floating cut-out (rotation in deg, scale). */
const POSES = [
  { r: -8, s: 1 },
  { r: 6, s: 1.12 },
  { r: -14, s: 0.96 },
  { r: 2, s: 1.2 },
];

/**
 * The drop on phones: the product breaks into shards that drift apart as it falls (with chrome
 * sparks flying from the cracks) and snap back together as it lands in the tray. Each shard is the
 * same picture clipped to a jagged band, so assembled they are the photo again, seamlessly.
 */
const SHARDS = 6;
const SHARDS_LITE = 4;
const SPARKS = 14;
/** jagged crack lines across the photo: [left, middle, right] heights in % (0 and 100 at the ends) */
function cracks(n: number) {
  const lines: number[][] = [[0, 0, 0]];
  for (let i = 1; i < n; i++) {
    const y = (100 * i) / n;
    const j = (i % 2 ? 1 : -1) * 4;
    lines.push([y + j, y - j * 0.6, y + j * 0.8]);
  }
  lines.push([100, 100, 100]);
  return lines;
}
function shardClip(lines: number[][], i: number) {
  const a = lines[i]!;
  const b = lines[i + 1]!;
  return `polygon(0% ${a[0]}%, 50% ${a[1]}%, 100% ${a[2]}%, 100% ${b[2]}%, 50% ${b[1]}%, 0% ${b[0]}%)`;
}
const CLIPS = { full: cracks(SHARDS), lite: cracks(SHARDS_LITE) };
/** fixed pseudo-random flight per spark (angle, reach, size) so every drop looks the same */
const SPARK = Array.from({ length: SPARKS }, (_, i) => {
  const a = (i / SPARKS) * Math.PI * 2 + (i % 3) * 0.4;
  return { x: Math.cos(a), y: Math.sin(a) * 0.8, reach: 0.55 + ((i * 37) % 10) / 22, size: 4 + ((i * 53) % 5) };
});

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
    { title: t('The silhouette'), text: product.short },
    ...product.features.slice(0, 3).map((f, i) => ({ title: t(['Built in', 'Made to', 'Finished with'][i] ?? 'Detail'), text: f })),
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
  // product out of the viewer and into the purchase tray, breaking apart mid-air and re-forming as it
  // lands — scrubbed by scroll. Built to stay at the screen's full frame rate on modest phones:
  // positions are measured once (and on resize), each frame is one rAF that only reads scrollY and
  // writes transforms/opacity (no layout, no filters, no React renders unless the chapter changes).
  useEffect(() => {
    const clamp = (v: number) => Math.min(1, Math.max(0, v));
    const sm = (a: number, b: number, t: number) => {
      const x = clamp((t - a) / (b - a));
      return x * x * (3 - 2 * x);
    };
    const fall = (q: number) => (q < 0.8 ? (q / 0.8) ** 2 : 1 - 0.06 * Math.sin((Math.PI * (q - 0.8)) / 0.2));
    const lite = (navigator.hardwareConcurrency || 8) <= 4 || ((navigator as { deviceMemory?: number }).deviceMemory ?? 8) <= 3;
    const f = flyer.current;
    f?.classList.toggle('is-lite', lite);
    const shards = f ? Array.from(f.querySelectorAll<HTMLElement>(lite ? '[data-shard="lite"]' : '[data-shard="full"]')) : [];
    const sparks = f && !lite ? Array.from(f.querySelectorAll<HTMLElement>('.pdp-spark')) : [];
    const shadow = imgSlot.current?.querySelector<HTMLElement>('.pdp-tray-shadow') ?? null;
    // decode the flying photo ahead of time, so the first frame of the drop doesn't stall on it
    f?.querySelectorAll('img').forEach((im) => void im.decode?.().catch(() => {}));

    // geometry in document coordinates, refreshed on resize / layout changes only
    let g: {
      mobile: boolean;
      vh: number;
      top: number;
      span: number;
      sx: number;
      sy: number;
      sw: number;
      sh: number;
      dx: number;
      dy: number;
      dw: number;
      dh: number;
      buyBottom: number;
    } | null = null;
    const measure = () => {
      const el = exhibit.current;
      const st = stage.current;
      const src = shown.current;
      const dst = imgSlot.current;
      if (!el || !st || !src || !dst) return;
      const y = window.scrollY;
      const vh = window.innerHeight;
      const r = el.getBoundingClientRect();
      const sr = st.getBoundingClientRect();
      const s = src.getBoundingClientRect();
      const d = dst.getBoundingClientRect();
      const pr = purchase.current?.getBoundingClientRect();
      const span = Math.max(1, r.height - vh);
      g = {
        mobile: window.innerWidth < 1024 && !reduced && d.height > 0,
        vh,
        top: r.top + y,
        span,
        // the photo's place inside the (sticky) stage
        sx: s.left - sr.left,
        sy: s.top - sr.top,
        sw: s.width,
        sh: s.height,
        dx: d.left,
        dy: d.top + y,
        dw: d.width,
        dh: d.height,
        buyBottom: pr ? pr.bottom + y : Infinity,
      };
      const n = chapters.length;
      const pts = Array.from({ length: n }, (_, i) => g!.top + (span * i) / (n * 1.05));
      pts.push(g.mobile ? g.dy + g.dh / 2 - vh * 0.58 : g.top + span);
      rest.current = pts;
      if (f) {
        f.style.width = `${g.sw}px`;
        f.style.height = `${g.sh}px`;
      }
    };

    let lastChapter = -1;
    let lastBar: boolean | null = null;
    let state: 'before' | 'flying' | 'landed' | null = null;
    const frame = () => {
      raf = 0;
      if (!g) measure();
      if (!g) return;
      const y = window.scrollY;
      const p = clamp((y - g.top) / g.span);
      const ch = Math.min(chapters.length - 1, Math.floor(p * chapters.length * 1.05));
      if (ch !== lastChapter) setChapter((lastChapter = ch));
      const bar = g.buyBottom - y < 0;
      if (bar !== lastBar) setBarOn((lastBar = bar));

      const src = shown.current;
      const si = slotImg.current;
      if (!src || !si || !f) return;
      if (!g.mobile) {
        if (state !== null) {
          f.style.visibility = 'hidden';
          src.style.opacity = '';
          si.style.opacity = '1';
          state = null;
        }
        return;
      }
      const start = g.top + g.span * 0.8;
      const end = g.dy + g.dh / 2 - g.vh * 0.58;
      const q = clamp((y - start) / Math.max(1, end - start));
      const near = sm(0.45, 0.95, q);
      if (shadow) {
        shadow.style.transform = `translateX(-50%) scale(${(0.35 + near * 0.65).toFixed(3)})`;
        shadow.style.opacity = (0.15 + near * 0.85).toFixed(3);
      }
      if (q <= 0 || q >= 1) {
        const next = q >= 1 ? 'landed' : 'before';
        if (state !== next) {
          f.style.visibility = 'hidden';
          src.style.opacity = next === 'landed' ? '0' : '';
          si.style.opacity = next === 'landed' ? '1' : '0';
          si.classList.toggle('is-landed', next === 'landed');
          state = next;
        }
        return;
      }
      if (state !== 'flying') {
        src.style.opacity = '0';
        si.style.opacity = '0';
        si.classList.remove('is-landed');
        f.style.visibility = 'visible';
        state = 'flying';
      }
      // where the photo is now (the stage is sticky, then scrolls away) and where the tray is
      const stageTop = g.top - y + Math.min(Math.max(y - g.top, 0), g.span);
      const scx = g.sx + g.sw / 2;
      const scy = stageTop + g.sy + g.sh / 2;
      const dcx = g.dx + g.dw / 2;
      const dcy = g.dy - y + g.dh / 2;
      const e = sm(0, 1, q);
      const k = fall(q);
      const scale = 1 + (Math.min(g.dw / g.sw, g.dh / g.sh) - 1) * e;
      // anticipation: it lifts a touch before it lets go
      const lift = sm(0, 0.14, q) * (1 - sm(0.14, 0.34, q));
      const cx = scx + (dcx - scx) * e;
      const cy = scy + (dcy - scy) * k - lift * 28;
      // stretch with speed on the way down, squash on impact
      const stretch = 0.07 * sm(0.3, 0.62, q) * (1 - sm(0.7, 0.8, q));
      const squash = q > 0.8 ? 0.1 * Math.sin(clamp((q - 0.8) / 0.14) * Math.PI) : 0;
      const sx = scale * (1 + lift * 0.04) * (1 - stretch * 0.6 + squash);
      const sy = scale * (1 + lift * 0.04) * (1 + stretch - squash);
      const rot = -18 * Math.sin(clamp(q / 0.82) * Math.PI) + lift * 4;
      f.style.transform = `translate3d(${cx.toFixed(1)}px, ${cy.toFixed(1)}px, 0) rotate(${rot.toFixed(2)}deg) scale(${sx.toFixed(4)}, ${sy.toFixed(4)}) translate(-50%, -50%)`;

      // the break: shards part on the way down and lock back together before the landing
      const apart = sm(0.06, 0.4, q) * (1 - sm(0.58, 0.86, q));
      const mid = (shards.length - 1) / 2;
      for (let i = 0; i < shards.length; i++) {
        const side = i % 2 ? 1 : -1;
        const tx = apart * side * (10 + Math.abs(i - mid) * 7) * (g.sw / 100);
        const ty = apart * (i - mid) * 9 * (g.sh / 160);
        const tr = apart * side * (4 + i * 1.3);
        shards[i]!.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0) rotate(${tr.toFixed(2)}deg)`;
      }
      // chrome sparks fly out of the cracks, then are pulled back in
      for (let i = 0; i < sparks.length; i++) {
        const o = SPARK[i]!;
        const out = apart * o.reach;
        const sc = apart > 0.02 ? Math.min(1, apart * 1.6) : 0;
        sparks[i]!.style.transform = `translate3d(${(o.x * out * g.sw * 0.7).toFixed(1)}px, ${(o.y * out * g.sh * 0.6).toFixed(1)}px, 0) scale(${sc.toFixed(3)})`;
      }
    };
    let raf = 0;
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };
    const onResize = () => {
      g = null;
      onScroll();
    };
    measure();
    frame();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    // the info column grows as images and fonts load: re-measure when it changes size
    const ro = new ResizeObserver(onResize);
    if (purchase.current) ro.observe(purchase.current);
    if (exhibit.current) ro.observe(exhibit.current);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
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
          <div aria-hidden className="pdp-glow pointer-events-none absolute left-1/2 top-[48%] h-[60vmin] w-[60vmin] -translate-x-1/2 -translate-y-1/2 rounded-full" />

          <button
            ref={shown}
            data-pdp-hero={product.slug}
            style={{ viewTransitionName: 'pdp-hero' }}
            type="button"
            onClick={() => setInspect(true)}
            aria-label={t('Zoom into the product photo')}
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
            <div key={chapter} className="pdp-caption rounded-2xl p-3" style={{ animation: 'rise-in .6s var(--ease-expo) both' }}>
              <p className="eyebrow text-muted">
                {String(chapter + 1).padStart(2, '0')} / {String(chapters.length).padStart(2, '0')} · {chapters[chapter]?.title}
              </p>
              <p className="mt-1 line-clamp-2 text-[15px] font-medium leading-snug">{chapters[chapter]?.text}</p>
            </div>
          </div>

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
          <p className="eyebrow pointer-events-none absolute bottom-[19svh] left-1/2 -translate-x-1/2 whitespace-nowrap text-ink/60 lg:bottom-6">
            {images.length > 1 ? t('Swipe for more · tap to zoom') : t('Tap to zoom')}
          </p>
        </div>
      </div>

      {/* the product in flight between the viewer and the tray (phones) */}
      <div ref={flyer} aria-hidden className="pdp-flyer" style={{ visibility: 'hidden' }}>
        {(['full', 'lite'] as const).map((set) =>
          CLIPS[set].slice(0, -1).map((_, i) => (
            <div key={`${set}${i}`} data-shard={set} className="pdp-shard" style={{ clipPath: shardClip(CLIPS[set], i) }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={images[view] ?? images[0]} alt="" draggable={false} />
            </div>
          )),
        )}
        {SPARK.map((o, i) => (
          <span key={i} className="pdp-spark" style={{ width: o.size, height: o.size }} />
        ))}
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
              {product.verified ? (
                <span className="eyebrow rounded-[2px] bg-ink px-2 py-1 text-[10px] text-white">{t('Model verified')}</span>
              ) : (
                <span className="eyebrow rounded-[2px] border border-line px-2 py-1 text-[10px] text-muted">{t('Coming soon')}</span>
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

          {/* chapters on desktop scroll alongside the sticky viewer */}
          <ol className="mt-10 hidden space-y-3 lg:block">
            {chapters.map((c, i) => (
              <li key={i} className={`border-s-2 py-1 ps-4 transition-colors ${i === chapter ? 'border-ink' : 'border-line text-muted'}`}>
                <p className="eyebrow">{String(i + 1).padStart(2, '0')} · {c.title}</p>
                <p className="mt-1 text-[15px]">{c.text}</p>
              </li>
            ))}
          </ol>

          <section className="mt-10 pb-6">
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
