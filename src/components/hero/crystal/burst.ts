import * as THREE from 'three';
import { ConvexHull } from 'three/examples/jsm/math/ConvexHull.js';

/**
 * The break-out. Each crystal is pre-fractured into real solid pieces (a 3D Voronoi of its
 * convex hull, denser around the impact point); the water orb becomes droplets instead.
 * All pieces live in ONE mesh: the flight (drag, gravity, spin, droplet stretch) runs in the
 * vertex shader from a single age uniform, so the explosion costs one draw call.
 */

export interface BurstSpec {
  pieces: number;
  power: number;
  drag: number;
  gravity: number;
  spin: number;
  bias: [number, number, number];
  stretch: number;
  impact: [number, number, number];
  spray: string;
  shake: number;
  life: number;
}

type Face = THREE.Vector3[];

export function rnd(seed: number) {
  let a = seed;
  return () => ((a = (a * 16807) % 2147483647) / 2147483647);
}

/** keep the part of a convex polyhedron with n·p <= d, closing the cut with a cap */
function clip(faces: Face[], n: THREE.Vector3, d: number): Face[] {
  const EPS = 1e-7;
  const out: Face[] = [];
  const cut: THREE.Vector3[] = [];
  let clipped = false;
  for (const f of faces) {
    const res: THREE.Vector3[] = [];
    for (let i = 0; i < f.length; i++) {
      const a = f[i]!;
      const b = f[(i + 1) % f.length]!;
      const da = n.dot(a) - d;
      const db = n.dot(b) - d;
      if (da > EPS) clipped = true;
      if (da <= EPS) res.push(a);
      if (Math.abs(da) <= EPS) cut.push(a);
      if ((da < -EPS && db > EPS) || (da > EPS && db < -EPS)) {
        const p = a.clone().lerp(b, da / (da - db));
        res.push(p);
        cut.push(p);
      }
    }
    if (res.length >= 3) out.push(res);
  }
  if (!clipped) return faces;
  const cap: THREE.Vector3[] = [];
  for (const p of cut) if (!cap.some((q) => q.distanceToSquared(p) < 1e-12)) cap.push(p);
  if (cap.length >= 3) {
    const c = cap.reduce((s, p) => s.add(p), new THREE.Vector3()).multiplyScalar(1 / cap.length);
    const u = cap[0]!.clone().sub(c).normalize();
    const v = new THREE.Vector3().crossVectors(n, u);
    const ang = (p: THREE.Vector3) => {
      const q = p.clone().sub(c);
      return Math.atan2(q.dot(v), q.dot(u));
    };
    cap.sort((a, b) => ang(a) - ang(b));
    out.push(cap);
  }
  return out;
}

function boxFaces(min: THREE.Vector3, max: THREE.Vector3): Face[] {
  const P = (x: number, y: number, z: number) => new THREE.Vector3(x ? max.x : min.x, y ? max.y : min.y, z ? max.z : min.z);
  return [
    [P(0, 0, 0), P(0, 1, 0), P(1, 1, 0), P(1, 0, 0)],
    [P(0, 0, 1), P(1, 0, 1), P(1, 1, 1), P(0, 1, 1)],
    [P(0, 0, 0), P(0, 0, 1), P(0, 1, 1), P(0, 1, 0)],
    [P(1, 0, 0), P(1, 1, 0), P(1, 1, 1), P(1, 0, 1)],
    [P(0, 0, 0), P(1, 0, 0), P(1, 0, 1), P(0, 0, 1)],
    [P(0, 1, 0), P(0, 1, 1), P(1, 1, 1), P(1, 1, 0)],
  ];
}

export interface Out {
  pos: number[];
  nrm: number[];
  uv: number[];
  center: number[];
  spin: number[];
  col: number[];
}

export const out = (): Out => ({ pos: [], nrm: [], uv: [], center: [], spin: [], col: [] });

const WHITE = [1, 1, 1] as const;

export function pushTri(
  o: Out,
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
  n: THREE.Vector3[] | THREE.Vector3,
  center: THREE.Vector3,
  spin: number[],
  col: readonly number[] = WHITE,
) {
  const pts = [a, b, c];
  for (let k = 0; k < 3; k++) {
    const p = pts[k]!;
    const nn = Array.isArray(n) ? n[k]! : n;
    o.pos.push(p.x, p.y, p.z);
    o.nrm.push(nn.x, nn.y, nn.z);
    o.uv.push(p.x * 0.5 + 0.5 + p.z * 0.3, p.y * 0.5 + 0.5);
    o.center.push(center.x, center.y, center.z);
    o.spin.push(spin[0]!, spin[1]!, spin[2]!, spin[3]!);
    o.col.push(col[0]!, col[1]!, col[2]!);
  }
}

export function axis(r: () => number) {
  const v = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5);
  if (v.lengthSq() < 1e-4) v.set(0, 1, 0);
  return v.normalize();
}

export function toGeometry(o: Out) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('color', new THREE.Float32BufferAttribute(o.col, 3));
  g.setAttribute('position', new THREE.Float32BufferAttribute(o.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(o.nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(o.uv, 2));
  g.setAttribute('aCenter', new THREE.Float32BufferAttribute(o.center, 3));
  g.setAttribute('aSpin', new THREE.Float32BufferAttribute(o.spin, 4));
  g.computeBoundingSphere();
  if (g.boundingSphere) g.boundingSphere.radius += 30; // pieces fly far: never frustum-cull mid-flight
  return g;
}

/** solid Voronoi shards of a crystal's convex hull */
export function fracture(source: THREE.BufferGeometry, spec: BurstSpec, seed: number) {
  const r = rnd(seed);
  const p = source.attributes.position!;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < p.count; i++) pts.push(new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i)));
  const hull = new ConvexHull().setFromPoints(pts);
  const planes = hull.faces.map((f) => [f.normal.clone(), f.constant] as const);
  const box = new THREE.Box3().setFromPoints(pts);
  let solid = boxFaces(box.min.clone().addScalar(-0.01), box.max.clone().addScalar(0.01));
  for (const [n, d] of planes) solid = clip(solid, n, d);

  const inside = (q: THREE.Vector3) => planes.every(([n, d]) => n.dot(q) - d < -0.03);
  const impact = new THREE.Vector3(...spec.impact);
  const size = box.getSize(new THREE.Vector3());
  const seeds: THREE.Vector3[] = [];
  const minD = Math.cbrt((size.x * size.y * size.z) / spec.pieces) * 0.32;
  for (let tries = 0; seeds.length < spec.pieces && tries < 8000; tries++) {
    const q =
      r() < 0.45
        ? impact.clone().add(new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(0.9))
        : new THREE.Vector3(box.min.x + r() * size.x, box.min.y + r() * size.y, box.min.z + r() * size.z);
    if (inside(q) && seeds.every((s) => s.distanceTo(q) > minD)) seeds.push(q);
  }

  const o = out();
  const n = new THREE.Vector3();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  seeds.forEach((s, i) => {
    let cell = solid;
    const others = seeds.filter((_, j) => j !== i).sort((a, b) => a.distanceToSquared(s) - b.distanceToSquared(s));
    for (const q of others) {
      const nn = q.clone().sub(s).normalize();
      cell = clip(cell, nn, nn.dot(q.clone().add(s).multiplyScalar(0.5)));
      if (!cell.length) return;
    }
    const verts = cell.flat();
    const c = verts.reduce((acc, v) => acc.add(v), new THREE.Vector3()).multiplyScalar(1 / verts.length);
    const spin = [...axis(r).toArray(), r()];
    for (const f of cell) {
      const fc = f.reduce((acc, v) => acc.add(v), new THREE.Vector3()).multiplyScalar(1 / f.length);
      const shrunk = f.map((v) => v.clone().lerp(c, 0.015));
      for (let k = 1; k < shrunk.length - 1; k++) {
        const a = shrunk[0]!;
        let b = shrunk[k]!;
        let d = shrunk[k + 1]!;
        n.crossVectors(e1.subVectors(b, a), e2.subVectors(d, a));
        if (n.lengthSq() < 1e-14) continue;
        if (n.dot(fc.clone().sub(c)) < 0) [b, d] = [d, b];
        n.crossVectors(e1.subVectors(b, a), e2.subVectors(d, a)).normalize();
        pushTri(o, a, b, d, n, c, spin);
      }
    }
  });
  return toGeometry(o);
}

/** the water orb bursts into droplets */
export function droplets(radius: number, spec: BurstSpec, seed: number) {
  const r = rnd(seed);
  const ico = new THREE.IcosahedronGeometry(1, 1).toNonIndexed();
  const ip = ico.attributes.position!;
  const o = out();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let k = 0; k < spec.pieces; k++) {
    const dir = axis(r);
    const center = dir.clone().multiplyScalar(radius * (0.55 + 0.45 * Math.sqrt(r())));
    const s = 0.045 + Math.pow(r(), 2.2) * 0.15;
    const spin = [...axis(r).toArray(), r()];
    for (let i = 0; i < ip.count; i += 3) {
      a.fromBufferAttribute(ip, i);
      b.fromBufferAttribute(ip, i + 1);
      c.fromBufferAttribute(ip, i + 2);
      pushTri(
        o,
        a.clone().multiplyScalar(s).add(center),
        b.clone().multiplyScalar(s).add(center),
        c.clone().multiplyScalar(s).add(center),
        [a.clone(), b.clone(), c.clone()],
        center,
        spin,
      );
    }
  }
  ico.dispose();
  return toGeometry(o);
}

const HEAD = /* glsl */ `
  attribute vec3 aCenter;
  attribute vec4 aSpin;
  uniform float uAge;
  uniform float uPower;
  uniform float uDrag;
  uniform vec3 uGrav;
  uniform float uSpinAmt;
  uniform vec3 uBias;
  uniform float uStretch;
  uniform float uLife;
  vec3 bRot(vec3 v, vec3 k, float a) { float c = cos(a); float s = sin(a); return v * c + cross(k, v) * s + k * dot(k, v) * (1.0 - c); }
`;
const NORMAL = /* glsl */ `
  float bAge = max(uAge, 0.0);
  float bK = (1.0 - exp(-uDrag * bAge)) / uDrag;
  vec3 bAxis = normalize(aSpin.xyz + vec3(1e-4));
  float bAng = uSpinAmt * (0.35 + aSpin.w) * bK;
  vec3 objectNormal = bRot(vec3(normal), bAxis, bAng);
  #ifdef USE_TANGENT
    vec3 objectTangent = vec3(tangent.xyz);
  #endif
`;
const BEGIN = /* glsl */ `
  vec3 bDir = normalize(aCenter + vec3(1e-4, 2e-4, 3e-4));
  vec3 bVel = (bDir * (0.55 + aSpin.w * 0.9) + uBias * (0.6 + aSpin.w * 0.5)) * uPower;
  vec3 bLocal = bRot(position - aCenter, bAxis, bAng);
  vec3 bNow = bVel * exp(-uDrag * bAge) + uGrav * bAge;
  float bSp = length(bNow);
  if (uStretch > 0.0 && bSp > 0.001) {
    vec3 vd = bNow / bSp;
    bLocal += vd * dot(bLocal, vd) * min(2.2, bSp * uStretch);
  }
  float bScale = 1.0 - smoothstep(uLife * 0.4, uLife, bAge * (0.7 + aSpin.w * 0.6));
  vec3 transformed = aCenter + bVel * bK + 0.5 * uGrav * bAge * bAge + bLocal * bScale;
`;

/** teach any lit material to fly apart along the burst (one age uniform drives every piece) */
export function flying<M extends THREE.Material>(m: M, spec: BurstSpec, key: string, power = 1) {
  const uniforms = {
    uAge: { value: -1 },
    uPower: { value: spec.power * power },
    uDrag: { value: spec.drag },
    uGrav: { value: new THREE.Vector3(0, -spec.gravity, 0) },
    uSpinAmt: { value: spec.spin },
    uBias: { value: new THREE.Vector3(...spec.bias) },
    uStretch: { value: spec.stretch },
    uLife: { value: spec.life },
  };
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, uniforms);
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>\n${HEAD}`)
      .replace('#include <beginnormal_vertex>', NORMAL)
      .replace('#include <begin_vertex>', BEGIN);
  };
  m.customProgramCacheKey = () => key;
  return uniforms;
}

/**
 * The football's ice shell pops along its own panels: each pentagon / hexagon becomes a thick tile
 * (outer face, inner face, rim) carrying its panel colour, so the ball's pattern flies apart intact.
 */
export function panelShards(panels: { pts: THREE.Vector3[]; col: readonly number[] }[], seed: number, depth = 0.8) {
  const r = rnd(seed);
  const o = out();
  const n = new THREE.Vector3();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const tri = (a: THREE.Vector3, b: THREE.Vector3, d: THREE.Vector3, c: THREE.Vector3, spin: number[], col: readonly number[]) => {
    n.crossVectors(e1.subVectors(b, a), e2.subVectors(d, a));
    if (n.lengthSq() < 1e-14) return;
    const fc = a.clone().add(b).add(d).multiplyScalar(1 / 3);
    if (n.dot(fc.sub(c)) < 0) [b, d] = [d, b];
    n.crossVectors(e1.subVectors(b, a), e2.subVectors(d, a)).normalize();
    pushTri(o, a, b, d, n.clone(), c, spin, col);
  };
  for (const { pts, col } of panels) {
    const outer = pts.map((v) => v.clone().multiplyScalar(0.985));
    const inner = pts.map((v) => v.clone().multiplyScalar(depth));
    const c = [...outer, ...inner].reduce((s, v) => s.add(v), new THREE.Vector3()).multiplyScalar(1 / (outer.length * 2));
    const spin = [...axis(r).toArray(), r()];
    for (let k = 1; k < outer.length - 1; k++) {
      tri(outer[0]!, outer[k]!, outer[k + 1]!, c, spin, col);
      tri(inner[0]!, inner[k + 1]!, inner[k]!, c, spin, col);
    }
    for (let k = 0; k < outer.length; k++) {
      const k2 = (k + 1) % outer.length;
      tri(outer[k]!, outer[k2]!, inner[k2]!, c, spin, col);
      tri(outer[k]!, inner[k2]!, inner[k]!, c, spin, col);
    }
  }
  return toGeometry(o);
}

/** the crystal's own glass, taught to fly apart */
export function shardMaterial(base: THREE.MeshPhysicalMaterial, spec: BurstSpec, flat: boolean) {
  const m = base.clone();
  m.flatShading = flat;
  // thin, bright, wet-looking glass: more of the studio in every facet
  m.thickness = Math.min(m.thickness, 0.16);
  m.roughness = 0;
  m.envMapIntensity = 2.1;
  m.clearcoat = 1;
  m.clearcoatRoughness = 0.02;
  if (m.normalMap) m.normalScale.multiplyScalar(0.6);
  const uniforms = flying(m, spec, 'smadi-shards');
  return { material: m, uniforms };
}

const SPRAY_VS = /* glsl */ `
  uniform float uAge;
  uniform float uPower;
  uniform float uDrag;
  uniform vec3 uGrav;
  uniform float uPixel;
  uniform float uSize;
  uniform float uLife;
  attribute vec3 aDir;
  attribute float aSeed;
  varying float vA;
  void main() {
    float age = max(uAge, 0.0);
    float dr = uDrag * 1.7;
    float k = (1.0 - exp(-dr * age)) / dr;
    vec3 p = aDir * (0.25 + aSeed * 0.8) + aDir * uPower * (0.5 + aSeed * 1.9) * k + 0.18 * uGrav * age * age;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uPixel * (0.35 + fract(aSeed * 13.7)) / -mv.z;
    float life = uLife * (0.35 + aSeed * 0.65);
    vA = uAge < 0.0 ? 0.0 : (1.0 - smoothstep(0.0, life, age)) * smoothstep(0.0, 0.03, age);
  }
`;
const SPRAY_FS = /* glsl */ `
  uniform vec3 uColor;
  varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    a = a * a * 0.8 + smoothstep(0.16, 0.0, d) * 0.6;
    gl_FragColor = vec4(uColor, a * vA);
  }
`;

/** powder / glass dust / spray / sparks thrown out with the pieces */
export function spray(spec: BurstSpec, seed: number, count = 420) {
  const r = rnd(seed);
  const dir = new Float32Array(count * 3);
  const s = new Float32Array(count);
  const bias = new THREE.Vector3(...spec.bias).multiplyScalar(0.5);
  for (let i = 0; i < count; i++) {
    const v = axis(r).add(bias).normalize();
    dir.set([v.x, v.y, v.z], i * 3);
    s[i] = r();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute('aDir', new THREE.BufferAttribute(dir, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(s, 1));
  const uniforms = {
    uAge: { value: -1 },
    uPower: { value: spec.power },
    uDrag: { value: spec.drag },
    uGrav: { value: new THREE.Vector3(0, -spec.gravity, 0) },
    uPixel: { value: 1 },
    uSize: { value: 0.07 },
    uLife: { value: spec.life * 0.9 },
    uColor: { value: new THREE.Color(spec.spray) },
  };
  const m = new THREE.ShaderMaterial({
    vertexShader: SPRAY_VS,
    fragmentShader: SPRAY_FS,
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  return { points: pts, uniforms };
}
