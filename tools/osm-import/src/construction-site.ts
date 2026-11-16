/**
 * The building sites of Lublin 2077 (ADR-0087 stage 1): a deterministic generator that lays a
 * cyberpunk building site on each site of the map (`landuse=construction`, `building=construction`):
 * the fence with its hologram ads and LED strip, the gate by the street, the information board,
 * the office containers of the back yard and the dig. The same outline on the same ground gives
 * the same site; its only randomness is a stream (mulberry32, as the crowd's looks) seeded with
 * the outline's id. The steps:
 *
 * 1. the set by the area: up to `SETS.fence` m² the fence and the board alone, up to `SETS.yard`
 *    the containers and the dig too, the full set past it (the crane comes with stage 2);
 * 2. the fence 0.3 m in, on free ground only (`construction-fence.ts`), the gate on it;
 * 3. the dig over the lowest free ground (`construction-dig.ts`), the yard by the gate kept clear;
 * 4. the containers on the back yard by the fence, furthest from the dig, their doors to the site;
 * 5. the board's texts: keys of the catalogs `i18n/{en,pl}` (ADR-0056), never sentences.
 */
import { mulberry32 } from "../../../packages/core/src/math/mulberry32.ts";
import { type StreetPropItem } from "../../../packages/core/src/world/city-geo.ts";
import { SITE_CABIN, SITE_LOOKS } from "../../../packages/core/src/world/sites.ts";
import { type SiteGround, ringCell } from "./construction-ground.ts";
import { type DigPlan, digShape, planDig } from "./construction-dig.ts";
import { FENCE_INSET, type FenceEdge, type GatePlace, along, fenceEdges, fencePieces, freeRuns, insetRing, pickGate } from "./construction-fence.ts";
import { type Pt, pointInRing, signedArea } from "./geometry.ts";
import { longAxisDegrees } from "./long-axis.ts";

/** The areas (m²) the sets end at: the fence alone, then the yard with containers and the dig, then the full set. */
export const SETS = { fence: 150, yard: 600 } as const;
export type SiteSet = "fence" | "yard" | "full";

/** The pools of the board's texts, as many keys as the catalogs hold (`site.board.*` in `i18n/{en,pl}`). */
export const BOARD_KEYS = { name: 8, developer: 6, term: 4 } as const;

/** The yard by the gate no container takes (m from the gate's middle). */
const YARD = 7;
/** Containers' gap to the fence's line (m) and to each other. */
const CABIN_GAP = 0.35;

export interface SiteOutline {
  /** The OSM element: `w<id>`, `r<id>`. */
  readonly id: string;
  readonly ring: readonly Pt[];
}

export interface SiteBoard {
  readonly name: string;
  readonly developer: string;
  readonly term: string;
}

export interface SitePlan {
  readonly id: string;
  readonly seed: number;
  readonly set: SiteSet;
  /** The outline's area (m²). */
  readonly area: number;
  readonly gate: GatePlace | null;
  readonly board: SiteBoard | null;
  readonly dig: DigPlan | null;
  readonly pieces: readonly StreetPropItem[];
  /** Metres of the fence's line left out over ground that is not free. */
  readonly unfenced: number;
}

/** The seed of an outline's id: FNV-1a over its characters. */
export const siteSeed = (id: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193);
  return h >>> 0;
};

/** The set of a site of `area` m². */
export const siteSet = (area: number): SiteSet => (area <= SETS.fence ? "fence" : area <= SETS.yard ? "yard" : "full");

const corners = (c: Pt, yaw: number, hx: number, hz: number): Pt[] => {
  const [cs, sn] = [Math.cos(yaw), Math.sin(yaw)];
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([sx, sz]) => ({ x: c.x + sx! * hx * cs + sz! * hz * sn, z: c.z - sx! * hx * sn + sz! * hz * cs }));
};

/** Points of a box every half metre or less, its edges included. */
const boxSamples = (c: Pt, yaw: number, hx: number, hz: number): Pt[] => {
  const [nx, nz] = [Math.ceil(hx / 0.25), Math.ceil(hz / 0.25)];
  const [cs, sn] = [Math.cos(yaw), Math.sin(yaw)];
  const out: Pt[] = [];
  for (let i = -nx; i <= nx; i++)
    for (let k = -nz; k <= nz; k++) {
      const [x, z] = [(hx * i) / nx, (hz * k) / nz];
      out.push({ x: c.x + x * cs + z * sn, z: c.z - x * sn + z * cs });
    }
  return out;
};

/** Distance from p to a convex ring, 0 inside. */
const ringGap = (p: Pt, ring: readonly Pt[]): number => {
  if (pointInRing(p, ring)) return 0;
  let d = Infinity;
  ring.forEach((a, i) => {
    const b = ring[(i + 1) % ring.length]!;
    const [dx, dz] = [b.x - a.x, b.z - a.z];
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
    d = Math.min(d, Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t));
  });
  return d;
};

interface CabinSpot {
  readonly c: Pt;
  readonly yaw: number;
  readonly score: number;
}

/**
 * The containers' spots: along the fence's free runs, a container's depth in, long side along the
 * fence and its door (local +z) to the site; on free ground in the fence's ring, clear of the dig's
 * reach and of the yard by the gate. Furthest from the dig (else from the gate) first.
 */
const cabinSpots = (edges: readonly FenceEdge[], runs: ReturnType<typeof freeRuns>, ring: readonly Pt[], g: SiteGround, gate: Pt | null, dig: DigPlan | null): CabinSpot[] => {
  const reach = dig ? dig.blend + ringCell(ring, g) * Math.SQRT2 + 0.5 : 0;
  const away = dig ? dig.outline.reduce((s, p) => ({ x: s.x + p.x / 4, z: s.z + p.z / 4 }), { x: 0, z: 0 }) : gate;
  const out: CabinSpot[] = [];
  for (const r of runs) {
    const e = edges[r.edge]!;
    for (let s = r.from + SITE_CABIN.hx + 0.2; s <= r.to - SITE_CABIN.hx - 0.2; s += 1) {
      const c = along(e, s, -(SITE_CABIN.hz + CABIN_GAP));
      const yaw = Math.atan2(-e.n.x, -e.n.z);
      if (gate && Math.hypot(c.x - gate.x, c.z - gate.z) < YARD + SITE_CABIN.hx) continue;
      const pts = boxSamples(c, yaw, SITE_CABIN.hx, SITE_CABIN.hz);
      if (!pts.every((p) => pointInRing(p, ring) && g.free(p) && (!dig || ringGap(p, dig.outline) > reach))) continue;
      out.push({ c, yaw, score: away ? Math.hypot(c.x - away.x, c.z - away.z) : 0 });
    }
  }
  return out.sort((a, b) => b.score - a.score);
};

/** Do two containers' boxes (grown by the gap) overlap? Tested by the samples of one in the other. */
const cabinsMeet = (a: CabinSpot, b: CabinSpot): boolean => {
  const ring = corners(b.c, b.yaw, SITE_CABIN.hx + CABIN_GAP, SITE_CABIN.hz + CABIN_GAP);
  return boxSamples(a.c, a.yaw, SITE_CABIN.hx, SITE_CABIN.hz).some((p) => pointInRing(p, ring));
};

/** The containers: 1-2 on a yard's set, 2-3 on the full one, the last of a full set's stacked on the first when the seed says so. */
const cabins = (spots: readonly CabinSpot[], set: SiteSet, g: SiteGround, rand: () => number): StreetPropItem[] => {
  if (set === "fence") return [];
  const want = set === "yard" ? 1 + Math.floor(rand() * 2) : 2 + Math.floor(rand() * 2);
  const stack = set === "full" && rand() < 0.5;
  const looks = [0, 1, 2].map(() => Math.floor(rand() * SITE_LOOKS.cabins));
  const picked: CabinSpot[] = [];
  for (const s of spots) {
    if (picked.length >= (stack ? want - 1 : want)) break;
    if (!picked.some((p) => cabinsMeet(s, p))) picked.push(s);
  }
  const round = (v: number, k = 100) => Math.round(v * k) / k + 0;
  const out = picked.map((s, k): StreetPropItem => {
    const y = Math.max(...corners(s.c, s.yaw, SITE_CABIN.hx, SITE_CABIN.hz).map((p) => g.heightAt(p)));
    return { prop: "site-cabin", x: round(s.c.x), y: round(y), z: round(s.c.z), yaw: round(s.yaw, 1e4), variant: looks[k]! };
  });
  if (stack && out.length > 0 && out.length < want) out.push({ ...out[0]!, y: round(out[0]!.y + SITE_CABIN.height), variant: looks[2]! + 4 });
  return out;
};

/** The site the generator lays on an outline over its ground. */
export const planSite = (o: SiteOutline, g: SiteGround): SitePlan => {
  const seed = siteSeed(o.id);
  const rand = mulberry32(seed);
  const area = Math.abs(signedArea(o.ring));
  const set = siteSet(area);
  const ring = insetRing(o.ring, FENCE_INSET);
  const edges = fenceEdges(ring);
  const runs = freeRuns(edges, g);
  const gate = pickGate(edges, runs, g);
  const every = 3 + Math.floor(rand() * 3);
  const led = Math.floor(rand() * SITE_LOOKS.leds);
  const adSeed = Math.floor(rand() * SITE_LOOKS.ads);
  const boardLook = Math.floor(rand() * SITE_LOOKS.boards);
  const fence = fencePieces(edges, runs, gate, g, { every, led, ad: (k) => (adSeed + k) % SITE_LOOKS.ads, board: boardLook });
  const pick = (n: number) => Math.floor(rand() * n);
  const board = gate ? { name: `site.board.name.${pick(BOARD_KEYS.name)}`, developer: `site.board.developer.${pick(BOARD_KEYS.developer)}`, term: `site.board.term.${pick(BOARD_KEYS.term)}` } : null;
  const [share, depth] = [0.35 + 0.2 * rand(), rand()];
  const dig = set === "fence" ? null : planDig(ring, area, g, longAxisDegrees(ring), share, digShape(depth));
  const gateAt = gate ? along(edges[gate.edge]!, gate.at) : null;
  const pieces = [...fence, ...cabins(cabinSpots(edges, runs, ring, g, gateAt, dig), set, g, rand)];
  const fenced = runs.reduce((s, r) => s + r.to - r.from, 0);
  return { id: o.id, seed, set, area: Math.round(area), gate, board: gate ? board : null, dig, pieces, unfenced: Math.round(edges.reduce((s, e) => s + e.len, 0) - fenced) };
};
