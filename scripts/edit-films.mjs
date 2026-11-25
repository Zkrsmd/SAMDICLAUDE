// Cuts the hero films that are short edits (sportswear, swimming, basketball; football, martial arts, fitness and
// diving are whole clips — scripts/full-films.mjs): short, punchy edits of the raw clips — speed ramps (full speed easing into slow
// motion), a slow push-in, a punch on every cut (zoom kick, shake, a soft white flash), motion trails
// in the slow parts and a light grade — rendered in a real browser (canvas + MediaRecorder, no ffmpeg)
// and saved to public/video with poster stills, twice per sport:
//   <sport>.mp4 / .webp      landscape 1280×720 (desktop, tablets on their side)
//   <sport>-p.mp4 / -p.webp  portrait 720×1280 (phones)
//   node scripts/edit-films.mjs [sport ...]
// Sources are paths from the project root: the owner's clips in tiktok/ and the licensed Pexels clips in
// media-src/video-raw (both gitignored — only the cut films ship). `f` / `fp` is the crop focus
// (0..1 of the frame) in landscape / portrait.
import { chromium } from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const OUT = path.resolve('public/video');
fs.mkdirSync(OUT, { recursive: true });

const FOOTBALL = 'tiktok/football.mp4';
const SWIM1 = 'tiktok/swiming1.mp4';
const SWIM2 = 'tiktok/Swiming2.mp4';
const DUNK_W = 'media-src/video-raw/b/dunk-windmill.mp4';
const DUNK_O = 'media-src/video-raw/b/dunk-outdoor.mp4';

// segments: source in/out (s), playback rate (or [from, to]: a speed ramp across the first 45%),
// zoom from→to, focus, kick (punch on the cut), trail (0..1). Every in/out avoids burnt-in captions.
const EDITS = {
  // the former football film, now the Sportswear slide (football itself is a whole clip: scripts/full-films.mjs)
  sportswear: {
    segs: [
      // the red tunnel opens into sparks and a player floating over the pitch
      { src: FOOTBALL, a: 41.85, b: 43.95, rate: [1, 0.6], z: [1.0, 1.1], f: [0.5, 0.42], trail: 0.3 },
      // it rains footballs
      { src: FOOTBALL, a: 24.15, b: 26.6, rate: 0.85, z: [1.14, 1.0], f: [0.5, 0.55], kick: 1 },
      // lightning hits the pitch, the player walks out of it
      { src: FOOTBALL, a: 30.1, b: 32.7, rate: [1, 0.6], z: [1.0, 1.12], f: [0.5, 0.5], kick: 1, trail: 0.35 },
    ],
    poster: { src: FOOTBALL, t: 26.1 },
  },
  swimming: {
    segs: [
      // the dive: in through the sun
      { src: SWIM1, a: 3.0, b: 4.9, rate: [1, 0.6], z: [1.0, 1.08], f: [0.5, 0.42], fp: [0.5, 0.5] },
      // a body passes the lens (after the clip's caption is gone)
      { src: SWIM2, a: 6.2, b: 8.5, rate: 0.8, z: [1.06, 1.0], f: [0.5, 0.36], kick: 0.6 },
      { src: SWIM1, a: 5.0, b: 6.9, rate: [0.9, 0.55], z: [1.0, 1.1], f: [0.5, 0.5], kick: 0.6, trail: 0.3 },
      // under the broken surface
      { src: SWIM2, a: 13.2, b: 15.0, rate: 0.9, z: [1.0, 1.08], f: [0.5, 0.45], fp: [0.5, 0.4], kick: 0.6 },
    ],
    poster: { src: SWIM1, t: 5.6 },
  },
  basketball: {
    segs: [
      { src: DUNK_W, a: 2.4, b: 5.8, rate: [1, 0.45], z: [1.0, 1.08], f: [0.45, 0.48], trail: 0.45 },
      { src: DUNK_O, a: 0.7, b: 3.3, rate: [1, 0.45], z: [1.0, 1.1], f: [0.5, 0.4], kick: 1, trail: 0.4 },
      { src: DUNK_O, a: 10.6, b: 12.6, rate: [0.6, 0.9], z: [1.06, 1.0], f: [0.5, 0.4], kick: 0.7 },
    ],
    poster: { src: DUNK_O, t: 1.8 },
  },
};

const SIZES = [
  { suffix: '', w: 1280, h: 720 },
  { suffix: '-p', w: 720, h: 1280 },
];

// a tiny static server with Range support (video seeking needs it), confined to the project
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
  // a blank same-origin page to host the <video> elements (the canvas stays untainted)
  if (!rel) return res.writeHead(200, { 'Content-Type': 'text/html' }).end('<!doctype html><title>edit</title>');
  const file = path.resolve(ROOT, rel);
  if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file)) return res.writeHead(404).end();
  const size = fs.statSync(file).size;
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? '');
  if (m) {
    const start = m[1] ? +m[1] : 0;
    const end = m[2] ? +m[2] : size - 1;
    res.writeHead(206, { 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1 });
    fs.createReadStream(file, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes', 'Content-Length': size });
    fs.createReadStream(file).pipe(res);
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const only = process.argv.slice(2);
const b = await chromium.launch({ channel: 'msedge', args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await b.newPage({ viewport: { width: 1280, height: 1280 } });
for (const [name, edit] of Object.entries(EDITS)) {
  if (only.length && !only.includes(name)) continue;
  for (const size of SIZES) {
    await page.goto(`http://127.0.0.1:${port}/`);
    const res = await page.evaluate(
      async ({ edit, W, H, portrait }) => {
        // one <video> per source clip, all loaded before recording starts
        const vids = {};
        for (const src of new Set([...edit.segs.map((s) => s.src), edit.poster.src])) {
          const el = document.createElement('video');
          el.muted = true;
          el.preload = 'auto';
          el.src = '/' + src;
          document.body.append(el);
          await new Promise((r, j) => {
            el.addEventListener('loadeddata', r, { once: true });
            el.addEventListener('error', () => j(new Error('cannot load ' + src)), { once: true });
          });
          vids[src] = el;
        }
        let v = vids[edit.segs[0].src];
        const c = document.createElement('canvas');
        c.width = W;
        c.height = H;
        const x = c.getContext('2d');
        const focus = (sg) => (portrait ? (sg.fp ?? [0.5, 0.5]) : sg.f);
        const draw = (zoom, f, fx = {}) => {
          // object-fit: cover, then push in toward the focus point (plus the cut's shake)
          const s = Math.max(W / v.videoWidth, H / v.videoHeight) * zoom;
          const dw = v.videoWidth * s;
          const dh = v.videoHeight * s;
          const dx = Math.min(0, Math.max(W - dw, W / 2 - dw * f[0] + (fx.sx ?? 0)));
          const dy = Math.min(0, Math.max(H - dh, H / 2 - dh * f[1] + (fx.sy ?? 0)));
          x.filter = 'contrast(1.1) saturate(0.92) brightness(1.02)';
          // trail: the new frame laid over the last one, so fast motion smears in the slow parts
          x.globalAlpha = 1 - (fx.trail ?? 0);
          x.drawImage(v, dx, dy, dw, dh);
          x.globalAlpha = 1;
          x.filter = 'none';
          if (fx.flash > 0.01) {
            x.fillStyle = `rgba(240,244,250,${fx.flash.toFixed(3)})`;
            x.fillRect(0, 0, W, H);
          }
        };
        const seek = (t) => new Promise((r) => { v.addEventListener('seeked', r, { once: true }); v.currentTime = t; });
        const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
        const mime = ['video/mp4;codecs=avc1.640028', 'video/mp4;codecs=avc1.4d002a', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9'].find((m) => MediaRecorder.isTypeSupported(m));
        const stream = c.captureStream(30);
        const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2_800_000 });
        const chunks = [];
        rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
        await seek(edit.segs[0].a);
        draw(edit.segs[0].z[0], focus(edit.segs[0]));
        rec.start(250);
        for (const sg of edit.segs) {
          v = vids[sg.src];
          await seek(sg.a);
          const [r0, r1] = Array.isArray(sg.rate) ? sg.rate : [sg.rate, sg.rate];
          v.playbackRate = r0;
          await v.play();
          const t0 = performance.now();
          await new Promise((done) => {
            const tick = () => {
              const k = Math.min(1, (v.currentTime - sg.a) / (sg.b - sg.a));
              // speed ramp across the first 45% of the segment, then hold
              const rate = r0 + (r1 - r0) * ease(Math.min(1, Math.max(0, k) / 0.45));
              if (Math.abs(v.playbackRate - rate) > 0.01) v.playbackRate = Math.max(0.0625, rate);
              // the cut's punch: zoom kick + shake + flash, decaying over ~0.4 s of output
              const age = (performance.now() - t0) / 1000;
              const kick = (sg.kick ?? 0) * Math.exp(-age * 9);
              const shake = kick * (W / 90);
              const slow = 1 - Math.min(1, rate);
              draw(sg.z[0] + (sg.z[1] - sg.z[0]) * ease(Math.max(0, k)) + kick * 0.08, focus(sg), {
                sx: Math.sin(age * 83) * shake,
                sy: Math.cos(age * 67) * shake,
                flash: (sg.kick ?? 0) * Math.exp(-age * 22) * 0.6,
                trail: (sg.trail ?? 0) * slow,
              });
              if (v.currentTime >= sg.b || v.ended) return done();
              requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          });
          v.pause();
        }
        await new Promise((r) => { rec.onstop = r; rec.stop(); });
        const blob = new Blob(chunks, { type: mime });
        const b64 = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(',')[1]); fr.readAsDataURL(blob); });
        // poster: the frame at the poster time, framed like its segment
        v = vids[edit.poster.src];
        await seek(edit.poster.t);
        const sg = edit.segs.find((s) => s.src === edit.poster.src && edit.poster.t >= s.a && edit.poster.t <= s.b) ?? edit.segs[0];
        const k = (edit.poster.t - sg.a) / (sg.b - sg.a);
        draw(sg.z[0] + (sg.z[1] - sg.z[0]) * ease(k), focus(sg));
        const poster = c.toDataURL('image/webp', 0.8).split(',')[1];
        return { mime, b64, poster };
      },
      { edit, W: size.w, H: size.h, portrait: size.h > size.w },
    );
    const ext = res.mime.includes('mp4') ? 'mp4' : 'webm';
    const film = Buffer.from(res.b64, 'base64');
    fs.writeFileSync(path.join(OUT, `${name}${size.suffix}.${ext}`), film);
    fs.writeFileSync(path.join(OUT, `${name}${size.suffix}.webp`), Buffer.from(res.poster, 'base64'));
    console.log(`${name}${size.suffix}`, res.mime, `${(film.length / 1e6).toFixed(2)} MB`, `poster ${(Buffer.from(res.poster, 'base64').length / 1e3).toFixed(0)} kB`);
  }
}
await b.close();
server.close();
