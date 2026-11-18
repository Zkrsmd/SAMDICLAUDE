import * as THREE from 'three';
import { axis, flying, out, pushTri, rnd, toGeometry, type BurstSpec, type Out } from './burst';

/**
 * Sport matter thrown out with the glass when a crystal breaks — modelled, not sprites, and flown
 * by the same one-uniform shader as the shards (one draw call per material):
 *   turf   football:   grass blades, turf clods
 *   fight  boxing:     hand-wrap ribbons (matte cloth) + sweat and blood drops (wet, stretched by speed)
 *   court  basketball: hardwood splinters, pebbled leather chips
 */

type Col = readonly [number, number, number];
type Part = { geometry: THREE.BufferGeometry; finish: 'matte' | 'wet'; power: number; stretch: number };

const v3 = () => new THREE.Vector3();

/** a random point on a shell around the crystal, optionally squashed toward the floor */
function shell(r: () => number, rMin: number, rMax: number, yBias = 0) {
  const d = axis(r);
  d.y = d.y * (1 - Math.abs(yBias)) + yBias * 0.5;
  return d.normalize().multiplyScalar(rMin + (rMax - rMin) * Math.sqrt(r()));
}

function quad(o: Out, a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, center: THREE.Vector3, spin: number[], col: Col) {
  const n = v3().subVectors(b, a).cross(v3().subVectors(d, a)).normalize();
  pushTri(o, a, b, c, n, center, spin, col);
  pushTri(o, a, c, d, n, center, spin, col);
}

/** a lumpy flat-shaded rock (clod, chip): an icosahedron with jittered corners */
function lump(o: Out, r: () => number, center: THREE.Vector3, size: number, squash: number, col: Col, spin: number[]) {
  const ico = new THREE.IcosahedronGeometry(1, 0).toNonIndexed();
  const p = ico.attributes.position!;
  const jitter = new Map<string, number>();
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < p.count; i++) {
    const v = v3().fromBufferAttribute(p, i);
    const key = v.toArray().map((x) => x.toFixed(3)).join();
    if (!jitter.has(key)) jitter.set(key, 0.7 + r() * 0.5);
    v.multiplyScalar(size * jitter.get(key)!);
    v.y *= squash;
    pts.push(v.add(center));
  }
  for (let i = 0; i < pts.length; i += 3) {
    const [a, b, c] = [pts[i]!, pts[i + 1]!, pts[i + 2]!];
    const n = v3().subVectors(b, a).cross(v3().subVectors(c, a)).normalize();
    const shade = 0.85 + r() * 0.3;
    pushTri(o, a, b, c, n, center, spin, [col[0] * shade, col[1] * shade, col[2] * shade]);
  }
  ico.dispose();
}

/** a round droplet with smooth normals (sweat, blood) */
function drop(o: Out, center: THREE.Vector3, size: number, col: Col, spin: number[]) {
  const ico = new THREE.IcosahedronGeometry(1, 1).toNonIndexed();
  const p = ico.attributes.position!;
  for (let i = 0; i < p.count; i += 3) {
    const n = [0, 1, 2].map((k) => v3().fromBufferAttribute(p, i + k));
    const [a, b, c] = n.map((v) => v.clone().multiplyScalar(size).add(center));
    pushTri(o, a!, b!, c!, n, center, spin, col);
  }
  ico.dispose();
}

/** a strip along a curve: grass blade (tapered, bent) or hand-wrap ribbon (curled) */
function strip(o: Out, pts: THREE.Vector3[], widths: number[], side: THREE.Vector3, center: THREE.Vector3, spin: number[], cols: Col[]) {
  for (let k = 0; k < pts.length - 1; k++) {
    const a = pts[k]!;
    const b = pts[k + 1]!;
    const wa = side.clone().multiplyScalar(widths[k]! / 2);
    const wb = side.clone().multiplyScalar(widths[k + 1]! / 2);
    quad(o, a.clone().sub(wa), b.clone().sub(wb), b.clone().add(wb), a.clone().add(wa), center, spin, cols[Math.min(k, cols.length - 1)]!);
  }
}

function turf(seed: number): Part[] {
  const r = rnd(seed);
  const o = out();
  for (let i = 0; i < 280; i++) {
    const center = shell(r, 0.55, 1.35, -0.25);
    const dir = axis(r);
    const side = v3().crossVectors(dir, axis(r)).normalize();
    const bend = v3().crossVectors(dir, side).normalize();
    const len = 0.2 + r() * 0.26;
    const curl = (r() - 0.5) * 0.5;
    const seg = 4;
    const pts: THREE.Vector3[] = [];
    const widths: number[] = [];
    for (let k = 0; k <= seg; k++) {
      const t = k / seg;
      pts.push(center.clone().addScaledVector(dir, (t - 0.5) * len).addScaledVector(bend, curl * t * t * len));
      widths.push((0.036 + r() * 0.014) * (1 - t * 0.85));
    }
    const g = 0.42 + r() * 0.22;
    const cols: Col[] = [
      [0.1, g * 0.62, 0.08],
      [0.16, g * 0.8, 0.1],
      [0.24, g, 0.13],
      [0.34, g * 1.12, 0.18],
    ];
    strip(o, pts, widths, side, center, [...axis(r).toArray(), r()], cols);
  }
  for (let i = 0; i < 44; i++) {
    const soil: Col = r() < 0.35 ? [0.16, 0.3, 0.1] : [0.26 + r() * 0.06, 0.18 + r() * 0.04, 0.11];
    lump(o, r, shell(r, 0.5, 1.15, -0.35), 0.035 + r() * 0.055, 0.75, soil, [...axis(r).toArray(), r()]);
  }
  return [{ geometry: toGeometry(o), finish: 'matte', power: 1.12, stretch: 0 }];
}

function fight(seed: number): Part[] {
  const r = rnd(seed);
  // hand wraps: long ribbons unwinding in curls
  const cloth = out();
  for (let i = 0; i < 9; i++) {
    const center = shell(r, 0.5, 1.0);
    const a = axis(r);
    const b = v3().crossVectors(a, axis(r)).normalize();
    const c = v3().crossVectors(a, b).normalize();
    const len = 0.8 + r() * 0.7;
    const rad = 0.16 + r() * 0.22;
    const turns = 0.6 + r() * 0.9;
    const seg = 26;
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= seg; k++) {
      const t = k / seg;
      const ang = t * turns * Math.PI * 2;
      // a loose helix: it reads as fabric peeling off a fist
      pts.push(
        center
          .clone()
          .addScaledVector(a, (t - 0.5) * len)
          .addScaledVector(b, Math.cos(ang) * rad * (0.4 + t))
          .addScaledVector(c, Math.sin(ang) * rad * (0.4 + t)),
      );
    }
    const tone: Col = i === 3 ? [0.1, 0.1, 0.11] : i === 6 ? [0.17, 0.35, 1] : [0.94, 0.93, 0.89];
    strip(cloth, pts, new Array(seg + 1).fill(0.075), c, center, [...axis(r).toArray(), r() * 0.4], [tone]);
  }
  // sweat (clear, pale) and a few drops of blood
  const wet = out();
  for (let i = 0; i < 120; i++) drop(wet, shell(r, 0.4, 1.25), 0.012 + Math.pow(r(), 2) * 0.034, [0.86, 0.92, 0.98], [...axis(r).toArray(), r()]);
  for (let i = 0; i < 30; i++) drop(wet, shell(r, 0.35, 1.0), 0.014 + Math.pow(r(), 1.6) * 0.04, [0.46, 0.015, 0.03], [...axis(r).toArray(), r()]);
  return [
    { geometry: toGeometry(cloth), finish: 'matte', power: 0.85, stretch: 0 },
    { geometry: toGeometry(wet), finish: 'wet', power: 1.25, stretch: 0.34 },
  ];
}

function court(seed: number): Part[] {
  const r = rnd(seed);
  const o = out();
  // maple floorboard splinters
  for (let i = 0; i < 70; i++) {
    const center = shell(r, 0.5, 1.3, -0.3);
    const dir = axis(r);
    const side = v3().crossVectors(dir, axis(r)).normalize();
    const up = v3().crossVectors(dir, side).normalize();
    const len = 0.12 + r() * 0.3;
    const w = 0.014 + r() * 0.018;
    const h = w * (0.5 + r() * 0.4);
    const tone = 0.85 + r() * 0.3;
    const col: Col = [0.8 * tone, 0.6 * tone, 0.38 * tone];
    const spin = [...axis(r).toArray(), r()];
    const P = (x: number, y: number, z: number) =>
      center
        .clone()
        .addScaledVector(dir, x * len * 0.5)
        .addScaledVector(side, y * w * 0.5 * (x > 0 ? 0.35 : 1))
        .addScaledVector(up, z * h * 0.5);
    // a tapered stick: it splinters to a point at one end
    quad(o, P(-1, -1, 1), P(1, -1, 1), P(1, 1, 1), P(-1, 1, 1), center, spin, col);
    quad(o, P(-1, 1, -1), P(1, 1, -1), P(1, -1, -1), P(-1, -1, -1), center, spin, [col[0] * 0.8, col[1] * 0.8, col[2] * 0.8]);
    quad(o, P(-1, -1, -1), P(1, -1, -1), P(1, -1, 1), P(-1, -1, 1), center, spin, [col[0] * 0.9, col[1] * 0.9, col[2] * 0.9]);
    quad(o, P(-1, 1, 1), P(1, 1, 1), P(1, 1, -1), P(-1, 1, -1), center, spin, [col[0] * 0.9, col[1] * 0.9, col[2] * 0.9]);
  }
  // pebbled leather chips, a few with a black seam colour
  for (let i = 0; i < 30; i++) {
    const col: Col = i % 7 === 0 ? [0.08, 0.07, 0.06] : [0.86, 0.38 + r() * 0.06, 0.12];
    lump(o, r, shell(r, 0.6, 1.2), 0.04 + r() * 0.05, 0.35, col, [...axis(r).toArray(), r()]);
  }
  return [{ geometry: toGeometry(o), finish: 'matte', power: 1.1, stretch: 0 }];
}

export type DebrisMesh = { mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>; uniforms: ReturnType<typeof flying> };

export function debris(kind: 'turf' | 'court' | 'fight' | undefined, spec: BurstSpec, env: THREE.Texture | null, seed: number): DebrisMesh[] {
  if (!kind) return [];
  const parts = kind === 'turf' ? turf(seed) : kind === 'fight' ? fight(seed) : court(seed);
  return parts.map((p, i) => {
    const wet = p.finish === 'wet';
    const material = new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      roughness: wet ? 0.08 : 0.62,
      metalness: 0,
      clearcoat: wet ? 1 : 0,
      clearcoatRoughness: 0.05,
      sheen: wet ? 0 : 0.4,
      envMap: env,
      envMapIntensity: wet ? 1.8 : 0.9,
      flatShading: !wet,
    });
    const uniforms = flying(material, { ...spec, stretch: p.stretch }, `smadi-debris-${p.finish}`, p.power);
    const mesh = new THREE.Mesh(p.geometry, material);
    mesh.name = `debris-${kind}-${i}`;
    mesh.visible = false;
    mesh.frustumCulled = false;
    return { mesh, uniforms };
  });
}
