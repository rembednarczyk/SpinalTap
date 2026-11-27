/**
 * The width of a street's carriageway by the order of the sources (ADR-0104 pkt 4): the map's own
 * `width` → BDOT10k's carriageway (`OT_SKJZ_L.SZEROKOSCNAWIERZCHNI`, `pnpm gugik:roads`) → the
 * orthophoto's measure (ADR-0080 PR 10) → the width fitted to the mapped sidewalks → the estimate by
 * type. Each width carries its source, and a report tells how much of the streets' length each
 * gives, and where two of them disagree by more than `CONFLICT` (a matter for review, not for a
 * choice by the look of the photo).
 *
 * Pattern: conflation with an explicit source priority and the provenance of every value (as GIS
 * conflation tools keep a source per attribute); BDOT10k's carriageway is matched to the street's
 * axis by distance and heading (map matching, as `along-footways.ts`).
 */
import { type Carriageway, loadCarriageways } from "../../../gugik/src/extracts.ts";
import { parseLength } from "../building-tags.ts";
import { orthoSides, orthoWidth } from "../corrections-kerb.ts";
import { type Pt, lineLength } from "../geometry.ts";
import { type Tags } from "../osm.ts";
import { KERBS_CHECKED } from "./kerbs-checked.ts";

export type WidthSource = "osm" | "bdot10k" | "ortho" | "fitted" | "default";

/** The step of the samples along a street's axis (m). */
const STEP = 2;
/** How far from the axis a BDOT10k carriageway's line may run and still be the street's (m). */
const NEAR = 3;
/** |cos| of the angle between the axis and the carriageway's line. */
const PARALLEL = 0.9;
/** The share of the axis's samples a BDOT10k carriageway must run beside. */
const SHARE = 0.5;
/** Two sources further apart than this are a conflict (m). */
export const CONFLICT = 1;

let cache: readonly Carriageway[] | undefined;
/** The BDOT10k carriageways of `data/gugik/jezdnie.json`, read once. */
export const carriageways = (): readonly Carriageway[] => (cache ??= loadCarriageways());

/** Samples every `STEP` m along a line, each with its direction. */
const samples = (line: readonly Pt[]): { p: Pt; d: Pt }[] => {
  const out: { p: Pt; d: Pt }[] = [];
  for (let i = 0; i + 1 < line.length; i++) {
    const [a, b] = [line[i]!, line[i + 1]!];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len < 1e-6) continue;
    const d = { x: (b.x - a.x) / len, z: (b.z - a.z) / len };
    for (let u = STEP / 2; u < len; u += STEP) out.push({ p: { x: a.x + d.x * u, z: a.z + d.z * u }, d });
  }
  return out;
};

/**
 * BDOT10k's carriageway along `axis`: its width (the median of the matched samples') and how far its
 * line runs off the axis (m, left positive as `offsetLine`, the median); null where it runs beside
 * too little of the axis.
 */
export const bdotMatch = (axis: readonly Pt[], from: readonly Carriageway[] = carriageways()): { width: number; offset: number } | null => {
  const ss = samples(axis);
  if (ss.length === 0) return null;
  const box = axis.reduce((b, p) => ({ minX: Math.min(b.minX, p.x), maxX: Math.max(b.maxX, p.x), minZ: Math.min(b.minZ, p.z), maxZ: Math.max(b.maxZ, p.z) }), { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity });
  const near = from.filter((c) => c.width !== null && c.line.some((q) => q.x > box.minX - NEAR - 50 && q.x < box.maxX + NEAR + 50 && q.z > box.minZ - NEAR - 50 && q.z < box.maxZ + NEAR + 50));
  const [widths, offsets]: [number[], number[]] = [[], []];
  for (const { p, d } of ss) {
    let best: { dist: number; width: number; off: number } | null = null;
    for (const c of near)
      for (let i = 0; i + 1 < c.line.length; i++) {
        const [a, b] = [c.line[i]!, c.line[i + 1]!];
        const len = Math.hypot(b.x - a.x, b.z - a.z);
        if (len < 1e-6 || Math.abs(((b.x - a.x) * d.x + (b.z - a.z) * d.z) / len) < PARALLEL) continue;
        const t = Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.z - a.z) * (b.z - a.z)) / (len * len)));
        const [qx, qz] = [a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t];
        const dist = Math.hypot(qx - p.x, qz - p.z);
        // Left of the axis positive: on the normal (-dz, dx), as `offsetLine`.
        if (dist <= NEAR && (!best || dist < best.dist)) best = { dist, width: c.width!, off: (qx - p.x) * -d.z + (qz - p.z) * d.x };
      }
    if (best) {
      widths.push(best.width);
      offsets.push(best.off);
    }
  }
  if (widths.length < ss.length * SHARE) return null;
  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
  return { width: median(widths), offset: median(offsets) };
};

/** The width BDOT10k gives the carriageway along `axis` (`bdotMatch`), or null. */
export const bdotWidth = (axis: readonly Pt[], from: readonly Carriageway[] = carriageways()): number | null => bdotMatch(axis, from)?.width ?? null;

/** A side's half width of the carriageway and where it comes from. */
export interface SideWidth {
  readonly half: number;
  readonly source: WidthSource;
}

/**
 * The carriageway's half width on each side by the order of the sources: `half` is the import's
 * own (`kerb.half`: the orthophoto's, the fitted or the estimate, as `ortho` and `estimated` say).
 */
export const streetWidth = (tags: Tags, half: number, ortho: boolean, estimated: (side: 1 | -1) => boolean, bdot: number | null): [SideWidth, SideWidth] => {
  const osm = parseLength(tags.width);
  // BDOT10k wins over the orthophoto's measure however far apart (the user's decision of 26.11); a
  // difference over `CONFLICT` is still reported (`WidthReport`).
  const side = (s: 1 | -1): SideWidth =>
    osm !== null
      ? { half: osm / 2, source: "osm" }
      : bdot !== null
        ? { half: bdot / 2, source: "bdot10k" }
        : ortho
          ? { half, source: "ortho" }
          : !estimated(s)
            ? { half, source: "fitted" }
            : { half, source: "default" };
  return [side(1), side(-1)];
};

/**
 * A street's sides' widths by the order of the sources, added to `report`. `half` and `estimated`
 * are the import's own (`kerb.half`, `estimatedSide`); in the districts on the street graph the
 * import has already taken BDOT10k's width and line (`bdot-ways.ts`), so the axis is BDOT10k's and
 * its match here names the source. The orthophoto's measure is set beside it for the report.
 */
export const sourcedWidth = (
  way: string,
  tags: Tags,
  axis: readonly Pt[],
  half: number,
  estimated: (source: string, side: 1 | -1) => boolean,
  report: WidthReport,
): [SideWidth, SideWidth] => {
  const ortho = orthoWidth(way);
  // A way checked on the ground (T-360) over BDOT10k's class width.
  const bdot = KERBS_CHECKED.get(way)?.width ?? bdotWidth(axis);
  const sides = streetWidth(tags, half, ortho !== null, (side) => estimated(way, side), bdot);
  report.add(way, tags.name ?? "", axis, sides, bdot, ortho);
  return sides;
};

/** The provenance report of a district's streets: length by source, and the conflicts between them. */
export class WidthReport {
  private readonly length = new Map<WidthSource, number>();
  private readonly conflicts: string[] = [];
  private readonly oneSide: string[] = [];

  /** A street's two sides, its length, and BDOT10k's width beside the orthophoto's where both are. */
  add(way: string, name: string, axis: readonly Pt[], sides: readonly [SideWidth, SideWidth], bdot: number | null, ortho: number | null): void {
    const len = lineLength(axis) / 2;
    for (const s of sides) this.length.set(s.source, (this.length.get(s.source) ?? 0) + len);
    // Only where the orthophoto measured both sides: a row of one side holds the import's estimate for the other, and 12 of
    // the 20 conflicts on Podzamcze and Nabrzeże were BDOT10k against that half guess (the curator's review of E4, P6).
    const both = orthoSides(way)?.every(Boolean) ?? false;
    if (bdot !== null && ortho !== null && Math.abs(bdot - ortho) > CONFLICT) (both ? this.conflicts : this.oneSide).push(`${way} ${name}: BDOT10k ${bdot} m, orthophoto ${ortho.toFixed(1)} m`);
  }

  toString(): string {
    const total = [...this.length.values()].reduce((a, b) => a + b, 0) || 1;
    const by = (["osm", "bdot10k", "ortho", "fitted", "default"] as const).map((s) => `${s} ${((this.length.get(s) ?? 0) / 1000).toFixed(2)} km (${((100 * (this.length.get(s) ?? 0)) / total).toFixed(1)}%)`).join(", ");
    return `street graph widths (ADR-0104 pkt 4), carriageway sides: ${by}; conflicts over ${CONFLICT} m: ${this.conflicts.length}${this.conflicts.length ? ` (${this.conflicts.slice(0, 20).join("; ")})` : ""}; against a one-sided measurement, not compared: ${this.oneSide.length}`;
  }
}
