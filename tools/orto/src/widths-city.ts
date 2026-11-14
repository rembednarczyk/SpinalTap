/**
 * The city's carriageways measured on the orthophoto (`widths.ts`, ADR-0080 PR 10): which ways are
 * measured, their junctions, the photograph from the tool's cache and the generated table with
 * its report (`widths-build.ts`).
 * A way is measured when the import would estimate its width: a carriageway (not `service`, not
 * on a bridge or in a tunnel, not an area) without `width` or `width:carriageway` in the map or in
 * the manual corrections. A width pinned by hand off the photograph (`PINNED`, the T-247 entries
 * that were corrections) takes the measure's place in the table.
 */
import { join } from "node:path";
import { TAG_CORRECTIONS, type TagCorrection, correctedLine } from "../../osm-import/src/corrections.ts";
import { withoutReplaced } from "../../osm-import/src/corrections-alchemia.ts";
import { type Line, extractFeatures } from "../../osm-import/src/features.ts";
import { type Pt, lineLength } from "../../osm-import/src/geometry.ts";
import { isCarriageway } from "../../osm-import/src/ground.ts";
import { loadInputs } from "../../osm-import/src/load.ts";
import { type OsmData } from "../../osm-import/src/osm.ts";
import { parseLength } from "../../osm-import/src/building-tags.ts";
import { roadWidth } from "../../osm-import/src/street-section.ts";
import { puwgFrame } from "../../osm-import/src/project.ts";
import { COVER, colourStats } from "./classify.ts";
import { CELLS, type CellSpec, FLIGHTS, REPO, defaultCache } from "./config.ts";
import { type Cover, coverAt, coverFor } from "./cover.ts";
import { type Tile, loadTile, pixelAt } from "./tiles.ts";
import { type Probe, type WayMeasure, measureWay } from "./widths.ts";

/** A way to measure: its axis as the import reads it, the width it would estimate and the points where other carriageways meet it. */
export interface Candidate {
  readonly id: string;
  readonly name: string;
  readonly axis: readonly Pt[];
  readonly estimate: number;
  readonly junctions: readonly Pt[];
}

export interface Measured extends Candidate {
  readonly measure: WayMeasure;
}

/** Widths measured by hand on the photograph (T-247), kept in the table over the measure: way, width (m), why. */
export const PINNED: readonly (readonly [id: string, width: number, reason: string])[] = [
  ["w66829063", 6.5, "T-247 Królewska: 6,5–7 m asfaltu na ortofoto PZGiK (zebra, oś), krawężnik 0,3 m od szacunku z lanes=2; pas 2,6 m na północ to chodnik z latarniami"],
];

const key = (p: Pt) => `${Math.round(p.x * 100)},${Math.round(p.z * 100)}`;
const bridged = (t: Line["tags"]) => (t.bridge !== undefined && t.bridge !== "no") || t.covered === "yes";

/**
 * The ways the import would lay at a width it estimates, in id order, each with the points of its
 * axis another carriageway's axis passes through (`manual`: the corrections by hand, without the
 * measured table, so a measure never reads its own output).
 */
export const candidateWays = (osm: OsmData, manual: ReadonlyMap<string, TagCorrection>): Candidate[] => {
  const lines = withoutReplaced(extractFeatures(osm)).lines.map((l) => correctedLine(l, manual));
  const roads = lines.filter((l) => isCarriageway(l.tags) && l.line.length >= 2);
  const usedBy = new Map<string, Set<string>>();
  for (const l of roads) for (const p of l.line) usedBy.set(key(p), (usedBy.get(key(p)) ?? new Set()).add(l.id));
  const out: Candidate[] = [];
  for (const l of roads) {
    const t = l.tags;
    if (t.highway === "service" || bridged(t) || parseLength(t.width ?? t["width:carriageway"]) !== null) continue;
    const junctions = l.line.filter((p) => usedBy.get(key(p))!.size > 1);
    out.push({ id: l.id, name: t.name ?? "", axis: l.line, estimate: roadWidth(t), junctions });
  }
  return out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
};

/** The class of the cover at a point, of whichever district's raster holds it. */
const coverLookup = (covers: readonly Cover[]) => (x: number, z: number): number => {
  const c = coverFor(covers, { x, z });
  return c ? coverAt(c, x, z) : COVER.none;
};

/** Half the side of the square of pixels a look's colour is the mean of (m): a 0.5 m square, as a cover sample. */
const LOOK_HALF = 0.125;

/**
 * The photograph at a point (`Probe`): the cover's class and the colour of the current image's tiles
 * (one a map cell, `cells`), the mean of four pixels round it. World to grid by the similarity of
 * `puwgFrame` (as `sampleColours`).
 */
export const photoProbe = (covers: readonly Cover[], tiles: readonly { readonly cell: CellSpec; readonly tile: Tile }[]): Probe => {
  const cls = coverLookup(covers);
  const f = puwgFrame();
  const [cs, sn] = [Math.cos((f.gammaDeg * Math.PI) / 180) * f.scale, Math.sin((f.gammaDeg * Math.PI) / 180) * f.scale];
  const subs = [-LOOK_HALF, LOOK_HALF];
  return (x, z) => {
    const t = tiles.find(({ cell: { rect: r } }) => x >= r.minX && x < r.maxX && z >= r.minZ && z < r.maxZ)?.tile;
    if (!t) return null;
    let [r, g, b, n] = [0, 0, 0, 0];
    for (const dx of subs)
      for (const dz of subs) {
        const [px, pz] = [x + dx, z + dz];
        const i = pixelAt(t, { e: f.origin.e + cs * px - sn * pz, n: f.origin.n + sn * px + cs * pz });
        if (i < 0) continue;
        [r, g, b, n] = [r + t.rgb[i * 3]!, g + t.rgb[i * 3 + 1]!, b + t.rgb[i * 3 + 2]!, n + 1];
      }
    if (n < 4) return null;
    const st = colourStats([r / n, g / n, b / n]);
    return { cls: cls(x, z), l: st.l, s: st.s };
  };
};

export const measureCity = (ways: readonly Candidate[], probe: Probe): Measured[] => ways.map((w) => ({ ...w, measure: measureWay(probe, w.axis, w.estimate, w.junctions) }));

/** The generated table the import reads. */
export const TABLE_FILE = join(REPO, "tools/osm-import/src/ortho-widths.generated.ts");

/** Whether the cache holds the current image of every map cell (`measureFromCache` needs it). */
export const cachedImage = (cache = defaultCache()): boolean => CELLS.every((cell) => loadTile(cache, FLIGHTS[0]!.id, cell) !== undefined);

/**
 * The city measured: the committed OSM extracts and cover rasters, the corrections by hand, and the
 * current image (leaf-off, the ground under the trees) from the orthophoto tool's cache.
 */
export const measureFromCache = (cache = defaultCache(), root = REPO): Measured[] => {
  const inputs = loadInputs(root);
  const ways = candidateWays(inputs.osm, new Map(TAG_CORRECTIONS.map((c) => [c.id, c])));
  const tiles = CELLS.map((cell) => ({ cell, tile: loadTile(cache, FLIGHTS[0]!.id, cell) }));
  const missing = tiles.filter((t) => !t.tile).map((t) => t.cell.id);
  if (missing.length) throw new Error(`no ${FLIGHTS[0]!.id} tiles in ${cache} for ${missing.join(", ")}: run the orthophoto fetch (tools/orto/src/fetch.ts)`);
  return measureCity(ways, photoProbe(inputs.covers, tiles.map((t) => ({ cell: t.cell, tile: t.tile! }))));
};

/**
 * The table's rows: way, width (m), the carriageway's reach left and right of the axis (m; half the
 * estimate on a side not measured), the sides measured (`l`, `r`, `lr`), ref of a width pinned by
 * hand (`""` measured; pinned: both sides, half the width each).
 */
export type WidthRow = readonly [id: string, width: number, left: number, right: number, sides: string, ref: string];

export const tableRows = (measured: readonly Measured[]): WidthRow[] => {
  const pinned = new Map(PINNED.map(([id, w]) => [id, w]));
  const rows: WidthRow[] = [];
  for (const m of measured) {
    const p = pinned.get(m.id);
    const { left, right, width } = m.measure;
    if (p !== undefined) rows.push([m.id, p, p / 2, p / 2, "lr", "T-247"]);
    else if (width !== null) {
      const sides = `${left.median !== null ? "l" : ""}${right.median !== null ? "r" : ""}`;
      rows.push([m.id, width, left.median ?? m.estimate / 2, right.median ?? m.estimate / 2, sides, ""]);
    }
  }
  return rows;
};

/** The report: ways and km measured, by why not, and the axes' asymmetry. */
export const widthsReport = (measured: readonly Measured[]): string => {
  const by = new Map<string, { n: number; m: number }>();
  for (const w of measured) {
    const e = by.get(w.measure.reason) ?? { n: 0, m: 0 };
    by.set(w.measure.reason, { n: e.n + 1, m: e.m + lineLength(w.axis) });
  }
  const rows = tableRows(measured);
  const off = rows.filter((r) => Math.abs(r[2] - r[3]) > 1).length;
  const one = rows.filter((r) => r[4].length === 1).length;
  const parts = [...by].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, e]) => `${k} ${e.n} ways ${(e.m / 1000).toFixed(2)} km`);
  return `ways ${measured.length}: ${parts.join(", ")}; table ${rows.length} rows (${PINNED.length} pinned, ${one} measured on one side), axis off the middle by over 0.5 m: ${off}`;
};

export const tableText = (measured: readonly Measured[]): string => {
  const rows = tableRows(measured);
  return `/**
 * Generated by \`pnpm orto:widths\` (tools/orto/src/widths-build.ts) from the OSM extracts and the
 * cover rasters (\`data/orto\`, ADR-0077): the carriageways' widths measured on the orthophoto
 * (ADR-0080 PR 10), source \`ortho\` of the street's section. Do not edit; pin a width by hand in
 * \`PINNED\` (tools/orto/src/widths-city.ts).
 * ${widthsReport(measured)}
 */
/** Way, width (m), the carriageway's reach left and right of its axis (m), the sides measured, ref of a width pinned by hand (\`WidthRow\`). */
export const ORTHO_WIDTHS: readonly (readonly [id: string, width: number, left: number, right: number, sides: string, ref: string])[] = [
${rows.map((r) => `  ${JSON.stringify(r)},`).join("\n")}
];
`;
};
