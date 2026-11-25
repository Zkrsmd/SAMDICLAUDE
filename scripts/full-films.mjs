// Hero films used WHOLE, as the owner sent them — no cuts, no speed ramps (scripts/edit-films.mjs makes the
// short edits). Each clip is re-encoded at full length, in a real browser (canvas + MediaRecorder, no
// ffmpeg), in the two shapes the hero plays:
//   <name>.mp4 / .webp      landscape 1280×720 (desktop): a portrait clip sits whole in the middle, over a
//                           soft, darkened, blurred copy of itself filling the sides
//   <name>-p.mp4 / -p.webp  portrait 720×1280 (phones): the clip filling the screen
// A landscape source is the other way round (fills the desktop, cropped around `f` on phones).
//   node scripts/full-films.mjs [name ...]
// Sources: the owner's clips in tiktok/ (gitignored — only the films ship). The hero loops each film.
import { chromium } from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const OUT = path.resolve('public/video');

const FILMS = {
  football: { src: 'tiktok/football-full.mp4', poster: 0.45 },
  'martial-arts': { src: 'tiktok/martial-arts-full.mov', poster: 0.45 },
  fitness: { src: 'tiktok/gym-full.mp4', poster: 0.35 },
  sportswear: { src: 'tiktok/sportswear-full.mp4', poster: 0.4 },
  // an underwater swimmer (landscape): the diving slide
  diving: { src: 'media-src/video-raw/b/underwater.mp4', poster: 0.45, f: 0.42 },
};

const SIZES = [
  { suffix: '', w: 1280, h: 720 },
  { suffix: '-p', w: 720, h: 1280 },
];

const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
  if (!rel) return res.writeHead(200, { 'Content-Type': 'text/html' }).end('<!doctype html><title>films</title>');
  const file = path.resolve(ROOT, rel);
  if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file)) return res.writeHead(404).end();
  const type = file.toLowerCase().endsWith('.mov') ? 'video/quicktime' : 'video/mp4';
  const size = fs.statSync(file).size;
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? '');
  if (m) {
    const start = m[1] ? +m[1] : 0;
    const end = m[2] ? +m[2] : size - 1;
    res.writeHead(206, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1 });
    fs.createReadStream(file, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': size });
    fs.createReadStream(file).pipe(res);
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const only = process.argv.slice(2);
const b = await chromium.launch({ channel: 'msedge', args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await b.newPage({ viewport: { width: 1280, height: 1280 } });
for (const [name, film] of Object.entries(FILMS)) {
  if (only.length && !only.includes(name)) continue;
  for (const size of SIZES) {
    await page.goto(`http://127.0.0.1:${port}/`);
    const res = await page.evaluate(
      async ({ film, W, H }) => {
        const v = document.createElement('video');
        v.muted = true;
        v.preload = 'auto';
        v.src = '/' + film.src;
        document.body.append(v);
        await new Promise((r, j) => {
          v.addEventListener('canplaythrough', r, { once: true });
          v.addEventListener('error', () => j(new Error('cannot load ' + film.src)), { once: true });
        });
        const c = document.createElement('canvas');
        c.width = W;
        c.height = H;
        const x = c.getContext('2d');
        const vw = v.videoWidth;
        const vh = v.videoHeight;
        // the clip's shape against the frame's: fill it (cover), or sit whole on a blurred fill (contain)
        const fits = vw / vh > 1 === W / H > 1;
        const cover = Math.max(W / vw, H / vh);
        const draw = () => {
          if (fits) {
            const dw = vw * cover;
            const dh = vh * cover;
            const fx = film.f ?? 0.5;
            x.drawImage(v, Math.min(0, Math.max(W - dw, W / 2 - dw * fx)), (H - dh) / 2, dw, dh);
            return;
          }
          // blurred, darkened copy filling the frame…
          const bw = vw * cover * 1.08;
          const bh = vh * cover * 1.08;
          x.filter = 'blur(28px) brightness(0.55) saturate(1.1)';
          x.drawImage(v, (W - bw) / 2, (H - bh) / 2, bw, bh);
          x.filter = 'none';
          // …and the clip itself, whole, in the middle
          const s = Math.min(W / vw, H / vh);
          const dw = vw * s;
          const dh = vh * s;
          x.drawImage(v, (W - dw) / 2, (H - dh) / 2, dw, dh);
        };
        const mime = ['video/mp4;codecs=avc1.640028', 'video/mp4;codecs=avc1.4d002a', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9'].find((m) => MediaRecorder.isTypeSupported(m));
        const rec = new MediaRecorder(c.captureStream(30), { mimeType: mime, videoBitsPerSecond: 2_600_000 });
        const chunks = [];
        rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
        v.currentTime = 0;
        await new Promise((r) => v.addEventListener('seeked', r, { once: true }));
        draw();
        rec.start(250);
        await v.play();
        // every frame of the clip, start to end (requestVideoFrameCallback: no missed frames)
        await new Promise((done) => {
          const tick = () => {
            draw();
            if (v.ended) return done();
            v.requestVideoFrameCallback(tick);
          };
          v.addEventListener('ended', () => done(), { once: true });
          v.requestVideoFrameCallback(tick);
        });
        draw();
        await new Promise((r) => {
          rec.onstop = r;
          rec.stop();
        });
        const blob = new Blob(chunks, { type: mime });
        const b64 = await new Promise((r) => {
          const fr = new FileReader();
          fr.onload = () => r(String(fr.result).split(',')[1]);
          fr.readAsDataURL(blob);
        });
        v.currentTime = v.duration * film.poster;
        await new Promise((r) => v.addEventListener('seeked', r, { once: true }));
        draw();
        const poster = c.toDataURL('image/webp', 0.8).split(',')[1];
        return { mime, b64, poster, duration: v.duration };
      },
      { film, W: size.w, H: size.h },
    );
    const ext = res.mime.includes('mp4') ? 'mp4' : 'webm';
    const out = Buffer.from(res.b64, 'base64');
    fs.writeFileSync(path.join(OUT, `${name}${size.suffix}.${ext}`), out);
    fs.writeFileSync(path.join(OUT, `${name}${size.suffix}.webp`), Buffer.from(res.poster, 'base64'));
    console.log(`${name}${size.suffix}`, res.mime, `${res.duration.toFixed(1)} s`, `${(out.length / 1e6).toFixed(2)} MB`);
  }
}
await b.close();
server.close();
