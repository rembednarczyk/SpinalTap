import { type Cells, LABEL, scratch } from "./bare-cells.ts";
import { type Pt } from "./geometry.ts";

/**
 * The paving of the bare ground rule that meets a street is a sidewalk (the user's decisions of
 * 26.11, the sidewalks' uniformity, step 1): every connected run of paved cells (`LABEL.square`)
 * with a cell beside a street's carriageway (`street`) is laid as the slabs of a sidewalk
 * (`LABEL.walk`, `sidewalk`, with its kerb to the asphalt), forecourt and all, so no step parts the
 * strip by the kerb from the paving behind it. Not from a service way's or a car park's asphalt: a
 * petrol station's forecourt, a lay-by's setts and a car park's paving lie level with the asphalt
 * (the curator's review, U2). A run that meets a mapped square or pedestrian area (`place`, the
 * map's own `square` and `cobble` pieces) stays a square's: a deptak keeps one paving from front to
 * front (U1, Krakowskie Przedmieście). A run under `MIN_WALK_CELLS` stays a square's too. Not in the districts whose sidewalks are sett and granite
 * (`SETT_DISTRICTS`: the Old Town).
 *
 * Pattern: connected-component labelling by flood fill (4-neighbour) from seeds, on the rule's raster.
 */

/** The cover districts whose sidewalks are sett and granite, not slabs (`tools/glitch-scan/test/sidewalk-rules.ts`). */
export const SETT_DISTRICTS: ReadonlySet<string> = new Set(["stare-miasto"]);

/** The OSM `highway` values of the streets whose kerbs a fill's sidewalk starts at: no service way. */
export const WALK_STREETS: ReadonlySet<string> = new Set([
  "primary", "primary_link", "secondary", "secondary_link", "tertiary", "tertiary_link", "residential", "unclassified", "living_street",
]);

/** The carriageways' rings of the streets (`WALK_STREETS`) among the laid bands: the rule's paving that meets one is a sidewalk. */
export const streetRings = (
  lines: readonly { readonly id: string; readonly tags: { readonly highway?: string } }[],
  bands: readonly { readonly carriageway?: true; readonly source: string; readonly ring: readonly Pt[] }[],
): (readonly Pt[])[] => {
  const ids = new Set(lines.filter((l) => WALK_STREETS.has(l.tags.highway ?? "")).map((l) => l.id));
  return bands.filter((b) => b.carriageway && ids.has(b.source)).map((b) => b.ring);
};

/**
 * The fewest cells a run is a sidewalk of (0.25 m² each): smaller, a wedge left in a junction's
 * corner between the carriageways' pieces, whose traced edges would draw the kerb in a zigzag
 * (`kerb-jag`); it stays a square's, with no kerb.
 */
export const MIN_WALK_CELLS = 24;

const DI = [-1, 1, 0, 0, -1, -1, 1, 1] as const;
const DJ = [0, 0, -1, 1, -1, 1, -1, 1] as const;

/** Relabels the paved runs that meet a street (1 in `street`) and no mapped place (1 in `place`) as walks. */
export const kerbWalks = (cells: Cells, street: Uint8Array, place: Uint8Array): void => {
  const { nx, nz, label } = cells;
  const size = nx * nz;
  const queue = scratch.i32("walks.queue", size, null);
  const seen = scratch.u8("walks.seen", size);
  const besideOf = (k: number, mask: Uint8Array) => {
    const [i, j] = [k % nx, Math.floor(k / nx)];
    for (let d = 0; d < 8; d++) {
      const [a, b] = [i + DI[d]!, j + DJ[d]!];
      if (a >= 0 && b >= 0 && a < nx && b < nz && mask[b * nx + a] === 1) return true;
    }
    return false;
  };
  for (let s = 0; s < size; s++) {
    if (label[s] !== LABEL.square || seen[s] === 1 || !besideOf(s, street)) continue;
    // The run of `s`, 4-neighbour.
    let n = 0;
    let touchesPlace = false;
    seen[s] = 1;
    queue[n++] = s;
    for (let q = 0; q < n; q++) {
      const k = queue[q]!;
      touchesPlace ||= place[k] === 1 || besideOf(k, place);
      const i = k % nx;
      for (const m of [i > 0 ? k - 1 : -1, i + 1 < nx ? k + 1 : -1, k - nx, k + nx]) {
        if (m < 0 || m >= size || seen[m] === 1 || label[m] !== LABEL.square) continue;
        seen[m] = 1;
        queue[n++] = m;
      }
    }
    if (!touchesPlace && n >= MIN_WALK_CELLS) for (let q = 0; q < n; q++) label[queue[q]!] = LABEL.walk;
  }
};
