/**
 * The frontages of the bare ground rule (G-853, `bare-cover.ts`): the ground between a pedestrian
 * street's paving and the walls along it. Its paving comes from the orthophoto (the setts of
 * Krakowskie Przedmieście) and stops short of the tenements, and the strip left between is too
 * narrow for the compact regions' rule (`FILL.looseWidth`): it stayed bare in the terrain's
 * colour. Within a pedestrian street's frontage everything is laid, as in a town's paved place,
 * and what the cover shows as neither a lawn nor paving (asphalt, shade, a dark sett, a crown over
 * them, `mixedRow`) is paved as the street is: a walker's street has no carriageway to keep bare
 * (`keepKerbs`), and its trees stand in its paving.
 *
 * The streets are the pedestrian ways and living streets; inside the Old Town's walls the
 * residential streets too, cobbled and walked as the rest of it (`OLD_TOWN_RING`).
 */
import { type Cells, LABEL as CELL_LABEL, STEP as CELL_STEP } from "./bare-cells.ts";
import { type Line } from "./features.ts";
import { type Pt, pointInRing } from "./geometry.ts";
import { OLD_TOWN_RING } from "./old-town.ts";

/** A pedestrian street's axis and how far off it its frontage reaches (m). */
export interface Frontage {
  readonly line: readonly Pt[];
  readonly reach: number;
}

/**
 * How far off the axis a frontage reaches (m), as `frontage-bare` counts it: a pedestrian way or a
 * living street 8 m, a residential street of the Old Town 6 m (its lanes are narrower).
 */
export const FRONT = { pedestrian: 8, oldTown: 6 } as const;

// Module-local copies of what the cell loops read: Vitest's module runner reads an imported
// binding through a getter of the module's namespace, at each cell.
const OTHER = CELL_LABEL.other;
const COVERED = CELL_LABEL.covered;
const BLOCKED = CELL_LABEL.blocked;
const STEP = CELL_STEP;
const SQUARE = CELL_LABEL.square;

const WALKED: ReadonlySet<string> = new Set(["pedestrian", "living_street"]);

const onGround = (t: Line["tags"]): boolean => t.area !== "yes" && t.tunnel === undefined && (t.bridge ?? "no") === "no" && Number(t.layer ?? 0) >= 0;

/** The segments of a line with an end inside the Old Town's walls, a run of them a line. */
const inOldTown = (line: readonly Pt[]): Pt[][] => {
  const inside = line.map((p) => pointInRing(p, OLD_TOWN_RING));
  const runs: Pt[][] = [];
  for (let k = 0; k + 1 < line.length; k++) {
    if (!inside[k] && !inside[k + 1]) continue;
    const last = runs[runs.length - 1];
    if (last && last[last.length - 1] === line[k]) last.push(line[k + 1]!);
    else runs.push([line[k]!, line[k + 1]!]);
  }
  return runs;
};

/** The map's pedestrian streets' frontages (`Frontage`), a residential street's only where it runs inside the Old Town's walls. */
export const frontages = (lines: readonly Line[]): Frontage[] =>
  lines.flatMap(({ tags: t, line }): Frontage[] => {
    if (!onGround(t) || line.length < 2) return [];
    if (WALKED.has(t.highway ?? "")) return [{ line: [...line], reach: FRONT.pedestrian }];
    return t.highway === "residential" ? inOldTown(line).map((run) => ({ line: run, reach: FRONT.oldTown })) : [];
  });

/**
 * Whether the way from cell (i, j) to the axis's point (px, pz) crosses no wall: a yard behind
 * the street's tenements, or past a gate, is within reach of the axis but no frontage of it.
 */
const inSight = (cells: Cells, i: number, j: number, px: number, pz: number): boolean => {
  const { rect, nx, nz, wall } = cells;
  const [x, z] = [rect.minX + (i + 0.5) * STEP, rect.minZ + (j + 0.5) * STEP];
  const n = Math.ceil(Math.hypot(px - x, pz - z) / (STEP / 2));
  for (let s = 1; s <= n; s++) {
    const ii = Math.floor((x + ((px - x) * s) / n - rect.minX) / STEP);
    const jj = Math.floor((z + ((pz - z) * s) / n - rect.minZ) / STEP);
    if (ii >= 0 && jj >= 0 && ii < nx && jj < nz && wall[jj * nx + ii]) return false;
  }
  return true;
};

/** Marks the cells within `d` of the segment from `a` to `b`, with no wall between them and it, a frontage. */
const frontNear = (cells: Cells, a: Pt, b: Pt, d: number): void => {
  const { rect, nx, nz, front, wall } = cells;
  const i0 = Math.max(0, Math.floor((Math.min(a.x, b.x) - d - rect.minX) / STEP));
  const i1 = Math.min(nx - 1, Math.ceil((Math.max(a.x, b.x) + d - rect.minX) / STEP));
  const j0 = Math.max(0, Math.floor((Math.min(a.z, b.z) - d - rect.minZ) / STEP));
  const j1 = Math.min(nz - 1, Math.ceil((Math.max(a.z, b.z) + d - rect.minZ) / STEP));
  const [dx, dz] = [b.x - a.x, b.z - a.z];
  const len2 = dx * dx + dz * dz || 1;
  for (let j = j0; j <= j1; j++) {
    const z = rect.minZ + (j + 0.5) * STEP;
    for (let i = i0; i <= i1; i++) {
      const k = j * nx + i;
      if (front[k] || wall[k]) continue;
      const x = rect.minX + (i + 0.5) * STEP;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / len2));
      const [px, pz] = [a.x + dx * t, a.z + dz * t];
      if ((px - x) ** 2 + (pz - z) ** 2 <= d * d && inSight(cells, i, j, px, pz)) front[k] = 1;
    }
  }
};

/**
 * The free cells next to a frontage that its reach leaves loose (`dropLoose`: under `width` m wide
 * on the average or under `area` m²) join it: the reach's edge would otherwise cut a strip by a
 * wall or a pavement out of the ground before it (a notch, a corner the axis does not see square
 * on, the last metre to the next piece), a strip `ground-strip-gap` or `kerb-gap-bare` counts. A
 * compact region past the reach (a yard, a car park) stays as the rest of the rule leaves it.
 * Each 4-connected region of free cells off the frontage is walked once.
 */
const joinLoose = (cells: Cells, width: number, area: number): void => {
  const { nx, label, front } = cells;
  const size = label.length;
  const free = (k: number) => label[k] !== COVERED && label[k] !== BLOCKED && !front[k];
  const seen = new Uint8Array(size);
  const queue = new Int32Array(size);
  for (let s = 0; s < size; s++) {
    if (seen[s] || !free(s)) continue;
    let [n, edges, touches] = [0, 0, false];
    queue[n++] = s;
    seen[s] = 1;
    for (let q = 0; q < n; q++) {
      const k = queue[q]!;
      const i = k % nx;
      for (let d = 0; d < 4; d++) {
        const m = d === 0 ? (i + 1 < nx ? k + 1 : -1) : d === 1 ? (i > 0 ? k - 1 : -1) : d === 2 ? (k + nx < size ? k + nx : -1) : k - nx;
        if (m >= 0 && free(m)) {
          if (!seen[m]) {
            seen[m] = 1;
            queue[n++] = m;
          }
          continue;
        }
        edges++;
        if (m >= 0 && front[m]) touches = true;
      }
    }
    // Area n / 4 m², outline edges / 2 m: the mean width 2 area / outline, as `dropLoose` reads it.
    if (touches && (n / edges < width || n * STEP * STEP < area)) for (let q = 0; q < n; q++) front[queue[q]!] = 1;
  }
};

/**
 * Marks the cells of the frontages (`margin` past their reach, as a town's paved place grows, and
 * the loose regions they leave, `joinLoose`) a frontage and a paved place: the walls and pieces
 * must be covered (`Cells.cover`) first.
 */
export const zoneFronts = (cells: Cells, fronts: readonly Frontage[], margin: number, loose: { readonly width: number; readonly area: number }): void => {
  if (fronts.length === 0) return;
  for (const { line, reach } of fronts) for (let k = 0; k + 1 < line.length; k++) frontNear(cells, line[k]!, line[k + 1]!, reach + margin);
  joinLoose(cells, loose.width, loose.area);
  const { zone, front } = cells;
  for (let k = 0; k < front.length; k++) if (front[k]) zone[k] = 1;
};

/** A frontage's free cells the cover gives no lawn or paving are paved as the street (`zoneFronts` marked them). */
export const paveFronts = (cells: Cells): void => {
  const { label, front } = cells;
  for (let k = 0; k < label.length; k++) if (front[k] && label[k] === OTHER) label[k] = SQUARE;
};
