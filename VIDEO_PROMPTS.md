# SMADI — AI video & GIF prompt pack

## Rules for every clip
- **No text, no captions and no watermarks.** Logos only where they are really printed on the product.
- **Use image-to-video when a product must be accurate.** Give the tool a real photo of the product as the first frame or reference image, so the boot and gloves stay true to the real model. Tools that support this: Runway "References", Kling "Elements", Veo / Sora "image input".
- **Look:** bright, premium sports campaign, cinematic, shallow depth of field, real photography (not 3D, not cartoon), high contrast, crisp detail.
- **Formats:** make every hero clip twice, once **9:16 (1080×1920, mobile)** and once **16:9 (1920×1080, desktop)**. Make the category loops **4:5 (1080×1350)**.
- **Length and quality:** 5–8 s for hero clips, 4–6 s for loops, 24 or 30 fps, the highest quality the tool allows, MP4.
- **"Floating" loops** go on a plain warm off-white studio background (#F4F2EC). They must loop seamlessly, with the last frame matching the first.
- **Delivery:** put everything in `public/media/` with the exact file names below. I'll compress, cut and wire them in.

---

## 1. Opening (after the loader)

**`open-fog_16x9.mp4` / `open-fog_9x16.mp4`** — 4 s
> Cinematic camera dive through thick soft white studio fog. The fog slowly tears apart in wispy volumetric swirls, and warm sunlight breaks through to reveal a sunlit green football pitch below at golden hour. Bright, airy, premium, ethereal light rays, slow push forward. Photorealistic, no people, no text.

---

## 2. Football hero — orange adidas F50 Elite FG "Coral Blaze"
*Use a real product photo of the boot as the reference image.*

**`football-strike_16x9.mp4` / `football-strike_9x16.mp4`** — 6–7 s
> Ultra low-angle macro tracking shot at grass level on a sunlit professional football pitch. A footballer's leg sprints into frame. Only the lower shin and the boot are visible: a bright orange adidas F50 football boot with light blue accents and a white soleplate. The studs tear through the turf, ripping up blades of grass and small clumps of soil that fly toward the camera. The boot swings and strikes a white match football. The moment of impact is in extreme slow motion (240 fps look): the ball visibly compresses, grass and water droplets explode outward, and sun flare cuts across the frame. The ball rockets out of frame. The camera whips to follow, then slows. Hyper-realistic Nike/adidas commercial style, shallow depth of field, crisp detail on the boot texture and studs, golden-hour backlight. No face, no text.

**`football-float_16x9.mp4` / `football-float_9x16.mp4`** — 6 s seamless loop
> The same bright orange adidas F50 football boot (light blue accents, white soleplate) floats in mid-air, alone, centred, in a bright minimal studio with a warm off-white seamless background (#F4F2EC). It slowly rotates 360° with a gentle up-and-down hover. A few blades of grass and tiny soil particles drift slowly around it. Soft key light, a subtle reflection on the upper and a soft shadow far below. Premium product commercial, photorealistic, sharp, seamless loop.

**`football-hold_9x16.jpg` + `football-hold_16x9.jpg`** (optional still for the poster/fallback)
> Same floating boot, 3/4 side view, perfectly centred, studio, off-white background, photoreal product photo.

---

## 3. Boxing hero — Venum Power 2.0 boxing gloves, black and gold
*Use a real product photo of the gloves as the reference image.*

**`boxing-punch_16x9.mp4` / `boxing-punch_9x16.mp4`** — 6–7 s
> A bright, high-end industrial boxing gym in daylight: light concrete walls and large factory windows behind, with sun shafts full of floating dust. Close-up, cropped from the shoulders down so the face is never shown. A muscular boxer wearing black leather boxing gloves with gold details and a gold-trimmed wrist strap throws two fast jabs, then a powerful hook into a heavy black punching bag. The impact is in extreme slow motion: the bag dents and swings, dust and sweat spray off the leather, the camera shakes slightly, and gold highlights glint on the gloves. The boxer is backlit against the bright windows, which gives a dramatic rim light and silhouette. Cinematic sports commercial, photorealistic, shallow depth of field. No face, no text.

**`boxing-guard_16x9.mp4` / `boxing-guard_9x16.mp4`** — 4 s
> Close-up, chest-down, no face: the boxer slowly raises both black-and-gold boxing gloves into a guard position in front of the camera, breathing. Dust floats in the sun shafts behind, and the leather and gold stitching are in sharp detail. Bright gym, backlit, slow motion, photorealistic.

**`boxing-float_16x9.mp4` / `boxing-float_9x16.mp4`** — 6 s seamless loop
> A pair of black leather boxing gloves with gold trim and gold wrist straps float in mid-air, slightly crossed, slowly rotating. Bright minimal studio with a warm off-white seamless background (#F4F2EC). Tiny golden dust particles drift around them. Soft key light catches the gloss of the leather, with a soft shadow below. Luxury product commercial, photorealistic, seamless loop.

---

## 4. Swimming hero — Speedo Fastskin mirrored goggles + cap
*Use real photos of the goggles and the cap as reference images.*

**`swimming-butterfly_16x9.mp4` / `swimming-butterfly_9x16.mp4`** — 6–7 s
> An underwater camera in a bright turquoise competition pool, looking up toward the sunlit surface. Caustic light ripples across the white tiled pool floor, god rays shine down and bubbles rise. An athletic swimmer in a dark swim cap and mirrored gold racing goggles performs a powerful butterfly stroke above the camera. The body undulates in a dolphin kick, both arms sweep together, and bubble trails stream behind. The camera tilts up and breaks through the surface in slow motion, splitting the frame at the waterline, with droplets splashing toward the lens. Bright, fresh, cinematic Speedo/Olympic commercial, photorealistic. Face not recognisable, no text.

**`swimming-float_16x9.mp4` / `swimming-float_9x16.mp4`** — 6 s seamless loop
> Mirrored gold racing swim goggles and a navy silicone swim cap float just above a calm turquoise water surface in bright daylight. Water droplets drip from the goggles, creating small ripples below. The lenses reflect the sky with an iridescent sheen. A slow gentle rotation and hover. Bright, clean, premium product commercial, photorealistic, seamless loop.

---

## 5. Transitions between hero slides — 1.2–1.5 s each, full frame
Fast, high-energy wipe transitions. They are designed as opaque wipes that I play over the cut between slides; their middle frame should cover the whole screen.

**`trans-grass-to-gym.mp4`**
> An explosion of grass blades and soil clumps bursts across the camera from left to right, filling the whole frame for a split second, then clears into drifting golden dust in bright sunlight. Slow motion, photorealistic, white/bright background at the end.

**`trans-gym-to-water.mp4`**
> A burst of golden dust particles sweeps across the frame and transforms into rising water bubbles, ending in bright turquoise underwater light. Slow motion, photorealistic.

**`trans-water-to-grass.mp4`**
> A water splash crashes across the lens from left to right and clears into a sunlit green football pitch with grass blades in the foreground. Slow motion, droplets on the lens, photorealistic.

---

## 6. "Choose your arena" category cards — 4:5 (1080×1350), 4–5 s seamless loops

**`cat-football.mp4`**
> A white match football rolls slowly across a freshly mown, striped green pitch at golden hour. Low angle, grass blades in the foreground, warm sun flare. Photorealistic, seamless loop.

**`cat-boxing.mp4`**
> Black-and-gold boxing gloves hang by their laces on a hook against a light concrete wall. A slow sun shaft with floating golden dust slides across them, and the leather glints. Photorealistic, seamless loop.

**`cat-swimming.mp4`**
> Mirrored racing goggles rest at the edge of a bright turquoise pool. Caustic light ripples over them and small droplets fall into the water. Top-down view, photorealistic, seamless loop.

**`cat-running.mp4`**
> A close-up of a modern running shoe striding on a terracotta running track with white lane lines, in slow motion with light motion streaks. Bright morning sun. Photorealistic, seamless loop.

**`cat-fitness.mp4`**
> A rubber hex dumbbell and a cast-iron kettlebell on a light stone gym floor. Slow camera slide, soft daylight, a metallic sheen on the chrome handle. Photorealistic, seamless loop.

**`cat-basketball.mp4`**
> An orange basketball spins and bounces in slow motion on a polished light-wood indoor court, with court lines visible and bright skylight light. Photorealistic, seamless loop.

**`cat-outdoor.mp4`**
> A green waterproof hiking jacket and hiking boots on a rocky mountain ridge at sunrise. Mist drifts through the valley below, with a gentle slow camera push. Photorealistic, seamless loop.

---

## 7. Scroll "drip" transitions (optional) — 9:16 and 16:9, 3 s, white background
Thick liquid drips slowly down from the top edge of the frame onto a pure white background, in slow motion with glossy highlights. Make three versions:
- **`drip-grass.mp4`:** bright green liquid with tiny grass blades mixed in.
- **`drip-gold.mp4`:** molten liquid gold.
- **`drip-water.mp4`:** clear turquoise water.

For each, add: "Photorealistic macro, clean edges, nothing else in frame."

---

## 8. Logo (optional, image model — Midjourney / Ideogram / Firefly)
> Minimal premium sports brand logo mark for "SMADI": a stylised open hand, palm forward, built from bold geometric strokes. The fingers suggest speed lines or a flame, and it works in one colour. Paired with a bold, wide, futuristic sans-serif wordmark reading "SMADI". Black on white, vector style, flat, no gradients, centred, high contrast.

*(I'll also design an SVG hand logo in code, so this is only needed if you prefer an AI-designed mark.)*

---

## What I'll handle myself once you send the clips
- Official brand logo files (adidas, Nike, Puma, Venum, Speedo, arena, The North Face, Everlast, Wilson).
- About 20 real example products per brand, with cut-out photos.
- Removing all of the current 3D objects.
- The floating, glowing pill header that follows you on scroll, the SMADI name and hand logo, new fonts, holographic buttons and the full effects pass.
