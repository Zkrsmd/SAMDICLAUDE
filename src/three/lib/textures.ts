import * as THREE from 'three';

const cache = new Map<string, THREE.Texture>();

export function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: false })!;
  return { c, ctx };
}

/** Cached CanvasTexture factory. */
export function cachedTexture(
  key: string,
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  opts: { srgb?: boolean; repeat?: [number, number]; anisotropy?: number } = {},
) {
  const hit = cache.get(key);
  if (hit) return hit;
  const { c, ctx } = canvas(w, h);
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  if (opts.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = opts.anisotropy ?? 8;
  if (opts.repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...opts.repeat);
  }
  t.userData.shared = true;
  cache.set(key, t);
  return t;
}

/** Deterministic PRNG so renders are stable between runs. */
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fine grain noise — leather, silicone, foam. Grayscale, for bump/roughness maps. */
export function grainTexture(scale = 1, seed = 7) {
  return cachedTexture(
    `grain-${scale}-${seed}`,
    256,
    256,
    (ctx, w, h) => {
      const r = rng(seed);
      const img = ctx.createImageData(w, h);
      for (let i = 0; i < w * h; i++) {
        const v = 128 + (r() - 0.5) * 90 * scale;
        img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
        img.data[i * 4 + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      // soft pebbles
      for (let i = 0; i < 900; i++) {
        ctx.fillStyle = `rgba(${r() > 0.5 ? 255 : 0},${r() > 0.5 ? 255 : 0},${r() > 0.5 ? 255 : 0},0.04)`;
        ctx.beginPath();
        ctx.arc(r() * w, r() * h, 1 + r() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    { srgb: false, repeat: [4, 4] },
  );
}

/** Knit / ribbed fabric bump. */
export function knitTexture() {
  return cachedTexture(
    'knit',
    128,
    128,
    (ctx, w, h) => {
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 4) {
        for (let x = 0; x < w; x += 8) {
          const g = ctx.createLinearGradient(x, y, x + 4, y + 4);
          g.addColorStop(0, '#5a5a5a');
          g.addColorStop(0.5, '#c8c8c8');
          g.addColorStop(1, '#5a5a5a');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + 4, y + 3);
          ctx.lineTo(x + 8, y);
          ctx.lineTo(x + 8, y + 2);
          ctx.lineTo(x + 4, y + 5);
          ctx.lineTo(x, y + 2);
          ctx.fill();
        }
      }
    },
    { srgb: false, repeat: [8, 8] },
  );
}

export const hex = (c: string) => new THREE.Color(c);

export function shade(color: string, amount: number) {
  const c = new THREE.Color(color);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.min(1, Math.max(0, hsl.l + amount)));
  return `#${c.getHexString()}`;
}
