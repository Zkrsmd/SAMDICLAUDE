import * as THREE from 'three';
import { crystalGeometry, crystalMaterial, environment, network, particles, WORLDS, type WorldSpec } from './worlds';
import { backdropTex, glowTex } from './textures';

/**
 * SMADI hero engine (three.js). One renderer, four worlds, a single post pass.
 * Opening: a survey network and the crystal's wireframe draw themselves, a flash, and the
 * crystal materialises with the real product frozen inside. Cuts between sports use a radial
 * zoom blur + chromatic split. Drag spins the crystal, holding it thaws the ice, a click
 * explores. HUD labels/lines are positioned from projected 3D anchors every frame (no React).
 */

export interface EngineOptions {
  canvas: HTMLCanvasElement;
  hud: HTMLCanvasElement;
  labels: { spec: HTMLElement; read: HTMLElement; readValue: HTMLElement; explore: HTMLElement };
  ids: string[];
  productUrl: (slug: string) => string;
  fontFamily: string;
  reduced: boolean;
  onExplore: () => void;
  onReady: () => void;
}

interface World {
  spec: WorldSpec;
  group: THREE.Group;
  pivot: THREE.Group;
  crystal: THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>;
  wire: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  product: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  net: ReturnType<typeof network>;
  parts: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  halo: THREE.Sprite;
  caustics: THREE.Mesh[];
  back: THREE.Mesh;
  backAspect?: number;
  base: { roughness: number; normal: number; dispersion: number };
  orb?: { pos: Float32Array; nrm: Float32Array };
}

const POST_VS = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
const POST_FS = /* glsl */ `
  uniform sampler2D tScene;
  uniform vec2 uRes;
  uniform float uTime;
  uniform float uWarp;
  uniform float uFlash;
  uniform float uFade;
  uniform vec3 uFadeColor;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main() {
    vec2 c = vUv - 0.5;
    float ab = 0.0016 + uWarp * 0.02;
    vec3 col;
    if (uWarp > 0.002) {
      col = vec3(0.0);
      for (int i = 0; i < 12; i++) {
        float k = float(i) / 11.0;
        float s = 1.0 - uWarp * 0.22 * k;
        col.r += texture2D(tScene, 0.5 + c * (s + ab)).r;
        col.g += texture2D(tScene, 0.5 + c * s).g;
        col.b += texture2D(tScene, 0.5 + c * (s - ab)).b;
      }
      col /= 12.0;
    } else {
      col.r = texture2D(tScene, 0.5 + c * (1.0 + ab * dot(c, c) * 4.0)).r;
      col.g = texture2D(tScene, vUv).g;
      col.b = texture2D(tScene, 0.5 + c * (1.0 - ab * dot(c, c) * 4.0)).b;
    }
    // soft glow from the brightest highlights (specular on the crystal)
    vec2 px = 1.0 / uRes;
    vec3 glow = vec3(0.0);
    for (int i = 0; i < 8; i++) {
      float a = float(i) * 0.785398;
      vec2 o = vec2(cos(a), sin(a));
      glow += max(texture2D(tScene, vUv + o * px * 9.0).rgb - 0.9, 0.0);
      glow += max(texture2D(tScene, vUv + o * px * 22.0).rgb - 0.9, 0.0) * 0.6;
    }
    col += glow * 0.16;
    col = mix(col, vec3(1.25), uFlash);
    col *= 1.0 - dot(c, c) * 0.62;
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    gl_FragColor.rgb += (hash(vUv * uRes + fract(uTime) * 91.7) - 0.5) * 0.045;
    gl_FragColor.rgb = mix(gl_FragColor.rgb, uFadeColor, uFade);
  }
`;

/** a small studio for reflections: soft gradient dome + four softboxes (fast to compile, unlike a lit room) */
function studioRig() {
  const scene = new THREE.Scene();
  const dome = new THREE.SphereGeometry(10, 24, 16);
  const col: number[] = [];
  const p = dome.attributes.position!;
  for (let i = 0; i < p.count; i++) {
    const k = (p.getY(i) / 10) * 0.5 + 0.5;
    col.push(0.22 + k * 0.55, 0.24 + k * 0.56, 0.27 + k * 0.6);
  }
  dome.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  scene.add(new THREE.Mesh(dome, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const box = (w: number, h: number, x: number, y: number, z: number, v: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(v, v, v * 1.04), side: THREE.DoubleSide }));
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    scene.add(m);
  };
  box(6, 2.5, 0, 7, 2, 6); // top strip
  box(2.2, 6, -7, 1, 3, 3.2); // key left
  box(2.2, 6, 7, 1.5, -2, 2.4); // rim right
  box(5, 1.2, 0, -1, 8, 1.6); // front fill
  return scene;
}

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
const outBack = (t: number, s = 1.6) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
const outExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const inCubic = (t: number) => t * t * t;

export class CrystalEngine {
  private o: EngineOptions;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(36, 1, 0.1, 120);
  private rt: THREE.WebGLRenderTarget;
  private post: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private postScene = new THREE.Scene();
  private postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private env: THREE.Texture;
  private hemi: THREE.HemisphereLight;
  private sun: THREE.DirectionalLight;
  private loader = new THREE.TextureLoader();
  private glow = glowTex();
  private worlds = new Map<string, World>();
  private building = new Map<string, Promise<World>>();
  private active: World | null = null;
  private hud: CanvasRenderingContext2D;
  private raf = 0;
  private clock = new THREE.Clock();
  private t = 0;
  private introAt = -1;
  private cutAt = -1;
  private cutDir = 1;
  private pending: number | null = null;
  private swapped = true;
  private w = 1;
  private h = 1;
  private dpr = 1;
  private dist = 7;
  private mobile = false;
  private visible = true;
  private scroll = 0;
  private pointer = new THREE.Vector2();
  private pointerT = new THREE.Vector2();
  private spin = 0;
  private thaw = 0;
  private thawT = 0;
  private drag: { x: number; y: number; t: number; moved: boolean } | null = null;
  private ray = new THREE.Raycaster();
  private v = new THREE.Vector3();
  private readTick = 0;
  private labelSize = new Map<HTMLElement, [number, number]>();
  private io: IntersectionObserver;
  private ro: ResizeObserver;
  private disposed = false;
  private dprScale = 1;

  constructor(o: EngineOptions) {
    this.o = o;
    this.renderer = new THREE.WebGLRenderer({ canvas: o.canvas, antialias: false, alpha: false, powerPreference: 'high-performance', stencil: false });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.98;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.mobile = window.matchMedia('(max-width: 767px), (pointer: coarse)').matches;
    this.rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: this.mobile ? 2 : 4 });
    this.renderer.transmissionResolutionScale = 0.5;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.env = pmrem.fromScene(studioRig(), 0.035).texture;
    pmrem.dispose();
    this.scene.environment = this.env;

    this.hemi = new THREE.HemisphereLight('#FFFFFF', '#6B7380', 1.4);
    this.sun = new THREE.DirectionalLight('#FFFFFF', 2.2);
    this.sun.position.set(3, 6, 4);
    this.scene.add(this.hemi, this.sun);

    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    tri.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    this.post = new THREE.Mesh(
      tri,
      new THREE.ShaderMaterial({
        vertexShader: POST_VS,
        fragmentShader: POST_FS,
        uniforms: {
          tScene: { value: this.rt.texture },
          uRes: { value: new THREE.Vector2(1, 1) },
          uTime: { value: 0 },
          uWarp: { value: 0 },
          uFlash: { value: 0 },
          uFade: { value: o.reduced ? 0 : 1 },
          uFadeColor: { value: new THREE.Color('#F3F4F6') },
        },
        depthTest: false,
        depthWrite: false,
      }),
    );
    this.post.frustumCulled = false;
    this.postScene.add(this.post);

    this.hud = o.hud.getContext('2d')!;
    this.resize();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(o.canvas);
    this.io = new IntersectionObserver(([e]) => (this.visible = !!e?.isIntersecting));
    this.io.observe(o.canvas);

    o.canvas.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointermove', this.onMove, { passive: true });
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
  }

  /** builds the first world, compiles shaders, then reports ready and pre-builds the rest */
  async init(index: number) {
    performance.mark('crystal:init');
    const first = await this.build(this.o.ids[index]!);
    performance.mark('crystal:built');
    if (this.disposed) return;
    this.activate(first);
    try {
      await this.renderer.compileAsync(this.scene, this.camera);
    } catch {
      /* compile on first draw instead */
    }
    performance.mark('crystal:compiled');
    this.renderFrame(0);
    this.o.onReady();
    this.loop();
  }

  /** warm the other worlds in idle time once the opening has played (no jank during the intro) */
  private async warmRest() {
    const idle = () =>
      new Promise<void>((r) => {
        const w = window as Window & { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number };
        if (w.requestIdleCallback) w.requestIdleCallback(() => r(), { timeout: 1500 });
        else setTimeout(r, 300);
      });
    for (const id of this.o.ids) {
      if (this.disposed) return;
      if (this.worlds.has(id)) continue;
      await idle();
      const w = await this.build(id);
      w.group.visible = true;
      try {
        await this.renderer.compileAsync(w.group, this.camera, this.scene);
      } catch {
        /* ignore */
      }
      if (this.active !== w) w.group.visible = false;
    }
  }

  /** start the opening choreography (call when the loader has opened) */
  start() {
    this.introAt = this.o.reduced ? -10 : this.t;
    window.setTimeout(() => void this.warmRest(), this.o.reduced ? 500 : 3200);
  }

  go(index: number, dir: 1 | -1) {
    const id = this.o.ids[index]!;
    if (this.active?.spec.id === id && this.swapped) return;
    if (this.o.reduced) {
      void this.build(id).then((w) => this.activate(w));
      return;
    }
    this.pending = index;
    this.cutDir = dir;
    this.cutAt = this.t;
    this.swapped = false;
    void this.build(id);
  }

  setScroll(p: number) {
    this.scroll = p;
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.io.disconnect();
    this.o.canvas.removeEventListener('pointerdown', this.onDown);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
    this.scene.traverse((obj) => {
      const m = obj as THREE.Mesh;
      m.geometry?.dispose();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      for (const mat of mats) {
        for (const v of Object.values(mat)) if (v instanceof THREE.Texture) v.dispose();
        mat.dispose();
      }
    });
    this.post.material.dispose();
    this.post.geometry.dispose();
    this.rt.dispose();
    this.env.dispose();
    this.glow.dispose();
    this.renderer.dispose();
  }

  /* ------------------------------------------------------------ building */

  private build(id: string): Promise<World> {
    const hit = this.building.get(id);
    if (hit) return hit;
    const p = (async () => {
      const spec = WORLDS[id]!;
      const tex = await this.loader.loadAsync(this.o.productUrl(spec.product));
      performance.mark(`crystal:tex:${id}`);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
      const group = new THREE.Group();
      group.visible = false;
      const envr = environment(spec, this.o.fontFamily);
      performance.mark(`crystal:env:${id}`);
      group.add(envr.group);

      const pivot = new THREE.Group();
      pivot.position.y = 0.15;
      group.add(pivot);
      const geo = crystalGeometry(spec.crystal);
      const mat = crystalMaterial(spec, this.env);
      performance.mark(`crystal:mat:${id}`);
      const crystal = new THREE.Mesh(geo, mat);
      pivot.add(crystal);
      const wire = new THREE.LineSegments(
        new THREE.EdgesGeometry(spec.crystal === 'orb' ? new THREE.IcosahedronGeometry(1.2, 2) : geo, spec.crystal === 'orb' ? 1 : 12),
        new THREE.LineBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0, depthWrite: false, fog: false }),
      );
      pivot.add(wire);

      const aspect = tex.image.height / tex.image.width;
      const pw = spec.productWidth;
      const product = new THREE.Mesh(
        new THREE.PlaneGeometry(pw, pw * aspect),
        new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.45, alphaToCoverage: true, side: THREE.DoubleSide, color: '#EEF3F8' }),
      );
      product.position.y = 0.15;
      group.add(product);

      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, color: spec.light, transparent: true, opacity: 0.55, depthWrite: false, fog: false }));
      halo.scale.set(7, 7, 1);
      halo.position.set(0, 0.4, -1.6);
      group.add(halo);

      const net = network(spec.id.length * 101 + 7);
      group.add(net.lines);
      const parts = particles(spec);
      group.add(parts);

      const world: World = {
        spec,
        group,
        pivot,
        crystal,
        wire,
        product,
        net,
        parts,
        halo,
        caustics: envr.caustics,
        back: envr.back,
        base: { roughness: mat.roughness, normal: mat.normalScale.x, dispersion: mat.dispersion },
      };
      if (spec.crystal === 'orb') {
        const pos = geo.attributes.position!;
        world.orb = { pos: Float32Array.from(pos.array as Float32Array), nrm: Float32Array.from(geo.attributes.normal!.array as Float32Array) };
      }
      this.scene.add(group);
      this.worlds.set(id, world);
      return world;
    })();
    this.building.set(id, p);
    return p;
  }

  private activate(w: World) {
    if (this.active) this.active.group.visible = false;
    this.active = w;
    w.group.visible = true;
    const s = w.spec;
    this.scene.fog = new THREE.Fog(s.fog, 6, 24);
    this.scene.background = new THREE.Color(s.fog);
    this.hemi.color.set(s.light);
    this.sun.color.set(s.light);
    this.o.labels.spec.querySelector('[data-code]')!.textContent = `SPECIMEN_0${this.o.ids.indexOf(s.id) + 1} // ${s.code}`;
    this.o.labels.read.querySelector('[data-label]')!.textContent = s.readout.label;
    this.labelSize.clear();
    this.fitBackdrop();
  }

  /** size the sky plane to the view and redraw it for this screen shape, so the word always reads */
  private fitBackdrop() {
    const w = this.active;
    if (!w) return;
    const camZ = this.dist;
    const camY = 0.55;
    const lookY = this.mobile ? -0.55 : -0.05;
    const d = camZ + 12;
    const visH = 2 * d * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * 1.1;
    const visW = visH * this.camera.aspect;
    w.back.scale.set(visW / 64, visH / 32, 1);
    w.back.position.y = camY + (lookY - camY) * (d / camZ);
    const aspect = Math.round(this.camera.aspect * 10) / 10;
    if (w.backAspect !== aspect) {
      w.backAspect = aspect;
      const mat = w.back.material as THREE.MeshBasicMaterial;
      mat.map?.dispose();
      mat.map = backdropTex(w.spec.word, [w.spec.sky[0], w.spec.fog], this.o.fontFamily, w.spec.id.length * 17, aspect);
      mat.needsUpdate = true;
    }
  }

  /* ------------------------------------------------------------ input */

  private hits(x: number, y: number) {
    if (!this.active) return false;
    const r = this.o.canvas.getBoundingClientRect();
    this.ray.setFromCamera(new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1), this.camera);
    return this.ray.intersectObject(this.active.crystal, false).length > 0;
  }

  private onDown = (e: PointerEvent) => {
    if (!this.hits(e.clientX, e.clientY)) return;
    e.stopPropagation(); // the crystal owns this gesture — no sport swipe
    this.drag = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false };
    this.thawT = 1;
  };
  private onMove = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') this.pointerT.set(e.clientX / window.innerWidth - 0.5, e.clientY / window.innerHeight - 0.5);
    if (this.drag) {
      const dx = e.clientX - this.drag.x;
      if (Math.abs(dx) > 6) this.drag.moved = true;
      this.spin += dx * 0.012;
      this.drag.x = e.clientX;
    }
    if (e.pointerType === 'mouse') this.o.canvas.style.cursor = this.hits(e.clientX, e.clientY) ? 'grab' : '';
  };
  private onUp = () => {
    if (!this.drag) return;
    const quick = performance.now() - this.drag.t < 260 && !this.drag.moved;
    this.drag = null;
    this.thawT = 0;
    if (quick) this.o.onExplore();
  };

  /* ------------------------------------------------------------ frame */

  private resize() {
    const c = this.o.canvas;
    this.w = Math.max(1, c.clientWidth);
    this.h = Math.max(1, c.clientHeight);
    this.mobile = this.w < 768;
    this.dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, this.mobile ? 1.6 : 1.5) * this.dprScale);
    // refraction rendered at roughly CSS-pixel resolution: crisp product, half the cost on retina
    this.renderer.transmissionResolutionScale = Math.min(1, 1.1 / this.dpr);
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(this.w, this.h, false);
    this.rt.setSize(Math.round(this.w * this.dpr), Math.round(this.h * this.dpr));
    this.post.material.uniforms.uRes!.value.set(this.w * this.dpr, this.h * this.dpr);
    this.fitBackdrop();
    const aspect = this.w / this.h;
    this.camera.aspect = aspect;
    const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    this.dist = Math.max(2.45 / tan, (this.mobile ? 1.62 : 2.05) / (tan * aspect));
    this.camera.updateProjectionMatrix();
    const hud = this.o.hud;
    hud.width = Math.round(this.w * this.dpr);
    hud.height = Math.round(this.h * this.dpr);
    this.labelSize.clear();
  }

  private frameAvg = 1 / 60;
  private frameCheck = 0;
  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const raw = this.clock.getDelta();
    const dt = Math.min(0.05, raw);
    if (!this.visible || document.hidden) return;
    this.t += dt;
    this.renderFrame(dt);
    // adaptive sharpness: if frames run long, step the pixel ratio down (never below 1)
    this.frameAvg += (raw - this.frameAvg) * 0.05;
    this.frameCheck += raw;
    if (this.frameCheck > 1.2) {
      this.frameCheck = 0;
      // quality ladder: MSAA 4 → 2 → 0, then pixel ratio down to 0.75 of native
      if (this.frameAvg > 1 / 42) {
        if (this.rt.samples > 0) {
          this.rt.samples = this.rt.samples > 2 ? 2 : 0;
          this.rt.dispose();
          this.post.material.uniforms.tScene!.value = this.rt.texture;
        } else if (this.dprScale > 0.6) this.dprScale -= 0.15;
        this.resize();
        this.frameAvg = 1 / 60;
      }
    }
  };

  private renderFrame(dt: number) {
    const w = this.active;
    if (!w) return;
    const t = this.t;
    const u = this.post.material.uniforms;
    const reduced = this.o.reduced;
    const dev = process.env.NODE_ENV !== 'production' ? (window as Window & { __crystalT?: number }).__crystalT : undefined;
    const ti = typeof dev === 'number' ? dev : this.introAt < 0 ? (reduced ? 99 : -1) : t - this.introAt;

    // ---- cut between sports: warp up, swap at the peak, warp down
    let warp = 0;
    if (this.cutAt >= 0) {
      const k = t - this.cutAt;
      if (!this.swapped) {
        warp = inCubic(seg(k, 0, 0.32));
        const next = this.worlds.get(this.o.ids[this.pending!]!);
        if (k >= 0.32 && next) {
          this.activate(next);
          this.swapped = true;
          this.cutAt = t;
          this.spin += this.cutDir * 3.2;
          this.introAt = t - 1.15; // replay the tail of the opening: wire flash + materialise
        }
      } else {
        warp = 1 - outExpo(seg(k, 0, 0.6));
        if (k > 0.6) this.cutAt = -1;
      }
    }

    // ---- opening choreography
    const draw = ti < 0 ? 0 : seg(ti, 0, 1.25);
    const mat = ti < 0 ? 0 : seg(ti, 1.3, 2.2);
    const flash = ti < 0 ? 0 : Math.max(0, 1 - Math.abs(ti - 1.32) / 0.16) * 0.85;
    w.crystal.visible = ti >= 1.3;
    w.product.visible = ti >= 1.3;
    const pop = outBack(mat, 2.2);
    w.pivot.scale.setScalar(ti >= 1.3 ? THREE.MathUtils.lerp(1.28, 1, pop) : 1);
    w.wire.material.opacity = ti < 0 ? 0 : ti < 1.3 ? 0.9 * seg(ti, 0, 0.3) : 0.9 * (1 - mat) + (w.spec.crystal === 'orb' ? 0.05 : 0.2);
    const wirePos = w.wire.geometry.attributes.position!;
    w.wire.geometry.setDrawRange(0, Math.floor(wirePos.count * (ti < 1.3 ? draw : 1)));
    w.net.lines.geometry.setDrawRange(0, Math.floor(w.net.segments * 2 * draw));
    w.net.lines.material.opacity = 0.6 - 0.3 * mat;
    u.uFade!.value = reduced ? 0 : Math.max(1 - seg(ti, 0, 0.7), this.scroll > 0.7 ? seg(this.scroll, 0.7, 1) : 0);
    if (ti < 0) u.uFade!.value = 1;

    // ---- idle life
    this.pointer.lerp(this.pointerT, 0.06);
    this.thaw += (this.thawT - this.thaw) * 0.08;
    this.spin *= 0.94;
    const idle = reduced ? 0 : 1;
    w.pivot.rotation.y += (0.22 * idle + this.spin) * dt;
    w.pivot.rotation.x = Math.sin(t * 0.3) * 0.08 * idle + this.pointer.y * 0.25;
    w.pivot.rotation.z = Math.sin(t * 0.21) * 0.05 * idle;
    const bob = Math.sin(t * 0.8) * 0.07 * idle;
    w.pivot.position.y = 0.15 + bob;
    w.product.position.y = 0.15 + bob;
    w.product.rotation.y = Math.sin(t * 0.45) * 0.16 * idle + this.pointer.x * 0.35;
    w.product.rotation.z = Math.sin(t * 0.33) * 0.03 * idle;
    const m = w.crystal.material;
    m.roughness = THREE.MathUtils.lerp(w.base.roughness, 0, this.thaw);
    m.normalScale.setScalar(THREE.MathUtils.lerp(w.base.normal, w.base.normal * 0.12, this.thaw));
    m.dispersion = THREE.MathUtils.lerp(w.base.dispersion, w.base.dispersion * 0.3, this.thaw);
    m.thickness = (w.spec.material.thickness ?? 1) * (1 - this.thaw * 0.5);
    if (w.orb && !reduced) {
      const pos = w.crystal.geometry.attributes.position as THREE.BufferAttribute;
      const { pos: b, nrm: n } = w.orb;
      for (let i = 0; i < pos.count; i++) {
        const x = b[i * 3]!;
        const y = b[i * 3 + 1]!;
        const z = b[i * 3 + 2]!;
        const d = Math.sin(x * 3.1 + t * 1.7) * Math.sin(y * 2.7 - t * 1.3) * 0.045 + Math.sin(z * 4.0 + t * 2.3) * 0.02;
        pos.setXYZ(i, x + n[i * 3]! * d, y + n[i * 3 + 1]! * d, z + n[i * 3 + 2]! * d);
      }
      pos.needsUpdate = true;
      w.crystal.geometry.computeVertexNormals();
    }
    w.parts.material.uniforms.uTime!.value = t;
    w.parts.material.uniforms.uPixel!.value = this.h * this.dpr * 0.5;
    w.parts.material.uniforms.uOpacity!.value = 0.35 + 0.65 * draw;
    w.net.lines.rotation.y = t * 0.025;
    w.halo.material.opacity = 0.45 + Math.sin(t * 1.2) * 0.08 + flash * 0.4;
    w.caustics.forEach((c, i) => {
      const map = (c.material as THREE.MeshBasicMaterial).map!;
      map.offset.set(t * (i ? -0.011 : 0.008), t * (i ? 0.006 : -0.01));
    });

    // ---- camera: slow orbit, pointer parallax, scroll dolly
    const sc = this.scroll;
    const orbit = Math.sin(t * 0.12) * 0.25 * idle;
    const dist = this.dist * (1 - sc * 0.32) * (ti >= 0 && ti < 2.4 ? THREE.MathUtils.lerp(1.12, 1, outExpo(seg(ti, 0.2, 2.4))) : 1);
    this.camera.position.set(Math.sin(orbit) * dist * 0.15 + this.pointer.x * 0.6, 0.55 + this.pointer.y * -0.3 + sc * 0.4, dist);
    this.camera.lookAt(0, this.mobile ? -0.55 : -0.05, 0);

    // ---- render
    u.uTime!.value = t;
    u.uWarp!.value = warp + sc * 0.18;
    u.uFlash!.value = flash;
    this.renderer.setRenderTarget(this.rt);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.postScene, this.postCam);

    this.drawHud(w, ti, draw);
  }

  /* ------------------------------------------------------------ HUD */

  private project(x: number, y: number, z: number, parent?: THREE.Object3D) {
    this.v.set(x, y, z);
    if (parent) parent.localToWorld(this.v);
    this.v.project(this.camera);
    return [(this.v.x * 0.5 + 0.5) * this.w, (-this.v.y * 0.5 + 0.5) * this.h, this.v.z] as const;
  }

  private size(el: HTMLElement) {
    let s = this.labelSize.get(el);
    if (!s) {
      s = [el.offsetWidth, el.offsetHeight];
      this.labelSize.set(el, s);
    }
    return s;
  }

  private drawHud(w: World, ti: number, draw: number) {
    const ctx = this.hud;
    const { w: W, h: H } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    // callouts need room: hidden on short (landscape phone) screens
    const show = (ti >= 1.45 || this.o.reduced) && this.h >= 560 ? 1 : 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1;
    ctx.font = '500 10px ui-monospace, SFMono-Regular, Menlo, monospace';

    // survey network numbers
    const n = Math.floor(w.net.nodes.length * draw);
    for (let i = 0; i < n; i++) {
      const p = w.net.nodes[i]!;
      const [x, y, z] = this.project(p.x, p.y, p.z, w.net.lines);
      if (z > 1) continue;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
      ctx.fillText(w.net.labels[i]!, x + 5, y - 5);
    }
    ctx.globalAlpha = 1;

    // callouts: anchor on the crystal → elbow → underline the label
    const L = this.o.labels;
    const pad = 16;
    const narrow = W < 640;
    const place = (el: HTMLElement, anchor: readonly [number, number, number], side: 'left' | 'right', dy: number) => {
      const [lw, lh] = this.size(el);
      let x = side === 'left' ? anchor[0] - (narrow ? 70 : 150) - lw : anchor[0] + (narrow ? 40 : 90);
      let y = anchor[1] + dy - lh;
      x = clamp(x, pad, W - pad - lw);
      y = clamp(y, narrow ? 178 : 110, H - (narrow ? 300 : 230));
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      el.style.opacity = String(show);
      if (!show) return;
      const ux = side === 'left' ? x + lw : x;
      const uy = y + lh + 6;
      ctx.beginPath();
      ctx.moveTo(anchor[0], anchor[1]);
      ctx.lineTo(ux, uy);
      ctx.lineTo(side === 'left' ? x : x + lw, uy);
      ctx.stroke();
      ctx.strokeRect(anchor[0] - 3, anchor[1] - 3, 6, 6);
    };
    place(L.spec, this.project(-0.7, 0.95, 0.35, w.group), 'left', -40);
    place(L.read, this.project(0.85, 0.55, 0.35, w.group), 'right', -30);
    place(L.explore, this.project(0.55, -0.9, 0.35, w.group), 'right', 70);

    // live readout
    this.readTick += 1;
    if (this.readTick % 8 === 0) {
      const [a, b] = w.spec.readout.base;
      const j = () => (Math.random() - 0.5) * 0.08;
      const fmt = (v: number) => (v < 0 ? '−' : '+') + Math.abs(v).toFixed(2).padStart(5, '0');
      L.readValue.textContent = `${fmt(a + j())} ${w.spec.readout.unit}  ${fmt(b + j())}`;
    }
  }
}
