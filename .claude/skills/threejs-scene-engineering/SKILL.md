---
name: threejs-scene-engineering
description: Use when touching anything in src/three, the hero engine, the showroom or the product viewer — 3D models, shaders, particles, cameras, post-processing, performance tiers.
---

# Three.js scene engineering

## Architecture
- Hero: `src/three/hero/engine.ts` (imperative, hosted by R3F `useFrame(…, 1)`), scenes implement `HeroScene` in `common.ts`.
- Models: `src/three/products/registry.ts` → `createModel(kind, palette, options, size)` (normalised, centred). Swap in licensed GLTF here.
- Showroom / viewer: declarative R3F + drei; environment via `studioEnv()` (no HDRI downloads).

## Rules
- No React state per frame; mutate refs. Delta-time movement (`damp`), clamp dt.
- Cache textures (`cachedTexture`), dispose geometries/materials on unmount (`disposeDeep`, `disposeScene`).
- No per-frame allocations in hot loops; reuse vectors (beware aliasing scratch vectors across helpers).
- Budgets: grass ≤16k blades (high), sort instances front-to-back, cull near/far; shadow maps only on `high`.
- Respect quality tiers + `degrade()`; keep a non-WebGL path (posters / renders).
- Measure: `scripts/qa-shots.mjs` for frames; check fps on a weak GPU before shipping heavy effects.
- After changing a model, re-run `npm run renders` so listings match.
