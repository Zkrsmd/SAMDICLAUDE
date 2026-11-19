import * as THREE from 'three';

/**
 * Procedural textures, all drawn on canvases at start-up: frost / crack / ripple normal maps,
 * ground surfaces, caustics, soft sprites and the backdrop with the sport word. No downloads.
 */

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w: number, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** tileable value-noise fbm height field in [0, 1] */
function fbm(size: number, seed: number, octaves = 5, base = 4) {
  const r = rng(seed);
  const out = new Float32Array(size * size);
  let amp = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    const cells = base << o;
    const grid = new Float32Array(cells * cells).map(() => r());
    const at = (x: number, y: number) => grid[((y % cells) + cells) % cells * cells + (((x % cells) + cells) % cells)]!;
    for (let y = 0; y < size; y++) {
      const gy = (y / size) * cells;
      const y0 = Math.floor(gy);
      const fy = gy - y0;
      const sy = fy * fy * (3 - 2 * fy);
      for (let x = 0; x < size; x++) {
        const gx = (x / size) * cells;
        const x0 = Math.floor(gx);
        const fx = gx - x0;
        const sx = fx * fx * (3 - 2 * fx);
        const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
        const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
        out[y * size + x]! += (a + (b - a) * sy) * amp;
      }
    }
    norm += amp;
    amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i]! /= norm;
  return out;
}

/** height field → tangent-space normal map */
function normalFromHeight(h: Float32Array, size: number, strength: number) {
  const c = canvas(size);
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const H = (x: number, y: number) => h[((y + size) % size) * size + ((x + size) % size)]!;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
      const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      img.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = (1 / len) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

/** frosted ice: fine fbm + a few long scratches */
export function frostNormal(seed = 3) {
  const size = 256;
  const h = fbm(size, seed, 6, 6);
  const r = rng(seed + 9);
  for (let k = 0; k < 26; k++) {
    let x = r() * size;
    let y = r() * size;
    const a = r() * Math.PI;
    const len = 30 + r() * 120;
    for (let s = 0; s < len; s++) {
      x += Math.cos(a);
      y += Math.sin(a);
      const i = ((Math.floor(y) + size) % size) * size + ((Math.floor(x) + size) % size);
      h[i] = h[i]! - 0.25;
    }
  }
  return normalFromHeight(h, size, 6);
}

/** impact cracks radiating from a point, with concentric fractures */
export function crackNormal(seed = 5) {
  const size = 512;
  const c = canvas(size);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);
  const r = rng(seed);
  const cx = size * 0.42;
  const cy = size * 0.4;
  ctx.strokeStyle = '#000';
  ctx.lineCap = 'round';
  const rays = 17;
  const ends: [number, number][][] = [];
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2 + r() * 0.3;
    let x = cx;
    let y = cy;
    const pts: [number, number][] = [[x, y]];
    const len = size * (0.35 + r() * 0.5);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < len; s += 14) {
      const j = a + (r() - 0.5) * 0.5;
      x += Math.cos(j) * 14;
      y += Math.sin(j) * 14;
      ctx.lineTo(x, y);
      pts.push([x, y]);
    }
    ctx.stroke();
    ends.push(pts);
  }
  // ring fractures linking neighbouring rays
  for (let ring = 1; ring < 5; ring++) {
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < rays; i++) {
      const p = ends[i]![Math.min(ends[i]!.length - 1, ring * 3)]!;
      const q = ends[(i + 1) % rays]![Math.min(ends[(i + 1) % rays]!.length - 1, ring * 3 + (r() < 0.5 ? 1 : 0))]!;
      if (r() < 0.75) {
        ctx.moveTo(p[0], p[1]);
        ctx.quadraticCurveTo((p[0] + q[0]) / 2 + (r() - 0.5) * 20, (p[1] + q[1]) / 2 + (r() - 0.5) * 20, q[0], q[1]);
      }
    }
    ctx.stroke();
  }
  ctx.filter = 'blur(1.2px)';
  ctx.drawImage(c, 0, 0);
  ctx.filter = 'none';
  const data = ctx.getImageData(0, 0, size, size).data;
  const h = new Float32Array(size * size);
  const fine = fbm(size, seed + 1, 4, 8);
  for (let i = 0; i < h.length; i++) h[i] = data[i * 4]! / 255 + fine[i]! * 0.15;
  return normalFromHeight(h, size, 10);
}

/** soft ripple for water */
export function rippleNormal(seed = 7) {
  const size = 256;
  const h = fbm(size, seed, 4, 3);
  return normalFromHeight(h, size, 3);
}

function surfaceTex(paint: (ctx: CanvasRenderingContext2D, s: number, r: () => number) => void, seed: number, repeat: number, size = 1024) {
  const c = canvas(size);
  const ctx = c.getContext('2d')!;
  paint(ctx, size, rng(seed));
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function speckle(ctx: CanvasRenderingContext2D, s: number, r: () => number, n: number, rgb: string, a: [number, number], size: [number, number]) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = `rgba(${rgb},${a[0] + r() * (a[1] - a[0])})`;
    const z = size[0] + r() * (size[1] - size[0]);
    ctx.fillRect(r() * s, r() * s, z, z);
  }
}

/** frozen pitch: blue-grey frost with iced grass blades */
export const frostGround = () =>
  surfaceTex(
    (ctx, s, r) => {
      ctx.fillStyle = '#8E98A3';
      ctx.fillRect(0, 0, s, s);
      speckle(ctx, s, r, 9000, '220,228,236', [0.05, 0.35], [1, 3]);
      ctx.lineCap = 'round';
      for (let i = 0; i < 5000; i++) {
        const x = r() * s;
        const y = r() * s;
        const l = 4 + r() * 10;
        const a = -Math.PI / 2 + (r() - 0.5) * 1.2;
        ctx.strokeStyle = r() < 0.6 ? `rgba(120,140,128,${0.25 + r() * 0.3})` : `rgba(236,242,248,${0.3 + r() * 0.4})`;
        ctx.lineWidth = 1 + r();
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
        ctx.stroke();
      }
    },
    11,
    10,
  );

/** gym concrete */
export const concreteGround = () =>
  surfaceTex(
    (ctx, s, r) => {
      ctx.fillStyle = '#968F86';
      ctx.fillRect(0, 0, s, s);
      speckle(ctx, s, r, 14000, '60,54,48', [0.03, 0.14], [1, 4]);
      speckle(ctx, s, r, 6000, '230,224,214', [0.04, 0.16], [1, 3]);
      ctx.strokeStyle = 'rgba(40,36,32,0.25)';
      ctx.lineWidth = 2;
      for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(0, (i * s) / 4);
        ctx.lineTo(s, (i * s) / 4);
        ctx.moveTo((i * s) / 4, 0);
        ctx.lineTo((i * s) / 4, s);
        ctx.stroke();
      }
    },
    21,
    8,
  );

/** pool floor tiles */
export const tileGround = () =>
  surfaceTex(
    (ctx, s, r) => {
      ctx.fillStyle = '#8FA9AF';
      ctx.fillRect(0, 0, s, s);
      const n = 16;
      const t = s / n;
      for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++) {
          ctx.fillStyle = `rgba(${r() < 0.5 ? '220,236,240' : '60,90,98'},${0.04 + r() * 0.08})`;
          ctx.fillRect(x * t + 1, y * t + 1, t - 2, t - 2);
        }
      ctx.strokeStyle = 'rgba(236,246,248,0.55)';
      ctx.lineWidth = 2;
      for (let i = 0; i <= n; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * t);
        ctx.lineTo(s, i * t);
        ctx.moveTo(i * t, 0);
        ctx.lineTo(i * t, s);
        ctx.stroke();
      }
    },
    31,
    6,
  );

/** hardwood with a court line */
export const woodGround = () =>
  surfaceTex(
    (ctx, s, r) => {
      ctx.fillStyle = '#A2978A';
      ctx.fillRect(0, 0, s, s);
      const plank = s / 12;
      for (let i = 0; i < 12; i++) {
        ctx.fillStyle = `rgba(${r() < 0.5 ? '70,56,44' : '232,222,208'},${0.05 + r() * 0.07})`;
        ctx.fillRect(0, i * plank, s, plank - 2);
        for (let g = 0; g < 40; g++) {
          ctx.strokeStyle = `rgba(70,56,44,${0.05 + r() * 0.08})`;
          ctx.lineWidth = 1;
          const y = i * plank + r() * plank;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.bezierCurveTo(s * 0.3, y + (r() - 0.5) * 6, s * 0.7, y + (r() - 0.5) * 6, s, y);
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(40,32,26,0.35)';
        ctx.fillRect(0, (i + 1) * plank - 2, s, 2);
      }
    },
    41,
    5,
  );

/** caustic light net, additive */
export function causticTex(seed = 51) {
  const size = 160;
  const c = canvas(size);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);
  const r = rng(seed);
  // voronoi-ish cells: bright edges where cells meet
  const pts = Array.from({ length: 22 }, () => [r() * size, r() * size] as const);
  const img = ctx.getImageData(0, 0, size, size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      let d1 = 1e9;
      let d2 = 1e9;
      for (const [px, py] of pts) {
        for (const ox of [-size, 0, size])
          for (const oy of [-size, 0, size]) {
            const d = (x - px - ox) ** 2 + (y - py - oy) ** 2;
            if (d < d1) {
              d2 = d1;
              d1 = d;
            } else if (d < d2) d2 = d;
          }
      }
      const e = Math.sqrt(d2) - Math.sqrt(d1);
      const v = Math.max(0, 1 - e / 5) ** 2.2 * 255;
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** soft radial sprite */
export function glowTex() {
  const s = 128;
  const c = canvas(s);
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** contact shadow decal */
export function shadowTex() {
  const s = 256;
  const c = canvas(s);
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(0.5, 'rgba(0,0,0,0.18)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  return new THREE.CanvasTexture(c);
}

/** a soft volumetric shaft for additive light planes (bright at the source, widening, fading) */
export function beamTex() {
  const W = 128;
  const H = 512;
  const c = canvas(W, H);
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    const v = y / (H - 1);
    const half = 0.1 + 0.4 * v;
    const fall = Math.pow(1 - v, 1.35) * Math.min(1, v * 14);
    for (let x = 0; x < W; x++) {
      const u = (x / (W - 1) - 0.5) / half;
      const a = Math.exp(-u * u * 2.6) * fall;
      const i = (y * W + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(Math.min(1, a) * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ---------------------------------------------------------------- the coded backdrops */

type Ctx = CanvasRenderingContext2D;

/** paint at 1/k resolution and stretch it on: a free, very wide blur for light and haze */
function soft(ctx: Ctx, w: number, h: number, op: GlobalCompositeOperation, paint: (c: Ctx, sw: number, sh: number) => void, k = 8) {
  const sw = Math.max(8, Math.round(w / k));
  const sh = Math.max(8, Math.round(h / k));
  const c = canvas(sw, sh);
  paint(c.getContext('2d')!, sw, sh);
  ctx.save();
  ctx.globalCompositeOperation = op;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(c, 0, 0, w, h);
  ctx.restore();
}

/** a wedge of light from an apex to a base segment */
function shaft(c: Ctx, ax: number, ay: number, bx0: number, by0: number, bx1: number, by1: number, alpha: number) {
  const g = c.createLinearGradient(ax, ay, (bx0 + bx1) / 2, (by0 + by1) / 2);
  g.addColorStop(0, `rgba(255,255,255,${alpha})`);
  g.addColorStop(0.55, `rgba(255,255,255,${alpha * 0.35})`);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(ax, ay);
  c.lineTo(bx0, by0);
  c.lineTo(bx1, by1);
  c.closePath();
  c.fill();
}

function glowDot(c: Ctx, x: number, y: number, r: number, a = 1) {
  const g = c.createRadialGradient(x, y, 0, x, y, r * 4);
  g.addColorStop(0, `rgba(255,255,255,${a})`);
  g.addColorStop(0.18, `rgba(255,255,255,${a * 0.65})`);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
}

interface Painter {
  back: (c: Ctx, w: number, h: number, hz: number, r: () => number) => void;
  light: (c: Ctx, w: number, h: number, hz: number, r: () => number) => void;
}

/** football — a floodlit bowl: stands on the horizon, two light masts, beams raking through haze */
const FLOODLIT: Painter = {
  back(c, w, h, hz) {
    const rise = Math.min(h * 0.17, w * 0.085);
    const roof = (x: number, f = 1) => {
      const k = (x / w) * 2 - 1;
      return hz - rise * (0.5 + 0.5 * k * k) * f;
    };
    c.fillStyle = 'rgba(56,66,80,0.26)';
    c.beginPath();
    c.moveTo(0, hz);
    for (let x = 0; x <= w; x += 8) c.lineTo(x, roof(x));
    c.lineTo(w, hz);
    c.closePath();
    c.fill();
    c.lineWidth = 1.4;
    for (let i = 1; i < 8; i++) {
      c.strokeStyle = `rgba(255,255,255,${0.05 + i * 0.012})`;
      c.beginPath();
      for (let x = 0; x <= w; x += 12) (x ? c.lineTo : c.moveTo).call(c, x, roof(x, i / 8));
      c.stroke();
    }
    c.strokeStyle = 'rgba(255,255,255,0.4)';
    c.lineWidth = 2;
    c.beginPath();
    for (let x = 0; x <= w; x += 8) (x ? c.lineTo : c.moveTo).call(c, x, roof(x) - 1);
    c.stroke();
    for (const fx of [0.09, 0.91]) {
      const mx = w * fx;
      const top = Math.max(h * 0.2, hz - rise - h * 0.3);
      c.fillStyle = 'rgba(52,60,72,0.5)';
      c.fillRect(mx - 3, top, 6, hz - top);
      const bw = Math.min(w * 0.085, 190);
      const bh = bw * 0.46;
      c.fillStyle = 'rgba(52,60,72,0.62)';
      c.fillRect(mx - bw / 2 - 5, top - bh - 5, bw + 10, bh + 10);
      for (let j = 0; j < 3; j++) for (let i = 0; i < 6; i++) glowDot(c, mx - bw / 2 + ((i + 0.5) * bw) / 6, top - bh + ((j + 0.5) * bh) / 3, bw / 18, 1);
    }
  },
  light(c, w, h, hz) {
    const rise = Math.min(h * 0.17, w * 0.085);
    for (const fx of [0.09, 0.91]) {
      const mx = w * fx;
      const top = Math.max(h * 0.2, hz - rise - h * 0.3) - Math.min(w * 0.085, 190) * 0.23;
      const s = fx < 0.5 ? 1 : -1;
      shaft(c, mx, top, w * (0.5 - s * 0.32), hz + h * 0.1, w * (0.5 + s * 0.12), hz + h * 0.1, 0.32);
      shaft(c, mx, top, w * (0.5 - s * 0.05), hz + h * 0.1, w * (0.5 + s * 0.35), hz + h * 0.1, 0.14);
      glowDot(c, mx, top, w * 0.045, 1);
    }
    const g = c.createLinearGradient(0, hz - h * 0.25, 0, hz);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(255,255,255,0.35)');
    c.fillStyle = g;
    c.fillRect(0, hz - h * 0.25, w, h * 0.25);
  },
};

/** boxing — the ring under a hanging light rig, ropes across the floor line, a cone of light */
const RING: Painter = {
  back(c, w, h, hz) {
    const rigY = Math.max(h * 0.06, hz - h * 0.66);
    const rw = w * 0.38;
    c.strokeStyle = 'rgba(48,42,36,0.5)';
    c.lineWidth = 3;
    c.strokeRect(w / 2 - rw / 2, rigY, rw, 22);
    c.lineWidth = 1.5;
    c.beginPath();
    for (let x = 0; x <= rw; x += 22) {
      c.moveTo(w / 2 - rw / 2 + x, rigY);
      c.lineTo(w / 2 - rw / 2 + x + 11, rigY + 22);
      c.lineTo(w / 2 - rw / 2 + x + 22, rigY);
    }
    c.stroke();
    c.beginPath();
    c.moveTo(w / 2 - rw * 0.3, 0);
    c.lineTo(w / 2 - rw * 0.3, rigY);
    c.moveTo(w / 2 + rw * 0.3, 0);
    c.lineTo(w / 2 + rw * 0.3, rigY);
    c.stroke();
    for (let i = 0; i < 8; i++) glowDot(c, w / 2 - rw / 2 + ((i + 0.5) * rw) / 8, rigY + 30, 7, 1);
    // ring: apron, corner posts, three ropes with a soft sag
    const ropeTop = hz - Math.min(h * 0.2, w * 0.1);
    c.fillStyle = 'rgba(52,46,40,0.28)';
    c.fillRect(0, hz - 14, w, 14);
    for (const fx of [0.08, 0.92]) {
      c.fillStyle = 'rgba(40,34,30,0.55)';
      c.fillRect(w * fx - 9, ropeTop - 26, 18, hz - ropeTop + 26);
      c.fillStyle = 'rgba(255,255,255,0.35)';
      c.fillRect(w * fx - 9, ropeTop - 26, 4, hz - ropeTop + 26);
    }
    for (let i = 0; i < 3; i++) {
      const y = ropeTop + ((hz - ropeTop) * i) / 3.2;
      for (const [col, lw, dy] of [
        ['rgba(40,34,30,0.45)', 9, 3],
        ['rgba(255,248,236,0.75)', 4, 0],
      ] as const) {
        c.strokeStyle = col;
        c.lineWidth = lw;
        c.beginPath();
        c.moveTo(w * 0.08, y + dy);
        c.quadraticCurveTo(w / 2, y + dy + 16, w * 0.92, y + dy);
        c.stroke();
      }
    }
  },
  light(c, w, h, hz) {
    const rigY = Math.max(h * 0.06, hz - h * 0.66) + 30;
    shaft(c, w * 0.42, rigY, w * 0.16, hz + h * 0.05, w * 0.6, hz + h * 0.05, 0.3);
    shaft(c, w * 0.58, rigY, w * 0.4, hz + h * 0.05, w * 0.84, hz + h * 0.05, 0.3);
    const g = c.createRadialGradient(w / 2, hz, 0, w / 2, hz, w * 0.45);
    g.addColorStop(0, 'rgba(255,244,226,0.45)');
    g.addColorStop(1, 'rgba(255,244,226,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  },
};

/** swimming — under the surface: rippling light up top, the far pool wall with its lane T, god rays */
const POOL: Painter = {
  back(c, w, h, hz, r) {
    const top = c.createLinearGradient(0, 0, 0, h * 0.4);
    top.addColorStop(0, 'rgba(236,252,255,0.5)');
    top.addColorStop(1, 'rgba(236,252,255,0)');
    c.fillStyle = top;
    c.fillRect(0, 0, w, h * 0.4);
    // the underside of the surface: two interfering ripple nets
    for (let layer = 0; layer < 2; layer++) {
      c.strokeStyle = `rgba(255,255,255,${0.32 - layer * 0.12})`;
      c.lineWidth = 2.2 - layer;
      const band = h * (0.11 + layer * 0.05);
      for (let k = 0; k < 9; k++) {
        const y0 = (band * k) / 9;
        c.beginPath();
        for (let x = 0; x <= w; x += 10) {
          const y = y0 + Math.sin(x * 0.012 + k * 1.7 + layer * 2) * 9 + Math.sin(x * 0.031 + k) * 4;
          (x ? c.lineTo : c.moveTo).call(c, x, y);
        }
        c.stroke();
      }
    }
    // far wall: fine tile grid down to the floor line
    const wallTop = hz - Math.min(h * 0.3, w * 0.16);
    const tile = Math.max(18, w / 64);
    c.strokeStyle = 'rgba(255,255,255,0.16)';
    c.lineWidth = 1.2;
    c.beginPath();
    for (let y = hz; y > wallTop; y -= tile) {
      c.moveTo(0, y);
      c.lineTo(w, y);
    }
    for (let x = (w / 2) % tile; x < w; x += tile) {
      c.moveTo(x, wallTop);
      c.lineTo(x, hz);
    }
    c.stroke();
    // lane target T on the wall and the lane lines' ends
    for (const fx of [0.5, 0.18, 0.82]) {
      const big = fx === 0.5;
      c.fillStyle = `rgba(30,52,60,${big ? 0.5 : 0.28})`;
      const bw = tile * (big ? 0.9 : 0.6);
      c.fillRect(w * fx - bw / 2, wallTop + tile * 1.2, bw, hz - wallTop - tile * 1.2);
      c.fillRect(w * fx - bw * 3, wallTop + tile * 1.2, bw * 6, bw);
    }
    for (let i = 0; i < 70; i++) {
      const x = r() * w;
      const y = hz - r() * h * 0.5;
      c.strokeStyle = `rgba(255,255,255,${0.15 + r() * 0.3})`;
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(x, y, 2 + r() * 7, 0, Math.PI * 2);
      c.stroke();
    }
  },
  light(c, w, h, hz, r) {
    for (let i = 0; i < 9; i++) {
      const x = w * (0.06 + (i / 8) * 0.88) + (r() - 0.5) * w * 0.04;
      const tilt = (x - w / 2) * 0.25;
      const half = w * (0.015 + r() * 0.03);
      shaft(c, x, -h * 0.02, x + tilt - half * 3, hz + h * 0.05, x + tilt + half * 3, hz + h * 0.05, 0.16 + r() * 0.12);
    }
  },
};

/** basketball — a morning gym: tall windows, a hoop in the distance, bleachers, raking sun shafts */
const GYM: Painter = {
  back(c, w, h, hz) {
    const winTop = Math.max(h * 0.06, hz - h * 0.62);
    const winH = Math.min(h * 0.3, (hz - winTop) * 0.6);
    const winW = Math.min(w * 0.06, winH * 0.42);
    const xs = [0.06, 0.14, 0.22, 0.78, 0.86, 0.94];
    for (const fx of xs) {
      const x = w * fx - winW / 2;
      const g = c.createLinearGradient(0, winTop, 0, winTop + winH);
      g.addColorStop(0, 'rgba(255,252,244,0.75)');
      g.addColorStop(1, 'rgba(255,248,236,0.4)');
      c.fillStyle = g;
      c.fillRect(x, winTop, winW, winH);
      c.strokeStyle = 'rgba(70,58,48,0.5)';
      c.lineWidth = 3;
      c.strokeRect(x, winTop, winW, winH);
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(x + winW / 2, winTop);
      c.lineTo(x + winW / 2, winTop + winH);
      for (let k = 1; k < 5; k++) {
        c.moveTo(x, winTop + (winH * k) / 5);
        c.lineTo(x + winW, winTop + (winH * k) / 5);
      }
      c.stroke();
    }
    // bleachers on the floor line
    const bh = Math.min(h * 0.09, w * 0.05);
    c.fillStyle = 'rgba(70,58,48,0.2)';
    for (let k = 0; k < 5; k++) c.fillRect(0, hz - (bh * (k + 1)) / 5, w, 2.5);
    c.fillRect(0, hz - bh, w, bh);
    // the hoop, far end
    const hx = w * 0.7;
    const bbW = Math.min(w * 0.085, 180);
    const bbH = bbW * 0.6;
    const bbY = hz - bh - Math.min(h * 0.2, w * 0.12);
    c.strokeStyle = 'rgba(58,48,40,0.55)';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(hx, 0);
    c.lineTo(hx, bbY);
    c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.35)';
    c.fillRect(hx - bbW / 2, bbY, bbW, bbH);
    c.strokeRect(hx - bbW / 2, bbY, bbW, bbH);
    c.strokeRect(hx - bbW * 0.18, bbY + bbH * 0.42, bbW * 0.36, bbH * 0.4);
    c.strokeStyle = 'rgba(190,110,60,0.7)';
    c.lineWidth = 4;
    c.beginPath();
    c.ellipse(hx, bbY + bbH * 0.95, bbW * 0.2, bbW * 0.05, 0, 0, Math.PI * 2);
    c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.45)';
    c.lineWidth = 1.5;
    c.beginPath();
    for (let k = 0; k <= 6; k++) {
      const x0 = hx - bbW * 0.2 + (k * bbW * 0.4) / 6;
      c.moveTo(x0, bbY + bbH * 0.95);
      c.lineTo(hx - bbW * 0.12 + (k * bbW * 0.24) / 6, bbY + bbH * 0.95 + bbW * 0.22);
    }
    c.stroke();
  },
  light(c, w, h, hz) {
    const winTop = Math.max(h * 0.06, hz - h * 0.62);
    const winH = Math.min(h * 0.3, (hz - winTop) * 0.6);
    const winW = Math.min(w * 0.06, winH * 0.42);
    for (const fx of [0.06, 0.14, 0.22]) {
      const x = w * fx;
      shaft(c, x, winTop + winH * 0.5, x + w * 0.2, hz + h * 0.04, x + w * 0.2 + winW * 3, hz + h * 0.04, 0.26);
    }
    for (const fx of [0.78, 0.86, 0.94]) {
      const x = w * fx;
      shaft(c, x, winTop + winH * 0.5, x - w * 0.2 - winW * 3, hz + h * 0.04, x - w * 0.2, hz + h * 0.04, 0.2);
    }
  },
};

const PAINTERS: Record<string, Painter> = { football: FLOODLIT, boxing: RING, swimming: POOL, basketball: GYM };

/** fine grain so long gradients never band */
function grain(ctx: Ctx, w: number, h: number, seed: number) {
  const s = 256;
  const c = canvas(s);
  const x = c.getContext('2d')!;
  const img = x.createImageData(s, s);
  const r = rng(seed);
  for (let i = 0; i < s * s; i++) {
    const v = r() * 255;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 10;
  }
  x.putImageData(img, 0, 0);
  ctx.fillStyle = ctx.createPattern(c, 'repeat')!;
  ctx.fillRect(0, 0, w, h);
}

/**
 * The world behind each crystal, painted in code: atmosphere, the sport's own set (floodlit
 * bowl, ring, pool wall, gym), the giant sport word, light through haze, survey marks.
 * `horizon` is where the floor meets this backdrop (0 top … 1 bottom), so the set sits on it.
 */
export function backdropTex(word: string, sky: [string, string], fontFamily: string, seed: number, aspect = 2, id = '', horizon = 0.78, bare = false) {
  const w = 2048;
  const h = Math.round(Math.min(4096, Math.max(512, w / aspect)));
  const c = canvas(w, h);
  const ctx = c.getContext('2d')!;
  // bare: transparent, laid over a film playing on the wall behind (no painted set, no grain)
  if (!bare) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, sky[0]);
    g.addColorStop(1, sky[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  // depth: the sky darkens toward the top like a lit set, not a flat card
  const top = ctx.createLinearGradient(0, 0, 0, h * 0.55);
  top.addColorStop(0, 'rgba(16,22,30,0.34)');
  top.addColorStop(1, 'rgba(16,22,30,0)');
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, w, h * 0.55);
  const hz = Math.min(h * 0.97, Math.max(h * 0.45, h * horizon));
  const r = rng(seed);
  const art = bare ? undefined : PAINTERS[id];
  art?.back(ctx, w, h, hz, r);

  // the word, set like architecture: across landscape screens, standing up on portrait ones
  const text = word.toUpperCase();
  const vertical = aspect < 0.9;
  const span = vertical ? h * 0.86 : w * 0.84;
  const cap = vertical ? w * 0.62 : h * 0.42;
  let fs = 400;
  // the site's action face: heavy, condensed, slanted
  ctx.font = `italic 900 condensed ${fs}px ${fontFamily}`;
  fs = Math.min(cap, (fs * span) / ctx.measureText(text).width);
  ctx.font = `italic 900 condensed ${fs}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.save();
  ctx.translate(w / 2, vertical ? h * 0.5 : Math.min(h * 0.5, hz - fs * 0.62));
  if (vertical) ctx.rotate(-Math.PI / 2);
  const wg = ctx.createLinearGradient(0, -fs / 2, 0, fs / 2);
  wg.addColorStop(0, 'rgba(255,255,255,0.82)');
  wg.addColorStop(1, 'rgba(255,255,255,0.14)');
  ctx.fillStyle = wg;
  ctx.fillText(text, 0, 0);
  ctx.restore();

  if (art) soft(ctx, w, h, 'screen', (s, sw, sh) => art.light(s, sw, sh, (hz / h) * sh, rng(seed + 1)));
  // haze sitting on the floor line
  soft(ctx, w, h, 'source-over', (s, sw, sh) => {
    const y = (hz / h) * sh;
    const hg = s.createLinearGradient(0, y - sh * 0.2, 0, y + sh * 0.05);
    hg.addColorStop(0, 'rgba(255,255,255,0)');
    hg.addColorStop(0.75, 'rgba(255,255,255,0.16)');
    hg.addColorStop(1, 'rgba(255,255,255,0.06)');
    s.fillStyle = hg;
    s.fillRect(0, 0, sw, sh);
  });

  // survey lines + numbers
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1.5;
  ctx.font = `500 18px ui-monospace, monospace`;
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  for (let i = 0; i < 7; i++) {
    const x = r() * w;
    const y = h * (0.12 + r() * 0.5);
    const x2 = x + (r() - 0.5) * 500;
    const y2 = y + (r() - 0.5) * 300;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.fillText(String(10 + Math.floor(r() * 89)), x2 + 14, y2 - 10);
  }
  if (!bare) grain(ctx, w, h, seed + 7);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
