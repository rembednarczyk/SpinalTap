import type { MeshSink, Rgba, Vec } from "../../mesh-sink";
import { type Wall, trimMeta } from "../facade-frame";
import { slab } from "../facade-parts";
import { doorwaysOn } from "../facade-plan";
import { type P2, cross } from "../polygon";
import { type Uv, face, quadUv, vertex } from "../sink-ops";
import { SWATCH, archPanel, onWall, revolve, shownWalls, slabRing, solid } from "./kit";
import { alongWall } from "./elevation";
import { corniceLights, sideOf } from "./layer2077";
import type { LandmarkFrame } from "./landmark-frame";
import type { CastleFront, Layer2077 } from "./recipes";

/**
 * A castle's solid from its recipe (ADR-0062 stage 5, G-841): the walls to the data's eaves, an
 * attic over the outer walls up to the data's peak with battlements on it, the roof hidden behind
 * it as a walk at the eaves, and on the gate's front (the wall with the passage's mouth on the
 * Old Town's side) the risalit's stepped parapet between two octagonal turrets with flags.
 */

/** How thick the attic and its merlons are, metres. */
const ATTIC = 0.44;

/** The data's peak: the attic's top. */
export const atticTop = (f: LandmarkFrame): number => f.top + (f.b.roof ?? 0);

/** The convex hull of a ring (monotone chain), counter-clockwise. */
const hull = (ring: readonly P2[]): P2[] => {
  const pts = [...ring].sort((a, b) => a.x - b.x || a.z - b.z);
  const half = (list: readonly P2[]): P2[] => {
    const out: P2[] = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2] as P2, out[out.length - 1] as P2, p) <= 0) out.pop();
      out.push(p);
    }
    return out.slice(0, -1);
  };
  return [...half(pts), ...half([...pts].reverse())];
};

/** How deep a point lies inside a convex ring (counter-clockwise), metres; negative outside. */
const depthIn = (h: readonly P2[], p: P2): number => {
  let d = Infinity;
  for (let i = 0; i < h.length; i++) {
    const a = h[i] as P2;
    const b = h[(i + 1) % h.length] as P2;
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    d = Math.min(d, cross(a, b, p) / len);
  }
  return d;
};

/**
 * The walls facing the courtyard: their middle, half a metre out, lies over 4 m inside the
 * outline's convex hull (the turrets' and the wings' small steps stay outer walls).
 */
export const courtyardWalls = (f: LandmarkFrame): ReadonlySet<Wall> => {
  const h = hull(f.b.ring);
  return new Set(f.walls.filter((w) => depthIn(h, onWall(w, w.length / 2, 0, 0.5)) > 4));
};

/** The outer walls an attic stands on: shown and not facing the courtyard. */
export const outerWalls = (f: LandmarkFrame): Wall[] => {
  const inner = courtyardWalls(f);
  return shownWalls(f).filter((w) => !inner.has(w));
};

/** The gate's wall: the outer wall with the passage's mouth on the Old Town's side, or null. */
export const gateWall = (f: LandmarkFrame, layer: Layer2077): { w: Wall; u0: number; u1: number; floor: number; top: number } | null => {
  for (const w of outerWalls(f)) {
    if (sideOf(w, layer) !== "old") continue;
    const o = doorwaysOn(w, f.b.doorways ?? [])[0];
    if (o) return { w, u0: o.u0, u1: o.u1, floor: o.bottom, top: o.top };
  }
  return null;
};

/** The turrets' centres: the mean corner of the outline's short runs (under 2.5 m walls) off both ends of the gate's wall. */
export const turretCentres = (f: LandmarkFrame, gate: Wall): P2[] => {
  const ws = f.walls;
  const i = ws.indexOf(gate);
  const n = ws.length;
  return ([-1, 1] as const).map((dir) => {
    const pts: P2[] = [dir < 0 ? gate.a : gate.b];
    for (let k = 1; k < n; k++) {
      const w = ws[(i + dir * k + n * k) % n] as Wall;
      if (w.length >= 2.5) break;
      pts.push(dir < 0 ? w.a : w.b);
    }
    return { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, z: pts.reduce((s, p) => s + p.z, 0) / pts.length };
  });
};

/** Merlons `h` metres tall every `pitch` metres along a wall from u0 to u1 on y0. */
const merlonRow = (sink: MeshSink, w: Wall, u0: number, u1: number, y0: number, h: number, pitch: number, color: Rgba, uv2: Uv): void => {
  const wide = Math.min(0.9, pitch * 0.56);
  const rotY = alongWall(w);
  const n = u1 - u0 < wide ? 0 : Math.max(1, Math.round((u1 - u0 - wide) / pitch));
  const width = n === 0 ? u1 - u0 : wide;
  for (let k = 0; k <= n; k++) sink.box(onWall(w, n === 0 ? (u0 + u1) / 2 : u0 + wide / 2 + ((u1 - u0 - wide) * k) / n, y0 + h / 2, -ATTIC / 2), width, h, ATTIC, color, { rotY, bottom: false, uv2 });
};

/** A triangular merlon centred at u on y0: front and back faces and its two sloping tops. */
const triangle = (sink: MeshSink, w: Wall, u: number, half: number, y0: number, h: number, color: Rgba, uv2: Uv): void => {
  const p = (du: number, y: number, out: number): Vec => onWall(w, u + du, y, out);
  for (const out of [0, -ATTIC]) {
    const n = { x: out === 0 ? w.nx : -w.nx, y: 0, z: out === 0 ? w.nz : -w.nz };
    face(sink, vertex(sink, p(-half, y0, out), n, color, [0, 0], uv2), vertex(sink, p(half, y0, out), n, color, [1, 0], uv2), vertex(sink, p(0, y0 + h, out), n, color, [0.5, 1], uv2), n);
  }
  const t = { x: (w.b.x - w.a.x) / w.length, z: (w.b.z - w.a.z) / w.length };
  for (const s of [-1, 1]) {
    const l = Math.hypot(h, half);
    const n = { x: (t.x * s * h) / l, y: half / l, z: (t.z * s * h) / l };
    quadUv(sink, [p(s * half, y0, 0), p(s * half, y0, -ATTIC), p(0, y0 + h, -ATTIC), p(0, y0 + h, 0)], n, color, [[0, 0], [1, 0], [1, 1], [0, 1]], uv2);
  }
};

/** An octagonal turret round c from the foot to `top` (merlons included), a mast with a flag on it when near. */
const turret = (sink: MeshSink, f: LandmarkFrame, c: P2, face0: Wall, spec: CastleFront["turret"], top: number, near: boolean, color: Rgba): void => {
  const meta = trimMeta(f.style.seed);
  const r = spec.radius;
  const phase = Math.atan2(face0.nz, face0.nx) - Math.PI / 8;
  const foot = { x: c.x, y: f.b.foot - 0.2, z: c.z };
  const body = top - (near ? spec.merlon : 0) - foot.y;
  revolve(sink, foot, near ? [[r, 0], [r, body - 0.35], [r + 0.15, body - 0.15], [r + 0.15, body]] : [[r, 0], [r, body]], 8, phase, color, meta);
  const k = near ? r + 0.15 : r;
  const ring = Array.from({ length: 8 }, (_, j) => ({ x: c.x + Math.cos(phase + (j * Math.PI) / 4) * k, z: c.z + Math.sin(phase + (j * Math.PI) / 4) * k }));
  slabRing(sink, ring, foot.y + body, solid(SWATCH.stone), meta);
  if (!near) return;
  // A string course at the wings' walk and narrow lancets on the facets facing out from the gate's wall.
  const walk = top - spec.rise - spec.merlon - foot.y;
  revolve(sink, foot, [[r, walk - 0.25], [r + 0.08, walk - 0.25], [r + 0.08, walk], [r, walk]], 8, phase, color, meta);
  for (let j = 0; j < 8; j++) {
    const a0 = phase + (j * Math.PI) / 4;
    const a1 = phase + ((j + 1) * Math.PI) / 4;
    const am = (a0 + a1) / 2;
    if (Math.cos(am) * face0.nx + Math.sin(am) * face0.nz < 0.3) continue;
    const fa = { x: c.x + Math.cos(a0) * r, z: c.z + Math.sin(a0) * r };
    const fb = { x: c.x + Math.cos(a1) * r, z: c.z + Math.sin(a1) * r };
    const facet: Wall = { a: fb, b: fa, length: Math.hypot(fb.x - fa.x, fb.z - fa.z), nx: Math.cos(am), nz: Math.sin(am), blind: false, coveredTo: -Infinity, bay: 0 };
    for (const [y0, y1] of [
      [walk - 4.6, walk - 3],
      [walk + 0.4, walk + 1.6],
    ] as const) {
      archPanel(sink, facet, facet.length / 2, 0.3, foot.y + y0, foot.y + y1, 0.03, solid(SWATCH.opening), meta, true);
    }
  }
  const side = 2 * k * Math.sin(Math.PI / 8);
  for (let j = 0; j < 8; j++) {
    const a = phase + ((j + 0.5) * Math.PI) / 4;
    const d = k * Math.cos(Math.PI / 8) - 0.15;
    sink.box({ x: c.x + Math.cos(a) * d, y: top - spec.merlon / 2, z: c.z + Math.sin(a) * d }, side * 0.55, spec.merlon, 0.3, color, { rotY: Math.atan2(-Math.cos(a), -Math.sin(a)), bottom: false, uv2: meta });
  }
  sink.box({ x: c.x, y: top + spec.mast / 2 - 0.3, z: c.z }, 0.08, spec.mast + 0.6, 0.08, solid(SWATCH.metal), { bottom: false, uv2: meta });
  // The flag across the gate's front, seen whole from the plaza; both faces.
  const t = { x: (face0.b.x - face0.a.x) / face0.length, z: (face0.b.z - face0.a.z) / face0.length };
  const stripe = 0.6 / Math.max(spec.flag.length, 1);
  spec.flag.forEach((hex, s) => {
    const y1 = top + spec.mast - 0.15 - s * stripe;
    const q = (u: number, y: number): Vec => ({ x: c.x + t.x * u, y, z: c.z + t.z * u });
    for (const n of [1, -1]) quadUv(sink, [q(0.05, y1 - stripe), q(0.95, y1 - stripe), q(0.95, y1), q(0.05, y1)], { x: face0.nx * n, y: 0, z: face0.nz * n }, solid(hex), [[0, 0], [1, 0], [1, 1], [0, 1]], meta);
  });
};

/**
 * The castle's crown, near or far: the walk at the eaves, the attic on the outer walls with
 * battlements (near), and on the gate's front the parapet with triangular merlons and the turrets.
 */
export const castleCrown = (sink: MeshSink, f: LandmarkFrame, merlon: number, pitch: number, front: CastleFront | undefined, near: boolean, color: Rgba): void => {
  const meta = trimMeta(f.style.seed);
  const crown = atticTop(f);
  // Triangulated: a fan from the centroid would roof the courtyard of a C outline.
  slab(sink, f.b.ring, f.top, solid(SWATCH.stone), meta);
  const gate = front ? gateWall(f, f.landmark.recipe.layer) : null;
  const turrets = gate ? turretCentres(f, gate.w) : [];
  const covered = (w: Wall) => turrets.some((c) => [0, w.length].every((u) => Math.hypot(onWall(w, u, 0, 0).x - c.x, onWall(w, u, 0, 0).z - c.z) < (front?.turret.radius ?? 0) + 1));
  for (const w of outerWalls(f)) {
    if (covered(w)) continue;
    const parapet = gate && w === gate.w && front ? front.parapet : null;
    const to = parapet ? crown + parapet.rise : near ? crown - merlon : crown;
    sink.box(onWall(w, w.length / 2, (f.top - 0.02 + to) / 2, -ATTIC / 2), w.length, to - f.top + 0.02, ATTIC, color, { rotY: alongWall(w), bottom: false, uv2: meta });
    if (!near) continue;
    if (!parapet) {
      merlonRow(sink, w, 0, w.length, crown - merlon, merlon, pitch, color, meta);
      continue;
    }
    const n = Math.max(1, Math.round(w.length / parapet.pitch));
    for (let k = 0; k < n; k++) triangle(sink, w, (w.length * (k + 0.5)) / n, (w.length / n) * 0.4, to, parapet.merlon, color, meta);
  }
  if (gate && front) for (const c of turrets) turret(sink, f, c, gate.w, front.turret, crown + front.turret.rise, near, color);
};

/** Lublin 2077's warm lines under the battlements of the outer walls and under the eaves of the courtyard's. */
export const atticLights = (sink: MeshSink, f: LandmarkFrame, merlon: number): void => {
  const layer = f.landmark.recipe.layer;
  const inner = courtyardWalls(f);
  corniceLights(sink, { ...f, walls: f.walls.filter((w) => !inner.has(w)) }, atticTop(f) - merlon - 0.12, 0.03, layer);
  corniceLights(sink, { ...f, walls: f.walls.filter((w) => inner.has(w)) }, f.top - 0.12, 0.03, layer);
};
