import * as THREE from 'three';
import type { Palette } from '@/types/catalog';
import { cachedTexture } from '../lib/textures';

type Pattern = 'classic' | 'tri' | 'swirl' | 'basket';

const PHI = (1 + Math.sqrt(5)) / 2;
const norm = (v: number[]) => {
  const l = Math.hypot(v[0]!, v[1]!, v[2]!);
  return [v[0]! / l, v[1]! / l, v[2]! / l];
};
const ICOSA = [
  [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0], [0, -1, PHI], [0, 1, PHI],
  [0, -1, -PHI], [0, 1, -PHI], [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1],
].map(norm);
const DODECA: number[][] = [];
for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) DODECA.push(norm([x, y, z]));
for (const [a, b] of [[1 / PHI, PHI]])
  for (const s1 of [-1, 1])
    for (const s2 of [-1, 1]) {
      DODECA.push(norm([0, s1 * a!, s2 * b!]));
      DODECA.push(norm([s1 * a!, s2 * b!, 0]));
      DODECA.push(norm([s1 * b!, 0, s2 * a!]));
    }
const TETRA = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map(norm);
const CUBE = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

const hexRGB = (h: string) => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
};

function nearest2(d: number[], pts: number[][]) {
  let b1 = -2;
  let b2 = -2;
  let i1 = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    const dot = d[0]! * p[0]! + d[1]! * p[1]! + d[2]! * p[2]!;
    if (dot > b1) {
      b2 = b1;
      b1 = dot;
      i1 = i;
    } else if (dot > b2) b2 = dot;
  }
  return { i: i1, edge: Math.acos(Math.min(1, b2)) - Math.acos(Math.min(1, b1)), dot: b1 };
}

function paintBall(pal: Palette, pattern: Pattern, mode: 'color' | 'bump') {
  return (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const img = ctx.createImageData(w, h);
    const base = hexRGB(pal.primary);
    const c2 = hexRGB(pal.secondary);
    const c3 = hexRGB(pal.accent);
    const c4 = hexRGB(pal.detail ?? pal.accent);
    const set = (k: number, rgb: readonly number[], shadeK = 1) => {
      img.data[k] = rgb[0]! * shadeK;
      img.data[k + 1] = rgb[1]! * shadeK;
      img.data[k + 2] = rgb[2]! * shadeK;
      img.data[k + 3] = 255;
    };
    const all = [...ICOSA, ...DODECA];
    for (let y = 0; y < h; y++) {
      const theta = (y / h) * Math.PI;
      for (let x = 0; x < w; x++) {
        const phi = (x / w) * Math.PI * 2;
        const d = [-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta)];
        const k = (y * w + x) * 4;
        let rgb: readonly number[] = base;
        let seam = 1;
        if (pattern === 'classic') {
          const n = nearest2(d, all);
          if (n.i < 12) rgb = c2;
          seam = n.edge < 0.012 ? 0 : 1;
        } else if (pattern === 'tri') {
          const n = nearest2(d, TETRA);
          seam = n.edge < 0.012 ? 0 : 1;
          // bold triangular bands inside each of the four panels
          if (n.edge > 0.05 && n.edge < 0.11) rgb = [c2, c3, c4, c2][n.i]!;
          else if (n.edge > 0.14 && n.edge < 0.16) rgb = [c3, c4, c2, c4][n.i]!;
        } else if (pattern === 'swirl') {
          const n = nearest2(d, CUBE);
          seam = n.edge < 0.01 ? 0 : 1;
          if (n.edge < 0.09 && n.edge > 0.025) rgb = n.i % 2 ? c2 : c3;
        } else {
          // basketball channels
          const lines = [Math.abs(d[0]!), Math.abs(d[2]!), Math.abs(Math.abs(d[1]!) - 0.62 * Math.hypot(d[0]!, d[2]!) ) * 0.9];
          const m = Math.min(...lines);
          seam = m < 0.018 ? 0 : 1;
          rgb = base;
        }
        if (mode === 'color') set(k, seam ? rgb : [40, 40, 40], 1);
        else {
          const v = seam ? 150 : 40;
          img.data[k] = img.data[k + 1] = img.data[k + 2] = v;
          img.data[k + 3] = 255;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    if (mode === 'bump' && pattern === 'basket') {
      // pebble grain
      for (let i = 0; i < 26000; i++) {
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(Math.random() * w, Math.random() * h, 1.2, 1.2);
      }
    }
  };
}

export function createBall(pal: Palette, o: { pattern?: string } = {}) {
  const pattern = (o.pattern ?? 'classic') as Pattern;
  const key = `ball-${pattern}-${pal.primary}-${pal.secondary}-${pal.accent}`;
  const map = cachedTexture(`${key}-map`, 1024, 512, paintBall(pal, pattern, 'color'));
  const bump = cachedTexture(`${key}-bump`, 1024, 512, paintBall(pal, pattern, 'bump'), { srgb: false });
  const mat = new THREE.MeshPhysicalMaterial({
    map,
    bumpMap: bump,
    bumpScale: pattern === 'basket' ? 2 : 1.2,
    roughness: pattern === 'basket' ? 0.75 : 0.35,
    clearcoat: pattern === 'basket' ? 0 : 0.7,
    clearcoatRoughness: 0.25,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), mat);
  m.castShadow = true;
  m.name = 'ball';
  const g = new THREE.Group();
  g.add(m);
  return g;
}
