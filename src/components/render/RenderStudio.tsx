'use client';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { ModelKind, ModelOptions, Palette } from '@/types/catalog';
import { createModel } from '@/three/products/registry';
import { configureRenderer, contactShadow, studioEnv, studioLights } from '@/three/lib/studio';
import { disposeDeep } from '@/three/lib/geom';
import type { RenderAngle } from '@/lib/format';

interface Job {
  slug: string;
  kind: ModelKind;
  options: ModelOptions;
  colors: { id: string; palette: Palette }[];
}

declare global {
  interface Window {
    __renderReady?: boolean;
    __render?: (slug: string, colorId: string, angle: RenderAngle, size?: number, type?: string) => Promise<string>;
    __jobs?: { slug: string; colors: string[] }[];
  }
}

const DIRS: Record<RenderAngle, [number, number, number]> = {
  hero: [0.42, 0.32, 1],
  side: [0.0, 0.06, 1],
  top: [0.25, 1.25, 0.55],
  detail: [-0.85, 0.28, 0.6],
};

export function RenderStudio({ products }: { products: Job[] }) {
  const [thumbs, setThumbs] = useState<{ key: string; src: string }[]>([]);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    configureRenderer(renderer);
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    scene.environment = studioEnv(renderer);
    scene.environmentIntensity = 0.9;
    const { group: lights } = studioLights(1);
    scene.add(lights);
    const shadowCatcher = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.ShadowMaterial({ opacity: 0.14 }));
    shadowCatcher.rotation.x = -Math.PI / 2;
    shadowCatcher.receiveShadow = true;
    scene.add(shadowCatcher);
    const blob = contactShadow(2.4, 1.3, 0.55);
    scene.add(blob);
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);

    window.__render = async (slug, colorId, angle, size = 1024, type = 'image/webp') => {
      const p = products.find((x) => x.slug === slug);
      const c = p?.colors.find((x) => x.id === colorId);
      if (!p || !c) throw new Error(`unknown ${slug}/${colorId}`);
      renderer.setSize(size, size, false);
      const model = createModel(p.kind, c.palette, p.options, 2);
      scene.add(model);
      const box = new THREE.Box3().setFromObject(model);
      const floor = box.min.y;
      shadowCatcher.position.y = floor;
      blob.position.y = floor + 0.001;
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      const dir = new THREE.Vector3(...DIRS[angle]).normalize();
      const dist = (sphere.radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2))) * (angle === 'detail' ? 0.72 : 1.0);
      camera.position.copy(sphere.center).addScaledVector(dir, dist);
      camera.lookAt(angle === 'detail' ? sphere.center.clone().add(new THREE.Vector3(0.35, 0, 0)) : sphere.center);
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
      const url = renderer.domElement.toDataURL(type, 0.9);
      scene.remove(model);
      disposeDeep(model);
      return url;
    };
    window.__jobs = products.map((p) => ({ slug: p.slug, colors: p.colors.map((c) => c.id) }));
    window.__renderReady = true;

    // Visual QA grid when opened in a browser: /render?grid=1
    const params = new URLSearchParams(window.location.search);
    if (params.get('grid')) {
      (async () => {
        const out: { key: string; src: string }[] = [];
        const only = params.get('only');
        for (const p of products) {
          if (only && !p.slug.includes(only)) continue;
          const src = await window.__render!(p.slug, p.colors[0]!.id, (params.get('angle') as RenderAngle) ?? 'hero', 384);
          out.push({ key: p.slug, src });
          setThumbs([...out]);
          await new Promise((r) => setTimeout(r, 0));
        }
      })();
    }
  }, [products]);

  return (
    <div className="container-x pt-20">
      <h1 className="eyebrow">Render studio (dev only)</h1>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {thumbs.map((t) => (
          <figure key={t.key} className="bg-stone">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={t.src} alt={t.key} className="aspect-square w-full object-contain" />
            <figcaption className="mono truncate p-1 text-[10px]">{t.key}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
