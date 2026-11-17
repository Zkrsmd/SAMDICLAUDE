import * as THREE from 'three';
import type { Palette } from '@/types/catalog';
import { loop, lathe, puffy, roundedRect } from '../lib/geom';
import { clearPlastic, mirrorLens, plastic, silicone } from '../lib/materials';
import { cachedTexture } from '../lib/textures';
import { colorFamily } from '@/lib/color';

/** Elliptic dome lens: rim is an exact ellipse (a, b) at z = 0, apex at z = h. */
function lensGeometry(a: number, b: number, h: number, rings = 24, segs = 64) {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= rings; i++) {
    const r = i / rings;
    for (let j = 0; j <= segs; j++) {
      const th = (j / segs) * Math.PI * 2;
      pos.push(a * r * Math.cos(th), b * r * Math.sin(th), h * Math.sqrt(Math.max(0, 1 - r * r)));
      uv.push(0.5 + 0.5 * r * Math.cos(th), 0.5 + 0.5 * r * Math.sin(th));
    }
  }
  for (let i = 0; i < rings; i++)
    for (let j = 0; j < segs; j++) {
      const p = i * (segs + 1) + j;
      const q = (i + 1) * (segs + 1) + j;
      idx.push(p, q, p + 1, q, q + 1, p + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const ellipse = (a: number, b: number, z = 0, n = 64) =>
  new THREE.CatmullRomCurve3(
    Array.from({ length: n }, (_, i) => {
      const t = (i / n) * Math.PI * 2;
      return new THREE.Vector3(a * Math.cos(t), b * Math.sin(t), z);
    }),
    true,
  );

/** Racing / training goggles. Lenses face +z, strap wraps toward -z. */
export function createGoggles(pal: Palette, o: { profile?: string } = {}) {
  const g = new THREE.Group();
  g.name = 'goggles';
  const race = o.profile !== 'train';
  const a = race ? 0.25 : 0.27;
  const b = race ? 0.17 : 0.2;
  const clear = colorFamily(pal.primary) === 'white';
  const lensMat = clear ? clearPlastic(pal.primary, 0.35) : mirrorLens(pal.primary);
  const frameMat = silicone(pal.secondary, { roughness: race ? 0.25 : 0.45, clearcoat: race ? 0.8 : 0.3 });
  const strapMat = silicone(pal.accent, { roughness: 0.5 });

  for (const side of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(side * 0.33, 0, 0);
    eye.rotation.y = side * 0.32;
    eye.rotation.z = side * -0.06;
    const lens = new THREE.Mesh(lensGeometry(a, b, race ? 0.07 : 0.09), lensMat);
    lens.position.z = 0.03;
    eye.add(lens);
    // gasket / frame
    const frame = new THREE.Mesh(new THREE.TubeGeometry(ellipse(a + 0.012, b + 0.012, 0.025), 96, race ? 0.018 : 0.03, 12, true), frameMat);
    eye.add(frame);
    const seal = new THREE.Mesh(
      new THREE.TubeGeometry(ellipse(a + 0.01, b + 0.008, -0.03), 96, race ? 0.022 : 0.036, 12, true),
      silicone(race ? '#1d2326' : pal.secondary, { roughness: 0.6, transparent: !race, opacity: race ? 1 : 0.85 }),
    );
    seal.scale.set(0.98, 0.98, 1);
    eye.add(seal);
    g.add(eye);
  }
  // nose bridge
  const bridge = new THREE.Mesh(
    new THREE.TubeGeometry(loop([[-0.1, 0.02, 0.0], [-0.04, 0.05, 0.03], [0.04, 0.05, 0.03], [0.1, 0.02, 0.0]], false), 24, 0.013, 8),
    frameMat,
  );
  g.add(bridge);
  // split strap
  for (const yOff of race ? [-0.045, 0.045] : [0]) {
    for (const side of [-1, 1]) {
      const pts: [number, number, number][] = [
        [side * 0.58, yOff * 0.3, -0.06],
        [side * 0.68, yOff * 0.7, -0.32],
        [side * 0.6, yOff, -0.68],
        [side * 0.32, yOff * 1.1, -0.92],
        [0, yOff * 1.1, -0.98],
      ];
      const strap = new THREE.Mesh(new THREE.TubeGeometry(loop(pts, false), 48, race ? 0.012 : 0.02, 8), strapMat);
      strap.scale.y = race ? 1 : 1.6;
      g.add(strap);
    }
  }
  // strap buckle near the lens
  for (const side of [-1, 1]) {
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.035), plastic(pal.secondary));
    buckle.position.set(side * 0.6, 0, -0.08);
    buckle.rotation.y = side * 0.9;
    g.add(buckle);
  }
  g.traverse((ob) => {
    if ((ob as THREE.Mesh).isMesh) ob.castShadow = true;
  });
  return g;
}

/** Silicone swim cap. Opening faces -y; front of the head faces +z. */
export function createCap(pal: Palette, o: { seam?: boolean } = {}) {
  const g = new THREE.Group();
  g.name = 'cap';
  const geo = new THREE.SphereGeometry(1, 96, 64, 0, Math.PI * 2, 0, Math.PI * 0.56);
  const p = geo.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    // slightly elongated front-to-back, flatter at the crown
    const z = p.getZ(i);
    // elongated front-to-back, taller crown, slightly fuller at the back
    p.setXYZ(i, p.getX(i) * 0.82, y * 0.98 + (y > 0.7 ? -(y - 0.7) * 0.1 : 0), z * (z < 0 ? 1.12 : 1.04));
  }
  geo.computeVertexNormals();
  const capMap = cachedTexture(`cap-${pal.primary}-${pal.secondary}`, 512, 256, (ctx, w, h) => {
    ctx.fillStyle = pal.primary;
    ctx.fillRect(0, 0, w, h);
    // side graphic band (abstract, not a logo)
    ctx.fillStyle = pal.secondary;
    for (const cx of [0.25, 0.75]) {
      ctx.beginPath();
      ctx.ellipse(w * cx, h * 0.62, w * 0.09, h * 0.05, -0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(w * (cx - 0.08), h * 0.72, w * 0.16, h * 0.018);
    }
  });
  const mat = silicone(pal.primary, {
    map: capMap,
    roughness: 0.3,
    clearcoat: 0.5,
    clearcoatRoughness: 0.22,
    sheen: 0.25,
    side: THREE.DoubleSide,
  });
  g.add(new THREE.Mesh(geo, mat));
  // rolled rim
  const rimY = Math.cos(Math.PI * 0.56) * 0.98;
  const rimR = Math.sin(Math.PI * 0.56);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(rimR, 0.022, 12, 96), mat);
  rim.rotation.x = Math.PI / 2;
  rim.scale.set(0.82, 1.08, 1);
  rim.position.y = rimY;
  g.add(rim);
  if (o.seam) {
    // fit-point marker (aligns cap with goggles)
    const marker = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 0.12, 6, 12), plastic(pal.accent));
    marker.position.set(0.79, -0.02, 0.32);
    marker.rotation.set(0, -0.42, Math.PI / 2);
    g.add(marker);
  }
  g.traverse((ob) => {
    if ((ob as THREE.Mesh).isMesh) ob.castShadow = true;
  });
  return g;
}

/** Short-blade training fin. */
export function createFins(pal: Palette, o: { short?: boolean } = {}) {
  const g = new THREE.Group();
  const len = o.short ? 0.75 : 1;
  const blade = new THREE.Shape();
  blade.moveTo(-0.22, 0);
  blade.bezierCurveTo(-0.26, len * 0.5, -0.36, len * 0.9, -0.3, len);
  blade.quadraticCurveTo(0, len * 1.04, 0.3, len);
  blade.bezierCurveTo(0.36, len * 0.9, 0.26, len * 0.5, 0.22, 0);
  blade.quadraticCurveTo(0, -0.05, -0.22, 0);
  const bladeGeo = puffy(blade, 0.02, 0.012);
  const bp = bladeGeo.getAttribute('position');
  for (let i = 0; i < bp.count; i++) bp.setZ(i, bp.getZ(i) + Math.pow(Math.max(0, bp.getY(i)) / len, 2) * 0.12);
  bladeGeo.computeVertexNormals();
  const bladeMesh = new THREE.Mesh(bladeGeo, silicone(pal.primary, { transparent: true, opacity: 0.92 }));
  bladeMesh.rotation.x = -Math.PI / 2;
  g.add(bladeMesh);
  // foot pocket
  const pocket = new THREE.Mesh(lathe([[0, -0.32], [0.12, -0.3], [0.15, -0.15], [0.15, 0.08], [0.11, 0.18], [0, 0.2]], 48), silicone(pal.secondary));
  pocket.rotation.x = Math.PI / 2;
  pocket.scale.set(1.05, 1, 0.55);
  pocket.position.set(0, 0.05, 0.12);
  g.add(pocket);
  const ribMat = silicone(pal.accent);
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(
      new THREE.TubeGeometry(loop([[side * 0.2, 0.03, -0.05], [side * 0.27, 0.05, -len * 0.5], [side * 0.3, 0.12, -len * 0.98]], false), 32, 0.018, 8),
      ribMat,
    );
    g.add(rail);
  }
  g.rotation.y = 0;
  return g;
}

export function createKickboard(pal: Palette) {
  const s = roundedRect(0.62, 0.92, 0.22);
  const hole1 = new THREE.Path();
  hole1.absellipse(-0.16, 0.28, 0.06, 0.1, 0, Math.PI * 2, false, 0);
  const hole2 = new THREE.Path();
  hole2.absellipse(0.16, 0.28, 0.06, 0.1, 0, Math.PI * 2, false, 0);
  s.holes.push(hole1, hole2);
  const geo = puffy(s, 0.05, 0.03);
  const g = new THREE.Group();
  const m = new THREE.Mesh(geo, silicone(pal.primary, { roughness: 0.7, clearcoat: 0 }));
  g.add(m);
  const stripe = new THREE.Mesh(puffy(roundedRect(0.5, 0.12, 0.05), 0.01, 0.01), silicone(pal.secondary, { roughness: 0.7 }));
  stripe.position.set(0, -0.18, 0.045);
  g.add(stripe);
  g.rotation.x = -0.9;
  return g;
}

export function createPullbuoy(pal: Palette) {
  const g = new THREE.Group();
  const prof: [number, number][] = [];
  for (let i = 0; i <= 24; i++) {
    const y = -0.5 + i / 24;
    const r = 0.22 + 0.06 * Math.cos(y * Math.PI * 2) - (Math.abs(y) > 0.46 ? (Math.abs(y) - 0.46) * 3 : 0);
    prof.push([Math.max(0.01, r), y]);
  }
  for (const [x, c] of [[-0.21, pal.primary], [0.21, pal.secondary]] as const) {
    const m = new THREE.Mesh(lathe(prof, 48), silicone(c, { roughness: 0.75, clearcoat: 0 }));
    m.position.x = x;
    m.rotation.z = Math.PI / 2;
    m.rotation.z = 0;
    g.add(m);
  }
  g.rotation.z = Math.PI / 2;
  g.rotation.y = 0.5;
  return g;
}
