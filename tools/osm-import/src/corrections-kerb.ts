/**
 * The kerbs the orthophoto (PZGiK) places otherwise than the import's rule (T-247, G-570). Along a
 * street the map gives no width, a gap of a metre and more between its carriageway and the paving
 * beside it is taken for asphalt the estimate left out (`kerbFills`): parking lanes and bus bays,
 * mostly. Where the gap is a lawn, or the estimate is the asphalt's true width and the gap a
 * pavement, the map is corrected here: a lawn the map lacks (the march to the paving stops at it),
 * or the width measured on the photograph (the street's width is then no estimate): the widths go
 * to the table measured on the orthophoto (`ORTHO_CORRECTIONS`, ADR-0080 PR 10).
 */
import type { AddedArea, TagCorrection } from "./corrections.ts";
import { DEPTAKI_CORRECTIONS } from "./corrections-deptaki.ts";
import { KRAKOWSKIE_ADDED_AREAS } from "./corrections-radziwillowska.ts";
import type { Line } from "./features.ts";
import { type Pt, offsetLine } from "./geometry.ts";
import { ORTHO_WIDTHS } from "./ortho-widths.generated.ts";

/** An added area of T-247: corners off the map's nodes. */
const t247 = (name: string, tags: AddedArea["tags"], ring: readonly Pt[], reason: string): AddedArea => ({
  id: `T-247/${name}`,
  tags,
  ring,
  nodesOf: ring.map(() => null),
  reason,
  ref: "T-247",
});

const pts = (xz: readonly (readonly [number, number])[]): Pt[] => xz.map(([x, z]) => ({ x, z }));

/**
 * The verge between Andersa's northbound carriageway w231037230 and its sidewalk on the east, from
 * the junction at z 345 to the one at z 413: 1.6-2.5 m of grass on the photograph, no area in the
 * map. 0.4 m under the carriageway's band and 0.5 m under the sidewalk's, both drawn over it.
 */
const ANDERSA_VERGE: AddedArea = t247(
  "trawnik-andersa",
  { landuse: "grass" },
  pts([
    [2391.45, 345.22],
    [2387.74, 352.33],
    [2385.82, 357.48],
    [2384.31, 363.64],
    [2383.7, 370.61],
    [2384.61, 381.07],
    [2390.81, 413.57],
    [2393.61, 413.4],
    [2387.79, 384.21],
    [2386.2, 371.28],
    [2386.99, 363.39],
    [2389.07, 355.16],
    [2392.14, 348.53],
    [2394.02, 345.67],
  ]),
  "pas trawy 1,6–2,5 m między jezdnią Andersa w231037230 a chodnikiem na ortofoto PZGiK, w OSM bez obszaru; reguła G-570 kładła tu asfalt",
);

/**
 * The strip of grass before the garden centre's greenhouses along the parking aisle w1561106064
 * (x 2672-2697): 0.8-1.2 m between the bands, 0.3 m under each.
 */
const AISLE_VERGE: AddedArea = t247(
  "trawnik-w1561106064",
  { landuse: "grass" },
  pts([
    [2672.99, 289.38],
    [2673.79, 289.1],
    [2678.76, 289.6],
    [2680.05, 289.86],
    [2685.93, 293.65],
    [2687.11, 294.54],
    [2694.91, 300.73],
    [2696.66, 298.54],
    [2688.05, 293.34],
    [2679.05, 287.94],
    [2674.67, 285.91],
    [2671.88, 286.1],
  ]),
  "pas trawy przed szklarniami przy alejce parkingu w1561106064 na ortofoto PZGiK, w OSM bez obszaru; import kładł tu chodnik",
);

/** The tail of `ADDED_AREAS` in draw order: Krakowskie Przedmieście's (T-243, T-245), then T-247's lawns. */
export const ADDED_AREAS_TAIL: readonly AddedArea[] = [...KRAKOWSKIE_ADDED_AREAS, ANDERSA_VERGE, AISLE_VERGE];

/**
 * The carriageways' widths measured on the orthophoto (ADR-0080 PR 10, `pnpm orto:widths`, the
 * generated table), T-247's widths by hand pinned in it: a way's `width:carriageway`, so the street
 * is no estimate (source `ortho`) and `kerbFills` leaves it as it is. A correction by hand of the
 * same way keeps its own tags over it (`corrections.ts`).
 */
export const ORTHO_CORRECTIONS: readonly TagCorrection[] = ORTHO_WIDTHS.map(([id, width, left, right, sides, ref]) => ({
  id,
  tags: { "width:carriageway": String(width) },
  reason: ref ? `szerokość ${width} m z ortofoto PZGiK, ustalona ręcznie (${ref})` : `szerokość ${width} m z ortofoto PZGiK (pomiar co 5 m, strony ${sides}: ${left} m w lewo, ${right} m w prawo od osi)`,
  ref: ref || "ADR-0080",
}));

/** Metres a measured way's carriageway lies left of its axis in OSM (negative: right): half its sides' difference, 0 for a width pinned by hand. */
export const ORTHO_OFFSETS: ReadonlyMap<string, number> = new Map(ORTHO_WIDTHS.map(([id, , left, right]) => [id, Math.round(((left - right) / 2) * 20) / 20]));

const ORTHO_BY_ID = new Map(ORTHO_WIDTHS.map((r) => [r[0], r]));

/** The sides of a way's carriageway (left, right) whose width the orthophoto gives; none for a way not in the table. */
export const orthoSides = (id: string): readonly [boolean, boolean] | undefined => {
  const row = ORTHO_BY_ID.get(id);
  return row && [row[4].includes("l"), row[4].includes("r")];
};

/** A measured way's carriageway moved aside onto the asphalt (`ORTHO_OFFSETS`), as `fitLanes` lays a fitted piece; null on its axis. */
export const orthoPieces = (l: Line): Line[] | null => {
  const off = ORTHO_OFFSETS.get(l.id);
  return off ? [{ ...l, line: offsetLine(l.line, off) }] : null;
};

/** The corrections by id: those by hand (`manual`), each over the width measured for the same way. */
export const withOrtho = (manual: readonly TagCorrection[]): Map<string, TagCorrection> => {
  const out = new Map(ORTHO_CORRECTIONS.map((c) => [c.id, c]));
  for (const c of manual) {
    const o = out.get(c.id);
    out.set(c.id, o ? { ...c, tags: { ...o.tags, ...c.tags } } : c);
  }
  return out;
};

/** The tail of `TAG_CORRECTIONS`: the pedestrian streets' widths (T-199). */
export const TAG_CORRECTIONS_TAIL: readonly TagCorrection[] = [...DEPTAKI_CORRECTIONS];
