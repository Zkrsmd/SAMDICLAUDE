import * as THREE from 'three';
import { crystalGeometry, crystalMaterial, environment, network, particles, WORLDS, type Panel, type WorldSpec } from './worlds';
import { backdropTex, glowTex } from './textures';
import { droplets, fracture, panelShards, shardMaterial, spray } from './burst';
import { debris, type DebrisMesh } from './debris';
import { heroCrew, heroMedia, heroSlides } from '@/config/hero';
import { swell, type OceanMesh } from './ocean';

/** wrap a sphere's equirect texture (the basketball's seams) around fractured pieces */
function seamed(g: THREE.BufferGeometry) {
  const p = g.attributes.position!;
  const uv = g.attributes.uv!;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    const phi = Math.atan2(v.z, -v.x);
    uv.setXY(i, (phi < 0 ? phi + Math.PI * 2 : phi) / (Math.PI * 2), 1 - Math.acos(THREE.MathUtils.clamp(v.y, -1, 1)) / Math.PI);
  }
  uv.needsUpdate = true;
  return g;
}

/**
 * SMADI hero engine (three.js). One renderer, four worlds, a single post pass.
 * Opening: a survey network and the crystal's wireframe draw themselves, a flash, the crystal
 * materialises around the real product, strains — and breaks: solid shards (or droplets) fly
 * out with drag, gravity and spin, a shockwave refracts the frame, the camera takes the hit,
 * and the product is left floating free. Cuts between sports zoom-blur and replay the break.
 * Drag turns the product, a click explores. HUD labels follow projected 3D anchors (no React).
 */

export interface EngineOptions {
  canvas: HTMLCanvasElement;
  hud: HTMLCanvasElement;
  labels: { spec: HTMLElement; read: HTMLElement; readValue: HTMLElement };
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
  /** the sport's film on the back wall (poster first, then the playing video) */
  film?: { plane: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>; src: string; el: HTMLVideoElement | null; tex: THREE.VideoTexture | null; aspect: number };
  /** more of the sport's products, thrown out by the break to hang around the hero product */
  crew: { mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>; spin: number }[];
  /** swimming: the 3D ocean in front of the film */
  sea?: OceanMesh;
  base: { roughness: number; normal: number; dispersion: number };
  orb?: { pos: Float32Array; nrm: Float32Array };
  shards: THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>;
  shardU: ReturnType<typeof shardMaterial>['uniforms'];
  spray: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  sprayU: ReturnType<typeof spray>['uniforms'];
  /** sport matter thrown out with the glass (turf, sweat and wraps, hardwood) */
  debris: DebrisMesh[];
  beams: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[];
  broke: boolean;
}

/** placeholder map so a film plane compiles once with a texture slot (no recompile when the poster lands) */
const BLANK = new THREE.DataTexture(new Uint8Array([167, 178, 192, 255]), 1, 1);
BLANK.needsUpdate = true;

/**
 * The film is the whole backdrop: object-fit cover on a plane filling the view, graded cool (part
 * desaturated, steel-blue shadows), with a slow push-in the engine punches on the break.
 */
const FILM_VS = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const FILM_FS = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec2 uRep;
  uniform vec2 uOff;
  uniform float uZoom;
  uniform vec2 uDrift;
  uniform float uSat;
  uniform float uGain;
  varying vec2 vUv;
  void main() {
    vec2 q = clamp((vUv - 0.5) / uZoom + 0.5 + uDrift, 0.0, 1.0);
    vec3 c = texture2D(uMap, uOff + uRep * q).rgb;
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = mix(vec3(l), c, uSat);
    c *= mix(vec3(0.74, 0.84, 1.0), vec3(1.0, 1.0, 1.02), smoothstep(0.0, 0.5, l));
    gl_FragColor = vec4(c * uGain, 1.0);
  }
`;

/**
 * Where the crew hangs around the hero product: x as a fraction of the half-width visible at the
 * product's depth (so nobody leaves the frame on narrow screens), y and z in world units. Clear of
 * the callouts (upper left, right) and the statement (lower left).
 */
const CREW_HOME = [
  [-0.68, -0.25, -1.4],
  [0.36, 1.75, -2.6],
  [0.6, -1.15, 0.5],
] as const;
const CREW_HOME_PHONE = [
  [-0.62, -0.3, -1.2],
  [0.62, -0.9, -2.0],
  [0.32, -1.85, 0.6],
] as const;

/** opening beats (seconds): the crystal forms, then breaks */
const FORM = 0.9;
const BREAK = 1.85;

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
  uniform vec4 uShock;
  uniform float uSharp;
  uniform float uMelt;
  uniform vec3 uPage;
  uniform vec3 uTint;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  float vnoise(float x) {
    float i = floor(x);
    float f = fract(x);
    return mix(hash(vec2(i, 3.1)), hash(vec2(i + 1.0, 3.1)), f * f * (3.0 - 2.0 * f));
  }
  // THE MELT: how far the page's white has poured down from the top at screen x (1.0 = full height).
  // A sheet with a wavy lip plus two families of drips with round tips that run ahead of it. It stops
  // about two-thirds down: the floor of the world stays as a band between the white pour above and
  // the chrome drips below, and scrolls away with the stage.
  float meltFront(float x) {
    float ax = x * uRes.x / uRes.y;
    float m = uMelt;
    float f = m * 0.56 + (vnoise(ax * 2.3) - 0.5) * 0.12 * m;
    for (int o = 0; o < 2; o++) {
      float fo = float(o);
      float g = ax * (o == 0 ? 4.5 : 12.0) + fo * 7.3;
      float id = floor(g);
      float u = fract(g) - 0.5;
      float w = 0.16 + hash(vec2(id, fo)) * 0.26;
      float len = (0.08 + hash(vec2(id + 3.7, fo)) * 0.3) * (o == 0 ? 1.0 : 0.5);
      float grow = smoothstep(0.0, 0.6, m - hash(vec2(id, 9.0 + fo)) * 0.22);
      float tip = sqrt(max(0.0, 1.0 - (u * u) / (w * w)));
      f += (len + 0.006 * sin(uTime * 1.7 + id * 3.0)) * grow * tip;
    }
    return f;
  }
  void main() {
    vec2 uv = vUv;
    // px inside the paint (positive) or ahead of it (negative)
    float md = -1e4;
    if (uMelt > 0.001) {
      md = (meltFront(vUv.x) - (1.0 - vUv.y)) * uRes.y;
      // liquid lens: the world just under the lip is dragged down toward it
      float lens = smoothstep(-70.0, 0.0, md) * (1.0 - step(0.0, md));
      uv.y += lens * lens * 0.03;
    }
    // shockwave: a refracting ring racing out from the break
    if (uShock.w > 0.001) {
      vec2 d = uv - uShock.xy;
      d.x *= uRes.x / uRes.y;
      float r = length(d);
      float ring = exp(-pow((r - uShock.z) * 13.0, 2.0)) * uShock.w;
      vec2 dir = d / max(r, 1e-4);
      dir.x *= uRes.y / uRes.x;
      uv -= dir * ring * 0.04;
    }
    vec2 c = uv - 0.5;
    float ab = 0.0011 + uWarp * 0.02;
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
      col.g = texture2D(tScene, uv).g;
      col.b = texture2D(tScene, 0.5 + c * (1.0 - ab * dot(c, c) * 4.0)).b;
      // crisp edges: a light unsharp mask at device-pixel scale
      vec2 q = 1.0 / uRes;
      vec3 nb = texture2D(tScene, uv + vec2(q.x, 0.0)).rgb + texture2D(tScene, uv - vec2(q.x, 0.0)).rgb
              + texture2D(tScene, uv + vec2(0.0, q.y)).rgb + texture2D(tScene, uv - vec2(0.0, q.y)).rgb;
      col = max(col + (col - nb * 0.25) * uSharp, 0.0);
    }
    // soft glow from the brightest highlights (specular on glass, flying shards)
    vec2 px = 1.0 / uRes;
    vec3 glow = vec3(0.0);
    for (int i = 0; i < 8; i++) {
      float a = float(i) * 0.785398;
      vec2 o = vec2(cos(a), sin(a));
      glow += max(texture2D(tScene, uv + o * px * 9.0).rgb - 0.9, 0.0);
      glow += max(texture2D(tScene, uv + o * px * 22.0).rgb - 0.9, 0.0) * 0.6;
    }
    col += glow * 0.16;
    col = mix(col, vec3(1.25), uFlash);
    col *= 1.0 - dot(c, c) * 0.58;
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    gl_FragColor.rgb += (hash(vUv * uRes + fract(uTime) * 91.7) - 0.5) * 0.03;
    gl_FragColor.rgb = mix(gl_FragColor.rgb, uFadeColor, uFade);
    if (uMelt > 0.001) {
      float inside = smoothstep(-1.2, 1.2, md);
      // paint body: the page's own white, with a little volume near the lip
      vec3 paint = uPage * (0.955 + 0.045 * smoothstep(0.0, 52.0, md));
      // chrome rim with a specular line, and a thin bead of the sport's colour right at the edge
      float rim = smoothstep(-1.0, 2.0, md) * (1.0 - smoothstep(5.0, 13.0, md));
      vec3 steel = mix(vec3(0.55, 0.6, 0.67), vec3(0.88, 0.9, 0.94), 0.5 + 0.5 * sin(vUv.x * 37.0 + md * 0.35));
      paint = mix(paint, mix(steel, uTint, exp(-pow((md - 1.8) / 1.3, 2.0)) * 0.95), rim);
      paint += exp(-pow((md - 7.0) / 1.6, 2.0)) * 0.3;
      // the world darkens slightly in the shadow of the coming paint
      gl_FragColor.rgb *= 1.0 - smoothstep(-30.0, 0.0, md) * (1.0 - inside) * 0.25;
      gl_FragColor.rgb = mix(gl_FragColor.rgb, paint, inside);
    }
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
  /** half the width of the view at the product's depth (world units) */
  private halfW = 2;
  private mobile = false;
  private visible = true;
  /** how much of the stage is on screen; below half it renders every other frame (it's on its way out) */
  private ratio = 1;
  private skip = false;
  private carry = 0;
  private scroll = 0;
  private pointer = new THREE.Vector2();
  private pointerT = new THREE.Vector2();
  private spin = 0;
  private tilt = 0;
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
    // shader error checks force a synchronous GPU round-trip per program (~1 s of freezes per world on D3D)
    this.renderer.debug.checkShaderErrors = process.env.NODE_ENV !== 'production';
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
          uShock: { value: new THREE.Vector4(0.5, 0.5, 0, 0) },
          uSharp: { value: 0.32 },
          uMelt: { value: 0 },
          // raw sRGB (the melt is mixed after the colour-space conversion): exactly the page's frost
          uPage: { value: new THREE.Vector3(243 / 255, 244 / 255, 246 / 255) },
          uTint: { value: new THREE.Vector3(0.17, 0.35, 1) },
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
    this.io = new IntersectionObserver(
      ([e]) => {
        this.visible = !!e?.isIntersecting;
        this.ratio = e?.intersectionRatio ?? 0;
        const el = this.active?.film?.el;
        if (el) {
          if (this.visible) void el.play().catch(() => {});
          else el.pause();
        }
      },
      { threshold: [0, 0.5] },
    );
    this.io.observe(o.canvas);

    if (process.env.NODE_ENV !== 'production') (window as Window & { __crystal?: unknown }).__crystal = this; // QA hook
    o.canvas.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointermove', this.onMove, { passive: true });
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
  }

  private showPieces(w: World, on: boolean) {
    w.shards.visible = w.spray.visible = on;
    w.debris.forEach((d) => (d.mesh.visible = on));
    w.crew.forEach((c) => (c.mesh.visible = on));
  }

  /** builds the first world, compiles shaders, then reports ready and pre-builds the rest */
  async init(index: number) {
    performance.mark('crystal:init');
    const first = await this.build(this.o.ids[index]!);
    performance.mark('crystal:built');
    if (this.disposed) return;
    this.activate(first);
    // shards are hidden until the break: show them for the compile so the break never stalls
    this.showPieces(first, true);
    try {
      await this.compileFor(this.scene);
    } catch {
      /* compile on first draw instead */
    }
    this.showPieces(first, false);
    performance.mark('crystal:compiled');
    this.renderFrame(0);
    this.o.onReady();
    this.loop();
  }

  /**
   * Compile shaders for the HalfFloat target the scene is really drawn into: compiled for the screen
   * they'd get a different tone-mapping / colour-space variant and be rebuilt, blocking, on first draw.
   */
  private compileFor(obj: THREE.Object3D, scene?: THREE.Scene) {
    const prev = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(this.rt);
    const done = this.renderer.compileAsync(obj, this.camera, scene ?? null);
    this.renderer.setRenderTarget(prev);
    return done;
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
      if (this.active === w) continue;
      // compile off-stage: detached from the scene so it can never flash over the live world
      this.scene.remove(w.group);
      w.group.visible = true;
      this.showPieces(w, true);
      try {
        await this.compileFor(w.group, this.scene);
      } catch {
        /* ignore */
      }
      this.showPieces(w, false);
      w.group.visible = this.active === w;
      this.scene.add(w.group);
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

  private scrollS = 0;
  setScroll(p: number) {
    this.scroll = p;
  }

  /** the page has taken the product over (it drops out of the stage as a real photo) */
  private dropped = false;
  setDrop(on: boolean) {
    this.dropped = on;
    if (this.active) this.active.product.visible = !on && this.active.product.visible;
  }

  /** where the product photo sits on the canvas right now (CSS px), for a seamless hand-off */
  productRect() {
    const w = this.active;
    if (!w) return null;
    const g = w.product.geometry.parameters;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    w.product.updateWorldMatrix(true, false);
    for (const [sx, sy] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ] as const) {
      const [x, y] = this.project((sx * g.width) / 2, (sy * g.height) / 2, 0, w.product);
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, rot: w.product.rotation.z };
  }

  dispose() {
    this.disposed = true;
    for (const w of this.worlds.values()) {
      if (w.film?.el) {
        w.film.el.pause();
        w.film.el.removeAttribute('src');
        w.film.el.load();
      }
    }
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
      const crewSpec = heroCrew[id] ?? [];
      const [tex, ...crewTex] = await Promise.all([
        this.loader.loadAsync(this.o.productUrl(spec.product)),
        ...crewSpec.map((c) => this.loader.loadAsync(this.o.productUrl(c.slug)).catch(() => null)),
      ]);
      performance.mark(`crystal:tex:${id}`);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
      const group = new THREE.Group();
      group.visible = false;
      const media = heroMedia[id];
      const envr = environment(spec, this.o.fontFamily, !!media);
      performance.mark(`crystal:env:${id}`);
      group.add(envr.group);
      let film: World['film'];
      if (media) {
        // the backdrop is the film, under the bare (word-only) sky
        const plane = new THREE.Mesh(
          new THREE.PlaneGeometry(64, 32),
          new THREE.ShaderMaterial({
            vertexShader: FILM_VS,
            fragmentShader: FILM_FS,
            uniforms: {
              uMap: { value: BLANK },
              uRep: { value: new THREE.Vector2(1, 1) },
              uOff: { value: new THREE.Vector2(0, 0) },
              uZoom: { value: 1.06 },
              uDrift: { value: new THREE.Vector2(0, 0) },
              uSat: { value: 0.62 },
              uGain: { value: 0.8 },
            },
            fog: false,
            toneMapped: false,
            depthWrite: false,
          }),
        );
        plane.position.copy(envr.back.position);
        plane.position.z -= 0.05;
        envr.group.add(plane);
        film = { plane, src: media.video, el: null, tex: null, aspect: 16 / 9 };
        const f = film;
        this.loader
          .loadAsync(media.poster)
          .then((t) => {
            t.colorSpace = THREE.SRGBColorSpace;
            if (f.plane.material.uniforms.uMap!.value === BLANK) {
              f.aspect = t.image.width / t.image.height;
              f.plane.material.uniforms.uMap!.value = t;
              this.fitFilm(world);
            }
          })
          .catch(() => {});
      }

      const pivot = new THREE.Group();
      pivot.position.y = 0.15;
      group.add(pivot);
      const geo = crystalGeometry(spec.crystal);
      const mat = crystalMaterial(spec, this.env);
      performance.mark(`crystal:mat:${id}`);
      const crystal = new THREE.Mesh(geo, mat);
      pivot.add(crystal);
      const wire = new THREE.LineSegments(
        new THREE.EdgesGeometry(spec.crystal === 'orb' || spec.crystal === 'hoop' ? new THREE.IcosahedronGeometry(1.2, 2) : geo, spec.crystal === 'orb' || spec.crystal === 'hoop' ? 1 : 12),
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

      // the crew: real cut-outs that the break throws out around the hero product
      const crew: World['crew'] = [];
      crewTex.forEach((ct, i) => {
        if (!ct) return;
        ct.colorSpace = THREE.SRGBColorSpace;
        ct.anisotropy = tex.anisotropy;
        const cw = crewSpec[i]!.w;
        const mesh = new THREE.Mesh(
          new THREE.PlaneGeometry(cw, (cw * ct.image.height) / ct.image.width),
          new THREE.MeshBasicMaterial({ map: ct, alphaTest: 0.45, alphaToCoverage: true, side: THREE.DoubleSide, color: '#E4EAF1' }),
        );
        mesh.visible = false;
        group.add(mesh);
        crew.push({ mesh, spin: (i % 2 ? 1 : -1) * (5 + i * 2) });
      });

      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, color: spec.light, transparent: true, opacity: 0.55, depthWrite: false, fog: false }));
      halo.scale.set(7, 7, 1);
      halo.position.set(0, 0.4, -1.6);
      group.add(halo);

      const net = network(spec.id.length * 101 + 7);
      group.add(net.lines);
      const parts = particles(spec);
      group.add(parts);

      // the break: pre-fractured glass (droplets for water), one mesh, flown in the shader
      const pieces =
        spec.crystal === 'orb'
          ? droplets(1.18, spec.burst, 11)
          : spec.crystal === 'ball'
            ? panelShards(geo.userData.panels as Panel[], spec.id.length * 31 + 5)
            : spec.crystal === 'hoop'
              ? seamed(fracture(new THREE.IcosahedronGeometry(1.2, 2), spec.burst, spec.id.length * 31 + 5))
              : fracture(geo, spec.burst, spec.id.length * 31 + 5);
      const sm = shardMaterial(mat, spec.burst, spec.crystal !== 'orb');
      const shards = new THREE.Mesh(pieces, sm.material);
      shards.visible = false;
      shards.frustumCulled = false;
      group.add(shards);
      const sp = spray(spec.burst, spec.id.length * 7 + 3);
      sp.points.visible = false;
      group.add(sp.points);
      const deb = debris(spec.debris, spec.burst, this.env, spec.id.length * 53 + 9);
      deb.forEach((d) => group.add(d.mesh));

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
        shards,
        shardU: sm.uniforms,
        spray: sp.points,
        sprayU: sp.uniforms,
        debris: deb,
        beams: envr.beams,
        broke: false,
        film,
        crew,
        sea: envr.sea,
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
    if (this.active && this.active !== w) this.active.film?.el?.pause();
    this.playFilm(w);
    this.active = w;
    w.group.visible = true;
    const s = w.spec;
    // in front of a film, only the far distance hazes (the products stay as crisp as the footage)
    this.scene.fog = w.film ? new THREE.Fog(s.fog, 16, 40) : new THREE.Fog(s.fog, 6, 24);
    this.scene.background = new THREE.Color(s.fog);
    const hex = heroSlides.find((h) => h.id === s.id)?.accent ?? '#2B59FF';
    const n = parseInt(hex.slice(1), 16);
    this.post.material.uniforms.uTint!.value.set(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
    this.hemi.color.set(s.light);
    this.sun.color.set(s.light);
    this.o.labels.spec.querySelector('[data-code]')!.textContent = `SPECIMEN_0${this.o.ids.indexOf(s.id) + 1} // ${s.code}`;
    this.o.labels.read.querySelector('[data-label]')!.textContent = s.readout.label;
    this.labelSize.clear();
    this.fitBackdrop();
  }

  /** start (or resume) the world's film; with reduced motion the poster stays */
  private playFilm(w: World) {
    const f = w.film;
    if (!f || this.o.reduced) return;
    if (!f.el) {
      const el = document.createElement('video');
      el.muted = true;
      el.loop = true;
      el.playsInline = true;
      el.setAttribute('playsinline', '');
      el.preload = 'auto';
      el.src = f.src;
      el.addEventListener('loadedmetadata', () => {
        if (el.videoWidth) f.aspect = el.videoWidth / el.videoHeight;
        this.fitFilm(w);
      });
      el.addEventListener(
        'playing',
        () => {
          f.tex ??= new THREE.VideoTexture(el);
          f.tex.colorSpace = THREE.SRGBColorSpace;
          f.plane.material.uniforms.uMap!.value = f.tex;
          this.fitFilm(w);
        },
        { once: true },
      );
      f.el = el;
    }
    if (this.visible && !document.hidden) void f.el.play().catch(() => {});
  }

  /** object-fit: cover for the film on the wall */
  private fitFilm(w: World) {
    const f = w.film;
    if (!f) return;
    const u = f.plane.material.uniforms;
    const plane = (64 * f.plane.scale.x) / (32 * f.plane.scale.y);
    const rep = u.uRep!.value as THREE.Vector2;
    const off = u.uOff!.value as THREE.Vector2;
    rep.set(1, 1);
    off.set(0, 0);
    if (plane > f.aspect) {
      rep.y = f.aspect / plane;
      off.y = (1 - rep.y) / 2;
    } else {
      rep.x = plane / f.aspect;
      off.x = (1 - rep.x) / 2;
    }
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
    if (w.film) {
      w.film.plane.scale.copy(w.back.scale);
      w.film.plane.position.y = w.back.position.y;
      this.fitFilm(w);
    }
    const aspect = Math.round(this.camera.aspect * 10) / 10;
    if (w.backAspect !== aspect) {
      w.backAspect = aspect;
      // where the floor (y = -1.75) meets this plane, as a fraction from its top edge
      const horizon = (w.back.position.y + visH / 2 + 1.75) / visH;
      const mat = w.back.material as THREE.MeshBasicMaterial;
      mat.map?.dispose();
      mat.map = backdropTex(w.spec.word, [w.spec.sky[0], w.spec.fog], this.o.fontFamily, w.spec.id.length * 17, aspect, w.spec.id, horizon, !!w.film);
      mat.needsUpdate = true;
    }
  }

  /* ------------------------------------------------------------ input */

  private hits(x: number, y: number) {
    if (!this.active) return false;
    const r = this.o.canvas.getBoundingClientRect();
    this.ray.setFromCamera(new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1), this.camera);
    return this.ray.intersectObject(this.active.crystal.visible ? this.active.crystal : this.active.product, false).length > 0;
  }

  private onDown = (e: PointerEvent) => {
    if (!this.hits(e.clientX, e.clientY)) return;
    e.stopPropagation(); // the object owns this gesture — no sport swipe
    this.drag = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false };
  };
  private onMove = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') this.pointerT.set(e.clientX / window.innerWidth - 0.5, e.clientY / window.innerHeight - 0.5);
    if (this.drag) {
      const dx = e.clientX - this.drag.x;
      if (Math.abs(dx) > 6) this.drag.moved = true;
      this.spin += dx * 0.012;
      this.tilt = clamp(this.tilt + dx * 0.009, -0.95, 0.95);
      this.drag.x = e.clientX;
    }
    if (e.pointerType === 'mouse') this.o.canvas.style.cursor = this.hits(e.clientX, e.clientY) ? 'grab' : '';
  };
  private onUp = () => {
    if (!this.drag) return;
    const quick = performance.now() - this.drag.t < 260 && !this.drag.moved;
    this.drag = null;
    if (quick) this.o.onExplore();
  };

  /* ------------------------------------------------------------ frame */

  private resize() {
    const c = this.o.canvas;
    this.w = Math.max(1, c.clientWidth);
    this.h = Math.max(1, c.clientHeight);
    this.mobile = this.w < 768;
    // native sharpness up to 2x, capped at ~4.2 MP so big retina screens stay smooth
    const cap = Math.sqrt(4.2e6 / (this.w * this.h));
    this.dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, this.mobile ? 1.75 : 2, cap) * this.dprScale);
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
    this.halfW = this.dist * tan * aspect;
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
    if (this.ratio < 0.5) {
      this.skip = !this.skip;
      if (this.skip) {
        this.carry += dt;
        return;
      }
    }
    const step = Math.min(0.05, dt + this.carry);
    this.carry = 0;
    this.t += step;
    this.renderFrame(step);
    // adaptive sharpness: if frames run long, step the pixel ratio down (never below 1)
    this.frameAvg += (raw - this.frameAvg) * 0.05;
    this.frameCheck += raw;
    if (this.frameCheck > 1.2) {
      this.frameCheck = 0;
      const a = this.active;
      if (a && (a.shards.visible || this.cutAt >= 0)) {
        this.frameAvg = 1 / 60; // the break and cuts are allowed to be heavy for a moment
        return;
      }
      // quality ladder: MSAA 4 → 2 → 0, then pixel ratio down to 0.75 of native
      if (this.frameAvg > 1 / 50) {
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
          // replay the tail of the opening (form + break) — unless the product is out on the page,
          // then the new world simply appears (no crystal forming around nothing)
          this.introAt = this.dropped ? t - 99 : t - 0.8;
        }
      } else {
        warp = 1 - outExpo(seg(k, 0, 0.6));
        if (k > 0.6) this.cutAt = -1;
      }
    }

    // ---- opening choreography: draw → flash → the crystal forms around the product → it breaks
    const B = w.spec.burst;
    const draw = ti < 0 ? 0 : seg(ti, 0, FORM);
    const mat = ti < 0 ? 0 : seg(ti, FORM, FORM + 0.6);
    const age = ti - BREAK;
    const formed = ti >= FORM;
    const intact = formed && age < 0;
    const charge = intact ? seg(ti, FORM + 0.4, BREAK) : 0;
    const flashForm = ti < 0 ? 0 : Math.max(0, 1 - Math.abs(ti - FORM - 0.02) / 0.14) * 0.7;
    const hit = age >= 0 && !reduced ? Math.exp(-age * 7) : 0;
    const flash = Math.max(flashForm, (age >= 0 && !reduced ? Math.exp(-age * 14) : 0) * 0.6);
    w.crystal.visible = intact;
    w.product.visible = formed && !this.dropped;
    w.wire.visible = !formed || intact;
    const live = !reduced && age >= 0 && age < B.life + 0.3;
    if (age < 0) w.broke = false;
    else if (!w.broke) {
      // the moment of the break: pieces start exactly where the crystal is
      w.broke = true;
      w.shards.position.copy(w.pivot.position);
      w.shards.quaternion.copy(w.pivot.quaternion);
      w.shards.scale.copy(w.pivot.scale);
      const inv = w.pivot.quaternion.clone().invert();
      w.shardU.uBias.value.set(...B.bias).applyQuaternion(inv);
      w.shardU.uGrav.value.set(0, -B.gravity, 0).applyQuaternion(inv);
      w.spray.position.copy(w.pivot.position);
      for (const d of w.debris) {
        d.mesh.position.copy(w.pivot.position);
        d.mesh.quaternion.copy(w.pivot.quaternion);
        d.mesh.scale.copy(w.pivot.scale);
        d.uniforms.uBias.value.set(...B.bias).applyQuaternion(inv);
        d.uniforms.uGrav.value.set(0, -B.gravity, 0).applyQuaternion(inv);
      }
    }
    w.shards.visible = live;
    w.spray.visible = live;
    for (const d of w.debris) {
      d.mesh.visible = live;
      d.uniforms.uAge.value = age;
    }
    w.shardU.uAge.value = age;
    w.sprayU.uAge.value = age;
    w.sprayU.uPixel.value = this.h * this.dpr * 0.5;
    const pop = outBack(mat, 2.2);
    w.pivot.scale.setScalar(formed ? THREE.MathUtils.lerp(1.28, 1, pop) * (1 + charge * charge * 0.05) : 1);
    w.wire.material.opacity = ti < 0 ? 0 : ti < FORM ? 0.9 * seg(ti, 0, 0.3) : 0.9 * (1 - mat) + (w.spec.crystal === 'orb' ? 0.05 : 0.2);
    const wirePos = w.wire.geometry.attributes.position!;
    w.wire.geometry.setDrawRange(0, Math.floor(wirePos.count * (ti < FORM ? draw : 1)));
    w.net.lines.geometry.setDrawRange(0, Math.floor(w.net.segments * 2 * draw));
    w.net.lines.material.opacity = 0.6 - 0.3 * mat;
    // the world stays sharp and present while you scroll on: the product leaves, the stage doesn't fade out
    u.uFade!.value = reduced ? 0 : 1 - seg(ti, 0, 0.6);
    if (ti < 0) u.uFade!.value = 1;

    // ---- idle life
    this.pointer.lerp(this.pointerT, 0.06);
    this.spin *= 0.94;
    if (!this.drag) this.tilt *= 0.92;
    const idle = reduced ? 0 : 1;
    w.pivot.rotation.y += (0.22 * idle + this.spin) * dt;
    w.pivot.rotation.x = Math.sin(t * 0.3) * 0.08 * idle + this.pointer.y * 0.25;
    w.pivot.rotation.z = Math.sin(t * 0.21) * 0.05 * idle;
    const bob = Math.sin(t * 0.8) * 0.07 * idle;
    const strain = charge * charge * 0.035 * idle;
    w.pivot.position.set((Math.random() - 0.5) * strain, 0.15 + bob + (Math.random() - 0.5) * strain, 0);
    w.product.position.y = 0.15 + bob;
    w.product.rotation.y = Math.sin(t * 0.45) * 0.16 * idle + this.pointer.x * 0.35 + this.tilt;
    w.product.rotation.z = Math.sin(t * 0.33) * 0.03 * idle;
    w.product.scale.setScalar(1 + hit * 0.12 * Math.sin(Math.min(age, 0.5) * 6.3 + 0.6));

    // the crew: thrown out of the break on an arc, spinning down to rest around the hero product
    // (on the water for swimming), parting as you scroll on
    const homes = this.mobile ? CREW_HOME_PHONE : CREW_HOME;
    const shown = formed && age >= 0;
    w.crew.forEach((c, i) => {
      c.mesh.visible = shown;
      if (!shown) return;
      const [fx, hy, hz] = homes[i % homes.length]!;
      const hx = fx * this.halfW;
      const a = reduced ? 9 : age - i * 0.06;
      const k = outExpo(seg(a, 0, 1.05));
      const g = c.mesh.geometry.parameters;
      const restY = w.sea ? swell(hx, hz, t) + g.height * 0.3 : hy + Math.sin(t * 0.7 + i * 1.9) * 0.08 * idle;
      const part = 1 + this.scrollS * 0.7;
      c.mesh.position.set(
        THREE.MathUtils.lerp(0, hx * part, k),
        THREE.MathUtils.lerp(0.15, restY + this.scrollS * 0.6, k) + Math.sin(k * Math.PI) * 0.7,
        THREE.MathUtils.lerp(0, hz, k),
      );
      c.mesh.scale.setScalar(reduced ? 1 : 0.15 + 0.85 * outBack(seg(a, 0, 0.75), 1.5));
      c.mesh.rotation.z = (1 - k) * c.spin + Math.sin(t * 0.4 + i * 2.1) * (w.sea ? 0.14 : 0.07) * idle;
      c.mesh.rotation.y = Math.sin(t * 0.35 + i * 2) * 0.28 * idle + this.pointer.x * 0.3;
    });
    if (w.sea) {
      w.sea.material.uniforms.uTime!.value = t;
      w.sea.material.uniforms.uAge!.value = reduced ? -1 : age;
      w.sea.material.uniforms.uNear!.value = this.dist + 3;
      w.sea.material.uniforms.uFar!.value = this.dist + 13;
    }
    const m = w.crystal.material;
    m.normalScale.setScalar(w.base.normal * (1 + charge * 1.6));
    m.roughness = w.base.roughness + charge * 0.06;
    if (w.orb && !reduced && intact) {
      const pos = w.crystal.geometry.attributes.position as THREE.BufferAttribute;
      const { pos: b, nrm: n } = w.orb;
      const amp = 1 + charge * 2.2;
      for (let i = 0; i < pos.count; i++) {
        const x = b[i * 3]!;
        const y = b[i * 3 + 1]!;
        const z = b[i * 3 + 2]!;
        const d = (Math.sin(x * 3.1 + t * 1.7) * Math.sin(y * 2.7 - t * 1.3) * 0.045 + Math.sin(z * 4.0 + t * 2.3) * 0.02) * amp;
        pos.setXYZ(i, x + n[i * 3]! * d, y + n[i * 3 + 1]! * d, z + n[i * 3 + 2]! * d);
      }
      pos.needsUpdate = true;
      w.crystal.geometry.computeVertexNormals();
    }
    w.parts.material.uniforms.uTime!.value = t;
    w.parts.material.uniforms.uPixel!.value = this.h * this.dpr * 0.5;
    w.parts.material.uniforms.uOpacity!.value = 0.35 + 0.65 * draw;
    w.net.lines.rotation.y = t * 0.025;
    w.halo.material.opacity = 0.45 + Math.sin(t * 1.2) * 0.08 + flash * 0.4 + charge * 0.25;
    w.caustics.forEach((c, i) => {
      const map = (c.material as THREE.MeshBasicMaterial).map!;
      map.offset.set(t * (i ? -0.011 : 0.008), t * (i ? 0.006 : -0.01));
    });
    w.beams.forEach((b, i) => {
      const base = b.userData.base as { tilt: number; a: number };
      b.rotation.z = base.tilt + Math.sin(t * 0.23 + i * 1.7) * 0.03 * idle;
      b.material.opacity = base.a * (0.82 + 0.18 * Math.sin(t * 0.8 + i * 2.3)) * (0.4 + 0.6 * draw) + hit * 0.12;
    });

    // ---- camera: slow orbit, pointer parallax, scroll dolly, and it takes the hit
    // wheels scroll in steps: the scrubbed camera and melt ease toward the scroll instead of jumping
    this.scrollS += (this.scroll - this.scrollS) * (1 - Math.exp(-dt * 12));
    if (Math.abs(this.scroll - this.scrollS) < 1e-4) this.scrollS = this.scroll;
    const sc = this.scrollS;
    const orbit = Math.sin(t * 0.12) * 0.25 * idle;
    const intro = ti >= 0 && ti < 2.4 ? THREE.MathUtils.lerp(1.12, 1, outExpo(seg(ti, 0.2, 2.4))) : 1;
    const dist = this.dist * (1 - sc * 0.32) * intro * (1 - charge * 0.035 + hit * 0.05);
    const shake = (hit * B.shake + strain * 0.4) * idle;
    this.camera.position.set(
      Math.sin(orbit) * dist * 0.15 + this.pointer.x * 0.6 + Math.sin(t * 73) * shake,
      0.55 + this.pointer.y * -0.3 + sc * 0.4 + Math.cos(t * 61) * shake,
      dist,
    );
    this.camera.lookAt(0, this.mobile ? -0.55 : -0.05, 0);

    // the film: a slow push-in, punched by the break, drifting against the pointer
    if (w.film) {
      const fu = w.film.plane.material.uniforms;
      fu.uZoom!.value = 1.06 + Math.sin(t * 0.07) * 0.025 * idle + hit * 0.07 + sc * 0.1;
      (fu.uDrift!.value as THREE.Vector2).set(this.pointer.x * -0.012, this.pointer.y * 0.01);
    }

    // shockwave from the break point, in screen space
    if (hit > 0.01) {
      const [sx, sy] = this.project(w.pivot.position.x, w.pivot.position.y, w.pivot.position.z, w.group);
      u.uShock!.value.set(sx / this.w, 1 - sy / this.h, age * 1.5, Math.min(1, age * 30) * hit * 1.1);
    } else u.uShock!.value.w = 0;
    warp = Math.max(warp, (age >= 0 && !reduced ? Math.exp(-age * 9) : 0) * 0.3 * Math.min(1, age * 25));

    // ---- render
    u.uTime!.value = t;
    u.uWarp!.value = warp;
    // scrolling on pours the white page down over the world (scrubbed, reversible)
    const mk = reduced ? 0 : seg(sc, 0.36, 1);
    u.uMelt!.value = mk * mk * (3 - 2 * mk);
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
    const show = (ti >= BREAK + 0.45 || this.o.reduced) && this.h >= 560 && !this.dropped ? 1 : 0;
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

    // live readout
    this.readTick += 1;
    if (this.readTick % 8 === 0) {
      const [a, b] = w.spec.readout.base;
      const j = () => (Math.random() - 0.5) * 0.08;
      const fmt = (v: number) => (v < 0 ? '−' : '+') + Math.abs(v).toFixed(2).padStart(5, '0');
      const txt = `${fmt(a + j())} ${w.spec.readout.unit}  ${fmt(b + j())}`;
      // write into one persistent text node: no child-list mutations, no layout work for observers
      const node = L.readValue.firstChild;
      if (node && node.nodeType === 3) node.nodeValue = txt;
      else L.readValue.textContent = txt;
    }
  }
}
