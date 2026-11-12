/**
 * Section 2 of the cell report: the lean of each cached orthophoto flight (ADR-0077). Roofs on a
 * photograph not taken straight down lie off their footprints; the image's brightness gradient,
 * sampled at 0.25 m, is summed along the LoD2 outlines (lines 0.75 m wide) shifted by every
 * (dx, dz) within ±`RANGE` m, and the shift with the most edge on the outlines is the flight's
 * lean: the photograph shows the roof of a footprint at footprint + (dx, dz). The flight leaning
 * least is the one to read the ground by.
 */
import { type Pt, type Rect } from "../../osm-import/src/geometry.ts";
import { puwgFrame, worldToPuwg } from "../../osm-import/src/project.ts";
import { type Grid, gridOver, outlineMask, rectMask } from "./grid.ts";
import { type Tile, pixelAt } from "./tiles.ts";

/** Shifts tried (m each way), the image's sample (m), the fewest outline samples in the cell for a lean to count (about 220 m of outline). */
export const LEAN = { RANGE: 8, STEP: 0.25, MIN_EDGE: 2000 } as const;

export interface FlightLean {
  readonly flight: string;
  readonly sheet?: string;
  readonly dx: number;
  readonly dz: number;
  /** Mean gradient on the outlines at the lean and at (0; 0). */
  readonly score: number;
  readonly scoreZero: number;
}

export interface LeanSection {
  readonly flights: readonly FlightLean[];
  /** The flight leaning least; none without tiles in the cache. */
  readonly recommended?: string;
  /** Outline samples in the cell the lean was measured on. */
  readonly edge: number;
  readonly verdict: string;
}

/** Brightness of the tile at the grid's samples (NaN off the image), through the similarity near the cell. */
export const brightness = (g: Grid, tile: Tile): Float32Array => {
  const out = new Float32Array(g.width * g.height).fill(NaN);
  const f = puwgFrame();
  const centre = { x: g.x0 + (g.width * g.step) / 2, z: g.z1 - (g.height * g.step) / 2 };
  const o = worldToPuwg(centre);
  const [cs, sn] = [Math.cos((f.gammaDeg * Math.PI) / 180) * f.scale, Math.sin((f.gammaDeg * Math.PI) / 180) * f.scale];
  for (let row = 0; row < g.height; row++)
    for (let col = 0; col < g.width; col++) {
      const [dx, dz] = [g.x0 + (col + 0.5) * g.step - centre.x, g.z1 - (row + 0.5) * g.step - centre.z];
      const i = pixelAt(tile, { e: o.e + cs * dx - sn * dz, n: o.n + sn * dx + cs * dz });
      if (i >= 0) out[row * g.width + col] = 0.299 * tile.rgb[i * 3]! + 0.587 * tile.rgb[i * 3 + 1]! + 0.114 * tile.rgb[i * 3 + 2]!;
    }
  return out;
};

/** The gradient's size by central differences; 0 where a neighbour has no image. */
export const gradient = (g: Grid, l: Float32Array): Float32Array => {
  const out = new Float32Array(l.length);
  const w = g.width;
  for (let row = 1; row < g.height - 1; row++)
    for (let col = 1; col < w - 1; col++) {
      const k = row * w + col;
      const [gx, gz] = [l[k + 1]! - l[k - 1]!, l[k + w]! - l[k - w]!];
      const v = Math.hypot(gx, gz);
      out[k] = Number.isFinite(v) ? v : 0;
    }
  return out;
};

/** Mean gradient on the outline samples `edge` (their columns and rows) with the image shifted by (di, dj) samples (east, south). */
const scoreAt = (g: Grid, grad: Float32Array, cols: readonly number[], rows: readonly number[], di: number, dj: number): number => {
  let s = 0;
  for (let e = 0; e < cols.length; e++) {
    const [r, c] = [rows[e]! + dj, cols[e]! + di];
    if (r >= 0 && c >= 0 && r < g.height && c < g.width) s += grad[r * g.width + c]!;
  }
  return s / (cols.length || 1);
};

/**
 * The shift (dx, dz) of the image that puts the most gradient on the outline samples `edge`
 * (indices on `g`): every `coarse`-th shift within `range`, then every shift round the best of
 * those; ties keep the smaller shift.
 */
export const bestLean = (g: Grid, grad: Float32Array, edge: readonly number[], range: number = LEAN.RANGE, coarse = 2): { dx: number; dz: number; score: number; scoreZero: number } => {
  const n = Math.round(range / g.step);
  const cols = edge.map((k) => k % g.width);
  const rows = edge.map((k) => Math.floor(k / g.width));
  let best = { di: 0, dj: 0, score: scoreAt(g, grad, cols, rows, 0, 0) };
  const scoreZero = best.score;
  const visit = (di: number, dj: number) => {
    if (Math.abs(di) > n || Math.abs(dj) > n) return;
    const s = scoreAt(g, grad, cols, rows, di, dj);
    if (s > best.score + 1e-9 || (Math.abs(s - best.score) <= 1e-9 && Math.hypot(di, dj) < Math.hypot(best.di, best.dj))) best = { di, dj, score: s };
  };
  for (let dj = -n; dj <= n; dj += coarse) for (let di = -n; di <= n; di += coarse) visit(di, dj);
  const { di: ci, dj: cj } = best;
  for (let dj = cj - coarse; dj <= cj + coarse; dj++) for (let di = ci - coarse; di <= ci + coarse; di++) visit(di, dj);
  return { dx: best.di * g.step + 0, dz: -best.dj * g.step + 0, score: best.score, scoreZero };
};

const r2 = (v: number) => Math.round(v * 100) / 100 + 0;

/** The lean of each flight's tile of the cell against the LoD2 outlines near it. */
export const leanSection = (rect: Rect, lod2: readonly (readonly Pt[])[], tiles: readonly { readonly flight: string; readonly tile: Tile }[]): LeanSection => {
  if (!tiles.length) return { flights: [], edge: 0, verdict: "brak kafli ortofoto w pamięci podręcznej (`fetch.ts --cell`): przechyłu nie zmierzono" };
  const g = gridOver(rect, LEAN.STEP, LEAN.RANGE + 2);
  const lines = outlineMask(g, lod2, 1);
  const window = rectMask(g, rect);
  const edge: number[] = [];
  for (let k = 0; k < lines.length; k++) if (lines[k] && window[k]) edge.push(k);
  const flights = tiles.map(({ flight, tile }) => {
    const b = bestLean(g, gradient(g, brightness(g, tile)), edge);
    return { flight, ...(tile.meta.sheet ? { sheet: `${tile.meta.sheet.sheet} ${tile.meta.sheet.date}` } : {}), dx: b.dx, dz: b.dz, score: r2(b.score), scoreZero: r2(b.scoreZero) };
  });
  if (edge.length < LEAN.MIN_EDGE) return { flights, edge: edge.length, verdict: `za mało obrysów LoD2 w komórce (${edge.length} próbek krawędzi < ${LEAN.MIN_EDGE}): przechył niepewny, nalotu nie zalecam` };
  const rec = [...flights].sort((a, b) => Math.hypot(a.dx, a.dz) - Math.hypot(b.dx, b.dz))[0]!;
  const others = flights.filter((f) => f !== rec).map((f) => `${f.flight} (${f.dx}; ${f.dz})`);
  return { flights, recommended: rec.flight, edge: edge.length, verdict: `najmniejszy przechył ma ${rec.flight} (${rec.dx}; ${rec.dz}) m${others.length ? `, pozostałe ${others.join(", ")}` : ""}: goły teren i dachy czytaj z ${rec.flight}` };
};

export const leanText = (s: LeanSection): string[] => [
  "-- przechył nalotów ortofoto (gradient na krawędziach LoD2, ±8 m)",
  ...s.flights.map((f) => `${f.flight}${f.sheet ? ` (${f.sheet})` : ""}: dach przy obrysie + (${f.dx}; ${f.dz}) m, wynik ${f.score} wobec ${f.scoreZero} przy (0; 0)`),
  `werdykt: ${s.verdict}`,
];
