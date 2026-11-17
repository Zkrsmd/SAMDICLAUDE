import * as THREE from 'three';
import { grainTexture, knitTexture } from './textures';

type PhysOpts = THREE.MeshPhysicalMaterialParameters;

export const leather = (color: string, o: PhysOpts = {}) =>
  new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.42,
    clearcoat: 0.55,
    clearcoatRoughness: 0.32,
    bumpMap: grainTexture(1.2, 3),
    bumpScale: 0.35,
    sheen: 0.15,
    sheenColor: new THREE.Color('#ffffff'),
    ...o,
  });

export const fabric = (color: string, o: PhysOpts = {}) =>
  new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.82,
    sheen: 0.7,
    sheenRoughness: 0.6,
    sheenColor: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.5),
    bumpMap: knitTexture(),
    bumpScale: 0.6,
    ...o,
  });

export const silicone = (color: string, o: PhysOpts = {}) =>
  new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.38,
    clearcoat: 0.3,
    clearcoatRoughness: 0.4,
    bumpMap: grainTexture(0.6, 11),
    bumpScale: 0.12,
    ...o,
  });

export const plastic = (color: string, o: PhysOpts = {}) =>
  new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.2, ...o });

export const rubber = (color: string, o: PhysOpts = {}) =>
  new THREE.MeshPhysicalMaterial({ color, roughness: 0.75, bumpMap: grainTexture(1, 5), bumpScale: 0.25, ...o });

export const metal = (color: string, roughness = 0.22, o: PhysOpts = {}) =>
  new THREE.MeshPhysicalMaterial({ color, metalness: 1, roughness, ...o });

export const mirrorLens = (tint: string) =>
  new THREE.MeshPhysicalMaterial({
    color: tint,
    metalness: 0.92,
    roughness: 0.04,
    iridescence: 1,
    iridescenceIOR: 1.45,
    iridescenceThicknessMinimum: 180,
    iridescenceThicknessMaximum: 620,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    envMapIntensity: 1.6,
  });

export const clearPlastic = (tint: string, opacity = 0.45) =>
  new THREE.MeshPhysicalMaterial({
    color: tint,
    roughness: 0.08,
    metalness: 0.1,
    transparent: true,
    opacity,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    depthWrite: false,
  });
