import { segmentDistance } from "../../../packages/core/src/math/geometry2d.ts";
import type { StreetPropItem } from "../../../packages/core/src/world/city-geo.ts";
import { SITE_BOARD, SITE_CABIN, SITE_FENCE, SITE_GATE, SITE_KINDS, SITE_LEAF, siteFenceLayout, siteGateLayout } from "../../../packages/core/src/world/sites.ts";
import { SOLID_FURNITURE, distanceToPiece } from "../../../packages/sim/src/content/lublin/furniture.ts";
import type { LublinChunkData } from "../../../packages/sim/src/content/lublin/types";
import { pointInRing } from "../../osm-import/src/geometry.ts";
import type { Site } from "../../osm-import/src/props-site.ts";

/**
 * The building sites' pieces of ADR-0087 against the ground the game draws (bases 0):
 * - `site-on-road`: a sample of a piece's footprint on a carriageway or a pavement (the chunks'
 *   ground, the frontages' fills of G-853 among it), one finding a piece;
 * - `site-through-wall`: a sample in a building's outline or within `WALL_GAP` of the map's own
 *   walls and fences, one finding a piece;
 * - `site-gate-blocked`: a gate whose opening has a building, water or rails, or a solid of the
 *   furniture, `OUTSIDE` m in front of it or `INSIDE` m behind it: no way in.
 */

type Pt = { readonly x: number; readonly z: number };
type Finding = { readonly at: string; readonly what: string };

/** How near the map's walls and fences a piece's sample is in them (m). */
const WALL_GAP = 0.2;
/** How far before and behind the gate its way in is looked at (m). */
const OUTSIDE = 1.2;
const INSIDE = 2;

export interface SiteGroundQuery {
  /** What the game draws at p: `road`, `walk`, `building`, `water`, `rail`, or null for bare ground and lawns. */
  readonly surfaceAt: (p: Pt) => string | null;
  /** The map's walls and fences (ADR-0077) as lines. */
  readonly barriers: readonly (readonly Pt[])[];
}

/** The local box of a piece's footprint: half along its x, half across, offset across. */
const reach = (p: StreetPropItem): readonly [number, number, number][] => {
  if (p.prop === "site-fence") return [[siteFenceLayout(p.variant).length / 2, SITE_FENCE.thick / 2, 0]];
  if (p.prop === "site-cabin") return [[SITE_CABIN.hx, SITE_CABIN.hz, 0]];
  if (p.prop === "site-board") return [[SITE_BOARD.width / 2, 0.03, 0]];
  const g = siteGateLayout(p.variant);
  return [[g.width / 2 + 2 * SITE_GATE.post, SITE_GATE.post, 0]];
};

const world = (p: StreetPropItem, x: number, z: number): Pt => ({ x: p.x + x * Math.cos(p.yaw) + z * Math.sin(p.yaw), z: p.z - x * Math.sin(p.yaw) + z * Math.cos(p.yaw) });

/** Samples of a site piece's footprint every 0.25 m or less, its edges included (for a gate, its posts' and beam's line and its parked leaf). */
export const siteFootprint = (p: StreetPropItem): Pt[] => {
  const out: Pt[] = [];
  for (const [hx, hz, oz] of reach(p)) {
    const [nx, nz] = [Math.ceil(hx / 0.25), Math.max(1, Math.ceil(hz / 0.25))];
    for (let i = -nx; i <= nx; i++) for (let k = -nz; k <= nz; k++) out.push(world(p, (hx * i) / nx, oz + (hz * k) / nz));
  }
  if (p.prop === "site-gate") {
    const g = siteGateLayout(p.variant);
    for (let s = 0; s <= 1; s += 0.05) out.push(world(p, g.leaf * (g.width / 2 + s * (g.width + SITE_LEAF.over)), -SITE_LEAF.behind));
  }
  return out;
};

const key = (p: StreetPropItem): string => `${p.x.toFixed(2)},${p.z.toFixed(2)}`;

const sitePiecesOf = (pieces: readonly StreetPropItem[]): StreetPropItem[] => pieces.filter((p) => SITE_KINDS.has(p.prop));

/** `site-on-road`: a site piece with a sample on a carriageway or a pavement. */
export const siteOnRoad = (pieces: readonly StreetPropItem[], g: SiteGroundQuery): Finding[] =>
  sitePiecesOf(pieces).flatMap((p) => {
    const on = siteFootprint(p).find((q) => {
      const s = g.surfaceAt(q);
      return s === "road" || s === "walk";
    });
    return on ? [{ at: key(p), what: `${p.prop} on ${g.surfaceAt(on)} at ${on.x.toFixed(2)},${on.z.toFixed(2)}` }] : [];
  });

/** `site-through-wall`: a site piece with a sample in a building or by the map's own walls and fences. */
export const siteThroughWall = (pieces: readonly StreetPropItem[], g: SiteGroundQuery): Finding[] =>
  sitePiecesOf(pieces).flatMap((p) => {
    const box = siteFootprint(p);
    const xs = box.map((q) => q.x);
    const zs = box.map((q) => q.z);
    const near = g.barriers.filter((l) => l.some((q) => q.x > Math.min(...xs) - 5 && q.x < Math.max(...xs) + 5 && q.z > Math.min(...zs) - 5 && q.z < Math.max(...zs) + 5));
    const by = (q: Pt) => near.some((l) => l.some((a, i) => i + 1 < l.length && segmentDistance(q.x, q.z, a.x, a.z, l[i + 1]!.x, l[i + 1]!.z) < WALL_GAP));
    const hit = box.find((q) => g.surfaceAt(q) === "building" || by(q));
    return hit ? [{ at: key(p), what: `${p.prop} ${g.surfaceAt(hit) === "building" ? "in a building" : "by a wall of the map"} at ${hit.x.toFixed(2)},${hit.z.toFixed(2)}` }] : [];
  });

/** `site-gate-blocked`: a gate with a building, water, rails or a solid in its way in, before or behind it. */
export const siteGateBlocked = (pieces: readonly StreetPropItem[], g: SiteGroundQuery): Finding[] => {
  const solids = pieces.filter((p) => SOLID_FURNITURE.has(p.prop));
  return pieces
    .filter((p) => p.prop === "site-gate")
    .flatMap((p) => {
      const w = siteGateLayout(p.variant).width;
      const way: Pt[] = [];
      for (let s = -0.5; s <= 0.5 + 1e-9; s += 0.25) for (const z of [OUTSIDE, INSIDE * -1, 0]) way.push(world(p, s * (w - 0.6), z));
      const hit = way.find((q) => {
        const s = g.surfaceAt(q);
        return s === "building" || s === "water" || s === "rail" || solids.some((o) => o !== p && Math.abs(o.x - q.x) < 8 && Math.abs(o.z - q.z) < 8 && distanceToPiece(o, q.x, q.z) <= 0.3);
      });
      return hit ? [{ at: key(p), what: `${siteGateLayout(p.variant).wicket ? "wicket" : "gate"} blocked at ${hit.x.toFixed(2)},${hit.z.toFixed(2)}` }] : [];
    });
};

/** The game's ground for the checks: `Site`'s surfaces with the frontages' fills (which `Site` leaves out) as pavement, the chunks' barriers. */
export const siteGroundOf = (site: Site, chunks: readonly LublinChunkData[]): SiteGroundQuery => {
  const flat = (f: readonly number[]): Pt[] => Array.from({ length: f.length >> 1 }, (_, k) => ({ x: f[2 * k]!, z: f[2 * k + 1]! }));
  const fronts = chunks.flatMap((c) => c.ground.filter((x) => x.front).map((x) => flat(x.outline)));
  return {
    surfaceAt: (p) => {
      const s = site.surfaceAt(p);
      if (s === "building" || s === "road" || s === "walk") return s;
      return fronts.some((r) => pointInRing(p, r)) ? "walk" : s;
    },
    barriers: chunks.flatMap((c) => (c.barriers ?? []).filter((b) => b.kind !== "gate").map((b) => flat(b.line))),
  };
};

/** The three checks over the game's furniture. */
export const siteChecks = (pieces: () => readonly StreetPropItem[], ground: () => SiteGroundQuery): Record<string, () => Finding[]> => ({
  "site-on-road": () => siteOnRoad(pieces(), ground()),
  "site-through-wall": () => siteThroughWall(pieces(), ground()),
  "site-gate-blocked": () => siteGateBlocked(pieces(), ground()),
});
