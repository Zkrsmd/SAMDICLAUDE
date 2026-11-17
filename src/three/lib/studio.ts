import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const envCache = new WeakMap<THREE.WebGLRenderer, THREE.Texture>();

/** Bright studio reflection environment (procedural — no HDRI download required). */
export function studioEnv(renderer: THREE.WebGLRenderer) {
  const hit = envCache.get(renderer);
  if (hit) return hit;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const tex = pmrem.fromScene(room, 0.035).texture;
  room.traverse((o) => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose();
    (m.material as THREE.Material | undefined)?.dispose?.();
  });
  pmrem.dispose();
  envCache.set(renderer, tex);
  return tex;
}

export function configureRenderer(r: THREE.WebGLRenderer) {
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.NeutralToneMapping;
  r.toneMappingExposure = 1.0;
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFShadowMap;
}

/** Key / fill / rim lighting rig used by renders, viewer and showroom. */
export function studioLights(intensity = 1) {
  const g = new THREE.Group();
  const key = new THREE.DirectionalLight('#fffaf2', 2.4 * intensity);
  key.position.set(-3, 6, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = key.shadow.camera.bottom = -3;
  key.shadow.camera.right = key.shadow.camera.top = 3;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 20;
  key.shadow.radius = 6;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  const fill = new THREE.DirectionalLight('#eef4ff', 0.8 * intensity);
  fill.position.set(5, 2, 3);
  const rim = new THREE.DirectionalLight('#ffffff', 1.6 * intensity);
  rim.position.set(2, 3, -5);
  const amb = new THREE.HemisphereLight('#ffffff', '#e8e4da', 0.6 * intensity);
  g.add(key, fill, rim, amb);
  return { group: g, key };
}

/** Soft radial contact-shadow texture. */
export function blobShadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(23,26,24,0.55)');
  g.addColorStop(0.45, 'rgba(23,26,24,0.22)');
  g.addColorStop(1, 'rgba(23,26,24,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function contactShadow(width = 2.6, depth = 1.4, opacity = 0.6) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshBasicMaterial({ map: blobShadowTexture(), transparent: true, opacity, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = -1;
  return m;
}
