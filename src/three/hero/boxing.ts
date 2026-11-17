import * as THREE from 'three';
import { createModel } from '../products/registry';
import { createGlove } from '../products/glove';
import { createHeavybag } from '../products/misc';
import { studioEnv } from '../lib/studio';
import { BOXER_POSES, applyPose, createRig, silhouetteMaterial, type Pose } from '../athletes/rig';
import {
  ParticlePool,
  clamp01,
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

const VENUM = { primary: '#121212', secondary: '#C8A451', accent: '#1C1C1C', detail: '#C8A451' };
const EXHIBIT = new THREE.Vector3(0.05, 1.32, 0.35);
const PIVOT = new THREE.Vector3(0.0, 2.32, 0.86);

const KEYS: { t: number; p: Pose }[] = [
  { t: 0, p: BOXER_POSES.guard },
  { t: 0.5, p: BOXER_POSES.guard },
  { t: 0.62, p: BOXER_POSES.jab },
  { t: 0.78, p: BOXER_POSES.guard },
  { t: 0.86, p: BOXER_POSES.guard },
  { t: 0.97, p: BOXER_POSES.jab },
  { t: 1.12, p: BOXER_POSES.guard },
  { t: 1.2, p: BOXER_POSES.guard },
  { t: 1.34, p: BOXER_POSES.cross },
  { t: 1.5, p: BOXER_POSES.guard },
  { t: 1.74, p: BOXER_POSES.load },
  { t: 1.9, p: BOXER_POSES.hook },
  { t: 2.35, p: BOXER_POSES.hook },
  { t: 2.9, p: BOXER_POSES.guard },
];

export function createBoxingScene(quality: QualityTier): HeroScene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#F2EFE8');
  scene.fog = new THREE.Fog('#F4F1EA', 8, 26);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.05, 80);
  const fx = { aberration: 0, flash: 0, shake: 0, exposure: 1 };

  /* ----------------------------------- gym ----------------------------------- */
  const concrete = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#DCD7CC';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 14000; i++) {
      const v = 190 + Math.random() * 50;
      ctx.fillStyle = `rgba(${v},${v - 4},${v - 10},0.18)`;
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }
    ctx.strokeStyle = 'rgba(120,110,95,0.22)';
    ctx.lineWidth = 2;
    for (const x of [0, 256]) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 512);
      ctx.moveTo(0, x);
      ctx.lineTo(512, x);
      ctx.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(5, 5);
    t.anisotropy = 8;
    return t;
  })();
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshStandardMaterial({ map: concrete, roughness: 0.32, metalness: 0.05, envMapIntensity: 0.7 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // blazing window wall behind the athlete (HDR so it blooms)
  const windowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.3, 1.28, 1.22), fog: false });
  const windows = new THREE.Mesh(new THREE.PlaneGeometry(16, 6.5), windowMat);
  windows.position.set(4.6, 3.1, 0);
  windows.rotation.y = -Math.PI / 2;
  scene.add(windows);
  const mullionMat = new THREE.MeshStandardMaterial({ color: '#3B3833', roughness: 0.6 });
  for (let z = -7.2; z <= 7.2; z += 1.6) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.12, 6.5, 0.07), mullionMat);
    m.position.set(4.55, 3.1, z);
    scene.add(m);
  }
  for (const y of [0.25, 2.2, 4.3]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, 16), mullionMat);
    m.position.set(4.55, y, 0);
    scene.add(m);
  }
  const sideWall = new THREE.Mesh(new THREE.PlaneGeometry(14, 7), new THREE.MeshStandardMaterial({ map: concrete, roughness: 0.9, color: '#E9E5DC' }));
  sideWall.position.set(-1, 3.5, -5.2);
  scene.add(sideWall);

  // the word as frosted silhouette letters on the glass
  const wordMat = new THREE.MeshBasicMaterial({ map: wordTexture('BOXING', { color: '#2B2724' }), transparent: true, opacity: 0.0, depthWrite: false, fog: false });
  const word = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.25), wordMat);
  word.rotation.y = -Math.PI / 2;
  word.position.set(4.5, 1.5, 0.3);
  scene.add(word);

  // god rays from the windows
  const shaftTex = (() => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 256;
    const ctx = c.getContext('2d')!;
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, 'rgba(255,246,222,0.9)');
    g.addColorStop(1, 'rgba(255,246,222,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 256);
    const h = ctx.createLinearGradient(0, 0, 64, 0);
    h.addColorStop(0, 'rgba(0,0,0,1)');
    h.addColorStop(0.5, 'rgba(0,0,0,0)');
    h.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = h;
    ctx.fillRect(0, 0, 64, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const shafts: THREE.Mesh[] = [];
  for (let i = 0; i < (quality === 'high' ? 4 : 3); i++) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9 + i * 0.2, 7),
      new THREE.MeshBasicMaterial({ map: shaftTex, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }),
    );
    m.position.set(2.4 - i * 0.2, 3.1, -1.6 + i * 1.3);
    m.rotation.set(0, -Math.PI / 2 + 0.15, 0.62);
    shafts.push(m);
    scene.add(m);
  }

  // dust motes floating in the light
  const dustN = quality === 'low' ? 100 : quality === 'mid' ? 200 : 360;
  const dustGeo = new THREE.BufferGeometry();
  const dp = new Float32Array(dustN * 3);
  for (let i = 0; i < dustN; i++) dp.set([(Math.random() - 0.3) * 5, Math.random() * 3.6, (Math.random() - 0.5) * 5], i * 3);
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  const dust = new THREE.Points(
    dustGeo,
    new THREE.PointsMaterial({ size: 0.022, map: glowTexture('rgba(255,236,190,1)', 'rgba(255,236,190,0)'), transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  scene.add(dust);

  /* ---------------------------------- lights ---------------------------------- */
  const back = new THREE.DirectionalLight('#FFF4E0', 4.2);
  back.position.set(6, 4.5, 0.6);
  back.castShadow = quality === 'high';
  back.shadow.mapSize.set(1024, 1024);
  back.shadow.camera.left = back.shadow.camera.bottom = -3;
  back.shadow.camera.right = back.shadow.camera.top = 3;
  back.shadow.bias = -0.0004;
  scene.add(back, back.target);
  const hemi = new THREE.HemisphereLight('#FFFFFF', '#B8AE9A', 0.32);
  scene.add(hemi);
  const key = new THREE.DirectionalLight('#FFFFFF', 0.15); // ramps up for the product reveal
  key.position.set(-4, 3, 2.5);
  scene.add(key, key.target);
  const goldRim = new THREE.PointLight('#FFD58A', 0, 4);
  scene.add(goldRim);

  /* ---------------------------------- athlete ---------------------------------- */
  const skin = silhouetteMaterial('#FFD9A0', '#0E0C0B', 3.4, 2.6);
  skin.envMapIntensity = 0.12;
  const rig = createRig({ material: skin, shorts: '#121110', hood: true });
  rig.root.position.set(0, 0, 0);
  scene.add(rig.root);
  for (const side of ['L', 'R'] as const) {
    const g = createGlove(VENUM, { trim: 'gold', cuff: 'long' }, side === 'L' ? 'left' : 'right');
    g.scale.setScalar(0.17);
    g.rotation.set(0, 0, -Math.PI / 2);
    g.position.set(0, -0.02, 0);
    rig.joints[`wrist${side}`].add(g);
  }
  rig.root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });

  /* ----------------------------------- bag ----------------------------------- */
  const bagPivot = new THREE.Group();
  bagPivot.position.copy(PIVOT);
  const bag = createHeavybag({ primary: '#1A1A1A', secondary: '#C8A451', accent: '#C8A451' });
  bag.scale.setScalar(0.5);
  bag.position.y = -0.95;
  bag.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
  bagPivot.add(bag);
  scene.add(bagPivot);
  const bagState = { ax: 0, az: 0, vx: 0, vz: 0 };

  /* ---------------------------------- product ---------------------------------- */
  const product = createModel('glove', VENUM, { trim: 'gold', cuff: 'long' }, 2);
  product.scale.setScalar(0.27);
  product.visible = false;
  scene.add(product);
  const glints = new THREE.Points(
    (() => {
      const g = new THREE.BufferGeometry();
      const p = new Float32Array(90 * 3);
      for (let i = 0; i < 90; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = 0.35 + Math.random() * 0.5;
        p.set([Math.cos(a) * r, (Math.random() - 0.5) * 0.9, Math.sin(a) * r], i * 3);
      }
      g.setAttribute('position', new THREE.BufferAttribute(p, 3));
      return g;
    })(),
    new THREE.PointsMaterial({ size: 0.02, color: '#FFD98A', map: glowTexture(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  glints.position.copy(EXHIBIT);
  scene.add(glints);

  // impact: shock ring + dust burst
  const ringMat = new THREE.MeshBasicMaterial({
    map: glowTexture('rgba(255,250,235,0)', 'rgba(255,250,235,0)'),
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  ringMat.map = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(128, 128, 70, 128, 128, 128);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.8, 'rgba(255,244,220,0.95)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), ringMat);
  scene.add(ring);
  const puff = new ParticlePool(
    new THREE.IcosahedronGeometry(1, 1),
    new THREE.MeshStandardMaterial({ color: '#EFE7D6', roughness: 1, transparent: true, opacity: 0.55, depthWrite: false }),
    quality === 'low' ? 60 : 140,
  );
  puff.gravity = -0.6;
  puff.drag = 3.2;
  puff.floor = null;
  const sparks = new ParticlePool(
    new THREE.OctahedronGeometry(1, 0),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.7, 0.8) }),
    quality === 'low' ? 40 : 90,
  );
  sparks.gravity = -6;
  sparks.drag = 1.4;
  scene.add(puff.mesh, sparks.mesh);

  /* --------------------------------- choreography --------------------------------- */
  let t = 0;
  let playing = false;
  let introDone = false;
  let impacted = false;
  let revealed = false;
  let timeScale = 1;
  let aspect = 1;
  const camPos = new THREE.Vector3(-3.6, 1.2, 0.5);
  const camLook = new THREE.Vector3(0.3, 1.2, 0.5);
  const v = new THREE.Vector3();
  const v2 = new THREE.Vector3();
  const gloveWorld = new THREE.Vector3();

  const poseAt = (time: number) => {
    let i = 0;
    while (i < KEYS.length - 2 && time > KEYS[i + 1]!.t) i++;
    const a = KEYS[i]!;
    const b = KEYS[i + 1]!;
    const k = easeInOutCubic(clamp01((time - a.t) / Math.max(1e-3, b.t - a.t)));
    return { a: a.p, b: b.p, k };
  };

  const actionDist = () => (aspect < 0.8 ? 4.3 : aspect < 1.2 ? 3.6 : 3.1);
  const exhibitCam = (pos: THREE.Vector3, look: THREE.Vector3, orbit: number) => {
    const fovV = THREE.MathUtils.degToRad(camera.fov);
    const visW = 2 * Math.tan(fovV / 2) * aspect;
    const frac = aspect < 0.8 ? 0.8 : aspect < 1.2 ? 0.55 : 0.4;
    const d = THREE.MathUtils.clamp(0.62 / (frac * visW), 1.0, 3.2);
    const o = 0.22 + orbit;
    pos.set(EXHIBIT.x - Math.cos(o) * d, EXHIBIT.y + 0.1 * d, EXHIBIT.z + Math.sin(o) * d);
    look.set(EXHIBIT.x, EXHIBIT.y + (aspect < 0.8 ? -0.1 * d : -0.02), EXHIBIT.z);
  };

  const placeWord = () => {
    const fovV = THREE.MathUtils.degToRad(camera.fov);
    const dist = 4.5 + 3.4;
    const visW = 2 * dist * Math.tan(fovV / 2) * aspect;
    const w = Math.min(visW * 0.9, 7.5);
    word.scale.set(w, w, 1);
    word.position.y = 1.35 + (w * 0.25) / 2 - 0.3;
  };

  const reset = () => {
    t = 0;
    impacted = false;
    revealed = false;
    timeScale = 1;
    rig.root.visible = true;
    bag.visible = true;
    product.visible = false;
    bagState.ax = bagState.az = bagState.vx = bagState.vz = 0;
    key.intensity = 0.15;
    goldRim.intensity = 0;
    wordMat.opacity = 0;
    (glints.material as THREE.PointsMaterial).opacity = 0;
    puff.clear();
    sparks.clear();
    camPos.set(-actionDist(), 1.15, 0.55);
    camLook.set(0.3, 1.2, 0.5);
  };

  const reveal = () => {
    revealed = true;
    rig.root.visible = false;
    product.visible = true;
    product.position.copy(EXHIBIT);
    exhibitCam(camPos, camLook, 0);
  };

  reset();

  return {
    id: 'boxing',
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
      t = 3.6;
      reveal();
      wordMat.opacity = 1;
      key.intensity = 2.0;
      introDone = true;
    },
    update(ctx: FrameCtx) {
      const { dt } = ctx;
      if (playing && !introDone) {
        const slow = impacted && t < 2.08;
        timeScale = damp(timeScale, slow ? 0.12 : 1, slow ? 40 : 5, dt);
      } else timeScale = 1;
      const sdt = dt * timeScale;
      if (playing) t += sdt;

      /* ------------- athlete ------------- */
      if (!revealed) {
        const { a, b, k } = poseAt(t);
        applyPose(rig, a, b, k);
        rig.joints.hips.position.y += Math.abs(Math.sin(t * 8.5)) * 0.018 * (t < 1.6 ? 1 : 0.3);
        rig.root.rotation.y = 0.05;
      }
      if (!impacted && t >= 1.9) {
        impacted = true;
        fx.aberration = 1;
        fx.shake = 1;
        fx.flash = 0.18;
        bagState.vz = -2.4;
        bagState.vx = -1.1;
        rig.joints.wristL.children[0]!.getWorldPosition(gloveWorld);
        ring.position.copy(gloveWorld);
        ring.scale.setScalar(0.08);
        ringMat.opacity = 1;
        for (let i = 0; i < 70; i++) {
          v.copy(gloveWorld).add(v2.set((Math.random() - 0.5) * 0.15, (Math.random() - 0.5) * 0.25, Math.random() * 0.1));
          puff.emit(v, v2.set(-0.5 - Math.random() * 1.8, (Math.random() - 0.3) * 1.5, (Math.random() - 0.2) * 2.2), 1.6 + Math.random(), 0.02 + Math.random() * 0.05);
        }
        for (let i = 0; i < 40; i++)
          sparks.emit(gloveWorld, v2.set(-1 - Math.random() * 3, Math.random() * 3, (Math.random() - 0.5) * 3), 0.8, 0.006 + Math.random() * 0.006);
      }
      // bag pendulum
      const L = 1.0;
      bagState.vz += (-9.8 / L) * Math.sin(bagState.az) * sdt - bagState.vz * 0.35 * sdt;
      bagState.vx += (-9.8 / L) * Math.sin(bagState.ax) * sdt - bagState.vx * 0.35 * sdt;
      bagState.az += bagState.vz * sdt;
      bagState.ax += bagState.vx * sdt;
      bagPivot.rotation.set(bagState.ax, 0, bagState.az);

      if (ringMat.opacity > 0) {
        ring.scale.multiplyScalar(1 + sdt * 10);
        ringMat.opacity = Math.max(0, ringMat.opacity - sdt * 2.4);
        ring.lookAt(camera.position);
      }
      puff.update(sdt);
      sparks.update(sdt);

      // reveal: rush to the glove under a white flash
      if (!revealed && t > 2.3) fx.flash = Math.max(fx.flash, easeInOutCubic(seg(t, 2.3, 2.75)));
      if (!revealed && t >= 2.75) reveal();
      if (revealed && !introDone) fx.flash = Math.max(0, 1 - seg(t, 2.75, 3.4));

      /* ------------- product exhibit ------------- */
      if (revealed) {
        const k = ctx.time;
        const intro = easeInOutCubic(seg(t, 2.75, 3.6));
        product.position.set(EXHIBIT.x, EXHIBIT.y + Math.sin(k * 1.3) * 0.015, EXHIBIT.z);
        product.rotation.set(0.08 + Math.sin(k * 0.6) * 0.06, -Math.PI / 2 - 0.9 + intro * 0.9 + Math.sin(k * 0.3) * 0.5, -0.05);
        key.intensity = damp(key.intensity, 2.1, 3, dt);
        key.target.position.copy(EXHIBIT);
        goldRim.position.copy(EXHIBIT).add(v.set(1.2, 0.6, -0.6));
        goldRim.intensity = damp(goldRim.intensity, 3.5, 2, dt);
        const gm = glints.material as THREE.PointsMaterial;
        gm.opacity = damp(gm.opacity, 0.9, 2, dt);
        glints.rotation.y += dt * 0.15;
        wordMat.opacity = damp(wordMat.opacity, 1, 2.5, dt);
      } else if (t > 0.3) {
        wordMat.opacity = damp(wordMat.opacity, 0.85, 1.5, dt);
      }
      const dpos = dustGeo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < dustN; i++) {
        dpos.setY(i, (dpos.getY(i) + dt * 0.03 + Math.sin(ctx.time + i) * dt * 0.01 + 3.6) % 3.6);
        if (impacted && !revealed) dpos.setX(i, dpos.getX(i) - dt * 0.15);
      }
      dpos.needsUpdate = true;
      for (const [i, s] of shafts.entries())
        (s.material as THREE.MeshBasicMaterial).opacity = 0.13 + Math.sin(ctx.time * 0.7 + i * 1.7) * 0.03;

      /* ------------- camera ------------- */
      const tp = v.set(0, 0, 0);
      const tl = v2.set(0, 0, 0);
      if (!revealed) {
        const d = actionDist();
        const push = easeInOutCubic(seg(t, 0, 1.9)) * 0.45;
        tp.set(-d + push, 1.12 + push * 0.1, 0.55 + Math.sin(t * 0.8) * 0.05);
        tl.set(0.3, 1.22, aspect < 0.8 ? 0.4 : 0.5);
        if (t > 2.3) {
          // rush toward the glove
          rig.joints.wristL.children[0]!.getWorldPosition(gloveWorld);
          const r = easeInOutCubic(seg(t, 2.3, 2.75));
          tp.lerp(gloveWorld.clone().add(new THREE.Vector3(-0.9, 0.05, 0)), r);
          tl.lerp(gloveWorld, r);
        }
      } else {
        exhibitCam(tp, tl, Math.sin(ctx.time * 0.2) * 0.12 + ctx.pointer.x * 0.15);
        tp.y += ctx.pointer.y * 0.05;
      }
      if (ctx.scroll > 0) {
        tp.y += ctx.scroll * 0.9;
        tp.x -= ctx.scroll * 1.2;
        tl.y -= ctx.scroll * 0.25;
      }
      const lam = revealed ? (introDone ? 3 : 8) : 6;
      camPos.x = damp(camPos.x, tp.x, lam, dt);
      camPos.y = damp(camPos.y, tp.y, lam, dt);
      camPos.z = damp(camPos.z, tp.z, lam, dt);
      camLook.x = damp(camLook.x, tl.x, lam * 1.3, dt);
      camLook.y = damp(camLook.y, tl.y, lam * 1.3, dt);
      camLook.z = damp(camLook.z, tl.z, lam * 1.3, dt);
      if (revealed && !introDone && t < 2.8) {
        camPos.copy(tp);
        camLook.copy(tl);
      }
      camera.position.copy(camPos);
      if (fx.shake > 0.001) {
        camera.position.x += (Math.random() - 0.5) * fx.shake * 0.05;
        camera.position.y += (Math.random() - 0.5) * fx.shake * 0.05;
      }
      camera.lookAt(camLook);
      fx.shake = damp(fx.shake, 0, 5, dt);
      fx.aberration = damp(fx.aberration, 0, 3, dt);
      if (introDone) fx.flash = damp(fx.flash, 0, 6, dt);
      back.target.position.set(0, 1, 0.4);

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
      return product.visible && rc.intersectObject(product, true).length > 0;
    },
    attach(r: THREE.WebGLRenderer) {
      scene.environment = studioEnv(r);
      scene.environmentIntensity = 0.7;
    },
    dispose() {
      disposeScene(scene);
    },
  };
}
