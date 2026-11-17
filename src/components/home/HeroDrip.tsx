'use client';
import { useEffect, useRef } from 'react';

type Sport = 'football' | 'boxing' | 'swimming';

const LOOK: Record<Sport, { top: string; bottom: string; gloss: string; blades: boolean }> = {
  // the dark hero melts onto the white page like glossy ink, lit by the sport's accent
  football: { top: '#07080A', bottom: '#15171B', gloss: 'rgba(255,106,43,0.22)', blades: false },
  boxing: { top: '#07080A', bottom: '#15171B', gloss: 'rgba(231,184,90,0.25)', blades: false },
  swimming: { top: '#07080A', bottom: '#15171B', gloss: 'rgba(94,231,223,0.25)', blades: false },
};

interface Drip {
  x: number;
  w: number;
  max: number;
  phase: number;
  speed: number;
}
interface Drop {
  x: number;
  y: number;
  vy: number;
  r: number;
  life: number;
}

/**
 * The hero "drips" onto the white page as you scroll: grass for football, molten gold for
 * boxing, water for swimming. Driven by the hero's scroll progress (no scroll hijacking).
 */
export function HeroDrip({ sport }: { sport: React.RefObject<Sport> }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 0;
    let h = 0;
    let dpr = 1;
    let drips: Drip[] = [];
    const drops: Drop[] = [];
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = c.clientWidth;
      h = c.clientHeight;
      c.width = w * dpr;
      c.height = h * dpr;
      const n = Math.round(w / 26);
      drips = Array.from({ length: n }, (_, i) => ({
        x: ((i + 0.5 + (Math.random() - 0.5) * 0.7) / n) * w,
        w: 8 + Math.random() * 22,
        max: 24 + Math.pow(Math.random(), 1.8) * h * 0.52,
        phase: Math.random() * Math.PI * 2,
        speed: 0.6 + Math.random() * 0.8,
      }));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(c);
    let raf = 0;
    let last = performance.now();
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = !!e?.isIntersecting));
    io.observe(c);

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!visible) return;
      // grows as the hero's bottom edge rises into the viewport
      const top = c.getBoundingClientRect().top;
      const p = Math.min(1, Math.max(0, (window.innerHeight - top) / (window.innerHeight * 0.75)));
      const look = LOOK[sport.current ?? 'football'];
      const grow = reduced ? (p > 0.2 ? 1 : 0) : p * p * (3 - 2 * p);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (grow <= 0.001 && !drops.length) return;
      const t = now / 1000;
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, look.top);
      grad.addColorStop(1, look.bottom);
      ctx.fillStyle = grad;
      // band joining the hero edge
      const band = 10 + 10 * grow;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(w, 0);
      ctx.lineTo(w, band);
      for (let x = w; x >= 0; x -= 12) ctx.lineTo(x, band + Math.sin(x * 0.05 + t * 1.3) * 3);
      ctx.closePath();
      ctx.fill();
      for (const d of drips) {
        const wobble = reduced ? 0 : Math.sin(t * d.speed + d.phase) * 0.08;
        const L = Math.max(0, d.max * grow * (0.9 + wobble));
        if (L < 2) continue;
        const r = d.w * 0.55;
        const x = d.x + (reduced ? 0 : Math.sin(t * 0.7 + d.phase) * 1.5);
        ctx.beginPath();
        ctx.moveTo(x - d.w * 0.95, band - 1);
        ctx.bezierCurveTo(x - d.w * 0.5, band + 4, x - r * 0.75, band + L * 0.45, x - r, band + L);
        ctx.arc(x, band + L, r, Math.PI, 0, true);
        ctx.bezierCurveTo(x + r * 0.75, band + L * 0.45, x + d.w * 0.5, band + 4, x + d.w * 0.95, band - 1);
        ctx.closePath();
        ctx.fill();
        // gloss
        ctx.strokeStyle = look.gloss;
        ctx.lineWidth = Math.max(1.2, d.w * 0.12);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x - r * 0.45, band + 6);
        ctx.lineTo(x - r * 0.45, band + Math.max(6, L - r * 0.2));
        ctx.stroke();
        // detach droplets from long drips
        if (!reduced && grow > 0.8 && L > d.max * 0.85 && Math.random() < dt * 0.35) {
          drops.push({ x, y: band + L + r, vy: 20, r: r * 0.7, life: 1 });
        }
        ctx.fillStyle = grad;
      }
      if (look.blades) {
        // grass blades hanging over the edge
        ctx.strokeStyle = '#3E7F22';
        ctx.lineWidth = 1.6;
        for (let x = 4; x < w; x += 7) {
          const len = 6 + ((x * 13) % 11) * (0.6 + grow * 0.8);
          ctx.beginPath();
          ctx.moveTo(x, band - 1);
          ctx.quadraticCurveTo(x + 2, band + len * 0.6, x + 3 + Math.sin(t * 2 + x) * 1.5, band + len);
          ctx.stroke();
        }
      }
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i]!;
        d.vy += 900 * dt;
        d.y += d.vy * dt;
        d.life -= dt * 0.8;
        if (d.y > h + 20 || d.life <= 0) {
          drops.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = Math.max(0, d.life);
        ctx.beginPath();
        ctx.ellipse(d.x, d.y, d.r * 0.85, d.r * 1.15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, [sport]);

  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[46vh] w-full" />;
}
