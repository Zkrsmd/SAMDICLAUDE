import * as THREE from 'three';

/**
 * Swimming's 3D ocean: a rolling water surface in front of the film. Swell from four sine trains
 * (the same sum runs on the CPU so the products bob on it), a ring that races out when the orb
 * bursts, fresnel between deep teal-steel and the sky, sun glints and foam on the crests. It thins
 * out with distance so the far water dissolves into the film behind it.
 */

/** the water line in world space (the crystal hangs at y ≈ 0.15) */
export const SEA_LEVEL = -1.25;

// direction x, direction z, wavenumber, amplitude, speed
const WAVES: [number, number, number, number, number][] = [
  [0.96, 0.28, 0.55, 0.24, 0.9],
  [-0.5, 0.86, 0.9, 0.11, 1.25],
  [0.3, -0.95, 1.6, 0.035, 1.7],
  [-0.85, -0.52, 2.5, 0.018, 2.3],
];

const GLSL_WAVES = WAVES.map(([dx, dz, k, a, s]) => `h += ${a.toFixed(3)} * sin(dot(p, vec2(${dx.toFixed(3)}, ${dz.toFixed(3)})) * ${k.toFixed(3)} + t * ${s.toFixed(3)});`).join('\n    ');

/** height of the swell at (x, z) and time t — same formula as the shader, without the break ring */
export function swell(x: number, z: number, t: number) {
  let h = 0;
  for (const [dx, dz, k, a, s] of WAVES) h += a * Math.sin((x * dx + z * dz) * k + t * s);
  return SEA_LEVEL + h;
}

const VS = /* glsl */ `
  uniform float uTime;
  uniform float uAge;
  varying vec3 vW;
  varying vec3 vN;
  varying float vH;
  float height(vec2 p, float t) {
    float h = 0.0;
    ${GLSL_WAVES}
    // the burst: a ring racing out from under the orb
    if (uAge > 0.0) {
      float r = length(p);
      float front = uAge * 3.2;
      h += 0.22 * exp(-uAge * 1.6) * exp(-pow((r - front) * 1.4, 2.0)) * cos((r - front) * 5.0);
    }
    return h;
  }
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vec2 p = w.xz;
    float t = uTime;
    float h = height(p, t);
    float e = 0.06;
    float hx = height(p + vec2(e, 0.0), t) - height(p - vec2(e, 0.0), t);
    float hz = height(p + vec2(0.0, e), t) - height(p - vec2(0.0, e), t);
    vN = normalize(vec3(-hx, 2.0 * e, -hz));
    w.y += h;
    vW = w.xyz;
    vH = h;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const FS = /* glsl */ `
  uniform float uTime;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uSky;
  uniform float uNear;
  uniform float uFar;
  varying vec3 vW;
  varying vec3 vN;
  varying float vH;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  void main() {
    vec3 V = normalize(cameraPosition - vW);
    // fine ripples on top of the swell (normal only)
    vec2 q = vW.xz * 3.2;
    vec3 d = vec3(sin(q.x * 1.3 + uTime * 2.1) + sin(q.y * 1.7 - uTime * 1.6), 0.0, cos(q.y * 1.1 + uTime * 1.9) + sin((q.x + q.y) * 0.9 + uTime * 2.6));
    vec3 N = normalize(vN + d * 0.045);
    float ndv = max(dot(N, V), 0.0);
    float fres = 0.03 + 0.97 * pow(1.0 - ndv, 5.0);
    float crest = clamp(vH * 2.6 + 0.5, 0.0, 1.0);
    vec3 body = mix(uDeep, uShallow, crest * 0.8);
    vec3 col = mix(body, uSky, fres * 0.7);
    // the light sits behind the water (toward the film): a path of glints coming at you
    vec3 L = normalize(vec3(-0.25, 0.55, -1.0));
    vec3 H = normalize(L + V);
    col += pow(max(dot(N, H), 0.0), 260.0) * 4.0 + pow(max(dot(N, H), 0.0), 40.0) * 0.12;
    // foam: broken white on the crests
    float foam = smoothstep(0.24, 0.4, vH) * smoothstep(0.35, 0.75, noise(vW.xz * 4.0 + uTime * 0.4));
    col = mix(col, vec3(0.92, 0.95, 0.98), foam * 0.85);
    float dist = length(vW - cameraPosition);
    float a = 1.0 - smoothstep(uNear, uFar, dist);
    // a little see-through: what sinks below the line is tinted, not cut off
    gl_FragColor = vec4(col, a * 0.84);
  }
`;

export function ocean() {
  const geo = new THREE.PlaneGeometry(44, 40, 200, 190);
  geo.rotateX(-Math.PI / 2);
  // from far behind the crystal to under the camera (phones stand back further: up to z ≈ 15)
  geo.translate(0, SEA_LEVEL, -3);
  const material = new THREE.ShaderMaterial({
    vertexShader: VS,
    fragmentShader: FS,
    uniforms: {
      uTime: { value: 0 },
      uAge: { value: -1 },
      // linear RGB: deep teal-steel, lit teal, the cool sky it reflects
      uDeep: { value: new THREE.Color('#05202B') },
      uShallow: { value: new THREE.Color('#14606F') },
      uSky: { value: new THREE.Color('#A9B9C9') },
      // the fade into the film, measured from the camera (the engine sets these per screen)
      uNear: { value: 12 },
      uFar: { value: 24 },
    },
    transparent: true,
    depthWrite: true,
    fog: false,
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  return mesh;
}
export type OceanMesh = ReturnType<typeof ocean>;
