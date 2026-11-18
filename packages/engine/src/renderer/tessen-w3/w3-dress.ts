import type { Vec3 } from "@seki/core";
import { W3_AIRLOCKS, W3_GATE, W3_LAYOUT, W3_PLATFORM, W3_ROOF, W3_TOWER, W3_Y } from "@seki/sim";
import { neonText, neonWidth } from "../alchemia/neon-letters";
import { type CityKitData, type GeometrySink } from "../city-kit-data";
import { W3_CHAMBER_DRONES, W3_ROOF_PADS, W3_TEST_DRONE, paintDrone, paintPad } from "./w3-drones";
import { FLOOR_TOP } from "./w3-inside-geometry";
import { KitPainter, W3_PAINT } from "./w3-kit";
import { W3_WORDS, paintLettering } from "./w3-lettering";

/**
 * Tessen's 2077 layer on W-3 (ADR-0082 stage 4, pictures 01, 02 and 04), baked into the hall's two
 * meshes on the city kit's swatches: no draw call of its own. Outside (the outer mesh, drawn to
 * 400 m): the neon TESSEN over the wagon gate in letters like ALCHEMIA's (TESS red, EN blue, as on
 * picture 01) on its dark board, the gate's graphite frame and lamps, the yellow and black safety
 * stripes on its leaf and threshold, the plant's stencilled words, the tower's cabin lit red behind
 * dark mullions, floodlights, the drones on their frames on the roofs. Inside (the inside mesh,
 * near only): the drones in the test chamber, its sector's name and the stripes at its gate.
 * Pure data.
 */

const WEST: Vec3 = { x: -1, y: 0, z: 0 };
const UP: Vec3 = { x: 0, y: 1, z: 0 };

/** The neon sign over the wagon gate: its board's face (x) and the letters' height and foot over the floor. */
export const W3_NEON = { face: W3_GATE.x - 0.22, height: 2, foot: 7.95, board: { bottom: 7.7, top: 10.2 } } as const;
const GATE_MID = (W3_GATE.minZ + W3_GATE.maxZ) / 2;

/** The cabin of the tower's glass (`tower-pipes.ts`): the red lit band goes round it, just outside. */
export const W3_CABIN = { minX: 2487, maxX: 2495, minZ: 437, maxZ: 445, bottom: 24, top: 28 } as const;

/** The neon TESSEN on its board on the airlocks' west wall, read from the river (its right is south). */
const neonSign = (k: KitPainter): void => {
  const n = W3_NEON;
  const x = n.face;
  const half = neonWidth("TESSEN", n.height) / 2 + 0.6;
  k.box(x, W3_GATE.x - 0.01, W3_Y + n.board.bottom, W3_Y + n.board.top, GATE_MID - half, GATE_MID + half, "sign-back");
  for (const s of neonText("TESSEN", n.height)) {
    const swatch = s.letter < 4 ? "neon-red" : "neon-blue";
    k.box(x - 0.08, x, W3_Y + n.foot + s.y0, W3_Y + n.foot + s.y1, GATE_MID - s.x1, GATE_MID - s.x0, swatch);
  }
};

/**
 * Yellow and black stripes at 45 degrees on a flat band: from `o` along `u` for `length`, up `v`
 * for `width`, facing `n`. The stripes' ends are cut square at the band's ends.
 */
export const hazardBand = (k: KitPainter, o: Vec3, u: Vec3, v: Vec3, n: Vec3, length: number, width: number, period = 0.6): void => {
  const p = (a: number, b: number): Vec3 => ({ x: o.x + u.x * a + v.x * b, y: o.y + u.y * a + v.y * b, z: o.z + u.z * a + v.z * b });
  const lift = (q: Vec3): Vec3 => ({ x: q.x + n.x * 0.004, y: q.y + n.y * 0.004, z: q.z + n.z * 0.004 });
  k.quad(p(0, 0), p(length, 0), p(length, width), p(0, width), n, "dark");
  const clamp = (a: number) => Math.max(0, Math.min(length, a));
  for (let a = -width; a < length; a += period) {
    const [a0, a1] = [clamp(a), clamp(a + period / 2)];
    const [b0, b1] = [clamp(a + width), clamp(a + width + period / 2)];
    if (a1 - a0 < 1e-3 && b1 - b0 < 1e-3) continue;
    k.quad(lift(p(a0, 0)), lift(p(a1, 0)), lift(p(b1, width)), lift(p(b0, width)), n, "paint", W3_PAINT.yellow);
  }
};

/** The gate: a graphite frame round it, lamps under its lintel, stripes along its leaf's foot and on its threshold. */
const gate = (k: KitPainter): void => {
  const x = W3_GATE.x;
  const g = W3_GATE;
  const y = (h: number) => W3_Y + h;
  // The frame: posts either side and a band over the lintel, 8 cm proud of the wall.
  for (const z of [g.minZ - 1.1, g.maxZ + 0.3]) k.box(x - 0.08, x, y(0), y(g.height + 0.6), z, z + 0.8, "paint", W3_PAINT.graphite);
  // Red marker lights up the posts' faces, as on picture 01.
  for (const z of [g.minZ - 0.7, g.maxZ + 0.7]) k.box(x - 0.11, x - 0.08, y(2.6), y(6.4), z - 0.06, z + 0.06, "neon-red");
  // Three cold lamps under the lintel over the leaf.
  for (const dz of [-2.8, 0, 2.8]) k.box(x - 0.6, x - 0.36, y(g.height - 0.08), y(g.height), GATE_MID + dz - 0.5, GATE_MID + dz + 0.5, "win-white");
  // Stripes along the shut leaf's foot (its face at x - 0.25) and across the threshold outside.
  const leaf = x - 0.25 - 0.006;
  hazardBand(k, { x: leaf, y: y(0.15), z: g.maxZ }, { x: 0, y: 0, z: -1 }, UP, WEST, g.maxZ - g.minZ, 0.9);
  // Over the yard's asphalt on the pad levelled to within 5 cm (ADR-0082 stage 1).
  hazardBand(k, { x: x - 2.1, y: y(FLOOR_TOP + 0.05), z: g.maxZ }, { x: 0, y: 0, z: -1 }, { x: 1, y: 0, z: 0 }, UP, g.maxZ - g.minZ, 1.1, 0.9);
};

/** The plant's words on the airlocks' west wall and the tower's, in white and red paint as on picture 01. */
const words = (k: KitPainter): void => {
  const x = W3_AIRLOCKS.minX;
  const north = (W3_GATE.maxZ + 0.3 + 0.8 + W3_AIRLOCKS.maxZ) / 2;
  paintLettering(k, { text: W3_WORDS.plant, at: { x, y: W3_Y + 6.1, z: north }, normal: WEST, height: 0.44, swatch: "paint", tint: W3_PAINT.white });
  paintLettering(k, { text: W3_WORDS.sector, at: { x, y: W3_Y + 5, z: north }, normal: WEST, height: 0.6, swatch: "paint", tint: W3_PAINT.white });
  paintLettering(k, { text: W3_WORDS.secret, at: { x: x - 0.25, y: W3_Y + 2.3, z: GATE_MID + 1 }, normal: WEST, height: 0.4, swatch: "paint", tint: W3_PAINT.red });
  const south = (W3_AIRLOCKS.minZ + W3_LAYOUT.AIRLOCK_S_DOOR + 0.8) / 2 + 0.6;
  paintLettering(k, { text: W3_WORDS.secret, at: { x, y: W3_Y + 3.1, z: south }, normal: WEST, height: 0.3, swatch: "paint", tint: W3_PAINT.red });
  const t = W3_TOWER;
  paintLettering(k, { text: W3_WORDS.tower, at: { x: t.minX, y: W3_Y + 5.4, z: (t.minZ + t.maxZ) / 2 }, normal: WEST, height: 2.4, swatch: "paint", tint: W3_PAINT.white });
};

/**
 * The cabin lit red (ADR-0082: "kabina z czerwonym szkłem", picture 01): round its glass, just
 * outside it, a dark sill and head, dark mullions and four red lit panes a face, their lower part
 * dark where the consoles stand. Nothing inside: the cabin's room is the simulation's.
 */
const cabin = (k: KitPainter): void => {
  const c = W3_CABIN;
  const out = 0.04;
  const y = (h: number) => W3_Y + h;
  const faces = [
    { n: { x: 0, z: -1 }, fixed: c.minZ - out, from: c.minX, to: c.maxX },
    { n: { x: 0, z: 1 }, fixed: c.maxZ + out, from: c.minX, to: c.maxX },
    { n: { x: -1, z: 0 }, fixed: c.minX - out, from: c.minZ, to: c.maxZ },
    { n: { x: 1, z: 0 }, fixed: c.maxX + out, from: c.minZ, to: c.maxZ },
  ];
  for (const f of faces) {
    const along = f.n.x === 0;
    const slab = (a0: number, a1: number, y0: number, y1: number, depth: number, swatch: string): void => {
      const [d0, d1] = [Math.min(f.fixed, f.fixed + (f.n.x + f.n.z) * depth), Math.max(f.fixed, f.fixed + (f.n.x + f.n.z) * depth)];
      if (along) k.box(a0, a1, y0, y1, d0, d1, swatch);
      else k.box(d0, d1, y0, y1, a0, a1, swatch);
    };
    slab(f.from - out, f.to + out, y(c.bottom), y(c.bottom + 0.5), 0.12, "trim");
    slab(f.from - out, f.to + out, y(c.top - 0.35), y(c.top), 0.12, "trim");
    const panes = 4;
    const w = (f.to - f.from) / panes;
    for (let i = 0; i < panes; i++) {
      const a0 = f.from + i * w + 0.1;
      const a1 = f.from + (i + 1) * w - 0.1;
      slab(a0, a1, y(c.bottom + 0.5), y(c.bottom + 1.3), 0.02, "glass-dark");
      slab(a0, a1, y(c.bottom + 1.3), y(c.top - 0.35), 0.02, "taillight");
    }
    for (let i = 0; i <= panes; i++) slab(f.from + i * w - 0.1, f.from + i * w + 0.1, y(c.bottom + 0.5), y(c.top - 0.35), 0.08, "dark");
  }
};

/** Floodlights: two on the tower's platform over the quay and the pier, two on the airlocks' roof over the yard. */
export const W3_FLOODLIGHTS: readonly { readonly at: Vec3; readonly yaw: number }[] = [
  { at: { x: W3_TOWER.minX + 0.4, y: W3_Y + W3_PLATFORM + 1.6, z: W3_TOWER.minZ + 0.6 }, yaw: -2.3 },
  { at: { x: W3_TOWER.minX + 0.4, y: W3_Y + W3_PLATFORM + 1.6, z: W3_TOWER.maxZ - 0.6 }, yaw: -1.2 },
  { at: { x: W3_AIRLOCKS.minX + 0.6, y: W3_Y + W3_ROOF + 1.6, z: W3_AIRLOCKS.minZ + 0.6 }, yaw: -1.9 },
  { at: { x: W3_AIRLOCKS.minX + 0.6, y: W3_Y + W3_ROOF + 1.6, z: W3_AIRLOCKS.maxZ - 0.6 }, yaw: -1.25 },
];

/** A floodlight's post this tall from the platform or roof under it. */
const POST = 1.6;

const floodlight = (k: KitPainter, at: Vec3, yaw: number): void => {
  k.box(at.x - 0.06, at.x + 0.06, at.y - POST, at.y - 0.2, at.z - 0.06, at.z + 0.06, "metal");
  const f = { x: Math.sin(yaw), z: Math.cos(yaw) };
  k.turned({ x: at.x, y: at.y, z: at.z }, yaw, 0.35, 0.22, 0.18, "dark");
  k.turned({ x: at.x + f.x * 0.19, y: at.y, z: at.z + f.z * 0.19 }, yaw, 0.3, 0.17, 0.01, "headlight");
};

/** The drones on their frames on the roofs, noses to the river. */
const roofDrones = (k: KitPainter): void => {
  W3_ROOF_PADS.forEach((p, i) => paintPad(k, p, -Math.PI / 2 + (i - 1) * 0.5));
};

/**
 * The test chamber inside: its sector's name over the gate from the hall, stripes up its jambs, the
 * drones. The assembly hall's drawn shell has a face a few millimetres before the chamber's wall
 * there (its doorway's column alone is clear), so the words stand 8 cm off it, as on a plate.
 */
const chamber = (k: KitPainter): void => {
  const face = 2548 - W3_LAYOUT.WALL;
  const gw = W3_LAYOUT.CHAMBER_GATE_W;
  const mid = (gw.minZ + gw.maxZ) / 2;
  paintLettering(k, { text: W3_WORDS.sector, at: { x: face, y: W3_Y + 8.4, z: mid }, normal: WEST, height: 0.9, swatch: "paint", tint: W3_PAINT.white, off: 0.08 });
  paintLettering(k, { text: W3_WORDS.secret, at: { x: face, y: W3_Y + 7.3, z: mid }, normal: WEST, height: 0.45, swatch: "paint", tint: W3_PAINT.red, off: 0.08 });
  for (const z of [gw.minZ - 0.5, gw.maxZ]) hazardBand(k, { x: face - 0.006, y: W3_Y + FLOOR_TOP, z: z + 0.5 }, UP, { x: 0, y: 0, z: -1 }, WEST, gw.height, 0.5, 0.7);
  for (const d of W3_CHAMBER_DRONES) paintDrone(k, d);
  paintDrone(k, W3_TEST_DRONE);
  // The test drone's four tethers to the launch pad's corners.
  const t = W3_TEST_DRONE.at;
  for (const [dx, dz] of [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ] as const) {
    k.beam({ x: t.x + dx * 0.5, y: t.y + 0.3, z: t.z + dz * 0.5 }, { x: t.x + dx * 4.5, y: W3_Y + FLOOR_TOP, z: t.z + dz * 4.5 }, 0.04, "cable");
  }
};

/** Tessen's 2077 layer painted onto the hall's two sinks (`w3InsideGeometry`'s). */
export const w3Dress = (data: CityKitData, sinks: { readonly inside: GeometrySink; readonly outer: GeometrySink }): void => {
  const outer = new KitPainter(sinks.outer, data);
  neonSign(outer);
  gate(outer);
  words(outer);
  cabin(outer);
  for (const f of W3_FLOODLIGHTS) floodlight(outer, f.at, f.yaw);
  roofDrones(outer);
  chamber(new KitPainter(sinks.inside, data));
};
