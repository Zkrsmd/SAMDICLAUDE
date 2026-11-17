# Asset manifest

No third-party images, videos, 3D models or HDRIs were downloaded. Everything visual is generated in code.

| Asset | Source | Licence | Use | Placeholder? |
|---|---|---|---|---|
| Product 3D models (boot, gloves, goggles, cap, ball, socks, shin guards, apparel, bags, fins, weights…) | Procedural, `src/three/products/*` | Project code | Hero, showrooms, product viewer | **Yes — representative**, not official manufacturer geometry |
| Athletes (boxer, swimmer) | Procedural rig, `src/three/athletes/rig.ts` | Project code | Hero scenes (stylised silhouettes) | Yes — replace with licensed mocap/footage if desired |
| Product images `public/renders/*.webp` (272 files) | Rendered from the models by `scripts/render-products.mjs` | Project output | Listings, galleries, posters, no-WebGL fallback | **Yes — representative renders** |
| Grass, water, caustics, fog, concrete, plaster, leather/knit textures | Shaders + canvas textures in code | Project code | Scenes | No |
| Studio reflections | three.js `RoomEnvironment` (procedural) | MIT (three.js) | All 3D | No |
| Fonts: Big Shoulders, Instrument Sans, Geist Mono | Google Fonts via `next/font` (self-hosted at build) | SIL OFL 1.1 | Typography | No |
| Brand names (adidas, Nike, Puma, Venum, Speedo, arena, The North Face, Everlast, Wilson) | Typed as text | Trademarks of their owners | "Brands we carry" | Yes — use official logo files only with permission from each brand's retailer programme |
| Wordmark "YOUR BRAND" + icon | `src/components/ui/Wordmark.tsx`, `src/app/icon.svg` | Project code | Brand | Yes — awaiting final brand |

## Missing licensed assets (recommended before launch)
- Official product photography and/or licensed 3D models (manufacturer B2B/retailer media portals).
- Optional: licensed athlete footage or motion capture for the boxer and swimmer scenes.
- Official brand logo files for the brand showcase.
