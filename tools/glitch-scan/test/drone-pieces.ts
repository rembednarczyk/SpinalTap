import type { GroundSurface, Vec3, ViewDescriptor } from "../../../packages/core/src";
import { DRONE_KINDS, DRONE_SIZE, type DroneKind, BOB, dronePose, loopLength } from "../../../packages/engine/src/renderer/drones/drone-flight";
import { type DroneLane, type DroneWorld, planDroneLanes } from "../../../packages/engine/src/renderer/drones/drone-lanes";
import { droneWorldOf } from "../../../packages/engine/src/renderer/drones/drone-world";
import type { PatrolLane } from "../../../packages/engine/src/renderer/drones/patrol-flight";
import { landmarkAt } from "../../../packages/engine/src/renderer/mapcity/landmarks";
import { type P2, boundsOf, cleanRing, pointInRing } from "../../../packages/engine/src/renderer/mapcity/polygon";
import { patrolPoints } from "./patrol-pieces";

/**
 * The drones over the street canyons of ADR-0058 stage 7, flown round every lane the renderer
 * plans from the scenery and checked against the scenery itself, metre by metre, each kind with
 * its box: never in a building's solid (its superstructure, roof and the masts on it included),
 * never near a landmark, always over the street's surfaces and never over a house. The planner
 * samples every 4 m with its own corridor; this flies the drones' real loop, turns included.
 *
 * The low patrols of stage 7b (`patrols`) fly the same checks of the buildings and the streets
 * through their whole cycle, down from the ceiling and up again; not the landmarks' (the user's
 * exception for them), and their clearance from what is drawn is `drone-low-clearance`.
 */

type Finding = { readonly at: string; readonly what: string };
type Item = { readonly view: ViewDescriptor; readonly at: Vec3 };

/** The surfaces of a street, as drawn (ADR-0042): not lawns, water, basins or rails. */
const STREET: ReadonlySet<GroundSurface> = new Set(["road", "sidewalk", "square", "cobble", "footway", "steps", "crossing"]);
/** The tallest mast with its warning light on a superstructure's last tier (ADR-0051 `vertical-plan.ts`: 3 + 6 m). */
const MAST = 9;
/** How near a landmark's outline a drone may come (m): its recipe's towers and spires rise over its view's height. */
const LANDMARK_ROOM = 30;
/** Metres between the points of a loop flown. */
const STEP = 1;
/** Every kind flies the same line over the ground: the checks of the ground fly one. */
const XZ: readonly DroneKind[] = ["patrol"];

interface Solid {
  readonly ring: readonly P2[];
  readonly box: { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number };
  readonly bottom: number;
  readonly top: number;
  readonly landmark: boolean;
}

const ringOf = (outline: readonly { x: number; z: number }[], at: Vec3): P2[] => cleanRing(outline.map((p) => ({ x: p.x + at.x, z: p.z + at.z })));

const gapTo = (p: P2, ring: readonly P2[]): number => {
  if (pointInRing(p, ring)) return 0;
  let best = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j] as P2;
    const b = ring[i] as P2;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(a.x + dx * t - p.x, a.z + dz * t - p.z));
  }
  return best;
};

/** Every point of a lane's loop for a kind: where its box is, and its reach across (half its diagonal). */
const flown = (lane: DroneLane, kind: DroneKind): { p: P2; bottom: number; top: number; reach: number }[] => {
  const size = DRONE_SIZE[kind];
  const reach = Math.hypot(size.width, size.length) / 2;
  const out: { p: P2; bottom: number; top: number; reach: number }[] = [];
  for (let u = 0; u < loopLength(lane); u += STEP) {
    // At time 0 a drone with phase u is u metres round its loop, its bob at the middle.
    const pose = dronePose({ kind, lane, phase: u, bob: 0 }, 0);
    out.push({ p: { x: pose.x, z: pose.z }, bottom: pose.y - BOB, top: pose.y + BOB + size.height, reach });
  }
  return out;
};

/** The checks of the drones, by finding kind; `plan` is the renderer's planner unless a test hands its own lanes. */
export const droneChecks = (
  items: readonly Item[],
  axes: readonly (readonly P2[])[],
  groundAt: (x: number, z: number) => number | null,
  plan: (world: DroneWorld) => readonly DroneLane[] = planDroneLanes,
  patrols: () => readonly PatrolLane[] = () => [],
): Readonly<Record<string, () => Finding[]>> => {
  const memo: { lanes?: readonly DroneLane[] } = {};
  const lanes = () => (memo.lanes ??= plan(droneWorldOf(items, axes, groundAt)));
  const solids: Solid[] = items.flatMap(({ view, at }) => {
    if (view.kind !== "building") return [];
    const ring = ringOf(view.outline, at);
    const top = at.y + view.height + Math.max(0, view.vertical?.rise ?? 0) + Math.max(0, view.roof ?? 0) + (view.vertical ? MAST : 0);
    const landmark = view.use === "church" || landmarkAt(at.x, at.z, view.outline.length) !== null;
    return ring.length >= 3 ? [{ ring, box: boundsOf(ring), bottom: at.y + (view.soffit ?? 0), top, landmark }] : [];
  });
  const streets = items.flatMap(({ view, at }) => (view.kind === "ground" && STREET.has(view.surface) ? [ringOf(view.outline, at)] : [])).map((ring) => ({ ring, box: boundsOf(ring) }));
  const onStreet = (p: P2) => streets.some(({ ring, box }) => p.x >= box.minX && p.x <= box.maxX && p.z >= box.minZ && p.z <= box.maxZ && pointInRing(p, ring));
  const near = (p: P2, r: number) => solids.filter((s) => p.x >= s.box.minX - r && p.x <= s.box.maxX + r && p.z >= s.box.minZ - r && p.z <= s.box.maxZ + r);
  const where = (lane: { readonly points: readonly P2[] }, p: P2) => `lane from ${lane.points[0]!.x.toFixed(0)},${lane.points[0]!.z.toFixed(0)} at ${p.x.toFixed(0)},${p.z.toFixed(0)}`;
  /** One finding per lane: the first point of its loop where `bad` says what is wrong. */
  const perLane = (bad: (lane: DroneLane, kind: DroneKind) => { p: P2; what: string } | null, kinds: readonly DroneKind[] = DRONE_KINDS) => (): Finding[] =>
    lanes().flatMap((lane) => {
      for (const kind of kinds) {
        const hit = bad(lane, kind);
        if (hit) return [{ at: where(lane, hit.p), what: `${kind}: ${hit.what}` }];
      }
      return [];
    });
  const inBuilding = (f: { p: P2; bottom: number; top: number; reach: number }) => near(f.p, f.reach + 2).find((b) => f.bottom < b.top && f.top > b.bottom && gapTo(f.p, b.ring) < f.reach);
  /** One finding per patrol lane: the first point of its flight where `bad` says what is wrong. */
  const perPatrol = (bad: (f: { p: P2; bottom: number; top: number; reach: number }) => string | null): Finding[] =>
    patrols().flatMap((lane) => {
      for (const f of patrolPoints(lane)) {
        const what = bad(f);
        if (what) return [{ at: `patrol ${where(lane, f.p)}`, what: `patrol: ${what}` }];
      }
      return [];
    });
  return {
    /** A drone's box in a building's solid: its walls, superstructure, roof or masts. */
    "drone-in-building": () => [
      ...perLane((lane, kind) => {
        for (const f of flown(lane, kind)) {
          const s = inBuilding(f);
          if (s) return { p: f.p, what: `in a building up to ${s.top.toFixed(1)} m, its foot at ${f.bottom.toFixed(1)} m` };
        }
        return null;
      })(),
      ...perPatrol((f) => {
        const s = inBuilding(f);
        return s ? `in a building up to ${s.top.toFixed(1)} m, its foot at ${f.bottom.toFixed(1)} m` : null;
      }),
    ],
    /** A drone within `LANDMARK_ROOM` of a landmark's outline (ADR-0058: the landmarks and the Old Town stay calm). */
    "drone-by-landmark": perLane((lane, kind) => {
      for (const f of flown(lane, kind)) if (near(f.p, LANDMARK_ROOM).some((b) => b.landmark && gapTo(f.p, b.ring) < LANDMARK_ROOM)) return { p: f.p, what: "by a landmark" };
      return null;
    }),
    /** A drone over no surface of a street (a lawn, the river, beyond the map). */
    "drone-off-street": () => [
      ...perLane((lane, kind) => {
        for (const f of flown(lane, kind)) if (!onStreet(f.p)) return { p: f.p, what: "over no street" };
        return null;
      }, XZ)(),
      ...perPatrol((f) => (onStreet(f.p) ? null : "over no street")),
    ],
    /** A drone's middle over a house: the route must keep to the streets even above the roofs. */
    "drone-over-building": () => [
      ...perLane((lane, kind) => {
        for (const f of flown(lane, kind)) if (near(f.p, 0).some((b) => pointInRing(f.p, b.ring))) return { p: f.p, what: "over a building" };
        return null;
      }, XZ)(),
      ...perPatrol((f) => (near(f.p, 0).some((b) => pointInRing(f.p, b.ring)) ? "over a building" : null)),
    ],
  };
};
