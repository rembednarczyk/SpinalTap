import type { Vec3 } from "@seki/core";
import { type ChunkDef, WORLD_CHUNKS } from "@seki/sim";
import { Color3, Constants, type Mesh, type Scene, ShaderMaterial } from "../babylon";
import { type LightingRig, mixHex } from "../npr/lighting";
import { prng } from "./city-kit-data";
import { sinkToMesh } from "./dressing";
import { isBuilding } from "./dressing-plan";
import { MeshSink, type Rgba, type Vec } from "./mesh-sink";

/**
 * The city beyond the streets you can walk (ADR-0027, W10 and C2): low-detail stand-ins for
 * chunks that are streamed out, rings of towers around the whole map, megabuildings on the
 * horizon and holo-ads on them. Four meshes in all, none of them in the moon shadow.
 *
 * Encoding (far shader): colour rgb = tint, colour a = fog scale; uv2.x = seed (+2 = no
 * windows), uv2.y = chunk slot (0 = always drawn, k + 1 = drawn while chunk k is streamed out).
 * Lights: uv = position on the quad, uv2.x = seed, uv2.y = kind (0 ad, 1 strip, 2 beacon).
 */

export interface Rect {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

export interface FarCityPlan {
  /** World-fixed: chunk stand-ins, filler blocks and the tower rings. */
  readonly world: MeshSink;
  /** Lights on the rings: ads, neon strips, beacons. */
  readonly worldLights: MeshSink;
  /** Around the camera: megabuildings at the horizon. */
  readonly horizon: MeshSink;
  readonly horizonLights: MeshSink;
  /** Chunk ids in slot order (slot k + 1). */
  readonly chunks: readonly string[];
  readonly bounds: Rect;
}

/** Most chunk slots the far shader can hide. */
export const FAR_CHUNK_SLOTS = 16;

const AD_COLORS = ["#ff2e88", "#00e5ff", "#ffb000", "#39ff8a", "#b46cff", "#ff4040"] as const;
const TOWER_TINTS = ["#8a93a8", "#7d8aa3", "#948aa8", "#7f98a0", "#9a9cad"] as const;

const hex = (h: string, a: number): Rgba => {
  const n = parseInt(h.slice(1, 7), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, a];
};

export const unionBounds = (chunks: readonly ChunkDef[]): Rect => ({
  minX: Math.min(...chunks.map((c) => c.bounds.minX)),
  maxX: Math.max(...chunks.map((c) => c.bounds.maxX)),
  minZ: Math.min(...chunks.map((c) => c.bounds.minZ)),
  maxZ: Math.max(...chunks.map((c) => c.bounds.maxZ)),
});

const distToRect = (x: number, z: number, r: Rect) => Math.hypot(Math.max(r.minX - x, 0, x - r.maxX), Math.max(r.minZ - z, 0, z - r.maxZ));

/** A quad standing on an axis-aligned face, facing `n` (one of ±x, ±z): centre, width, height. */
const faceQuad = (sink: MeshSink, c: Vec, n: { x: number; z: number }, w: number, h: number, color: Rgba, uv2: [number, number]) => {
  const ux = -n.z;
  const uz = n.x;
  sink.quad(
    [
      { x: c.x - ux * w * 0.5, y: c.y - h / 2, z: c.z - uz * w * 0.5 },
      { x: c.x + ux * w * 0.5, y: c.y - h / 2, z: c.z + uz * w * 0.5 },
      { x: c.x + ux * w * 0.5, y: c.y + h / 2, z: c.z + uz * w * 0.5 },
      { x: c.x - ux * w * 0.5, y: c.y + h / 2, z: c.z - uz * w * 0.5 },
    ],
    { x: n.x, y: 0, z: n.z },
    color,
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    uv2,
  );
};

/** The side of an axis-aligned box at (x, z) that faces the point (tx, tz). */
const sideTowards = (x: number, z: number, tx: number, tz: number): { x: number; z: number } => {
  const dx = tx - x;
  const dz = tz - z;
  return Math.abs(dx) > Math.abs(dz) ? { x: Math.sign(dx) || 1, z: 0 } : { x: 0, z: Math.sign(dz) || 1 };
};

interface Tower {
  readonly x: number;
  readonly z: number;
  readonly w: number;
  readonly d: number;
  readonly h: number;
}

/** A tower with optional setbacks, its lights facing `towards`. */
const addTower = (geo: MeshSink, lights: MeshSink, t: Tower, rand: () => number, fog: number, towards: { x: number; z: number }, adChance: number) => {
  const seed = rand();
  const tint = hex(TOWER_TINTS[Math.floor(rand() * TOWER_TINTS.length)] ?? "#8a93a8", fog);
  let y = 0;
  let w = t.w;
  let d = t.d;
  let h = t.h;
  const tiers = t.h > 70 && rand() < 0.6 ? 2 : 1;
  for (let k = 0; k < tiers; k++) {
    const part = k === tiers - 1 ? h : h * (0.55 + rand() * 0.2);
    geo.box({ x: t.x, y: y + part / 2, z: t.z }, w, part, d, tint, { uv2: [seed, 0], bottom: false });
    y += part;
    h -= part;
    w *= 0.62 + rand() * 0.2;
    d *= 0.62 + rand() * 0.2;
  }
  const n = sideTowards(t.x, t.z, towards.x, towards.z);
  const half = n.x !== 0 ? t.w / 2 : t.d / 2;
  const across = n.x !== 0 ? t.d : t.w;
  const face = { x: t.x + n.x * (half + 0.6), z: t.z + n.z * (half + 0.6) };
  // A neon strip up one corner of the face.
  if (rand() < 0.4) {
    const color = hex(AD_COLORS[Math.floor(rand() * AD_COLORS.length)] ?? "#00e5ff", 1);
    const off = (rand() < 0.5 ? -1 : 1) * (across / 2 - 0.8);
    const sh = Math.min(y, t.h) * (0.5 + rand() * 0.45);
    faceQuad(lights, { x: face.x - n.z * off, y: sh / 2 + 2, z: face.z + n.x * off }, n, 0.9, sh, color, [rand(), 1]);
  }
  // A holo-ad on the face looking into the city.
  if (rand() < adChance && t.h > 30) {
    const color = hex(AD_COLORS[Math.floor(rand() * AD_COLORS.length)] ?? "#ff2e88", 1);
    const aw = across * (0.5 + rand() * 0.25);
    const ah = aw * (1.2 + rand() * 0.8);
    const ay = Math.min(t.h * 0.75, Math.max(ah / 2 + 10, t.h * (0.45 + rand() * 0.25)));
    faceQuad(lights, { x: face.x + n.x * 1.5, y: ay, z: face.z + n.z * 1.5 }, n, aw, ah, color, [rand(), 0]);
  }
  // Aircraft warning beacon on the tall ones.
  if (t.h > 60) {
    const top = y + 1.2;
    const c = { x: t.x, y: top, z: t.z };
    for (const nn of [
      { x: 1, z: 0 },
      { x: 0, z: 1 },
    ]) {
      faceQuad(lights, c, nn, 1.6, 1.6, hex("#ff3030", 1), [rand(), 2]);
    }
  }
};

/**
 * Plans the far city around the chunks of the map: deterministic (fixed seeds), from the chunk
 * table only, so a district the content adds gets its stand-in and the rings move outwards.
 */
export const planFarCity = (chunks: readonly ChunkDef[] = WORLD_CHUNKS): FarCityPlan => {
  const world = new MeshSink();
  const worldLights = new MeshSink();
  const horizon = new MeshSink();
  const horizonLights = new MeshSink();
  const ids = chunks.slice(0, FAR_CHUNK_SLOTS).map((c) => c.id);
  const B = unionBounds(chunks);
  const cx = (B.minX + B.maxX) / 2;
  const cz = (B.minZ + B.maxZ) / 2;

  // 1. Stand-ins for streamed-out chunks: their bulk as plain blocks, windows on buildings.
  ids.forEach((_, k) => {
    const chunk = chunks[k];
    if (!chunk) return;
    for (const p of chunk.props) {
      const v = p.view;
      if (v.kind !== "block" || !p.solid || v.rungs || v.slope) continue;
      if (v.size.y < 2.5 || Math.min(v.size.x, v.size.z) < 0.3) continue;
      const building = isBuilding(v);
      const tint: Rgba = v.material === "glass" ? [0.62, 0.7, 0.86, 0.85] : v.material === "metal" ? [0.6, 0.62, 0.68, 0.85] : [0.7, 0.7, 0.74, 0.85];
      world.box(p.center, v.size.x, v.size.y, v.size.z, tint, { uv2: [building ? (k * 0.137) % 1 : 2.5, k + 1], bottom: false });
    }
  });

  const rand = prng(0x0c17e);
  // 2. Filler blocks inside the map's bounds where no chunk is (between districts).
  const step = 26;
  for (let x = B.minX + step / 2; x < B.maxX; x += step) {
    for (let z = B.minZ + step / 2; z < B.maxZ; z += step) {
      const clear = Math.min(...chunks.map((c) => distToRect(x, z, c.bounds)));
      if (clear < 16) continue;
      const size = Math.min(step - 4, (clear - 8) * 2);
      const h = 18 + rand() * 40;
      addTower(world, worldLights, { x, z, w: size, d: size * (0.7 + rand() * 0.3), h }, rand, 0.7, { x: cx, z: cz }, 0.12);
    }
  }

  // 3. Rings of towers around the bounds, taller and sparser further out.
  const rings = [
    { margin: 20, depth: 18, wMin: 10, wMax: 22, hMin: 26, hMax: 70, fog: 0.62, ads: 0.2 },
    { margin: 52, depth: 30, wMin: 16, wMax: 32, hMin: 45, hMax: 120, fog: 0.5, ads: 0.22 },
    { margin: 100, depth: 50, wMin: 24, wMax: 46, hMin: 70, hMax: 170, fog: 0.4, ads: 0.25 },
  ] as const;
  // Without chunks (the map preview, ADR-0044) there are no bounds to ring: only the horizon.
  for (const r of chunks.length > 0 ? rings : []) {
    const e = { minX: B.minX - r.margin, maxX: B.maxX + r.margin, minZ: B.minZ - r.margin, maxZ: B.maxZ + r.margin };
    const edges: readonly [number, number, number, number][] = [
      [e.minX, e.minZ, e.maxX, e.minZ],
      [e.maxX, e.minZ, e.maxX, e.maxZ],
      [e.maxX, e.maxZ, e.minX, e.maxZ],
      [e.minX, e.maxZ, e.minX, e.minZ],
    ];
    for (const [x0, z0, x1, z1] of edges) {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const dx = (x1 - x0) / len;
      const dz = (z1 - z0) / len;
      // Outward normal of this edge (the bounds lie to its left when walking it).
      const ox = dz;
      const oz = -dx;
      let s = rand() * 6;
      while (s < len) {
        const w = r.wMin + rand() * (r.wMax - r.wMin);
        const out = rand() * r.depth + w / 2;
        const x = x0 + dx * (s + w / 2) + ox * out;
        const z = z0 + dz * (s + w / 2) + oz * out;
        const h = r.hMin + rand() * rand() * (r.hMax - r.hMin);
        if (distToRect(x, z, B) > r.margin * 0.7 + w * 0.5) {
          addTower(world, worldLights, { x, z, w, d: w * (0.6 + rand() * 0.6), h }, rand, r.fog, { x: cx, z: cz }, r.ads);
        }
        s += w + 2 + rand() * 6;
      }
    }
  }

  // 4. Megabuildings around the camera at the horizon, with setbacks, a spire and big ads.
  const MEGAS = 9;
  for (let i = 0; i < MEGAS; i++) {
    const a = (i / MEGAS) * Math.PI * 2 + rand() * 0.35;
    const dist = 200 + rand() * 40;
    const x = Math.sin(a) * dist;
    const z = Math.cos(a) * dist;
    const w = 48 + rand() * 40;
    const d = 40 + rand() * 30;
    const h = 160 + rand() * 140;
    addTower(horizon, horizonLights, { x, z, w, d, h: h * 0.55 }, rand, 0.22, { x: 0, z: 0 }, 0.5);
    // Upper tiers and the spire.
    const seed = rand();
    const tint = hex(TOWER_TINTS[i % TOWER_TINTS.length] ?? "#8a93a8", 0.22);
    horizon.box({ x, y: h * 0.55 + (h * 0.3) / 2, z }, w * 0.7, h * 0.3, d * 0.7, tint, { uv2: [seed, 0], bottom: false });
    horizon.box({ x, y: h * 0.85 + (h * 0.15) / 2, z }, w * 0.42, h * 0.15, d * 0.42, tint, { uv2: [seed, 0], bottom: false });
    horizon.box({ x, y: h + 12, z }, 2.4, 24, 2.4, tint, { uv2: [2.5, 0], bottom: false });
    const n = sideTowards(x, z, 0, 0);
    const half = n.x !== 0 ? w * 0.35 : d * 0.35;
    const across = n.x !== 0 ? d * 0.7 : w * 0.7;
    const color = hex(AD_COLORS[(i * 2 + 1) % AD_COLORS.length] ?? "#00e5ff", 1);
    faceQuad(horizonLights, { x: x + n.x * (half + 2), y: h * 0.68, z: z + n.z * (half + 2) }, n, across * 0.62, h * 0.16, color, [rand(), 0]);
    faceQuad(horizonLights, { x, y: h + 24.5, z }, { x: 1, z: 0 }, 2.2, 2.2, hex("#ff3030", 1), [rand(), 2]);
  }
  return { world, worldLights, horizon, horizonLights, chunks: ids, bounds: B };
};

const FAR_VERTEX = /* glsl */ `
precision highp float;
attribute vec3 position;
attribute vec3 normal;
attribute vec4 color;
attribute vec2 uv2;
uniform mat4 world;
uniform mat4 viewProjection;
uniform float hidden[${FAR_CHUNK_SLOTS}];
varying vec3 vWorldPos;
varying vec3 vLocal;
varying vec3 vNormal;
varying vec4 vColor;
varying float vSeed;
void main(void) {
  float hide = 0.0;
  for (int i = 0; i < ${FAR_CHUNK_SLOTS}; i++) {
    if (abs(float(i + 1) - uv2.y) < 0.5) hide = hidden[i];
  }
  vec4 wp = world * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vLocal = position;
  vNormal = normal;
  vColor = color;
  vSeed = uv2.x;
  gl_Position = viewProjection * wp;
  // A chunk in view draws itself: its stand-in collapses out of the clip volume.
  if (hide > 0.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}
`;

/**
 * Far towers as flat cel silhouettes: darker towards the top, lifted by the street glow at the
 * foot, one lighter side, roofs catching the haze, lit windows in whole floors, and haze that
 * thins with a per-piece scale (stand-ins match the street fog, the horizon barely fades).
 */
const FAR_FRAGMENT = /* glsl */ `
precision highp float;
varying vec3 vWorldPos;
varying vec3 vLocal;
varying vec3 vNormal;
varying vec4 vColor;
varying float vSeed;
uniform vec3 cameraPosition;
uniform vec3 silhouette;
uniform vec3 haze;
uniform vec3 fogColor;
uniform float fogDensity;
uniform float lit;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(void) {
  vec3 n = normalize(vNormal);
  float seed = fract(vSeed);
  float h = vLocal.y;
  vec3 col = silhouette * vColor.rgb * 1.6;
  col = mix(haze * 0.9, col, 0.25 + 0.75 * smoothstep(0.0, 30.0, h));
  col *= abs(n.x) > 0.5 ? 1.0 : 0.78;
  if (n.y > 0.5) col = mix(col, haze * 1.4, 0.55);
  float dist = length(cameraPosition - vWorldPos);
  if (vSeed < 1.5 && abs(n.y) < 0.5) {
    float u = abs(n.x) > 0.5 ? vLocal.z : vLocal.x;
    vec2 g = vec2(u / 2.6, h / 3.4);
    vec2 cell = floor(g);
    vec2 f = fract(g);
    float inWin = step(0.24, f.x) * step(f.x, 0.76) * step(0.3, f.y) * step(f.y, 0.72) * step(1.0, cell.y);
    float floorOn = step(0.3, hash(vec2(cell.y, seed * 91.0)));
    float r = hash(cell + seed * 137.0 + n.xz * 17.0);
    float on = step(0.6 - 0.22 * seed, r) * floorOn;
    vec3 wc = r > 0.94 ? vec3(0.45, 0.9, 1.0) : r > 0.88 ? vec3(1.0, 0.5, 0.82) : vec3(1.0, 0.7, 0.4);
    // Far away the grid would shimmer: blend towards its average glow instead.
    float detail = 1.0 - smoothstep(140.0, 240.0, dist);
    col = mix(col, wc * 0.8 * lit, mix(0.12 * floorOn, inWin * on, detail));
  }
  float fog = 1.0 - exp(-pow(dist * fogDensity * vColor.a, 2.0));
  col = mix(col, fogColor * 1.2, clamp(fog, 0.0, 0.92));
  gl_FragColor = vec4(col, 1.0);
}
`;

const LIGHTS_VERTEX = /* glsl */ `
precision highp float;
attribute vec3 position;
attribute vec4 color;
attribute vec2 uv;
attribute vec2 uv2;
uniform mat4 world;
uniform mat4 viewProjection;
uniform vec3 cameraPosition;
varying vec2 vUV;
varying vec3 vColor;
varying vec2 vMeta;
varying float vDist;
void main(void) {
  vec4 wp = world * vec4(position, 1.0);
  vUV = uv;
  vColor = color.rgb;
  vMeta = uv2;
  vDist = length(cameraPosition - wp.xyz);
  gl_Position = viewProjection * wp;
}
`;

/** Holo-ads (scrolling glyph columns, a ring logo, a figure), neon strips and blinking beacons. */
const LIGHTS_FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vUV;
varying vec3 vColor;
varying vec2 vMeta;
varying float vDist;
uniform float time;
uniform float intensity;
uniform float fogDensity;
uniform float reduce;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(void) {
  float seed = vMeta.x;
  float kind = vMeta.y;
  vec2 uv = vUV;
  float a = 0.0;
  vec3 col = vColor;
  if (kind < 0.5) {
    float style = floor(seed * 3.0);
    float shape = 0.0;
    if (style < 0.5) {
      // Columns of glyphs scrolling down.
      vec2 g = vec2(uv.x * 5.0, uv.y * 12.0 + time * 0.8 * (0.5 + seed));
      vec2 cell = floor(g);
      vec2 sub = floor(fract(g) * 3.0);
      float glyph = step(0.45, hash(cell * 7.1 + sub + floor(time * 0.5 + seed * 9.0)));
      float gap = step(0.12, fract(g.x)) * step(fract(g.x), 0.88) * step(0.1, fract(g.y));
      shape = glyph * gap;
    } else if (style < 1.5) {
      // A ring logo over a stack of bars.
      float r = length((uv - vec2(0.5, 0.64)) * vec2(1.0, 1.4));
      float ring = 1.0 - step(0.045, abs(r - 0.2 - 0.015 * sin(time * 2.0)));
      float row = floor(uv.y * 14.0);
      float bars = step(uv.y, 0.36) * step(0.08, uv.y) * step(0.4, fract(uv.y * 14.0)) * step(uv.x, 0.15 + 0.75 * hash(vec2(row, seed)));
      shape = max(ring, bars);
      col = mix(col, vec3(1.0) - col * 0.5, step(uv.y, 0.36) * 0.4);
    } else {
      // A figure: head and shoulders, filled with stripes.
      vec2 p = uv - vec2(0.5, 0.0);
      float head = 1.0 - step(0.16, length((uv - vec2(0.5, 0.66)) * vec2(1.0, 0.8)));
      float body = step(uv.y, 0.45) * (1.0 - step(0.42 - uv.y * 0.3, abs(p.x)));
      float stripes = 0.55 + 0.45 * step(0.5, fract((uv.x + uv.y) * 10.0 - time * 0.4));
      shape = max(head, body) * stripes;
    }
    float frame = 1.0 - step(0.025, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)));
    float scan = 0.72 + 0.28 * sin(uv.y * 180.0 + time * 7.0);
    float flick = 1.0 - 0.6 * step(0.985, hash(vec2(floor(time * 14.0), seed * 31.0))) * (1.0 - reduce);
    col *= mix(1.25, 0.75, uv.y);
    a = (shape * 0.42 + frame * 0.7 + 0.05) * scan * flick;
  } else if (kind < 1.5) {
    float edge = 1.0 - abs(uv.x * 2.0 - 1.0);
    a = (0.55 + 0.45 * edge) * (0.85 + 0.15 * sin(time * 1.3 + seed * 20.0));
  } else {
    float r = length(uv - 0.5) * 2.0;
    float blink = step(0.55, fract(time * 0.6 + seed));
    a = (1.0 - smoothstep(0.2, 1.0, r)) * (0.25 + 0.75 * blink);
  }
  float fog = 1.0 - exp(-pow(vDist * fogDensity * 0.3, 2.0));
  a *= intensity * (1.0 - 0.65 * fog);
  gl_FragColor = vec4(col * a, a);
}
`;

const NIGHT_SILHOUETTE = "#131b29";
const DAY_SILHOUETTE = "#4a5562";

/**
 * Draws the far city plan: the world-fixed stand-ins and rings, the megabuildings that follow
 * the camera across the horizon, and their lights. Chunks in view hide their stand-ins.
 */
export class FarCity {
  /** Chunk ids in slot order; the plan itself is dropped once its meshes are built. */
  private readonly chunkIds: readonly string[];
  readonly meshes: Mesh[] = [];
  private readonly far: ShaderMaterial[] = [];
  private readonly lights: ShaderMaterial[] = [];
  private horizonMeshes: Mesh[] = [];
  private hiddenKey = "";
  private time = 0;

  constructor(
    private readonly scene: Scene,
    rig: LightingRig,
    chunks: readonly ChunkDef[] = WORLD_CHUNKS,
  ) {
    const plan = planFarCity(chunks);
    this.chunkIds = plan.chunks;
    const world = this.solid("far-world", plan.world);
    const horizon = this.solid("far-horizon", plan.horizon);
    const worldLights = this.glow("far-world-lights", plan.worldLights);
    const horizonLights = this.glow("far-horizon-lights", plan.horizonLights);
    this.horizonMeshes = [horizon, horizonLights].filter((m): m is Mesh => m !== null);
    for (const m of [world, horizon, worldLights, horizonLights]) if (m) this.meshes.push(m);
    this.setDaylight(rig, 0);
    this.setResident(new Set());
  }

  /** Chunks drawn by the street itself: their stand-ins hide. */
  setResident(resident: ReadonlySet<string>): void {
    const hidden = Array.from({ length: FAR_CHUNK_SLOTS }, (_, i) => {
      const id = this.chunkIds[i];
      return id !== undefined && resident.has(id) ? 1 : 0;
    });
    const key = hidden.join("");
    if (key === this.hiddenKey) return;
    this.hiddenKey = key;
    for (const m of this.far) m.setFloats("hidden", hidden);
  }

  /** Night 0 .. day 1 (ADR-0017): silhouettes pale, windows and ads dim. */
  setDaylight(rig: LightingRig, daylight: number): void {
    const t = Math.max(0, Math.min(1, daylight));
    for (const m of this.far) {
      m.setColor3("silhouette", Color3.FromHexString(mixHex(NIGHT_SILHOUETTE, DAY_SILHOUETTE, t)));
      m.setColor3("haze", Color3.FromHexString(rig.fogColor).scale(1.5 - 0.4 * t));
      m.setColor3("fogColor", Color3.FromHexString(rig.fogColor));
      m.setFloat("fogDensity", rig.fogDensity);
      m.setFloat("lit", 1 - 0.6 * t);
    }
    for (const m of this.lights) {
      m.setFloat("fogDensity", rig.fogDensity);
      m.setFloat("intensity", 1 - 0.55 * t);
    }
  }

  /** Accessibility (ADR-0028): the ads stop dropping out. */
  setReduceFlashes(on: boolean): void {
    for (const m of this.lights) m.setFloat("reduce", on ? 1 : 0);
  }

  /** Keeps the horizon around the camera and animates the ads (frozen in reference frames). */
  update(dt: number, camera: Vec3, frozen: boolean): void {
    for (const m of this.horizonMeshes) {
      if (m.position.x === camera.x && m.position.z === camera.z) continue;
      m.unfreezeWorldMatrix();
      m.position.set(camera.x, 0, camera.z);
      m.freezeWorldMatrix();
    }
    if (frozen) return;
    this.time += dt;
    for (const m of this.lights) m.setFloat("time", this.time);
  }

  private solid(name: string, sink: MeshSink): Mesh | null {
    if (sink.empty) return null;
    const mesh = sinkToMesh(this.scene, name, sink, true);
    const m = new ShaderMaterial(name, this.scene, { vertexSource: FAR_VERTEX, fragmentSource: FAR_FRAGMENT }, {
      attributes: ["position", "normal", "color", "uv2"],
      uniforms: ["world", "viewProjection", "cameraPosition", "hidden", "silhouette", "haze", "fogColor", "fogDensity", "lit"],
    });
    mesh.material = m;
    this.far.push(m);
    return mesh;
  }

  private glow(name: string, sink: MeshSink): Mesh | null {
    if (sink.empty) return null;
    const mesh = sinkToMesh(this.scene, name, sink, true);
    const m = new ShaderMaterial(name, this.scene, { vertexSource: LIGHTS_VERTEX, fragmentSource: LIGHTS_FRAGMENT }, {
      attributes: ["position", "color", "uv", "uv2"],
      uniforms: ["world", "viewProjection", "cameraPosition", "time", "intensity", "fogDensity", "reduce"],
      needAlphaBlending: true,
    });
    m.alphaMode = Constants.ALPHA_ONEONE;
    m.disableDepthWrite = true;
    m.backFaceCulling = false;
    m.setFloat("time", 0);
    m.setFloat("reduce", 0);
    mesh.material = m;
    this.lights.push(m);
    return mesh;
  }
}
