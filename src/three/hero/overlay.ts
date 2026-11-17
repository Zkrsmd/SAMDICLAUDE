import * as THREE from 'three';
import type { QualityTier } from './common';

const NOISE = /* glsl */ `
  float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
  float noise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); vec2 u = f*f*(3.0-2.0*f);
    return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y); }
  float fbm(vec2 p){ float v = 0.0; float a = 0.5; for (int i = 0; i < 5; i++){ v += a*noise(p); p *= 2.03; a *= 0.5; } return v; }
`;

/**
 * Full-screen atmosphere layer drawn on top of the active scene:
 *  - fog: the loader's white fog that tears open in wisps (intro "dive")
 *  - smear: directional streaks that hide the cut between sports
 *  - flash: white bloom flash (boxing reveal)
 */
export function createScreenOverlay() {
  const uniforms = {
    uTime: { value: 0 },
    uFog: { value: 0 },
    uSmear: { value: 0 },
    uDir: { value: 1 },
    uFlash: { value: 0 },
    uAspect: { value: 1 },
    uColA: { value: new THREE.Color('#F7F5EF') },
    uColB: { value: new THREE.Color('#F7F5EF') },
    uFogColor: { value: new THREE.Color('#F6F4EE') },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uFog, uSmear, uDir, uFlash, uAspect;
      uniform vec3 uColA, uColB, uFogColor;
      varying vec2 vUv;
      ${NOISE}
      void main(){
        vec2 uv = vUv;
        vec2 c = (uv - 0.5) * vec2(uAspect, 1.0);
        float r = length(c);
        vec3 col = vec3(0.0);
        float a = 0.0;
        // --- fog dive ---
        if (uFog > 0.001) {
          float n = fbm(c * 2.4 + vec2(0.0, uTime * 0.18));
          float n2 = fbm(c * 5.5 - vec2(uTime * 0.12, uTime * 0.05));
          float field = n * 0.65 + n2 * 0.35 + r * 0.55;
          float th = 1.15 - uFog * 1.7;
          float fogA = smoothstep(th, th + 0.32, field) * smoothstep(0.0, 0.25, uFog);
          vec3 fc = uFogColor * (0.93 + n2 * 0.1);
          fc += vec3(1.0, 0.97, 0.9) * pow(max(0.0, 1.0 - abs(uv.x * 0.8 + uv.y * 0.6 - 0.9 + uTime * 0.02) * 3.0), 3.0) * 0.06;
          col = fc; a = fogA;
        }
        // --- transition smear ---
        if (uSmear > 0.001) {
          float sx = uv.x * 1.2 - uDir * uTime * 2.6;
          float streak = fbm(vec2(sx, uv.y * 28.0)) * 0.7 + fbm(vec2(sx * 0.4, uv.y * 6.0)) * 0.5;
          float edge = uDir > 0.0 ? uv.x : 1.0 - uv.x;
          float cover = smoothstep(0.25, 0.75, streak + uSmear * 1.25 - 0.55 + (1.0 - edge) * 0.0);
          float sa = cover * smoothstep(0.0, 0.35, uSmear);
          vec3 sc = mix(uColA, uColB, smoothstep(0.3, 0.7, uv.x + (streak - 0.5) * 0.4));
          sc *= 0.92 + streak * 0.16;
          col = mix(col, sc, sa); a = max(a, sa);
        }
        // --- flash ---
        col = mix(col, vec3(1.0), uFlash); a = max(a, uFlash);
        gl_FragColor = vec4(col, a);
        #include <colorspace_fragment>
      }
    `,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  quad.renderOrder = 1000;
  return { quad, uniforms };
}

export type SwarmShape = 0 | 1 | 2 | 3; // blade, clod, dust/spark, bubble

/** Camera-space particle swarm that sweeps across the lens and morphs shape between sports. */
export function createSwarm(quality: QualityTier) {
  const count = quality === 'high' ? 1400 : quality === 'mid' ? 900 : 420;
  const geo = new THREE.InstancedBufferGeometry();
  const base = new THREE.PlaneGeometry(1, 1);
  geo.index = base.index;
  geo.setAttribute('position', base.getAttribute('position'));
  geo.setAttribute('uv', base.getAttribute('uv'));
  const seeds = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) seeds.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4);
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4));
  geo.instanceCount = count;
  const uniforms = {
    uP: { value: 0 },
    uDir: { value: 1 },
    uMorph: { value: 0 },
    uTime: { value: 0 },
    uTan: { value: Math.tan(THREE.MathUtils.degToRad(18)) },
    uAspect: { value: 1 },
    uShapeA: { value: 0 },
    uShapeB: { value: 2 },
    uColA: { value: new THREE.Color('#5E9B35') },
    uColA2: { value: new THREE.Color('#5A3F27') },
    uColB: { value: new THREE.Color('#E8D9AE') },
    uColB2: { value: new THREE.Color('#C8A451') },
    uOpacity: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    vertexShader: /* glsl */ `
      attribute vec4 aSeed;
      uniform float uP, uDir, uMorph, uTime, uTan, uAspect, uShapeA, uShapeB;
      varying vec2 vUv;
      varying float vShape;
      varying float vMix;
      varying float vAlpha;
      varying float vAlt;
      void main(){
        vUv = uv;
        float shapeSel = step(aSeed.w, uMorph);
        float shape = mix(uShapeA, uShapeB, shapeSel);
        vShape = shape;
        vMix = shapeSel;
        vAlt = step(0.55, aSeed.x);
        float depth = mix(0.35, 3.2, aSeed.y * aSeed.y);
        float halfH = depth * uTan;
        float halfW = halfH * uAspect;
        float delay = aSeed.w * 0.38;
        float pp = clamp((uP - delay) / 0.62, 0.0, 1.0);
        float ease = pp * pp * (3.0 - 2.0 * pp);
        float x = mix(-1.35, 1.35, ease) * uDir * halfW;
        x += sin(uTime * 2.0 + aSeed.x * 31.0) * 0.06 * halfW;
        float y = (aSeed.z - 0.5) * 2.3 * halfH;
        y += sin(pp * 5.0 + aSeed.x * 12.0) * 0.12 * halfH;
        if (shape > 2.5) y += pp * 0.5 * halfH * (0.5 + aSeed.x);   // bubbles rise
        if (shape < 1.5) y -= pp * pp * 0.35 * halfH;               // debris falls
        float size = (shape < 0.5 ? 0.11 : shape < 1.5 ? 0.04 : shape < 2.5 ? 0.035 : 0.06) * (0.5 + aSeed.x) * depth * 0.55;
        vec2 q = position.xy;
        float stretch = 1.0 + 3.5 * sin(pp * 3.14159) * (shape < 2.5 ? 1.0 : 0.15);
        if (shape < 0.5) q *= vec2(0.18, 1.0); else q.x *= stretch;
        float ang = shape < 0.5 ? aSeed.z * 6.28 + uTime * (aSeed.x - 0.5) * 4.0 : 0.0;
        q = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * q;
        vec3 cpos = vec3(x + q.x * size, y + q.y * size, -depth);
        vAlpha = smoothstep(0.0, 0.08, pp) * (1.0 - smoothstep(0.92, 1.0, pp));
        gl_Position = projectionMatrix * vec4(cpos, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColA, uColA2, uColB, uColB2;
      uniform float uOpacity;
      varying vec2 vUv;
      varying float vShape, vMix, vAlpha, vAlt;
      void main(){
        vec2 p = vUv - 0.5;
        float d = length(p) * 2.0;
        float a;
        if (vShape < 0.5) a = smoothstep(1.0, 0.6, length(p * vec2(1.0, 0.9)) * 2.0);        // blade
        else if (vShape < 1.5) a = smoothstep(1.0, 0.75, d);                                 // clod
        else if (vShape < 2.5) a = pow(max(0.0, 1.0 - d), 1.6);                              // dust / spark
        else a = smoothstep(1.0, 0.86, d) * (0.35 + smoothstep(0.62, 0.95, d) * 0.65)
               + smoothstep(0.3, 0.0, length(p - vec2(-0.14, 0.16)) * 2.0) * 0.8;            // bubble
        vec3 ca = mix(uColA, uColA2, vAlt);
        vec3 cb = mix(uColB, uColB2, vAlt);
        vec3 col = mix(ca, cb, vMix);
        float alpha = a * vAlpha * uOpacity;
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(col, alpha);
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 999;
  return { mesh, uniforms };
}
