import type { MeshSink, Rgba } from "../../mesh-sink";
import { type FacadeFrame, type Wall, trimMeta } from "../facade-frame";
import { band } from "../facade-parts";
import { doorwaysOn, planesKind } from "../facade-plan";
import { addHipRoof } from "../roof-plan";
import { addPlanesRoof, roofLine } from "../roof-shapes";
import { type Uv, face, quadUv, vertex } from "../sink-ops";
import { SWATCH, archPanel, clearOf, onWall, panel, shownWalls, slabRing, solid } from "./kit";
import type { GableFace } from "./recipes";

/**
 * The kit's elements of a plastered classicist front (ADR-0062, Brama Grodzka): rustication up to
 * a string course over the passage's arch, a keystone, rows of framed windows with sills and
 * cornices over them, the data's own roof (`roof:shape`) and on a gable end a raking cornice
 * with a round window, a cartouche over a dated tablet or a lunette between blind niches. Baked
 * in world space into the cell's sink like the rest of the kit, within the data's solid (up to a
 * cornice's depth) and under its roof.
 */

/** Spacing of the rustication's joints, metres. */
const COURSE = 0.55;

/** World y of the string course's foot: half a metre over the highest mouth of a passage, else over the ground floor. */
export const stringCourse = (f: FacadeFrame): number => {
  const tops = (f.b.doorways ?? []).map((d) => d.top);
  return tops.length > 0 ? Math.max(...tops) + 0.5 : f.b.base + f.ground;
};

/** Horizontal joints of the rustication on the shown walls, from under the ground up to y1, off the mouths' arches. */
export const rustication = (sink: MeshSink, f: FacadeFrame, y1: number, color: Rgba): void => {
  const meta = trimMeta(f.style.seed);
  for (const w of shownWalls(f)) {
    for (const [u0, u1] of clearOf(f, w, 0.4)) {
      if (u1 - u0 < 0.3) continue;
      for (let y = y1 - COURSE; y > f.b.foot - 0.2; y -= COURSE) panel(sink, w, u0, u1, y - 0.03, y + 0.03, 0.015, color, meta);
    }
  }
};

/** The string course round the walls at y, and a keystone over each mouth's arch up into it. */
export const courseAndKeystones = (sink: MeshSink, f: FacadeFrame, y: number, color: Rgba): void => {
  const meta = trimMeta(f.style.seed);
  band(sink, f.b.ring, 0.14, y, y + 0.24, color, meta, f.b.base);
  for (const w of shownWalls(f)) {
    for (const o of f.b.doorways?.length ? doorwaysOn(w, f.b.doorways) : []) {
      const u = (o.u0 + o.u1) / 2;
      const q = (du: number, yy: number) => onWall(w, u + du, yy, 0.08);
      // From the arch's crown, wider at the top, as a voussoir: never down into the passage.
      quadUv(sink, [q(-0.22, o.top), q(0.22, o.top), q(0.3, y), q(-0.3, y)], { x: w.nx, y: 0, z: w.nz }, color, [[0, 0], [1, 0], [1, 1], [0, 1]], meta);
    }
  }
};

/** A window at (u, y): a plaster surround, dark glass with a cross of glazing bars, a sill and a cornice over it. */
const framedWindow = (sink: MeshSink, w: Wall, u: number, y: number, width: number, height: number, trim: Rgba, dark: Rgba, meta: Uv): void => {
  const hw = width / 2;
  const hh = height / 2;
  panel(sink, w, u - hw - 0.14, u + hw + 0.14, y - hh - 0.12, y + hh + 0.14, 0.03, trim, meta);
  panel(sink, w, u - hw, u + hw, y - hh, y + hh, 0.06, dark, meta);
  panel(sink, w, u - 0.025, u + 0.025, y - hh, y + hh, 0.09, trim, meta);
  panel(sink, w, u - hw, u + hw, y + hh * 0.3 - 0.025, y + hh * 0.3 + 0.025, 0.09, trim, meta);
  panel(sink, w, u - hw - 0.24, u + hw + 0.24, y - hh - 0.22, y - hh - 0.1, 0.1, trim, meta);
  panel(sink, w, u - hw - 0.26, u + hw + 0.26, y + hh + 0.18, y + hh + 0.32, 0.12, trim, meta);
};

/** Window axes along a wall: `n` of them `pitch` apart, centred on the mouth in it (else the wall), 0.8 m off its ends. */
export const windowAxes = (f: FacadeFrame, w: Wall, n: number, pitch: number): number[] => {
  const o = f.b.doorways?.length ? doorwaysOn(w, f.b.doorways)[0] : undefined;
  const half = (pitch * (n - 1)) / 2;
  const c = Math.min(Math.max(o ? (o.u0 + o.u1) / 2 : w.length / 2, 0.8 + half), w.length - 0.8 - half);
  return Array.from({ length: n }, (_, k) => c - half + pitch * k);
};

/** Rows of up to `per` framed windows on every shown wall between y0 and y1 (one per 2.2 m of wall at most), over the mouth's axis; none on an axis `clear` refuses (a neighbour in front of it). */
export const windowRows = (sink: MeshSink, f: FacadeFrame, rows: number, per: number, y0: number, y1: number, trim: Rgba, dark: Rgba, clear: (w: Wall, u0: number, u1: number) => boolean = () => true): void => {
  const meta = trimMeta(f.style.seed);
  const row = (y1 - y0) / rows;
  const height = Math.min(1.6, row * 0.6);
  // A storey's large window is about 1 x 1.6 m (Brama Grodzka).
  const width = Math.min(1.05, height * 0.64);
  if (height < 0.6) return;
  for (const w of shownWalls(f)) {
    const n = Math.min(per, Math.floor(w.length / 2.2));
    if (n < 1) continue;
    const axes = windowAxes(f, w, n, Math.min(2.3, (w.length - 1.6) / Math.max(n - 1, 1))).filter((u) => clear(w, u - width / 2 - 0.26, u + width / 2 + 0.26));
    for (let r = 0; r < rows; r++) for (const u of axes) framedWindow(sink, w, u, y0 + row * (r + 0.5), width, height, trim, dark, meta);
  }
};

/** A flat ellipse on the wall centred at (u, y), `rx` across and `ry` up. */
const disc = (sink: MeshSink, w: Wall, u: number, y: number, rx: number, out: number, color: Rgba, meta: Uv, ry = rx): void => {
  const n = { x: w.nx, y: 0, z: w.nz };
  const c = vertex(sink, onWall(w, u, y, out), n, color, [u, y], meta);
  const rim = Array.from({ length: 12 }, (_, k) => (k / 12) * Math.PI * 2).map((a) => vertex(sink, onWall(w, u + Math.cos(a) * rx, y + Math.sin(a) * ry, out), n, color, [u, y], meta));
  for (let k = 0; k < rim.length; k++) face(sink, c, rim[k] as number, rim[(k + 1) % rim.length] as number, n);
};

/** A gable end over a wall: the roof's line along it ([share, metres over the eaves]), its peak along the wall and its height, and the eaves' world y. */
export interface Gable {
  readonly line: readonly [number, number][];
  readonly u: number;
  readonly h: number;
  readonly y0: number;
}

/** The gable the data's pitched roof stands up over a wall, or null (no pitched roof, or under 1.2 m). */
export const gableOver = (f: FacadeFrame, w: Wall): Gable | null => {
  const kind = planesKind(f);
  if (!kind) return null;
  const line = roofLine(f, kind, f.b.roof ?? 0, w.a, w.b);
  const peak = line.reduce((p, q) => (q[1] > p[1] ? q : p));
  return peak[1] < 1.2 ? null : { line, u: peak[0] * w.length, h: peak[1], y0: f.top - 0.08 };
};

/** The dated tablet under a cartouche, metres over the eaves (centre) and its size: low in the gable, over the main cornice. */
export const TABLET = { at: 0.6, width: 2, height: 0.42 } as const;

/** A cartouche: an oval shield in a moulded frame with scrolls either side, and the dated tablet under it (its text is a sign). */
const cartouche = (sink: MeshSink, w: Wall, g: Gable, trim: Rgba, meta: Uv): void => {
  const y = g.y0 + g.h * 0.52;
  disc(sink, w, g.u, y, 0.55, 0.03, trim, meta, 0.68);
  disc(sink, w, g.u, y, 0.42, 0.06, solid(SWATCH.cartouche), meta, 0.54);
  for (const s of [-1, 1]) disc(sink, w, g.u + s * 0.62, y - 0.2, 0.13, 0.05, trim, meta, 0.2);
  const t = g.y0 + TABLET.at;
  panel(sink, w, g.u - TABLET.width / 2 - 0.1, g.u + TABLET.width / 2 + 0.1, t - TABLET.height / 2 - 0.1, t + TABLET.height / 2 + 0.1, 0.03, trim, meta);
  panel(sink, w, g.u - TABLET.width / 2, g.u + TABLET.width / 2, t - TABLET.height / 2, t + TABLET.height / 2, 0.06, solid(SWATCH.tablet), meta);
};

/** The lunette window's (and the blind niches') bottom and top over the eaves, their width and the niches' distance from the middle. */
export const LUNETTE = { from: 0.4, to: 1.6, width: 0.85, niche: 1.45 } as const;

/** A round-headed window in the middle of the gable between two blind round-headed niches. */
const lunette = (sink: MeshSink, w: Wall, g: Gable, trim: Rgba, dark: Rgba, meta: Uv): void => {
  const [y0, y1] = [g.y0 + LUNETTE.from, g.y0 + LUNETTE.to];
  archPanel(sink, w, g.u, LUNETTE.width + 0.24, y0 - 0.12, y1 + 0.12, 0.03, trim, meta, false);
  archPanel(sink, w, g.u, LUNETTE.width, y0, y1, 0.06, dark, meta, false);
  for (const s of [-1, 1]) archPanel(sink, w, g.u + s * LUNETTE.niche, LUNETTE.width, y0 + 0.1, y1 - 0.1, 0.02, solid(SWATCH.beigeNiche), meta, false);
};

/**
 * On each shown gable end of a pitched roof: a raking cornice under the roof's edge and the face
 * `faceOf` gives the wall (a round window, a cartouche over its tablet, or a lunette).
 */
export const gableTrim = (sink: MeshSink, f: FacadeFrame, trim: Rgba, dark: Rgba, faceOf: (w: Wall) => GableFace): void => {
  const meta = trimMeta(f.style.seed);
  for (const w of shownWalls(f)) {
    const g = gableOver(f, w);
    if (!g) continue;
    const n = { x: w.nx, y: 0, z: w.nz };
    for (let k = 0; k + 1 < g.line.length; k++) {
      const [t0, h0] = g.line[k] as [number, number];
      const [t1, h1] = g.line[k + 1] as [number, number];
      if (h0 < 0.05 && h1 < 0.05) continue;
      const q = (t: number, h: number) => onWall(w, t * w.length, g.y0 + h, 0.12);
      quadUv(sink, [q(t0, Math.max(h0 - 0.3, 0)), q(t1, Math.max(h1 - 0.3, 0)), q(t1, h1), q(t0, h0)], n, trim, [[0, 0], [1, 0], [1, 1], [0, 1]], meta);
    }
    const face = faceOf(w);
    if (face === "cartouche") cartouche(sink, w, g, trim, meta);
    else if (face === "lunette") lunette(sink, w, g, trim, dark, meta);
    else {
      const r = Math.min(0.45, g.h * 0.14);
      disc(sink, w, g.u, g.y0 + g.h * 0.4, r + 0.12, 0.03, trim, meta);
      disc(sink, w, g.u, g.y0 + g.h * 0.4, r, 0.06, dark, meta);
    }
  }
};

/** The data's own roof (`roof:shape`, ADR-0064) in the kit's tiles: planes, hipped or a pyramid, else flat. */
export const dataRoof = (sink: MeshSink, f: FacadeFrame, wall: Rgba, trim: Rgba, near: boolean): void => {
  const rise = f.b.roof ?? 0;
  const tile = solid(SWATCH.tile);
  const planes = planesKind(f);
  if (planes) addPlanesRoof(sink, f, planes, rise, { roof: tile, wall, trim }, near);
  else if (rise > 0.3 && (f.style.roof === "hip" || f.style.roof === "pyramid")) addHipRoof(sink, f, rise, tile, trim, near, f.style.roof === "pyramid");
  else slabRing(sink, f.b.ring, f.top, tile, trimMeta(f.style.seed));
};
