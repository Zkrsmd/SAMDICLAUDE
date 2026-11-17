import * as THREE from 'three';
import type { Palette } from '@/types/catalog';
import { curve1d, loop, taperedTube } from '../lib/geom';
import { cachedTexture, grainTexture, rng, shade } from '../lib/textures';
import { fabric, leather, metal } from '../lib/materials';

export interface GloveOptions {
  trim: 'gold' | 'panel' | 'stripe' | 'white';
  cuff: 'long' | 'short';
}

const X0 = -1.0;
const X1 = 0.74;

/**
 * Representative boxing glove, lofted as one continuous padded body (cuff → fist).
 * Local frame: knuckles toward +x, cuff opening toward -x, back of the hand +y, thumb on +z.
 */
export function createGlove(pal: Palette, o: GloveOptions, hand: 'right' | 'left' = 'right') {
  const g = new THREE.Group();
  g.name = 'glove';
  const metallicTrim = o.trim !== 'white';
  const trimColor = o.trim === 'white' ? '#F4F3EE' : pal.secondary;
  const cuffScale = o.cuff === 'long' ? 1 : 0.82;

  const ryBase = curve1d([[-1, 0.29], [-0.7, 0.285], [-0.45, 0.3], [-0.25, 0.37], [-0.05, 0.44], [0.2, 0.47], [0.42, 0.465], [0.74, 0.44]]);
  const rzBase = curve1d([[-1, 0.27], [-0.7, 0.265], [-0.45, 0.28], [-0.25, 0.33], [-0.05, 0.375], [0.2, 0.4], [0.42, 0.395], [0.74, 0.37]]);
  const ycF = curve1d([[-1, 0], [-0.45, 0], [-0.1, 0.06], [0.3, 0.085], [0.74, 0.06]]);
  const env = (x: number) => (x > 0.42 ? Math.sqrt(Math.max(0, 1 - ((x - 0.42) / (X1 - 0.42)) ** 2)) : 1);
  const xs = (u: number) => {
    // compress the cuff for short-cuff models
    const x = X0 + (X1 - X0) * u;
    return x < -0.45 ? -0.45 + (x + 0.45) * cuffScale : x;
  };
  const surf = (u: number, t: number, grow = 0, out = new THREE.Vector3()) => {
    const xRaw = X0 + (X1 - X0) * u;
    const x = xs(u);
    const e = env(xRaw);
    const ry = ryBase(xRaw) * e + grow;
    const rz = rzBase(xRaw) * e + grow;
    const c = Math.cos(t);
    const s = Math.sin(t);
    const sz = Math.sign(c) * Math.pow(Math.abs(c), 2 / 2.3);
    let y: number;
    if (s >= 0) y = ry * Math.pow(s, 2 / 2.1);
    else {
      y = -ry * 0.88 * Math.pow(-s, 2 / 3);
      // fingers curl under the front of the fist
      if (xRaw > 0.15) y += 0.05 * ((xRaw - 0.15) / 0.6) * Math.pow(-s, 3);
    }
    // knuckle ridge
    if (s > 0) y += 0.02 * Math.exp(-(((xRaw - 0.45) / 0.16) ** 2)) * s * e;
    return out.set(x, ycF(xRaw) + y, rz * sz);
  };

  const U = 150;
  const T = 72;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const v3 = new THREE.Vector3();
  for (let i = 0; i <= U; i++) {
    const u = i / U;
    for (let j = 0; j <= T; j++) {
      const v = j / T;
      surf(u, v * Math.PI * 2 - Math.PI / 2, 0, v3);
      pos.push(v3.x, v3.y, v3.z);
      uv.push(u, v);
    }
  }
  for (let i = 0; i < U; i++)
    for (let j = 0; j < T; j++) {
      const a = i * (T + 1) + j;
      const b = (i + 1) * (T + 1) + j;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const bodyGeo = new THREE.BufferGeometry();
  bodyGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  bodyGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  bodyGeo.setIndex(idx);
  bodyGeo.computeVertexNormals();

  const { map, mr } = gloveTextures(pal, o);
  const bodyMat = leather(pal.primary, {
    map,
    metalnessMap: mr,
    roughnessMap: mr,
    roughness: 1,
    metalness: 1,
    clearcoat: 0.85,
    clearcoatRoughness: 0.16,
    bumpMap: grainTexture(1.4, 21),
    bumpScale: 0.3,
    side: THREE.DoubleSide,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.name = 'body';
  g.add(body);

  /* ----------------------------------- thumb ----------------------------------- */
  const tp = (u: number, lift: number, out: number) => {
    const p = surf(u, -0.32, out);
    p.y += lift;
    return [p.x, p.y, p.z] as [number, number, number];
  };
  const uAt = (x: number) => (x - X0) / (X1 - X0);
  const thumbCurve = loop([tp(uAt(-0.32), -0.02, 0.0), tp(uAt(-0.08), 0.0, 0.07), tp(uAt(0.18), 0.02, 0.075), tp(uAt(0.4), 0.01, 0.03), tp(uAt(0.5), 0.0, -0.02)], false);
  const thumbMat = leather(pal.primary, { clearcoat: 0.85, clearcoatRoughness: 0.16, bumpMap: grainTexture(1.4, 21), bumpScale: 0.3 });
  const thumb = new THREE.Mesh(taperedTube(thumbCurve, (t) => 0.115 - t * 0.03, 56, 28, { caps: true, scaleY: 0.86 }), thumbMat);
  thumb.name = 'thumb';
  g.add(thumb);
  // stitched piping along the thumb
  const trimMat = metallicTrim ? metal(trimColor, 0.24) : leather(trimColor);
  const pipe = loop([tp(uAt(-0.3), 0.075, 0.02), tp(uAt(-0.06), 0.09, 0.08), tp(uAt(0.18), 0.105, 0.085), tp(uAt(0.38), 0.09, 0.04)], false);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(pipe, 48, 0.0065, 6), trimMat));

  /* ---------------------------------- cuff details ---------------------------------- */
  const ring = (u: number, grow: number, radius: number, mat: THREE.Material) => {
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k < 72; k++) pts.push(surf(u, (k / 72) * Math.PI * 2, grow));
    const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 144, radius, 10, true), mat);
    g.add(m);
    return m;
  };
  // strap band
  const u0 = uAt(-0.8);
  const u1 = uAt(-0.5);
  const SU = 24;
  const sp: number[] = [];
  const si: number[] = [];
  const suv: number[] = [];
  for (let i = 0; i <= SU; i++) {
    const u = u0 + ((u1 - u0) * i) / SU;
    for (let j = 0; j <= T; j++) {
      surf(u, (j / T) * Math.PI * 2 - Math.PI / 2, 0.022, v3);
      sp.push(v3.x, v3.y, v3.z);
      suv.push(i / SU, j / T);
    }
  }
  for (let i = 0; i < SU; i++)
    for (let j = 0; j < T; j++) {
      const a = i * (T + 1) + j;
      const b = (i + 1) * (T + 1) + j;
      si.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const strapGeo = new THREE.BufferGeometry();
  strapGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  strapGeo.setAttribute('uv', new THREE.Float32BufferAttribute(suv, 2));
  strapGeo.setIndex(si);
  strapGeo.computeVertexNormals();
  const strap = new THREE.Mesh(strapGeo, leather(pal.accent, { roughness: 0.55, clearcoat: 0.35, side: THREE.DoubleSide }));
  strap.name = 'strap';
  g.add(strap);
  ring(u0, 0.022, 0.012, trimMat);
  ring(u1, 0.022, 0.012, trimMat);
  ring(0.004, 0.012, 0.018, bodyMat); // rolled opening lip
  ring(0.03, 0.006, 0.006, trimMat);

  // lining visible in the opening
  const lining = new THREE.Mesh(new THREE.CircleGeometry(1, 48), fabric('#141414'));
  lining.rotation.y = -Math.PI / 2;
  lining.scale.set(rzBase(-1) * 0.95, ryBase(-1) * 0.85, 1);
  lining.position.set(xs(0) + 0.04, ycF(-1), 0);
  g.add(lining);

  if (hand === 'left') g.scale.z = -1;
  g.traverse((ob) => {
    if ((ob as THREE.Mesh).isMesh) {
      ob.castShadow = true;
      ob.receiveShadow = true;
    }
  });
  return g;
}

function gloveTextures(pal: Palette, o: GloveOptions) {
  const key = `glove2-${pal.primary}-${pal.secondary}-${o.trim}`;
  const W = 1024;
  const H = 512;
  const gold = o.trim === 'white' ? '#F4F3EE' : pal.secondary;
  // texture space: x = cuff → knuckles, y = v (0 palm, .25 thumb side, .5 back of hand, .75 outer side)
  const paint = (ctx: CanvasRenderingContext2D, mode: 'color' | 'mr') => {
    ctx.fillStyle = mode === 'color' ? pal.primary : 'rgb(0,115,0)';
    ctx.fillRect(0, 0, W, H);
    if (mode === 'color') {
      const g = ctx.createLinearGradient(0, 0, W, 0);
      g.addColorStop(0, 'rgba(0,0,0,0.08)');
      g.addColorStop(0.6, 'rgba(255,255,255,0.03)');
      g.addColorStop(1, 'rgba(0,0,0,0.05)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      // palm ventilation
      const r = rng(4);
      for (let i = 0; i < 70; i++) {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.arc(W * (0.5 + r() * 0.25), H * (r() > 0.5 ? 0.02 + r() * 0.08 : 0.9 + r() * 0.08), 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = shade(pal.primary, 0.02);
      ctx.fillRect(W * 0.35, 0, W * 0.65, H * 0.12);
      ctx.fillRect(W * 0.35, H * 0.88, W * 0.65, H * 0.12);
    }
    const trim = mode === 'color' ? gold : o.trim === 'white' ? 'rgb(0,110,0)' : 'rgb(0,55,255)';
    ctx.fillStyle = trim;
    // side piping (back-panel / palm seam)
    for (const v of [0.16, 0.84]) ctx.fillRect(W * 0.34, H * v - 3, W * 0.66, 6);
    // cuff opening trim
    ctx.fillRect(0, 0, 10, H);
    if (o.trim === 'gold' || o.trim === 'white') {
      // abstract crest on the back of the hand — not a manufacturer logo
      const cx = W * 0.64;
      const cy = H * 0.5;
      ctx.beginPath();
      ctx.moveTo(cx - 70, cy);
      ctx.lineTo(cx + 10, cy - 46);
      ctx.lineTo(cx + 80, cy);
      ctx.lineTo(cx + 10, cy + 46);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = mode === 'color' ? pal.primary : 'rgb(0,115,0)';
      ctx.beginPath();
      ctx.moveTo(cx - 34, cy);
      ctx.lineTo(cx + 10, cy - 25);
      ctx.lineTo(cx + 48, cy);
      ctx.lineTo(cx + 10, cy + 25);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = trim;
      ctx.fillRect(W * 0.45, cy - 3, W * 0.1, 6);
      ctx.fillRect(W * 0.73, cy - 3, W * 0.12, 6);
    } else if (o.trim === 'panel') {
      ctx.fillRect(W * 0.46, H * 0.36, W * 0.36, H * 0.28);
    } else if (o.trim === 'stripe') {
      ctx.fillRect(W * 0.36, H * 0.45, W * 0.54, 9);
      ctx.fillRect(W * 0.36, H * 0.53, W * 0.54, 9);
    }
    if (mode === 'color') {
      ctx.strokeStyle = 'rgba(255,255,255,0.16)';
      ctx.setLineDash([5, 6]);
      ctx.lineWidth = 1.5;
      for (const v of [0.14, 0.18, 0.82, 0.86]) {
        ctx.beginPath();
        ctx.moveTo(W * 0.34, H * v);
        ctx.lineTo(W, H * v);
        ctx.stroke();
      }
    }
  };
  const map = cachedTexture(`${key}-map`, W, H, (ctx) => paint(ctx, 'color'));
  const mr = cachedTexture(`${key}-mr`, W, H, (ctx) => paint(ctx, 'mr'), { srgb: false });
  return { map, mr };
}
