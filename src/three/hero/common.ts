import * as THREE from 'three';

export type QualityTier = 'low' | 'mid' | 'high';

export interface FrameCtx {
  /** real seconds since last frame (clamped) */
  dt: number;
  /** scene-time seconds (affected by slow motion) */
  sdt: number;
  time: number;
  pointer: THREE.Vector2;
  /** 0..1 scroll progress through the sticky hero */
  scroll: number;
  quality: QualityTier;
}

export interface HeroScene {
  readonly id: 'football' | 'boxing' | 'swimming';
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** scene clock multiplier the engine applies (slow-motion ramps) */
  timeScale: number;
  /** CA/flash/shake signals the engine reads for post-processing */
  fx: { aberration: number; flash: number; shake: number; exposure: number };
  playIntro(): void;
  skipIntro(): void;
  introDone: boolean;
  update(ctx: FrameCtx): void;
  resize(w: number, h: number): void;
  /** is the hero product under this NDC point? */
  hitProduct(ndc: THREE.Vector2): boolean;
  /** called once by the engine with the renderer (environment maps, compile). */
  attach(renderer: THREE.WebGLRenderer): void;
  /** optional: shed load when the device is struggling */
  degrade?(): void;
  dispose(): void;
}

/** Big display word painted to a texture (uses the loaded display font). */
export function wordTexture(word: string, opts: { color?: string; stroke?: string; width?: number; height?: number; alpha?: number } = {}) {
  const w = opts.width ?? 2048;
  const h = opts.height ?? 512;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const family =
    getComputedStyle(document.documentElement).getPropertyValue('--font-display-face').trim() || "'Arial Narrow', sans-serif";
  let size = h * 0.98;
  ctx.font = `900 ${size}px ${family}`;
  const measured = ctx.measureText(word).width;
  if (measured > w * 0.98) size *= (w * 0.98) / measured;
  ctx.font = `900 ${size}px ${family}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.globalAlpha = opts.alpha ?? 1;
  ctx.fillStyle = opts.color ?? '#171A18';
  ctx.fillText(word, w / 2, h * 0.9);
  if (opts.stroke) {
    ctx.lineWidth = 6;
    ctx.strokeStyle = opts.stroke;
    ctx.strokeText(word, w / 2, h * 0.9);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
/** progress of t inside [a,b] */
export const seg = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
export const damp = (a: number, b: number, lambda: number, dt: number) => THREE.MathUtils.damp(a, b, lambda, dt);

/**
 * Dead particles are parked far below the scene at a tiny (non-zero) scale. A zero scale would make
 * shaders normalise zero-length normals → NaN, which MSAA + bloom spread across the whole frame.
 */
const PARKED = new THREE.Matrix4().compose(new THREE.Vector3(0, -9999, 0), new THREE.Quaternion(), new THREE.Vector3(1e-4, 1e-4, 1e-4));

/** Simple CPU particle pool rendered with an InstancedMesh (debris, dust, droplets). */
export class ParticlePool {
  mesh: THREE.InstancedMesh;
  pos: Float32Array;
  vel: Float32Array;
  life: Float32Array;
  maxLife: Float32Array;
  spin: Float32Array;
  size: Float32Array;
  private cursor = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private v = new THREE.Vector3();
  private s = new THREE.Vector3();
  gravity = -9.8;
  drag = 0.6;
  floor: number | null = 0;

  constructor(geo: THREE.BufferGeometry, mat: THREE.Material, public count: number) {
    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.pos = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 3);
    this.life = new Float32Array(count);
    this.maxLife = new Float32Array(count);
    this.spin = new Float32Array(count * 3);
    this.size = new Float32Array(count);
    for (let i = 0; i < count; i++) this.mesh.setMatrixAt(i, PARKED);
  }

  emit(p: THREE.Vector3, v: THREE.Vector3, life: number, size: number) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.count;
    this.pos.set([p.x, p.y, p.z], i * 3);
    this.vel.set([v.x, v.y, v.z], i * 3);
    this.life[i] = life;
    this.maxLife[i] = life;
    this.size[i] = size;
    this.spin.set([Math.random() * 8 - 4, Math.random() * 8 - 4, Math.random() * 8 - 4], i * 3);
  }

  update(dt: number) {
    for (let i = 0; i < this.count; i++) {
      if (this.life[i]! <= 0) continue;
      this.life[i]! -= dt;
      if (this.life[i]! <= 0) {
        this.mesh.setMatrixAt(i, PARKED);
        continue;
      }
      const k = i * 3;
      this.vel[k + 1]! += this.gravity * dt;
      const d = Math.exp(-this.drag * dt);
      this.vel[k]! *= d;
      this.vel[k + 1]! *= d;
      this.vel[k + 2]! *= d;
      this.pos[k]! += this.vel[k]! * dt;
      this.pos[k + 1]! += this.vel[k + 1]! * dt;
      this.pos[k + 2]! += this.vel[k + 2]! * dt;
      if (this.floor !== null && this.pos[k + 1]! < this.floor) {
        this.pos[k + 1] = this.floor;
        this.vel[k + 1] = -this.vel[k + 1]! * 0.25;
        this.vel[k]! *= 0.5;
        this.vel[k + 2]! *= 0.5;
      }
      const lifeT = this.life[i]! / this.maxLife[i]!;
      const sc = Math.max(1e-4, this.size[i]! * Math.min(1, lifeT * 3));
      this.e.set(this.spin[k]! * (1 - lifeT) * 3, this.spin[k + 1]! * (1 - lifeT) * 3, this.spin[k + 2]! * (1 - lifeT) * 3);
      this.q.setFromEuler(this.e);
      this.v.set(this.pos[k]!, this.pos[k + 1]!, this.pos[k + 2]!);
      this.s.setScalar(sc);
      this.m.compose(this.v, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear() {
    this.life.fill(0);
    for (let i = 0; i < this.count; i++) this.mesh.setMatrixAt(i, PARKED);
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/** Radial gradient sprite texture (glows, dust, flares). */
export function glowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)', size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function disposeScene(scene: THREE.Object3D) {
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose?.();
    const mats = (Array.isArray(m.material) ? m.material : m.material ? [m.material] : []) as THREE.Material[];
    for (const mat of mats) {
      for (const v of Object.values(mat)) if (v instanceof THREE.Texture && !v.userData.shared) v.dispose();
      mat.dispose();
    }
  });
}
