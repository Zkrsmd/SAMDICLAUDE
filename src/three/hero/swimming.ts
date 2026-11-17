import * as THREE from 'three';
import { createModel } from '../products/registry';
import { createCap, createGoggles } from '../products/swim';
import { studioEnv } from '../lib/studio';
import { applyPose, butterflyPose, createRig, silhouetteMaterial } from '../athletes/rig';
import {
  ParticlePool,
  damp,
  disposeScene,
  easeInOutCubic,
  glowTexture,
  seg,
  wordTexture,
  type FrameCtx,
  type HeroScene,
  type QualityTier,
} from './common';

const GOGGLES = { primary: '#D9A93B', secondary: '#1D2326', accent: '#1D2326' };
const CAP = { primary: '#1F2E4D', secondary: '#E9EEF0', accent: '#D9A93B' };
const EXHIBIT = new THREE.Vector3(0, 0.5, 0);
const BREACH_CAM = new THREE.Vector3(0.3, 0.12, 2.6);
const FLOOR_Y = -2.6;
const UNDER_FOG = new THREE.Color('#3DB7C4');
const ABOVE_BG = new THREE.Color('#EDF7F7');

const CAUSTIC = /* glsl */ `
  float caustic(vec2 uv, float t){
    vec2 p = mod(uv * 6.28318, 6.28318) - 250.0;
    vec2 i = p; float c = 1.0; float inten = 0.005;
    for (int n = 0; n < 4; n++) {
      float tt = t * (1.0 - (3.5 / float(n + 1)));
      i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
      // epsilon guards: avoid 0/0 and inf at the pattern's singular points (NaN would poison bloom)
      c += 1.0 / max(length(vec2(p.x / (sin(i.x + tt) / inten + 1e-4), p.y / (cos(i.y + tt) / inten + 1e-4))), 1e-3);
    }
    c /= 4.0; c = 1.17 - pow(clamp(c, 0.0, 4.0), 1.4);
    return clamp(pow(abs(c), 8.0), 0.0, 1.6);
  }
`;

export function createSwimmingScene(quality: QualityTier): HeroScene {
  const scene = new THREE.Scene();
  scene.background = UNDER_FOG.clone();
  const fog = new THREE.FogExp2(UNDER_FOG.clone(), 0.13);
  scene.fog = fog;
  const camera = new THREE.PerspectiveCamera(42, 1, 0.03, 120);
  const fx = { aberration: 0, flash: 0, shake: 0, exposure: 1 };

  /* ---------------------------------- water surface ---------------------------------- */
  const waterU = {
    uTime: { value: 0 },
    uCamY: { value: -1 },
    uDeep: { value: new THREE.Color('#0F7C93') },
    uShallow: { value: new THREE.Color('#6FDCE0') },
    uSky: { value: new THREE.Color('#F4FCFC') },
    uFogColor: { value: ABOVE_BG.clone() },
  };
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80, 160, 160),
    new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: waterU,
      vertexShader: /* glsl */ `
        uniform float uTime;
        varying vec3 vWorld;
        float wave(vec2 p){ return sin(p.x * 1.3 + uTime * 1.1) * 0.025 + sin(p.y * 0.9 - uTime * 1.4) * 0.03 + sin((p.x + p.y) * 2.7 + uTime * 2.0) * 0.008; }
        void main(){
          vec3 p = position;
          vec4 w = modelMatrix * vec4(p, 1.0);
          w.y += wave(w.xz);
          vWorld = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime, uCamY;
        uniform vec3 uDeep, uShallow, uSky, uFogColor;
        varying vec3 vWorld;
        ${CAUSTIC}
        void main(){
          vec2 p = vWorld.xz;
          float e = 0.05;
          float h0 = sin(p.x * 1.3 + uTime * 1.1) * 0.025 + sin(p.y * 0.9 - uTime * 1.4) * 0.03 + sin((p.x + p.y) * 2.7 + uTime * 2.0) * 0.008;
          float hx = sin((p.x + e) * 1.3 + uTime * 1.1) * 0.025 + sin(p.y * 0.9 - uTime * 1.4) * 0.03 + sin((p.x + e + p.y) * 2.7 + uTime * 2.0) * 0.008;
          float hz = sin(p.x * 1.3 + uTime * 1.1) * 0.025 + sin((p.y + e) * 0.9 - uTime * 1.4) * 0.03 + sin((p.x + p.y + e) * 2.7 + uTime * 2.0) * 0.008;
          vec3 n = normalize(vec3(h0 - hx, e, h0 - hz));
          vec3 v = normalize(cameraPosition - vWorld);
          float ca = caustic(p * 0.18, uTime * 0.6);
          vec3 col;
          if (uCamY < 0.0) {
            float cosT = abs(dot(n, v));
            float window = smoothstep(0.62, 0.86, cosT);
            col = mix(uDeep * 1.15, uShallow, smoothstep(0.35, 0.66, cosT));
            col = mix(col, uSky, window);
            col += vec3(1.0) * ca * 0.35 * window;
            col += vec3(0.9, 1.0, 1.0) * pow(smoothstep(0.6, 0.66, cosT) * (1.0 - smoothstep(0.66, 0.74, cosT)), 1.5) * 0.4;
          } else {
            float fres = pow(1.0 - max(dot(n, v), 0.0), 4.0);
            col = mix(uShallow * 0.92, uSky, 0.15 + fres * 0.8);
            col += vec3(1.0) * ca * 0.22;
            vec3 sunDir = normalize(vec3(-0.4, 0.8, -0.5));
            col += vec3(1.0, 0.98, 0.92) * pow(max(dot(reflect(-v, n), sunDir), 0.0), 220.0) * 2.5;
            float d = length(cameraPosition - vWorld);
            col = mix(col, uFogColor, smoothstep(10.0, 40.0, d));
          }
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }
      `,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  scene.add(water);

  /* ---------------------------------- pool floor ---------------------------------- */
  const tiles = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#E9F6F6';
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = 'rgba(70,140,150,0.35)';
    ctx.lineWidth = 3;
    for (let i = 0; i <= 512; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 512);
      ctx.moveTo(0, i);
      ctx.lineTo(512, i);
      ctx.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(10, 10);
    t.anisotropy = 8;
    return t;
  })();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ map: tiles, color: '#BFE7E9' }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = FLOOR_Y;
  scene.add(floor);
  const lane = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 40), new THREE.MeshBasicMaterial({ color: '#1C4E79' }));
  lane.rotation.x = -Math.PI / 2;
  lane.position.set(0.9, FLOOR_Y + 0.005, 0);
  scene.add(lane);
  const causticU = { uTime: { value: 0 } };
  const caustics = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.ShaderMaterial({
      uniforms: causticU,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform float uTime; varying vec2 vUv; ${CAUSTIC}
        void main(){ float c = caustic(vUv * 7.0, uTime * 0.5); gl_FragColor = vec4(vec3(0.95,1.0,1.0) * c * 0.65, 1.0); }`,
    }),
  );
  caustics.rotation.x = -Math.PI / 2;
  caustics.position.y = FLOOR_Y + 0.01;
  scene.add(caustics);

  // the word laid in dark tiles on the pool floor
  const floorWordMat = new THREE.MeshBasicMaterial({ map: wordTexture('SWIMMING', { color: '#1C4E79' }), transparent: true, depthWrite: false });
  const floorWord = new THREE.Mesh(new THREE.PlaneGeometry(8, 2), floorWordMat);
  floorWord.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
  floorWord.position.set(-0.6, FLOOR_Y + 0.008, -3.5);
  scene.add(floorWord);
  // and rising out of the water for the exhibit
  const wordMat = new THREE.MeshBasicMaterial({ map: wordTexture('SWIMMING', { color: '#123A57' }), transparent: true, opacity: 0, depthWrite: false, fog: false });
  const word = new THREE.Mesh(new THREE.PlaneGeometry(4, 1), wordMat);
  word.position.set(0, 0.4, -3.6);
  scene.add(word);

  // god rays
  const rayTex = glowTexture('rgba(235,255,255,0.9)', 'rgba(235,255,255,0)');
  const rays: THREE.Mesh[] = [];
  for (let i = 0; i < 7; i++) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(0.6 + Math.random() * 0.8, 5),
      new THREE.MeshBasicMaterial({ map: rayTex, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }),
    );
    m.position.set((Math.random() - 0.5) * 6, -1.6, -2 - Math.random() * 7);
    m.rotation.set(0, Math.random() * Math.PI, 0.25);
    rays.push(m);
    scene.add(m);
  }

  // lane ropes on the surface
  const ropeColors = ['#C8302E', '#F4F6F5', '#218FB0'];
  for (const x of [-2.6, 2.6]) {
    const floats = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.06, 0.14, 12), new THREE.MeshStandardMaterial({ roughness: 0.4 }), 140);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
    for (let i = 0; i < 140; i++) {
      m4.compose(new THREE.Vector3(x, 0.01, 6 - i * 0.16), q, new THREE.Vector3(1, 1, 1));
      floats.setMatrixAt(i, m4);
      floats.setColorAt(i, new THREE.Color(ropeColors[Math.floor(i / 6) % 3]!));
    }
    scene.add(floats);
  }

  /* ---------------------------------- lights ---------------------------------- */
  const sun = new THREE.DirectionalLight('#FFFFFF', 2.6);
  sun.position.set(-3, 8, -4);
  scene.add(sun);
  const hemi = new THREE.HemisphereLight('#E8FFFF', '#1A6A7A', 1.0);
  scene.add(hemi);
  const key = new THREE.DirectionalLight('#FFFFFF', 0.6);
  key.position.set(1.5, 2, 4);
  scene.add(key);

  /* ---------------------------------- swimmer ---------------------------------- */
  const skin = silhouetteMaterial('#E6FDFF', '#06222C', 3.0, 1.4);
  skin.envMapIntensity = 0.15;
  const rig = createRig({ material: skin, hands: 'flat' });
  const swimmer = new THREE.Group();
  rig.root.rotation.x = Math.PI / 2;
  rig.root.position.y = -0.98;
  swimmer.rotation.y = Math.PI / 2; // swims across the frame, left → right
  swimmer.add(rig.root);
  scene.add(swimmer);
  const capOnHead = createCap(CAP, { seam: true });
  capOnHead.scale.setScalar(0.118);
  capOnHead.position.set(0, 0.085, -0.008);
  rig.joints.head.add(capOnHead);
  const gogOnHead = createGoggles(GOGGLES, { profile: 'race' });
  gogOnHead.scale.setScalar(0.11);
  gogOnHead.position.set(0, 0.085, 0.085);
  rig.joints.head.add(gogOnHead);

  /* ---------------------------------- bubbles ---------------------------------- */
  const bubbleMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    // NaN guards: dead particles are zero-scaled, so their normals must not be normalised blindly
    // (NaN samples + MSAA + bloom would black out the whole frame).
    vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 w = modelMatrix * instanceMatrix * vec4(position,1.0); vec3 n = mat3(modelMatrix * instanceMatrix) * normal; float l = length(n); vN = l > 1e-8 ? n / l : vec3(0.0, 0.0, 1.0); vec3 d = cameraPosition - w.xyz; float dl = length(d); vV = dl > 1e-8 ? d / dl : vec3(0.0, 0.0, 1.0); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `varying vec3 vN; varying vec3 vV; void main(){ float f = pow(clamp(1.0 - abs(dot(vN, vV)), 0.0, 1.0), 2.5); gl_FragColor = vec4(vec3(0.92,1.0,1.0), clamp(f * 0.9 + 0.06, 0.0, 1.0)); }`,
  });
  const bubbles = new ParticlePool(new THREE.SphereGeometry(1, 12, 8), bubbleMat, quality === 'low' ? 160 : 380);
  bubbles.gravity = 2.2;
  bubbles.drag = 1.5;
  bubbles.floor = null;
  scene.add(bubbles.mesh);
  const splash = new ParticlePool(
    new THREE.SphereGeometry(1, 8, 6),
    new THREE.MeshStandardMaterial({ color: '#F2FDFF', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.85 }),
    quality === 'low' ? 80 : 180,
  );
  splash.floor = null;
  scene.add(splash.mesh);

  /* ---------------------------------- products ---------------------------------- */
  const goggles = createModel('goggles', GOGGLES, { profile: 'race' }, 0.34);
  const cap = createModel('cap', CAP, { seam: true }, 0.3);
  const exhibit = new THREE.Group();
  exhibit.add(goggles, cap);
  goggles.position.set(0.05, 0.02, 0.12);
  cap.position.set(-0.06, 0.02, -0.14);
  cap.rotation.set(-0.25, 0.6, 0.15);
  exhibit.position.copy(EXHIBIT);
  exhibit.visible = false;
  scene.add(exhibit);
  const ripples: THREE.Mesh[] = [];
  const rippleMat = new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0, depthWrite: false });
  for (let i = 0; i < 6; i++) {
    const r = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), rippleMat.clone());
    r.rotation.x = -Math.PI / 2;
    r.position.set(0, 0.035, 0);
    r.scale.setScalar(0.01);
    r.userData.age = 99;
    ripples.push(r);
    scene.add(r);
  }
  let rippleIdx = 0;
  let dripAcc = 0;

  /* ---------------------------------- choreography ---------------------------------- */
  let t = 0;
  let playing = false;
  let introDone = false;
  let breached = false;
  let timeScale = 1;
  let aspect = 1;
  const camPos = new THREE.Vector3(0.35, -1.5, 3.6);
  const camLook = new THREE.Vector3(0, -0.6, -4);
  const v = new THREE.Vector3();
  const v2 = new THREE.Vector3();
  const swimmerHead = new THREE.Vector3();

  const exhibitCam = (pos: THREE.Vector3, look: THREE.Vector3, orbit: number) => {
    const fovV = THREE.MathUtils.degToRad(camera.fov);
    const visW = 2 * Math.tan(fovV / 2) * aspect;
    const frac = aspect < 0.8 ? 0.68 : aspect < 1.2 ? 0.5 : 0.36;
    const d = THREE.MathUtils.clamp(0.42 / (frac * visW), 0.7, 2.6);
    pos.set(EXHIBIT.x + Math.sin(orbit) * d, EXHIBIT.y + 0.28 * d, EXHIBIT.z + Math.cos(orbit) * d);
    look.set(EXHIBIT.x, EXHIBIT.y + (aspect < 0.8 ? -0.12 * d : -0.04), EXHIBIT.z);
  };
  const placeWord = () => {
    const fovV = THREE.MathUtils.degToRad(camera.fov);
    const visW = 2 * 4.8 * Math.tan(fovV / 2) * aspect;
    const w = Math.min(visW * 0.8, 6);
    word.scale.set(w / 4, w / 4, 1);
    word.position.y = (w / 4) * 0.5 - 0.06;
  };

  const setUnder = (under: boolean) => {
    waterU.uCamY.value = under ? -1 : 1;
    if (under) {
      fog.color.copy(UNDER_FOG);
      fog.density = 0.13;
      (scene.background as THREE.Color).copy(UNDER_FOG);
    } else {
      fog.color.copy(ABOVE_BG);
      fog.density = 0.02;
      (scene.background as THREE.Color).copy(ABOVE_BG);
    }
    for (const r of rays) r.visible = under;
  };

  const reset = () => {
    t = 0;
    breached = false;
    timeScale = 1;
    exhibit.visible = false;
    swimmer.visible = true;
    wordMat.opacity = 0;
    bubbles.clear();
    splash.clear();
    camPos.set(0.35, -1.45, 3.6);
    camLook.set(0, -0.7, -4);
    setUnder(true);
  };

  const breach = () => {
    breached = true;
    exhibit.visible = true;
    for (let i = 0; i < 90; i++) {
      v.set((Math.random() - 0.5) * 0.8, 0.02, 2.0 + (Math.random() - 0.5) * 0.6);
      splash.emit(v, v2.set((Math.random() - 0.5) * 2.2, 1.5 + Math.random() * 3, (Math.random() - 0.5) * 2), 1.4, 0.008 + Math.random() * 0.014);
    }
  };

  reset();

  return {
    id: 'swimming',
    scene,
    camera,
    fx,
    get timeScale() {
      return timeScale;
    },
    set timeScale(x) {
      timeScale = x;
    },
    get introDone() {
      return introDone;
    },
    set introDone(x) {
      introDone = x;
    },
    playIntro() {
      reset();
      playing = true;
      introDone = false;
    },
    skipIntro() {
      reset();
      playing = true;
      t = 5;
      breached = true;
      exhibit.visible = true;
      swimmer.visible = false;
      setUnder(false);
      wordMat.opacity = 1;
      introDone = true;
      exhibitCam(camPos, camLook, 0);
    },
    update(ctx: FrameCtx) {
      const { dt } = ctx;
      if (playing && !introDone) {
        const slow = t > 2.35 && t < 2.85;
        timeScale = damp(timeScale, slow ? 0.35 : 1, 6, dt);
      } else timeScale = 1;
      const sdt = dt * timeScale;
      if (playing) t += sdt;
      waterU.uTime.value += sdt;
      causticU.uTime.value += sdt;

      /* -------- swimmer -------- */
      if (swimmer.visible) {
        const phase = (t / 1.2) % 1;
        applyPose(rig, butterflyPose(phase));
        const x = -5.2 + t * 2.6;
        const breathe = Math.max(0, Math.sin((phase - 0.35) * Math.PI * 2));
        swimmer.position.set(x, -0.42 + Math.sin(phase * Math.PI * 4) * 0.05 + breathe * 0.14, -1.25);
        rig.root.rotation.x = Math.PI / 2 - 0.12 * Math.sin(phase * Math.PI * 4);
        rig.joints.head.getWorldPosition(swimmerHead);
        // bubble trails from the hands and feet
        if (Math.random() < 0.9) {
          for (const j of ['wristL', 'wristR', 'ankleL', 'ankleR'] as const) {
            if (Math.random() > 0.45) continue;
            rig.joints[j].getWorldPosition(v);
            if (v.y < -0.05) bubbles.emit(v, v2.set(-0.6 - Math.random(), 0.2, (Math.random() - 0.5) * 0.3), 1.6, 0.006 + Math.random() * 0.016);
          }
        }
        if (x > 7) swimmer.visible = false;
      }
      // ambient bubble columns
      if (!breached && Math.random() < 0.5) {
        v.set((Math.random() - 0.5) * 4, FLOOR_Y + 0.1, -1 - Math.random() * 6);
        bubbles.emit(v, v2.set(0, 0.4, 0), 3.5, 0.008 + Math.random() * 0.02);
      }
      bubbles.update(sdt);
      // bubbles pop at the surface
      for (let i = 0; i < bubbles.count; i++) if (bubbles.pos[i * 3 + 1]! > -0.03) bubbles.life[i] = 0;
      splash.update(sdt);
      for (const [i, r] of rays.entries()) {
        r.rotation.z = 0.25 + Math.sin(ctx.time * 0.3 + i) * 0.06;
        (r.material as THREE.MeshBasicMaterial).opacity = 0.09 + Math.sin(ctx.time * 0.8 + i * 2) * 0.04;
      }

      /* -------- breach + exhibit -------- */
      if (!breached && t > 3.1) breach();
      if (breached) {
        const k = ctx.time;
        const rise = easeInOutCubic(seg(t, 3.1, 4.0));
        exhibit.position.set(EXHIBIT.x, EXHIBIT.y - (1 - rise) * 0.6 + Math.sin(k * 1.2) * 0.015, EXHIBIT.z);
        exhibit.rotation.set(0.05 + Math.sin(k * 0.5) * 0.05, -0.4 + Math.sin(k * 0.3) * 0.5 + (1 - rise) * 1.2, Math.sin(k * 0.7) * 0.03);
        wordMat.opacity = damp(wordMat.opacity, 1, 2.2, dt);
        // droplets dripping into the pool, rings spreading
        dripAcc += dt;
        if (dripAcc > 0.55) {
          dripAcc = 0;
          goggles.getWorldPosition(v);
          v.y -= 0.06;
          v.x += (Math.random() - 0.5) * 0.12;
          splash.emit(v, v2.set(0, -0.2, 0), 1.2, 0.006);
          const r = ripples[rippleIdx++ % ripples.length]!;
          r.position.set(v.x, 0.03, v.z);
          r.scale.setScalar(0.01);
          r.userData.age = 0;
        }
        for (const r of ripples) {
          r.userData.age += dt;
          const a = r.userData.age as number;
          r.scale.setScalar(0.02 + a * 0.35);
          (r.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.5 - a * 0.35);
        }
      }

      /* -------- camera -------- */
      const tp = v.set(0, 0, 0);
      const tl = v2.set(0, 0, 0);
      if (!breached) {
        tp.set(-0.2 + seg(t, 0, 3.1) * 0.5, -1.35 + seg(t, 2.3, 3.1) * 1.05, 1.9 - seg(t, 0, 3.1) * 0.4);
        if (swimmer.visible) tl.set(THREE.MathUtils.clamp(swimmerHead.x - 0.25, -2.8, 2.8), -0.48, -1.25);
        else tl.set(0, -0.5, -2);
      } else {
        const r = easeInOutCubic(seg(t, 3.1, 4.1));
        exhibitCam(tp, tl, Math.sin(ctx.time * 0.2) * 0.12 + ctx.pointer.x * 0.14);
        tp.lerp(BREACH_CAM, 1 - r);
        tp.y += ctx.pointer.y * 0.04;
      }
      if (ctx.scroll > 0) {
        tp.y += ctx.scroll * 0.9;
        tp.z += ctx.scroll * 1.2;
        tl.y -= ctx.scroll * 0.3;
      }
      const lam = breached && !introDone ? 5 : 3.5;
      camPos.x = damp(camPos.x, tp.x, lam, dt);
      camPos.y = damp(camPos.y, tp.y, lam, dt);
      camPos.z = damp(camPos.z, tp.z, lam, dt);
      camLook.x = damp(camLook.x, tl.x, lam * 1.2, dt);
      camLook.y = damp(camLook.y, tl.y, lam * 1.2, dt);
      camLook.z = damp(camLook.z, tl.z, lam * 1.2, dt);
      camera.position.copy(camPos);
      // gentle underwater sway
      if (!breached) camera.position.x += Math.sin(ctx.time * 0.9) * 0.03;
      camera.lookAt(camLook);
      setUnder(camera.position.y < 0.02);

      if (!introDone && t > 4.6) introDone = true;
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
      return exhibit.visible && rc.intersectObject(exhibit, true).length > 0;
    },
    attach(r: THREE.WebGLRenderer) {
      scene.environment = studioEnv(r);
      scene.environmentIntensity = 0.9;
    },
    dispose() {
      disposeScene(scene);
    },
  };
}
