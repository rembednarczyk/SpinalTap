import type { Vec3 } from "@seki/core";
import { Color3, Constants, type Mesh, type Scene, ShaderMaterial, Vector3, VertexData } from "../../babylon";
import type { LightingRig } from "../../npr/lighting";
import { mixHex } from "../../npr/lighting";
import { prng } from "../city-kit-data";
import { sinkToMesh } from "../dressing";
import { LIGHTS_FRAGMENT } from "../far-city";
import { MeshSink, type Rgba, type Vec } from "../mesh-sink";
import { BODY_GLOW, type MegaBody, addBody, bodyScale } from "./skyline-bodies";
import type { SkylineLayout, SlabSpec, TowerSpec } from "./skyline-variants";

/**
 * The megabuildings of Lublin 2077 (ADR-0051): corporate towers outside the playable centre,
 * on Czechów, by the Zalew, along al. Kraśnicka and over Tatary, standing over the roofs at the
 * ends of the streets. They replace the old map's `FarCity` horizon (ADR-0027, off in the game
 * since ADR-0045) with real places.
 *
 * Two meshes for the whole skyline (towers and their lights), outside the cells, the moon shadow
 * and the line art. The game camera sees only 320 m, so the towers are drawn as true-perspective
 * impostors: the vertex shader pulls every tower towards the eye along its line of sight until its
 * centre is `shell` metres away and shrinks it by the same factor, so it covers exactly the same
 * pixels as the real one would, just in front of the far plane. Haze is reckoned from the true
 * distance.
 *
 * Towers: uv = the tower's centre (x, z), uv2.x = seed, colour = tint. Lights: as in
 * `FarCity` (uv on the quad, uv2 = seed and kind, colour = tint); the normal carries the
 * tower's centre (x, z) instead of a direction.
 */

export interface MegaSite {
  readonly name: string;
  readonly x: number;
  readonly z: number;
  /** Heights of its towers, metres. */
  readonly towers: readonly number[];
}

/** Where the towers stand (world metres from Plac Litewski, x east, z north), all outside the game's chunks. */
export const MEGA_SITES: readonly MegaSite[] = [
  { name: "Czechów", x: -1300, z: 1900, towers: [760, 560, 430, 330] },
  { name: "al. Kraśnicka", x: -2700, z: -1300, towers: [880, 620, 420] },
  { name: "Zalew Zemborzycki", x: -1200, z: -3700, towers: [980, 540, 400] },
  { name: "Tatary", x: 1900, z: 1500, towers: [640, 420] },
];

const TINTS = ["#8a93a8", "#7d8aa3", "#948aa8", "#7f98a0"] as const;
const NEON = ["#ff2e88", "#00e5ff", "#ffb000", "#39ff8a", "#b46cff"] as const;

const hex = (h: string, a: number): Rgba => {
  const n = parseInt(h.slice(1, 7), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, a];
};

export interface SkylinePlan {
  readonly towers: MeshSink;
  readonly lights: MeshSink;
}

/** Writes every vertex added since `from` with the tower centre in uv (towers) or the normal (lights). */
const stamp = (sink: MeshSink, from: number, c: { x: number; z: number; h?: number }, intoNormal: boolean, to = sink.vertexCount): void => {
  for (let i = from; i < to; i++) {
    if (intoNormal) {
      sink.normals[i * 3] = c.x;
      sink.normals[i * 3 + 1] = c.h ?? 0;
      sink.normals[i * 3 + 2] = c.z;
    } else {
      sink.uvs[i * 2] = c.x;
      sink.uvs[i * 2 + 1] = c.z;
      // PROTOTYP: the tower's height, so the impostor fits its top inside the far plane too.
      sink.uvs2[i * 2 + 1] = c.h ?? 0;
    }
  }
};

/** A quad of light on a tower face looking along n (±x or ±z), centred at c. */
const light = (sink: MeshSink, c: Vec, n: { x: number; z: number }, w: number, h: number, color: Rgba, meta: [number, number]): void => {
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
    meta,
  );
};

/** The tiers of a procedural tower (the phone, and until the megatower bodies are in). */
const tiers = (plan: SkylinePlan, x: number, z: number, h: number, seed: number, rand: () => number): void => {
  const tint = hex(TINTS[Math.floor(rand() * TINTS.length)] ?? "#8a93a8", 1);
  let w = h * (0.12 + rand() * 0.06);
  let d = w * (0.7 + rand() * 0.4);
  let y = 0;
  const count = 3 + Math.floor(rand() * 2);
  for (let k = 0; k < count; k++) {
    const part = k === count - 1 ? h - y : (h - y) * (0.45 + rand() * 0.2);
    plan.towers.box({ x, y: y + part / 2, z }, w, part, d, tint, { uv2: [seed, 0], bottom: false });
    y += part;
    w *= 0.68 + rand() * 0.15;
    d *= 0.68 + rand() * 0.15;
  }
  plan.towers.box({ x, y: h + h * 0.06, z }, Math.max(w * 0.15, 3), h * 0.12, Math.max(d * 0.15, 3), tint, { uv2: [2.5, 0], bottom: false });
};

/**
 * One tower facing the city centre: procedural tiers with a crown and a spire, neon up its corners;
 * or a megatower body (ADR-0063), whose own bands of light stand for the neon. Both get an ad and a
 * beacon on top.
 */
const tower = (plan: SkylinePlan, spec: TowerSpec, rand: () => number, body: MegaBody | null): void => {
  const { x, z, h, front: n } = spec;
  const t0 = plan.towers.vertexCount;
  const l0 = plan.lights.vertexCount;
  const seed = rand();
  const color = (): Rgba => hex(NEON[Math.floor(rand() * NEON.length)] ?? "#00e5ff", 1);
  if (body) {
    const reach = addBody(plan.towers, body, { x, z, h, front: n }, seed);
    stamp(plan.towers, t0, { x, z, h }, false);
    const half = bodyScale(body, h).across * Math.min(body.model.size.x, body.model.size.z) * 0.4;
    light(plan.lights, { x: x + n.x * (reach + 2), y: h * (0.5 + rand() * 0.15), z: z + n.z * (reach + 2) }, n, half * 1.5, half * 1.1, color(), [rand(), 0]);
    // PROTOTYP: more ads up the front (variant B), tall and narrow above the middle one.
    for (let k = 0; k < spec.ads; k++) {
      const y = h * (0.22 + 0.2 * k + rand() * 0.05) + (k > 0 ? h * 0.25 : 0);
      light(plan.lights, { x: x + n.x * (reach + 3), y: Math.min(y, h * 0.92), z: z + n.z * (reach + 3) }, n, half * (k % 2 ? 0.7 : 1.8), half * (k % 2 ? 2.4 : 0.8), color(), [rand(), 0]);
    }
    light(plan.lights, { x, y: h * 1.01, z }, { x: n.x || 1, z: n.z }, 6, 6, hex("#ff3030", 1), [rand(), 2]);
    stamp(plan.lights, l0, { x, z, h }, true);
    return;
  }
  tiers(plan, x, z, h, seed, rand);
  stamp(plan.towers, t0, { x, z, h }, false);
  // Lights on the face looking towards the city centre.
  const half = (n.x !== 0 ? h * 0.15 : h * 0.15 * 0.85) / 2 + 1;
  const face = { x: x + n.x * half * 1.6, z: z + n.z * half * 1.6 };
  for (const side of [-1, 1]) light(plan.lights, { x: face.x - n.z * side * half, y: h * 0.32, z: face.z + n.x * side * half }, n, 2.5, h * 0.6, color(), [rand(), 1]);
  light(plan.lights, { x: face.x + n.x * 2, y: h * (0.5 + rand() * 0.15), z: face.z + n.z * 2 }, n, half * 1.5, half * 1.1, color(), [rand(), 0]);
  light(plan.lights, { x, y: h * 1.13, z }, { x: n.x || 1, z: n.z }, 6, 6, hex("#ff3030", 1), [rand(), 2]);
  stamp(plan.lights, l0, { x, z, h }, true);
};

/** PROTOTYP: a skybridge, each end stamped with its own tower (so it meets both in the picture). */
const bridge = (plan: SkylinePlan, a: TowerSpec, b: TowerSpec, y: number, width: number, rand: () => number): void => {
  const t0 = plan.towers.vertexCount;
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  const c = { x: (a.x + b.x) / 2, y, z: (a.z + b.z) / 2 };
  const rotY = Math.atan2(b.x - a.x, b.z - a.z);
  plan.towers.box(c, width, 5, len, hex("#6d7486", 1), { rotY, uv2: [2.5, 0] });
  plan.towers.box({ ...c, y: y - 3.2 }, width * 0.35, 1.4, len, hex(NEON[Math.floor(rand() * NEON.length)] ?? "#00e5ff", 1), { rotY, uv2: [BODY_GLOW, 0] });
  for (let i = t0; i < plan.towers.vertexCount; i++) {
    const px = plan.towers.positions[i * 3] ?? 0;
    const pz = plan.towers.positions[i * 3 + 2] ?? 0;
    const end = (px - a.x) ** 2 + (pz - a.z) ** 2 < (px - b.x) ** 2 + (pz - b.z) ** 2 ? a : b;
    stamp(plan.towers, i, end, false, i + 1);
  }
};

/** PROTOTYP: a megablock slab over the blocks (variant C): windows on its walls, a lit underside rim. */
const slab = (plan: SkylinePlan, s: SlabSpec, rand: () => number): void => {
  const t0 = plan.towers.vertexCount;
  const tint = hex(TINTS[Math.floor(rand() * TINTS.length)] ?? "#8a93a8", 1);
  plan.towers.box({ x: s.x, y: s.y + s.height / 2, z: s.z }, s.depth, s.height, s.length, tint, { rotY: s.rotY, uv2: [rand(), 0] });
  plan.towers.box({ x: s.x, y: s.y - 1, z: s.z }, s.depth * 1.04, 2, s.length * 1.01, hex(NEON[Math.floor(rand() * NEON.length)] ?? "#ffb000", 1), { rotY: s.rotY, uv2: [BODY_GLOW, 0] });
  stamp(plan.towers, t0, { x: s.x, z: s.z, h: s.y + s.height }, false);
};

const planLayout = (plan: SkylinePlan, layout: SkylineLayout, bodies: readonly MegaBody[]): SkylinePlan => {
  const rand = prng(0x5ca1e);
  layout.towers.forEach((t, i) => tower(plan, t, rand, bodies[i % Math.max(bodies.length, 1)] ?? null));
  for (const b of layout.bridges) bridge(plan, layout.towers[b.a]!, layout.towers[b.b]!, b.y, b.width, rand);
  for (const s of layout.slabs) slab(plan, s.slab, rand);
  return plan;
};

/**
 * The skyline: deterministic, from `MEGA_SITES` only. With megatower bodies (ADR-0063) the towers
 * take them in turn, so every variant stands in more than one place.
 */
export const planSkyline = (sites: readonly MegaSite[] = MEGA_SITES, bodies: readonly MegaBody[] = [], layout: SkylineLayout | null = null): SkylinePlan => {
  const plan: SkylinePlan = { towers: new MeshSink(), lights: new MeshSink() };
  if (layout) return planLayout(plan, layout, bodies);
  let index = 0;
  for (const s of sites) {
    const rand = prng(Math.floor(Math.abs(s.x * 31 + s.z * 17)) ^ 0x5ca1e);
    s.towers.forEach((h, k) => {
      const a = k * 2.4 + rand();
      const r = k === 0 ? 0 : 120 + rand() * 160;
      const x = s.x + Math.sin(a) * r;
      const z = s.z + Math.cos(a) * r;
      const front = Math.abs(x) > Math.abs(z) ? { x: -Math.sign(x), z: 0 } : { x: 0, z: -Math.sign(z) };
      tower(plan, { x, z, h, front, ads: 0 }, rand, bodies[index++ % Math.max(bodies.length, 1)] ?? null);
    });
  }
  return plan;
};

/**
 * Pulls a vertex towards the eye so its tower's centre lies `shell` metres away (same pixels).
 * PROTOTYP: `h` is the tower's height, so a near and tall tower's top stays inside the far plane.
 */
const IMPOSTOR = /* glsl */ `
vec3 impostor(vec3 p, vec2 centre, float h, out float trueDist) {
  trueDist = length(centre - eye.xz);
  float s = min(1.0, shell / max(length(vec2(trueDist, h - eye.y)), 1.0));
  return eye + (p - eye) * s;
}
`;

const TOWER_VERTEX = /* glsl */ `
precision highp float;
attribute vec3 position;
attribute vec3 normal;
attribute vec4 color;
attribute vec2 uv;
attribute vec2 uv2;
uniform mat4 viewProjection;
uniform vec3 eye;
uniform float shell;
varying vec3 vLocal;
varying vec3 vNormal;
varying vec4 vColor;
varying float vSeed;
varying float vDist;
${IMPOSTOR}
void main(void) {
  vLocal = position;
  vNormal = normal;
  vColor = color;
  vSeed = uv2.x;
  gl_Position = viewProjection * vec4(impostor(position, uv, uv2.y, vDist), 1.0);
}
`;

/** Cel silhouettes: darker up high, a lighter side, lit windows in whole floors, haze from the true distance. */
const TOWER_FRAGMENT = /* glsl */ `
precision highp float;
varying vec3 vLocal;
varying vec3 vNormal;
varying vec4 vColor;
varying float vSeed;
varying float vDist;
uniform vec3 silhouette;
uniform vec3 fogColor;
uniform float fogDensity;
uniform float lit;
#define BODY_GLOW ${BODY_GLOW.toFixed(1)}
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(void) {
  vec3 n = normalize(vNormal);
  float seed = fract(vSeed);
  vec3 col = silhouette * vColor.rgb * (abs(n.x) > 0.5 ? 1.5 : 1.15);
  if (n.y > 0.5) col *= 0.7;
  vec3 glow = vec3(0.0);
  if (vSeed > BODY_GLOW - 0.5) {
    // A megatower's band of light (ADR-0063): its own colour, dim by day.
    col = vColor.rgb * 0.3;
    glow = lit * vColor.rgb * 0.85;
  } else if (vSeed < 1.5 && abs(n.y) < 0.5) {
    float u = abs(n.x) > 0.5 ? vLocal.z : vLocal.x;
    vec2 g = vec2(u / 4.0, vLocal.y / 4.2);
    vec2 cell = floor(g);
    vec2 f = fract(g);
    float inWin = step(0.2, f.x) * step(f.x, 0.8) * step(0.3, f.y) * step(f.y, 0.75);
    float band = step(0.35, hash(vec2(floor(cell.y / 6.0), seed * 91.0)));
    float r = hash(cell + seed * 137.0 + n.xz * 17.0);
    float on = step(0.55, r) * band;
    vec3 wc = r > 0.95 ? vec3(0.45, 0.9, 1.0) : r > 0.9 ? vec3(1.0, 0.5, 0.82) : vec3(1.0, 0.72, 0.42);
    // Far off the grid would shimmer: its average glow instead.
    float detail = 1.0 - smoothstep(900.0, 1800.0, vDist);
    // Far off: the floors' average glow in one warm colour (single windows would alias into blotches).
    vec3 avg = vec3(1.0, 0.7, 0.45) * 0.09 * band * (0.6 + 0.4 * step(0.5, fract(vLocal.y / 25.0)));
    glow = lit * mix(avg, wc * inWin * on, detail);
  }
  float fog = clamp(1.0 - exp(-pow(vDist * fogDensity * 0.045, 2.0)), 0.0, 0.82);
  col = mix(col, fogColor * 1.15, fog) + glow * (1.0 - 0.6 * fog);
  gl_FragColor = vec4(col, 1.0);
}
`;

const LIGHT_VERTEX = /* glsl */ `
precision highp float;
attribute vec3 position;
attribute vec3 normal;
attribute vec4 color;
attribute vec2 uv;
attribute vec2 uv2;
uniform mat4 viewProjection;
uniform vec3 eye;
uniform float shell;
varying vec2 vUV;
varying vec3 vColor;
varying vec2 vMeta;
varying float vDist;
${IMPOSTOR}
void main(void) {
  vUV = uv;
  vColor = color.rgb;
  vMeta = uv2;
  float d;
  vec3 p = impostor(position, normal.xz, normal.y, d);
  // The lights' haze is a third of the street's: scale the distance so it reads like the towers'.
  vDist = d * 0.15;
  gl_Position = viewProjection * vec4(p, 1.0);
}
`;

const NIGHT_SILHOUETTE = "#141b2a";
const DAY_SILHOUETTE = "#56606e";

/** The skyline's two meshes and their materials. */
export class MapSkyline {
  readonly meshes: Mesh[] = [];
  private readonly materials: ShaderMaterial[] = [];
  private readonly lights: ShaderMaterial | null;
  private time = 0;
  private readonly eye = new Vector3();

  constructor(scene: Scene, withLights: boolean, private readonly layout: SkylineLayout | null = null) {
    const plan = planSkyline(MEGA_SITES, [], layout);
    const towers = new ShaderMaterial("map-skyline", scene, { vertexSource: TOWER_VERTEX, fragmentSource: TOWER_FRAGMENT }, {
      attributes: ["position", "normal", "color", "uv", "uv2"],
      uniforms: ["viewProjection", "eye", "shell", "silhouette", "fogColor", "fogDensity", "lit"],
    });
    this.add(scene, "map-skyline", plan.towers, towers);
    this.lights = withLights
      ? new ShaderMaterial("map-skyline-lights", scene, { vertexSource: LIGHT_VERTEX, fragmentSource: LIGHTS_FRAGMENT }, {
          attributes: ["position", "normal", "color", "uv", "uv2"],
          uniforms: ["viewProjection", "eye", "shell", "time", "intensity", "fogDensity", "reduce"],
          needAlphaBlending: true,
        })
      : null;
    if (this.lights) {
      this.lights.alphaMode = Constants.ALPHA_ONEONE;
      this.lights.disableDepthWrite = true;
      this.lights.backFaceCulling = false;
      this.lights.setFloat("time", 0);
      this.lights.setFloat("reduce", 0);
      this.add(scene, "map-skyline-lights", plan.lights, this.lights);
    }
  }

  private add(scene: Scene, name: string, sink: MeshSink, material: ShaderMaterial): void {
    const mesh = sinkToMesh(scene, name, sink, true);
    // Bounds mean nothing for an impostor: never culled.
    mesh.alwaysSelectAsActiveMesh = true;
    mesh.material = material;
    this.materials.push(material);
    this.meshes.push(mesh);
  }

  /**
   * The megatower bodies have loaded (ADR-0063): the towers and their lights are rebuilt in the
   * same two meshes, so the skyline costs no more draw calls than before.
   */
  setBodies(bodies: readonly MegaBody[]): void {
    if (bodies.length === 0) return;
    const plan = planSkyline(MEGA_SITES, bodies, this.layout);
    [plan.towers, plan.lights].forEach((sink, i) => {
      const mesh = this.meshes[i];
      if (!mesh) return;
      const data = new VertexData();
      data.positions = sink.positions;
      data.normals = sink.normals;
      data.colors = sink.colors;
      data.uvs = sink.uvs;
      data.uvs2 = sink.uvs2;
      data.indices = sink.indices;
      data.applyToMesh(mesh, false);
    });
  }

  /** Night 0 .. day 1: silhouettes pale, windows and ads dim; haze from the rig. */
  setLook(rig: LightingRig, daylight: number): void {
    const t = Math.max(0, Math.min(1, daylight));
    for (const m of this.materials) {
      m.setFloat("fogDensity", rig.fogDensity);
      m.setColor3("fogColor", Color3.FromHexString(rig.fogColor));
      m.setColor3("silhouette", Color3.FromHexString(mixHex(NIGHT_SILHOUETTE, DAY_SILHOUETTE, t)));
      m.setFloat("lit", 1 - 0.7 * t);
      m.setFloat("intensity", 1 - 0.55 * t);
    }
  }

  setReduceFlashes(on: boolean): void {
    this.lights?.setFloat("reduce", on ? 1 : 0);
  }

  /** Follows the eye; `far` is the camera's far plane (the shell sits just inside it). */
  update(dt: number, eye: Vec3, far: number, frozen: boolean): void {
    const shell = Math.min(far * 0.9, 900);
    for (const m of this.materials) {
      m.setFloat("shell", shell);
      m.setVector3("eye", this.eye.set(eye.x, eye.y, eye.z));
    }
    if (frozen || !this.lights) return;
    this.time += dt;
    this.lights.setFloat("time", this.time);
  }
}
