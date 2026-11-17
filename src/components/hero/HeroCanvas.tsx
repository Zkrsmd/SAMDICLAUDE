'use client';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import { HeroEngine, type EngineEvents } from '@/three/hero/engine';
import type { QualityTier } from '@/three/hero/common';

interface Props {
  quality: QualityTier;
  initial: number;
  reducedMotion: boolean;
  events: EngineEvents;
  onEngine: (e: HeroEngine) => void;
  onProgress: (p: number) => void;
  onError: () => void;
}

const DPR: Record<QualityTier, [number, number]> = { high: [1, 2], mid: [1, 1.6], low: [1, 1.25] };

/** R3F host for the imperative hero engine (frame-precise choreography + post-processing). */
export default function HeroCanvas(props: Props) {
  const [dpr, setDpr] = useState<[number, number]>(DPR[props.quality]);
  return (
    <Canvas
      dpr={dpr}
      flat
      gl={{ antialias: false, powerPreference: 'high-performance', stencil: false, alpha: false }}
      camera={{ fov: 36, near: 0.05, far: 200 }}
      style={{ position: 'absolute', inset: 0, touchAction: 'pan-y' }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener('webglcontextlost', (e) => {
          e.preventDefault();
          props.onError();
        });
      }}
      aria-hidden
    >
      <Driver {...props} onDegrade={() => setDpr([1, 1])} />
    </Canvas>
  );
}

function Driver({ quality, initial, reducedMotion, events, onEngine, onProgress, onError, onDegrade }: Props & { onDegrade: () => void }) {
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const engine = useRef<HeroEngine | null>(null);
  const cb = useRef({ events, onEngine, onProgress, onError, onDegrade });
  cb.current = { events, onEngine, onProgress, onError, onDegrade };

  useEffect(() => {
    let disposed = false;
    let e: HeroEngine;
    try {
      e = new HeroEngine(gl, quality, {
        onIndex: (i) => cb.current.events.onIndex?.(i),
        onIntroDone: (i) => cb.current.events.onIntroDone?.(i),
        onDegrade: () => cb.current.onDegrade(),
      });
    } catch {
      cb.current.onError();
      return;
    }
    e.reducedMotion = reducedMotion;
    engine.current = e;
    e.resize(gl.domElement.clientWidth || 1, gl.domElement.clientHeight || 1);
    e.init(initial, (p) => cb.current.onProgress(p))
      .then(() => {
        if (!disposed) cb.current.onEngine(e);
      })
      .catch(() => cb.current.onError());
    return () => {
      disposed = true;
      engine.current = null;
      e.dispose();
    };
    // the engine lives for the lifetime of the canvas
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl]);

  useEffect(() => {
    engine.current?.resize(size.width, size.height);
  }, [size.width, size.height]);

  useFrame((_, delta) => engine.current?.frame(delta), 1);
  return null;
}
