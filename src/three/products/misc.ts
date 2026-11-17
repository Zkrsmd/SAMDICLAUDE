import * as THREE from 'three';
import type { ModelOptions, Palette } from '@/types/catalog';
import { bendAroundY, lathe, loop, puffy, roundedRect, taperedTube } from '../lib/geom';
import { cachedTexture, shade } from '../lib/textures';
import { clearPlastic, fabric, leather, metal, plastic, rubber, silicone } from '../lib/materials';

const add = (g: THREE.Group, geo: THREE.BufferGeometry, mat: THREE.Material, f?: (m: THREE.Mesh) => void) => {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  f?.(m);
  g.add(m);
  return m;
};

const stripeTexture = (base: string, stripe: string, count = 3, vertical = false) =>
  cachedTexture(`stripes-${base}-${stripe}-${count}-${vertical}`, 256, 256, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = stripe;
    for (let i = 0; i < count; i++) {
      if (vertical) ctx.fillRect(((i + 0.5) / count) * w - 6, 0, 12, h);
      else ctx.fillRect(0, ((i + 0.5) / count) * h - 6, w, 12);
    }
  });

/* ---------------------------------- football ---------------------------------- */

export function createSock(pal: Palette, o: ModelOptions = {}) {
  const g = new THREE.Group();
  const leg = 0.5 + 0.6 * Number(o.length ?? 0.6);
  const curve = loop(
    [
      [0, leg, 0],
      [0, leg * 0.45, 0],
      [0.02, 0.12, 0],
      [0.14, 0.02, 0],
      [0.42, 0.0, 0],
      [0.56, 0.02, 0],
    ],
    false,
  );
  const tex = cachedTexture(`sock-${pal.primary}-${pal.secondary}`, 512, 256, (ctx, w, h) => {
    ctx.fillStyle = pal.primary;
    ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w * 0.4; x += 6) {
      ctx.fillStyle = 'rgba(0,0,0,0.06)';
      ctx.fillRect(x, 0, 2, h);
    }
    ctx.fillStyle = pal.secondary;
    ctx.fillRect(w * 0.06, 0, w * 0.04, h);
    ctx.fillRect(w * 0.12, 0, w * 0.02, h);
    // grip pads on the sole
    for (let i = 0; i < 40; i++) {
      ctx.beginPath();
      ctx.fillStyle = pal.secondary;
      ctx.arc(w * (0.72 + (i % 8) * 0.033), h * (0.38 + Math.floor(i / 8) * 0.06), 5, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  add(
    g,
    taperedTube(curve, (t) => (t < 0.05 ? 0.11 : t < 0.55 ? 0.105 - t * 0.04 : 0.085 + Math.sin((t - 0.55) * 4) * 0.012), 96, 28, {
      caps: true,
      scaleY: 1,
    }),
    fabric(pal.primary, { map: tex }),
  );
  add(g, new THREE.TorusGeometry(0.108, 0.014, 10, 48), fabric(pal.secondary), (m) => {
    m.rotation.x = Math.PI / 2;
    m.position.y = leg;
  });
  return g;
}

export function createShinguard(pal: Palette) {
  const g = new THREE.Group();
  const s = new THREE.Shape();
  s.moveTo(0, -0.5);
  s.bezierCurveTo(0.22, -0.5, 0.26, -0.2, 0.24, 0.1);
  s.bezierCurveTo(0.22, 0.36, 0.16, 0.48, 0, 0.5);
  s.bezierCurveTo(-0.16, 0.48, -0.22, 0.36, -0.24, 0.1);
  s.bezierCurveTo(-0.26, -0.2, -0.22, -0.5, 0, -0.5);
  const shell = bendAroundY(puffy(s, 0.02, 0.018, 40), 0.32);
  const tex = cachedTexture(`shin-${pal.primary}-${pal.secondary}`, 256, 512, (ctx, w, h) => {
    const gr = ctx.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, shade(pal.primary, 0.06));
    gr.addColorStop(1, shade(pal.primary, -0.06));
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = pal.secondary;
    ctx.lineWidth = 10;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(0, h * (0.35 + i * 0.08));
      ctx.lineTo(w, h * (0.25 + i * 0.08));
      ctx.stroke();
    }
  });
  add(g, shell, plastic(pal.primary, { map: tex, clearcoat: 0.9, roughness: 0.18 }));
  const back = bendAroundY(puffy(s, 0.03, 0.01, 40), 0.3);
  add(g, back, fabric(pal.accent), (m) => {
    m.position.z = -0.03;
    m.scale.setScalar(0.97);
  });
  g.rotation.y = -0.4;
  return g;
}

function tshirtShape() {
  const s = new THREE.Shape();
  s.moveTo(-0.34, -0.55);
  s.lineTo(0.34, -0.55);
  s.lineTo(0.36, 0.18);
  s.lineTo(0.56, 0.06);
  s.lineTo(0.68, 0.3);
  s.lineTo(0.38, 0.52);
  s.quadraticCurveTo(0.24, 0.56, 0.14, 0.55);
  s.quadraticCurveTo(0, 0.42, -0.14, 0.55);
  s.quadraticCurveTo(-0.24, 0.56, -0.38, 0.52);
  s.lineTo(-0.68, 0.3);
  s.lineTo(-0.56, 0.06);
  s.lineTo(-0.36, 0.18);
  s.closePath();
  return s;
}

export function createJersey(pal: Palette, o: ModelOptions = {}) {
  const g = new THREE.Group();
  const geo = puffy(tshirtShape(), 0.1, 0.07, 32);
  const tex = cachedTexture(`jersey-${pal.primary}-${pal.secondary}-${!!o.stripes}`, 512, 512, (ctx, w, h) => {
    ctx.fillStyle = pal.primary;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = pal.secondary;
    if (o.stripes) for (let i = 0; i < 5; i++) ctx.fillRect(w * (0.1 + i * 0.18), 0, w * 0.06, h);
    else {
      ctx.fillRect(0, h * 0.38, w, h * 0.05);
      ctx.fillRect(0, h * 0.46, w, h * 0.015);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1);
  });
  tex.repeat.set(1.4, 1.4);
  tex.offset.set(0.5, 0.5);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  add(g, geo, fabric(pal.primary, { map: tex, sheen: 0.5 }));
  add(g, new THREE.TorusGeometry(0.14, 0.022, 10, 48, Math.PI), fabric(pal.accent), (m) => {
    m.position.set(0, 0.55, 0.09);
    m.rotation.z = Math.PI;
    m.scale.set(1, 0.9, 1);
  });
  return g;
}

export function createShorts(pal: Palette, o: ModelOptions = {}) {
  const g = new THREE.Group();
  const jammer = !!o.jammer;
  const legLen = jammer ? 0.75 : 0.45;
  const s = new THREE.Shape();
  s.moveTo(-0.42, 0.3);
  s.lineTo(0.42, 0.3);
  s.lineTo(jammer ? 0.4 : 0.48, 0.3 - legLen);
  s.lineTo(jammer ? 0.06 : 0.04, 0.3 - legLen - 0.02);
  s.lineTo(0, 0.0);
  s.lineTo(jammer ? -0.06 : -0.04, 0.3 - legLen - 0.02);
  s.lineTo(jammer ? -0.4 : -0.48, 0.3 - legLen);
  s.closePath();
  add(g, puffy(s, 0.1, 0.05, 24), jammer ? silicone(pal.primary, { roughness: 0.35, clearcoat: 0.5 }) : fabric(pal.primary));
  add(g, puffy(roundedRect(0.88, o.band ? 0.16 : 0.08, 0.03), 0.12, 0.04), fabric(pal.secondary), (m) => {
    m.position.y = 0.3;
  });
  if (!jammer)
    for (const side of [-1, 1])
      add(g, new THREE.BoxGeometry(0.03, legLen * 0.8, 0.2), fabric(pal.accent), (m) => {
        m.position.set(side * 0.43, 0.3 - legLen / 2 - 0.02, 0);
        m.rotation.z = side * 0.12;
      });
  else
    for (const side of [-1, 1])
      add(g, new THREE.BoxGeometry(0.025, legLen * 0.9, 0.205), silicone(pal.secondary), (m) => {
        m.position.set(side * 0.4, 0.3 - legLen / 2, 0);
      });
  return g;
}

export function createCone(pal: Palette, o: ModelOptions = {}) {
  const g = new THREE.Group();
  if (o.disc) {
    const cols = [pal.primary, pal.secondary, pal.accent, pal.detail ?? pal.primary];
    cols.forEach((c, i) => {
      add(g, lathe([[0.08, 0.05], [0.18, 0.045], [0.42, 0.005], [0.44, 0]], 64), silicone(c, { roughness: 0.55, side: THREE.DoubleSide }), (m) => {
        m.position.y = i * 0.028;
        m.rotation.y = i * 0.4;
      });
    });
    g.rotation.x = 0.35;
    return g;
  }
  for (let i = 0; i < 3; i++)
    add(
      g,
      lathe([[0.03, 0.62], [0.06, 0.6], [0.2, 0.06], [0.33, 0.05], [0.33, 0.02], [0.2, 0.0]], 48),
      silicone(i === 1 ? pal.secondary : pal.primary, { roughness: 0.5, side: THREE.DoubleSide }),
      (m) => {
        m.position.y = i * 0.07;
      },
    );
  return g;
}

export function createBottle(pal: Palette, o: ModelOptions = {}) {
  const g = new THREE.Group();
  const slim = !!o.slim;
  if (slim) {
    add(g, lathe([[0, 0], [0.16, 0.02], [0.2, 0.3], [0.17, 0.62], [0.08, 0.78], [0.06, 0.8]], 48), silicone(pal.primary, { transmission: 0, transparent: true, opacity: 0.85 }));
    add(g, new THREE.CylinderGeometry(0.06, 0.07, 0.12, 24), plastic(pal.secondary), (m) => (m.position.y = 0.86));
    return g;
  }
  add(g, lathe([[0, 0], [0.24, 0.0], [0.26, 0.05], [0.25, 0.4], [0.22, 0.5], [0.25, 0.62], [0.24, 0.8], [0.2, 0.86], [0.16, 0.88]], 64), clearPlastic(pal.primary, 0.55));
  add(g, new THREE.CylinderGeometry(0.17, 0.18, 0.12, 48), plastic(pal.secondary), (m) => (m.position.y = 0.93));
  add(g, new THREE.CylinderGeometry(0.05, 0.07, 0.1, 24), plastic(pal.accent), (m) => (m.position.y = 1.04));
  add(g, new THREE.CylinderGeometry(0.255, 0.255, 0.08, 64, 1, true), plastic(pal.secondary, { side: THREE.DoubleSide }), (m) => (m.position.y = 0.45));
  return g;
}

export function createBag(pal: Palette, o: ModelOptions = {}) {
  const g = new THREE.Group();
  const shape = String(o.shape ?? 'duffel');
  if (shape === 'duffel') {
    add(g, new THREE.CapsuleGeometry(0.34, 0.9, 12, 32), fabric(pal.primary, { roughness: 0.6 }), (m) => {
      m.rotation.z = Math.PI / 2;
      m.scale.set(1, 1, 0.85);
    });
    add(g, new THREE.TorusGeometry(0.36, 0.012, 8, 64), metal(pal.secondary, 0.3), (m) => {
      m.rotation.y = Math.PI / 2;
      m.position.x = 0.0;
      m.scale.set(1, 1, 0.85);
    });
    for (const x of [-0.18, 0.18])
      add(g, new THREE.TorusGeometry(0.16, 0.022, 8, 32, Math.PI), fabric(pal.accent), (m) => {
        m.position.set(x, 0.3, 0);
      });
    add(g, new THREE.BoxGeometry(0.5, 0.18, 0.02), fabric(pal.secondary), (m) => m.position.set(0, -0.02, 0.29));
  } else if (shape === 'boot') {
    add(g, puffy(roundedRect(0.9, 0.5, 0.12), 0.3, 0.08), fabric(pal.primary));
    add(g, new THREE.TorusGeometry(0.14, 0.02, 8, 32, Math.PI), fabric(pal.accent), (m) => m.position.set(0, 0.32, 0));
    add(g, puffy(roundedRect(0.3, 0.3, 0.05), 0.01, 0.01), fabric(pal.secondary, { roughness: 0.95 }), (m) => m.position.set(0.18, 0, 0.24));
  } else {
    add(g, lathe([[0, -0.5], [0.3, -0.48], [0.36, -0.2], [0.32, 0.3], [0.18, 0.46], [0.05, 0.5]], 48), fabric(pal.primary, { roughness: 0.9 }));
    add(g, new THREE.TorusGeometry(0.2, 0.014, 8, 48), fabric(pal.secondary), (m) => {
      m.rotation.x = Math.PI / 2;
      m.position.y = 0.4;
    });
  }
  return g;
}

/* ----------------------------------- boxing ----------------------------------- */

export function createHandwrap(pal: Palette) {
  const g = new THREE.Group();
  const tex = cachedTexture(`wrap-${pal.primary}`, 256, 256, (ctx, w, h) => {
    ctx.fillStyle = pal.primary;
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 3) {
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.fillRect(0, y, w, 1);
    }
  });
  add(g, new THREE.CylinderGeometry(0.3, 0.3, 0.32, 64), fabric(pal.primary, { map: tex }));
  for (const y of [-0.16, 0.16])
    add(g, new THREE.RingGeometry(0.04, 0.3, 64, 6), fabric(shade(pal.primary, -0.1)), (m) => {
      m.rotation.x = y > 0 ? -Math.PI / 2 : Math.PI / 2;
      m.position.y = y + (y > 0 ? 0.001 : -0.001);
    });
  const tail = loop([[0.3, 0, 0.0], [0.42, -0.02, 0.22], [0.36, -0.06, 0.55], [0.18, -0.08, 0.78]], false);
  add(g, taperedTube(tail, () => 0.14, 48, 8, { scaleY: 0.08 }), fabric(pal.primary, { map: tex, side: THREE.DoubleSide }), (m) => {
    m.rotation.z = Math.PI / 2;
    m.position.y = 0;
  });
  add(g, new THREE.BoxGeometry(0.16, 0.012, 0.2), fabric(pal.secondary), (m) => m.position.set(0.18, -0.08, 0.84));
  g.rotation.x = 0.5;
  return g;
}

export function createMouthguard(pal: Palette) {
  const g = new THREE.Group();
  const s = new THREE.Shape();
  s.absarc(0, 0, 0.5, Math.PI * 0.05, Math.PI * 0.95, false);
  s.absarc(0, 0, 0.32, Math.PI * 0.95, Math.PI * 0.05, true);
  s.closePath();
  const geo = puffy(s, 0.14, 0.06, 48);
  add(g, geo, clearPlastic(pal.primary, 0.9).clone(), (m) => {
    (m.material as THREE.MeshPhysicalMaterial).opacity = 0.92;
    (m.material as THREE.MeshPhysicalMaterial).depthWrite = true;
    m.rotation.x = -Math.PI / 2 + 0.35;
  });
  add(g, puffy(roundedRect(0.18, 0.06, 0.02), 0.02, 0.01), plastic(pal.secondary), (m) => {
    m.position.set(0, 0.06, 0.48);
  });
  return g;
}

export function createHeadgear(pal: Palette) {
  const g = new THREE.Group();
  const shell = new THREE.SphereGeometry(0.5, 64, 48, Math.PI * 0.62, Math.PI * 1.76, 0, Math.PI * 0.72);
  const mat = leather(pal.primary, { side: THREE.DoubleSide });
  add(g, shell, mat, (m) => m.scale.set(1, 1.15, 1.1));
  for (const side of [-1, 1])
    add(g, new THREE.CapsuleGeometry(0.08, 0.22, 8, 16), mat, (m) => {
      m.position.set(side * 0.36, -0.12, 0.26);
      m.rotation.z = side * 0.25;
    });
  add(g, new THREE.CapsuleGeometry(0.06, 0.42, 8, 16), mat, (m) => {
    m.position.set(0, 0.36, 0.38);
    m.rotation.z = Math.PI / 2;
  });
  add(g, new THREE.TorusGeometry(0.4, 0.01, 8, 64, Math.PI * 0.9), metal(pal.secondary), (m) => {
    m.position.set(0, 0.12, 0.05);
    m.rotation.set(-0.5, 0, Math.PI * 0.05);
  });
  return g;
}

export function createHeavybag(pal: Palette) {
  const g = new THREE.Group();
  add(g, new THREE.CapsuleGeometry(0.42, 1.6, 12, 48), leather(pal.primary, { roughness: 0.5 }));
  for (const y of [-0.55, 0.55])
    add(g, new THREE.TorusGeometry(0.425, 0.02, 10, 64), metal(pal.secondary, 0.3), (m) => {
      m.rotation.x = Math.PI / 2;
      m.position.y = y;
    });
  add(g, new THREE.CylinderGeometry(0.43, 0.43, 0.28, 64, 1, true), leather(pal.secondary, { metalness: 0.6, roughness: 0.35 }), (m) => (m.position.y = 0));
  const chain = metal('#C9CCCA', 0.25);
  for (const [x, z] of [[0.3, 0], [-0.15, 0.26], [-0.15, -0.26]] as const) {
    for (let i = 0; i < 6; i++)
      add(g, new THREE.TorusGeometry(0.035, 0.009, 6, 16), chain, (m) => {
        const t = i / 6;
        m.position.set(x * (1 - t), 1.25 + t * 0.55, z * (1 - t));
        m.rotation.y = i % 2 ? Math.PI / 2 : 0;
      });
  }
  add(g, new THREE.TorusGeometry(0.06, 0.012, 8, 24), chain, (m) => m.position.set(0, 1.85, 0));
  return g;
}

export function createRope(pal: Palette) {
  const g = new THREE.Group();
  const cable = loop([[-0.4, 0.5, 0], [-0.55, -0.1, 0.1], [-0.3, -0.62, 0.05], [0.3, -0.62, -0.05], [0.55, -0.1, -0.1], [0.4, 0.5, 0]], false);
  add(g, new THREE.TubeGeometry(cable, 96, 0.012, 8), rubber(pal.primary));
  for (const x of [-0.4, 0.4])
    add(g, lathe([[0.05, 0], [0.06, 0.05], [0.055, 0.32], [0.045, 0.36], [0.03, 0.38]], 32), rubber(pal.primary, { roughness: 0.5 }), (m) => {
      m.position.set(x, 0.48, 0);
      m.rotation.z = x > 0 ? -0.35 : 0.35;
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.056, 0.04, 24), metal(pal.secondary));
      cap.position.y = 0.06;
      m.add(cap);
    });
  return g;
}

export function createMitt(pal: Palette) {
  const g = new THREE.Group();
  const geo = new THREE.SphereGeometry(0.5, 64, 48);
  const p = geo.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    let z = p.getZ(i) * 0.36;
    z -= (x * x + y * y) * 0.35;
    p.setXYZ(i, x, y * 1.2, z);
  }
  geo.computeVertexNormals();
  add(g, geo, leather(pal.primary));
  add(g, new THREE.CircleGeometry(0.2, 48), leather(pal.secondary, { metalness: 0.8, roughness: 0.3 }), (m) => (m.position.z = 0.185));
  add(g, new THREE.TorusGeometry(0.2, 0.012, 8, 64), metal(pal.secondary), (m) => (m.position.z = 0.19));
  g.rotation.y = -0.5;
  return g;
}

/* ----------------------------------- swimming ----------------------------------- */

export function createSwimsuit(pal: Palette) {
  const g = new THREE.Group();
  const s = new THREE.Shape();
  s.moveTo(-0.18, 0.62);
  s.quadraticCurveTo(-0.14, 0.4, -0.3, 0.3);
  s.quadraticCurveTo(-0.32, 0.0, -0.26, -0.3);
  s.quadraticCurveTo(-0.22, -0.48, -0.06, -0.62);
  s.lineTo(0.06, -0.62);
  s.quadraticCurveTo(0.22, -0.48, 0.26, -0.3);
  s.quadraticCurveTo(0.32, 0.0, 0.3, 0.3);
  s.quadraticCurveTo(0.14, 0.4, 0.18, 0.62);
  s.lineTo(0.12, 0.62);
  s.quadraticCurveTo(0, 0.26, -0.12, 0.62);
  s.closePath();
  const tex = stripeTexture(pal.primary, pal.secondary, 2, true);
  add(g, puffy(s, 0.08, 0.05, 32), silicone(pal.primary, { map: tex, roughness: 0.35, clearcoat: 0.5 }));
  return g;
}

export function createTowel(pal: Palette) {
  const g = new THREE.Group();
  const tex = stripeTexture(pal.primary, pal.secondary, 2);
  add(g, new THREE.CylinderGeometry(0.32, 0.32, 1, 64), fabric(pal.primary, { map: tex, roughness: 0.95, sheen: 1 }), (m) => (m.rotation.z = Math.PI / 2));
  const spiral = cachedTexture(`spiral-${pal.primary}`, 256, 256, (ctx, w, h) => {
    ctx.fillStyle = pal.primary;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 12; a += 0.05) {
      const r = 4 + a * 3.2;
      ctx.lineTo(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r);
    }
    ctx.stroke();
  });
  for (const x of [-0.5, 0.5])
    add(g, new THREE.CircleGeometry(0.32, 64), fabric(pal.primary, { map: spiral }), (m) => {
      m.position.x = x * 1.001;
      m.rotation.y = x > 0 ? Math.PI / 2 : -Math.PI / 2;
    });
  return g;
}

/* ---------------------------------- fitness / other ---------------------------------- */

export function createDumbbell(pal: Palette) {
  const g = new THREE.Group();
  for (const x of [-0.42, 0.42])
    add(g, new THREE.CylinderGeometry(0.28, 0.28, 0.32, 6), rubber(pal.primary, { roughness: 0.6 }), (m) => {
      m.rotation.z = Math.PI / 2;
      m.position.x = x;
    });
  const knurl = cachedTexture('knurl', 128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#9a9a9a';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#ffffff';
    for (let i = -h; i < w; i += 6) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + h, h);
      ctx.moveTo(i + h, 0);
      ctx.lineTo(i, h);
      ctx.stroke();
    }
  }, { srgb: false, repeat: [4, 2] });
  add(g, new THREE.CylinderGeometry(0.07, 0.07, 0.56, 32), metal(pal.secondary, 0.3, { bumpMap: knurl, bumpScale: 0.8 }), (m) => (m.rotation.z = Math.PI / 2));
  for (const x of [-0.27, 0.27])
    add(g, new THREE.CylinderGeometry(0.1, 0.1, 0.04, 32), metal(pal.secondary), (m) => {
      m.rotation.z = Math.PI / 2;
      m.position.x = x;
    });
  g.rotation.y = 0.5;
  return g;
}

export function createKettlebell(pal: Palette) {
  const g = new THREE.Group();
  const bell = new THREE.SphereGeometry(0.42, 64, 48);
  const p = bell.getAttribute('position');
  for (let i = 0; i < p.count; i++) if (p.getY(i) < -0.32) p.setY(i, -0.32);
  bell.computeVertexNormals();
  const mat = plastic(pal.primary, { roughness: 0.55, clearcoat: 0.25 });
  add(g, bell, mat);
  add(g, new THREE.TorusGeometry(0.24, 0.055, 16, 48, Math.PI), mat, (m) => {
    m.position.y = 0.38;
  });
  for (const x of [-0.24, 0.24])
    add(g, new THREE.CylinderGeometry(0.055, 0.07, 0.16, 16), mat, (m) => m.position.set(x, 0.32, 0));
  return g;
}

export function createMat(pal: Palette) {
  const g = new THREE.Group();
  add(g, new THREE.CylinderGeometry(0.22, 0.22, 1.1, 64), rubber(pal.primary, { roughness: 0.55 }), (m) => (m.rotation.z = Math.PI / 2));
  for (const x of [-0.3, 0.3])
    add(g, new THREE.TorusGeometry(0.225, 0.018, 8, 48), fabric(pal.secondary), (m) => {
      m.rotation.y = Math.PI / 2;
      m.position.x = x;
    });
  return g;
}

export function createJacket(pal: Palette) {
  const g = new THREE.Group();
  const s = tshirtShape();
  const body = puffy(s, 0.14, 0.08, 32);
  body.scale(1.05, 1.2, 1);
  add(g, body, silicone(pal.primary, { roughness: 0.55, clearcoat: 0.25 }));
  // long sleeves
  for (const side of [-1, 1])
    add(g, new THREE.CapsuleGeometry(0.11, 0.55, 8, 16), silicone(pal.primary, { roughness: 0.55 }), (m) => {
      m.position.set(side * 0.72, 0.0, 0);
      m.rotation.z = side * 0.55;
    });
  add(g, new THREE.SphereGeometry(0.24, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.6), silicone(pal.primary, { roughness: 0.6 }), (m) => {
    m.position.set(0, 0.62, -0.04);
    m.rotation.x = -0.4;
  });
  add(g, new THREE.BoxGeometry(0.018, 1.2, 0.02), metal(pal.secondary), (m) => m.position.set(0, -0.04, 0.16));
  return g;
}
