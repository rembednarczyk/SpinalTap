import type { StreetPropItem } from "@seki/core";
import { METRO_ENTRANCES } from "./metro";
import { inBuilding } from "./lublin/places";
import { surfacesAt } from "./lublin/roads";
import { PLAC_ZAMKOWY_AREA, PLAC_ZAMKOWY_STALLS } from "./plac-zamkowy-detail";
import { WORLD_STREET_PROPS } from "./street-props";

/*
 * The flea market's festoons on Plac Zamkowy (decision of the user 24.11: garlands and strips of light, the night of
 * the rest of the game): cables hung from the square's own lamp posts over the stalls, strung with bulbs or a neon
 * strip. Drawn only (the renderer's `festoon-signs.ts`), so no solid and no rule of the simulation changes.
 *
 * Pattern: a greedy choice of edges under constraints over the posts' graph (as Kruskal's, with the planarity of a
 * drawing: no two cables cross), each cable a catenary drawn as a parabola (its sag is small against its length).
 * The rules: a cable from post to post 9-22 m apart, over the market (its middle near a stall), clear of the trees'
 * crowns, of the buildings, of the metro pavilion's roof and of every carriageway (a bus is 3.2 m high), at most two
 * cables a post; the nearest the stalls first.
 */

export interface FestoonSpan {
  /** The cable's ends on the posts, the street's height under them plus `FESTOON_HANG`. */
  readonly a: { readonly x: number; readonly y: number; readonly z: number };
  readonly b: { readonly x: number; readonly y: number; readonly z: number };
  /** How far its middle hangs under the line of its ends (m). */
  readonly sag: number;
  /** Bulbs on the cable, or a neon strip along it. */
  readonly style: "bulbs" | "strip";
}

/** On the post's shaft under the candelabra's crown ring (3.3 m), and the cable's sag. */
export const FESTOON_HANG = 3.2;
export const FESTOON_SAG = 0.45;
/** From post to post, metres. */
const SPAN = { min: 9, max: 22 } as const;
/** A cable's middle is this near a stall at most: it hangs over the market. */
const OVER_MARKET = 10;
/** Clear of a tree's trunk in plan (its crown), of the pavilion's roof, metres. */
const TREE_CLEAR = 2.8;
const ROOF_CLEAR = 1;
/** Samples along a cable, metres. */
const STEP = 0.5;
/** The square's cables at most. */
const MOST = 8;

type P = { readonly x: number; readonly z: number };

const props = (keys: readonly string[]): StreetPropItem[] =>
  Object.values(WORLD_STREET_PROPS)
    .flat()
    .filter((i) => keys.includes(i.prop) && i.x > PLAC_ZAMKOWY_AREA.minX && i.x < PLAC_ZAMKOWY_AREA.maxX && i.z > PLAC_ZAMKOWY_AREA.minZ && i.z < PLAC_ZAMKOWY_AREA.maxZ);

const toSegment = (p: P, a: P, b: P): number => {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t));
};

const cross = (o: P, a: P, b: P): number => (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);
/** Do two cables cross (sharing a post is not crossing)? */
const crosses = (a: P, b: P, c: P, d: P): boolean => {
  const same = (p: P, q: P) => p.x === q.x && p.z === q.z;
  if (same(a, c) || same(a, d) || same(b, c) || same(b, d)) return false;
  return cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0;
};

const ROOFS = METRO_ENTRANCES.map((e) => e.roof);
const underRoof = (p: P): boolean => ROOFS.some((r) => p.x > r.minX - ROOF_CLEAR && p.x < r.maxX + ROOF_CLEAR && p.z > r.minZ - ROOF_CLEAR && p.z < r.maxZ + ROOF_CLEAR);

/** Is the ground under the cable free of buildings, the pavilion's roof and carriageways? */
const clearUnder = (a: P, b: P): boolean => {
  const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / STEP);
  for (let k = 1; k < n; k++) {
    const p = { x: a.x + ((b.x - a.x) * k) / n, z: a.z + ((b.z - a.z) * k) / n };
    if (inBuilding(p.x, p.z) || underRoof(p) || surfacesAt(p.x, p.z).includes("road")) return false;
  }
  return true;
};

const plan = (): FestoonSpan[] => {
  const posts = props(["lamp-candelabra", "lamp-park"]);
  const trees = props(["tree"]);
  const edges: { a: StreetPropItem; b: StreetPropItem; rank: number; length: number }[] = [];
  for (let i = 0; i < posts.length; i++)
    for (let j = i + 1; j < posts.length; j++) {
      const [a, b] = [posts[i]!, posts[j]!];
      const length = Math.hypot(b.x - a.x, b.z - a.z);
      if (length < SPAN.min || length > SPAN.max) continue;
      const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
      const rank = Math.min(...PLAC_ZAMKOWY_STALLS.map((s) => Math.hypot(s.x - mid.x, s.z - mid.z)));
      if (rank > OVER_MARKET) continue;
      if (trees.some((t) => toSegment(t, a, b) < TREE_CLEAR) || !clearUnder(a, b)) continue;
      edges.push({ a, b, rank, length });
    }
  edges.sort((p, q) => p.rank - q.rank || p.length - q.length || p.a.x - q.a.x || p.a.z - q.a.z);
  const chosen: typeof edges = [];
  const degree = new Map<StreetPropItem, number>();
  for (const e of edges) {
    if (chosen.length >= MOST) break;
    if ((degree.get(e.a) ?? 0) >= 2 || (degree.get(e.b) ?? 0) >= 2) continue;
    if (chosen.some((c) => crosses(c.a, c.b, e.a, e.b))) continue;
    chosen.push(e);
    degree.set(e.a, (degree.get(e.a) ?? 0) + 1);
    degree.set(e.b, (degree.get(e.b) ?? 0) + 1);
  }
  // Bulbs and strips by turns along the market, so warm and neon light mix as in the rest of the night city.
  return chosen.map((e, k) => ({
    a: { x: e.a.x, y: e.a.y + FESTOON_HANG, z: e.a.z },
    b: { x: e.b.x, y: e.b.y + FESTOON_HANG, z: e.b.z },
    sag: FESTOON_SAG,
    style: k % 2 === 1 ? "strip" : "bulbs",
  }));
};

export const PLAC_ZAMKOWY_FESTOONS: readonly FestoonSpan[] = plan();

/** A point of a festoon `t` (0..1) along it: the line of its ends, less the parabola of its sag. */
export const festoonAt = (s: FestoonSpan, t: number): { x: number; y: number; z: number } => ({
  x: s.a.x + (s.b.x - s.a.x) * t,
  y: s.a.y + (s.b.y - s.a.y) * t - 4 * s.sag * t * (1 - t),
  z: s.a.z + (s.b.z - s.a.z) * t,
});
