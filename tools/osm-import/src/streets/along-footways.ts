import { segmentDistance } from "../../../../packages/core/src/math/geometry2d.ts";
import { type Line } from "../features.ts";
import { type Pt, pointInRing, ringBounds } from "../geometry.ts";
import { type Tags } from "../osm.ts";
import { roadWidth } from "../street-section.ts";

/** The streets with a carriageway and sidewalks: no service way, no track (ADR-0104). */
export const STREETS: ReadonlySet<string> = new Set([
  "primary", "primary_link", "secondary", "secondary_link", "tertiary", "tertiary_link", "residential", "unclassified", "living_street",
]);

/**
 * The plain footways that are a street's sidewalk (ADR-0104's `mapped-way` source; first written
 * for the sidewalks' uniformity, step 2, 26.11): Lublin maps many sidewalks as `highway=footway` without `footway=sidewalk`
 * (G-655), and the import laid them as a park's path (`footway`, +0.09 m) by the kerb, a patch and
 * a step against the street's sidewalks (+0.16 m, `sidewalk-surface-patch`, `sidewalk-step`). A
 * footway that runs along a street with a carriageway (`STREETS`), parallel to its axis and
 * beside its kerb, over `SHARE` of its length and `MIN_LENGTH` at least, is laid as that street's
 * sidewalk: for the ground alone, not for the kerb's fit (`sidewalkIndex`), so no carriageway's
 * width moves. Not a footway beside a mapped square or pedestrian area (`places`, the map's own
 * `square` and `cobble` pavings): it is that place's paving, level with it, as step 1 keeps a fill
 * that meets a place (the curator's review, U1).
 *
 * Pattern: map matching of a path to the road network by distance and heading (as GPS traces are
 * matched to roads), on samples along the way.
 */

/** Samples along a footway (m). */
const STEP = 2;
/** How far past the carriageway's edge a sidewalk's axis lies (m): a sidewalk 3 m wide and its kerb. */
const BEYOND = 3;
/** How near the carriageway's edge, inside it, the axis may lie (m): a fitted carriageway reaches to the sidewalk's middle. */
const INSIDE = 1;
/** |cos| of the angle between a footway and the street it runs along. */
const PARALLEL = 0.9;
/** How much farther a footway may lie when a mapped bay (a car park along the kerb, an asphalt area) lies between it and the carriageway (m): a perpendicular bay 5 m deep and its kerb. */
const BAY = 6;
/** The share of a footway's samples by a street. */
export const SHARE = 0.6;
/** The shortest footway laid as a sidewalk (m): a link of a few metres to a crossing is no sidewalk. */
export const MIN_LENGTH = 10;

const plainFootway = (t: Tags): boolean =>
  t.highway === "footway" && t.footway !== "sidewalk" && t.footway !== "crossing" && t.area !== "yes" && !t.bridge && !t.tunnel && Number(t.layer ?? 0) === 0;

type Sample = Pt & { readonly tx: number; readonly tz: number };

const samples = (line: readonly Pt[]): Sample[] => {
  const out: Sample[] = [];
  for (let i = 0; i + 1 < line.length; i++) {
    const [a, b] = [line[i]!, line[i + 1]!];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len < 1e-6) continue;
    const n = Math.max(1, Math.ceil(len / STEP));
    for (let k = 0; k < n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, z: a.z + ((b.z - a.z) * k) / n, tx: (b.x - a.x) / len, tz: (b.z - a.z) / len });
  }
  return out;
};

const length = (line: readonly Pt[]): number => line.slice(1).reduce((s, b, i) => s + Math.hypot(b.x - line[i]!.x, b.z - line[i]!.z), 0);

/** How near a mapped place a footway's sample keeps it the place's paving (m). */
export const PLACE_NEAR = 1.5;

/** Whether a sample lies in or within `PLACE_NEAR` of one of the rings. */
const byPlace = (p: Pt, places: readonly { readonly ring: readonly Pt[]; readonly box: ReturnType<typeof ringBounds> }[]): boolean =>
  places.some(
    ({ ring, box }) =>
      p.x > box.minX - PLACE_NEAR && p.x < box.maxX + PLACE_NEAR && p.z > box.minZ - PLACE_NEAR && p.z < box.maxZ + PLACE_NEAR &&
      (pointInRing(p, ring) || ring.some((a, i) => segmentDistance(p.x, p.z, a.x, a.z, ring[(i + 1) % ring.length]!.x, ring[(i + 1) % ring.length]!.z) <= PLACE_NEAR)),
  );

/**
 * The ids of the plain footways laid as a street's sidewalk, none beside a mapped place
 * (`placeRings`). A footway behind a mapped bay (`bayRings`: `parking=street_side` and the like,
 * laid as asphalt by the kerb) may lie `BAY` m farther out: the sidewalk runs behind the parked cars.
 */
export const footwaysAlongStreets = (lines: readonly Line[], placeRings: readonly (readonly Pt[])[] = [], bayRings: readonly (readonly Pt[])[] = []): Set<string> => {
  const places = placeRings.map((ring) => ({ ring, box: ringBounds(ring) }));
  const bays = bayRings.map((ring) => ({ ring, box: ringBounds(ring) }));
  const inBay = (p: Pt) => bays.some(({ ring, box }) => p.x >= box.minX && p.x <= box.maxX && p.z >= box.minZ && p.z <= box.maxZ && pointInRing(p, ring));
  const CELL = 16;
  const grid = new Map<string, (Sample & { readonly half: number })[]>();
  for (const l of lines) {
    if (!STREETS.has(l.tags.highway ?? "") || l.tags.area === "yes") continue;
    const half = roadWidth(l.tags) / 2;
    for (const s of samples(l.line)) {
      const k = `${Math.floor(s.x / CELL)},${Math.floor(s.z / CELL)}`;
      grid.set(k, [...(grid.get(k) ?? []), { ...s, half }]);
    }
  }
  const byStreet = (p: Sample): boolean => {
    const [cx, cz] = [Math.floor(p.x / CELL), Math.floor(p.z / CELL)];
    for (let i = cx - 1; i <= cx + 1; i++)
      for (let j = cz - 1; j <= cz + 1; j++)
        for (const q of grid.get(`${i},${j}`) ?? []) {
          if (Math.abs(q.tx * p.tx + q.tz * p.tz) < PARALLEL) continue;
          const along = (p.x - q.x) * q.tx + (p.z - q.z) * q.tz;
          const across = Math.abs((p.z - q.z) * q.tx - (p.x - q.x) * q.tz);
          if (Math.abs(along) > STEP || across < q.half - INSIDE) continue;
          if (across <= q.half + BEYOND) return true;
          // Behind a bay: the point halfway between the kerb and the footway lies in it.
          const side = Math.sign((p.z - q.z) * q.tx - (p.x - q.x) * q.tz);
          const mid = (q.half + across) / 2;
          if (across <= q.half + BEYOND + BAY && inBay({ x: q.x - side * q.tz * mid, z: q.z + side * q.tx * mid })) return true;
        }
    return false;
  };
  const out = new Set<string>();
  for (const l of lines) {
    if (!plainFootway(l.tags) || length(l.line) < MIN_LENGTH) continue;
    const s = samples(l.line);
    if (s.length > 0 && s.filter(byStreet).length / s.length >= SHARE && !s.some((p) => byPlace(p, places))) out.add(l.id);
  }
  return out;
};
