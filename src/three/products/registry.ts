import * as THREE from 'three';
import type { ModelKind, ModelOptions, Palette } from '@/types/catalog';
import { createBoot, type BootOptions } from './boot';
import { createGlove, type GloveOptions } from './glove';
import { createBall } from './ball';
import { createCap, createFins, createGoggles, createKickboard, createPullbuoy } from './swim';
import * as M from './misc';

/**
 * Single registry for representative product models. To use an official/licensed model,
 * load it here (e.g. GLTFLoader) for the matching product and return it normalised.
 */
export function buildRaw(kind: ModelKind, pal: Palette, o: ModelOptions = {}): THREE.Group {
  switch (kind) {
    case 'boot':
      return createBoot(pal, {
        collar: (o.collar as BootOptions['collar']) ?? 'low',
        studs: (o.studs as BootOptions['studs']) ?? 'fg',
        laces: o.laces !== false,
        pattern: (o.pattern as BootOptions['pattern']) ?? 'plain',
        sole: (o.sole as BootOptions['sole']) ?? 'plate',
      });
    case 'glove': {
      const pair = new THREE.Group();
      const go: GloveOptions = { trim: (o.trim as GloveOptions['trim']) ?? 'gold', cuff: (o.cuff as GloveOptions['cuff']) ?? 'long' };
      const r = createGlove(pal, go, 'right');
      const l = createGlove(pal, go, 'left');
      r.rotation.set(0.15, -0.35, 0.3);
      r.position.set(0.15, 0.25, 0.25);
      l.rotation.set(-0.1, 0.5, -0.15);
      l.position.set(-0.25, -0.2, -0.35);
      pair.add(l, r);
      return pair;
    }
    case 'ball':
      return createBall(pal, o as { pattern?: string });
    case 'goggles':
      return createGoggles(pal, o as { profile?: string });
    case 'cap':
      return createCap(pal, o as { seam?: boolean });
    case 'fins':
      return createFins(pal, o as { short?: boolean });
    case 'kickboard':
      return createKickboard(pal);
    case 'pullbuoy':
      return createPullbuoy(pal);
    case 'sock':
      return M.createSock(pal, o);
    case 'shinguard':
      return M.createShinguard(pal);
    case 'jersey':
      return M.createJersey(pal, o);
    case 'shorts':
      return M.createShorts(pal, o);
    case 'cone':
      return M.createCone(pal, o);
    case 'bottle':
      return M.createBottle(pal, o);
    case 'bag':
      return M.createBag(pal, o);
    case 'handwrap':
      return M.createHandwrap(pal);
    case 'mouthguard':
      return M.createMouthguard(pal);
    case 'headgear':
      return M.createHeadgear(pal);
    case 'heavybag':
      return M.createHeavybag(pal);
    case 'rope':
      return M.createRope(pal);
    case 'mitt':
      return M.createMitt(pal);
    case 'swimsuit':
      return M.createSwimsuit(pal);
    case 'towel':
      return M.createTowel(pal);
    case 'dumbbell':
      return M.createDumbbell(pal);
    case 'kettlebell':
      return M.createKettlebell(pal);
    case 'mat':
      return M.createMat(pal);
    case 'jacket':
      return M.createJacket(pal);
  }
}

/** Builds a model centred on the origin and scaled so its largest dimension equals `size`. */
export function createModel(kind: ModelKind, pal: Palette, o: ModelOptions = {}, size = 2) {
  const raw = buildRaw(kind, pal, o);
  const wrap = new THREE.Group();
  wrap.add(raw);
  wrap.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(raw);
  const dims = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const s = size / Math.max(dims.x, dims.y, dims.z);
  raw.position.sub(center);
  const holder = new THREE.Group();
  holder.add(wrap);
  wrap.scale.setScalar(s);
  holder.userData.kind = kind;
  holder.userData.height = dims.y * s;
  return holder;
}

/** Re-tints an existing model's main material for live colour swatches (cheap path). */
export function recolor(model: THREE.Object3D, kind: ModelKind, pal: Palette, o: ModelOptions = {}) {
  const parent = model.parent;
  const next = createModel(kind, pal, o);
  next.position.copy(model.position);
  next.rotation.copy(model.rotation);
  next.scale.copy(model.scale);
  if (parent) {
    parent.add(next);
    parent.remove(model);
  }
  return next;
}
