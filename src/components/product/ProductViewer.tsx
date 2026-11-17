'use client';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { ModelKind, ModelOptions, Palette } from '@/types/catalog';
import { createModel } from '@/three/products/registry';
import { contactShadow, studioEnv } from '@/three/lib/studio';
import { disposeDeep } from '@/three/lib/geom';

export type Preset = 'hero' | 'side' | 'front' | 'top' | 'sole' | 'detail';
export const PRESET_DIR: Record<Preset, [number, number, number]> = {
  hero: [0.55, 0.28, 1],
  side: [0, 0.05, 1],
  front: [1, 0.12, 0.05],
  top: [0.1, 1.4, 0.25],
  sole: [0.15, -0.9, 0.6],
  detail: [-0.9, 0.3, 0.5],
};

export interface ViewerState {
  preset: Preset;
  /** bumps whenever a preset should be (re)applied */
  nonce: number;
  /** 0..1: scroll-driven "drop" at the end of the exhibit section */
  drop: number;
  /** user is interacting — pause auto choreography */
  userAt: number;
  intro: 'showroom' | 'normal';
}

const BASE_DIST = 4.6;

export default function ProductViewer({
  kind,
  options,
  palette,
  state,
  inspect,
  yawRef,
}: {
  kind: ModelKind;
  options: ModelOptions;
  palette: Palette;
  state: React.RefObject<ViewerState>;
  inspect: boolean;
  yawRef: React.RefObject<number>;
}) {
  return (
    <Canvas
      dpr={[1, 1.8]}
      camera={{ fov: 30, position: [2.4, 1.2, 4], near: 0.05, far: 60 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NeutralToneMapping;
        gl.setClearColor(0x000000, 0);
      }}
      shadows
      style={{ touchAction: inspect ? 'none' : 'pan-y' }}
    >
      <Stage kind={kind} options={options} palette={palette} state={state} inspect={inspect} yawRef={yawRef} />
    </Canvas>
  );
}

function Stage({
  kind,
  options,
  palette,
  state,
  inspect,
  yawRef,
}: {
  kind: ModelKind;
  options: ModelOptions;
  palette: Palette;
  state: React.RefObject<ViewerState>;
  inspect: boolean;
  yawRef: React.RefObject<number>;
}) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const controls = useRef<OrbitControlsImpl>(null);
  const holder = useRef<THREE.Group>(null);
  const applied = useRef(-1);
  const goal = useRef<{ pos: THREE.Vector3; t: number } | null>(null);

  useEffect(() => {
    scene.environment = studioEnv(gl);
    scene.environmentIntensity = 0.85;
  }, [gl, scene]);

  const model = useMemo(() => createModel(kind, palette, options, 2), [kind, palette, options]);
  useEffect(() => () => disposeDeep(model), [model]);
  const floorY = useMemo(() => -((model.userData.height as number) ?? 1) / 2 - 0.02, [model]);
  const shadow = useMemo(() => contactShadow(2.6, 1.5, 0.5), []);

  const distFor = () => {
    const aspect = size.width / Math.max(1, size.height);
    return aspect < 0.8 ? BASE_DIST * 1.62 : BASE_DIST;
  };

  // showroom hand-off: open from a close-up, then settle
  useEffect(() => {
    const dir = new THREE.Vector3(...PRESET_DIR.hero).normalize();
    const close = state.current?.intro === 'showroom';
    camera.position.copy(dir.multiplyScalar(close ? distFor() * 0.42 : distFor() * 1.35));
    camera.lookAt(0, 0, 0);
    applied.current = -1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera]);

  useFrame((_, dt) => {
    const st = state.current;
    if (!st) return;
    const c = controls.current;
    // preset requests (chapters, buttons)
    if (st.nonce !== applied.current) {
      applied.current = st.nonce;
      const d = new THREE.Vector3(...PRESET_DIR[st.preset]).normalize().multiplyScalar(distFor());
      goal.current = { pos: d, t: 0 };
    }
    const interacting = performance.now() - st.userAt < 3500;
    if (goal.current && !interacting) {
      goal.current.t += dt;
      const lam = 3.2;
      camera.position.x = THREE.MathUtils.damp(camera.position.x, goal.current.pos.x, lam, dt);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, goal.current.pos.y, lam, dt);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, goal.current.pos.z, lam, dt);
      // keep orbit radius stable while interpolating
      if (goal.current.t > 2.5) goal.current = null;
    }
    if (c) {
      c.target.set(0, 0, 0);
      c.update();
    } else camera.lookAt(0, 0, 0);
    // custom touch yaw (non-inspect mode on touch devices)
    const g = holder.current;
    if (g) {
      g.rotation.y = THREE.MathUtils.damp(g.rotation.y, yawRef.current ?? 0, 8, dt);
      const drop = st.drop;
      g.position.y = Math.sin(performance.now() / 1400) * 0.03 * (1 - drop) - drop * 1.6;
      const s = 1 - drop * 0.55;
      g.scale.setScalar(s);
    }
    shadow.position.y = floorY + (g?.position.y ?? 0) * 0.15;
    (shadow.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - st.drop);
  });

  return (
    <>
      <hemisphereLight args={['#ffffff', '#e6e1d6', 0.6]} />
      <directionalLight position={[-3, 6, 4]} intensity={2.2} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[4, 2, 3]} intensity={0.7} />
      <directionalLight position={[1, 3, -5]} intensity={1.4} />
      <group ref={holder}>
        <primitive object={model} />
      </group>
      <primitive object={shadow} position={[0, floorY, 0]} />
      <OrbitControls
        ref={controls}
        makeDefault
        enablePan={false}
        enableZoom={inspect}
        enableRotate={inspect || !matchMedia('(pointer: coarse)').matches}
        minDistance={2.2}
        maxDistance={8}
        minPolarAngle={0.15}
        maxPolarAngle={Math.PI * 0.82}
        rotateSpeed={0.7}
        enableDamping
        dampingFactor={0.08}
        onStart={() => {
          if (state.current) state.current.userAt = performance.now();
          goal.current = null;
        }}
      />
    </>
  );
}
