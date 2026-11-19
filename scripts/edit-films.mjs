// Cuts the hero background films from the licensed raw clips in media-src/video-raw (Pexels License):
// speed ramps into slow motion at the moment of impact, a push-in zoom, a little contrast — rendered
// in a real browser (canvas + MediaRecorder, no ffmpeg needed) and saved to public/video with a
// poster still.   node scripts/edit-films.mjs [sport ...]
import { chromium } from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const RAW = path.resolve('media-src/video-raw');
const OUT = path.resolve('public/video');
fs.mkdirSync(OUT, { recursive: true });

// segments: source in/out (s), playback rate, zoom from→to, zoom focus (0..1 of the frame), poster at
const EDITS = {
  football: {
    segs: [
      { a: 0.0, b: 1.5, rate: 1, z: [1.0, 1.05], f: [0.5, 0.62] },
      { a: 1.5, b: 3.1, rate: 0.3, z: [1.05, 1.2], f: [0.5, 0.7] },
      { a: 3.1, b: 5.8, rate: 0.85, z: [1.2, 1.0], f: [0.5, 0.65] },
    ],
    poster: 2.3,
  },
  boxing: {
    segs: [
      { a: 6.5, b: 9.6, rate: 0.6, z: [1.04, 1.16], f: [0.42, 0.42] },
      { a: 16.6, b: 19.6, rate: 0.6, z: [1.16, 1.04], f: [0.55, 0.4] },
      { a: 24.0, b: 27.6, rate: 0.5, z: [1.0, 1.14], f: [0.48, 0.45] },
    ],
    poster: 8.0,
  },
  swimming: {
    segs: [{ a: 0.0, b: 13.1, rate: 0.8, z: [1.0, 1.12], f: [0.5, 0.4] }],
    poster: 6.0,
  },
  basketball: {
    segs: [
      { a: 3.6, b: 6.4, rate: 1, z: [1.0, 1.05], f: [0.5, 0.5] },
      { a: 6.4, b: 8.7, rate: 0.35, z: [1.05, 1.2], f: [0.5, 0.62] },
      { a: 8.7, b: 10.9, rate: 1, z: [1.2, 1.0], f: [0.5, 0.55] },
    ],
    poster: 7.2,
  },
};

// a tiny static server with Range support (video seeking needs it)
const server = http.createServer((req, res) => {
  const file = path.join(RAW, path.basename(decodeURIComponent(req.url.split('?')[0])));
  if (!fs.existsSync(file)) return res.writeHead(404).end();
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
const page = await b.newPage({ viewport: { width: 960, height: 540 } });
for (const [name, edit] of Object.entries(EDITS)) {
  if (only.length && !only.includes(name)) continue;
  await page.goto(`http://127.0.0.1:${port}/${name}.mp4`);
  const res = await page.evaluate(async (edit) => {
    const v = document.querySelector('video');
    v.pause();
    v.muted = true;
    await new Promise((r) => (v.readyState >= 2 ? r() : v.addEventListener('loadeddata', r, { once: true })));
    const W = 960;
    const H = 540;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const x = c.getContext('2d');
    const draw = (zoom, f) => {
      // object-fit: cover, then push in toward the focus point
      const s = Math.max(W / v.videoWidth, H / v.videoHeight) * zoom;
      const dw = v.videoWidth * s;
      const dh = v.videoHeight * s;
      const dx = Math.min(0, Math.max(W - dw, W / 2 - dw * f[0]));
      const dy = Math.min(0, Math.max(H - dh, H / 2 - dh * f[1]));
      x.filter = 'contrast(1.12) saturate(0.92) brightness(0.97)';
      x.drawImage(v, dx, dy, dw, dh);
    };
    const seek = (t) => new Promise((r) => { v.addEventListener('seeked', r, { once: true }); v.currentTime = t; });
    const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
    const mime = ['video/mp4;codecs=avc1.4d002a', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9'].find((m) => MediaRecorder.isTypeSupported(m));
    const stream = c.captureStream(30);
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 1_700_000 });
    const chunks = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    await seek(edit.segs[0].a);
    draw(edit.segs[0].z[0], edit.segs[0].f);
    rec.start(250);
    for (const sg of edit.segs) {
      await seek(sg.a);
      v.playbackRate = sg.rate;
      await v.play();
      await new Promise((done) => {
        const tick = () => {
          const k = Math.min(1, (v.currentTime - sg.a) / (sg.b - sg.a));
          draw(sg.z[0] + (sg.z[1] - sg.z[0]) * ease(Math.max(0, k)), sg.f);
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
    // poster: the frame at the poster time, with the slow-motion push-in applied
    await seek(edit.poster);
    const sg = edit.segs.find((s) => edit.poster >= s.a && edit.poster <= s.b) ?? edit.segs[0];
    const k = (edit.poster - sg.a) / (sg.b - sg.a);
    draw(sg.z[0] + (sg.z[1] - sg.z[0]) * ease(k), sg.f);
    const poster = c.toDataURL('image/webp', 0.82).split(',')[1];
    return { mime, b64, poster };
  }, edit);
  const ext = res.mime.includes('mp4') ? 'mp4' : 'webm';
  fs.writeFileSync(path.join(OUT, `${name}.${ext}`), Buffer.from(res.b64, 'base64'));
  fs.writeFileSync(path.join(OUT, `${name}.webp`), Buffer.from(res.poster, 'base64'));
  console.log(name, res.mime, `${(Buffer.from(res.b64, 'base64').length / 1e6).toFixed(2)} MB`, `poster ${(Buffer.from(res.poster, 'base64').length / 1e3).toFixed(0)} kB`);
}
await b.close();
server.close();
