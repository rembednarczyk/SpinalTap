/**
 * Where the scan's hits of a kind lie in a cell (part of section 5, `known.ts`): the scan's own
 * findings (`reports/glitch-scan.json`, `{ found: { kind: [{ at: "x,z", what }] } }`) counted by
 * 10 m square, the `TOP_SQUARES` squares with the most samples first, and the ids the findings name, so
 * the map keeper need not read the scan's file by hand:
 * - a lane's chain (`Podzamcze#107:1>Ruska#110:1`): what comes before ` at `, when it has a `#`;
 * - else the first OSM element (`w783241007`, `n…`, `r…`) and the T rows (`T-170`) it names.
 */
import { type Rect } from "../../osm-import/src/geometry.ts";

export const TOP_SQUARES = 5;
/** The side of a square (m), as the scan's hits per cell (`HIT_SQUARE` in `glitch-scan/src/map-coverage.ts`). */
export const SQUARE = 10;

export interface Finding {
  readonly at: string;
  readonly what: string;
}

export interface KindPlaces {
  /** The squares' south-west corners (m) with their samples, most first. */
  readonly squares: readonly { readonly x: number; readonly z: number; readonly samples: number }[];
  /** The ids the findings name, with their samples, most first. */
  readonly ids: readonly { readonly id: string; readonly samples: number }[];
}

const AT = /^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/;
const OSM = /(?<![\w-])[wnr]\d{3,}(?:\/\d+)?(?![\w-])/;
const T_ROW = /(?<![\w-])T-\d{3}(?!\d)/g;

/** The ids a finding's text names. */
export const idsOf = (what: string): string[] => {
  if (what.includes("#")) return [what.split(" at ")[0]!.trim()];
  const osm = OSM.exec(what)?.[0];
  return [...(osm ? [osm] : []), ...new Set([...what.matchAll(T_ROW)].map((m) => m[0]))];
};

const top = <K>(counts: Map<K, number>, n: number) => [...counts].sort((a, b) => b[1] - a[1]).slice(0, n);

/** The findings of one kind in `rect` (half-open, as the scan's cells) by square and by id. */
export const placesOf = (found: readonly Finding[], rect: Rect): KindPlaces => {
  const squares = new Map<string, number>();
  const ids = new Map<string, number>();
  for (const f of found) {
    const m = AT.exec(f.at);
    if (!m) continue;
    const [x, z] = [Number(m[1]), Number(m[2])];
    if (x < rect.minX || x >= rect.maxX || z < rect.minZ || z >= rect.maxZ) continue;
    const key = `${Math.floor(x / SQUARE) * SQUARE},${Math.floor(z / SQUARE) * SQUARE}`;
    squares.set(key, (squares.get(key) ?? 0) + 1);
    for (const id of idsOf(f.what)) ids.set(id, (ids.get(id) ?? 0) + 1);
  }
  return {
    squares: top(squares, TOP_SQUARES).map(([k, samples]) => {
      const [x, z] = k.split(",").map(Number);
      return { x: x!, z: z!, samples };
    }),
    ids: top(ids, TOP_SQUARES).map(([id, samples]) => ({ id, samples })),
  };
};

/** One line of the report: `kind: (x; z) n, …; id n, …`. */
export const placesText = (kind: string, p: KindPlaces): string =>
  `  ${kind}: ${p.squares.map((s) => `(${s.x}; ${s.z}) ${s.samples}`).join(", ") || "bez położeń"}${p.ids.length ? `; ${p.ids.map((i) => `${i.id} ${i.samples}`).join(", ")}` : ""}`;
