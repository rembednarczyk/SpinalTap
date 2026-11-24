import type { MeshSink, Rgba, Vec } from "../../mesh-sink";
import { type Wall, trimMeta } from "../facade-frame";
import { band } from "../facade-parts";
import type { P2 } from "../polygon";
import { quadUv } from "../sink-ops";
import { SWATCH, archPanel, clockFace, helmBase, lit, revolve, solid } from "./kit";
import type { LandmarkFrame } from "./landmark-frame";
import { mast } from "./layer2077";
import type { SpireCrown } from "./recipe-types";

/**
 * A neo-Gothic tower's top (Wieża Trynitarska, Corazzi 1819, T-349 stage K4): on the square body's
 * cornice a steep gable over the middle of each side with a clock in it, a slim octagonal pinnacle
 * on each corner, and between them a tall octagonal copper spire with its ball and, in Lublin 2077,
 * a mast with a red obstruction light (ICAO Annex 14, as the cranes'); on the body pointed windows
 * in pairs. Heights from GUGiK LoD2 and NMPT (`corrections-katedra.ts`): the body's cornice at y
 * 25.5 (NMPT's ring at 24-27), the gables' peaks 37.5 (NMPT 37-39 on the sides' middles), the spire
 * broad to the gables' tops (NMPT 12-13 m at y 37, 7-8 m at 46) and to its tip at 58.6 (LoD2's ridge). Pattern: the Gothic Revival tower top of gabled faces round a broach spire
 * (Pugin's "wimpergs" and pinnacles), cut down to the elements the photograph shows.
 */

/** The body as a square: its middle, the unit direction of its first side's normal and the half-sides along it and across. */
interface Square {
  readonly c: P2;
  readonly d: P2;
  readonly half: readonly [number, number];
}

const squareOf = (ring: readonly P2[]): Square => {
  const b = helmBase(ring);
  const a = b.phase + Math.PI / 8;
  const d = { x: Math.cos(a), z: Math.sin(a) };
  const reach = (u: P2) => Math.max(...ring.map((p) => (p.x - b.c.x) * u.x + (p.z - b.c.z) * u.z));
  const hu = (reach(d) + reach({ x: -d.x, z: -d.z })) / 2;
  const hv = (reach({ x: -d.z, z: d.x }) + reach({ x: d.z, z: -d.x })) / 2;
  return { c: b.c, d, half: [hu, hv] };
};

/** The four sides as walls of the kit (outward normal, running left to right seen from outside), `inset` metres in from the body's faces. */
const sidesOf = (s: Square, inset = 0): Wall[] =>
  [0, 1, 2, 3].map((k) => {
    const a = Math.atan2(s.d.z, s.d.x) + (k * Math.PI) / 2;
    const n = { x: Math.cos(a), z: Math.sin(a) };
    const t = { x: -n.z, z: n.x };
    const [h, w] = k % 2 === 0 ? s.half : [s.half[1], s.half[0]];
    const m = { x: s.c.x + n.x * (h - inset), z: s.c.z + n.z * (h - inset) };
    return { a: { x: m.x - t.x * w, z: m.z - t.z * w }, b: { x: m.x + t.x * w, z: m.z + t.z * w }, length: 2 * w, nx: n.x, nz: n.z, blind: false, coveredTo: -Infinity, hiddenTo: -Infinity, bay: 0 };
  });

const UV: [[number, number], [number, number], [number, number], [number, number]] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];

const along = (w: Wall, u: number, y: number, out: number): Vec => {
  const dx = (w.b.x - w.a.x) / w.length;
  const dz = (w.b.z - w.a.z) / w.length;
  return { x: w.a.x + dx * u + w.nx * out, y, z: w.a.z + dz * u + w.nz * out };
};

/** A gable over the side from y0 up `h` metres, `width` wide at its foot: its face, `depth` metres thick, a copper coping on both slopes. */
const gable = (sink: MeshSink, w: Wall, y0: number, h: number, width: number, depth: number, wall: Rgba, roof: Rgba, meta: [number, number]): void => {
  const m = w.length / 2;
  const n = { x: w.nx, y: 0, z: w.nz };
  const [l, r, top] = [along(w, m - width / 2, y0, 0.25), along(w, m + width / 2, y0, 0.25), along(w, m, y0 + h, 0.25)];
  // The face as a quad with its two top corners at the apex (a triangle in the kit's quads).
  quadUv(sink, [l, r, top, top], n, wall, UV, meta);
  const back = (p: Vec): Vec => ({ x: p.x - w.nx * depth, y: p.y, z: p.z - w.nz * depth });
  for (const [p, q] of [
    [l, top],
    [top, r],
  ] as const) {
    const s = { x: q.x - p.x, y: q.y - p.y, z: q.z - p.z };
    const up = { x: -w.nx * s.y, y: Math.hypot(s.x, s.z), z: -w.nz * s.y };
    const len = Math.hypot(up.x, up.y, up.z) || 1;
    quadUv(sink, [p, q, back(q), back(p)], { x: up.x / len, y: up.y / len, z: up.z / len }, roof, UV, meta);
  }
};

/** A corner pinnacle: an octagonal shaft from y0 to y1 and its pointed copper cap to y2, with a small ball. */
const pinnacle = (sink: MeshSink, at: P2, y0: number, y1: number, y2: number, r: number, wall: Rgba, roof: Rgba, meta: [number, number]): void => {
  revolve(sink, { x: at.x, y: y0, z: at.z }, [
    [r, 0],
    [r, y1 - y0],
    [r * 1.15, y1 - y0],
    [0.04, y2 - y0],
  ], 8, Math.PI / 8, wall, meta);
  revolve(sink, { x: at.x, y: y1, z: at.z }, [
    [r * 1.18, 0],
    [0.04, y2 - y1],
  ], 8, Math.PI / 8, roof, meta);
  sink.box({ x: at.x, y: y2 + 0.08, z: at.z }, 0.16, 0.16, 0.16, solid(SWATCH.gold));
};

/** The tower's pointed windows in pairs on each side: one pair a storey, the storeys `rows` ([bottom, top] over the base). */
export const towerWindows = (sink: MeshSink, f: LandmarkFrame, rows: readonly (readonly [number, number])[], trim: Rgba): void => {
  const meta = trimMeta(f.style.seed);
  const dark = solid(SWATCH.opening);
  for (const w of sidesOf(squareOf(f.b.ring))) {
    for (const [y0, y1] of rows) {
      for (const s of [-1, 1]) {
        const u = w.length / 2 + s * Math.min(1.5, w.length * 0.12);
        archPanel(sink, w, u, 1.3, f.b.base + y0 - 0.1, f.b.base + y1 + 0.15, 0.1, trim, meta, true);
        archPanel(sink, w, u, 1.0, f.b.base + y0, f.b.base + y1, 0.2, dark, meta, true);
      }
    }
  }
  // String courses under each storey's sills.
  for (const [y0] of rows) band(sink, f.b.ring, 0.12, f.b.base + y0 - 0.55, f.b.base + y0 - 0.3, trim, meta, f.b.base);
};

/** The tower's top over its cornice: the four gables with their clocks, the corner pinnacles and the spire to the data's peak. */
export const spireTop = (sink: MeshSink, f: LandmarkFrame, s: SpireCrown, near: boolean): void => {
  const meta = trimMeta(f.style.seed);
  const sq = squareOf(f.b.ring);
  const copper = solid(SWATCH.patina);
  const trim = solid(SWATCH.plasterTrim);
  const roof = f.b.roof ?? 0;
  const tip = f.top + roof;
  const inner = Math.min(...sq.half);
  // The spire: octagonal, its foot hidden behind the gables, to its ball under the tip.
  const foot = inner * s.base;
  revolve(sink, { x: sq.c.x, y: f.top - 0.05, z: sq.c.z }, [
    [foot, 0],
    [foot * 0.93, s.shoulder],
    [0.06, roof - 1.6],
  ], 8, Math.atan2(sq.d.z, sq.d.x) + Math.PI / 8, copper, meta);
  const sides = sidesOf(sq);
  // The clocks on the gables' faces (0.25 m proud of the body's), so on walls 0.3 m out: a cream dial, its ring and
  // hands lit cyan (Lublin 2077, as Nowy Ratusz's clock towards the new town): the square's accent by night.
  const faces = sidesOf(sq, -0.3);
  sides.forEach((w, k) => {
    const width = w.length - 2 * s.pinnacle - 0.4;
    gable(sink, w, f.top - 0.05, s.gable, width, near ? 2.2 : 0.6, trim, copper, meta);
    if (near && s.clock) clockFace(sink, faces[k] as Wall, w.length / 2, f.top + s.gable * 0.34, Math.min(1.5, s.gable * 0.17), solid("#efe6cf"), lit("#5ce1ff"), meta);
  });
  if (!near) {
    sink.box({ x: sq.c.x, y: tip - 0.4, z: sq.c.z }, 0.3, 0.3, 0.3, lit("#ff2a2a"));
    return;
  }
  // The pinnacles on the body's corners, a little in from them.
  for (let k = 0; k < 4; k++) {
    const w = sides[k] as Wall;
    const corner = along(w, 0, 0, -s.pinnacle);
    const p = { x: corner.x + ((w.b.x - w.a.x) / w.length) * s.pinnacle, z: corner.z + ((w.b.z - w.a.z) / w.length) * s.pinnacle };
    pinnacle(sink, p, f.top - 0.3, f.top + s.gable * 0.45, f.top + s.gable * 0.95, s.pinnacle * 0.75, trim, copper, meta);
  }
  // The ball, and over it Lublin 2077's mast with its red light (the gilded cock of the old spire under it).
  sink.prism({ x: sq.c.x, y: tip - 1.75, z: sq.c.z }, 0.28, 0.5, 8, solid(SWATCH.gold), true, 0.12);
  mast(sink, sq.c, tip - 1.3, tip, Math.atan2(sq.d.z, sq.d.x));
};
