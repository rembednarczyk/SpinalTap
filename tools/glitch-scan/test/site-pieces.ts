import { segmentDistance } from "../../../packages/core/src/math/geometry2d.ts";
import type { StreetPropItem } from "../../../packages/core/src/world/city-geo.ts";
import {
  SITE_BOARD,
  SITE_CABIN,
  SITE_CRANE,
  SITE_FENCE,
  SITE_GATE,
  SITE_KINDS,
  SITE_LEAF,
  SITE_SCAFFOLD,
  siteCraneLayout,
  siteFenceLayout,
  siteGateLayout,
  siteScaffoldLayout,
} from "../../../packages/core/src/world/sites.ts";
import { SOLID_FURNITURE, distanceToPiece } from "../../../packages/sim/src/content/lublin/furniture.ts";
import type { LublinChunkData } from "../../../packages/sim/src/content/lublin/types";
import { pointInRing } from "../../osm-import/src/geometry.ts";
import type { Site } from "../../osm-import/src/props-site.ts";

/**
 * The building sites' pieces of ADR-0087 against the ground the game draws (bases 0):
 * - `site-on-road`: a sample of a piece's footprint on a carriageway or a pavement (the chunks'
 *   ground, the frontages' fills of G-853 among it), one finding a piece; a square's paving alone
 *   (`paving`, no sidewalk or path over it) is the site's own ground (decision of 24.11);
 * - `site-through-wall`: a sample in a building's outline or within `WALL_GAP` of the map's own
 *   walls and fences, one finding a piece;
 * - `site-gate-blocked`: a gate whose opening has a building, water or rails, or a solid of the
 *   furniture, `OUTSIDE` m in front of it or `INSIDE` m behind it: no way in;
 * - `site-crane-reach` (stage 2): a corner of the site's outline its crane's jib does not reach;
 * - `site-crane-heritage` (G-894): a crane before a listed building's facade in the outline;
 * - `site-over-board` (G-893): a piece before a venue's board, hiding it.
 */

type Pt = { readonly x: number; readonly z: number };
type Finding = { readonly at: string; readonly what: string };

/** How near the map's walls and fences a piece's sample is in them (m). */
const WALL_GAP = 0.2;
/** How far before and behind the gate its way in is looked at (m). */
const OUTSIDE = 1.2;
const INSIDE = 2;

export interface SiteGroundQuery {
  /** What the game draws at p: `road`, `walk`, `paving` (a square's alone), `building`, `water`, `rail`, or null for bare ground and lawns. */
  readonly surfaceAt: (p: Pt) => string | null;
  /** The map's walls and fences (ADR-0077) as lines. */
  readonly barriers: readonly (readonly Pt[])[];
}

/** The local box of a piece's footprint: half along its x, half across, offset across. */
const reach = (p: StreetPropItem): readonly [number, number, number][] => {
  if (p.prop === "site-fence") return [[siteFenceLayout(p.variant).length / 2, SITE_FENCE.thick / 2, 0]];
  if (p.prop === "site-cabin") return [[SITE_CABIN.hx, SITE_CABIN.hz, 0]];
  if (p.prop === "site-board") return [[SITE_BOARD.width / 2, 0.03, 0]];
  // Stage 2: the crane's base (its jib is overhead), the scaffold from the wall's side into the site.
  if (p.prop === "site-crane") return [[SITE_CRANE.base, SITE_CRANE.base, 0]];
  if (p.prop === "site-scaffold") return [[siteScaffoldLayout(p.variant).length / 2, SITE_SCAFFOLD.depth / 2, SITE_SCAFFOLD.depth / 2]];
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
      // A square's or a courtyard's paving inside a site is the site's (the user's decision of 24.11, `onAreaPaving`).
      if (s === "walk" && site.onAreaPaving(p)) return "paving";
      if (s === "building" || s === "road" || s === "walk") return s;
      return fronts.some((r) => pointInRing(p, r)) ? "walk" : s;
    },
    barriers: chunks.flatMap((c) => (c.barriers ?? []).filter((b) => b.kind !== "gate").map((b) => flat(b.line))),
  };
};

/** A site of the table as the crane's check reads it: its outline (flat x, z) and its pieces' rows. */
export interface SiteOfTable {
  readonly id: string;
  readonly outline: readonly number[];
  readonly pieces: Readonly<Partial<Record<string, readonly number[]>>>;
}

/** `site-crane-reach` (stage 2): a corner of a site's outline further from its crane's mast than the jib reaches. */
export const siteCraneReach = (sites: readonly SiteOfTable[]): Finding[] =>
  sites.flatMap((s) => {
    const row = s.pieces["site-crane"] ?? [];
    const out: Finding[] = [];
    for (let i = 0; i + 5 <= row.length; i += 5) {
      const [x, z, jib] = [row[i]!, row[i + 2]!, siteCraneLayout(row[i + 4]!).jib];
      for (let k = 0; k + 1 < s.outline.length; k += 2) {
        const d = Math.hypot(s.outline[k]! - x, s.outline[k + 1]! - z);
        if (d > jib + 1e-6) out.push({ at: `${x.toFixed(2)},${z.toFixed(2)}`, what: `${s.id}: corner ${s.outline[k]},${s.outline[k + 1]} ${d.toFixed(2)} m off, jib ${jib} m` });
      }
    }
    return out;
  });

/** A building of the map round the sites: its OSM id, its outline in the world, whether OSM tags it `historic` or `heritage`. */
export interface SiteBuilding {
  readonly id: string;
  readonly ring: readonly Pt[];
  readonly heritage: boolean;
}

/** The chunks' buildings, each once, with the protection their OSM tags give them. */
export const siteBuildingsOf = (chunks: readonly LublinChunkData[], tags: (id: string) => Readonly<Record<string, string>>): SiteBuilding[] => {
  const seen = new Set<string>();
  return chunks.flatMap((c) =>
    c.buildings.flatMap((b) => {
      if (seen.has(b.id)) return [];
      seen.add(b.id);
      const t = tags(b.id);
      const ring = Array.from({ length: b.outline.length >> 1 }, (_, k) => ({ x: b.outline[2 * k]! + b.x, z: b.outline[2 * k + 1]! + b.z }));
      return [{ id: b.id, ring, heritage: t.historic !== undefined || t.heritage !== undefined }];
    }),
  );
};

/** How near a listed building a crane's mast stands to be in its front (m), and the sites whose crane the orthophoto shows there. */
const HERITAGE_CLEAR = 15;
const HERITAGE_CRANES: ReadonlySet<string> = new Set([
  // The crane in the courtyard of Pałac Potockich, on the orthophoto of 2025-04.
  "w1236055101",
]);

const ringDistance = (p: Pt, ring: readonly Pt[]): number => {
  if (pointInRing(p, ring)) return 0;
  let d = Infinity;
  for (let i = 0; i < ring.length; i++) d = Math.min(d, segmentDistance(p.x, p.z, ring[i]!.x, ring[i]!.z, ring[(i + 1) % ring.length]!.x, ring[(i + 1) % ring.length]!.z));
  return d;
};

/**
 * `site-crane-heritage` (G-894): a crane's mast nearer than `HERITAGE_CLEAR` m to a listed building
 * (`historic`, `heritage`) with half its corners or more in the site's outline: a crane before a
 * palace's facade. The sites of `HERITAGE_CRANES` aside.
 */
export const siteCraneHeritage = (sites: readonly SiteOfTable[], buildings: readonly SiteBuilding[]): Finding[] =>
  sites
    .filter((s) => !HERITAGE_CRANES.has(s.id))
    .flatMap((s) => {
      const outline = Array.from({ length: s.outline.length >> 1 }, (_, k) => ({ x: s.outline[2 * k]!, z: s.outline[2 * k + 1]! }));
      const listed = buildings.filter((b) => b.heritage && 2 * b.ring.filter((p) => pointInRing(p, outline)).length >= b.ring.length);
      const row = s.pieces["site-crane"] ?? [];
      const out: Finding[] = [];
      for (let i = 0; i + 5 <= row.length; i += 5) {
        const at = { x: row[i]!, z: row[i + 2]! };
        for (const b of listed) {
          const d = ringDistance(at, b.ring);
          if (d < HERITAGE_CLEAR) out.push({ at: `${at.x.toFixed(2)},${at.z.toFixed(2)}`, what: `${s.id}: crane ${d.toFixed(2)} m off the listed ${b.id}` });
        }
      }
      return out;
    });

/** A venue's board as the renderer hangs it: its face's ends on the wall, the wall's outward normal, its bottom and top (world y). */
export interface SiteBoardSpan {
  readonly a: Pt;
  readonly b: Pt;
  readonly nx: number;
  readonly nz: number;
  readonly bottom: number;
  readonly top: number;
  readonly text: string;
}

/** How far in front of a board's face a piece hides it (m). */
const BEFORE_BOARD = 1.5;

/** The world y of a site piece's top. */
const pieceTop = (p: StreetPropItem): number => {
  if (p.prop === "site-fence") return p.y + SITE_FENCE.height;
  if (p.prop === "site-gate") return p.y + SITE_GATE.height;
  if (p.prop === "site-cabin") return p.y + SITE_CABIN.height;
  if (p.prop === "site-board") return p.y + SITE_BOARD.top;
  if (p.prop === "site-crane") return p.y + siteCraneLayout(p.variant).height;
  return p.y + siteScaffoldLayout(p.variant).height;
};

/** `site-over-board` (G-893): a site piece with a sample up to `BEFORE_BOARD` m before a venue's board, along it and over its bottom: the board hidden. */
export const siteOverBoard = (pieces: readonly StreetPropItem[], boards: readonly SiteBoardSpan[]): Finding[] =>
  sitePiecesOf(pieces).flatMap((p) => {
    const near = boards.filter((s) => Math.hypot(s.a.x - p.x, s.a.z - p.z) < 40 && pieceTop(p) > s.bottom && p.y < s.top);
    const box = near.length > 0 ? siteFootprint(p) : [];
    const hit = near.find((s) => {
      const len = Math.hypot(s.b.x - s.a.x, s.b.z - s.a.z);
      if (len < 1e-6) return false;
      const [dx, dz] = [(s.b.x - s.a.x) / len, (s.b.z - s.a.z) / len];
      return box.some((q) => {
        const [u, w] = [(q.x - s.a.x) * dx + (q.z - s.a.z) * dz, (q.x - s.a.x) * s.nx + (q.z - s.a.z) * s.nz];
        return u >= 0 && u <= len && w > 0 && w <= BEFORE_BOARD;
      });
    });
    return hit ? [{ at: key(p), what: `${p.prop} before the board ${hit.text}` }] : [];
  });

/** The checks over the game's furniture, the sites' table, the buildings round them and the venues' boards. */
export const siteChecks = (
  pieces: () => readonly StreetPropItem[],
  ground: () => SiteGroundQuery,
  sites: () => readonly SiteOfTable[] = () => [],
  buildings: () => readonly SiteBuilding[] = () => [],
  boards: () => readonly SiteBoardSpan[] = () => [],
): Record<string, () => Finding[]> => ({
  "site-on-road": () => siteOnRoad(pieces(), ground()),
  "site-through-wall": () => siteThroughWall(pieces(), ground()),
  "site-gate-blocked": () => siteGateBlocked(pieces(), ground()),
  "site-crane-reach": () => siteCraneReach(sites()),
  "site-crane-heritage": () => siteCraneHeritage(sites(), buildings()),
  "site-over-board": () => siteOverBoard(pieces(), boards()),
});
