// The first-visit intro's flip-book (src/components/layout/Intro.tsx): small 3:4 cards cut from ancient
// Greek sport art — vase paintings of boxers, wrestlers, pankration and a chariot race, bronze and
// marble athletes — public-domain photos from museum open-access collections (sources and licences:
// public/intro/CREDITS.md; the originals are kept in media-src/intro-art/, not committed).
// Rendered in a real browser (canvas), no image tools needed.
//   node scripts/intro-cards.mjs      → public/intro/NN-<name>.webp (360×480)
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve('media-src/intro-art');
const OUT = path.resolve('public/intro');
const W = 360;
const H = 480;
// the crop: centre (cx, cy) and height (hf), as fractions of the photo; the width follows (3:4).
// In the order they flip by: a vase painting, then a sculpture.
const CARDS = [
  { name: 'boxers', src: 'met-254611-boxers-pelike.jpg', cx: 0.63, cy: 0.47, hf: 0.52 },
  { name: 'bronze-boxer', src: 'cma-152256-bronze-boxer.jpg', cx: 0.5, cy: 0.42, hf: 0.79 },
  { name: 'wrestlers', src: 'met-247221-wrestlers-skyphos.jpg', cx: 0.5, cy: 0.52, hf: 0.34 },
  { name: 'spearman', src: 'cma-457393-spearman.jpg', cx: 0.5, cy: 0.52, hf: 0.9 },
  { name: 'pankration', src: 'met-249067-pankration-amphora.jpg', cx: 0.4, cy: 0.38, hf: 0.45 },
  { name: 'jumper', src: 'cma-152841-jumping-weights.jpg', cx: 0.47, cy: 0.5, hf: 0.82 },
  { name: 'chariot', src: 'cma-148008-chariot-hydria.jpg', cx: 0.5, cy: 0.51, hf: 0.32 },
  { name: 'marble-athlete', src: 'met-250541-marble-athlete.jpg', cx: 0.47, cy: 0.5, hf: 1 },
  { name: 'boxers-jug', src: 'cma-95292-boxers-oinochoe.jpg', cx: 0.6, cy: 0.53, hf: 0.4 },
  { name: 'bronze-athlete', src: 'cma-133313-bronze-athlete.jpg', cx: 0.5, cy: 0.45, hf: 0.8 },
  { name: 'boxer-fragment', src: 'met-254947-boxer-fragment.jpg', cx: 0.68, cy: 0.17, hf: 0.3 },
];

fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) if (f.endsWith('.webp')) fs.unlinkSync(path.join(OUT, f));
const b = await chromium.launch({ channel: 'msedge' });
const p = await b.newPage();
let i = 0;
for (const card of CARDS) {
  i++;
  const data = 'data:image/jpeg;base64,' + fs.readFileSync(path.join(SRC, card.src)).toString('base64');
  const webp = await p.evaluate(
    async ({ data, W, H, cx, cy, hf }) => {
      const img = new Image();
      img.src = data;
      await img.decode();
      // the crop box in the photo (3:4), kept inside it
      let sh = img.height * hf;
      let sw = (sh * W) / H;
      if (sw > img.width) {
        sw = img.width;
        sh = (sw * H) / W;
      }
      const sx = Math.min(img.width - sw, Math.max(0, img.width * cx - sw / 2));
      const sy = Math.min(img.height - sh, Math.max(0, img.height * cy - sh / 2));
      const c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      const x = c.getContext('2d');
      x.imageSmoothingQuality = 'high';
      x.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
      return c.toDataURL('image/webp', 0.8).split(',')[1];
    },
    { data, W, H, cx: card.cx, cy: card.cy, hf: card.hf },
  );
  const file = path.join(OUT, `${String(i).padStart(2, '0')}-${card.name}.webp`);
  fs.writeFileSync(file, Buffer.from(webp, 'base64'));
  console.log(path.basename(file), `${(fs.statSync(file).size / 1024).toFixed(1)} KB`);
}
await b.close();
