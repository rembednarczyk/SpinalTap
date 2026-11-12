/**
 * How well the cover agrees with the truth (ADR-0077): the share of green samples on the lawns and
 * of hard surface (light paving or asphalt) on the paved areas, each area's samples at least
 * `TRUTH_INSET` from its edges (the photograph's lean and the 0.5 m grid blur them). Shadow and
 * samples off the raster are left out of the shares and counted on their own.
 */
import { type Rect } from "../../osm-import/src/geometry.ts";
import { COVER, type CoverName } from "./classify.ts";
import { type Cover } from "./cover.ts";
import { type ClassCounts, countAt, samplesIn, zeroCounts } from "./rings.ts";
import { type TruthArea, type TruthKind } from "./truth.ts";

/** How far inside a truth area its samples lie (m). */
export const TRUTH_INSET = 1;

export const WANTED: Readonly<Record<TruthKind, readonly CoverName[]>> = { lawn: ["green"], paving: ["paving", "asphalt"] };

export interface Agreement {
  readonly samples: number;
  readonly counts: ClassCounts;
  /** Wanted classes among the samples with a colour (not shadow, not `none`). */
  readonly share: number;
  /** Shadow among the samples on the raster. */
  readonly shadow: number;
}

const inRect = (c: Cover, k: number, r?: Rect): boolean => {
  if (!r) return true;
  const h = c.header;
  const [x, z] = [h.x0 + ((k % h.width) + 0.5) * h.step, h.z1 - (Math.floor(k / h.width) + 0.5) * h.step];
  return x > r.minX && x < r.maxX && z > r.minZ && z < r.maxZ;
};

export const agreement = (cover: Cover, areas: readonly TruthArea[], kind: TruthKind, rect?: Rect): Agreement => {
  const counts = zeroCounts();
  for (const a of areas) {
    if (a.kind !== kind) continue;
    const ks = samplesIn(cover.header, a.ring, TRUTH_INSET).filter((k) => inRect(cover, k, rect) && cover.cls[k] !== COVER.none);
    const c = countAt(cover, ks);
    for (const n of Object.keys(c) as CoverName[]) counts[n] += c[n];
  }
  const lit = counts.green + counts.paving + counts.asphalt + counts.unknown;
  const onRaster = lit + counts.shadow;
  return {
    samples: onRaster,
    counts,
    share: lit ? WANTED[kind].reduce((s, n) => s + counts[n], 0) / lit : 0,
    shadow: onRaster ? counts.shadow / onRaster : 0,
  };
};
