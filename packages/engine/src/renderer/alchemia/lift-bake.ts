import { ALCHEMIA_LIFT, type AlchemiaLiftPlan, type AlchemiaScreen, type LiftBox } from "@seki/sim";
import type { RenderQuality } from "../../npr/quality";
import type { Box2 } from "../mapcity/polygon";
import { DRESS_FLAG, type MeshSink, type Rgba, type Vec, hexColor } from "../mesh-sink";
import { rod } from "../metro/pavilion-frame";

/**
 * The lift of Alchemia (G-284, G-289) baked into the street furniture's block mesh (ADR-0050), as
 * the metro's pavilions are: no draw call of its own. Alchemia 2077: a glazed shaft in a dark steel
 * frame with the hall's cyan neon up its corners and a magenta band under its cap, a magenta chevron
 * over its door; a steel footbridge to the roof, cyan along its edges; the bridge and the roof
 * terrace fenced with glass to a handrail and lit wires over it to the screens' tops. The panes of
 * the shaft face out only: from the cage the city is in view, from the square the glass is tinted.
 * The simulation's solids are the same boxes and lines (`ALCHEMIA_LIFT`); the platform, the gates
 * and the buttons are entities and draw themselves.
 */

export const LIFT_COLORS = {
  steel: hexColor("#23272f"),
  deck: hexColor("#30343c"),
  granite: hexColor("#5d6065"),
  cyan: hexColor("#3ff4ff", DRESS_FLAG.lit),
  magenta: hexColor("#ff3fd2", DRESS_FLAG.lit),
} as const;
/** Wet on the street like the pavilions' panes; plain on the phone. */
const glass = (quality: RenderQuality): Rgba => hexColor("#3f6f86", quality === "low" ? DRESS_FLAG.solid : DRESS_FLAG.wet);

const POST = 0.12;
const BAND = 0.08;
/** The shaft's frame bands every this many metres, and the strips of neon on its corners. */
const BAND_EVERY = 2.9;
const NEON = 0.05;
/** The screens: glass to the handrail, posts this far apart, lit wires every `WIRE_EVERY` over it. */
const HANDRAIL = 1.0;
const SCREEN_POST = 1.2;
const WIRE_EVERY = 0.3;
const WIRE = 0.025;

/** A box of the plan (offsets from the shaft's middle) in the world. */
const liftBox = (sink: MeshSink, p: AlchemiaLiftPlan, b: LiftBox, color: Rgba, grow = 0): void => {
  sink.box({ x: p.centre.x + (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, z: p.centre.z + (b.z0 + b.z1) / 2 }, b.x1 - b.x0 + 2 * grow, b.y1 - b.y0, b.z1 - b.z0 + 2 * grow, color);
};

/** The outer face of a wall of the shaft as one quad facing out (the side of the plan's middle it is on). */
const pane = (sink: MeshSink, p: AlchemiaLiftPlan, b: LiftBox, color: Rgba): void => {
  const cx = p.centre.x;
  const cz = p.centre.z;
  const ew = b.x1 - b.x0 < b.z1 - b.z0;
  if (ew) {
    const x = cx + (b.x0 + b.x1 > 0 ? b.x1 : b.x0);
    const n = b.x0 + b.x1 > 0 ? 1 : -1;
    const [z0, z1] = [cz + b.z0, cz + b.z1];
    sink.quad([{ x, y: b.y0, z: z0 }, { x, y: b.y0, z: z1 }, { x, y: b.y1, z: z1 }, { x, y: b.y1, z: z0 }], { x: n, y: 0, z: 0 }, color);
  } else {
    const z = cz + (b.z0 + b.z1 > 0 ? b.z1 : b.z0);
    const n = b.z0 + b.z1 > 0 ? 1 : -1;
    const [x0, x1] = [cx + b.x0, cx + b.x1];
    sink.quad([{ x: x0, y: b.y0, z }, { x: x1, y: b.y0, z }, { x: x1, y: b.y1, z }, { x: x0, y: b.y1, z }], { x: 0, y: 0, z: n }, color);
  }
};

/** The call buttons' size (the simulation's `block` view) and the lit rim round each, mounted west of it. */
const BUTTON = { x: 0.22, y: 0.32, z: 0.22 } as const;
const RIM = 0.06;

/**
 * A lit cyan plate behind each call button, a rim of it showing round the button, on the face it
 * hangs on: the bottom one outside the shaft's west wall (the wall east of it), the top one on the
 * bridge's west screen (west of it). The buttons read at night as the shaft's neon does.
 */
export const bakeButtonRims = (sink: MeshSink, p: AlchemiaLiftPlan): void => {
  const west = p.centre.x - p.half - p.wall;
  for (const b of p.buttons) {
    const toWall = b.x < west ? 1 : -1;
    sink.box({ x: b.x + toWall * (BUTTON.x / 2 - 0.01), y: b.y, z: b.z }, 0.02, BUTTON.y + 2 * RIM, BUTTON.z + 2 * RIM, LIFT_COLORS.cyan);
  }
};

/** The shaft: its panes facing out, the frame's corner posts and bands, the neon, the cap, the sill and the gate's pocket. */
const bakeShaft = (sink: MeshSink, p: AlchemiaLiftPlan, quality: RenderQuality): void => {
  const C = LIFT_COLORS;
  const out = p.half + p.wall;
  const cap = p.walls[p.walls.length - 1]!;
  for (const w of p.walls.slice(0, -1)) pane(sink, p, w, glass(quality));
  liftBox(sink, p, cap, C.steel, 0.04);
  // The magenta band under the cap, the cyan strips up the corners.
  liftBox(sink, p, { x0: -out, x1: out, z0: -out, z1: out, y0: p.head - 0.12, y1: p.head }, C.magenta, 0.03);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x = sx * (out - POST / 2);
      const z = sz * (out - POST / 2);
      liftBox(sink, p, { x0: x - POST / 2, x1: x + POST / 2, z0: z - POST / 2, z1: z + POST / 2, y0: p.base, y1: p.head }, C.steel, 0.01);
      const nz = z + sz * (POST / 2 + NEON / 2);
      liftBox(sink, p, { x0: x - NEON / 2, x1: x + NEON / 2, z0: nz - NEON / 2, z1: nz + NEON / 2, y0: p.levels[0] + 0.3, y1: p.head - 0.15 }, C.cyan);
    }
  }
  // Steel bands round the shaft at its levels and every few metres between, a cyan tube along each.
  const [ground, top] = p.levels;
  const bands = [ground + p.opening, top - 0.3, top + p.opening];
  for (let y = ground + p.opening + BAND_EVERY; y < top - 0.6; y += BAND_EVERY) bands.push(y);
  for (const y of bands) {
    for (const [x0, x1, z0, z1] of [
      [-out, out, -out, -out + BAND],
      [-out, out, out - BAND, out],
      [-out, -out + BAND, -out, out],
      [out - BAND, out, -out, out],
    ] as const) {
      liftBox(sink, p, { x0, x1, z0, z1, y0: y - BAND / 2, y1: y + BAND / 2 }, C.steel, 0.01);
      liftBox(sink, p, { x0, x1, z0, z1, y0: y - NEON / 4, y1: y + NEON / 4 }, C.cyan, 0.02);
    }
  }
  liftBox(sink, p, p.sill, C.granite);
  liftBox(sink, p, { ...p.sill, z0: p.sill.z1 - 0.04, y0: p.sill.y1 - 0.04 }, C.cyan, 0.005);
  liftBox(sink, p, p.pocket, C.steel);
  // The heads over the gates, which shut their openings to the top (G-289).
  for (const h of p.heads) liftBox(sink, p, h, C.steel);
  bakeButtonRims(sink, p);
  // A chevron over the door, pointing up: the way to the roof without a word.
  const cx = p.centre.x;
  const z = p.centre.z + out + 0.03;
  const y = ground + p.opening + 0.5;
  rod(sink, { x: cx - 0.45, y, z }, { x: cx, y: y + 0.35, z }, 0.07, C.magenta);
  rod(sink, { x: cx, y: y + 0.35, z }, { x: cx + 0.45, y, z }, 0.07, C.magenta);
};

/** The bridge's deck as drawn (a quad of the plan's outline, 0.3 m thick) and the cyan edges along its sides. */
const bakeBridge = (sink: MeshSink, p: AlchemiaLiftPlan): void => {
  const top = p.levels[1];
  const bottom = p.deck.y0;
  const [a, b, c, d] = p.bridge as readonly [Vec2, Vec2, Vec2, Vec2];
  const up = (q: Vec2, y: number): Vec => ({ x: q.x, y, z: q.z });
  sink.quad([up(a, top), up(b, top), up(c, top), up(d, top)], { x: 0, y: 1, z: 0 }, LIFT_COLORS.deck);
  sink.quad([up(a, bottom), up(b, bottom), up(c, bottom), up(d, bottom)], { x: 0, y: -1, z: 0 }, LIFT_COLORS.steel);
  const ring = [a, b, c, d];
  ring.forEach((q, i) => {
    const r = ring[(i + 1) % ring.length]!;
    const dx = r.x - q.x;
    const dz = r.z - q.z;
    const n = Math.hypot(dx, dz) || 1;
    sink.quad([up(q, bottom), up(r, bottom), up(r, top), up(q, top)], { x: dz / n, y: 0, z: -dx / n }, LIFT_COLORS.steel);
  });
  for (const [q, r] of [
    [a, b],
    [d, c],
  ] as const) {
    const side = q.x < p.centre.x ? -0.03 : 0.03;
    rod(sink, { x: q.x + side, y: bottom + 0.05, z: q.z }, { x: r.x + side, y: bottom + 0.05, z: r.z }, NEON, LIFT_COLORS.cyan);
  }
};

type Vec2 = { readonly x: number; readonly z: number };

/** A screen: glass to the handrail, posts, lit wires over it and the top rail. */
const bakeScreen = (sink: MeshSink, s: AlchemiaScreen, rail: number, quality: RenderQuality): void => {
  const dx = s.b.x - s.a.x;
  const dz = s.b.z - s.a.z;
  const len = Math.hypot(dx, dz);
  if (len < 1e-6) return;
  const rotY = Math.atan2(-dz, dx);
  const along = (t: number, y: number): Vec => ({ x: s.a.x + dx * t, y, z: s.a.z + dz * t });
  const mid = (y0: number, y1: number): Vec => along(0.5, (y0 + y1) / 2);
  sink.box(mid(s.floor, rail), len, rail - s.floor, 0.06, glass(quality), { rotY });
  sink.box(mid(rail, rail + 0.06), len, 0.06, 0.1, LIFT_COLORS.steel, { rotY });
  sink.box(mid(s.top - 0.05, s.top), len, 0.05, 0.08, LIFT_COLORS.steel, { rotY });
  for (let y = rail + WIRE_EVERY; y < s.top - 0.1; y += WIRE_EVERY) sink.box(mid(y, y + WIRE), len, WIRE, WIRE, LIFT_COLORS.cyan, { rotY });
  const posts = Math.max(1, Math.round(len / SCREEN_POST));
  for (let i = 0; i <= posts; i++) sink.box(along(i / posts, (s.floor + s.top) / 2), 0.06, s.top - s.floor, 0.06, LIFT_COLORS.steel, { rotY });
};

/** The whole lift: the shaft, the bridge and every screen. */
export const bakeAlchemiaLift = (sink: MeshSink, quality: RenderQuality = "high", p: AlchemiaLiftPlan = ALCHEMIA_LIFT): void => {
  bakeShaft(sink, p, quality);
  bakeBridge(sink, p);
  const rail = p.levels[1] + HANDRAIL;
  for (const s of p.screens) bakeScreen(sink, s, rail, quality);
};

/** The far stand-in: the shaft's glass box and its cap, a handful of triangles. */
export const bakeAlchemiaLiftFar = (sink: MeshSink, p: AlchemiaLiftPlan = ALCHEMIA_LIFT): void => {
  const out = p.half + p.wall;
  liftBox(sink, p, { x0: -out, x1: out, z0: -out, z1: out, y0: p.levels[0], y1: p.head }, glass("low"));
  liftBox(sink, p, p.walls[p.walls.length - 1]!, LIFT_COLORS.steel, 0.04);
};

/** True when the lift's shaft stands in a block of the street furniture. */
export const alchemiaLiftIn = (bounds: Box2, p: AlchemiaLiftPlan = ALCHEMIA_LIFT): boolean =>
  p.centre.x >= bounds.minX && p.centre.x < bounds.maxX && p.centre.z >= bounds.minZ && p.centre.z < bounds.maxZ;
