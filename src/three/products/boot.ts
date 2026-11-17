import * as THREE from 'three';
import type { Palette } from '@/types/catalog';
import { curve1d, smoothstep } from '../lib/geom';
import { cachedTexture, rng, shade } from '../lib/textures';
import { fabric, plastic, rubber } from '../lib/materials';

export interface BootOptions {
  collar: 'low' | 'mid' | 'high';
  studs: 'fg' | 'tf' | 'none' | 'lug';
  laces: boolean;
  pattern: 'speed' | 'grip' | 'knit' | 'plain';
  sole: 'plate' | 'runner' | 'court' | 'hike';
}

const TOP: Record<BootOptions['collar'], [number, number][]> = {
  low: [[0, 0.29], [0.05, 0.305], [0.14, 0.282], [0.26, 0.252], [0.36, 0.212], [0.5, 0.172], [0.64, 0.135], [0.76, 0.105], [0.88, 0.076], [0.96, 0.058], [1, 0.05]],
  mid: [[0, 0.335], [0.1, 0.345], [0.24, 0.325], [0.36, 0.25], [0.5, 0.188], [0.66, 0.15], [0.8, 0.115], [0.92, 0.088], [1, 0.07]],
  high: [[0, 0.42], [0.1, 0.43], [0.24, 0.41], [0.36, 0.3], [0.5, 0.21], [0.66, 0.16], [0.8, 0.12], [0.92, 0.094], [1, 0.075]],
};
const COLLAR: Record<BootOptions['collar'], { u0: number; a: number; b: number; depth: number; rim: number }> = {
  low: { u0: 0.19, a: 0.16, b: 0.78, depth: 0.17, rim: 0.013 },
  mid: { u0: 0.17, a: 0.13, b: 0.66, depth: 0.26, rim: 0.02 },
  high: { u0: 0.18, a: 0.15, b: 0.72, depth: 0.3, rim: 0.022 },
};
const SOLE_H: Record<BootOptions['sole'], number> = { plate: 0.022, runner: 0.07, court: 0.055, hike: 0.06 };

const widthBase = curve1d([
  [0, 0.1], [0.08, 0.118], [0.3, 0.112], [0.45, 0.128], [0.6, 0.148], [0.7, 0.151], [0.8, 0.14], [0.9, 0.108], [0.96, 0.072], [1, 0.04],
]);

export function createBoot(pal: Palette, o: BootOptions) {
  const group = new THREE.Group();
  group.name = 'boot';
  const soleH = SOLE_H[o.sole];
  const topRel = curve1d(TOP[o.collar]);
  const col = COLLAR[o.collar];
  const toeSpring = (u: number) => 0.075 * Math.pow(smoothstep(0.7, 1, u), 1.6);
  const halfW = (u: number) => {
    let e = 1;
    if (u < 0.06) e = Math.sqrt(Math.max(0, 1 - ((0.06 - u) / 0.06) ** 2));
    if (u > 0.86) e = Math.sqrt(Math.max(0, 1 - ((u - 0.86) / 0.14) ** 2));
    return widthBase(u) * e;
  };
  const bottom = (u: number) => soleH - 0.002 + toeSpring(u);
  const top = (u: number) => soleH + topRel(u) + toeSpring(u);
  const EZ = 2 / 2.6;
  const ETOP = 2 / 2.15;
  const EBOT = 2 / 5;
  const sgnPow = (x: number, e: number) => Math.sign(x) * Math.pow(Math.abs(x), e);

  /** Upper surface before the collar dip. */
  const surf = (u: number, t: number, out = new THREE.Vector3()) => {
    const c = Math.cos(t);
    const s = Math.sin(t);
    let hh = (top(u) - bottom(u)) / 2;
    if (u > 0.9) hh *= Math.sqrt(Math.max(0.02, 1 - ((u - 0.9) / 0.1) ** 2));
    const yc = (top(u) + bottom(u)) / 2 - (u > 0.9 ? (1 - Math.sqrt(Math.max(0.02, 1 - ((u - 0.9) / 0.1) ** 2))) * 0.012 : 0);
    const z = halfW(u) * sgnPow(c, EZ);
    const y = s >= 0 ? yc + hh * Math.pow(s, ETOP) : yc - hh * Math.pow(-s, EBOT);
    return out.set(-0.5 + u, y, z);
  };

  /* ------------------------------ upper mesh ------------------------------ */
  const U = 140;
  const T = 72;
  const pos = new Float32Array((U + 1) * (T + 1) * 3);
  const uvs = new Float32Array((U + 1) * (T + 1) * 2);
  const inner = new Uint8Array((U + 1) * (T + 1));
  const v3 = new THREE.Vector3();
  for (let i = 0; i <= U; i++) {
    const u = i / U;
    for (let j = 0; j <= T; j++) {
      const v = j / T;
      const t = v * Math.PI * 2 - Math.PI / 2;
      surf(u, t, v3);
      const s = Math.sin(t);
      const w = halfW(u) || 1e-4;
      const zn = v3.z / w;
      const r = Math.sqrt(((u - col.u0) / col.a) ** 2 + (zn / col.b) ** 2);
      if (s > 0.15 && r < 1) {
        const gate = smoothstep(0.15, 0.6, s);
        v3.y -= col.depth * smoothstep(1, 0.8, r) * gate;
        // pull the walls slightly inward so the opening reads as a cavity
        v3.z *= 1 - 0.18 * smoothstep(1, 0.8, r) * gate;
        if (r < 0.9) inner[i * (T + 1) + j] = 1;
      }
      const k = i * (T + 1) + j;
      pos.set([v3.x, v3.y, v3.z], k * 3);
      uvs.set([u, v], k * 2);
    }
  }
  const outerIdx: number[] = [];
  const innerIdx: number[] = [];
  for (let i = 0; i < U; i++)
    for (let j = 0; j < T; j++) {
      const a = i * (T + 1) + j;
      const b = (i + 1) * (T + 1) + j;
      const isInner = inner[a]! + inner[b]! + inner[a + 1]! + inner[b + 1]! >= 3;
      (isInner ? innerIdx : outerIdx).push(a, b, a + 1, b, b + 1, a + 1);
    }
  const upperGeo = new THREE.BufferGeometry();
  upperGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  upperGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  upperGeo.setIndex([...outerIdx, ...innerIdx]);
  upperGeo.addGroup(0, outerIdx.length, 0);
  upperGeo.addGroup(outerIdx.length, innerIdx.length, 1);
  upperGeo.computeVertexNormals();

  const { map, bump } = upperTextures(pal, o);
  const upperMat = new THREE.MeshPhysicalMaterial({
    map,
    bumpMap: bump,
    bumpScale: o.pattern === 'grip' ? 1.6 : 0.9,
    roughness: o.pattern === 'knit' ? 0.62 : 0.4,
    clearcoat: o.pattern === 'knit' ? 0.1 : 0.45,
    clearcoatRoughness: 0.3,
    sheen: o.pattern === 'knit' ? 0.6 : 0.2,
    sheenColor: new THREE.Color(pal.primary).lerp(new THREE.Color('#fff'), 0.6),
  });
  const innerMat = fabric('#232624', { side: THREE.DoubleSide });
  const upper = new THREE.Mesh(upperGeo, [upperMat, innerMat]);
  upper.name = 'upper';
  group.add(upper);

  /* -------------------------------- collar rim ------------------------------- */
  const rimPts: THREE.Vector3[] = [];
  for (let k = 0; k < 64; k++) {
    const phi = (k / 64) * Math.PI * 2;
    const u = col.u0 + col.a * 0.95 * Math.cos(phi);
    const zn = col.b * 0.95 * Math.sin(phi);
    const c = Math.sign(zn) * Math.pow(Math.min(1, Math.abs(zn)), 1 / EZ);
    const t = Math.atan2(Math.sqrt(Math.max(0, 1 - c * c)), c);
    const p = surf(u, t);
    p.y -= col.depth * 0.08;
    rimPts.push(p);
  }
  const rimMat = o.collar === 'low' ? upperMat : fabric(shade(pal.primary, -0.06));
  const rim = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rimPts, true), 96, col.rim, 12, true), rimMat);
  rim.name = 'collar';
  group.add(rim);

  if (o.collar !== 'low') {
    // knit sock collar wrapping the ankle
    const sock = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rimPts.map((p) => p.clone().add(new THREE.Vector3(0, -0.012, 0))), true), 96, col.rim * 0.7, 8, true),
      fabric(shade(pal.primary, -0.12)),
    );
    group.add(sock);
  }

  /* ---------------------------- laces / tongue ---------------------------- */
  const outward = (p: THREE.Vector3, u: number, d: number) => {
    const yc = (top(u) + bottom(u)) / 2;
    const dir = new THREE.Vector3(0, p.y - yc, p.z).normalize();
    return p.addScaledVector(dir, d);
  };
  if (o.laces) {
    const laceMat = plastic(pal.detail ?? '#ffffff', { roughness: 0.55, clearcoat: 0.1 });
    for (let i = 0; i < 6; i++) {
      const u = 0.39 + i * 0.048;
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k <= 10; k++) {
        const t = Math.PI / 2 + (k / 10 - 0.5) * 1.35;
        pts.push(outward(surf(u + (k / 10 - 0.5) * 0.012 * (i % 2 ? 1 : -1), t), u, 0.011));
      }
      const lace = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.0085, 8), laceMat);
      lace.scale.y = 0.9;
      group.add(lace);
    }
    // lace channel / eyelet strip
    const stripMat = plastic(shade(pal.primary, -0.18), { roughness: 0.5 });
    for (const side of [-1, 1]) {
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k <= 12; k++) {
        const u = 0.37 + (k / 12) * 0.29;
        pts.push(outward(surf(u, Math.PI / 2 + side * 0.72), u, 0.003));
      }
      group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, 0.006, 6), stripMat));
    }
  } else {
    // fold-over tongue patch
    const UU = 24;
    const TT = 24;
    const tp: number[] = [];
    const tuv: number[] = [];
    const ti: number[] = [];
    for (let i = 0; i <= UU; i++) {
      const u = 0.33 + (i / UU) * 0.24;
      for (let j = 0; j <= TT; j++) {
        const t = Math.PI / 2 + (j / TT - 0.5) * 1.9;
        const p = outward(surf(u, t), u, 0.011 + 0.01 * (1 - i / UU));
        tp.push(p.x, p.y, p.z);
        tuv.push(i / UU, j / TT);
      }
    }
    for (let i = 0; i < UU; i++)
      for (let j = 0; j < TT; j++) {
        const a = i * (TT + 1) + j;
        const b = (i + 1) * (TT + 1) + j;
        ti.push(a, b, a + 1, b, b + 1, a + 1);
      }
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3));
    tg.setAttribute('uv', new THREE.Float32BufferAttribute(tuv, 2));
    tg.setIndex(ti);
    tg.computeVertexNormals();
    const tongue = new THREE.Mesh(
      tg,
      new THREE.MeshPhysicalMaterial({
        color: shade(pal.primary, -0.04),
        roughness: 0.45,
        clearcoat: 0.4,
        bumpMap: bump,
        bumpScale: 1.2,
        side: THREE.DoubleSide,
      }),
    );
    group.add(tongue);
  }

  /* --------------------------------- sole --------------------------------- */
  const outline = new THREE.Shape();
  const N = 80;
  const margin = o.sole === 'plate' ? 1.04 : 1.1;
  for (let k = 0; k <= N; k++) {
    const u = k / N;
    const z = halfW(u) * margin + 0.004;
    if (k === 0) outline.moveTo(-0.5 + u - 0.004, -z);
    else outline.lineTo(-0.5 + u + (u > 0.99 ? 0.006 : 0), -z);
  }
  for (let k = N; k >= 0; k--) {
    const u = k / N;
    outline.lineTo(-0.5 + u + (u > 0.99 ? 0.006 : 0), halfW(u) * margin + 0.004);
  }
  const soleGeo = new THREE.ExtrudeGeometry(outline, {
    depth: soleH,
    bevelEnabled: true,
    bevelThickness: Math.min(0.006, soleH * 0.25),
    bevelSize: 0.004,
    bevelSegments: 3,
    curveSegments: 4,
  });
  soleGeo.rotateX(-Math.PI / 2);
  {
    const p = soleGeo.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i) + 0.5;
      let y = p.getY(i) + toeSpring(u);
      if (o.sole === 'runner') y += Math.sin(u * Math.PI) * 0.004 - smoothstep(0.0, 0.25, 1 - u) * 0.0;
      p.setY(i, y);
    }
    soleGeo.computeVertexNormals();
  }
  const soleMat =
    o.sole === 'plate'
      ? plastic(pal.secondary, { roughness: 0.22, clearcoat: 0.8 })
      : o.sole === 'runner'
        ? rubber(pal.secondary, { roughness: 0.55, bumpScale: 0.1 })
        : rubber(pal.secondary);
  const sole = new THREE.Mesh(soleGeo, soleMat);
  sole.name = 'sole';
  group.add(sole);

  if (o.sole !== 'plate') {
    // outsole layer
    const out = new THREE.Mesh(soleGeo.clone().scale(1, 0.18, 1), rubber(o.sole === 'hike' ? '#2a2a27' : shade(pal.accent, -0.1)));
    out.position.y = -0.004;
    group.add(out);
  }

  /* -------------------------------- traction -------------------------------- */
  const studMat = plastic(o.sole === 'plate' ? shade(pal.secondary, -0.04) : '#2a2a27', { roughness: 0.25, clearcoat: 0.7 });
  if (o.studs === 'fg') {
    const spots: [number, number, number][] = [
      [0.1, 0.55, 1.2], [0.1, -0.55, 1.2], [0.23, 0.6, 1.15], [0.23, -0.6, 1.15],
      [0.57, 0.7, 1], [0.57, -0.7, 1], [0.69, 0.72, 1], [0.69, -0.58, 1], [0.81, 0.58, 1], [0.81, -0.46, 1], [0.91, 0.08, 0.95],
    ];
    const sg = new THREE.CylinderGeometry(0.012, 0.02, 0.046, 3, 1);
    for (const [u, zn, s] of spots) {
      const stud = new THREE.Mesh(sg, studMat);
      stud.scale.setScalar(s);
      stud.rotation.y = zn > 0 ? 0.3 : -0.3 + Math.PI;
      stud.position.set(-0.5 + u, toeSpring(u) - 0.022 * s, zn * halfW(u));
      group.add(stud);
    }
  } else if (o.studs === 'tf' || o.studs === 'lug') {
    const isLug = o.studs === 'lug';
    const geo = isLug ? new THREE.BoxGeometry(0.03, 0.014, 0.02) : new THREE.CylinderGeometry(0.0062, 0.0075, 0.009, 8);
    const spots: THREE.Matrix4[] = [];
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const step = isLug ? 0.05 : 0.028;
    for (let u = 0.03; u < 0.98; u += step) {
      const w = halfW(u) * 0.86;
      const zstep = isLug ? 0.05 : 0.026;
      for (let z = -w; z <= w; z += zstep) {
        q.setFromEuler(new THREE.Euler(0, isLug ? (z > 0 ? 0.5 : -0.5) : 0, 0));
        m.compose(new THREE.Vector3(-0.5 + u, toeSpring(u) - (isLug ? 0.006 : 0.004), z), q, new THREE.Vector3(1, 1, 1));
        spots.push(m.clone());
      }
    }
    const inst = new THREE.InstancedMesh(geo, isLug ? rubber('#2a2a27') : studMat, spots.length);
    spots.forEach((mm, i) => inst.setMatrixAt(i, mm));
    group.add(inst);
  }

  group.traverse((ob) => {
    if ((ob as THREE.Mesh).isMesh) {
      ob.castShadow = true;
      ob.receiveShadow = true;
    }
  });
  return group;
}

/* ------------------------------ upper texturing ------------------------------ */
function upperTextures(pal: Palette, o: BootOptions) {
  const key = `boot-${pal.primary}-${pal.accent}-${pal.secondary}-${o.pattern}`;
  const W = 1024;
  const H = 512;
  // texture space: x = u (heel→toe), y = v; v=0.25 lateral side, 0.5 top, 0.75 medial, 0/1 bottom
  const map = cachedTexture(`${key}-map`, W, H, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, shade(pal.primary, -0.07));
    g.addColorStop(0.45, pal.primary);
    g.addColorStop(1, shade(pal.primary, 0.03));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // lower edge shading (near the sole)
    const vg = ctx.createLinearGradient(0, 0, 0, H);
    vg.addColorStop(0, 'rgba(0,0,0,0.35)');
    vg.addColorStop(0.1, 'rgba(0,0,0,0)');
    vg.addColorStop(0.9, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
    // top highlight
    const tg = ctx.createLinearGradient(0, H * 0.35, 0, H * 0.65);
    tg.addColorStop(0, 'rgba(255,255,255,0)');
    tg.addColorStop(0.5, 'rgba(255,255,255,0.08)');
    tg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = tg;
    ctx.fillRect(0, 0, W, H);

    const r = rng(42);
    ctx.save();
    if (o.pattern === 'speed') {
      // fine diagonal micro-texture
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      for (let x = -H; x < W; x += 6) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + H * 0.6, H);
        ctx.stroke();
      }
      // lateral + medial speed graphic
      for (const [v0, v1, flip] of [[0.1, 0.4, 1], [0.6, 0.9, -1]] as const) {
        ctx.fillStyle = pal.accent;
        ctx.beginPath();
        const y0 = v0 * H;
        const y1 = v1 * H;
        if (flip > 0) {
          ctx.moveTo(0.3 * W, y0);
          ctx.lineTo(0.47 * W, y0);
          ctx.lineTo(0.66 * W, y1);
          ctx.lineTo(0.56 * W, y1);
        } else {
          ctx.moveTo(0.56 * W, y0);
          ctx.lineTo(0.66 * W, y0);
          ctx.lineTo(0.47 * W, y1);
          ctx.lineTo(0.3 * W, y1);
        }
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(0.3 * W, flip > 0 ? y0 : y1 - 3, 0.36 * W, 3);
      }
      // toe sheen dots
      for (let i = 0; i < 260; i++) {
        ctx.fillStyle = `rgba(255,255,255,${0.03 + r() * 0.06})`;
        ctx.beginPath();
        ctx.arc((0.72 + r() * 0.26) * W, (0.3 + r() * 0.4) * H, 1 + r() * 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (o.pattern === 'grip') {
      for (let row = 0; row < 14; row++) {
        for (let k = 0; k < 18; k++) {
          const u = 0.48 + k * 0.026 + (row % 2) * 0.013;
          const v = 0.4 + row * 0.033;
          if (u > 0.96) continue;
          ctx.fillStyle = shade(pal.primary, -0.16);
          ctx.beginPath();
          ctx.ellipse(u * W, v * H, 7, 3, 0.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.25)';
          ctx.fillRect(u * W - 5, v * H - 2, 6, 1);
        }
      }
      ctx.fillStyle = pal.accent;
      ctx.fillRect(0.3 * W, 0.16 * H, 0.22 * W, 0.035 * H);
      ctx.fillRect(0.34 * W, 0.24 * H, 0.18 * W, 0.035 * H);
    } else if (o.pattern === 'knit') {
      for (let y = 0; y < H; y += 5) {
        ctx.fillStyle = `rgba(0,0,0,${0.03 + (y % 10 ? 0 : 0.03)})`;
        ctx.fillRect(0, y, W, 2);
      }
      ctx.strokeStyle = pal.accent;
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.moveTo(0.18 * W, 0.12 * H);
      ctx.bezierCurveTo(0.4 * W, 0.18 * H, 0.55 * W, 0.34 * H, 0.82 * W, 0.3 * H);
      ctx.stroke();
    } else {
      for (let i = 0; i < 2400; i++) {
        ctx.fillStyle = `rgba(255,255,255,${r() * 0.05})`;
        ctx.fillRect(r() * W, r() * H, 2, 2);
      }
    }
    // heel counter
    ctx.fillStyle = pal.accent;
    ctx.globalAlpha = 0.95;
    ctx.beginPath();
    ctx.moveTo(0, 0.02 * H);
    ctx.lineTo(0.1 * W, 0.02 * H);
    ctx.quadraticCurveTo(0.14 * W, 0.22 * H, 0.08 * W, 0.42 * H);
    ctx.lineTo(0, 0.44 * H);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, 0.98 * H);
    ctx.lineTo(0.1 * W, 0.98 * H);
    ctx.quadraticCurveTo(0.14 * W, 0.78 * H, 0.08 * W, 0.58 * H);
    ctx.lineTo(0, 0.56 * H);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // stitching along the lower edge
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.setLineDash([6, 5]);
    ctx.lineWidth = 1.5;
    for (const v of [0.07, 0.93]) {
      ctx.beginPath();
      ctx.moveTo(0, v * H);
      ctx.lineTo(W, v * H);
      ctx.stroke();
    }
  });
  const bump = cachedTexture(
    `${key}-bump`,
    W / 2,
    H / 2,
    (ctx, w, h) => {
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, w, h);
      const r = rng(9);
      if (o.pattern === 'grip') {
        for (let row = 0; row < 14; row++)
          for (let k = 0; k < 18; k++) {
            const u = 0.48 + k * 0.026 + (row % 2) * 0.013;
            const v = 0.4 + row * 0.033;
            ctx.fillStyle = '#e0e0e0';
            ctx.beginPath();
            ctx.ellipse(u * w, v * h, 3.5, 1.5, 0.5, 0, Math.PI * 2);
            ctx.fill();
          }
      } else if (o.pattern === 'speed') {
        ctx.strokeStyle = '#9a9a9a';
        for (let x = -h; x < w; x += 3) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x + h * 0.6, h);
          ctx.stroke();
        }
      } else {
        for (let y = 0; y < h; y += 3) {
          ctx.fillStyle = y % 6 ? '#909090' : '#707070';
          ctx.fillRect(0, y, w, 1);
        }
      }
      for (let i = 0; i < 4000; i++) {
        ctx.fillStyle = `rgba(${r() > 0.5 ? 255 : 0},0,0,0.05)`;
        ctx.fillRect(r() * w, r() * h, 1, 1);
      }
      ctx.strokeStyle = '#4a4a4a';
      ctx.setLineDash([3, 3]);
      for (const v of [0.07, 0.93]) {
        ctx.beginPath();
        ctx.moveTo(0, v * h);
        ctx.lineTo(w, v * h);
        ctx.stroke();
      }
    },
    { srgb: false },
  );
  return { map, bump };
}
