import { ALCHEMIA_CENTRE, ALCHEMIA_PIECES, ARKADY, P1_PIECES, ARKADY_OSM_ID, ARKADY_OUTLINE, ARKADY_PIECES, ARKADY_PROP, KEPT_OSM, type AlchemiaBox, arkadyLocal } from "../../../packages/sim/src/content/alchemia";
import { WORLD_CHUNKS, WORLD_SCENERY } from "../../../packages/sim/src/content/world-map";
import { isLandmark } from "../../../packages/sim/src/content/lublin";
import { MAP_CHUNKS, PADS } from "../../../packages/sim/src/content/lublin/sites";
import { ROAD_CHAINS } from "../../../packages/sim/src/content/lublin/roads";
import { groundY } from "../../../packages/sim/src/content/lublin/terrain";
import { pavilionPrisms, segmentHitsPrism } from "./pavilion-checks";

/**
 * The glitch scan's checks of ADR-0074 (Alchemia by the investor's plan), stages 1 and 2 (the
 * pavilion of stage 3 has its own, `pavilion-checks.ts`).
 */

type Finding = { readonly at: string; readonly what: string };
type GroundPoint = { readonly x: number; readonly z: number };
type P3 = { readonly x: number; readonly y: number; readonly z: number };

const near = (x: number, z: number) => `${x.toFixed(0)},${z.toFixed(0)}`;

/** A row of the topography register: T-NNN. */
const ROW = /^T-\d{3}$/;

/**
 * `pad-unregistered` (review of #327): every pad levelling the map's terrain under a set piece
 * (`PADS`) names its row in `docs/topografia.md` (ADR-0042: a departure from the NMT is written
 * down). The baseline only goes down.
 */
export const padsUnregistered = (): Finding[] =>
  PADS.flatMap((p) => (p.row && ROW.test(p.row) ? [] : [{ at: near((p.rect.minX + p.rect.maxX) / 2, (p.rect.minZ + p.rect.maxZ) / 2), what: `pad at y ${p.y.toFixed(2)} without a T row` }]));

/** Where a segment from a to b first enters a box, as a fraction of it, or null (slabs). */
const segmentHitsBox = (a: P3, b: P3, q: AlchemiaBox): boolean => {
  let lo = 0;
  let hi = 1;
  for (const [p, d, min, max] of [
    [a.x, b.x - a.x, q.x0, q.x1],
    [a.y, b.y - a.y, q.y0, q.y1],
    [a.z, b.z - a.z, q.z0, q.z1],
  ] as const) {
    if (Math.abs(d) < 1e-12) {
      if (p < min || p > max) return false;
      continue;
    }
    const t0 = (min - p) / d;
    const t1 = (max - p) / d;
    lo = Math.max(lo, Math.min(t0, t1));
    hi = Math.min(hi, Math.max(t0, t1));
    if (lo > hi) return false;
  }
  return true;
};

/** How far round Alchemia the check looks, how much of a landmark's top it may hide, the eyes' spacing along the streets. */
const RADIUS = 250;
const MOST_HIDDEN = 0.25;
const EYE_EVERY = 8;
const EYE = 1.6;

/**
 * `game-solid-landmark-occlusion` (review of #312): Alchemia's solids (the Arkady's, the pavilion's and P-1's outside too) seen from the streets within
 * 250 m hide at most a quarter of the views of a landmark's top (the eyes on the streets from which
 * the top is behind one of its boxes, of all the eyes within 250 m of both). Baseline 0.
 */
export const alchemiaHidesLandmarks = (): Finding[] => {
  // With P-1's outside (stage 4): the ramp trench's parapets and portal, the stair core's house.
  const boxes = [...ALCHEMIA_PIECES, ...P1_PIECES].filter((p) => p.solid && !p.inside).map((p) => p.box);
  // The Arkady's boxes are of their own frame (x along the building, z across it): the eye and the top go into it.
  const arkady = ARKADY_PIECES.filter((p) => p.solid).map((p) => p.box);
  const local = (p: P3): P3 => {
    const q = arkadyLocal(p.x, p.z);
    return { x: q.a, y: p.y, z: q.c };
  };
  const pavilion = pavilionPrisms();
  const hides = (e: P3, top: P3): boolean => boxes.some((q) => segmentHitsBox(e, top, q)) || arkady.some((q) => segmentHitsBox(local(e), local(top), q)) || pavilion.some((q) => segmentHitsPrism(e, top, q));
  const c = ALCHEMIA_CENTRE;
  const eyes: P3[] = [];
  for (const r of ROAD_CHAINS) {
    for (let i = 0; i + 1 < r.points.length; i++) {
      const [ax, az] = r.points[i]!;
      const [bx, bz] = r.points[i + 1]!;
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / EYE_EVERY));
      for (let k = 0; k < n; k++) {
        const x = ax + ((bx - ax) * k) / n;
        const z = az + ((bz - az) * k) / n;
        if (Math.hypot(x - c.x, z - c.z) <= RADIUS) eyes.push({ x, y: groundY(x, z) + EYE, z });
      }
    }
  }
  const landmarks = MAP_CHUNKS.flatMap((ch) => ch.buildings.filter((b) => isLandmark(b) && Math.hypot(b.x - c.x, b.z - c.z) <= RADIUS));
  return landmarks.flatMap((b) => {
    const top = { x: b.x, y: b.y + b.height + (b.roof ?? 0), z: b.z };
    const seen = eyes.filter((e) => Math.hypot(e.x - top.x, e.z - top.z) <= RADIUS);
    if (seen.length === 0) return [];
    const hidden = seen.filter((e) => hides(e, top)).length;
    return hidden / seen.length > MOST_HIDDEN ? [{ at: near(b.x, b.z), what: `${b.name ?? b.id}: top hidden by Alchemia from ${hidden} of ${seen.length} street eyes` }] : [];
  });
};

/** What `osm-building-kept` looks at: the map's buildings, the ones the city draws, and the Arkady's own solid. */
export interface KeptInputs {
  readonly kept: readonly string[];
  readonly buildings: readonly { readonly id: string; readonly x: number; readonly z: number; readonly outline: readonly number[] }[];
  /** Is the map's building of this id drawn and solid as itself (at its centre)? */
  readonly drawn: (id: string) => boolean;
  /** The OSM building the game rebuilt as its own solid, its outline's corners and that solid's prisms' corners (world) with their tops and bottoms. */
  readonly rebuilt: {
    readonly id: string;
    readonly outline: readonly GroundPoint[];
    readonly corners: readonly GroundPoint[];
    readonly floor: number;
    readonly top: number;
    /** Its solid is among the world's static props (the map ruin's place). */
    readonly placed: boolean;
  };
}

/**
 * How far a corner may be off the OSM outline's (m): the import rounds the outline to 0.1 m, so a
 * near-rectangle (the Arkady's, 0.1 m off a parallelogram) is built of boxes to that. And the height
 * of two storeys.
 */
const KEPT_TOLERANCE = 0.15;
const TWO_STOREYS = 6;

/**
 * `osm-building-kept` (ADR-0074 §11): a building the investor's plan keeps (`KEPT_OSM`: the Arkady
 * w66286396, the shed w1565213799) has a solid in the game on its OSM outline: the map's own, or
 * the game's rebuilt one instead of it, in the world, whose outline is the OSM's corner by corner,
 * whose solids reach every side of it and no further, and which stands two storeys over its floor.
 * Baseline 0.
 */
export const osmBuildingsKept = (k: KeptInputs): Finding[] =>
  k.kept.flatMap((id): Finding[] => {
    const b = k.buildings.find((o) => o.id === id);
    if (!b) return [{ at: "?", what: `${id} not in the map` }];
    if (id !== k.rebuilt.id) return k.drawn(id) ? [] : [{ at: near(b.x, b.z), what: `${id} has no solid of its own` }];
    const osm: GroundPoint[] = [];
    for (let i = 0; i + 1 < b.outline.length; i += 2) osm.push({ x: b.outline[i]! + b.x, z: b.outline[i + 1]! + b.z });
    const off = (p: GroundPoint, list: readonly GroundPoint[]) => Math.min(...list.map((q) => Math.hypot(p.x - q.x, p.z - q.z)));
    const out: Finding[] = [];
    if (!k.rebuilt.placed) out.push({ at: near(b.x, b.z), what: `${id} rebuilt but not in the world` });
    if (k.drawn(id)) out.push({ at: near(b.x, b.z), what: `${id} drawn twice: the map's and the rebuilt` });
    if (osm.length !== k.rebuilt.outline.length || osm.some((p) => off(p, k.rebuilt.outline) > KEPT_TOLERANCE)) out.push({ at: near(b.x, b.z), what: `${id} rebuilt off its OSM outline` });
    const reached = osm.every((p) => off(p, k.rebuilt.corners) <= KEPT_TOLERANCE);
    const beyond = k.rebuilt.corners.some((p) => !insideRing(p, osm, KEPT_TOLERANCE));
    if (!reached || beyond) out.push({ at: near(b.x, b.z), what: `${id} rebuilt: its solids ${reached ? "reach past" : "fall short of"} the outline` });
    if (k.rebuilt.top - k.rebuilt.floor < TWO_STOREYS) out.push({ at: near(b.x, b.z), what: `${id} rebuilt ${(k.rebuilt.top - k.rebuilt.floor).toFixed(1)} m high, under two storeys` });
    return out;
  });

/** Is `p` inside the convex ring (either winding), or within `tol` of it? */
const insideRing = (p: GroundPoint, ring: readonly GroundPoint[], tol: number): boolean => {
  let sign = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const s = ((b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x)) / len;
    if (Math.abs(s) <= tol) continue;
    if (sign === 0) sign = Math.sign(s);
    else if (Math.sign(s) !== sign) return false;
  }
  return true;
};

/** The game's own inputs of `osm-building-kept`: the map's buildings the city draws, and the Arkady's solid. */
export const keptInGame = (): KeptInputs => {
  const drawn = new Set(WORLD_SCENERY.flatMap((s) => (s.view.kind === "building" ? [`${s.at.x},${s.at.z}`] : [])));
  const buildings = MAP_CHUNKS.flatMap((c) => c.buildings);
  const c = ARKADY_PROP.center;
  const prisms = ARKADY_PROP.prisms ?? [];
  return {
    kept: KEPT_OSM,
    buildings,
    drawn: (id) => buildings.some((b) => b.id === id && drawn.has(`${b.x},${b.z}`)),
    rebuilt: {
      id: ARKADY_OSM_ID,
      outline: ARKADY_OUTLINE,
      corners: prisms.flatMap((p) => p.points.map((q) => ({ x: q.x + c.x, z: q.z + c.z }))),
      floor: ARKADY.ground,
      top: Math.max(...prisms.map((p) => p.top + c.y)),
      placed: WORLD_CHUNKS.some((ch) => ch.props.includes(ARKADY_PROP)),
    },
  };
};
