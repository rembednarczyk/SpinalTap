import { METRO_ENTRANCES, STAIRS } from "@seki/sim";
import type { RenderQuality } from "../../npr/quality";
import type { Box2 } from "../mapcity/polygon";
import { DRESS_FLAG, type MeshSink, type Rgba, hexColor } from "../mesh-sink";
import { bakePavilionDress } from "./pavilion-dress";
import { type Entrance, type PavilionFrame, frameBox, pavilionFrame, rod } from "./pavilion-frame";

/**
 * The metro's pavilions (ADR-0071) baked into the street furniture's block meshes (ADR-0050): no
 * draw call of their own. The simulation holds their blocks as solids (`metro-pavilion.ts`); this
 * draws the same blocks dressed (stage 3), in the common style of a low Warsaw-type entrance
 * pavilion, not any one of them: a grey granite plinth, glass in steel frames with a transom, a
 * flat roof with its fascia; inside, granite stairs with yellow nosings and steel handrails down
 * to a hall with the ticket machine and two gates. The pylon, the screen and the lights are in
 * `pavilion-dress.ts`, the names in the signs' mesh (`pavilion-signs.ts`).
 */

export const PAVILION_COLORS = {
  granite: hexColor("#5d6065"),
  stone: hexColor("#8d8c88"),
  steel: hexColor("#2b2f36"),
  fascia: hexColor("#3a3f48"),
  tile: hexColor("#6d7176"),
  nosing: hexColor("#e5bf2a"),
} as const;
/** Wet on the street: the panes catch the street lights like the asphalt does; plain on the phone (ADR-0071). */
const glass = (quality: RenderQuality): Rgba => hexColor("#4f7488", quality === "low" ? DRESS_FLAG.solid : DRESS_FLAG.wet);
/** The panes over the transom glow with the lights inside: the pavilion reads as lit at night. */
const CLERESTORY: Rgba = hexColor("#2a5468", DRESS_FLAG.lit);
const SCREEN: Rgba = hexColor("#36c5ff", DRESS_FLAG.lit);

/** The plinth over the street, the transom over the doors' height, a bar of the frames. */
const PLINTH = 0.5;
const TRANSOM = 2.3;
const BAR = 0.07;
/** Spacing of the mullions along the long side. */
const BAY = 1.2;
/** The eaves' fascia hangs this far under the roof's slab. */
const FASCIA = 0.15;
const ROOF = 0.2;
const NOSING = 0.06;

const inside = (b: Box2, x: number, z: number): boolean => x >= b.minX && x < b.maxX && z >= b.minZ && z < b.maxZ;

/** The granite plinth, the glass over it in its steel frames, the lintel and the roof with its fascia. */
const bakeShell = (sink: MeshSink, f: PavilionFrame, quality: RenderQuality): void => {
  const C = PAVILION_COLORS;
  const { street: s, top, length: L, half, inner } = f;
  const base = f.floor - 0.3;
  const end = L - 0.25;
  const pane = glass(quality);
  for (const k of [-1, 1] as const) {
    // A side wall: the plinth a hair proud of the glass, so its top reads as a ledge.
    frameBox(sink, f, [0, L], [k * inner, k * (half + 0.02)], [base, s + PLINTH], C.granite);
    frameBox(sink, f, [0, L], [k * inner, k * half], [s + PLINTH, s + TRANSOM], pane);
    frameBox(sink, f, [0, L], [k * inner, k * half], [s + TRANSOM, top], CLERESTORY);
  }
  frameBox(sink, f, [end, L + 0.02], [-inner, inner], [base, s + PLINTH], C.granite);
  frameBox(sink, f, [end, L], [-inner, inner], [s + PLINTH, s + TRANSOM], pane);
  frameBox(sink, f, [end, L], [-inner, inner], [s + TRANSOM, top], CLERESTORY);
  // The lintel over the opening: a steel panel the screen hangs on.
  frameBox(sink, f, [0, 0.25], [-inner, inner], [s + 2.5, top], C.steel);
  // Mullions through the glass every bay, and round the end.
  for (let u = 0; u <= L + 1e-6; u += BAY) {
    const at = Math.min(Math.max(u, BAR / 2), L - BAR / 2);
    for (const k of [-1, 1]) frameBox(sink, f, [at - BAR / 2, at + BAR / 2], [k * (inner - 0.02), k * (half + 0.03)], [s + PLINTH, top], C.steel);
  }
  for (const w of [-0.6, 0.6]) frameBox(sink, f, [end - 0.02, L + 0.03], [w - BAR / 2, w + BAR / 2], [s + PLINTH, top], C.steel);
  // The sill rail, the transom and the head rail on the outer faces.
  for (const y of [s + PLINTH + BAR / 2, s + TRANSOM, top - BAR / 2]) {
    for (const k of [-1, 1]) frameBox(sink, f, [0, L], [k * half, k * (half + 0.035)], [y - BAR / 2, y + BAR / 2], C.steel);
    frameBox(sink, f, [L, L + 0.035], [-half, half], [y - BAR / 2, y + BAR / 2], C.steel);
  }
  // The roof's slab over the eaves, and the fascia round it hanging under its edge.
  const r = f.e.roof;
  const y0 = top - FASCIA;
  sink.box({ x: (r.minX + r.maxX) / 2, y: top + ROOF / 2, z: (r.minZ + r.maxZ) / 2 }, r.maxX - r.minX, ROOF, r.maxZ - r.minZ, C.fascia);
  const rim = 0.06;
  for (const [x0, x1, z0, z1] of [
    [r.minX, r.maxX, r.minZ, r.minZ + rim],
    [r.minX, r.maxX, r.maxZ - rim, r.maxZ],
    [r.minX, r.minX + rim, r.minZ + rim, r.maxZ - rim],
    [r.maxX - rim, r.maxX, r.minZ + rim, r.maxZ - rim],
  ] as const) {
    sink.box({ x: (x0 + x1) / 2, y: (y0 + top) / 2, z: (z0 + z1) / 2 }, x1 - x0, top - y0, z1 - z0, C.fascia);
  }
};

/** The landing, the stairs as their steps with a yellow nosing on each, the handrails, and the threshold before the opening. */
const bakeStairs = (sink: MeshSink, f: PavilionFrame): void => {
  const C = PAVILION_COLORS;
  const { inner, street: s, floor } = f;
  const base = floor - 0.3;
  const sill = s + 0.05;
  frameBox(sink, f, [0, STAIRS.landing], [-inner, inner], [base, sill], C.stone);
  const nosing = (u: number, y: number, dir: 1 | -1): void => frameBox(sink, f, [u, u + dir * NOSING], [-inner, inner], [y, y + 0.006], C.nosing);
  nosing(0, sill, 1);
  nosing(STAIRS.landing, sill, -1);
  // The stairs climb from the hall towards the opening: step i from the foot, its front edge downhill.
  const run = STAIRS.run / STAIRS.steps;
  for (let i = 0; i < STAIRS.steps; i++) {
    const t = (i + 0.5) / STAIRS.steps;
    const y = floor + Math.max(0.02, (s - floor) * t);
    const u1 = f.foot - i * run;
    frameBox(sink, f, [u1 - run, u1], [-inner, inner], [floor, y], C.stone);
    nosing(u1, y, -1);
  }
  const th = f.e.threshold;
  if (th) {
    const b = th.bounds;
    const low = th.top - 0.8;
    sink.box({ x: (b.minX + b.maxX) / 2, y: (low + th.top) / 2, z: (b.minZ + b.maxZ) / 2 }, b.maxX - b.minX, th.top - low, b.maxZ - b.minZ, C.granite, { bottom: false });
    frameBox(sink, f, [-0.35, -0.35 + NOSING], [-inner, inner], [th.top, th.top + 0.006], C.nosing);
  }
  // Steel handrails on the side walls, 0.9 m over the nosings, running on a little at both ends.
  const rise = (s - floor) / STAIRS.run;
  for (const k of [-1, 1]) {
    const w = k * (inner - 0.06);
    const top = f.at(STAIRS.landing - 0.3, w, sill + 0.9);
    const head = f.at(STAIRS.landing, w, sill + 0.9);
    const foot = f.at(f.foot, w, floor + 0.9);
    const end = f.at(f.foot + 0.3, w, floor + 0.9);
    rod(sink, top, head, 0.05, C.steel);
    rod(sink, head, foot, 0.05, C.steel);
    rod(sink, foot, end, 0.05, C.steel);
    for (const u of [STAIRS.landing + 0.4, STAIRS.landing + STAIRS.run / 2, f.foot - 0.4]) {
      const y = sill + 0.9 - (u - STAIRS.landing) * rise;
      rod(sink, f.at(u, w, y - 0.03), f.at(u, k * inner, y - 0.03), 0.03, C.steel);
    }
  }
};

/** The hall's floor, the two gates and the ticket machine with its lit screen towards the stairs. */
const bakeHall = (sink: MeshSink, f: PavilionFrame): void => {
  const C = PAVILION_COLORS;
  const e = f.e;
  frameBox(sink, f, [f.foot, f.length - 0.25], [-f.inner, f.inner], [f.floor - 0.3, f.floor], C.tile);
  for (const w of [0.2, 0.85]) {
    frameBox(sink, f, [f.foot + 0.4, f.foot + 1.3], [w, w + 0.15], [f.floor, f.floor + 1], C.steel);
    frameBox(sink, f, [f.foot + 0.45, f.foot + 0.6], [w - 0.005, w + 0.155], [f.floor + 1, f.floor + 1.02], hexColor("#39ff8a", DRESS_FLAG.lit));
  }
  const m = e.machine;
  const size = e.machineSize;
  sink.box({ x: m.x, y: m.y + size.y / 2, z: m.z }, size.x, size.y, size.z, C.steel, { bottom: false });
  const fx = Math.sin(e.machineYaw);
  const fz = Math.cos(e.machineYaw);
  const depth = Math.abs(fx) > 0.5 ? size.x : size.z;
  const across = Math.abs(fx) > 0.5 ? size.z : size.x;
  const face = (y: number, h: number, share: number, color: Rgba): void =>
    sink.box({ x: m.x + fx * (depth / 2 + 0.01), y: m.y + y, z: m.z + fz * (depth / 2 + 0.01) }, Math.abs(fx) > 0.5 ? 0.02 : across * share, h, Math.abs(fx) > 0.5 ? across * share : 0.02, color);
  face(1.2, 0.35, 0.6, SCREEN);
  // Its header in the line's amber (ADR-0071: the game's own colour, not Warsaw's).
  face(1.52, 0.08, 0.9, hexColor("#ffbf4a", DRESS_FLAG.lit));
};

/** One entrance dressed: its shell, stairs, hall, then the pylon, the screen, the lights and the 2077 layer. */
export const bakePavilion = (sink: MeshSink, e: Entrance, quality: RenderQuality = "high"): void => {
  const f = pavilionFrame(e);
  bakeShell(sink, f, quality);
  bakeStairs(sink, f);
  bakeHall(sink, f);
  bakePavilionDress(sink, f, quality);
};

/** The far stand-in: the glass box and the roof over its eaves, a handful of triangles. */
export const bakePavilionFar = (sink: MeshSink, e: Entrance): void => {
  const o = e.outline;
  const top = e.street + 3.1;
  const r = e.roof;
  sink.box({ x: (o.minX + o.maxX) / 2, y: (e.street + top) / 2, z: (o.minZ + o.maxZ) / 2 }, o.maxX - o.minX, top - e.street, o.maxZ - o.minZ, glass("low"), { bottom: false });
  sink.box({ x: (r.minX + r.maxX) / 2, y: top + 0.1, z: (r.minZ + r.maxZ) / 2 }, r.maxX - r.minX, 0.2, r.maxZ - r.minZ, PAVILION_COLORS.fascia);
};

/** The pavilions whose middle lies in a block of the street furniture. */
export const pavilionsIn = (bounds: Box2, entrances: readonly Entrance[] = METRO_ENTRANCES): Entrance[] => entrances.filter((e) => inside(bounds, e.spot.x, e.spot.z));
