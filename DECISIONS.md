# Decisions

## 2026-11-18 (evening) — igloo.inc-style opening, glacier palette
The owner pointed at igloo.inc ("exactly what I'm looking for") and lusion.co. They asked for that style, personalised per sport,
for "speed and smoothness", and for the rainbow colours to go.
- **Studied igloo.inc:**
  - A wireframe constellation of lines and tiny numbers resolves into a photoreal frozen object.
  - Portfolio items sit in rotating ice crystals with HUD callouts (`PORTFOLIO_CO_01`, `TEMP`, `CLICK TO EXPLORE`).
  - Mono corner type, a cool grey atmosphere, and zoom-blur + RGB-split transitions.
- **Studied lusion.co:** a restrained palette (white, black, one blue) and glossy physical materials.
- **SMADI take:** the *real product photo* is frozen inside a WebGL crystal (MeshPhysicalMaterial transmission, dispersion,
  procedural frost / crack / ripple normal maps), and the matter changes per sport (ice shard, cracked glass, water orb, cut gem).
  - The sport word is painted on the sky and refracted through the crystal.
  - The survey network, the wireframe → flash → materialise opening and the HUD come from igloo's grammar, with our own content.
  - This is not the rejected procedural-product 3D: only glass and environment are 3D, the products stay real photos.
- **Speed (Intel UHD laptop as the test device):**
  - A custom softbox rig replaced the RoomEnvironment PMREM: engine set-up went from 2.2 s to 0.1 s.
  - three.js is fetched as soon as the island loads.
  - The other worlds build in idle time after the intro.
  - Transmission renders at about CSS-pixel resolution.
  - An adaptive ladder steps MSAA 4→2→0, then the pixel ratio (never below 1).
  - Result: a locked 60 fps steady state on phone, landscape and desktop layouts.
  - Loader: about 4.5 s on desktop, including shader compile.
- **Palette "glacier":** frost white, steel, graphite and one cobalt accent. Holo gradients became chrome, and the drip became liquid chrome.
- The 2D canvas films from earlier the same day were removed; they are kept in git history.

## 2026-11-18 (later) — White-led homepage and coded hero films
The owner asked for a lighter, white-led palette, "cinematic-level" hero motion (crazy movement, drops, sweat, lighting)
for football, boxing, swimming and basketball, and asked whether the videos could be made purely in code. They can:
- **Hero = coded films.** Each scene is a pure function of time drawing real cut-outs in canvas 2D. It has an ACTION intro (impact frame, slow-motion
  warp, camera punch, handheld shake via value noise, white flash, anamorphic streak) and then settles into an idle EXHIBIT loop
  (float, light sweep, glints, drips, dribble, jabs).
  - Particles are closed-form (position = p0 + v·t + ½·g·t²), so frames can be scrubbed and no state is kept per frame.
  - Motion blur is drawn as ghost copies with increasing canvas blur.
  - Chosen over WebGL because it keeps the real photos crisp, needs no 3D models, works with WebGL disabled and is light on phones.
- **Cuts** whip-pan the outgoing film off-screen under racing light bands. The word slams in on each film's impact frame (`wordAt`).
- **Word** = raised white letters (pearl gradient + studio shadow + a breath of sport colour) on a slow reel. It gives drama from light, not black.
- **Drip** = holo liquid with real gooey merging (SVG blur + alpha threshold) and an feSpecularLighting gloss pass. Drops neck and let go.
  The earlier solid-colour canvas drips read as cartoon goo.
- **Cards** stay bright. The campaign photo "switches on" as a circle from the cursor (on touch: when centred), and the icon plates tilt with glare.
- **Buttons/header** went white: holo-edged white pills instead of black.

## 2026-11-18 — Pivot: real products and real media, no 3D
The owner rejected the procedural 3D look ("looks like comics") and asked for realistic product photos, AI/stock video,
real brand logos, ~20 example products per brand, a stronger opening, a floating glowing header, the name **SMADI**
with a hand in the logo, bigger stylish type and lots of effects. As a result:
- three / R3F / drei / postprocessing were removed, together with every 3D model, the hero engine and the render pipeline.
- **Catalogue**: 129 products scraped from the brands' own stores (nike, adidas, puma, venum, everlast, speedo, arena, wilson).
  Photos are cut out with an edge flood-fill key and then rembg `isnet-general-use` for gradients and floor shadows.
  - adidas blocked bulk access after 6 products. The North Face denied access and was dropped.
- **Hero**: media layers (video when supplied, AI still otherwise). Slides change with a slanted clip-path wipe plus a light sweep.
  The outgoing slide darkens and blurs, the word slams in letter by letter and the product flies in. Autoplay chapter bars pause on hover and offscreen.
- **Opening**: the holo hand mark, SMADI letters rising through masks, a live counter fed by real asset loading, two panels splitting, and a fog layer clearing.
- **Drip**: kept, but as glossy ink with a faint sport-accent sheen. Coloured grass or gold goo read as cartoonish.
- **Showroom**: a lit gallery wall of cut-outs with hover spotlight cones. Choosing a product flies its cut-out to full screen, then navigates.
- **Type**: Unbounded / Sora / Geist Mono. Unbounded is very wide, so giant words are sized in `cqw` from their letter count.

---

## Earlier (3D era, superseded)
## Composition: "The Gallery" (chosen) vs "Full-bleed campaign"
Each sport is a living installation inside one bright architectural studio. The action happens full-bleed, then the
camera resolves into an exhibit of the product in white space (**ACTION → EXHIBIT**). Chosen because it keeps the site
bright, makes the showroom wall a literal extension of the hero, and turns transitions into camera moves.

## Hero storyboard (as built)
- **Loader**: white studio, wordmark revealed by real progress (fonts + scene build + shader compile), Skip, shortened for returning visitors.
- **Fog dive**: the loader colour continues as volumetric fog in the WebGL overlay; the camera drops through it.
- **Football**: low macro camera, boot rockets across the pitch, studs rip instanced grass (trail stays flattened), soil and
  grass debris, slow-motion strike, ball squash + flight, boot rises with a 360° spin, floats in front of the giant FOOTBALL letters standing on the pitch.
- **Boxing**: bright gym, blazing window wall, backlit hooded boxer silhouette (rim-lit), jab-jab-cross, slow-motion hook,
  bag swings on chains, dust + gold sparks, white flash → Venum gloves floating; BOXING as frosted letters on the glass.
- **Swimming**: underwater, caustic pool floor with SWIMMING tiled into it, Snell's-window surface, god rays, butterfly
  swimmer silhouette crossing overhead with bubble trails, camera breaches → goggles + cap floating above water, drips, ripples, lane ropes.
- **Transitions**: one camera-space particle swarm morphs blade → dust → bubble with a directional smear and camera whip; drag scrubs it.
- **Scroll**: sticky hero (native scroll), camera cranes away; the hero bottom drips onto the white page (grass / molten gold / water).

## Technical
- **Imperative hero engine inside R3F**: the choreography (slow-motion ramps, cuts under particle cover, post-FX) needs
  frame-precise control, so scenes are plain three.js modules driven by `useFrame(…, 1)`. Showroom and product viewer are declarative R3F + drei.
- **Procedural representative models** instead of downloaded assets: no licensing risk, consistent look, tiny payload; clearly labelled.
- **Pre-rendered product images** from the same models (`npm run renders`) for fast listings and the no-WebGL path.
- **Category panels use CSS "material worlds" + renders** rather than a shared drei `<View>` canvas: equal visual identity,
  far cheaper on phones, no extra WebGL context. (Deviation from the original plan.)
- **Static CSP** (no nonce) to keep static generation; see SECURITY.md.
- **Held-back versions**: TypeScript 5.9.3 (TS 7 native compiler vs Next tooling) and ESLint 9.39 (eslint-plugin-react ≤9).

## Performance findings (measured on an Intel UHD 630, headless Edge, 390×844 @1.6 DPR)
- Grass was fill-rate bound (4.5 fps). Front-to-back instance sorting, near/far culling and smaller budgets → ~18 fps on
  that weak GPU; shadow maps only on the high tier. Runtime degrade: step 1 DPR→1, step 2 drop bloom + halve grass.
- Swimming ~35–55 fps, boxing ~15–21 fps on the same GPU (real phones' GPUs are typically stronger).

## Risk register
| Risk | Mitigation |
|---|---|
| Representative (not official) 3D | Labelled in UI + ASSET_MANIFEST; single registry swap point |
| Mobile GPU load | Tiers, runtime degrade, pause offscreen, poster fallback |
| Product facts | Only researched items marked verified; demo flags elsewhere |
| Brand logos | Typographic word-marks until official files are supplied |
