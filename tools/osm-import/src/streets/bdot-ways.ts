/**
 * BDOT10k's carriageways as the measure of the streets in the districts on the street graph
 * (ADR-0104 pkt 4, the user's decision of 26.11: BDOT10k always wins). Each street's way matched to
 * a BDOT10k carriageway (`bdotMatch`) gets that carriageway's width as its `width:carriageway` and its
 * line's offset as the way's measured offset: the same path the orthophoto's measure takes
 * (`ORTHO_WIDTHS`, `ORTHO_OFFSETS`, `orthoPieces`), so the bands, the lanes, the markings and the
 * streets' halves all read it, and the traffic's rules stay as they are. Over the orthophoto's
 * measure and over a fit to the mapped sidewalks; both its sides are measured.
 *
 * Pattern: conflation by source priority, the matched source's attributes written onto the map's
 * feature (as a conflation tool merges a reference dataset's attributes into OSM's).
 */
import { parseLength } from "../building-tags.ts";
import { ALL_CHUNKS } from "../config.ts";
import { isCarFree } from "../corrections-car-free.ts";
import { type Offsets, ORTHO_OFFSETS, orthoSides } from "../corrections-kerb.ts";
import { type Line } from "../features.ts";
import { STREETS } from "./along-footways.ts";
import { graphDistricts } from "./graph-bands.ts";
import { bdotMatch } from "./widths.ts";

/** A way's BDOT10k measure: the carriageway's width and how far left of the way's line it lies (m, to 0.1 m as the orthophoto's). */
export interface BdotWay {
  readonly width: number;
  readonly offset: number;
}

/** The streets' ways in the districts on the street graph that a BDOT10k carriageway with a width runs along. */
export const bdotWays = (lines: readonly Line[], districts = graphDistricts(), osm: ReadonlyMap<string, Line["tags"]> = new Map()): Map<string, BdotWay> => {
  const out = new Map<string, BdotWay>();
  if (districts.size === 0) return out;
  const rects = ALL_CHUNKS.filter((c) => districts.has(c.district.slug) || districts.has(c.district.id)).map((c) => c.rect);
  const inside = (l: Line) => {
    const p = l.line[Math.floor(l.line.length / 2)]!;
    return rects.some((r) => p.x >= r.minX && p.x <= r.maxX && p.z >= r.minZ && p.z <= r.maxZ);
  };
  for (const l of lines) {
    // The map's own width comes first (ADR-0104 pkt 4: OSM → BDOT10k → the orthophoto): Olejna's `width=3.5`, not BDOT10k's 5 m.
    // The map's as mapped (`osm`), not as corrected: the orthophoto's measure is written as `width:carriageway` too (Narutowicza's 9.2 m).
    const own = osm.get(l.id) ?? l.tags;
    // Nor a street the game closes to cars (T-324's deptak): off the street graph, laid as before, its setts out to the kerb of its bays.
    if (!STREETS.has(l.tags.highway ?? "") || l.tags.area === "yes" || !inside(l) || isCarFree(l.id) || parseLength(own.width ?? own["width:carriageway"]) !== null) continue;
    const m = bdotMatch(l.line);
    if (m) out.set(l.id, { width: m.width, offset: Math.round(m.offset * 10) / 10 });
  }
  return out;
};

/**
 * The map's ways with BDOT10k's widths written on (`width:carriageway`), the measured offsets with
 * BDOT10k's over the orthophoto's, and each way's measured sides (both for a BDOT10k one).
 */
export const withBdot = (
  mapLines: readonly Line[],
  osm: readonly Line[] = mapLines,
): { lines: Line[]; offsets: Offsets; sides: (id: string) => readonly [boolean, boolean] | undefined; bdot: ReadonlyMap<string, BdotWay> } => {
  const bdot = bdotWays(mapLines, graphDistricts(), new Map(osm.map((l) => [l.id, l.tags])));
  if (bdot.size === 0) return { lines: [...mapLines], offsets: ORTHO_OFFSETS, sides: orthoSides, bdot };
  const offsets = new Map(ORTHO_OFFSETS);
  for (const [id, b] of bdot) offsets.set(id, b.offset);
  return {
    lines: mapLines.map((l) => {
      const b = bdot.get(l.id);
      return b ? { ...l, tags: { ...l.tags, "width:carriageway": String(b.width) } } : l;
    }),
    offsets,
    sides: (id) => (bdot.has(id) ? [true, true] : orthoSides(id)),
    bdot,
  };
};
