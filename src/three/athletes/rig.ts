import * as THREE from 'three';

/**
 * Stylised procedural athlete. Rendered as a backlit, rim-lit silhouette so the
 * figure reads as cinematic rather than as a primitive mannequin.
 * Rest pose: standing, facing +z, left side on +x, arms hanging along -y.
 * Joint rotations use Euler order ZXY: x = pitch (+ swings limbs backward / torso forward),
 * z = roll / abduction, y = yaw.
 */
export const JOINTS = [
  'hips', 'spine', 'chest', 'neck', 'head',
  'shoulderL', 'elbowL', 'wristL', 'shoulderR', 'elbowR', 'wristR',
  'hipL', 'kneeL', 'ankleL', 'hipR', 'kneeR', 'ankleR',
] as const;
export type JointName = (typeof JOINTS)[number];
export type Euler3 = [number, number, number];
export type Pose = Partial<Record<JointName, Euler3>> & { lift?: number };

export interface Rig {
  root: THREE.Group;
  joints: Record<JointName, THREE.Object3D>;
  material: THREE.MeshStandardMaterial;
  baseHeight: number;
}

/** Dark athletic skin with a strong fresnel rim — the silhouette look. */
export function silhouetteMaterial(rim = '#fff2d6', base = '#24211f', rimPower = 2.6, rimStrength = 1.6) {
  const m = new THREE.MeshStandardMaterial({ color: base, roughness: 0.55, metalness: 0.0 });
  const uRim = { value: new THREE.Color(rim) };
  const uStrength = { value: rimStrength };
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uRim = uRim;
    shader.uniforms.uRimStrength = uStrength;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uRim;\nuniform float uRimStrength;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float fres = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), ${rimPower.toFixed(2)});
        totalEmissiveRadiance += uRim * fres * uRimStrength;`,
      );
  };
  m.userData.rim = uRim;
  m.userData.rimStrength = uStrength;
  return m;
}

/** Limb lathe from the joint down -y with a muscle bulge. */
function limb(len: number, r0: number, r1: number, bulge: number, at: number) {
  const pts: THREE.Vector2[] = [new THREE.Vector2(0.0001, r0 * 0.7)];
  for (let i = 0; i <= 3; i++) {
    const a = (i / 3) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.sin(a) * r0, Math.cos(a) * r0 * 0.7));
  }
  for (let i = 1; i < 16; i++) {
    const t = i / 16;
    const r = r0 + (r1 - r0) * t + bulge * Math.exp(-(((t - at) / 0.22) ** 2));
    pts.push(new THREE.Vector2(r, -len * t));
  }
  for (let i = 0; i <= 3; i++) {
    const a = (i / 3) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.cos(a) * r1, -len - Math.sin(a) * r1 * 0.7));
  }
  pts.push(new THREE.Vector2(0.0001, -len - r1 * 0.7));
  // LatheGeometry expects the profile bottom → top for outward-facing normals
  const g = new THREE.LatheGeometry(pts.reverse(), 20);
  g.computeVertexNormals();
  return g;
}

function torsoGeometry() {
  // waist → chest → shoulders, revolved then widened (x) and flattened (z)
  const prof: [number, number][] = [
    [0.0001, -0.04], [0.11, -0.02], [0.128, 0.06], [0.135, 0.16], [0.155, 0.26], [0.168, 0.34], [0.16, 0.4], [0.13, 0.45], [0.06, 0.48], [0.0001, 0.485],
  ];
  const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 28);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const w = 1.2 + 0.32 * THREE.MathUtils.smoothstep(y, 0.1, 0.38); // V-taper
    let z = p.getZ(i) * 0.72;
    if (z > 0 && y > 0.22 && y < 0.4) z *= 1.12; // chest
    p.setXYZ(i, p.getX(i) * w, y, z);
  }
  g.computeVertexNormals();
  return g;
}

export function createRig(
  opts: { material?: THREE.MeshStandardMaterial; hands?: 'none' | 'flat'; shorts?: string; hood?: boolean; scale?: number } = {},
) {
  const mat = opts.material ?? silhouetteMaterial();
  const j = {} as Record<JointName, THREE.Object3D>;
  const mk = (name: JointName, parent: THREE.Object3D | null, x: number, y: number, z: number) => {
    const o = new THREE.Object3D();
    o.name = name;
    o.position.set(x, y, z);
    o.rotation.order = 'ZXY';
    parent?.add(o);
    j[name] = o;
    return o;
  };
  const mesh = (geo: THREE.BufferGeometry, parent: THREE.Object3D, f?: (m: THREE.Mesh) => void) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    f?.(m);
    parent.add(m);
    return m;
  };
  const root = new THREE.Group();
  const hips = mk('hips', root, 0, 0.98, 0);
  const spine = mk('spine', hips, 0, 0.1, 0);
  const chest = mk('chest', spine, 0, 0.18, 0);
  const neck = mk('neck', chest, 0, 0.27, 0.0);
  const head = mk('head', neck, 0, 0.1, 0.01);
  mk('shoulderL', chest, 0.2, 0.2, -0.005);
  mk('elbowL', j.shoulderL, 0, -0.29, 0);
  mk('wristL', j.elbowL, 0, -0.26, 0);
  mk('shoulderR', chest, -0.2, 0.2, -0.005);
  mk('elbowR', j.shoulderR, 0, -0.29, 0);
  mk('wristR', j.elbowR, 0, -0.26, 0);
  mk('hipL', hips, 0.095, -0.06, 0);
  mk('kneeL', j.hipL, 0, -0.45, 0);
  mk('ankleL', j.kneeL, 0, -0.44, 0);
  mk('hipR', hips, -0.095, -0.06, 0);
  mk('kneeR', j.hipR, 0, -0.45, 0);
  mk('ankleR', j.kneeR, 0, -0.44, 0);

  // pelvis + torso
  mesh(new THREE.SphereGeometry(0.16, 24, 16), hips, (m) => m.scale.set(1.12, 0.78, 0.82));
  mesh(torsoGeometry(), spine, (m) => (m.position.y = -0.06));
  // neck + head
  mesh(new THREE.CylinderGeometry(0.05, 0.058, 0.13, 16), neck, (m) => (m.position.y = 0.03));
  // shoulder yoke + trapezius so the shoulder line reads as one continuous mass
  mesh(new THREE.CapsuleGeometry(0.072, 0.3, 8, 16), chest, (m) => {
    m.rotation.z = Math.PI / 2;
    m.position.set(0, 0.2, -0.012);
    m.scale.set(1, 1, 0.82);
  });
  mesh(new THREE.ConeGeometry(0.2, 0.16, 20, 1, true), chest, (m) => {
    m.position.set(0, 0.29, -0.01);
    m.scale.set(1.05, 1, 0.55);
  });
  if (opts.hood) {
    // hood: hides the head shape and gives the silhouette its attitude
    const hood = new THREE.SphereGeometry(0.14, 32, 24, Math.PI / 2 + 0.75, Math.PI * 2 - 1.5, 0, Math.PI * 0.78);
    mesh(hood, head, (m) => {
      m.position.set(0, 0.085, -0.012);
      m.scale.set(1.0, 1.12, 1.1);
      m.rotation.x = -0.12;
      (m.material as THREE.Material).side = THREE.DoubleSide;
    });
    mesh(new THREE.CylinderGeometry(0.13, 0.2, 0.22, 24, 1, true, Math.PI / 2 + 0.9, Math.PI * 2 - 1.8), neck, (m) => {
      m.position.set(0, 0.0, -0.03);
      m.scale.set(1, 1, 0.9);
    });
  }
  const headGeo = new THREE.SphereGeometry(0.102, 32, 24);
  {
    const p = headGeo.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      const z = p.getZ(i);
      // jaw: narrower and forward at the bottom
      const jaw = y < -0.02 ? 1 - (-0.02 - y) * 1.6 : 1;
      p.setXYZ(i, p.getX(i) * 0.86 * jaw, y * 1.12, z * (z > 0 ? 1.02 : 1.05) + (y < -0.03 && z > 0 ? 0.012 : 0));
    }
    headGeo.computeVertexNormals();
  }
  mesh(headGeo, head, (m) => (m.position.y = 0.07));
  // arms
  for (const s of ['L', 'R'] as const) {
    const sh = j[`shoulder${s}`];
    mesh(new THREE.SphereGeometry(0.058, 16, 12), sh, (m) => m.scale.set(1.05, 1, 1));
    mesh(limb(0.29, 0.054, 0.04, 0.012, 0.38), sh);
    mesh(limb(0.26, 0.045, 0.03, 0.01, 0.22), j[`elbow${s}`]);
    if (opts.hands === 'flat')
      mesh(new THREE.CapsuleGeometry(0.035, 0.1, 4, 8), j[`wrist${s}`], (m) => {
        m.position.y = -0.08;
        m.scale.set(1.2, 1, 0.45);
      });
    // legs
    const hip = j[`hip${s}`];
    mesh(limb(0.45, 0.088, 0.055, 0.016, 0.3), hip);
    mesh(limb(0.44, 0.056, 0.034, 0.016, 0.26), j[`knee${s}`]);
    mesh(new THREE.CapsuleGeometry(0.042, 0.16, 6, 10), j[`ankle${s}`], (m) => {
      m.rotation.x = Math.PI / 2;
      m.position.set(0, -0.045, 0.07);
      m.scale.set(1.1, 1, 0.8);
    });
  }
  if (opts.shorts) {
    const sm = new THREE.MeshStandardMaterial({ color: opts.shorts, roughness: 0.35, metalness: 0.2 });
    const shorts = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.23, 0.26, 24, 1, true), sm);
    shorts.position.y = -0.08;
    shorts.scale.z = 0.8;
    hips.add(shorts);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.022, 8, 32), new THREE.MeshStandardMaterial({ color: '#C8A451', metalness: 1, roughness: 0.25 }));
    band.rotation.x = Math.PI / 2;
    band.scale.y = 0.8;
    band.position.y = 0.05;
    hips.add(band);
  }
  if (opts.scale) root.scale.setScalar(opts.scale);
  return { root, joints: j, material: mat, baseHeight: 0.98 } satisfies Rig;
}

/* ------------------------------------ poses ------------------------------------ */

const qa = new THREE.Quaternion();
const qb = new THREE.Quaternion();
const ea = new THREE.Euler(0, 0, 0, 'ZXY');

/** Blends two poses (t in 0..1) and applies them to the rig. */
export function applyPose(rig: Rig, a: Pose, b: Pose = a, t = 0) {
  for (const name of JOINTS) {
    const pa = a[name] ?? [0, 0, 0];
    const pb = b[name] ?? pa;
    qa.setFromEuler(ea.set(pa[0], pa[1], pa[2], 'ZXY'));
    qb.setFromEuler(ea.set(pb[0], pb[1], pb[2], 'ZXY'));
    rig.joints[name].quaternion.slerpQuaternions(qa, qb, t);
  }
  rig.joints.hips.position.y = rig.baseHeight + THREE.MathUtils.lerp(a.lift ?? 0, b.lift ?? a.lift ?? 0, t);
}

/** Orthodox boxing stance — left side forward. */
const STANCE: Pose = {
  hips: [0, -0.55, 0],
  spine: [0.12, 0.05, 0],
  chest: [0.06, 0.25, 0],
  neck: [0.05, 0.1, 0],
  head: [0.14, 0.1, 0],
  hipL: [-0.42, 0.2, 0.08],
  kneeL: [0.62, 0, 0],
  ankleL: [-0.2, 0, 0],
  hipR: [0.18, 0.1, -0.1],
  kneeR: [0.5, 0, 0],
  ankleR: [-0.35, 0, 0],
  lift: -0.07,
};
const GUARD_ARMS: Pose = {
  shoulderL: [-0.62, -0.25, 0.22],
  elbowL: [-2.3, 0, 0],
  wristL: [0, 0, 0],
  shoulderR: [-0.5, 0.25, -0.24],
  elbowR: [-2.45, 0, 0],
  wristR: [0, 0, 0],
};

export const BOXER_POSES = {
  guard: { ...STANCE, ...GUARD_ARMS } as Pose,
  jab: {
    ...STANCE,
    ...GUARD_ARMS,
    chest: [0.1, -0.3, 0],
    shoulderL: [-1.55, -0.12, 0.08],
    elbowL: [-0.05, 0, 0],
    hipL: [-0.5, 0.2, 0.08],
    kneeL: [0.5, 0, 0],
  } as Pose,
  cross: {
    ...STANCE,
    ...GUARD_ARMS,
    hips: [0, -0.15, 0],
    chest: [0.14, 0.55, 0],
    shoulderR: [-1.55, 0.14, -0.06],
    elbowR: [-0.05, 0, 0],
    shoulderL: [-0.7, -0.3, 0.3],
    hipR: [0.3, 0.2, -0.1],
    kneeR: [0.2, 0, 0],
    ankleR: [-0.75, 0, 0],
    lift: -0.06,
  } as Pose,
  load: {
    ...STANCE,
    ...GUARD_ARMS,
    hips: [0, -0.75, 0],
    chest: [0.12, -0.35, 0],
    shoulderL: [-0.45, -0.1, 1.0],
    elbowL: [-1.95, 0, 0],
    kneeL: [0.8, 0, 0],
    kneeR: [0.65, 0, 0],
    lift: -0.11,
  } as Pose,
  hook: {
    ...STANCE,
    ...GUARD_ARMS,
    hips: [0, 0.05, 0],
    spine: [0.1, 0.2, -0.08],
    chest: [0.1, 0.55, -0.1],
    shoulderL: [-0.25, 0.05, 1.42],
    elbowL: [-1.65, 0, 0],
    hipL: [-0.38, 0.4, 0.08],
    ankleL: [-0.2, 0.3, 0],
    kneeL: [0.55, 0, 0],
    kneeR: [0.4, 0, 0],
    ankleR: [-0.6, 0, 0],
    lift: -0.08,
  } as Pose,
};

/**
 * Butterfly stroke. Phase in [0,1): 0 = arms extended forward (pull begins),
 * ~0.5 = arms exit at the hips, recovery over the water back to 1.
 * The rig root should be rotated x = +PI/2 so the swimmer lies face-down heading +z.
 */
export function butterflyPose(phase: number): Pose {
  const TAU = Math.PI * 2;
  const p = phase % 1;
  // arms: full circle in the sagittal plane, swung wide during recovery
  const arm = -Math.PI + TAU * p;
  const recovering = p > 0.5 ? Math.sin((p - 0.5) * 2 * Math.PI) : 0;
  const pulling = p < 0.5 ? Math.sin(p * 2 * Math.PI) : 0;
  const abd = 0.25 + recovering * 1.1;
  const elbow = -0.75 * pulling;
  // two dolphin kicks per arm cycle; body wave travels head → feet
  const w = (lag: number) => Math.sin(TAU * 2 * p - lag);
  const breathe = Math.max(0, Math.sin((p - 0.35) * TAU)) * 0.5;
  return {
    hips: [0.16 * w(1.4), 0, 0],
    spine: [0.12 * w(0.8), 0, 0],
    chest: [0.1 * w(0.2) - breathe * 0.25, 0, 0],
    neck: [-0.15 - breathe * 0.45, 0, 0],
    head: [-0.1, 0, 0],
    shoulderL: [arm, 0, abd],
    shoulderR: [arm, 0, -abd],
    elbowL: [elbow, 0, 0],
    elbowR: [elbow, 0, 0],
    hipL: [0.32 * w(2.0) - 0.05, 0, 0.04],
    hipR: [0.32 * w(2.0) - 0.05, 0, -0.04],
    kneeL: [0.55 + 0.5 * w(2.8), 0, 0],
    kneeR: [0.55 + 0.5 * w(2.8), 0, 0],
    ankleL: [0.9 + 0.3 * w(3.4), 0, 0],
    ankleR: [0.9 + 0.3 * w(3.4), 0, 0],
  };
}
