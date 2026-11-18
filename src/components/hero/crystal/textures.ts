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

/** sky backdrop: atmosphere gradient, the giant sport word, survey lines and tick numbers */
export function backdropTex(word: string, sky: [string, string], fontFamily: string, seed: number, aspect = 2) {
  const w = 2048;
  const h = Math.round(Math.min(4096, Math.max(512, w / aspect)));
  const c = canvas(w, h);
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, sky[0]);
  g.addColorStop(1, sky[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // horizon glow
  const hg = ctx.createRadialGradient(w / 2, h * 0.78, 0, w / 2, h * 0.78, w * 0.5);
  hg.addColorStop(0, 'rgba(255,255,255,0.55)');
  hg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hg;
  ctx.fillRect(0, 0, w, h);
  // the word, set like architecture: across landscape screens, standing up on portrait ones
  const text = word.toUpperCase();
  const vertical = aspect < 0.9;
  const span = vertical ? h * 0.86 : w * 0.84;
  const cap = vertical ? w * 0.62 : h * 0.46;
  let fs = 400;
  ctx.font = `900 ${fs}px ${fontFamily}`;
  fs = Math.min(cap, (fs * span) / ctx.measureText(text).width);
  ctx.font = `900 ${fs}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.save();
  ctx.translate(w / 2, h * 0.5);
  if (vertical) ctx.rotate(-Math.PI / 2);
  const wg = ctx.createLinearGradient(0, -fs / 2, 0, fs / 2);
  wg.addColorStop(0, 'rgba(255,255,255,0.85)');
  wg.addColorStop(1, 'rgba(255,255,255,0.18)');
  ctx.fillStyle = wg;
  ctx.fillText(text, 0, 0);
  ctx.restore();
  // survey lines + numbers
  const r = rng(seed);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.5;
  ctx.font = `500 18px ui-monospace, monospace`;
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  for (let i = 0; i < 9; i++) {
    const x = r() * w;
    const y = h * (0.15 + r() * 0.6);
    const x2 = x + (r() - 0.5) * 500;
    const y2 = y + (r() - 0.5) * 300;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.fillText(String(10 + Math.floor(r() * 89)), x2 + 14, y2 - 10);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
