import * as THREE from 'three';
import {
  BloomEffect,
  ChromaticAberrationEffect,
  EffectComposer,
  EffectPass,
  RenderPass,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from 'postprocessing';
import { createFootballScene } from './football';
import { createBoxingScene } from './boxing';
import { createSwimmingScene } from './swimming';
import { createScreenOverlay, createSwarm, type SwarmShape } from './overlay';
import { easeInOutCubic, seg, type FrameCtx, type HeroScene, type QualityTier } from './common';

export const SLIDES = ['football', 'boxing', 'swimming'] as const;
const FACTORIES = [createFootballScene, createBoxingScene, createSwimmingScene];

const LOOK: Record<(typeof SLIDES)[number], { shape: SwarmShape; c1: string; c2: string; smear: string; fog: string }> = {
  football: { shape: 0, c1: '#6FA83E', c2: '#5A3F27', smear: '#A9CF7E', fog: '#F4F1E6' },
  boxing: { shape: 2, c1: '#EFE6D2', c2: '#C8A451', smear: '#EFE9DC', fog: '#F3F0EA' },
  swimming: { shape: 3, c1: '#C9F2EF', c2: '#FFFFFF', smear: '#86D9DC', fog: '#EEF7F7' },
};

interface Transition {
  from: number;
  to: number;
  dir: 1 | -1;
  p: number;
  target: number;
  cut: boolean;
}

export interface EngineEvents {
  onIndex?: (i: number) => void;
  onIntroDone?: (i: number) => void;
  onDegrade?: () => void;
}

export class HeroEngine {
  readonly renderer: THREE.WebGLRenderer;
  readonly quality: QualityTier;
  scenes: (HeroScene | null)[] = [null, null, null];
  active = 0;
  pointer = new THREE.Vector2();
  scroll = 0;
  visible = true;
  reducedMotion = false;
  private visited = new Set<number>();
  private time = 0;
  private tr: Transition | null = null;
  private dragging = false;
  private introPhase: 'waiting' | 'fog' | 'done' = 'waiting';
  private fogT = 0;
  private overlayScene = new THREE.Scene();
  private overlay = createScreenOverlay();
  private swarm;
  private composer: EffectComposer | null = null;
  private renderPass: RenderPass | null = null;
  private overlayPass: RenderPass | null = null;
  private effectPass: EffectPass | null = null;
  private ca: ChromaticAberrationEffect | null = null;
  private w = 1;
  private h = 1;
  private fpsAcc = 0;
  private fpsFrames = 0;
  private degradeLevel = 0;
  private notifiedIntro = new Set<number>();
  private queued: { index: number; dir?: 1 | -1 } | null = null;

  constructor(
    renderer: THREE.WebGLRenderer,
    quality: QualityTier,
    private events: EngineEvents = {},
  ) {
    this.renderer = renderer;
    this.quality = quality;
    this.swarm = createSwarm(quality);
    this.overlayScene.add(this.swarm.mesh, this.overlay.quad);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = quality !== 'low';
    renderer.shadowMap.type = THREE.PCFShadowMap;
    if (quality === 'low') {
      renderer.toneMapping = THREE.NeutralToneMapping;
    } else {
      renderer.toneMapping = THREE.NoToneMapping;
      this.composer = new EffectComposer(renderer, {
        frameBufferType: THREE.HalfFloatType,
        multisampling: quality === 'high' ? 4 : 0,
      });
      const cam = new THREE.PerspectiveCamera();
      this.renderPass = new RenderPass(new THREE.Scene(), cam);
      this.overlayPass = new RenderPass(this.overlayScene, cam);
      this.overlayPass.clear = false;
      this.ca = new ChromaticAberrationEffect({ offset: new THREE.Vector2(0, 0), radialModulation: true, modulationOffset: 0.25 });
      this.effectPass = new EffectPass(
        cam,
        new BloomEffect({ intensity: 0.55, luminanceThreshold: 0.86, luminanceSmoothing: 0.2, mipmapBlur: true, radius: 0.72 }),
        this.ca,
        new VignetteEffect({ darkness: 0.28, offset: 0.32 }),
        new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }),
      );
      this.composer.addPass(this.renderPass);
      this.composer.addPass(this.overlayPass);
      this.composer.addPass(this.effectPass);
    }
  }

  /** Builds and compiles the first scene, reporting progress for the loader. */
  async init(index: number, onProgress: (p: number) => void) {
    this.active = index;
    const tick = () => new Promise<void>((r) => setTimeout(r, 16));
    onProgress(0.15);
    await tick();
    this.ensure(index);
    onProgress(0.55);
    await tick();
    const s = this.scenes[index]!;
    try {
      this.renderer.compile(s.scene, s.camera);
      this.renderer.compile(this.overlayScene, s.camera);
    } catch {
      /* compile is an optimisation only */
    }
    onProgress(0.85);
    await tick();
    this.overlay.uniforms.uFog.value = 1;
    this.overlay.uniforms.uFogColor.value.set(LOOK[SLIDES[index] ?? 'football'].fog);
    this.render(0);
    onProgress(1);
  }

  ensure(i: number) {
    if (this.scenes[i]) return this.scenes[i]!;
    const s = FACTORIES[i]!(this.quality);
    s.attach(this.renderer);
    if (this.degradeLevel >= 2) s.degrade?.();
    s.resize(this.w, this.h);
    this.scenes[i] = s;
    return s;
  }

  /** Prebuild + compile a scene while the browser is idle. */
  preload(i: number) {
    if (this.scenes[i]) return;
    const s = this.ensure(i);
    try {
      this.renderer.compile(s.scene, s.camera);
    } catch {
      /* ignore */
    }
  }

  /** Called when the loader hands over: fog dive + first scene intro. */
  startIntro(skip: boolean) {
    const s = this.ensure(this.active);
    this.visited.add(this.active);
    if (skip || this.reducedMotion) {
      s.skipIntro();
      this.introPhase = 'done';
      this.overlay.uniforms.uFog.value = 0;
      return;
    }
    s.playIntro();
    this.introPhase = 'fog';
    this.fogT = 0;
  }

  /** The slide the hero is heading to (queued target, running transition, or current). */
  get destination() {
    return this.queued?.index ?? (this.tr && this.tr.target === 1 ? this.tr.to : this.active);
  }

  goTo(index: number, dir?: 1 | -1) {
    if (index === this.active && !this.tr) return;
    if (this.tr) {
      // a tap during a transition is queued, never dropped
      this.queued = { index, dir };
      return;
    }
    const d = dir ?? (index > this.active ? 1 : -1);
    this.ensure(index);
    if (this.reducedMotion) {
      this.cutTo(index);
      return;
    }
    this.startTransition(index, d, 0);
    this.tr!.target = 1;
  }

  /** Finger-follow preview. f in [-1, 1] = horizontal drag / width (negative = next). */
  drag(f: number) {
    if (this.reducedMotion) return;
    const dir: 1 | -1 = f < 0 ? 1 : -1;
    const to = (this.active + dir + SLIDES.length) % SLIDES.length;
    this.dragging = true;
    if (!this.tr) {
      this.ensure(to);
      this.startTransition(to, dir, 0);
    } else if (!this.tr.cut && this.tr.dir !== dir) {
      this.tr.dir = dir;
      this.tr.to = to;
      this.ensure(to);
      this.applyLook(this.tr);
    }
    if (this.tr && !this.tr.cut) this.tr.p = Math.min(0.42, Math.abs(f) * 0.9);
  }

  release(commit: boolean) {
    this.dragging = false;
    if (!this.tr) return;
    if (commit || this.tr.cut) this.tr.target = 1;
    else this.tr.target = 0;
  }

  hitTest(ndc: THREE.Vector2) {
    const s = this.scenes[this.active];
    return !!s && s.introDone && s.hitProduct(ndc);
  }

  resize(w: number, h: number) {
    this.w = w;
    this.h = h;
    for (const s of this.scenes) s?.resize(w, h);
    this.composer?.setSize(w, h);
    this.swarm.uniforms.uAspect.value = w / h;
    this.overlay.uniforms.uAspect.value = w / h;
  }

  private startTransition(to: number, dir: 1 | -1, p: number) {
    this.tr = { from: this.active, to, dir, p, target: p, cut: false };
    this.applyLook(this.tr);
  }

  private applyLook(tr: Transition) {
    const a = LOOK[SLIDES[tr.from] ?? 'football'];
    const b = LOOK[SLIDES[tr.to] ?? 'football'];
    const u = this.swarm.uniforms;
    u.uShapeA.value = a.shape;
    u.uShapeB.value = b.shape;
    u.uColA.value.set(a.c1);
    u.uColA2.value.set(a.c2);
    u.uColB.value.set(b.c1);
    u.uColB2.value.set(b.c2);
    u.uDir.value = -tr.dir;
    this.overlay.uniforms.uColA.value.set(a.smear);
    this.overlay.uniforms.uColB.value.set(b.smear);
    this.overlay.uniforms.uDir.value = -tr.dir;
  }

  private cutTo(i: number) {
    this.active = i;
    const s = this.ensure(i);
    if (this.visited.has(i) || this.reducedMotion) s.skipIntro();
    else s.playIntro();
    this.visited.add(i);
    this.events.onIndex?.(i);
  }

  frame(rawDt: number) {
    const dt = Math.min(rawDt, 1 / 20);
    this.time += dt;
    this.monitor(rawDt);
    const ou = this.overlay.uniforms;
    ou.uTime.value = this.time;
    this.swarm.uniforms.uTime.value = this.time;

    // ---------------- transition state ----------------
    let whip = 0;
    let smear = 0;
    if (this.tr) {
      const tr = this.tr;
      if (!this.dragging) {
        const speed = tr.target > tr.p ? 0.85 : 2.6;
        tr.p += Math.sign(tr.target - tr.p) * dt * speed;
        if ((tr.target === 1 && tr.p >= 1) || (tr.target === 0 && tr.p <= 0)) tr.p = tr.target;
      }
      if (!tr.cut && tr.p >= 0.5) {
        tr.cut = true;
        this.cutTo(tr.to);
      }
      const p = tr.p;
      smear = p < 0.5 ? easeInOutCubic(seg(p, 0.05, 0.48)) : 1 - easeInOutCubic(seg(p, 0.52, 0.86));
      whip = p < 0.5 ? -tr.dir * 0.55 * easeInOutCubic(p / 0.5) : tr.dir * 0.55 * (1 - easeInOutCubic((p - 0.5) / 0.5));
      this.swarm.uniforms.uP.value = p;
      this.swarm.uniforms.uMorph.value = easeInOutCubic(seg(p, 0.3, 0.75));
      this.swarm.uniforms.uOpacity.value = 1;
      if ((tr.p >= 1 && tr.target === 1) || (tr.p <= 0 && tr.target === 0)) {
        this.tr = null;
        this.swarm.uniforms.uOpacity.value = 0;
        const q = this.queued;
        this.queued = null;
        if (q && q.index !== this.active) this.goTo(q.index, q.dir);
      }
    }
    ou.uSmear.value = smear;
    ou.uDir.value = this.tr ? -this.tr.dir : 1;

    // ---------------- intro fog dive ----------------
    let dive = 0;
    if (this.introPhase === 'fog') {
      this.fogT += dt;
      ou.uFog.value = 1 - easeInOutCubic(seg(this.fogT, 0.1, 2.1));
      dive = 1 - easeInOutCubic(seg(this.fogT, 0.0, 2.0));
      if (this.fogT > 2.2) {
        this.introPhase = 'done';
        ou.uFog.value = 0;
      }
    }

    if (!this.visible) return;
    const s = this.scenes[this.active];
    if (!s) return;
    const ctx: FrameCtx = {
      dt: this.introPhase === 'waiting' ? 0 : dt,
      sdt: dt * s.timeScale,
      time: this.time,
      pointer: this.pointer,
      scroll: this.scroll,
      quality: this.quality,
    };
    s.update(ctx);
    if (s.introDone && !this.notifiedIntro.has(this.active)) {
      this.notifiedIntro.add(this.active);
      this.events.onIntroDone?.(this.active);
    }
    // camera choreography layered on top of the scene camera
    if (whip !== 0) s.camera.rotateY(whip);
    if (dive > 0) {
      s.camera.position.y += dive * 1.6;
      s.camera.rotateX(-dive * 0.55);
    }
    ou.uFlash.value = Math.max(s.fx.flash, 0);
    if (this.ca) {
      const k = s.fx.aberration * 0.006 + smear * 0.004;
      this.ca.offset.set(k, k * 0.6);
    }
    this.render(dt);
  }

  private render(dt: number) {
    const s = this.scenes[this.active];
    if (!s) return;
    if (this.composer && this.renderPass && this.overlayPass && this.effectPass) {
      this.renderPass.mainScene = s.scene;
      this.renderPass.mainCamera = s.camera;
      this.overlayPass.mainCamera = s.camera;
      this.effectPass.mainCamera = s.camera;
      this.composer.render(dt);
    } else {
      const r = this.renderer;
      r.autoClear = true;
      r.render(s.scene, s.camera);
      r.autoClear = false;
      r.render(this.overlayScene, s.camera);
      r.autoClear = true;
    }
  }

  /** Runtime quality manager: step 1 lowers resolution, step 2 drops bloom and sheds scene load. */
  private monitor(rawDt: number) {
    if (this.degradeLevel >= 2 || !this.visible) return;
    this.fpsAcc += rawDt;
    this.fpsFrames++;
    if (this.fpsAcc > 2.5) {
      const fps = this.fpsFrames / this.fpsAcc;
      this.fpsAcc = 0;
      this.fpsFrames = 0;
      if (fps < 32 && this.time > 5 && !this.tr) {
        this.degradeLevel++;
        if (this.degradeLevel === 1) this.events.onDegrade?.();
        else {
          this.composer = null;
          this.renderer.toneMapping = THREE.NeutralToneMapping;
          for (const sc of this.scenes) sc?.degrade?.();
        }
      }
    }
  }

  dispose() {
    for (const s of this.scenes) s?.dispose();
    this.composer?.dispose();
    this.swarm.mesh.geometry.dispose();
    (this.swarm.mesh.material as THREE.Material).dispose();
    this.overlay.quad.geometry.dispose();
    (this.overlay.quad.material as THREE.Material).dispose();
  }
}

/** Picks an initial quality tier from device hints (refined at runtime by FPS sampling). */
export function detectQuality(): QualityTier {
  if (typeof window === 'undefined') return 'mid';
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency ?? 4;
  const mem = nav.deviceMemory ?? 4;
  const small = Math.min(window.innerWidth, window.innerHeight) < 600;
  let gpu = '';
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') ?? c.getContext('webgl');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    gpu = ext && gl ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
  } catch {
    /* ignore */
  }
  const weakGpu = /swiftshader|llvmpipe|mali-4|adreno \(tm\) 3|powervr|intel\(r\) hd graphics [2-5]/i.test(gpu);
  if (weakGpu || cores <= 4 || mem <= 3) return 'low';
  if (small || cores <= 6) return 'mid';
  return 'high';
}

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return false;
  }
}
