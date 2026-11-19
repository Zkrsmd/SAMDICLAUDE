import * as THREE from 'three';
import { ocean, type OceanMesh } from './ocean';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { backdropTex, beamTex, causticTex, concreteGround, crackNormal, frostGround, frostNormal, rippleNormal, shadowTex, tileGround, woodGround } from './textures';
import type { BurstSpec } from './burst';
import { ConvexHull } from 'three/examples/jsm/math/ConvexHull.js';

/**
 * The four worlds. Same grammar — a real product frozen inside a crystal that then BREAKS,
 * a survey network, a coded set and light through haze — but each sport gets its own matter:
 *   football   PERMAFROST  a frozen football pops along its panels in a floodlit bowl: turf, grass, chalk
 *   boxing     IMPACT      a glass slab is punched out toward you under the ring rig: sweat, blood, wraps
 *   swimming   ABYSS       a water orb pops into droplets under the surface, god rays, bubbles
 *   basketball COURT       a seamed amber glass ball cracks open in a morning gym: hardwood, leather, sparks
 */

export type ParticleKind = 'snow' | 'dust' | 'bubbles' | 'motes';

export interface WorldSpec {
  id: string;
  word: string;
  code: string;
  product: string;
  sky: [string, string];
  fog: string;
  light: string;
  ground: () => THREE.Texture;
  groundTint: string;
  crystal: 'shard' | 'slab' | 'orb' | 'gem' | 'ball' | 'hoop';
  /** sport matter thrown out with the glass */
  debris?: 'turf' | 'court' | 'fight';
  material: Partial<THREE.MeshPhysicalMaterialParameters> & { normal?: 'frost' | 'cracks' | 'ripple' };
  productWidth: number;
  particles: { kind: ParticleKind; count: number; size: number; color: string };
  readout: { label: string; base: [number, number]; unit: string };
  burst: BurstSpec;
  /** additive light shafts in the scene: source x/y/z, tilt, width, length, strength */
  beams: [number, number, number, number, number, number, number][];
}

export const WORLDS: Record<string, WorldSpec> = {
  football: {
    id: 'football',
    word: 'Football',
    code: 'PERMAFROST',
    product: 'nike-mercurial-vapor-17-elite-vini-jr-fg',
    sky: ['#6E7884', '#B3BBC6'],
    fog: '#A3ACB8',
    light: '#EAF2FF',
    ground: frostGround,
    groundTint: '#A9B3BF',
    crystal: 'ball',
    debris: 'turf',
    material: { ior: 1.31, thickness: 0.3, roughness: 0.05, attenuationColor: new THREE.Color('#D6E8F4'), attenuationDistance: 3.2, dispersion: 0.12, normal: 'frost' },
    productWidth: 1.7,
    particles: { kind: 'snow', count: 420, size: 0.05, color: '#FFFFFF' },
    readout: { label: 'TEMP', base: [-4.12, 1.36], unit: '°C' },
    burst: { pieces: 32, power: 3.6, drag: 1.5, gravity: 3.6, spin: 7, bias: [0, 0.45, 0.6], stretch: 0, impact: [0.15, 0.4, 0.3], spray: '#F4FFF0', shake: 0.09, life: 2.3 },
    beams: [
      [-5.6, 5.4, -5, 0.6, 2.8, 13, 0.22],
      [5.6, 5.4, -5, -0.6, 2.8, 13, 0.22],
      [-4.2, 5.8, -7, 0.35, 1.6, 13, 0.12],
    ],
  },
  boxing: {
    id: 'boxing',
    word: 'Boxing',
    code: 'IMPACT',
    product: 'venum-giant-20-mike-tyson-pro-boxing-gloves-blackgold',
    sky: ['#77706A', '#B9B1A7'],
    fog: '#A8A096',
    light: '#FFF1DC',
    ground: concreteGround,
    groundTint: '#ABA398',
    crystal: 'slab',
    debris: 'fight',
    material: { ior: 1.52, thickness: 0.22, roughness: 0.03, attenuationColor: new THREE.Color('#E0D2B8'), attenuationDistance: 2.6, dispersion: 0.1, normal: 'cracks' },
    productWidth: 1.25,
    particles: { kind: 'dust', count: 320, size: 0.035, color: '#FFE9C8' },
    readout: { label: 'FORCE', base: [3.84, 0.42], unit: 'kN' },
    burst: { pieces: 34, power: 4.0, drag: 1.7, gravity: 3.4, spin: 8, bias: [0, 0.15, 0.95], stretch: 0, impact: [0.1, 0.3, 0.3], spray: '#FFE7C6', shake: 0.13, life: 2.0 },
    beams: [
      [0, 6.2, -1.6, 0, 4.6, 9.5, 0.24],
      [-0.9, 6.2, -2.4, 0.12, 2.2, 9.5, 0.1],
      [0.9, 6.2, -2.4, -0.12, 2.2, 9.5, 0.1],
    ],
  },
  swimming: {
    id: 'swimming',
    word: 'Swimming',
    code: 'ABYSS',
    product: 'speedo-fastskin-speed-socket-20-mirrored-goggles-orangegold',
    sky: ['#647D85', '#ABC0C5'],
    fog: '#9AB0B6',
    light: '#E6FBFF',
    ground: tileGround,
    groundTint: '#A2B9BE',
    crystal: 'orb',
    material: { ior: 1.33, thickness: 0.45, roughness: 0.0, attenuationColor: new THREE.Color('#B4E6EE'), attenuationDistance: 3.4, dispersion: 0.12, normal: 'ripple' },
    productWidth: 1.5,
    particles: { kind: 'bubbles', count: 220, size: 0.075, color: '#FFFFFF' },
    readout: { label: 'DEPTH', base: [2.4, 0.18], unit: 'M' },
    burst: { pieces: 110, power: 2.9, drag: 1.3, gravity: 5.5, spin: 2, bias: [0, 0.9, 0.3], stretch: 0.32, impact: [0, 0, 0], spray: '#E6FBFF', shake: 0.05, life: 2.2 },
    beams: [
      [-4.4, 6, -6.5, 0.1, 1.2, 14, 0.12],
      [-2.2, 6, -6, 0.05, 1.8, 14, 0.14],
      [0.2, 6, -6.4, -0.02, 1.4, 14, 0.12],
      [2.4, 6, -6, -0.06, 2, 14, 0.14],
      [4.6, 6, -6.5, -0.1, 1.2, 14, 0.12],
    ],
  },
  basketball: {
    id: 'basketball',
    word: 'Basketball',
    code: 'COURT',
    product: 'wilson-2026-nba-finals-championship-basketball-new-york-knicks',
    sky: ['#7C7268', '#BDB3A6'],
    fog: '#ADA397',
    light: '#FFF0E0',
    ground: woodGround,
    groundTint: '#B2A797',
    crystal: 'hoop',
    debris: 'court',
    material: { ior: 1.45, thickness: 0.34, roughness: 0.03, attenuationColor: new THREE.Color('#F6D9B8'), attenuationDistance: 3.6, dispersion: 0.25 },
    productWidth: 1.15,
    particles: { kind: 'motes', count: 260, size: 0.03, color: '#FFF4E4' },
    readout: { label: 'RIM', base: [3.05, 0.0], unit: 'M' },
    burst: { pieces: 26, power: 3.8, drag: 1.3, gravity: 5.2, spin: 10, bias: [0, 1.0, 0.25], stretch: 0, impact: [0, -0.7, 0.2], spray: '#FFB774', shake: 0.1, life: 2.3 },
    beams: [
      [-6.4, 6.4, -7, 0.62, 1.6, 15, 0.16],
      [-4.6, 6.4, -7, 0.62, 1.6, 15, 0.14],
      [-2.8, 6.4, -7, 0.62, 1.6, 15, 0.12],
    ],
  },
};

/* ---------------------------------------------------------------- geometry */

function planarUV(g: THREE.BufferGeometry, scale = 0.5) {
  const p = g.attributes.position!;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    uv[i * 2] = p.getX(i) * scale + 0.5 + p.getZ(i) * 0.3;
    uv[i * 2 + 1] = p.getY(i) * scale + 0.5;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

function rnd(seed: number) {
  let a = seed;
  return () => ((a = (a * 16807) % 2147483647) / 2147483647);
}

/* the football: a truncated icosahedron (12 pentagons, 20 hexagons) — a real ball's panel layout */
const PHI = (1 + Math.sqrt(5)) / 2;
const SMOKE = [0.16, 0.19, 0.24] as const;
const ICE = [1, 1, 1] as const;
export type Panel = { pts: THREE.Vector3[]; col: readonly number[] };

function footballPanels(radius: number): Panel[] {
  const base = [
    [0, 1, 3 * PHI],
    [1, 2 + PHI, 2 * PHI],
    [PHI, 2, PHI * PHI * PHI],
  ];
  const pts: THREE.Vector3[] = [];
  for (const [a, b, c] of base) {
    for (const [x, y, z] of [
      [a, b, c],
      [b, c, a],
      [c, a, b],
    ] as const)
      for (const sx of [-1, 1])
        for (const sy of [-1, 1])
          for (const sz of [-1, 1]) {
            const v = new THREE.Vector3(x! * sx, y! * sy, z! * sz);
            if (!pts.some((q) => q.distanceToSquared(v) < 1e-6)) pts.push(v);
          }
  }
  const scale = radius / pts[0]!.length();
  pts.forEach((v) => v.multiplyScalar(scale));
  // group the hull's triangles into flat panels
  const hull = new ConvexHull().setFromPoints(pts);
  const groups: { n: THREE.Vector3; vs: THREE.Vector3[] }[] = [];
  for (const f of hull.faces) {
    let g = groups.find((q) => q.n.dot(f.normal) > 0.999);
    if (!g) groups.push((g = { n: f.normal.clone(), vs: [] }));
    let e = f.edge;
    do {
      const v = e.head().point;
      if (!g.vs.some((q) => q.distanceToSquared(v) < 1e-8)) g.vs.push(v.clone());
      e = e.next;
    } while (e !== f.edge);
  }
  return groups.map(({ n, vs }) => {
    const c = vs.reduce((s, v) => s.add(v), new THREE.Vector3()).multiplyScalar(1 / vs.length);
    const u = vs[0]!.clone().sub(c).normalize();
    const w = new THREE.Vector3().crossVectors(n, u);
    vs.sort((a, b) => Math.atan2(a.clone().sub(c).dot(w), a.clone().sub(c).dot(u)) - Math.atan2(b.clone().sub(c).dot(w), b.clone().sub(c).dot(u)));
    return { pts: vs, col: vs.length === 5 ? SMOKE : ICE };
  });
}

/** basketball seams on the unit sphere: two great circles and the two bowed side curves */
export function seamAt(x: number, y: number, z: number) {
  const s = Math.min(Math.abs(x), Math.abs(y), Math.abs(Math.abs(z) - (0.62 + 0.3 * y * y)));
  return 1 - THREE.MathUtils.smoothstep(s, 0.018, 0.034);
}

/** equirect amber-glass texture with black seams for the basketball's sphere UVs */
function seamTex() {
  const W = 1024;
  const H = 512;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  for (let j = 0; j < H; j++) {
    const th = (j / H) * Math.PI;
    for (let i = 0; i < W; i++) {
      const ph = (i / W) * Math.PI * 2;
      // three.js SphereGeometry: x = -cos(phi) sin(theta), y = cos(theta), z = sin(phi) sin(theta)
      const x = -Math.cos(ph) * Math.sin(th);
      const y = Math.cos(th);
      const z = Math.sin(ph) * Math.sin(th);
      const k = seamAt(x, y, z);
      const o = (j * W + i) * 4;
      img.data[o] = 255 - k * 236;
      img.data[o + 1] = 205 - k * 192;
      img.data[o + 2] = 160 - k * 150;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function crystalGeometry(kind: WorldSpec['crystal']): THREE.BufferGeometry {
  if (kind === 'ball') {
    const panels = footballPanels(1.22);
    const pos: number[] = [];
    const col: number[] = [];
    for (const { pts, col: c } of panels)
      for (let k = 1; k < pts.length - 1; k++)
        for (const v of [pts[0]!, pts[k]!, pts[k + 1]!]) {
          pos.push(v.x, v.y, v.z);
          col.push(c[0]!, c[1]!, c[2]!);
        }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    planarUV(g);
    g.userData.panels = panels;
    return g;
  }
  if (kind === 'hoop') return new THREE.SphereGeometry(1.2, 96, 64);
  if (kind === 'shard') {
    let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, 1);
    g.deleteAttribute('normal');
    g.deleteAttribute('uv');
    g = mergeVertices(g);
    const p = g.attributes.position!;
    const r = rnd(7);
    for (let i = 0; i < p.count; i++) {
      const v = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i));
      const n = v.clone().normalize();
      v.addScaledVector(n, (r() - 0.5) * 0.28);
      // long, flattened, slightly leaning rock crystal
      v.set(v.x * 0.88, v.y * 1.42 + v.x * 0.12, v.z * 0.7);
      if (v.y > 1.1) v.x *= 0.7;
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g = g.toNonIndexed();
    g.computeVertexNormals();
    planarUV(g);
    return g;
  }
  if (kind === 'slab') {
    const g = new RoundedBoxGeometry(1.75, 2.15, 0.62, 3, 0.09);
    return g;
  }
  if (kind === 'orb') {
    const g = new THREE.SphereGeometry(1.18, 72, 54);
    return g;
  }
  // gem: a brilliant-ish cut lathed with few segments, flat shaded
  const profile = [
    new THREE.Vector2(0.0001, -1.5),
    new THREE.Vector2(0.62, -0.75),
    new THREE.Vector2(1.12, 0.02),
    new THREE.Vector2(1.16, 0.16),
    new THREE.Vector2(0.78, 0.66),
    new THREE.Vector2(0.0001, 0.74),
  ];
  let g: THREE.BufferGeometry = new THREE.LatheGeometry(profile, 9);
  g = g.toNonIndexed();
  g.computeVertexNormals();
  return g;
}

export function crystalMaterial(spec: WorldSpec, env: THREE.Texture | null) {
  const { normal, ...m } = spec.material;
  const mat = new THREE.MeshPhysicalMaterial({
    color: '#FFFFFF',
    metalness: 0,
    transmission: 1,
    specularIntensity: 1,
    envMapIntensity: 1.6,
    clearcoat: spec.crystal === 'shard' ? 0.4 : 0.8,
    clearcoatRoughness: 0.08,
    envMap: env,
    flatShading: spec.crystal === 'shard' || spec.crystal === 'gem' || spec.crystal === 'ball',
    vertexColors: spec.crystal === 'ball',
    ...m,
  });
  if (spec.crystal === 'hoop') mat.map = seamTex();
  if (normal) {
    mat.normalMap = normal === 'frost' ? frostNormal() : normal === 'cracks' ? crackNormal() : rippleNormal();
    const s = normal === 'cracks' ? 0.75 : normal === 'frost' ? 0.3 : 0.2;
    mat.normalScale = new THREE.Vector2(s, s);
    mat.normalMap.repeat.set(normal === 'cracks' ? 1 : 1.6, normal === 'cracks' ? 1 : 1.6);
  }
  return mat;
}

/* ---------------------------------------------------------------- particles */

const PARTICLE_VS = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform float uKind;
  uniform float uPixel;
  attribute float aSeed;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    float s = aSeed;
    if (uKind < 0.5) {            // snow: falls, sways
      p.y = mod(p.y - uTime * (0.25 + s * 0.35) + 4.0, 8.0) - 4.0;
      p.x += sin(uTime * 0.7 + s * 30.0) * 0.25;
    } else if (uKind < 1.5) {     // dust: slow drift, spirals
      float a = uTime * (0.05 + s * 0.08) + s * 40.0;
      p.x += cos(a) * 0.4;
      p.z += sin(a) * 0.4;
      p.y = mod(p.y - uTime * (0.06 + s * 0.08) + 4.0, 8.0) - 4.0;
    } else if (uKind < 2.5) {     // bubbles: rise and wobble
      p.y = mod(p.y + uTime * (0.35 + s * 0.6) + 4.0, 8.0) - 4.0;
      p.x += sin(uTime * 2.0 + s * 50.0) * 0.08;
    } else {                      // motes: hover in the light
      p.y += sin(uTime * 0.5 + s * 20.0) * 0.25;
      p.x += cos(uTime * 0.3 + s * 10.0) * 0.25;
    }
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uPixel * (0.35 + s * 0.9) / -mv.z;
    vAlpha = smoothstep(4.0, 3.0, abs(p.y)) * (0.35 + 0.65 * fract(s * 7.13));
  }
`;
const PARTICLE_FS = /* glsl */ `
  uniform vec3 uColor;
  uniform float uKind;
  uniform float uOpacity;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float a;
    if (uKind > 1.5 && uKind < 2.5) {
      a = smoothstep(0.5, 0.42, d) * (0.25 + smoothstep(0.32, 0.46, d) * 0.9);
      a += smoothstep(0.14, 0.0, length(c - vec2(-0.15, -0.15))) * 0.9;
    } else {
      a = smoothstep(0.5, 0.0, d);
      a *= a;
    }
    gl_FragColor = vec4(uColor, a * vAlpha * uOpacity);
  }
`;

export function particles(spec: WorldSpec) {
  const { count, size, color, kind } = spec.particles;
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  const r = rnd(count * 13 + spec.id.length);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (r() - 0.5) * 12;
    pos[i * 3 + 1] = (r() - 0.5) * 8;
    pos[i * 3 + 2] = (r() - 0.5) * 9 - 1.5;
    seed[i] = r();
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const m = new THREE.ShaderMaterial({
    vertexShader: PARTICLE_VS,
    fragmentShader: PARTICLE_FS,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uSize: { value: size },
      uKind: { value: { snow: 0, dust: 1, bubbles: 2, motes: 3 }[kind] },
      uPixel: { value: 1 },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: 1 },
    },
  });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  return pts;
}

/* ---------------------------------------------------------------- survey network */

export function network(seed: number) {
  const r = rnd(seed);
  const nodes: THREE.Vector3[] = [];
  while (nodes.length < 24) {
    const a = r() * Math.PI * 2;
    const rad = 1.9 + r() * 1.5;
    const v = new THREE.Vector3(Math.cos(a) * rad, -1.2 + r() * 3.2, Math.sin(a) * rad * 0.55 - 0.4);
    if (nodes.every((n) => n.distanceTo(v) > 0.7)) nodes.push(v);
  }
  const seg: number[] = [];
  nodes.forEach((n, i) => {
    const near = nodes
      .map((m, j) => [j, n.distanceTo(m)] as const)
      .filter(([j]) => j !== i)
      .sort((a, b) => a[1] - b[1])
      .slice(0, 2);
    for (const [j] of near) if (j > i || r() < 0.4) seg.push(n.x, n.y, n.z, nodes[j]!.x, nodes[j]!.y, nodes[j]!.z);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
  const lines = new THREE.LineSegments(
    g,
    new THREE.LineBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.5, depthWrite: false, fog: false }),
  );
  const labels = nodes.map(() => String(10 + Math.floor(r() * 89)));
  return { lines, nodes, labels, segments: seg.length / 6 };
}

/* ---------------------------------------------------------------- environment */

export function environment(spec: WorldSpec, fontFamily: string, film = false) {
  const group = new THREE.Group();
  const back = new THREE.Mesh(
    new THREE.PlaneGeometry(64, 32),
    new THREE.MeshBasicMaterial({ map: backdropTex(spec.word, [spec.sky[0], spec.fog], fontFamily, spec.id.length * 17, 2, spec.id, 0.78, film), fog: false, toneMapped: false, transparent: film }),
  );
  back.position.set(0, 1.6, -12);
  group.add(back);

  // light through haze: additive shafts with real parallax against the set
  const bt = beamTex();
  // (a film is the whole backdrop: no painted set in front of it — no shafts, floor or court)
  const beams = (film ? [] : spec.beams).map(([x, y, z, tilt, w, len, a]) => {
    const g = new THREE.PlaneGeometry(w, len);
    g.translate(0, -len / 2, 0);
    const m = new THREE.Mesh(
      g,
      new THREE.MeshBasicMaterial({ map: bt, color: spec.light, transparent: true, opacity: a, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }),
    );
    m.position.set(x, y, z);
    m.rotation.z = tilt;
    m.userData.base = { tilt, a };
    group.add(m);
    return m;
  });

  let caustics: THREE.Mesh[] = [];
  let sea: OceanMesh | undefined;
  if (film) {
    // swimming: a 3D ocean rolls in front of the film
    if (spec.id === 'swimming') {
      sea = ocean();
      group.add(sea);
    }
    return { group, caustics, back, beams, sea };
  }
  const groundTex = spec.ground();
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({ map: groundTex, color: spec.groundTint, roughness: 0.92, metalness: 0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1.75;
  group.add(ground);

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(4.2, 2.6),
    new THREE.MeshBasicMaterial({ map: shadowTex(), transparent: true, depthWrite: false, opacity: 0.85 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -1.73;
  group.add(shadow);

  if (spec.id === 'swimming') {
    const ct = causticTex();
    caustics = [0, 1].map((i) => {
      const t = ct.clone();
      t.needsUpdate = true;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(9 + i * 3, 9 + i * 3);
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(60, 60),
        new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      m.rotation.x = -Math.PI / 2;
      m.position.y = -1.72 + i * 0.002;
      group.add(m);
      return m;
    });
  }
  if (spec.id === 'basketball') {
    // glowing court markings: the key and the arc
    const pts: number[] = [];
    const arc = 3.2;
    for (let i = 0; i <= 64; i++) {
      const a = Math.PI * (i / 64);
      pts.push(Math.cos(a) * arc, -1.715, -Math.sin(a) * arc + 0.6);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    group.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.75 })));
    const key = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-1.3, -1.715, 0.6),
      new THREE.Vector3(-1.3, -1.715, -4),
      new THREE.Vector3(1.3, -1.715, -4),
      new THREE.Vector3(1.3, -1.715, 0.6),
    ]);
    group.add(new THREE.Line(key, new THREE.LineBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.55 })));
  }
  return { group, caustics, back, beams, sea };
}
