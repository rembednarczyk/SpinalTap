import { groundY } from "@seki/sim";
import type { Box2 } from "../mapcity/polygon";
import { MAP_SIGN_KIND, signTint } from "../mapcity/sign-plan";
import { type Uv, quadUv } from "../mapcity/sink-ops";
import { glyphAdvance, glyphCell } from "../mapcity/venue-plan";
import type { MeshSink, Rgba, Vec } from "../mesh-sink";

/*
 * The neons of the deptak on Lubartowska (ADR-0074 C7, the board `docs/world/koncepty/alchemia/01-rozbudowa-front.jpg`):
 * the board hangs them on the tenement across the deptak from Alchemia's front (w66286394, the east
 * frontage between Bajkowskiego and Olejna, OSM): an upright cyan SPOŻYWCZY low by its south end, a
 * red SPOŻYWCZY board sticking out over the shop further on, an upright cyan ALCHEMIA high up beyond
 * it and a red PARKING CAŁODOBOWY board on its top storey, pointing the way to the car park.
 * Pattern: the blade sign (a projecting sign, perpendicular to the facade, read along the street from
 * both ways; the city's own blades, `sign-plan.ts`), and the fascia board flat on the wall. Light only,
 * in the map city's signs' mesh of the tenement's cell, as the city's blades on its walls: no draw call,
 * no mesh, no solid, and not near only (the tenement is the map's, drawn as far as its signs). The
 * letters are the glyph atlas's (ADR-0064); proper names and the world's words on a sign, the same in
 * every language (ADR-0056, §9 of `docs/zasady-lokacji.md`). Pure data.
 */

/** A straight run of the tenement's west wall over the deptak (OSM w66286394, world metres), south to north. */
interface Wall {
  readonly a: { readonly x: number; readonly z: number };
  readonly b: { readonly x: number; readonly z: number };
}
/** Its south run, from the corner on Bajkowskiego's side to its bay, and its north run, from the bay to w364550281. */
export const TENEMENT_WALLS: readonly [Wall, Wall] = [
  { a: { x: 452.7, z: -11.6 }, b: { x: 454.2, z: -4.0 } },
  { a: { x: 455.1, z: 2.0 }, b: { x: 456.1, z: 9.7 } },
];

/** A wall's way along (south to north) and out of it (west, over the deptak), level. */
const along = (w: Wall): Vec => {
  const [dx, dz] = [w.b.x - w.a.x, w.b.z - w.a.z];
  const l = Math.hypot(dx, dz);
  return { x: dx / l, y: 0, z: dz / l };
};
const outOf = (w: Wall): Vec => {
  const t = along(w);
  return { x: -t.z, y: 0, z: t.x };
};
/** The point of a wall's line at `z`. */
const onWall = (w: Wall, z: number): Vec => {
  const t = (z - w.a.z) / (w.b.z - w.a.z);
  return { x: w.a.x + (w.b.x - w.a.x) * t, y: 0, z };
};

export type DeptakSign =
  /** An upright blade out of the wall, `out` from it, its letters one under another on both faces. */
  | { readonly kind: "blade"; readonly text: string; readonly wall: 0 | 1; readonly z: number; readonly y0: number; readonly y1: number; readonly out: readonly [number, number]; readonly tint: string }
  /** A board sticking out of the wall, its letters along it on both faces. */
  | { readonly kind: "board"; readonly text: string; readonly wall: 0 | 1; readonly z: number; readonly y0: number; readonly y1: number; readonly out: readonly [number, number]; readonly tint: string }
  /** A board flat on the wall, `width` along it centred on `z`, a line or two. */
  | { readonly kind: "fascia"; readonly lines: readonly string[]; readonly wall: 0 | 1; readonly z: number; readonly y0: number; readonly y1: number; readonly width: number; readonly tint: string };

/** The pavement at the wall's foot, a metre out of it: the signs' heights are over it. */
const footY = (wall: 0 | 1, z: number): number => {
  const w = TENEMENT_WALLS[wall];
  const p = onWall(w, z);
  const o = outOf(w);
  return groundY(p.x + o.x, p.z + o.z);
};
const over = (wall: 0 | 1, z: number, h: number): number => Math.round((footY(wall, z) + h) * 100) / 100;

const CYAN = "#38dcff";
const RED = "#ff2a3c";

/** The board's signs, south to north: the lower SPOŻYWCZY blade, the PARKING board over it, the red SPOŻYWCZY board, the ALCHEMIA blade. */
export const DEPTAK_SIGNS: readonly DeptakSign[] = [
  { kind: "blade", text: "SPOŻYWCZY", wall: 0, z: -8.6, y0: over(0, -8.6, 2.8), y1: over(0, -8.6, 6.4), out: [0.3, 1.1], tint: CYAN },
  { kind: "fascia", lines: ["PARKING", "CAŁODOBOWY"], wall: 0, z: -6.4, y0: over(0, -6.4, 7.4), y1: over(0, -6.4, 9.0), width: 3.6, tint: RED },
  { kind: "board", text: "SPOŻYWCZY", wall: 1, z: 4.2, y0: over(1, 4.2, 3.3), y1: over(1, 4.2, 4.05), out: [0.35, 3.0], tint: RED },
  { kind: "blade", text: "ALCHEMIA", wall: 1, z: 8.4, y0: over(1, 8.4, 4.4), y1: over(1, 8.4, 9.9), out: [0.3, 1.25], tint: CYAN },
];

const UV: readonly [Uv, Uv, Uv, Uv] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];
/** The same quad's corners with u running up its height: a tall board's rim (`venue`) measured along its long side. */
const UV_UP: readonly [Uv, Uv, Uv, Uv] = [
  [0, 0],
  [0, 1],
  [1, 1],
  [1, 0],
];

/** A flat quad centred at `c` facing along `n`, `w` across (to a reader's right) and `h` up. */
const flat = (sink: MeshSink, c: Vec, n: Vec, w: number, h: number, color: Rgba, uv2: Uv, uv = UV): void => {
  const right: Vec = { x: -n.z, y: 0, z: n.x };
  const p = (sx: number, sy: number): Vec => ({ x: c.x + (right.x * sx * w) / 2, y: c.y + (sy * h) / 2, z: c.z + (right.z * sx * w) / 2 });
  quadUv(sink, [p(-1, -1), p(1, -1), p(1, 1), p(-1, 1)], n, color, uv, uv2);
};

/** A board's face: a neon rim round a glow (the venues' boards' kind), its seed its long side over its short. */
const face = (sink: MeshSink, c: Vec, n: Vec, w: number, h: number, tint: string, glow: number): void => {
  if (w >= h) flat(sink, c, n, w, h, signTint(tint, glow), [w / h, MAP_SIGN_KIND.venue]);
  else flat(sink, c, n, w, h, signTint(tint, glow), [h / w, MAP_SIGN_KIND.venue], UV_UP);
};

/** A letter of the atlas centred at `c` on a face looking along `n`, its cell `h` high. */
const letter = (sink: MeshSink, ch: string, c: Vec, n: Vec, h: number, color: Rgba): boolean => {
  const cell = glyphCell(ch);
  if (cell === null || ch === " ") return false;
  flat(sink, c, n, glyphAdvance(ch) * h, h, color, [cell + Math.min(glyphAdvance(ch), 0.98), MAP_SIGN_KIND.glyph]);
  return true;
};

/** Where in its cell the atlas's letter sits: its middle this much of the cell under the cell's. */
const GLYPH_DROP = 0.06;
/** A letter's capital is some half of its cell's height (ADR-0064). */
const CAP = 0.5;
/** The letters' white, and the halo round the cyan ones (as the front's sign, C4). */
const WHITE = "#f4fdff";
const HALOS = [
  { scale: 1.05, brightness: 0.75 },
  { scale: 1.16, brightness: 0.25 },
] as const;

/** A line of letters centred at `c` along a face looking along `n`, their cells `h` high, squeezed into `room`. */
const line = (sink: MeshSink, text: string, c: Vec, n: Vec, h: number, room: number, color: Rgba): number => {
  const right: Vec = { x: -n.z, y: 0, z: n.x };
  const natural = [...text].reduce((s, ch) => s + glyphAdvance(ch), 0) * h;
  const k = Math.min(1, room / natural);
  let x = -(natural * k) / 2;
  let drawn = 0;
  for (const ch of text) {
    const w = glyphAdvance(ch) * h * k;
    const at = { x: c.x + right.x * (x + w / 2), y: c.y, z: c.z + right.z * (x + w / 2) };
    const cell = glyphCell(ch);
    if (cell !== null && ch !== " ") {
      flat(sink, at, n, w, h, color, [cell + Math.min(glyphAdvance(ch), 0.98), MAP_SIGN_KIND.glyph]);
      drawn++;
    }
    x += w;
  }
  return drawn;
};

/** Off a face, the letters and the glow hang this far (m). */
const OFF = 0.02;

/** A blade's two faces, back to back along the wall: its rim and glow, its letters one under another, the cyan ones haloed. */
const blade = (sink: MeshSink, s: Extract<DeptakSign, { kind: "blade" }>): number => {
  const w = TENEMENT_WALLS[s.wall];
  const [t, o] = [along(w), outOf(w)];
  const base = onWall(w, s.z);
  const mid = (s.out[0] + s.out[1]) / 2;
  const width = s.out[1] - s.out[0];
  const height = s.y1 - s.y0;
  const n = [...s.text].filter((ch) => ch !== " ").length;
  // Each letter a step of the height; its cell twice its capital, no wider than the blade inside its rim.
  const step = (height - 0.3) / n;
  const widest = Math.max(...[...s.text].map(glyphAdvance));
  const cell = Math.min(step / CAP / 1.15, (width - 0.16) / widest);
  let drawn = 0;
  for (const side of [1, -1]) {
    const nrm: Vec = { x: t.x * side, y: 0, z: t.z * side };
    const c = (y: number, off: number): Vec => ({ x: base.x + o.x * mid + nrm.x * off, y, z: base.z + o.z * mid + nrm.z * off });
    face(sink, c((s.y0 + s.y1) / 2, OFF), nrm, width, height, s.tint, 1.4);
    [...s.text].forEach((ch, i) => {
      const y = s.y1 - 0.15 - step * (i + 0.5) + GLYPH_DROP * cell;
      for (const h of HALOS) letter(sink, ch, c(y, OFF * 1.5), nrm, cell * h.scale, signTint(s.tint, h.brightness));
      if (letter(sink, ch, c(y, OFF * 2), nrm, cell, signTint(WHITE, 1.3))) drawn++;
    });
  }
  return drawn;
};

/** A board sticking out of the wall: both faces lit red, its white letters along it. */
const board = (sink: MeshSink, s: Extract<DeptakSign, { kind: "board" }>): number => {
  const w = TENEMENT_WALLS[s.wall];
  const [t, o] = [along(w), outOf(w)];
  const base = onWall(w, s.z);
  const mid = (s.out[0] + s.out[1]) / 2;
  const [length, height] = [s.out[1] - s.out[0], s.y1 - s.y0];
  let drawn = 0;
  for (const side of [1, -1]) {
    const nrm: Vec = { x: t.x * side, y: 0, z: t.z * side };
    const c = (y: number, off: number): Vec => ({ x: base.x + o.x * mid + nrm.x * off, y, z: base.z + o.z * mid + nrm.z * off });
    // Twice: the red glow of a lit box, not a rim round the dark.
    face(sink, c((s.y0 + s.y1) / 2, OFF), nrm, length, height, s.tint, 3.2);
    face(sink, c((s.y0 + s.y1) / 2, OFF * 1.2), nrm, length - 0.08, height - 0.08, s.tint, 2.2);
    const cell = (height - 0.2) / CAP / 1.15;
    drawn += line(sink, s.text, c((s.y0 + s.y1) / 2 + GLYPH_DROP * cell, OFF * 2), nrm, cell, length - 0.3, signTint(WHITE, 1.4));
  }
  return drawn;
};

/** A board flat on the wall facing the deptak: lit red, its lines white, the first the larger. */
const fascia = (sink: MeshSink, s: Extract<DeptakSign, { kind: "fascia" }>): number => {
  const w = TENEMENT_WALLS[s.wall];
  const o = outOf(w);
  const base = onWall(w, s.z);
  const height = s.y1 - s.y0;
  const c = (y: number, off: number): Vec => ({ x: base.x + o.x * off, y, z: base.z + o.z * off });
  face(sink, c((s.y0 + s.y1) / 2, 0.06), o, s.width, height, s.tint, 3.2);
  face(sink, c((s.y0 + s.y1) / 2, 0.065), o, s.width - 0.1, height - 0.1, s.tint, 2.2);
  // The first line some 0.58 of the board's inside, the second the rest, as the board's PARKING over CAŁODOBOWY.
  const inner = height - 0.2;
  const [big, small] = [inner * 0.58, inner * 0.42];
  let drawn = line(sink, s.lines[0] ?? "", c(s.y1 - 0.1 - big / 2 + GLYPH_DROP * (big / CAP / 1.1), 0.075), o, big / CAP / 1.1, s.width - 0.3, signTint(WHITE, 1.4));
  if (s.lines[1]) drawn += line(sink, s.lines[1], c(s.y0 + 0.1 + small / 2 + GLYPH_DROP * (small / CAP / 1.1), 0.075), o, small / CAP / 1.1, s.width - 0.3, signTint(WHITE, 1.3));
  return drawn;
};

/** Where a sign hangs: its wall's point at its `z`. */
export const signAt = (s: DeptakSign): Vec => onWall(TENEMENT_WALLS[s.wall], s.z);

const inside = (b: Box2, p: Vec): boolean => p.x >= b.minX && p.x < b.maxX && p.z >= b.minZ && p.z < b.maxZ;

/**
 * The deptak's neons standing in a cell of the map city (by where each hangs). The cell builder calls
 * it only for a cell that has signs already, so it never makes a mesh of its own. Returns how many
 * letters it drew.
 */
export const planDeptakSigns = (sink: MeshSink, bounds: Box2, signs: readonly DeptakSign[] = DEPTAK_SIGNS): number => {
  let drawn = 0;
  for (const s of signs) {
    if (!inside(bounds, signAt(s))) continue;
    drawn += s.kind === "blade" ? blade(sink, s) : s.kind === "board" ? board(sink, s) : fascia(sink, s);
  }
  return drawn;
};
