import * as THREE from 'three';

export const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));

/** Piecewise-smooth interpolation through [x, y] control points (monotonic x). */
export function curve1d(points: [number, number][]) {
  return (x: number) => {
    if (x <= points[0]![0]) return points[0]![1];
    for (let i = 1; i < points.length; i++) {
      const [x1, y1] = points[i]!;
      const [x0, y0] = points[i - 1]!;
      if (x <= x1) {
        const t = (x - x0) / (x1 - x0);
        const s = t * t * (3 - 2 * t);
        return y0 + (y1 - y0) * s;
      }
    }
    return points[points.length - 1]![1];
  };
}

/**
 * Tube with a radius that varies along the curve (TubeGeometry only supports constant radius).
 * Ends are capped with hemispherical domes when `caps` is true.
 */
export function taperedTube(
  curve: THREE.Curve<THREE.Vector3>,
  radius: (t: number) => number,
  tubular = 48,
  radial = 16,
  opts: { scaleY?: number; caps?: boolean } = {},
) {
  const frames = curve.computeFrenetFrames(tubular, false);
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const p = new THREE.Vector3();
  const v = new THREE.Vector3();
  const sy = opts.scaleY ?? 1;
  for (let i = 0; i <= tubular; i++) {
    const t = i / tubular;
    curve.getPointAt(t, p);
    const N = frames.normals[i]!;
    const B = frames.binormals[i]!;
    const r = radius(t);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a) * sy;
      v.set(N.x * c + B.x * s, N.y * c + B.y * s, N.z * c + B.z * s);
      pos.push(p.x + r * v.x, p.y + r * v.y, p.z + r * v.z);
      uv.push(t, j / radial);
    }
  }
  for (let i = 0; i < tubular; i++)
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      const b = (i + 1) * (radial + 1) + j;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  if (!opts.caps) return g;
  const parts: THREE.BufferGeometry[] = [g];
  for (const end of [0, 1]) {
    const r = radius(end);
    if (r <= 0.0001) continue;
    const cap = new THREE.SphereGeometry(r, radial, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const tan = curve.getTangentAt(end);
    if (end === 0) tan.negate();
    cap.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tan));
    if (sy !== 1) {
      // approximate the flattened profile on caps
      const m = new THREE.Matrix4().makeBasis(frames.normals[end * tubular]!, frames.binormals[end * tubular]!, tan);
      const inv = m.clone().invert();
      cap.applyMatrix4(inv).scale(1, sy, 1).applyMatrix4(m);
    }
    cap.translate(...curve.getPointAt(end).toArray());
    parts.push(cap);
  }
  return mergeSimple(parts);
}

/** Merge geometries that share position/normal/uv attributes (non-indexed safe). */
export function mergeSimple(geos: THREE.BufferGeometry[]) {
  const pos: number[] = [];
  const nor: number[] = [];
  const uvs: number[] = [];
  for (const g0 of geos) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    pos.push(...(g.getAttribute('position').array as Float32Array));
    nor.push(...(g.getAttribute('normal').array as Float32Array));
    const uv = g.getAttribute('uv');
    if (uv) uvs.push(...(uv.array as Float32Array));
    else uvs.push(...new Array((g.getAttribute('position').count * 2) | 0).fill(0));
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  return out;
}

/** Closed curve through points (CatmullRom). */
export const loop = (pts: [number, number, number][], closed = true) =>
  new THREE.CatmullRomCurve3(
    pts.map((p) => new THREE.Vector3(...p)),
    closed,
    'centripetal',
  );

/** Builds a smooth lathe from [radius, height] samples. */
export function lathe(profile: [number, number][], segments = 48) {
  return new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(Math.max(0.0001, r), y)),
    segments,
  );
}

/** Rounded rectangle shape centred on origin. */
export function roundedRect(w: number, h: number, r: number) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** "Inflated" extrusion used for soft goods (apparel, pads). */
export function puffy(shape: THREE.Shape, depth = 0.08, bevel = 0.06, curveSegments = 24) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.9,
    bevelSegments: 8,
    curveSegments,
  });
  g.translate(0, 0, -depth / 2);
  g.computeVertexNormals();
  return g;
}

/** Bends geometry around the Y axis (x wraps onto a cylinder of radius R). */
export function bendAroundY(g: THREE.BufferGeometry, R: number) {
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const a = x / R;
    const r = R + z;
    p.setXYZ(i, Math.sin(a) * r, p.getY(i), Math.cos(a) * r - R);
  }
  p.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

/** Disposes every geometry/material/texture under an object. */
export function disposeDeep(obj: THREE.Object3D, keepShared = true) {
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mats = (Array.isArray(m.material) ? m.material : m.material ? [m.material] : []) as THREE.Material[];
    for (const mat of mats) {
      if (keepShared && mat.userData.shared) continue;
      mat.dispose();
    }
  });
}
