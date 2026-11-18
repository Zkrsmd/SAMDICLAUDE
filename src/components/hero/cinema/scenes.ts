import {
  at,
  blade,
  bubble,
  burst,
  clamp,
  clod,
  cone,
  drawDrop,
  ease,
  glint,
  lerp,
  product,
  puff,
  ring,
  rng,
  seg,
  shadow,
  stamp,
  streak,
} from './core';

/**
 * The four hero "films", coded. Each scene is a pure function of time t (seconds since the
 * slide started): an ACTION intro (strike / hook / splash / drop, with slow motion around the
 * impact) that settles into an EXHIBIT idle loop. Units: `u` = 1% of the stage's short side.
 */

export interface Frame {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  u: number;
  /** product rest position */
  ax: number;
  ay: number;
  t: number;
  img: (key: string) => HTMLImageElement | undefined;
}
export interface Camera {
  zoom: number;
  x: number;
  y: number;
  rot: number;
  /** handheld shake amplitude in u */
  shake: number;
  /** white flash 0..1 */
  flash: number;
}
export interface Scene {
  id: string;
  /** seconds until the idle loop */
  intro: number;
  /** seconds at which the giant word slams in (synced to the impact) */
  wordAt: number;
  assets: Record<string, string>;
  camera(t: number, f: Frame): Camera;
  draw(f: Frame): void;
}

/** slow motion after an impact: `dur` real seconds play at `speed` */
const warp = (age: number, dur: number, speed: number) => (age < dur ? age * speed : dur * speed + (age - dur));
const decay = (t: number, at0: number, k: number) => (t < at0 ? 0 : Math.exp(-(t - at0) * k));
const bump = (k: number) => Math.sin(Math.PI * clamp(k));

function motes(f: Frame, seed: number, n: number, rgb: string, box: [number, number, number, number], size: [number, number], alpha: number) {
  const { ctx, u, t, ax, ay } = f;
  const r = rng(seed);
  const tex = puff(rgb);
  for (let i = 0; i < n; i++) {
    const bx = lerp(box[0], box[2], r());
    const by = lerp(box[1], box[3], r());
    const sp = 2 + r() * 5;
    const ph = r() * 100;
    const range = box[3] - box[1];
    const y = box[3] - ((((by - box[1]) + t * sp + ph) % range) + range) % range;
    const x = bx + Math.sin(t * 0.6 + ph) * 3;
    const s = lerp(size[0], size[1], r()) * u;
    const tw = 0.5 + 0.5 * Math.sin(t * 2 + ph);
    stamp(ctx, tex, ax + x * u, ay + y * u, s, s, 0, alpha * tw);
  }
}

function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rgb: string, a: number) {
  if (a <= 0.01) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${a})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

/* ================================================================ FOOTBALL */

const F_T = 0.62;
const F_INTRO = 2.7;
const fBlades = burst(11, 72, { t0: F_T, x: 0, y: 0, angle: -Math.PI / 2 - 0.55, spread: 1.9, speed: [35, 120], g: 150, life: [1.4, 2.6], size: [3, 7], jitter: 10 });
const fClods = burst(12, 36, { t0: F_T, x: 0, y: 0, angle: -Math.PI / 2 - 0.4, spread: 1.6, speed: [30, 95], g: 170, life: [1.2, 2.2], size: [1.2, 3.2], jitter: 8 });
const fDew = burst(13, 46, { t0: F_T, x: 4, y: -6, angle: -Math.PI / 2 + 0.2, spread: 2.4, speed: [45, 140], g: 160, life: [1, 1.9], size: [0.45, 1.25], jitter: 6 });
const fDust = burst(14, 22, { t0: F_T, x: 0, y: 2, angle: -Math.PI / 2, spread: Math.PI * 1.6, speed: [8, 34], g: -4, life: [1.6, 2.8], size: [14, 34], jitter: 16 });
const turf = (() => {
  const r = rng(21);
  return Array.from({ length: 90 }, () => ({ x: (r() - 0.5) * 92, h: 2.4 + r() * 5, lean: (r() - 0.5) * 0.7, ph: r() * 6 }));
})();

function bootPos(t: number, u: number, ax: number, ay: number) {
  const floor = ay + 20 * u;
  const ball = { x: ax - 24 * u, y: floor - 12 * u };
  const E = { x: ball.x + 27 * u, y: floor - 15 * u };
  if (t < F_T) {
    const k = ease.inCubic(seg(t, 0.1, F_T));
    const S = { x: ax + 80 * u, y: ay - 78 * u };
    const C = { x: ax + 46 * u, y: floor - 44 * u };
    const x = (1 - k) * (1 - k) * S.x + 2 * (1 - k) * k * C.x + k * k * E.x;
    const y = (1 - k) * (1 - k) * S.y + 2 * (1 - k) * k * C.y + k * k * E.y;
    return { x, y, rot: lerp(-1.15, -0.28, k) };
  }
  const te = warp(t - F_T, 0.75, 0.2);
  const q = ease.outCubic(clamp(te / 0.5));
  const fx = E.x - 16 * u * q;
  const fy = E.y - 12 * u * q;
  const s = ease.outBack(seg(t, 1.3, 2.55), 1.25);
  const bob = t > F_INTRO ? Math.sin((t - F_INTRO) * 1.6) * 1.4 * u : 0;
  return { x: lerp(fx, ax, s), y: lerp(fy, ay - 2 * u, s) + bob, rot: lerp(-0.28 + 0.16 * q, -0.1, s) + (t > F_INTRO ? Math.sin((t - F_INTRO) * 0.9) * 0.03 : 0) };
}

export const football: Scene = {
  id: 'football',
  intro: F_INTRO,
  wordAt: F_T + 0.05,
  assets: { boot: 'adidas-f50-hyperfast-elite-fg-soccer-cleats', ball: 'nike-control-soccer-ball' },
  camera(t) {
    const pull = ease.outCubic(seg(t, 0, F_T));
    return {
      zoom: lerp(1.14, 1, pull) + 0.07 * decay(t, F_T, 4) + (t > F_INTRO ? Math.sin((t - F_INTRO) * 0.3) * 0.012 : 0),
      x: lerp(-6, 0, pull),
      y: lerp(8, 0, pull),
      rot: 0,
      shake: 2.4 * decay(t, F_T, 5),
      flash: t > F_T ? 0.55 * (1 - seg(t, F_T, F_T + 0.3)) : 0,
    };
  },
  draw(f) {
    const { ctx, u, t, ax, ay } = f;
    const floor = ay + 20 * u;
    const C = { x: ax - 12 * u, y: floor - 3 * u };
    const te = t < F_T ? -1 : F_T + warp(t - F_T, 0.75, 0.2);

    // sun shafts + green bounce light
    cone(ctx, ax + 36 * u, ay - 95 * u, 170 * u, 62 * u, '255,206,140', 0.32, -0.38 + Math.sin(t * 0.4) * 0.02);
    glow(ctx, ax, floor, 70 * u, '93,187,63', 0.16);
    glow(ctx, ax, ay, 46 * u, '255,140,70', 0.12 + 0.12 * seg(t, F_T, 1.5));

    // turf patch with a divot that opens at the strike
    shadow(ctx, ax - 8 * u, floor + 1 * u, 96 * u, 0, 0.2);
    const bl = blade();
    for (const b of turf) {
      const x = ax - 8 * u + b.x * u;
      if (te > 0 && Math.abs(x - C.x) < 13 * u) continue;
      const hh = b.h * u;
      stamp(ctx, bl, x, floor - hh / 2 + 1 * u, hh * 0.42, hh, b.lean + Math.sin(t * 2 + b.ph) * 0.07, 0.95);
    }

    // ball: still, then struck in slow motion
    const ball = f.img('ball');
    const R = 12 * u;
    const bx0 = ax - 24 * u;
    const by0 = floor - R;
    if (te < 0) {
      shadow(ctx, bx0, floor, R * 2, 0, 0.35);
      product(ctx, ball, bx0, by0, R * 2);
    } else {
      const age = te - F_T;
      if (age < 3) {
        const vx = -95 * u;
        const vy = -82 * u;
        const g = 120 * u;
        const x = bx0 + vx * age;
        const y = by0 + vy * age + 0.5 * g * age * age;
        const sq = bump(age / 0.07) * 0.24;
        shadow(ctx, x, floor, R * 2, clamp((by0 - y) / (40 * u)), 0.3);
        product(ctx, ball, x, y, R * 2, { rot: -age * 9, sx: 1 - sq, sy: 1 + sq * 0.8, trail: { dx: -vx * 0.06, dy: -(vy + g * age) * 0.06, drot: age * 0.5, n: 6 } });
      }
    }

    // impact FX
    if (te > 0) {
      const k = seg(te, F_T, F_T + 0.6);
      ring(ctx, C.x, floor, (4 + 70 * ease.outCubic(k)) * u, 0.22, 'rgb(93,170,63)', (1 - k) * 0.7, (1.4 - k) * u);
      ring(ctx, C.x, C.y, (3 + 30 * ease.outCubic(k)) * u, 1, 'rgba(255,140,70,0.9)', (1 - k) * 0.6, 0.6 * u);
      for (const p of fDust) {
        const s = at(p, te);
        if (s) stamp(ctx, puff('150,120,88'), C.x + s.x * u, C.y + s.y * u, p.size * u * (1 + s.k * 1.6), p.size * u * (1 + s.k * 1.6) * 0.7, 0, (1 - s.k) * 0.7);
      }
      const bl2 = blade();
      for (const p of fBlades) {
        const s = at(p, te);
        if (s) stamp(ctx, bl2, C.x + s.x * u, C.y + s.y * u, p.size * u * 0.42, p.size * u, s.rot, 1 - Math.pow(s.k, 3));
      }
      const cl = clod();
      for (const p of fClods) {
        const s = at(p, te);
        if (s) stamp(ctx, cl, C.x + s.x * u, C.y + s.y * u, p.size * u, p.size * u, s.rot, 1 - Math.pow(s.k, 3));
      }
    }

    // the boot
    const boot = f.img('boot');
    const bp = bootPos(t, u, ax, ay);
    const prev = bootPos(Math.max(0, t - 0.05), u, ax, ay);
    const fast = t < F_T + 0.05 ? 1 : 0;
    const settled = t > 2.2;
    shadow(ctx, bp.x, floor, 58 * u, clamp((floor - bp.y) / (50 * u)), 0.34);
    const idle = t - F_INTRO;
    product(ctx, boot, bp.x, bp.y, 62 * u, {
      rot: bp.rot,
      trail: fast ? { dx: (prev.x - bp.x) * 2.2, dy: (prev.y - bp.y) * 2.2, drot: (prev.rot - bp.rot) * 2, n: 6 } : undefined,
      sweep: settled ? seg(((idle % 5) + 5) % 5, 0.2, 1.5) * 1.4 - 0.2 : seg(t, 1.6, 2.5) * 1.4 - 0.2,
    });

    if (te > 0) {
      for (const p of fDew) {
        const s = at(p, te);
        if (s) drawDrop(ctx, C.x + s.x * u, C.y + s.y * u, s.vx, s.vy, p.size * u, 1 - Math.pow(s.k, 4));
      }
      streak(ctx, C.x, C.y, 60 * u * (0.4 + seg(t, F_T, F_T + 0.2)), 1.6 * u, '255,150,80', bump(seg(t, F_T - 0.02, F_T + 0.55)) * 0.9);
    }
    if (t > 1.2) motes(f, 31, 22, '120,170,70', [-60, -70, 60, 20], [0.8, 2.2], 0.55 * seg(t, 1.2, 2.2));
  },
};

/* ================================================================ BOXING */

const B_T = 0.42;
const B_INTRO = 2.5;
const JAB_P = 4.8;
const JAB_AT = 2.0;
const bSweat = burst(41, 64, { t0: B_T, x: 0, y: 0, angle: Math.PI + 0.25, spread: 2.3, speed: [40, 150], g: 165, life: [1, 2], size: [0.45, 1.45], jitter: 4 });
const bSweat2 = burst(42, 26, { t0: B_T, x: 0, y: 0, angle: -0.3, spread: 1.4, speed: [30, 110], g: 165, life: [0.9, 1.7], size: [0.4, 1.1], jitter: 4 });
const bDust = burst(43, 18, { t0: B_T, x: 0, y: 0, angle: Math.PI, spread: Math.PI * 2, speed: [8, 28], g: -6, life: [1.2, 2.2], size: [8, 20], jitter: 6 });
const bJab = burst(44, 18, { t0: 0, x: 0, y: 0, angle: Math.PI + 0.3, spread: 1.8, speed: [30, 90], g: 165, life: [0.8, 1.4], size: [0.4, 1], jitter: 3 });
const GLINTS = [
  [-15, -10, 0],
  [11, -15, 1.7],
  [19, 7, 3.1],
  [-5, 13, 4.4],
];

function bagGeo(u: number, ax: number, ay: number) {
  const bw = 15 * u;
  return { px: ax + 25 * u, py: ay - 64 * u, bw, bh: bw * 5.17 };
}
function bagAngle(t: number) {
  let th = 0;
  if (t > B_T) {
    const a = warp(t - B_T, 0.6, 0.2);
    th += -0.3 * Math.exp(-0.9 * a) * Math.sin(3.3 * a);
  }
  if (t > B_INTRO) {
    const m = ((t - B_INTRO) % JAB_P + JAB_P) % JAB_P - (JAB_AT + 0.12);
    if (m > 0) th += -0.07 * Math.exp(-1.3 * m) * Math.sin(3.3 * m);
    th += Math.sin(t * 1.1) * 0.012;
  }
  return th;
}
function glovePos(t: number, u: number, ax: number, ay: number) {
  const g = bagGeo(u, ax, ay);
  const H = { x: g.px - g.bw * 0.5 - 24 * u, y: ay - 8 * u };
  const rest = { x: ax - 9 * u, y: ay + 3 * u };
  if (t < B_T) {
    const k = ease.inExpo(seg(t, 0.04, B_T));
    return { x: lerp(ax - 34 * u, H.x, k), y: lerp(ay + 34 * u, H.y, k), s: lerp(2.7, 1, k), rot: lerp(0.35, -0.05, k) };
  }
  const te = warp(t - B_T, 0.6, 0.2);
  const q = ease.outCubic(clamp(te / 0.22));
  const rx = H.x - 9 * u * q;
  const ry = H.y + 4 * u * q;
  const s = ease.outBack(seg(t, 0.95, 2.35), 1.3);
  let x = lerp(rx, rest.x, s);
  let y = lerp(ry, rest.y, s);
  let rot = lerp(-0.05, -0.08, s);
  if (t > B_INTRO) {
    const m = ((t - B_INTRO) % JAB_P + JAB_P) % JAB_P;
    const jab = bump(seg(m, JAB_AT, JAB_AT + 0.26));
    x += jab * 8 * u;
    y -= jab * 2 * u;
    rot -= jab * 0.06;
    y += Math.sin((t - B_INTRO) * 1.5) * 1.3 * u;
  }
  return { x, y, s: 1, rot };
}

export const boxing: Scene = {
  id: 'boxing',
  intro: B_INTRO,
  wordAt: B_T + 0.04,
  assets: { gloves: 'venum-giant-20-mike-tyson-pro-boxing-gloves-blackgold', bag: 'venum-vintage-heavy-bag-brown-cowhide-leather' },
  camera(t) {
    const pull = ease.outCubic(seg(t, 0, B_T));
    return {
      zoom: lerp(1.28, 1, pull) + 0.08 * decay(t, B_T, 4.5),
      x: lerp(8, 0, pull),
      y: lerp(-6, 0, pull),
      rot: lerp(-0.03, 0, pull) + 0.012 * decay(t, B_T, 3) * Math.sin(t * 30),
      shake: 3.2 * decay(t, B_T, 4.5),
      flash: t > B_T ? 0.6 * (1 - seg(t, B_T, B_T + 0.28)) : 0,
    };
  },
  draw(f) {
    const { ctx, u, t, ax, ay } = f;
    const floor = ay + 30 * u;
    const g = bagGeo(u, ax, ay);
    const th = bagAngle(t);

    // gold spotlight from the rig
    cone(ctx, ax + 6 * u, ay - 96 * u, 175 * u, 58 * u, '232,186,96', 0.42, Math.sin(t * 0.5) * 0.025);
    glow(ctx, ax, ay, 50 * u, '217,164,65', 0.2 + 0.15 * seg(t, B_T, 1.4));

    // heavy bag on its chain
    ctx.strokeStyle = 'rgba(40,36,30,0.75)';
    ctx.lineWidth = 0.5 * u;
    ctx.beginPath();
    ctx.moveTo(g.px, g.py - 120 * u);
    ctx.lineTo(g.px, g.py);
    ctx.stroke();
    const bag = f.img('bag');
    shadow(ctx, g.px - Math.sin(th) * g.bh * 0.9, floor, 26 * u, 0.6, 0.22);
    if (bag?.width) {
      ctx.save();
      ctx.translate(g.px, g.py);
      ctx.rotate(th);
      ctx.drawImage(bag, -g.bw / 2, 0, g.bw, g.bh);
      ctx.restore();
    }

    // impact FX on the bag surface
    const H = { x: g.px - g.bw * 0.5, y: ay - 8 * u };
    const te = t < B_T ? -1 : B_T + warp(t - B_T, 0.6, 0.2);
    if (te > 0) {
      const k = seg(te, B_T, B_T + 0.45);
      ring(ctx, H.x, H.y, (3 + 38 * ease.outCubic(k)) * u, 1, 'rgb(217,164,65)', (1 - k) * 0.75, (1.3 - k) * u);
      ring(ctx, H.x, H.y, (2 + 24 * ease.outCubic(k)) * u, 1, 'rgba(255,255,255,0.9)', (1 - k) * 0.8, 0.5 * u);
      for (const p of bDust) {
        const s = at(p, te);
        if (s) stamp(ctx, puff('214,170,96'), H.x + s.x * u, H.y + s.y * u, p.size * u * (1 + s.k * 1.8), p.size * u * (1 + s.k * 1.8), 0, (1 - s.k) * 0.6);
      }
    }

    // gloves
    const gp = glovePos(t, u, ax, ay);
    const pp = glovePos(Math.max(0, t - 0.045), u, ax, ay);
    const gw = 56 * u * gp.s;
    shadow(ctx, gp.x, floor, gw * 0.9, clamp((floor - gp.y) / (60 * u)), 0.3);
    const gl = f.img('gloves');
    const idle = t - B_INTRO;
    product(ctx, gl, gp.x, gp.y, gw, {
      rot: gp.rot,
      alpha: clamp(t / 0.08),
      trail: t < B_T + 0.03 ? { dx: (pp.x - gp.x) * 2.4, dy: (pp.y - gp.y) * 2.4, n: 6 } : undefined,
      sweep: t > B_INTRO ? seg(((idle % JAB_P) + JAB_P) % JAB_P, 3.0, 4.2) * 1.4 - 0.2 : seg(t, 1.5, 2.4) * 1.4 - 0.2,
    });

    // sweat in slow motion, then the idle jab spray
    if (te > 0) {
      for (const p of bSweat) {
        const s = at(p, te);
        if (s) drawDrop(ctx, H.x + s.x * u, H.y + s.y * u, s.vx, s.vy, p.size * u, 1 - Math.pow(s.k, 4));
      }
      for (const p of bSweat2) {
        const s = at(p, te);
        if (s) drawDrop(ctx, H.x + s.x * u, H.y + s.y * u, s.vx, s.vy, p.size * u, 1 - Math.pow(s.k, 4));
      }
      streak(ctx, H.x, H.y, 70 * u * (0.4 + seg(t, B_T, B_T + 0.2)), 1.8 * u, '232,170,70', bump(seg(t, B_T - 0.02, B_T + 0.5)));
    }
    if (t > B_INTRO) {
      const m = (((t - B_INTRO) % JAB_P) + JAB_P) % JAB_P - (JAB_AT + 0.13);
      for (const p of bJab) {
        const s = at(p, m);
        if (s) drawDrop(ctx, H.x + s.x * u, H.y + s.y * u, s.vx, s.vy, p.size * u, 1 - Math.pow(s.k, 4));
      }
    }

    // gold glints once the gloves rest
    if (t > 1.9) {
      const gtex = glint();
      for (const [ox, oy, ph] of GLINTS) {
        const k = Math.pow(0.5 + 0.5 * Math.sin(t * 1.9 + ph!), 6);
        stamp(ctx, gtex, gp.x + ox! * u, gp.y + oy! * u, 9 * u * k, 9 * u * k, t * 0.2, k * seg(t, 1.9, 2.4));
      }
    }
    motes(f, 47, 26, '214,170,96', [-40, -80, 50, 30], [0.7, 2], 0.7);
  },
};

/* ================================================================ SWIMMING */

const S_T = 0.55;
const S_INTRO = 2.6;
const sCrown = burst(61, 78, { t0: S_T, x: 0, y: 0, angle: -Math.PI / 2, spread: 1.7, speed: [55, 175], g: 240, life: [1.1, 2], size: [0.45, 1.6], jitter: 14 });
const sBubbles = burst(62, 40, { t0: S_T, x: 0, y: 14, angle: -Math.PI / 2, spread: 1.2, speed: [14, 46], g: -18, life: [1.4, 3], size: [0.8, 2.6], jitter: 20, dt: 0.6 });

function surfaceY(x: number, f: Frame, S: number, te: number) {
  const { u, t, ax } = f;
  let y = S + Math.sin((x / u) * 0.07 + t * 1.6) * 0.8 * u + Math.sin((x / u) * 0.13 - t * 1.1) * 0.5 * u;
  if (te > 0) {
    const age = te - S_T;
    const d = Math.abs(x - ax) / u;
    y += 5 * u * Math.exp(-1.6 * age) * Math.exp(-d / 45) * Math.sin(d * 0.22 - age * 9);
  }
  return y;
}
function gogglePos(t: number, u: number, ax: number, ay: number, S: number) {
  if (t < S_T) {
    const k = ease.inCubic(seg(t, 0.05, S_T));
    return { x: ax, y: lerp(ay - 95 * u, S + 10 * u, k), rot: lerp(-0.7, 0.18, k) };
  }
  const te = warp(t - S_T, 0.7, 0.25);
  const dive = S + 10 * u + 9 * u * ease.outCubic(clamp(te / 0.35));
  const s = ease.outBack(seg(t, 1.2, 2.45), 1.5);
  const bob = t > S_INTRO ? Math.sin((t - S_INTRO) * 1.3) * 1.2 * u : 0;
  return { x: ax, y: lerp(dive, ay - 8 * u, s) + bob, rot: lerp(0.18, -0.06, s) + (t > S_INTRO ? Math.sin((t - S_INTRO) * 0.8) * 0.025 : 0) };
}

export const swimming: Scene = {
  id: 'swimming',
  intro: S_INTRO,
  wordAt: S_T + 0.05,
  assets: { goggles: 'speedo-fastskin-speed-socket-20-mirrored-goggles-orangegold', cap: 'speedo-fastskin-cap-pink' },
  camera(t, f) {
    const pull = ease.outCubic(seg(t, 0, S_T));
    const idle = t - S_INTRO;
    return {
      zoom: lerp(1.16, 1, pull) + 0.05 * decay(t, S_T, 4),
      x: 0,
      y: lerp(-10, 0, pull) + (idle > 0 ? Math.sin(idle * 0.9) * 0.8 : 0),
      rot: idle > 0 ? Math.sin(idle * 0.6) * 0.006 : 0,
      shake: 2.2 * decay(t, S_T, 5),
      flash: t > S_T ? 0.45 * (1 - seg(t, S_T, S_T + 0.3)) : 0,
    };
    void f;
  },
  draw(f) {
    const { ctx, u, t, w, h, ax, ay } = f;
    const S = ay + 11 * u;
    const te = t < S_T ? -1 : S_T + warp(t - S_T, 0.7, 0.25);
    const gp = gogglePos(t, u, ax, ay, S);
    const gw = 60 * u;
    const gog = f.img('goggles');
    const cap = f.img('cap');

    // daylight + caustic light dancing on the wall above the pool
    cone(ctx, ax - 20 * u, ay - 100 * u, 150 * u, 55 * u, '190,240,245', 0.45, 0.25 + Math.sin(t * 0.3) * 0.03);
    glow(ctx, ax, ay - 6 * u, 48 * u, '46,197,211', 0.16);
    ctx.save();
    ctx.globalAlpha = 0.14;
    ctx.strokeStyle = 'rgb(46,170,190)';
    ctx.lineWidth = 0.35 * u;
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      for (let x = -10; x <= w + 10; x += 14) {
        const y = S - (12 + i * 7) * u + Math.sin(x / (9 * u) + t * (0.7 + i * 0.1) + i) * 2.2 * u + Math.sin(x / (4 * u) - t * 1.3 + i * 2) * 0.8 * u;
        if (x === -10) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();

    // cap surfaces behind the goggles
    const capK = ease.outBack(seg(t, 1.55, 2.6), 1.6);
    const capY = lerp(S + 26 * u, S - 6 * u, capK) + (t > S_INTRO ? Math.sin((t - S_INTRO) * 1.1 + 1) * 1 * u : 0);
    product(ctx, cap, ax - 27 * u, capY, 26 * u, { rot: -0.35 + Math.sin(t * 0.8) * 0.04 });

    // bubbles under water
    if (te > 0) {
      const bt = bubble();
      for (const p of sBubbles) {
        const s = at(p, te);
        if (s) stamp(ctx, bt, ax + (s.x + Math.sin(te * 4 + p.seed * 9) * 1.5) * u, S + s.y * u, p.size * u, p.size * u, 0, (1 - s.k) * 0.9);
      }
    }
    product(ctx, gog, gp.x, gp.y, gw, { rot: gp.rot });

    // the water body over everything below the surface
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-20, h + 20);
    for (let x = -20; x <= w + 20; x += 10) ctx.lineTo(x, surfaceY(x, f, S, te));
    ctx.lineTo(w + 20, h + 20);
    ctx.closePath();
    const wg = ctx.createLinearGradient(0, S, 0, h);
    wg.addColorStop(0, 'rgba(120,222,232,0.42)');
    wg.addColorStop(1, 'rgba(24,150,176,0.62)');
    ctx.fillStyle = wg;
    ctx.fill();
    ctx.clip();
    cone(ctx, ax + 12 * u, S - 4 * u, 90 * u, 40 * u, '255,255,255', 0.5, Math.sin(t * 0.5) * 0.06);
    ctx.globalAlpha = 0.32;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 0.32 * u;
    for (let i = 0; i < 9; i++) {
      ctx.beginPath();
      for (let x = -10; x <= w + 10; x += 12) {
        const y = S + (6 + i * 6) * u + Math.sin(x / (7 * u) + t * (0.9 + i * 0.13) + i * 1.7) * 2 * u + Math.sin(x / (3.2 * u) - t * 1.7 + i) * 0.7 * u;
        if (x === -10) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
    // surface highlight
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 0.45 * u;
    ctx.beginPath();
    for (let x = -20; x <= w + 20; x += 10) {
      const y = surfaceY(x, f, S, te);
      if (x === -20) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(20,110,130,0.25)';
    ctx.lineWidth = 0.3 * u;
    ctx.translate(0, 0.7 * u);
    ctx.stroke();
    ctx.restore();

    // the part of the goggles above water, crisp and dry
    ctx.save();
    ctx.beginPath();
    ctx.rect(-20, -h, w + 40, S - 1 * u + h);
    ctx.clip();
    shadow(ctx, gp.x, S + 2 * u, gw * 0.9, clamp((S - gp.y) / (40 * u)), 0.18);
    product(ctx, gog, gp.x, gp.y, gw, {
      rot: gp.rot,
      trail: t < S_T ? { dx: 0, dy: -18 * u * seg(t, 0.2, S_T), n: 5 } : undefined,
      sweep: t > S_INTRO ? seg((((t - S_INTRO) % 4.6) + 4.6) % 4.6, 0.4, 1.6) * 1.4 - 0.2 : seg(t, 1.8, 2.6) * 1.4 - 0.2,
    });
    ctx.restore();

    // splash crown, ripples
    if (te > 0) {
      for (let i = 0; i < 3; i++) {
        const k = seg(te, S_T + i * 0.22, S_T + i * 0.22 + 1.1);
        if (k > 0 && k < 1) ring(ctx, ax, S + 1 * u, (6 + 70 * ease.outCubic(k)) * u, 0.15, 'rgb(30,130,150)', (1 - k) * 0.5, 0.45 * u);
      }
      for (const p of sCrown) {
        const s = at(p, te);
        if (s && ax + s.x * u > -10) drawDrop(ctx, ax + s.x * u, S + s.y * u, s.vx, s.vy, p.size * u, 1 - Math.pow(s.k, 4));
      }
      streak(ctx, ax, S, 75 * u * (0.4 + seg(t, S_T, S_T + 0.2)), 1.5 * u, '120,225,235', bump(seg(t, S_T - 0.02, S_T + 0.5)) * 0.9);
    }

    // water running off the lenses once they're out
    if (t > 2.0) {
      const fade = seg(t, 2.0, 2.4);
      const tt = t - 2.0;
      [-17, 3, 19].forEach((ox, i) => {
        const period = 0.9 + i * 0.23;
        const local = (tt + i * 0.37) % period;
        const y0 = gp.y + 9 * u;
        const fallH = S - y0;
        const g = 260 * u;
        const fall = Math.sqrt((2 * Math.max(fallH, 1)) / g);
        const x = gp.x + ox * u;
        if (local < fall) {
          drawDrop(ctx, x, y0 + 0.5 * g * local * local, 0, g * local, 0.75 * u, fade);
        } else {
          const k = clamp((local - fall) / 0.6);
          ring(ctx, x, S + 0.5 * u, (1 + 9 * k) * u, 0.18, 'rgb(30,130,150)', (1 - k) * 0.6 * fade, 0.3 * u);
        }
      });
    }
  },
};

/* ================================================================ BASKETBALL */

const K_INTRO = 2.7;
const K_G = 400;
const K_E = 0.6;
/** closed-form bounce timeline in units: drop from `drop` above the rest line */
function bounces(drop: number) {
  const t1 = Math.sqrt((2 * drop) / K_G);
  const contacts = [t1];
  const speeds = [K_G * t1];
  let v = K_G * t1 * K_E;
  let tc = t1;
  for (let i = 0; i < 4; i++) {
    tc += (2 * v) / K_G;
    contacts.push(tc);
    speeds.push(v);
    v *= K_E;
  }
  return { contacts, speeds };
}
const KB = bounces(110);
const K_T = KB.contacts[0]!;
const kSweat = burst(81, 30, { t0: K_T, x: 0, y: -10, angle: -Math.PI / 2, spread: 2.6, speed: [40, 120], g: 170, life: [0.9, 1.7], size: [0.45, 1.25], jitter: 14 });
const kDust = burst(82, 16, { t0: K_T, x: 0, y: 0, angle: Math.PI, spread: Math.PI * 2, speed: [10, 30], g: -3, life: [1.2, 2.1], size: [9, 20], jitter: 14 });
const kWarp = (t: number) => (t < K_T ? t : K_T + warp(t - K_T, 0.5, 0.3));

function ballState(t: number) {
  // height above the rest line (units), plus contact squash
  const tb = kWarp(t);
  const { contacts, speeds } = KB;
  if (tb < contacts[0]!) return { hgt: 110 - 0.5 * K_G * tb * tb, sq: 0, tb };
  for (let i = 0; i < contacts.length - 1; i++) {
    const a = contacts[i]!;
    const b = contacts[i + 1]!;
    if (tb < b) {
      const v = speeds[i + 1]!;
      const dt = tb - a;
      const hgt = Math.max(0, v * dt - 0.5 * K_G * dt * dt);
      return { hgt, sq: bump(dt / 0.07) * clamp(speeds[i]! / speeds[0]!) * 0.26, tb };
    }
  }
  if (t < K_INTRO) return { hgt: 0, sq: 0, tb };
  // idle dribble
  const P = 1.45;
  const m = ((t - K_INTRO) % P) / P;
  return { hgt: 26 * 4 * m * (1 - m), sq: (bump(m / 0.05) + bump((m - 0.95) / 0.05)) * 0.12, tb };
}

export const basketball: Scene = {
  id: 'basketball',
  intro: K_INTRO,
  wordAt: K_T + 0.04,
  assets: { ball: 'wilson-evolution-game-basketball', shoe: 'nike-lebron-xxiv-stars-basketball-shoes' },
  camera(t) {
    const pull = ease.outCubic(seg(t, 0, K_T));
    return {
      zoom: lerp(1.12, 1, pull) + 0.06 * decay(t, K_T, 4.5),
      x: 0,
      y: lerp(10, 0, pull),
      rot: 0,
      shake: 2.6 * decay(t, K_T, 5),
      flash: t > K_T ? 0.5 * (1 - seg(t, K_T, K_T + 0.28)) : 0,
    };
  },
  draw(f) {
    const { ctx, u, t, w, h, ax, ay } = f;
    const F = ay + 25 * u;
    const R = 15 * u;
    const bx = ax - 17 * u;

    // hardwood floor plane + warm arena light
    const fg = ctx.createLinearGradient(0, F, 0, h);
    fg.addColorStop(0, 'rgba(214,160,104,0.20)');
    fg.addColorStop(1, 'rgba(176,118,70,0.34)');
    ctx.fillStyle = fg;
    ctx.fillRect(-w, F, w * 3, h);
    ctx.fillStyle = 'rgba(120,80,45,0.22)';
    ctx.fillRect(-w, F, w * 3, 0.25 * u);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 0.5 * u;
    ctx.beginPath();
    ctx.moveTo(-w, F + 9 * u);
    ctx.lineTo(w * 2, F + 6 * u);
    ctx.stroke();
    cone(ctx, ax - 40 * u, ay - 100 * u, 175 * u, 60 * u, '255,180,110', 0.4, -0.3 + Math.sin(t * 0.4) * 0.02);
    glow(ctx, ax, ay, 50 * u, '242,140,40', 0.14 + 0.12 * seg(t, K_T, 1.6));

    // shoe slides in behind the ball
    const sk = ease.outBack(seg(t, 1.05, 2.3), 1.3);
    const sidle = t > K_INTRO ? Math.sin((t - K_INTRO) * 1.2) * 1.2 * u : 0;
    const sx = lerp(ax + 90 * u, ax + 15 * u, sk);
    const sy = lerp(ay - 36 * u, ay - 4 * u, sk) + sidle;
    const shoe = f.img('shoe');
    if (sk > 0) {
      shadow(ctx, sx, F, 52 * u, clamp((F - sy) / (60 * u)), 0.28);
      const ps = { x: lerp(ax + 90 * u, ax + 15 * u, ease.outBack(seg(t - 0.05, 1.05, 2.3), 1.3)) };
      product(ctx, shoe, sx, sy, 56 * u, {
        rot: lerp(0.6, -0.12, sk) + (t > K_INTRO ? Math.sin((t - K_INTRO) * 0.8) * 0.025 : 0),
        trail: sk < 0.95 ? { dx: (ps.x - sx) * 2, dy: 0, n: 5 } : undefined,
        sweep: t > K_INTRO ? seg((((t - K_INTRO) % 5.2) + 5.2) % 5.2, 0.5, 1.7) * 1.4 - 0.2 : seg(t, 1.9, 2.7) * 1.4 - 0.2,
      });
    }

    // the ball: drop, bounce (first contact in slow motion), dribble
    const st = ballState(t);
    const by = F - R - st.hgt * u;
    const ball = f.img('ball');
    // reflection on the floor
    ctx.save();
    ctx.beginPath();
    ctx.rect(-w, F, w * 3, h);
    ctx.clip();
    product(ctx, ball, bx, 2 * F - by + R * st.sq, R * 2, { rot: -t * 2.2, sx: 1 + st.sq, sy: -(1 - st.sq), alpha: 0.16 });
    ctx.restore();
    shadow(ctx, bx, F, R * 2.1, clamp(st.hgt / 60), 0.4);
    const vy = st.hgt > 1 ? 1 : 0;
    product(ctx, ball, bx, by + R * st.sq, R * 2, {
      rot: -t * 2.2,
      sx: 1 + st.sq,
      sy: 1 - st.sq,
      trail: t < K_T && vy ? { dx: 0, dy: -14 * u * seg(t, 0.15, K_T), n: 5 } : undefined,
    });

    // contact FX
    KB.contacts.slice(0, 3).forEach((c, i) => {
      const k = seg(st.tb, c, c + 0.7);
      if (k > 0 && k < 1) ring(ctx, bx, F, (5 + (46 - i * 12) * ease.outCubic(k)) * u, 0.18, 'rgb(190,120,60)', (1 - k) * (0.6 - i * 0.15), 0.5 * u);
    });
    if (t > K_INTRO) {
      const m = ((t - K_INTRO) % 1.45) / 1.45;
      const k = m < 0.5 ? (m + 0.0) / 0.4 : (m - 1) / 0.4 + 1;
      void k;
      const kk = clamp(m / 0.35);
      ring(ctx, bx, F, (5 + 20 * ease.outCubic(kk)) * u, 0.18, 'rgb(190,120,60)', (1 - kk) * 0.35, 0.35 * u);
    }
    const te = st.tb;
    if (te > K_T) {
      for (const p of kDust) {
        const s = at(p, te);
        if (s) stamp(ctx, puff('190,150,110'), bx + s.x * u, F + s.y * u, p.size * u * (1 + s.k * 1.6), p.size * u * (1 + s.k * 1.6) * 0.6, 0, (1 - s.k) * 0.6);
      }
      for (const p of kSweat) {
        const s = at(p, te);
        if (s) drawDrop(ctx, bx + s.x * u, F - R + s.y * u, s.vx, s.vy, p.size * u, 1 - Math.pow(s.k, 4));
      }
      streak(ctx, bx, F, 70 * u * (0.4 + seg(t, K_T, K_T + 0.2)), 1.5 * u, '255,150,60', bump(seg(t, K_T - 0.02, K_T + 0.5)) * 0.85);
    }
    motes(f, 88, 20, '200,140,80', [-60, -80, 60, 20], [0.7, 2], 0.6 * seg(t, 1, 2));
  },
};

export const SCENES: Record<string, Scene> = { football, boxing, swimming, basketball };
