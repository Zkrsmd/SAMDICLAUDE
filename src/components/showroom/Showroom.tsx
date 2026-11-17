'use client';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { ModelKind, ModelOptions, Palette } from '@/types/catalog';
import { createModel } from '@/three/products/registry';
import { contactShadow, studioEnv } from '@/three/lib/studio';
import { disposeDeep } from '@/three/lib/geom';
import { glowTexture } from '@/three/hero/common';
import { rng } from '@/three/lib/textures';
import { useTransitionStore } from '@/stores/ui';
import { formatPrice } from '@/lib/format';
import { Icon } from '@/components/ui/Icon';

export interface ShowItem {
  slug: string;
  name: string;
  brandName: string;
  price: number;
  kind: ModelKind;
  options: ModelOptions;
  palette: Palette;
}
type Mount = 'wall' | 'hooks' | 'plinths';

const WALL = '#F3F1EC';

/** Architectural white showroom. Desktop: hover spotlight + click to approach. Mobile: swipe rail + tap. */
export default function Showroom({ items, mount }: { items: ShowItem[]; mount: Mount }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [zooming, setZooming] = useState<number | null>(null);
  const [mobile, setMobile] = useState(false);
  const pan = useRef({ x: 0, target: 0, v: 0 });
  useEffect(() => () => void (document.body.style.cursor = ''), []);
  const wrap = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const setPending = useTransitionStore((s) => s.setPending);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const on = () => setMobile(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const layout = useMemo(() => {
    if (mobile) return items.map((_, i) => new THREE.Vector3(i * 1.25, 1.25, 0));
    const perRow = Math.min(4, Math.ceil(items.length / 2));
    return items.map((_, i) => {
      const row = Math.floor(i / perRow);
      const col = i % perRow;
      const inRow = Math.min(perRow, items.length - row * perRow);
      return new THREE.Vector3((col - (inRow - 1) / 2) * 1.5, 1.85 - row * 1.25, 0);
    });
  }, [items, mobile]);

  // horizontal drag on mobile pans along the wall (vertical scroll stays native)
  useEffect(() => {
    const el = wrap.current;
    if (!el || !mobile) return;
    let sx = 0;
    let sy = 0;
    let start = 0;
    let lock: 'h' | 'v' | null = null;
    let down = false;
    const max = Math.max(0, (items.length - 1) * 1.25);
    const onDown = (e: PointerEvent) => {
      down = true;
      lock = null;
      sx = e.clientX;
      sy = e.clientY;
      start = pan.current.target;
    };
    const onMove = (e: PointerEvent) => {
      if (!down) return;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      if (!lock && Math.hypot(dx, dy) > 8) lock = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
      if (lock === 'h') pan.current.target = THREE.MathUtils.clamp(start - dx / 160, -0.2, max + 0.2);
    };
    const onUp = () => {
      down = false;
      if (lock === 'h') pan.current.target = Math.round(THREE.MathUtils.clamp(pan.current.target / 1.25, 0, items.length - 1)) * 1.25;
    };
    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [mobile, items.length]);

  const open = (i: number) => {
    if (zooming !== null) return;
    setZooming(i);
    setSelected(i);
    setPending(items[i]!.slug);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.setTimeout(() => router.push(`/product/${items[i]!.slug}`), reduced ? 0 : 820);
  };
  const choose = (i: number) => {
    if (mobile) {
      setSelected(i);
      pan.current.target = layout[i]!.x;
    } else open(i);
  };
  const step = (d: number) => {
    const cur = selected ?? Math.round(pan.current.target / 1.25);
    const n = THREE.MathUtils.clamp(cur + d, 0, items.length - 1);
    setSelected(n);
    pan.current.target = layout[n]!.x;
  };
  const sel = selected !== null ? items[selected] : null;

  return (
    <div ref={wrap} className="relative h-[74svh] w-full select-none overflow-hidden bg-[#F3F1EC] md:h-[86vh]" style={{ touchAction: 'pan-y' }}>
      <Canvas
        dpr={[1, 1.75]}
        camera={{ fov: mobile ? 34 : 30, position: [0, 1.4, 5], near: 0.05, far: 60 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.NeutralToneMapping;
        }}
        aria-hidden
      >
        <color attach="background" args={[WALL]} />
        <fog attach="fog" args={[WALL, 7, 18]} />
        <Room mount={mount} width={mobile ? items.length * 1.25 + 4 : 9} />
        {items.map((it, i) => (
          <Slot
            key={it.slug}
            item={it}
            pos={layout[i]!}
            mount={mount}
            active={hovered === i || selected === i}
            dim={zooming !== null && zooming !== i}
            onOver={() => setHovered(i)}
            onOut={() => setHovered((h) => (h === i ? null : h))}
            onClick={() => choose(i)}
            showLabel={!mobile}
          />
        ))}
        <CameraRig layout={layout} mobile={mobile} pan={pan} zoom={zooming} hovered={hovered} />
      </Canvas>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-between p-4">
        <p className="eyebrow text-ink/75">{mobile ? 'Swipe the wall · tap a product' : 'Hover to light · click to approach'}</p>
        <p className="eyebrow text-ink/70">Representative 3D</p>
      </div>

      {mobile && (
        <div className="absolute inset-x-0 bottom-0 p-4" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
          {sel ? (
            <div className="placard flex items-center gap-3 p-3" style={{ animation: 'rise-in .5s var(--ease-expo) both' }} key={sel.slug}>
              <div className="min-w-0 flex-1">
                <p className="eyebrow text-muted">{sel.brandName}</p>
                <p className="truncate text-[15px] font-medium">{sel.name}</p>
                <p className="mono text-[13px]">{formatPrice(sel.price)}</p>
              </div>
              <button type="button" className="btn btn-ink h-12 px-4" onClick={() => open(selected!)}>
                View <Icon name="arrow-right" size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <button type="button" className="btn btn-white h-11 px-3" aria-label="Previous product" onClick={() => step(-1)}>
                <Icon name="arrow-left" size={18} />
              </button>
              <span className="eyebrow text-ink/75">{items.length} on the wall</span>
              <button type="button" className="btn btn-white h-11 px-3" aria-label="Next product" onClick={() => step(1)}>
                <Icon name="arrow-right" size={18} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

let plasterCache: THREE.Texture | null = null;
function plasterTexture() {
  if (plasterCache) return plasterCache;
  const r = rng(3);
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#F3F1EC';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5000; i++) {
    const v = 225 + r() * 30;
    ctx.fillStyle = `rgba(${v},${v - 2},${v - 6},0.25)`;
    ctx.fillRect(r() * 256, r() * 256, 2, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(8, 4);
  plasterCache = t;
  return t;
}

function Room({ mount, width }: { mount: Mount; width: number }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    scene.environment = studioEnv(gl);
    scene.environmentIntensity = 0.5;
  }, [gl, scene]);
  const plaster = useMemo(() => plasterTexture(), []);
  return (
    <group>
      <mesh position={[width / 2 - 2, 2, -0.42]} receiveShadow>
        <planeGeometry args={[width + 12, 10]} />
        <meshStandardMaterial map={plaster} roughness={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[width / 2 - 2, -0.02, 2]}>
        <planeGeometry args={[width + 12, 10]} />
        <meshStandardMaterial color="#E9E6DE" roughness={0.6} />
      </mesh>
      {/* recessed light line along the ceiling */}
      <mesh position={[width / 2 - 2, 3.4, -0.4]}>
        <boxGeometry args={[width + 12, 0.03, 0.02]} />
        <meshBasicMaterial color={new THREE.Color(1.6, 1.58, 1.5)} />
      </mesh>
      <hemisphereLight args={['#ffffff', '#cfc8ba', 0.55]} />
      <directionalLight position={[-3, 5, 4]} intensity={1.6} />
      <directionalLight position={[4, 2, 3]} intensity={0.5} />
      {mount === 'plinths' && null}
    </group>
  );
}

function Slot({
  item,
  pos,
  mount,
  active,
  dim,
  onOver,
  onOut,
  onClick,
  showLabel,
}: {
  item: ShowItem;
  pos: THREE.Vector3;
  mount: Mount;
  active: boolean;
  dim: boolean;
  onOver: () => void;
  onOut: () => void;
  onClick: () => void;
  showLabel: boolean;
}) {
  // keyed on identity-stable fields: server re-renders (filters/sort) must not rebuild models
  const { kind, palette, options } = item;
  const model = useMemo(() => {
    const size = kind === 'boot' ? 1.0 : kind === 'glove' ? 0.92 : 0.78;
    const m = createModel(kind, palette, options, size);
    if (kind === 'glove') m.rotation.set(0, -0.2, 0);
    if (kind === 'goggles') m.rotation.set(0.1, -0.35, 0);
    if (kind === 'boot') m.rotation.set(0, -0.35, 0);
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.slug, kind]);
  useEffect(() => () => disposeDeep(model), [model]);
  const shelfShadow = useMemo(() => contactShadow(1.1, 0.5, 0.35), []);
  useEffect(
    () => () => {
      shelfShadow.geometry.dispose();
      const m = shelfShadow.material as THREE.MeshBasicMaterial;
      m.map?.dispose();
      m.dispose();
    },
    [shelfShadow],
  );
  const mats = useMemo(() => {
    const list: THREE.Material[] = [];
    model.traverse((o) => {
      const m = (o as THREE.Mesh).material;
      if (m) for (const x of Array.isArray(m) ? m : [m]) list.push(x);
    });
    return list;
  }, [model]);
  const dimK = useRef(0);
  const holder = useRef<THREE.Group>(null);
  const glow = useRef<THREE.Mesh>(null);
  const spot = useRef<THREE.SpotLight>(null);
  const k = useRef(0);
  const glowTex = useMemo(() => glowTexture('rgba(255,250,235,1)', 'rgba(255,250,235,0)'), []);
  const h = (model.userData.height as number) ?? 0.4;
  const restY = mount === 'hooks' ? -h / 2 - 0.08 : h / 2 + 0.03;

  useFrame((state, dt) => {
    k.current = THREE.MathUtils.damp(k.current, active ? 1 : 0, 6, dt);
    const g = holder.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    g.position.y = restY + k.current * 0.06 + (mount === 'hooks' ? Math.sin(t * 1.2 + pos.x) * 0.01 : 0);
    g.rotation.y = k.current * Math.sin(t * 0.8) * 0.35 + (mount === 'hooks' ? Math.sin(t * 0.9 + pos.x) * 0.05 : 0);
    if (glow.current) (glow.current.material as THREE.MeshBasicMaterial).opacity = 0.25 + k.current * 0.75;
    if (spot.current) {
      spot.current.intensity = 2 + k.current * 26;
      spot.current.target.position.copy(pos);
      spot.current.target.updateMatrixWorld();
    }
    // fade the other products only while (or after) a zoom is happening
    const goal = dim ? 1 : 0;
    if (Math.abs(dimK.current - goal) > 0.001) {
      dimK.current = THREE.MathUtils.damp(dimK.current, goal, 8, dt);
      for (const m of mats) {
        m.transparent = m.transparent || dim;
        m.opacity = 1 - dimK.current * 0.88;
      }
    }
  });

  return (
    <group position={pos}>
      {/* light pool on the wall */}
      <mesh ref={glow} position={[0, 0.25, -0.41]}>
        <planeGeometry args={[1.5, 1.5]} />
        <meshBasicMaterial map={glowTex} transparent opacity={0.25} depthWrite={false} />
      </mesh>
      <spotLight ref={spot} position={[0, 1.6, 1.2]} angle={0.42} penumbra={0.8} intensity={2} distance={5} color="#FFF6E2" />
      {mount === 'wall' && (
        <group>
          <mesh position={[0, 0, -0.2]}>
            <boxGeometry args={[1.12, 0.04, 0.44]} />
            <meshStandardMaterial color="#FFFFFF" roughness={0.4} />
          </mesh>
          <mesh position={[0, -0.022, 0.0]}>
            <boxGeometry args={[1.0, 0.006, 0.01]} />
            <meshBasicMaterial color={new THREE.Color(1.5, 1.45, 1.35)} />
          </mesh>
          <primitive object={shelfShadow} position={[0, 0.022, -0.15]} />
        </group>
      )}
      {mount === 'hooks' && (
        <group>
          <mesh position={[0, 0.02, -0.3]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.018, 0.018, 0.24, 16]} />
            <meshStandardMaterial color="#C8A451" metalness={1} roughness={0.25} />
          </mesh>
          <mesh position={[0, 0.02, -0.4]}>
            <cylinderGeometry args={[0.05, 0.05, 0.02, 24]} />
            <meshStandardMaterial color="#C8A451" metalness={1} roughness={0.3} />
          </mesh>
        </group>
      )}
      {mount === 'plinths' && (
        <group>
          <mesh position={[0, -0.32, -0.08]}>
            <boxGeometry args={[0.62, 0.64, 0.5]} />
            <meshPhysicalMaterial color="#DDF4F2" roughness={0.05} transmission={0} transparent opacity={0.45} clearcoat={1} />
          </mesh>
          <mesh position={[0, -0.66, -0.08]}>
            <boxGeometry args={[0.66, 0.04, 0.54]} />
            <meshStandardMaterial color="#FFFFFF" roughness={0.4} />
          </mesh>
        </group>
      )}
      <group
        ref={holder}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
          onOver();
        }}
        onPointerOut={() => {
          document.body.style.cursor = '';
          onOut();
        }}
        onPointerMissed={() => (document.body.style.cursor = '')}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          onClick();
        }}
      >
        <primitive object={model} />
      </group>
      {showLabel && (
        <Html position={[0, mount === 'hooks' ? -h - 0.3 : mount === 'plinths' ? -0.82 : -0.2, 0.1]} center distanceFactor={4} zIndexRange={[10, 0]}>
          <div className={`placard pointer-events-none w-[170px] px-3 py-2 transition-all duration-300 ${active ? 'scale-110 shadow-lg' : 'opacity-75'}`}>
            <p className="eyebrow text-[9px] text-muted">{item.brandName}</p>
            <p className="truncate text-[12px] font-medium leading-tight">{item.name}</p>
            <p className="mono text-[11px]">{formatPrice(item.price)}</p>
          </div>
        </Html>
      )}
    </group>
  );
}

function CameraRig({
  layout,
  mobile,
  pan,
  zoom,
  hovered,
}: {
  layout: THREE.Vector3[];
  mobile: boolean;
  pan: React.RefObject<{ x: number; target: number; v: number }>;
  zoom: number | null;
  hovered: number | null;
}) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const pointer = useThree((s) => s.pointer);
  const look = useRef(new THREE.Vector3(0, 1.3, 0));
  const pos = useRef(new THREE.Vector3(0, 1.4, 5));
  const tpV = useRef(new THREE.Vector3());
  const tlV = useRef(new THREE.Vector3());
  useFrame((_, dt) => {
    const p = pan.current!;
    p.x = THREE.MathUtils.damp(p.x, p.target, 6, dt);
    const tp = tpV.current;
    const tl = tlV.current;
    if (zoom !== null) {
      const it = layout[zoom]!;
      tp.set(it.x + 0.12, it.y + 0.12, 1.05);
      tl.set(it.x, it.y + 0.05, 0);
    } else if (mobile) {
      tp.set(p.x, 1.45, 4.7);
      tl.set(p.x, 1.22, 0);
    } else {
      const focus = hovered !== null ? layout[hovered]! : null;
      tp.set(pointer.x * 0.35 + (focus ? focus.x * 0.08 : 0), 1.32 + pointer.y * 0.15, 6.4);
      tl.set(focus ? focus.x * 0.1 : 0, 1.25, 0);
    }
    const lam = zoom !== null ? 3.2 : 4;
    pos.current.x = THREE.MathUtils.damp(pos.current.x, tp.x, lam, dt);
    pos.current.y = THREE.MathUtils.damp(pos.current.y, tp.y, lam, dt);
    pos.current.z = THREE.MathUtils.damp(pos.current.z, tp.z, lam, dt);
    look.current.x = THREE.MathUtils.damp(look.current.x, tl.x, lam, dt);
    look.current.y = THREE.MathUtils.damp(look.current.y, tl.y, lam, dt);
    look.current.z = THREE.MathUtils.damp(look.current.z, tl.z, lam, dt);
    camera.position.copy(pos.current);
    camera.lookAt(look.current);
  });
  return null;
}
