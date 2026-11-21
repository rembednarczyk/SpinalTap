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
 * 3. the containers on the back yard by the fence, furthest from the gate (the yard by it kept
 *    clear for the stores), their doors to the site;
 * 4. the dig over the lowest free ground left (`construction-dig.ts`), clear of the containers;
 * 5. the board's texts: keys of the catalogs `i18n/{en,pl}` (ADR-0056), never sentences;
 * 6. (stage 2) the scaffold along a neighbour's wall on the outline (`construction-scaffold.ts`),
 *    before the containers and the dig, which keep off it; the fence's panels in its way give way;
 * 7. (stage 2) the tower crane of the full set (`construction-crane.ts`), off everything else.
 * 8. (ADR-0096 rule 2) the cones and barriers on the pavement of its street side (`construction-barriers.ts`).
 * The draws of stage 2 (the banner, the beacon's phase) come after stage 1's, so a site of stage 1
 * keeps its looks.
 */
import { mulberry32 } from "../../../packages/core/src/math/mulberry32.ts";
import { type StreetPropItem } from "../../../packages/core/src/world/city-geo.ts";
import { SITE_CABIN, SITE_CRANE, SITE_LOOKS, SITE_STACKED, siteFenceLayout } from "../../../packages/core/src/world/sites.ts";
import { siteBarriers } from "./construction-barriers.ts";
import { type SiteGround } from "./construction-ground.ts";
import { type CranePlan, NARROW, aspectAlong, cranePiece, planCrane } from "./construction-crane.ts";
import { type DigPlan, digShape, planDig } from "./construction-dig.ts";
import { type ScaffoldPlan, planScaffold, scaffoldBox, scaffoldPiece } from "./construction-scaffold.ts";
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
/** How far a container's corner may lie over or under the ground at its centre (m): its walls reach 0.3 m under its foot. */
const LEVEL = 0.25;
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
  /** The outline, to the centimetre (the scan's `site-crane-reach` measures the crane against its corners). */
  readonly outline: readonly Pt[];
  readonly gate: GatePlace | null;
  readonly board: SiteBoard | null;
  readonly dig: DigPlan | null;
  /** Stage 2: the tower crane (the full set) and the scaffold along a neighbour's wall. */
  readonly crane: CranePlan | null;
  readonly scaffold: ScaffoldPlan | null;
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

interface CabinSpot {
  readonly c: Pt;
  readonly yaw: number;
  readonly score: number;
}

/**
 * The containers' spots: along the fence's free runs, a container's depth in, long side along the
 * fence and its door (local +z) to the site; on level free ground in the fence's ring, clear of the
 * yard by the gate. Furthest from the gate first.
 */
const cabinSpots = (edges: readonly FenceEdge[], runs: ReturnType<typeof freeRuns>, ring: readonly Pt[], g: SiteGround, gate: Pt | null): CabinSpot[] => {
  const out: CabinSpot[] = [];
  for (const r of runs) {
    const e = edges[r.edge]!;
    for (let s = r.from + SITE_CABIN.hx + 0.2; s <= r.to - SITE_CABIN.hx - 0.2; s += 1) {
      const c = along(e, s, -(SITE_CABIN.hz + CABIN_GAP));
      const yaw = Math.atan2(-e.n.x, -e.n.z);
      if (gate && Math.hypot(c.x - gate.x, c.z - gate.z) < YARD + SITE_CABIN.hx) continue;
      const pts = boxSamples(c, yaw, SITE_CABIN.hx, SITE_CABIN.hz);
      // Level enough to stand on its centre's ground: its walls reach `SITE_SINK` under its foot.
      const hs = corners(c, yaw, SITE_CABIN.hx, SITE_CABIN.hz).map((p) => g.heightAt(p) - g.heightAt(c));
      if (Math.max(...hs.map(Math.abs)) > LEVEL) continue;
      if (!pts.every((p) => pointInRing(p, ring) && g.free(p))) continue;
      out.push({ c, yaw, score: gate ? Math.hypot(c.x - gate.x, c.z - gate.z) : 0 });
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
  const out = picked.map((s, k): StreetPropItem => ({ prop: "site-cabin", x: round(s.c.x), y: round(g.heightAt(s.c)), z: round(s.c.z), yaw: round(s.yaw, 1e4), variant: looks[k]! }));
  if (stack && out.length > 0 && out.length < want) out.push({ ...out[0]!, y: round(out[0]!.y + SITE_CABIN.height), variant: looks[2]! + SITE_STACKED });
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
  const laid = fencePieces(edges, runs, gate, g, { every, led, ad: (k) => (adSeed + k) % SITE_LOOKS.ads, board: boardLook });
  const pick = (n: number) => Math.floor(rand() * n);
  const board = gate ? { name: `site.board.name.${pick(BOARD_KEYS.name)}`, developer: `site.board.developer.${pick(BOARD_KEYS.developer)}`, term: `site.board.term.${pick(BOARD_KEYS.term)}` } : null;
  const [share, depth] = [0.35 + 0.2 * rand(), rand()];
  const gateAt = gate ? along(edges[gate.edge]!, gate.at) : null;
  // Stage 2: the scaffold along a neighbour's wall first; the fence's panels in its way give way to it, the gate and the board never.
  const wall = set === "fence" ? null : planScaffold(o.ring, g);
  const scaffold = wall && !laid.some((p) => p.prop !== "site-fence" && pointInRing(p, scaffoldBox(wall, 1))) ? wall : null;
  const fence = scaffold ? laid.filter((p) => !panelMeets(p, scaffoldBox(scaffold, 0.3))) : laid;
  const offScaffold = (b: number) => (scaffold ? [scaffoldBox(scaffold, b)] : []);
  const kept = offScaffold(0.3);
  const yardGround: SiteGround = { ...g, free: (p) => g.free(p) && !kept.some((b) => pointInRing(p, b)) };
  const yard = cabins(cabinSpots(edges, runs, ring, yardGround, gateAt), set, g, rand);
  // The dig keeps its blend and a cell past it off the containers and the scaffold, as off the fence.
  const boxes = [...yard.map((c) => corners(c, c.yaw, SITE_CABIN.hx + 0.3, SITE_CABIN.hz + 0.3)), ...kept];
  const digGround: SiteGround = { ...g, free: (p) => g.free(p) && !boxes.some((b) => pointInRing(p, b)) };
  const dig = set === "fence" ? null : planDig(ring, area, digGround, longAxisDegrees(ring), share, digShape(depth));
  const [banner, phase] = [pick(SITE_LOOKS.banners), pick(SITE_CRANE.phases)];
  const crane = set === "full" && aspectAlong(o.ring, longAxisDegrees(o.ring)) <= NARROW ? siteCrane(o.ring, ring, g, { gate: gateAt, dig, yard, scaffold }) : null;
  // ADR-0096 rule 2: the street side's cones and barriers, by hashes of the id, after every draw of the stream.
  const street = siteBarriers(o.id, edges, runs, gate, g);
  const pieces = [...fence, ...yard, ...(scaffold ? [scaffoldPiece(scaffold, g, banner)] : []), ...(crane ? [cranePiece(crane, g, phase)] : []), ...street];
  const fenced = runs.reduce((s, r) => s + r.to - r.from, 0);
  const outline = o.ring.map((p) => ({ x: Math.round(p.x * 100) / 100 + 0, z: Math.round(p.z * 100) / 100 + 0 }));
  return { id: o.id, seed, set, area: Math.round(area), outline, gate, board: gate ? board : null, dig, crane, scaffold, pieces, unfenced: Math.round(edges.reduce((s, e) => s + e.len, 0) - fenced) };
};

/** Does a fence's panel reach into a box: a sample every quarter of its length, its ends included, in it? */
const panelMeets = (p: StreetPropItem, box: readonly Pt[]): boolean => {
  const half = siteFenceLayout(p.variant).length / 2;
  const [c, s] = [Math.cos(p.yaw), Math.sin(p.yaw)];
  return [-1, -0.5, 0, 0.5, 1].some((k) => pointInRing({ x: p.x + k * half * c, z: p.z - k * half * s }, box));
};

/** A rectangle's corners (counter-clockwise, as a dig's) moved `by` metres out along its sides. */
const grown = (r: readonly Pt[], by: number): Pt[] => {
  const unit = (a: Pt, b: Pt) => {
    const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    return { x: (b.x - a.x) / l, z: (b.z - a.z) / l };
  };
  const [u, v] = [unit(r[0]!, r[1]!), unit(r[0]!, r[3]!)];
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([su, sv], k) => ({ x: r[k]!.x + (u.x * su! + v.x * sv!) * by, z: r[k]!.z + (u.z * su! + v.z * sv!) * by }));
};

/** The crane (stage 2) off what the site holds: the dig with its slopes, the containers, the scaffold, the gate's yard and the drone's way. */
const siteCrane = (
  outline: readonly Pt[],
  ring: readonly Pt[],
  g: SiteGround,
  on: { readonly gate: Pt | null; readonly dig: DigPlan | null; readonly yard: readonly StreetPropItem[]; readonly scaffold: ScaffoldPlan | null },
): CranePlan | null => {
  const middle = on.dig ? { x: on.dig.outline.reduce((s, p) => s + p.x, 0) / 4, z: on.dig.outline.reduce((s, p) => s + p.z, 0) / 4 } : null;
  const boxes = [
    ...(on.dig ? [grown(on.dig.outline, on.dig.blend + 0.5)] : []),
    ...on.yard.map((c) => corners(c, c.yaw, SITE_CABIN.hx + 0.5, SITE_CABIN.hz + 0.5)),
    ...(on.scaffold ? [scaffoldBox(on.scaffold, 0.5)] : []),
  ];
  return planCrane(outline, ring, g, { boxes, gate: on.gate, way: on.gate && middle ? [on.gate, middle] : null }, middle);
};
