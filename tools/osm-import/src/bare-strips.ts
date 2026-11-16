/**
 * The kerbs' strips of the bare ground rule (ADR-0077 step 1.2, `bare-cover.ts`): the bare ground
 * between a carriageway and the next piece of the map past it (a pavement, a footway, a lawn), up
 * to a few metres across, is laid from the cover however narrow it is, as a town's paved place is.
 * Such a strip is what `kerb-gap-bare` and `kerb-strip-bare` count: a pavement or a verge the map's
 * bands miss by a metre or two, which the orthophoto shows paved or green.
 */
import { type Cells, LABEL as CELL_LABEL, STEP, scratch } from "./bare-cells.ts";

// A module-local copy of the labels the cell loops read: Vitest's module runner reads an imported
// binding through a getter of the module's namespace, at each cell.
const LABEL = { ...CELL_LABEL } as const;

/** Column steps of the cells round a cell, row by row from the south-west. */
const DI = [-1, 0, 1, -1, 1, -1, 0, 1] as const;

/** What the walks share: the raster's labels, the steps round a cell and a queue. */
interface Walk {
  readonly nx: number;
  readonly size: number;
  readonly label: Uint8Array;
  readonly dk: Int32Array;
  readonly queue: Int32Array;
}

/**
 * The steps (8 round a cell) from the cells `from` marks, through free cells, into `dist`: 0 on
 * them, up to `reach`, and `reach + 1` for the free cells further and the rest. A function of its
 * own: V8 optimises its loops once for all the walks (see `bare-clean.ts`).
 */
const steps = (w: Walk, from: Uint8Array, reach: number, dist: Int16Array): void => {
  const { nx, size, label, dk, queue } = w;
  dist.fill(reach + 1);
  let n = 0;
  for (let k = 0; k < size; k++)
    if (from[k]) {
      dist[k] = 0;
      queue[n++] = k;
    }
  for (let q = 0; q < n; q++) {
    const k = queue[q]!;
    const d = dist[k]! + 1;
    if (d > reach) continue;
    const i = k % nx;
    for (let r = 0; r < 8; r++) {
      const ii = i + DI[r]!;
      const m = k + dk[r]!;
      if (ii < 0 || ii >= nx || m < 0 || m >= size || dist[m]! <= d) continue;
      const l = label[m]!;
      if (l === LABEL.covered || l === LABEL.blocked) continue;
      dist[m] = d;
      queue[n++] = m;
    }
  }
};

/**
 * Marks the free cells of a strip at most `band` metres across between a carriageway (or a car
 * park) and a piece past it a strip ends at (`Cells.side`) a town's paved place (`Cells.zone`), so
 * the loose regions' rule (`dropLoose`) keeps what the cover lays there: a cell whose steps from
 * the nearest carriageway and from the nearest such piece, through free cells, add up to the
 * strip's width and one. Between two carriageways alone (an island) or by one with nothing past
 * it, nothing; but the strip reaches on `margin` metres within `band` of the carriageway, so a
 * corner where two streets meet by it is not left bare at the kerb (which would turn the strip
 * behind it bare: `keepKerbs`).
 */
export const kerbStrips = (cells: Cells, band: number, margin: number): void => {
  const { nx, nz, label, road, side, zone } = cells;
  const size = nx * nz;
  const reach = Math.round(band / STEP);
  const grow = Math.round(margin / STEP);
  const w: Walk = { nx, size, label, dk: Int32Array.from(DI, (di, r) => (r < 3 ? -nx : r < 5 ? 0 : nx) + di), queue: scratch.i32("strips.queue", size, null) };
  const mark = scratch.u8("strips.mark", size, null);
  const fromRoad = scratch.i16("strips.road", size, null);
  const fromSide = scratch.i16("strips.side", size, null);
  // A cell both a carriageway's and a pavement's is the pavement's kerb: no strip starts there.
  for (let k = 0; k < size; k++) mark[k] = label[k] === LABEL.covered && road[k] !== 0 && side[k] === 0 ? 1 : 0;
  steps(w, mark, reach, fromRoad);
  for (let k = 0; k < size; k++) mark[k] = label[k] === LABEL.covered && side[k] === 1 ? 1 : 0;
  steps(w, mark, reach, fromSide);
  for (let k = 0; k < size; k++) mark[k] = fromRoad[k]! > 0 && fromSide[k]! > 0 && fromRoad[k]! + fromSide[k]! <= reach + 1 ? 1 : 0;
  steps(w, mark, grow, fromSide);
  for (let k = 0; k < size; k++) if (fromSide[k]! <= grow && fromRoad[k]! > 0 && fromRoad[k]! <= reach) zone[k] = 1;
};
