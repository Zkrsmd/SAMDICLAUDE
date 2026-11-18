/**
 * Tiny 2D "film" toolkit for the hero: easing, seeded randomness, pre-rendered light/particle
 * sprites, closed-form particle physics (scrubbable, no per-frame state) and product drawing
 * with contact shadows, motion trails and a specular light sweep. Everything is canvas 2D.
 */

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** progress of t through [a, b] */
export const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
export const ease = {
  outExpo: (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inExpo: (t: number) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  inOutExpo: (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2),
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inCubic: (t: number) => t * t * t,
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t: number, s = 1.7) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
  outElastic: (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
};

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** smooth 1D value noise in [-1, 1] — used for handheld camera shake */
export function noise1(x: number, seed = 0) {
  const h = (n: number) => {
    const s = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453;
    return (s - Math.floor(s)) * 2 - 1;
  };
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(h(i), h(i + 1), u);
}

/* ------------------------------------------------------------------ sprites */

type Sprite = HTMLCanvasElement;
const sprites = new Map<string, Sprite>();
function sprite(key: string, size: number, paint: (c: CanvasRenderingContext2D, s: number) => void): Sprite {
  const hit = sprites.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  paint(c.getContext('2d')!, size);
  sprites.set(key, c);
  return c;
}

/** soft glow puff, tinted */
export const puff = (rgb: string) =>
  sprite(`puff-${rgb}`, 128, (c, s) => {
    const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, `rgba(${rgb},0.55)`);
    g.addColorStop(0.45, `rgba(${rgb},0.22)`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    c.fillStyle = g;
    c.fillRect(0, 0, s, s);
  });

/** refractive water / sweat droplet: clear body, bright specular, darker refraction crescent */
export const droplet = () =>
  sprite('drop', 64, (c, s) => {
    const r = s / 2 - 2;
    const g = c.createRadialGradient(s * 0.45, s * 0.42, r * 0.05, s / 2, s / 2, r);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.6, 'rgba(226,242,247,0.6)');
    g.addColorStop(0.92, 'rgba(150,192,206,0.55)');
    g.addColorStop(1, 'rgba(120,165,182,0.35)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(s / 2, s / 2, r, 0, Math.PI * 2);
    c.fill();
    // refraction: darker crescent at the bottom
    c.save();
    c.beginPath();
    c.arc(s / 2, s / 2, r, 0, Math.PI * 2);
    c.clip();
    c.fillStyle = 'rgba(54,98,116,0.35)';
    c.beginPath();
    c.ellipse(s / 2, s * 0.86, r * 0.95, r * 0.32, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();
    c.fillStyle = 'rgba(255,255,255,1)';
    c.beginPath();
    c.ellipse(s * 0.38, s * 0.32, r * 0.24, r * 0.15, -0.6, 0, Math.PI * 2);
    c.fill();
  });

/** four-point glint, warm */
export const glint = (rgb = '255,214,120') =>
  sprite(`glint-${rgb}`, 128, (c, s) => {
    const m = s / 2;
    const g = c.createRadialGradient(m, m, 0, m, m, m);
    g.addColorStop(0, `rgba(255,255,255,1)`);
    g.addColorStop(0.12, `rgba(${rgb},0.9)`);
    g.addColorStop(0.4, `rgba(${rgb},0.12)`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    c.fillStyle = g;
    c.fillRect(0, 0, s, s);
    c.fillStyle = `rgba(${rgb},0.85)`;
    for (const rot of [0, Math.PI / 2]) {
      c.save();
      c.translate(m, m);
      c.rotate(rot);
      c.beginPath();
      c.moveTo(-m, 0);
      c.quadraticCurveTo(0, -2, m, 0);
      c.quadraticCurveTo(0, 2, -m, 0);
      c.fill();
      c.restore();
    }
  });

/** grass blade */
export const blade = () =>
  sprite('blade', 64, (c, s) => {
    const g = c.createLinearGradient(0, s, 0, 0);
    g.addColorStop(0, '#2E6B1C');
    g.addColorStop(0.6, '#5FA634');
    g.addColorStop(1, '#A6D96A');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(s * 0.44, s);
    c.quadraticCurveTo(s * 0.36, s * 0.45, s * 0.52, 0);
    c.quadraticCurveTo(s * 0.6, s * 0.5, s * 0.58, s);
    c.fill();
  });

/** soil clod */
export const clod = () =>
  sprite('clod', 48, (c, s) => {
    const r = rng(7);
    c.fillStyle = '#4A3424';
    c.beginPath();
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const rr = (s / 2 - 3) * (0.7 + r() * 0.3);
      c.lineTo(s / 2 + Math.cos(a) * rr, s / 2 + Math.sin(a) * rr);
    }
    c.closePath();
    c.fill();
    c.fillStyle = 'rgba(255,230,200,0.18)';
    c.beginPath();
    c.arc(s * 0.4, s * 0.38, s * 0.12, 0, Math.PI * 2);
    c.fill();
  });

/** bubble ring */
export const bubble = () =>
  sprite('bubble', 64, (c, s) => {
    const r = s / 2 - 3;
    c.strokeStyle = 'rgba(40,130,150,0.55)';
    c.lineWidth = 2.5;
    c.beginPath();
    c.arc(s / 2, s / 2, r, 0, Math.PI * 2);
    c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.9)';
    c.beginPath();
    c.ellipse(s * 0.38, s * 0.34, r * 0.25, r * 0.15, -0.6, 0, Math.PI * 2);
    c.fill();
  });

/* ------------------------------------------------------------------ particles */

export interface Particle {
  x: number; // in units relative to an origin
  y: number;
  vx: number;
  vy: number;
  g: number;
  t0: number; // emit time (s)
  life: number;
  size: number;
  rot: number;
  vr: number;
  seed: number;
}

/** burst of particles, generated once; positions are closed-form in time (scrubbable) */
export function burst(
  seed: number,
  n: number,
  o: { t0: number; x: number; y: number; angle: number; spread: number; speed: [number, number]; g: number; life: [number, number]; size: [number, number]; jitter?: number; dt?: number },
): Particle[] {
  const r = rng(seed);
  return Array.from({ length: n }, () => {
    const a = o.angle + (r() - 0.5) * o.spread;
    const sp = lerp(o.speed[0], o.speed[1], Math.pow(r(), 0.7));
    return {
      x: o.x + (r() - 0.5) * (o.jitter ?? 0),
      y: o.y + (r() - 0.5) * (o.jitter ?? 0) * 0.4,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      g: o.g,
      t0: o.t0 + r() * (o.dt ?? 0),
      life: lerp(o.life[0], o.life[1], r()),
      size: lerp(o.size[0], o.size[1], r()),
      rot: r() * Math.PI * 2,
      vr: (r() - 0.5) * 14,
      seed: r(),
    };
  });
}

/** age-scaled state of a particle, or null when not alive. `speed` < 1 = slow motion */
export function at(p: Particle, t: number, speed = 1) {
  const age = (t - p.t0) * speed;
  if (age < 0 || age > p.life) return null;
  return {
    x: p.x + p.vx * age,
    y: p.y + p.vy * age + 0.5 * p.g * age * age,
    vx: p.vx,
    vy: p.vy + p.g * age,
    k: age / p.life,
    rot: p.rot + p.vr * age,
  };
}

/** draw a sprite centred, rotated, with alpha */
export function stamp(ctx: CanvasRenderingContext2D, img: CanvasImageSource, x: number, y: number, w: number, h: number, rot = 0, alpha = 1) {
  if (alpha <= 0.002) return;
  ctx.globalAlpha = alpha;
  if (rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
  } else ctx.drawImage(img, x - w / 2, y - h / 2, w, h);
  ctx.globalAlpha = 1;
}

/** droplet stretched along its velocity (motion-blurred water) */
export function drawDrop(ctx: CanvasRenderingContext2D, x: number, y: number, vx: number, vy: number, r: number, alpha: number) {
  const sp = Math.hypot(vx, vy);
  const stretch = 1 + Math.min(2.4, sp / (r * 26));
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.atan2(vy, vx) - Math.PI / 2);
  ctx.globalAlpha = alpha;
  ctx.drawImage(droplet(), -r, -r * stretch, r * 2, r * 2 * stretch);
  ctx.restore();
  ctx.globalAlpha = 1;
}

/* ------------------------------------------------------------------ products */

const sweepCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;

export interface DrawOpts {
  rot?: number;
  sx?: number;
  sy?: number;
  alpha?: number;
  /** specular light band position 0..1 across the product (outside = none) */
  sweep?: number;
  /** ghost copies trailing behind, for motion blur: offset of the oldest ghost */
  trail?: { dx: number; dy: number; drot?: number; n?: number };
  flip?: boolean;
}

/** draws an image centred at (x, y) with width w */
export function product(ctx: CanvasRenderingContext2D, img: HTMLImageElement | ImageBitmap | undefined, x: number, y: number, w: number, o: DrawOpts = {}) {
  if (!img || !img.width) return;
  const h = (w * img.height) / img.width;
  const draw = (dx: number, dy: number, drot: number, a: number, src: CanvasImageSource = img) => {
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(x + dx, y + dy);
    ctx.rotate((o.rot ?? 0) + drot);
    ctx.scale((o.sx ?? 1) * (o.flip ? -1 : 1), o.sy ?? 1);
    ctx.drawImage(src, -w / 2, -h / 2, w, h);
    ctx.restore();
  };
  const a = o.alpha ?? 1;
  if (o.trail) {
    // motion blur: soft ghosts, blurrier the further back they trail
    const n = o.trail.n ?? 6;
    const len = Math.hypot(o.trail.dx, o.trail.dy);
    for (let i = n; i >= 1; i--) {
      const k = i / (n + 1);
      if ('filter' in ctx) ctx.filter = `blur(${Math.min(10, 1.5 + (len * k) / 18).toFixed(1)}px)`;
      draw(o.trail.dx * k, o.trail.dy * k, (o.trail.drot ?? 0) * k, a * 0.2 * (1 - k * 0.55));
    }
    if ('filter' in ctx) ctx.filter = 'none';
  }
  const sw = o.sweep;
  if (sw !== undefined && sw > -0.2 && sw < 1.2 && sweepCanvas) {
    // product + a bright band clipped to its silhouette
    const cw = Math.ceil(w);
    const ch = Math.ceil(h);
    if (sweepCanvas.width !== cw || sweepCanvas.height !== ch) {
      sweepCanvas.width = cw;
      sweepCanvas.height = ch;
    }
    const sc = sweepCanvas.getContext('2d')!;
    sc.globalCompositeOperation = 'source-over';
    sc.clearRect(0, 0, cw, ch);
    sc.drawImage(img, 0, 0, cw, ch);
    sc.globalCompositeOperation = 'source-atop';
    const bx = lerp(-0.4, 1.4, sw) * cw;
    const g = sc.createLinearGradient(bx - cw * 0.25, 0, bx + cw * 0.25, ch * 0.4);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.75)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    sc.fillStyle = g;
    sc.fillRect(0, 0, cw, ch);
    draw(0, 0, 0, a, sweepCanvas);
  } else draw(0, 0, 0, a);
}

/** soft contact shadow on the floor; `lift` 0 = touching, 1 = high above */
export function shadow(ctx: CanvasRenderingContext2D, x: number, floorY: number, w: number, lift: number, strength = 0.32) {
  const k = clamp(lift);
  const rw = w * (0.5 + k * 0.25);
  const rh = w * 0.07 * (1 + k * 0.6);
  const g = ctx.createRadialGradient(x, floorY, 0, x, floorY, rw);
  g.addColorStop(0, `rgba(30,26,20,${strength * (1 - k * 0.75)})`);
  g.addColorStop(1, 'rgba(30,26,20,0)');
  ctx.save();
  ctx.translate(x, floorY);
  ctx.scale(1, rh / rw);
  ctx.translate(-x, -floorY);
  ctx.fillStyle = g;
  ctx.fillRect(x - rw, floorY - rw, rw * 2, rw * 2);
  ctx.restore();
}

/** expanding elliptical shockwave ring */
export function ring(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, squash: number, color: string, alpha: number, width: number) {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * squash, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** anamorphic light streak (horizontal lens flare) */
export function streak(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, thick: number, rgb: string, alpha: number) {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  const g = ctx.createLinearGradient(x - len, 0, x + len, 0);
  g.addColorStop(0, `rgba(${rgb},0)`);
  g.addColorStop(0.5, `rgba(${rgb},0.9)`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, len, thick, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  ctx.ellipse(x, y, len * 0.35, thick * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** volumetric light cone from (x, y) pointing down, pre-blurred via gradients */
export function cone(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, spread: number, rgb: string, alpha: number, sway = 0) {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(sway);
  for (let i = 0; i < 3; i++) {
    const w = spread * (0.5 + i * 0.35);
    const g = ctx.createLinearGradient(0, 0, 0, len);
    g.addColorStop(0, `rgba(${rgb},${0.34 - i * 0.08})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-w * 0.04, 0);
    ctx.lineTo(w * 0.04, 0);
    ctx.lineTo(w, len);
    ctx.lineTo(-w, len);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}
