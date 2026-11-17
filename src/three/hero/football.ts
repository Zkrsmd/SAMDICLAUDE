import * as THREE from 'three';
import { createModel } from '../products/registry';
import { studioEnv } from '../lib/studio';
import {
  ParticlePool,
  clamp01,
  damp,
  disposeScene,
  easeInOutCubic,
  easeOutExpo,
  glowTexture,
  seg,
  wordTexture,
  type FrameCtx,
  type HeroScene,
  type QualityTier,
} from './common';

const BOOT_PALETTE = { primary: '#F36A32', secondary: '#F4F3EE', accent: '#86B9EA', detail: '#FFFFFF' };
const BALL_PALETTE = { primary: '#FBFBF8', secondary: '#D7343B', accent: '#2C5BC9', detail: '#26A35A' };
const HORIZON = new THREE.Color('#F4EEDF');
const ZENITH = new THREE.Color('#BFD9EC');

const BOOT_LEN = 0.3; // metres
const BALL_R = 0.11;
const P0 = new THREE.Vector3(-7.5, 0, -3.2);
const STRIKE = new THREE.Vector3(0.12, 0, 0.0);
const BALL0 = new THREE.Vector3(0.36, BALL_R, 0.02);
const EXHIBIT = new THREE.Vector3(0.0, 0.42, 0.0);

/* --------------------------------- grass shader --------------------------------- */
const grassVert = /* glsl */ `
  attribute vec4 aOffset;   // x, z, rotation, height
  attribute float aTint;
  uniform float uTime;
  uniform vec3 uBoot;       // x, z, influence
  uniform vec4 uTrail;      // ax, az, bx, bz
  uniform float uTrailOn;
  varying float vH;
  varying float vTint;
  varying float vDepth;
  varying float vTrail;
  void main() {
    vec3 p = position;
    float h = p.y;
    vH = h;
    vTint = aTint;
    float c = cos(aOffset.z), s = sin(aOffset.z);
    p = vec3(p.x * c - p.z * s, p.y * aOffset.w, p.x * s + p.z * c);
    vec2 base = aOffset.xy;
    // wind
    float gust = sin(uTime * 1.3 + base.x * 0.45 + base.y * 0.3) * 0.5 + 0.5;
    float flutter = sin(uTime * 4.1 + base.x * 3.1 + base.y * 2.3);
    vec2 bend = vec2(0.6, 0.35) * (gust * 0.05 + flutter * 0.008) * h * h * aOffset.w * 6.0;
    // boot wash: blades pushed away from the boot
    vec2 toB = base - uBoot.xy;
    float d = length(toB);
    float push = smoothstep(0.42, 0.0, d) * uBoot.z;
    bend += normalize(toB + 1e-4) * push * 0.12 * h * 6.0 * aOffset.w;
    // the scraped trail stays flattened
    vec2 ab = uTrail.zw - uTrail.xy;
    float tt = clamp(dot(base - uTrail.xy, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0);
    float dl = length(base - (uTrail.xy + ab * tt));
    float trail = smoothstep(0.16, 0.02, dl) * uTrailOn;
    vTrail = trail;
    bend += normalize(ab + 1e-4) * trail * 0.08 * h * 6.0 * aOffset.w;
    p.y *= 1.0 - 0.7 * trail - 0.35 * push;
    p.xz += bend;
    vec4 world = vec4(base.x + p.x, p.y, base.y + p.z, 1.0);
    vec4 mv = viewMatrix * world;
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
    // distance cull: far blades are carried by the ground texture; very near blades cost huge fill
    if (vDepth > 11.0 || vDepth < 0.28) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  }
`;
const grassFrag = /* glsl */ `
  uniform vec3 uBaseColor;
  uniform vec3 uTipColor;
  uniform vec3 uFogColor;
  uniform vec2 uFog;
  varying float vH;
  varying float vTint;
  varying float vDepth;
  varying float vTrail;
  void main() {
    vec3 col = mix(uBaseColor, uTipColor, smoothstep(0.0, 0.16, vH));
    col *= 0.82 + vTint * 0.36;
    col = mix(col, col * vec3(0.78, 0.7, 0.52), vTrail * 0.6); // bruised turf
    col += vec3(1.0, 0.95, 0.75) * pow(smoothstep(0.06, 0.18, vH), 2.0) * 0.18; // sun-lit tips
    float f = smoothstep(uFog.x, uFog.y, vDepth);
    gl_FragColor = vec4(mix(col, uFogColor, f), 1.0);
    #include <colorspace_fragment>
  }
`;

function bladeGeometry() {
  const g = new THREE.BufferGeometry();
  const seg = 4;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const w = 0.007 * (1 - t * 0.92);
    const y = 0.16 * t;
    const curve = t * t * 0.02;
    pos.push(-w, y, curve, w, y, curve);
  }
  for (let i = 0; i < seg; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

export function createFootballScene(quality: QualityTier): HeroScene {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.02, 200);
  const fx = { aberration: 0, flash: 0, shake: 0, exposure: 1 };

  /* ------------------------------------ sky ------------------------------------ */
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(90, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: { uH: { value: HORIZON }, uZ: { value: ZENITH }, uSun: { value: new THREE.Vector3(-0.55, 0.22, -0.8).normalize() } },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 uH; uniform vec3 uZ; uniform vec3 uSun; varying vec3 vDir;
        void main(){ float y = clamp(vDir.y, 0.0, 1.0); vec3 c = mix(uH, uZ, pow(y, 0.55));
        float sun = max(dot(normalize(vDir), uSun), 0.0); c += vec3(1.0,0.93,0.78) * (pow(sun, 64.0) * 0.9 + pow(sun, 6.0) * 0.18);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
        }`,
    }),
  );
  scene.add(sky);
  scene.fog = new THREE.Fog(HORIZON, 9, 48);

  /* ----------------------------------- ground ----------------------------------- */
  const groundTex = (() => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext('2d')!;
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? '#5C9A33' : '#6FAD3E';
      ctx.fillRect(0, (i * 512) / 8, 512, 512 / 8);
    }
    for (let i = 0; i < 9000; i++) {
      ctx.fillStyle = `rgba(${30 + Math.random() * 40},${70 + Math.random() * 60},${20 + Math.random() * 20},0.35)`;
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(6, 6);
    t.anisotropy = 8;
    return t;
  })();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshStandardMaterial({ map: groundTex, roughness: 1, color: '#9fcf74' }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // white touchline painted on the pitch
  const line = new THREE.Mesh(new THREE.PlaneGeometry(60, 0.09), new THREE.MeshBasicMaterial({ color: '#F6F5EF', fog: true }));
  line.rotation.x = -Math.PI / 2;
  line.position.set(0, 0.002, -4.2);
  scene.add(line);

  /* ------------------------------------ grass ------------------------------------ */
  const N = quality === 'high' ? 16000 : quality === 'mid' ? 9000 : 5000;
  const blades = new THREE.InstancedBufferGeometry();
  const bg = bladeGeometry();
  blades.index = bg.index;
  blades.setAttribute('position', bg.getAttribute('position'));
  const off = new Float32Array(N * 4);
  const tint = new Float32Array(N);
  const items: [number, number, number, number, number][] = [];
  for (let i = 0; i < N; i++) {
    // dense around the exhibit / strike zone and the boot path, sparse in the far field
    let x: number;
    let z: number;
    const r = Math.random();
    if (r < 0.5) {
      x = (Math.random() - 0.5) * 3.4;
      z = 0.9 - Math.random() * 3.0;
    } else if (r < 0.75) {
      const k = Math.random();
      x = P0.x + (STRIKE.x - P0.x) * k + (Math.random() - 0.5) * 0.9;
      z = P0.z + (STRIKE.z - P0.z) * k + (Math.random() - 0.5) * 0.9;
    } else if (r < 0.85) {
      // sparse foreground for depth
      x = (Math.random() - 0.5) * 2.4;
      z = 0.9 + Math.random() * 1.1;
    } else {
      z = 0.5 - Math.pow(Math.random(), 0.8) * 9;
      x = (Math.random() - 0.5) * (5 + (2 - z) * 0.9);
    }
    items.push([x, z, Math.random() * Math.PI, 0.55 + Math.random() * 0.75, Math.random()]);
  }
  // front-to-back (camera sits at +z): early depth rejection removes most grass overdraw
  items.sort((a, b) => b[1] - a[1]);
  items.forEach(([x, z, rot, h, tn], i) => {
    off.set([x, z, rot, h], i * 4);
    tint[i] = tn;
  });
  blades.setAttribute('aOffset', new THREE.InstancedBufferAttribute(off, 4));
  blades.setAttribute('aTint', new THREE.InstancedBufferAttribute(tint, 1));
  blades.instanceCount = N;
  const grassUniforms = {
    uTime: { value: 0 },
    uBoot: { value: new THREE.Vector3(99, 99, 0) },
    uTrail: { value: new THREE.Vector4(P0.x, P0.z, P0.x, P0.z) },
    uTrailOn: { value: 0 },
    uBaseColor: { value: new THREE.Color('#2F6A1E') },
    uTipColor: { value: new THREE.Color('#9BD157') },
    uFogColor: { value: HORIZON.clone() },
    uFog: { value: new THREE.Vector2(9, 30) },
  };
  const grass = new THREE.Mesh(
    blades,
    new THREE.ShaderMaterial({ vertexShader: grassVert, fragmentShader: grassFrag, uniforms: grassUniforms, side: THREE.DoubleSide }),
  );
  grass.frustumCulled = false;
  scene.add(grass);

  /* ----------------------------------- type ----------------------------------- */
  const wordMat = new THREE.MeshBasicMaterial({ map: wordTexture('FOOTBALL', { color: '#171A18' }), transparent: true, opacity: 0, depthWrite: false, fog: false });
  const word = new THREE.Mesh(new THREE.PlaneGeometry(4, 1), wordMat);
  word.position.set(0.2, 0.5, -4.6);
  word.renderOrder = -1;
  scene.add(word);

  /* ----------------------------------- lights ----------------------------------- */
  const sun = new THREE.DirectionalLight('#FFF1D6', 3.2);
  sun.position.set(-5, 7, -7);
  sun.castShadow = quality === 'high';
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -1.2;
  sun.shadow.camera.right = sun.shadow.camera.top = 1.2;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
  const key = new THREE.DirectionalLight('#FFFFFF', 1.5);
  key.position.set(2, 3, 5);
  scene.add(key);
  scene.add(new THREE.HemisphereLight('#EAF3FF', '#6F8F45', 0.9));

  /* ------------------------------------ props ------------------------------------ */
  const boot = createModel('boot', BOOT_PALETTE, { collar: 'low', studs: 'fg', laces: true, pattern: 'speed', sole: 'plate' }, 2);
  boot.scale.setScalar(BOOT_LEN / 2);
  const bootBox = new THREE.Box3().setFromObject(boot);
  const bootHalfH = (bootBox.max.y - bootBox.min.y) / 2;
  const bootRig = new THREE.Group(); // pivot so we can pitch the boot around its studs
  bootRig.add(boot);
  scene.add(bootRig);

  const ball = createModel('ball', BALL_PALETTE, { pattern: 'tri' }, BALL_R * 2);
  scene.add(ball);

  const shadowTex = glowTexture('rgba(20,40,10,0.55)', 'rgba(20,40,10,0)');
  const bootShadow = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.22), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  bootShadow.rotation.x = -Math.PI / 2;
  scene.add(bootShadow);
  const ballShadow = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), bootShadow.material);
  ballShadow.rotation.x = -Math.PI / 2;
  scene.add(ballShadow);

  // impact ring + flare
  const ringMat = new THREE.MeshBasicMaterial({ map: ringTexture(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), ringMat);
  scene.add(ring);
  const flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,248,225,1)', 'rgba(255,240,200,0)'), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  flare.scale.setScalar(1.6);
  scene.add(flare);
  const trail = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 0.08),
    new THREE.MeshBasicMaterial({ map: glowTexture('rgba(255,255,255,0.9)', 'rgba(255,255,255,0)'), transparent: true, opacity: 0, depthWrite: false }),
  );
  scene.add(trail);

  // debris
  const soil = new ParticlePool(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: '#4A3420', roughness: 1 }), quality === 'low' ? 120 : 260);
  const shreds = new ParticlePool(
    new THREE.PlaneGeometry(0.14, 1).translate(0, 0.5, 0),
    new THREE.MeshStandardMaterial({ color: '#7DBA45', roughness: 0.8, side: THREE.DoubleSide }),
    quality === 'low' ? 140 : 320,
  );
  shreds.drag = 2.2;
  shreds.gravity = -5;
  scene.add(soil.mesh, shreds.mesh);

  // floating pollen
  const motesN = quality === 'low' ? 60 : 160;
  const motesGeo = new THREE.BufferGeometry();
  const mp = new Float32Array(motesN * 3);
  for (let i = 0; i < motesN; i++) mp.set([(Math.random() - 0.5) * 6, Math.random() * 2, (Math.random() - 0.7) * 6], i * 3);
  motesGeo.setAttribute('position', new THREE.BufferAttribute(mp, 3));
  const motes = new THREE.Points(
    motesGeo,
    new THREE.PointsMaterial({ size: 0.025, map: glowTexture(), transparent: true, opacity: 0.7, depthWrite: false, color: '#FFF6DA' }),
  );
  scene.add(motes);

  /* --------------------------------- choreography --------------------------------- */
  let t = 0;
  let playing = false;
  let introDone = false;
  const s = {
    timeScale: 1,
  };
  const bootVel = new THREE.Vector3();
  const lastBoot = new THREE.Vector3();
  const ballVel = new THREE.Vector3();
  const ballSpin = new THREE.Vector3();
  let struck = false;
  let ballGone = false;
  const camPos = new THREE.Vector3();
  const camLook = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const look = new THREE.Vector3();
  let aspect = 1;

  /** Exhibit framing that adapts to portrait / landscape. */
  const exhibitCam = (out: THREE.Vector3, lookOut: THREE.Vector3, orbit: number) => {
    const fovV = THREE.MathUtils.degToRad(camera.fov);
    const visibleW = (d: number) => 2 * d * Math.tan(fovV / 2) * aspect;
    const frac = aspect < 0.8 ? 0.72 : aspect < 1.2 ? 0.5 : 0.36;
    let d = BOOT_LEN / (frac * (visibleW(1)));
    d = THREE.MathUtils.clamp(d, 0.7, 2.6);
    const ang = 0.1 + orbit;
    out.set(EXHIBIT.x + Math.sin(ang) * d, EXHIBIT.y + 0.12 * d, EXHIBIT.z + Math.cos(ang) * d);
    // aim slightly below the product so it sits in the upper-middle of portrait screens
    lookOut.set(EXHIBIT.x, EXHIBIT.y + (aspect < 0.8 ? -0.1 * d : -0.02), EXHIBIT.z);
    return d;
  };

  const placeWord = () => {
    const fovV = THREE.MathUtils.degToRad(camera.fov);
    const dist = 4.6 + 1.2;
    const visW = 2 * dist * Math.tan(fovV / 2) * aspect;
    const w = Math.min(visW * 0.94, 5.4);
    word.scale.set(w / 4, w / 4, 1);
    word.userData.h = w / 4;
  };

  const reset = () => {
    t = 0;
    struck = false;
    ballGone = false;
    s.timeScale = 1;
    bootRig.position.copy(P0).setY(bootHalfH);
    lastBoot.copy(bootRig.position);
    bootRig.rotation.set(0, -0.35, 0);
    boot.rotation.set(0, 0, 0);
    ball.position.copy(BALL0);
    ball.rotation.set(0.3, 0.6, 0);
    ball.scale.setScalar(1);
    ball.visible = true;
    ballVel.set(0, 0, 0);
    grassUniforms.uTrailOn.value = 0;
    wordMat.opacity = 0;
    soil.clear();
    shreds.clear();
    camPos.set(0.95, 0.14, 2.2);
    camLook.set(-4, 0.18, -2.4);
    camera.fov = 34;
  };

  const strike = () => {
    struck = true;
    fx.aberration = 1;
    fx.shake = 0.6;
    fx.flash = 0.25;
    ring.position.copy(BALL0).add(tmp.set(-0.08, 0, 0));
    ring.lookAt(camera.position);
    ring.scale.setScalar(0.05);
    ringMat.opacity = 1;
    for (let i = 0; i < 70; i++) {
      tmp.copy(STRIKE).add(tmp2.set(Math.random() * 0.2, 0.02, (Math.random() - 0.5) * 0.2));
      soil.emit(tmp, tmp2.set(1.5 + Math.random() * 3, 1.5 + Math.random() * 3.5, (Math.random() - 0.5) * 3), 1.6, 0.003 + Math.random() * 0.007);
      tmp.copy(STRIKE).add(tmp2.set(Math.random() * 0.2, 0.02, (Math.random() - 0.5) * 0.2));
      shreds.emit(tmp, tmp2.set(1 + Math.random() * 3, 2 + Math.random() * 3, (Math.random() - 0.5) * 3), 2.2, 0.01 + Math.random() * 0.016);
    }
  };

  const scrape = (dt: number, speed: number) => {
    const n = Math.min(12, Math.floor(speed * dt * 70 + Math.random()));
    for (let i = 0; i < n; i++) {
      tmp.copy(bootRig.position).add(tmp2.set(-0.06 - Math.random() * 0.1, -bootHalfH + 0.01, (Math.random() - 0.5) * 0.08));
      const v = tmp2.copy(bootVel).multiplyScalar(-0.12 + Math.random() * 0.2);
      v.y = 0.8 + Math.random() * 2.6;
      v.z += (Math.random() - 0.5) * 1.6;
      if (Math.random() < 0.5) soil.emit(tmp, v, 1.2, 0.0025 + Math.random() * 0.006);
      else shreds.emit(tmp, v, 1.6, 0.008 + Math.random() * 0.016);
    }
  };

  reset();

  const api: HeroScene = {
    id: 'football',
    scene,
    camera,
    fx,
    get timeScale() {
      return s.timeScale;
    },
    set timeScale(v) {
      s.timeScale = v;
    },
    get introDone() {
      return introDone;
    },
    set introDone(v) {
      introDone = v;
    },
    playIntro() {
      reset();
      playing = true;
      introDone = false;
    },
    skipIntro() {
      reset();
      playing = true;
      t = 4.2;
      struck = true;
      ballGone = true;
      ball.visible = false;
      grassUniforms.uTrailOn.value = 1;
      grassUniforms.uTrail.value.set(P0.x, P0.z, STRIKE.x, STRIKE.z);
      wordMat.opacity = 1;
      introDone = true;
      exhibitCam(camPos, camLook, 0);
    },
    update(ctx: FrameCtx) {
      const { dt } = ctx;
      // slow-motion ramp around the strike
      if (playing && !introDone) {
        const target = struck && t < 1.62 ? 0.12 : 1;
        s.timeScale = damp(s.timeScale, target, struck && t < 1.62 ? 30 : 4, dt);
      } else s.timeScale = 1;
      const sdt = dt * s.timeScale;
      if (playing) t += sdt;
      grassUniforms.uTime.value += sdt;

      /* ---------------- boot path ---------------- */
      const runT = seg(t, 0.35, 1.25);
      const liftT = seg(t, 1.45, 3.4);
      if (t < 1.25) {
        const e = runT * runT * (1.15 - 0.15 * runT); // accelerate in
        bootRig.position.lerpVectors(P0, STRIKE, e).setY(bootHalfH + Math.sin(t * 60) * 0.002);
        bootRig.rotation.set(0, -0.35 * (1 - e) - 0.05, Math.sin(t * 47) * 0.02 - 0.06 * e);
      } else if (t < 1.45) {
        // follow-through: toe drives up through the ball
        const f = seg(t, 1.25, 1.45);
        bootRig.position.set(STRIKE.x + f * 0.3, bootHalfH + f * 0.08, STRIKE.z + f * 0.02);
        bootRig.rotation.set(0, -0.05, 0.25 * f - 0.06);
      } else {
        // rise, spin and settle into the exhibit pose
        const e = easeInOutCubic(liftT);
        const from = tmp.set(STRIKE.x + 0.3, bootHalfH + 0.08, STRIKE.z + 0.02);
        bootRig.position.lerpVectors(from, EXHIBIT, e);
        bootRig.position.y += Math.sin(liftT * Math.PI) * 0.12;
        const spin = easeOutExpo(seg(t, 1.6, 3.3)) * Math.PI * 2;
        bootRig.rotation.set(spin, -0.05 - e * 0.45, 0.19 * (1 - e));
      }
      if (introDone || t > 3.4) {
        // idle hover
        const k = ctx.time;
        bootRig.position.set(EXHIBIT.x, EXHIBIT.y + Math.sin(k * 1.4) * 0.012, EXHIBIT.z);
        bootRig.rotation.set(Math.sin(k * 0.7) * 0.05, -0.5 + Math.sin(k * 0.35) * 0.45, Math.sin(k * 0.9) * 0.04);
      }
      bootVel.copy(bootRig.position).sub(lastBoot).divideScalar(Math.max(sdt, 1e-4));
      lastBoot.copy(bootRig.position);
      const speed = bootVel.length();

      // grass interaction + scraping
      const onGround = bootRig.position.y < bootHalfH + 0.03;
      grassUniforms.uBoot.value.set(bootRig.position.x, bootRig.position.z, onGround ? 1 : clamp01(1 - (bootRig.position.y - bootHalfH) * 6));
      if (t > 0.35 && t < 1.3) {
        grassUniforms.uTrailOn.value = 1;
        grassUniforms.uTrail.value.set(P0.x, P0.z, bootRig.position.x, bootRig.position.z);
        if (onGround && speed > 0.5) {
          scrape(sdt, speed);
          fx.shake = Math.max(fx.shake, Math.min(0.25, speed * 0.02));
        }
      }
      if (!struck && t >= 1.25) strike();

      /* ---------------- ball ---------------- */
      if (struck && !ballGone) {
        const k = seg(t, 1.25, 1.42);
        if (t < 1.42) {
          // squash on contact
          const sq = Math.sin(k * Math.PI) * 0.22;
          ball.scale.set(1 - sq, 1 + sq * 0.5, 1 + sq * 0.5);
          ball.position.x = BALL0.x + k * 0.05;
          ballVel.set(16, 3.2, -9);
          ballSpin.set(-14, 6, 22);
        } else {
          ball.scale.setScalar(1);
          ball.position.addScaledVector(ballVel, sdt);
          ballVel.y -= 9.8 * sdt;
          ball.rotation.x += ballSpin.x * sdt;
          ball.rotation.y += ballSpin.y * sdt;
          ball.rotation.z += ballSpin.z * sdt;
          if (ball.position.length() > 40) {
            ballGone = true;
            ball.visible = false;
          }
          // speed trail
          trail.position.copy(ball.position).addScaledVector(ballVel, -0.03);
          trail.lookAt(camera.position);
          trail.scale.set(Math.min(1.4, ballVel.length() * 0.06), 1.4, 1);
          trail.rotation.z = Math.atan2(ballVel.y, ballVel.x) * 0.3;
          (trail.material as THREE.MeshBasicMaterial).opacity = clamp01(1 - seg(t, 1.6, 2.4)) * 0.6;
        }
      }
      ballShadow.position.set(ball.position.x, 0.003, ball.position.z);
      ballShadow.visible = ball.visible;
      (ballShadow.material as THREE.MeshBasicMaterial).opacity = 1;
      bootShadow.position.set(bootRig.position.x, 0.004, bootRig.position.z);
      bootShadow.rotation.z = bootRig.rotation.y;
      const hAbove = bootRig.position.y - bootHalfH;
      bootShadow.scale.setScalar(1 + hAbove * 1.5);
      (bootShadow.material as THREE.MeshBasicMaterial).opacity = clamp01(1 - hAbove * 1.6);

      // ring + flare
      if (ringMat.opacity > 0) {
        ring.scale.multiplyScalar(1 + sdt * 9);
        ringMat.opacity = Math.max(0, ringMat.opacity - sdt * 2.2);
        ring.lookAt(camera.position);
      }
      const flareK = Math.sin(seg(t, 2.2, 3.2) * Math.PI);
      flare.position.copy(bootRig.position).add(tmp.set(0.12, 0.05, 0.1));
      (flare.material as THREE.SpriteMaterial).opacity = flareK * 0.8;

      soil.update(sdt);
      shreds.update(sdt);
      const mpos = motesGeo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < motesN; i++) {
        mpos.setY(i, ((mpos.getY(i) + sdt * 0.04) % 2));
        mpos.setX(i, mpos.getX(i) + Math.sin(ctx.time * 0.5 + i) * sdt * 0.02);
      }
      mpos.needsUpdate = true;

      // typography rises in after the strike
      if (t > 1.7 || introDone) wordMat.opacity = damp(wordMat.opacity, 1, 3, dt);
      word.position.y = ((word.userData.h as number) ?? 1) * 0.5 - 0.03 - (1 - wordMat.opacity) * 0.25;

      /* ---------------- camera ---------------- */
      const targetPos = tmp.set(0, 0, 0);
      const targetLook = tmp2.set(0, 0, 0);
      if (t < 1.25) {
        const e = easeInOutCubic(runT);
        targetPos.set(0.95 - e * 0.35, 0.14 + e * 0.03, 2.2 - e * 0.5);
        targetLook.copy(bootRig.position).add(look.set(0.6 + e * 0.4, 0.04, 0));
        camera.fov = damp(camera.fov, 34 - e * 6, 6, dt);
      } else if (t < 1.6) {
        targetPos.set(0.65, 0.16, 1.55);
        targetLook.copy(BALL0).add(look.set(-0.1, 0.02, 0));
        camera.fov = damp(camera.fov, 26, 4, dt);
      } else {
        const d = exhibitCam(targetPos, targetLook, 0);
        targetPos.lerp(look.set(0.65, 0.16, 1.55), 1 - easeInOutCubic(seg(t, 1.6, 3.6)));
        camera.fov = damp(camera.fov, 36, 2, dt);
        void d;
      }
      if (introDone || t > 3.6) {
        const orbit = Math.sin(ctx.time * 0.18) * 0.12 + ctx.pointer.x * 0.12;
        exhibitCam(targetPos, targetLook, orbit);
        targetPos.y += ctx.pointer.y * 0.05;
      }
      // scroll: crane up and pull out over the pitch
      if (ctx.scroll > 0) {
        targetPos.y += ctx.scroll * 1.1;
        targetPos.z += ctx.scroll * 1.6;
        targetLook.y -= ctx.scroll * 0.35;
      }
      const lam = t < 1.6 && !introDone ? 9 : 3.2;
      camPos.x = damp(camPos.x, targetPos.x, lam, dt);
      camPos.y = damp(camPos.y, targetPos.y, lam, dt);
      camPos.z = damp(camPos.z, targetPos.z, lam, dt);
      camLook.x = damp(camLook.x, targetLook.x, lam * 1.4, dt);
      camLook.y = damp(camLook.y, targetLook.y, lam * 1.4, dt);
      camLook.z = damp(camLook.z, targetLook.z, lam * 1.4, dt);
      camera.position.copy(camPos);
      if (fx.shake > 0.001) {
        camera.position.x += (Math.random() - 0.5) * fx.shake * 0.03;
        camera.position.y += (Math.random() - 0.5) * fx.shake * 0.03;
      }
      camera.lookAt(camLook);
      camera.updateProjectionMatrix();
      fx.shake = damp(fx.shake, 0, 6, dt);
      fx.aberration = damp(fx.aberration, 0, 3, dt);
      fx.flash = damp(fx.flash, 0, 5, dt);
      sun.target.position.copy(bootRig.position);
      sun.position.copy(bootRig.position).add(tmp.set(-3, 5, -4));

      if (!introDone && t > 3.6) introDone = true;
    },
    resize(w: number, h: number) {
      aspect = w / h;
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
      placeWord();
    },
    hitProduct(ndc: THREE.Vector2) {
      const rc = new THREE.Raycaster();
      rc.setFromCamera(ndc, camera);
      return rc.intersectObject(bootRig, true).length > 0;
    },
    attach(r: THREE.WebGLRenderer) {
      scene.environment = studioEnv(r);
      scene.environmentIntensity = 0.55;
    },
    degrade() {
      blades.instanceCount = Math.floor(N * 0.55);
      sun.castShadow = false;
    },
    dispose() {
      disposeScene(scene);
    },
  };
  return api;
}

function ringTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(128, 128, 60, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.75, 'rgba(255,255,255,0.9)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
