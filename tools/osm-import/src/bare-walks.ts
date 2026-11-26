import { type Cells, LABEL, scratch } from "./bare-cells.ts";

/**
 * The paving of the bare ground rule that meets a carriageway is a sidewalk (the user's decisions of
 * 26.11, the sidewalks' uniformity, step 1): every connected run of paved cells (`LABEL.square`)
 * with a cell beside a carriageway or a car park (`Cells.road`) is laid as the slabs of a sidewalk
 * (`LABEL.walk`, `sidewalk`, with its kerb to the asphalt), forecourt and all, so no step parts the
 * strip by the kerb from the paving behind it. The rest of the rule's paving stays a square's; a
 * mapped square or pedestrian area is no fill and keeps its own paving. Not in the districts whose
 * sidewalks are sett and granite (`SETT_DISTRICTS`: the Old Town).
 *
 * Pattern: connected-component labelling by flood fill (4-neighbour) from seeds, on the rule's raster.
 */

/** The cover districts whose sidewalks are sett and granite, not slabs (`tools/glitch-scan/test/sidewalk-rules.ts`). */
export const SETT_DISTRICTS: ReadonlySet<string> = new Set(["stare-miasto"]);

const NEIGHBOURS8 = [-1, 1, 0, 0, -1, -1, 1, 1] as const;
const NEIGHBOURS8Z = [0, 0, -1, 1, -1, 1, -1, 1] as const;

/** Relabels the paved runs that meet a carriageway as walks. */
export const kerbWalks = (cells: Cells): void => {
  const { nx, nz, label, road } = cells;
  const size = nx * nz;
  const queue = scratch.i32("walks.queue", size, null);
  let n = 0;
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      if (label[k] !== LABEL.square) continue;
      for (let d = 0; d < 8; d++) {
        const [a, b] = [i + NEIGHBOURS8[d]!, j + NEIGHBOURS8Z[d]!];
        if (a < 0 || b < 0 || a >= nx || b >= nz || road[b * nx + a] === 0) continue;
        label[k] = LABEL.walk;
        queue[n++] = k;
        break;
      }
    }
  const take = (k: number) => {
    if (label[k] !== LABEL.square) return;
    label[k] = LABEL.walk;
    queue[n++] = k;
  };
  for (let q = 0; q < n; q++) {
    const k = queue[q]!;
    const i = k % nx;
    if (i > 0) take(k - 1);
    if (i + 1 < nx) take(k + 1);
    if (k >= nx) take(k - nx);
    if (k + nx < size) take(k + nx);
  }
};
