/**
 * A street's cross section (ADR-0080 decision 1, PR 5): its strips as offsets from one axis, each
 * with the width it has and where that width comes from. This stage lays today's bands from it
 * and nothing else, byte for byte (`pieceBands`): one station along the whole laid piece, the
 * carriageway half its width each side of the piece's axis (moved aside where `fitLanes` fitted
 * it), and a sidewalk from the tags on each side that has one. The widths are not rounded to the
 * ADR's 0.05 m yet, nor ramped between stations: that changes the outlines (PR 6 on).
 *
 * The width of a carriageway by its source (decision 2), each side of the axis on its own: `osm`
 * from `width`/`width:carriageway` in the map, `ortho` measured on the orthophoto (the generated
 * table of PR 10, T-247's widths pinned in it, `corrections-kerb.ts`; a side it does not measure
 * stays `default`) or a correction by hand,
 * `fitted` narrowed to the mapped sidewalks (`fitToKerb`, T-046; `fitLanes`, G-655), `default` by
 * `lanes` or type, and `mapped-way` where `kerbFills` widens it to the paving beside it (G-570).
 * The orthophoto comes before the mapped ways (ADR-0080, the user's answer 3 of 13.11): a measured
 * street is neither fitted nor widened. `widthReport` tallies their share of the streets' length.
 */
import { parseLength } from "./building-tags.ts";
import { type Line } from "./features.ts";
import { type Pt, lineLength } from "./geometry.ts";
import { type Tags } from "./osm.ts";

export type StripKind = "carriageway" | "parking" | "kerb" | "verge" | "sidewalk" | "cycleway" | "footway";
export type WidthSource = "osm" | "ortho" | "mapped-way" | "fitted" | "default";

export interface Strip {
  readonly kind: StripKind;
  /** m, out from the strip before it (the axis for the first). */
  readonly width: number;
  readonly source: WidthSource;
}

/** A stretch along the axis, `from` to `to` m, and its strips out from the axis to the left and to the right. */
export interface Station {
  readonly from: number;
  readonly to: number;
  readonly left: readonly Strip[];
  readonly right: readonly Strip[];
}

export interface StreetSection {
  /** The way OSM maps it as (the bands' `source`). */
  readonly way: string;
  /** The carriageway's axis as laid: after `toAbutments` and `overTunnels`, moved aside by `fitLanes`. */
  readonly axis: readonly Pt[];
  /** On a bridge: the bridge way's two ends (ADR-0053). */
  readonly deck?: readonly [Pt, Pt];
  readonly stations: readonly Station[];
}

/** Carriageway width in metres by type when neither `width` nor `lanes` says. */
export const ROAD_WIDTH: Record<string, number> = {
  motorway: 14,
  trunk: 14,
  primary: 12,
  primary_link: 6,
  secondary: 10,
  secondary_link: 6,
  tertiary: 8,
  tertiary_link: 5,
  unclassified: 6,
  residential: 6.5,
  living_street: 5,
  service: 4,
  busway: 7,
  road: 6,
};
/** Streets that get sidewalks where the map has none. */
const URBAN = new Set(["primary", "secondary", "tertiary", "unclassified", "residential", "living_street"]);

/** The carriageway's width the map gives, `width` before `width:carriageway`; null when it gives none. */
const mappedWidth = (t: Tags): number | null => parseLength(t.width ?? t["width:carriageway"]);

export const roadWidth = (t: Tags): number => {
  const w = mappedWidth(t);
  if (w !== null) return w;
  const lanes = Number(t.lanes);
  if (Number.isFinite(lanes) && lanes > 0) return lanes * 3.25;
  if (t.highway === "service" && t.service === "parking_aisle") return 5;
  return ROAD_WIDTH[t.highway ?? ""] ?? 6;
};

/** The narrowest carriageway a street's mapped sidewalks narrow it to, metres: one-way, and two-way (two 2.25 m lanes, T-063). */
export const MIN_FITTED = { oneway: 3, twoWay: 4.5 };

/**
 * A street the map gives no width (no `width`, no `lanes`) narrowed to `kerb` metres each side of
 * its axis, short of its separately mapped sidewalks (T-046): the width by type would lay the
 * asphalt over their middle and `cutSidewalk` would drop them. The fitted width goes to
 * `width:carriageway`, so the bands, markings and zebras all read the same one. A street of
 * mapped `lanes` is fitted side by side instead (`fitLanes`, G-655).
 */
export const fitToKerb = (t: Tags, kerb: number | null, oneway: boolean): Tags => {
  if (kerb === null || ROAD_WIDTH[t.highway ?? ""] === undefined || mappedWidth(t) !== null || Number(t.lanes) > 0) return t;
  const w = Math.max(oneway ? MIN_FITTED.oneway : MIN_FITTED.twoWay, Math.round(2 * kerb * 10) / 10);
  return w < roadWidth(t) ? { ...t, "width:carriageway": String(w) } : t;
};

/** Sidewalk sides a road gets: tagged ones, or both on city streets without tags and without mapped sidewalks nearby. */
export const sidewalkSides = (t: Tags, mappedNearby: boolean): { left: boolean; right: boolean } => {
  const s = t.sidewalk ?? (t["sidewalk:both"] === "yes" ? "both" : undefined);
  const left = t["sidewalk:left"];
  const right = t["sidewalk:right"];
  if (s === "both" || s === "yes") return { left: true, right: true };
  if (s === "left" || s === "right") return { left: s === "left", right: s === "right" };
  if (s === "no" || s === "none" || s === "separate" || left !== undefined || right !== undefined)
    return { left: left === "yes", right: right === "yes" };
  if (mappedNearby || !URBAN.has(t.highway ?? "")) return { left: false, right: false };
  return { left: true, right: true };
};

/** A sidewalk's strip from the tags: `sidewalk:width`, else 3 m by a primary or secondary street and 2.5 m by the rest. */
const sidewalkStrip = (t: Tags): Strip => {
  const w = parseLength(t["sidewalk:width"]);
  return { kind: "sidewalk", width: w ?? (t.highway === "primary" || t.highway === "secondary" ? 3 : 2.5), source: w === null ? "default" : "osm" };
};

/**
 * The section of a laid piece of a road by type (not an area): its carriageway `roadWidth` wide
 * about its axis, its sidewalks from the tags (`sidewalkSides`; `mappedNearby`: separate sidewalks
 * run along it). `carriageway` says where the width comes from (`carriagewaySource`): it moves no
 * strip. Null for any other way.
 */
export const roadSection = (l: Line, mappedNearby: boolean, carriageway: WidthSource | Sides = "default"): StreetSection | null => {
  const t = l.tags;
  if (ROAD_WIDTH[t.highway ?? ""] === undefined || t.area === "yes") return null;
  const [lsrc, rsrc] = typeof carriageway === "string" ? [carriageway, carriageway] : carriageway;
  const half = (source: WidthSource): Strip => ({ kind: "carriageway", width: roadWidth(t) / 2, source });
  const sides = sidewalkSides(t, mappedNearby);
  const walk = sidewalkStrip(t);
  const bridge = t.bridge !== undefined && t.bridge !== "no";
  const station: Station = { from: 0, to: lineLength(l.line), left: sides.left ? [half(lsrc), walk] : [half(lsrc)], right: sides.right ? [half(rsrc), walk] : [half(rsrc)] };
  return { way: l.id, axis: l.line, ...(bridge ? { deck: [l.line[0]!, l.line[l.line.length - 1]!] as const } : {}), stations: [station] };
};

/** A strip as `pieceBands` lays it: `width` wide from `from` m off the axis (left positive), as a sidewalk's `along`. */
export interface LaidStrip {
  readonly kind: StripKind;
  readonly from: number;
  readonly width: number;
}

/**
 * The bands of a section's one station (`roadSection`), in the order `pieceBands` lays them: the
 * carriageway across the axis, then each sidewalk, left first, past the carriageway's edge.
 */
export const laidStrips = (s: StreetSection): LaidStrip[] => {
  const { left, right } = s.stations[0]!;
  const [l, r] = [left[0]!.width, right[0]!.width];
  const out: LaidStrip[] = [{ kind: "carriageway", from: -r, width: l + r }];
  if (left[1]) out.push({ kind: left[1].kind, from: l, width: left[1].width });
  if (right[1]) out.push({ kind: right[1].kind, from: -r - right[1].width, width: right[1].width });
  return out;
};

/** The sources of a carriageway's width on its left and its right. */
export type Sides = readonly [WidthSource, WidthSource];

/**
 * Where a laid carriageway's width comes from on each side: the map's tags as read (`raw`), as
 * corrected (`corrected`, `corrections.ts`), as laid (`laid`: fitted by `fitToKerb` or `fitLanes`)
 * and the sides the orthophoto measured (`ortho`, the generated table; the rest `default`).
 */
export const carriagewaySource = (raw: Tags, corrected: Tags, laid: Tags, ortho?: readonly [boolean, boolean]): Sides => {
  const both = (s: WidthSource): Sides => [s, s];
  if (mappedWidth(raw) !== null) return both("osm");
  if (ortho) return [ortho[0] ? "ortho" : "default", ortho[1] ? "ortho" : "default"];
  if (mappedWidth(corrected) !== null) return both("ortho");
  return both(mappedWidth(laid) !== null ? "fitted" : "default");
};

/** Metres of street side (each piece of a carriageway counted on its left and its right) by the source of its width. */
export type WidthReport = Record<WidthSource, number>;

const SOURCES: readonly WidthSource[] = ["osm", "ortho", "mapped-way", "fitted", "default"];

/**
 * The streets' sides by the source of their carriageway's width: each section's length on both
 * sides, less what `kerbFills` widened to the paving (`widened`: by way, m of edge), which goes to
 * `mapped-way`, taken from the way's `default` length first, then its `fitted`. `only` picks the
 * sections counted (all without).
 */
export const widthReport = (sections: readonly StreetSection[], widened: ReadonlyMap<string, number>, only: (s: StreetSection) => boolean = () => true): WidthReport => {
  const out = Object.fromEntries(SOURCES.map((k) => [k, 0])) as WidthReport;
  const byWay = new Map<string, WidthReport>();
  for (const s of sections) {
    if (!only(s)) continue;
    const way = byWay.get(s.way) ?? (Object.fromEntries(SOURCES.map((k) => [k, 0])) as WidthReport);
    byWay.set(s.way, way);
    for (const st of s.stations) {
      way[st.left[0]!.source] += st.to - st.from;
      way[st.right[0]!.source] += st.to - st.from;
    }
  }
  for (const [id, way] of byWay) {
    let rest = widened.get(id) ?? 0;
    for (const k of ["default", "fitted"] as const) {
      const moved = Math.min(rest, way[k]);
      way[k] -= moved;
      way["mapped-way"] += moved;
      rest -= moved;
    }
    for (const k of SOURCES) out[k] += way[k];
  }
  return out;
};

/** The report as one line: each source's km and share of the streets' sides. */
export const reportLine = (r: WidthReport): string => {
  const total = SOURCES.reduce((n, k) => n + r[k], 0);
  return SOURCES.map((k) => `${k} ${(r[k] / 1000).toFixed(2)} km (${total > 0 ? ((100 * r[k]) / total).toFixed(1) : "0.0"}%)`).join(", ");
};

/** A way's piece as `generate` lays it, with where its carriageway's width comes from (`carriagewaySource`). */
export interface LaidWay {
  readonly piece: Line;
  readonly mapped: boolean;
  readonly atStreet: boolean;
  readonly width: WidthSource | Sides;
}

/** The streets' width sources (`widthReport`): of all, and of those not `service`, the city's streets proper. */
export interface StreetWidths {
  readonly all: WidthReport;
  readonly streets: WidthReport;
}

/**
 * The width report of the laid ways (`laid`) that get a carriageway (`paved`: on the ground or a
 * street's gateway, as `pieceBands` lays them), with the edges `kerbFills` widened (`widened`: the
 * runs of its carriageways' bands, by way).
 */
export const streetWidths = (laid: readonly LaidWay[], paved: (w: LaidWay) => boolean, widened: Iterable<readonly [{ readonly source: string }, { readonly runs: readonly { readonly inner: readonly Pt[] }[] }]>): StreetWidths => {
  const sections = laid.flatMap((w) => (w.piece.line.length >= 2 && paved(w) ? [roadSection(w.piece, w.mapped, w.width)] : [])).filter((s): s is StreetSection => s !== null);
  const byWay = new Map<string, number>();
  for (const [b, { runs }] of widened) byWay.set(b.source, (byWay.get(b.source) ?? 0) + runs.reduce((n, r) => n + lineLength(r.inner), 0));
  const service = new Set(laid.filter((w) => w.piece.tags.highway === "service").map((w) => w.piece.id));
  return { all: widthReport(sections, byWay), streets: widthReport(sections, byWay, (s) => !service.has(s.way)) };
};
