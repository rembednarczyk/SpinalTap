import { COVER, COVER_NAMES } from "../../orto/src/classify.ts";
import { type Cover, coverFor } from "../../orto/src/cover.ts";
import { type ClassCounts, samplesIn, zeroCounts } from "../../orto/src/rings.ts";

/**
 * `fill-on-green` (ADR-0077 step 1.2, the curator's review of #483, T-285): a 0.5 m sample of the
 * orthophoto's cover the import's bare ground rule (`tools/osm-import/src/bare-cover.ts`) lays
 * paving on where the cover shows green: a lawn taken for a square. One finding a sample, at its
 * centre; `lawnOnLeafOffPaving` the same for lawns on paving under crowns. `pavingClasses` also
 * gives the classes under a chunk's laid paving, for the share laid over the crowns (a guess from
 * the cells round them).
 */

type Finding = { readonly at: string; readonly what: string };
/** A chunk's pieces the rule laid (`ChunkStats.fills` of the import). */
export interface ChunkFills {
  readonly id: string;
  readonly fills: readonly { readonly surface: string; readonly outline: readonly number[] }[];
}

const laid = (chunk: ChunkFills, covers: readonly Cover[], surface: string) =>
  chunk.fills.flatMap((f) => {
    if (f.surface !== surface) return [];
    const ring = Array.from({ length: f.outline.length >> 1 }, (_, k) => ({ x: f.outline[2 * k]!, z: f.outline[2 * k + 1]! }));
    // The district's cover by the middle of the piece's box: a corner may lie on its raster's edge.
    const [xs, zs] = [ring.map((p) => p.x), ring.map((p) => p.z)];
    const mid = { x: (Math.min(...xs) + Math.max(...xs)) / 2, z: (Math.min(...zs) + Math.max(...zs)) / 2 };
    const cover = ring.length >= 3 ? coverFor(covers, mid) : undefined;
    return cover ? [{ cover, samples: samplesIn(cover.header, ring) }] : [];
  });
const pavings = (chunk: ChunkFills, covers: readonly Cover[]) => laid(chunk, covers, "square");

/** The samples of class `cls` under the pieces of `surface` the rule laid, one finding each. */
const laidOn = (chunks: readonly ChunkFills[], covers: readonly Cover[], surface: string, cls: number, what: string): Finding[] =>
  chunks.flatMap((c) =>
    laid(c, covers, surface).flatMap(({ cover, samples }) =>
      samples
        .filter((k) => cover.cls[k] === cls)
        .map((k) => {
          const h = cover.header;
          const [x, z] = [h.x0 + ((k % h.width) + 0.5) * h.step, h.z1 - (Math.floor(k / h.width) + 0.5) * h.step];
          return { at: `${x.toFixed(0)},${z.toFixed(0)}`, what: `${c.id}: ${what} ${x.toFixed(2)},${z.toFixed(2)}` };
        }),
    ),
  );

/** The samples of the cover under the laid paving of `chunks` that are green. */
export const fillOnGreen = (chunks: readonly ChunkFills[], covers: readonly Cover[]): Finding[] => laidOn(chunks, covers, "square", COVER.green, "paving on green");

/**
 * `lawn-on-leafoff-paving` (G-764, T-287): the samples under a lawn the rule laid that the cover
 * shows as paving under crowns (`canopyHard`: light and grey on the leaf-off flight), a pavement
 * under trees taken for a tree's bed.
 */
export const lawnOnLeafOffPaving = (chunks: readonly ChunkFills[], covers: readonly Cover[]): Finding[] =>
  laidOn(chunks, covers, "grass", COVER.canopyHard, "lawn on leaf-off paving");

/** The classes of the cover's samples under each chunk's laid paving, by the chunk's id. */
export const pavingClasses = (chunks: readonly ChunkFills[], covers: readonly Cover[]): Map<string, ClassCounts> =>
  new Map(
    chunks.map((c) => {
      const sum = zeroCounts();
      for (const { cover, samples } of pavings(c, covers)) for (const k of samples) sum[COVER_NAMES[cover.cls[k]!] ?? "none"]++;
      return [c.id, sum];
    }),
  );
