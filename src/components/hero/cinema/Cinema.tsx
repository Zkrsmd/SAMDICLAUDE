'use client';
import { useEffect, useRef } from 'react';
import { renderUrl } from '@/lib/format';
import { clamp, ease, noise1 } from './core';
import { SCENES, type Frame, type Scene } from './scenes';

/** delay before an incoming film starts, while the whip-pan covers the cut */
export const CUT_DELAY = 0.38;

interface Run {
  id: string;
  start: number;
}

/**
 * Canvas "projector" for the coded hero films. One rAF loop, DPR-capped, paused offscreen and
 * when the tab is hidden. Slide changes whip-pan the old film out and start the new one.
 * Camera shake is mirrored to CSS variables (--shx/--shy) so the DOM word shakes with the shot.
 */
export function Cinema({
  ids,
  index,
  dir,
  ready,
  reduced,
  stage,
  timecode,
}: {
  ids: string[];
  index: number;
  dir: 1 | -1;
  ready: boolean;
  reduced: boolean;
  stage: React.RefObject<HTMLDivElement | null>;
  timecode?: React.RefObject<HTMLSpanElement | null>;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const s = useRef({
    cur: null as Run | null,
    prev: null as Run | null,
    cutAt: -1,
    dir: 1 as 1 | -1,
    index: -1,
    reduced,
    dirty: true,
  });

  // slide changes and the first start
  useEffect(() => {
    const st = s.current;
    st.reduced = reduced;
    st.dirty = true;
    if (!ready) return;
    const now = performance.now();
    if (st.index === -1 || !st.cur) {
      st.cur = { id: ids[index]!, start: now };
    } else if (st.index !== index) {
      st.prev = st.cur;
      st.cutAt = now;
      st.dir = dir;
      st.cur = { id: ids[index]!, start: now + CUT_DELAY * 1000 };
    }
    st.index = index;
  }, [ids, index, dir, ready, reduced]);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const st = s.current;

    // load every film's cut-outs
    const imgs = new Map<string, HTMLImageElement>();
    for (const id of ids) {
      const sc = SCENES[id];
      if (!sc) continue;
      for (const [key, slug] of Object.entries(sc.assets)) {
        const im = new Image();
        im.decoding = 'async';
        im.onload = () => (st.dirty = true);
        im.src = renderUrl(slug);
        imgs.set(`${id}:${key}`, im);
      }
    }

    let w = 0;
    let h = 0;
    let dpr = 1;
    let layout = { ax: 0, ay: 0, u: 1 };
    const resize = () => {
      w = c.clientWidth;
      h = c.clientHeight;
      dpr = Math.min(window.devicePixelRatio || 1, w < 768 ? 2 : 1.5);
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      if (w < 768) layout = { ax: w * 0.5, ay: h * 0.47, u: Math.min(w, h * 0.6) / 100 };
      else if (w < 1100) layout = { ax: w * 0.58, ay: h * 0.5, u: Math.min(w * 0.6, h * 0.68) / 100 };
      else layout = { ax: w * 0.64, ay: h * 0.52, u: Math.min(w * 0.42, h * 0.7) / 100 };
      st.dirty = true;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(c);

    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = !!e?.isIntersecting));
    io.observe(c);
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      pointer.tx = e.clientX / window.innerWidth - 0.5;
      pointer.ty = e.clientY / window.innerHeight - 0.5;
    };
    window.addEventListener('pointermove', onMove, { passive: true });

    const film = (run: Run, t: number, out: number) => {
      const scene: Scene | undefined = SCENES[run.id];
      if (!scene || t < 0) return { shx: 0, shy: 0, flash: 0 };
      const f: Frame = { ctx, w, h, u: layout.u, ax: layout.ax, ay: layout.ay, t, img: (k) => imgs.get(`${run.id}:${k}`) };
      const cam = scene.camera(t, f);
      const amp = cam.shake * layout.u;
      const shx = noise1(t * 17, 1) * amp;
      const shy = noise1(t * 17, 9) * amp;
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.scale(cam.zoom, cam.zoom);
      ctx.rotate(cam.rot);
      ctx.translate(
        -w / 2 + cam.x * layout.u + shx - pointer.x * 22 - out * st.dir * w * 0.95,
        -h / 2 + cam.y * layout.u + shy - pointer.y * 14,
      );
      scene.draw(f);
      ctx.restore();
      return { shx, shy, flash: cam.flash };
    };

    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (!visible || document.hidden) return;
      if (st.reduced && !st.dirty) return;
      st.dirty = false;
      const now = performance.now();
      pointer.x += (pointer.tx - pointer.x) * 0.06;
      pointer.y += (pointer.ty - pointer.y) * 0.06;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (!st.cur) return;

      const cutK = st.cutAt > 0 ? (now - st.cutAt) / 1000 : 9;
      if (st.prev && cutK < 0.5 && !st.reduced) film(st.prev, (now - st.prev.start) / 1000, ease.inExpo(clamp(cutK / 0.42)));
      else st.prev = null;

      const scene = SCENES[st.cur.id];
      // dev-only: freeze the film at a given second for frame-by-frame QA (window.__heroT = 0.7)
      const frozen = process.env.NODE_ENV !== 'production' ? (window as Window & { __heroT?: number }).__heroT : undefined;
      const t = st.reduced ? (scene?.intro ?? 3) + 0.01 : typeof frozen === 'number' ? frozen : (now - st.cur.start) / 1000;
      const r = film(st.cur, t, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (r.flash > 0.01) {
        ctx.fillStyle = `rgba(255,255,255,${r.flash})`;
        ctx.fillRect(0, 0, w, h);
      }
      // whip-pan between films: light smear bands racing across
      if (!st.reduced && cutK < 0.7) {
        const k = clamp(cutK / 0.7);
        const a = Math.sin(Math.PI * k);
        ctx.fillStyle = `rgba(250,250,247,${a * 0.55})`;
        ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 7; i++) {
          const y = ((i * 0.37 + 0.11) % 1) * h;
          const bh = (0.02 + ((i * 0.13) % 0.06)) * h;
          const x = (st.dir > 0 ? 1 - k * 1.6 : -0.6 + k * 1.6) * w + ((i * 0.23) % 0.4) * w * st.dir;
          const g = ctx.createLinearGradient(x - w * 0.5, 0, x + w * 0.5, 0);
          g.addColorStop(0, 'rgba(255,255,255,0)');
          g.addColorStop(0.5, `rgba(255,255,255,${a * 0.9})`);
          g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = g;
          ctx.fillRect(x - w * 0.5, y, w, bh);
        }
      }
      const el = stage.current;
      if (el) {
        el.style.setProperty('--shx', `${r.shx.toFixed(2)}px`);
        el.style.setProperty('--shy', `${r.shy.toFixed(2)}px`);
      }
      if (timecode?.current && t >= 0) {
        const fr = Math.floor(t * 24);
        timecode.current.textContent = `00:${String(Math.floor(fr / 24 / 60) % 60).padStart(2, '0')}:${String(Math.floor(fr / 24) % 60).padStart(2, '0')}:${String(fr % 24).padStart(2, '0')}`;
      }
    };
    raf = requestAnimationFrame(frame);
    const onVis = () => (st.dirty = true);
    document.addEventListener('visibilitychange', onVis);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('visibilitychange', onVis);
      imgs.forEach((im) => (im.onload = null));
    };
  }, [ids, stage, timecode]);

  return <canvas ref={canvas} aria-hidden className="pointer-events-none absolute inset-0 z-[5] h-full w-full" />;
}

/** every cut-out the hero films use (for the loader to preload) */
export const filmAssets = (ids: string[]) => ids.flatMap((id) => Object.values(SCENES[id]?.assets ?? {}).map((slug) => renderUrl(slug)));
