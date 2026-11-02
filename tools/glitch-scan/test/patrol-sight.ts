import type { Vec3, ViewDescriptor } from "../../../packages/core/src";
import { PATROL_SIZE, type PatrolLane } from "../../../packages/engine/src/renderer/drones/patrol-flight";
import { type Observer, PATROL_UNSEEN, inView } from "../../../packages/engine/src/renderer/drones/patrol-sight";
import { BinIndex } from "../../../packages/engine/src/renderer/mapcity/map-index";
import { type P2, boundsOf, cleanRing, pointInRing } from "../../../packages/engine/src/renderer/mapcity/polygon";
import { patrolPoints } from "./patrol-pieces";

/**
 * Where the low patrols of ADR-0058 stage 7b come into sight and go, seen from the pedestrian streets
 * (`drone-low-pop`): every moment a patrol is drawn smaller than it is or next to a moment it is away,
 * its box's middle against every observer of `observersOf` (eyes 1.7 m over the paving every 2 m
 * along the axes of the `pedestrian` and `living_street` streets) who has it in view by height and
 * distance (`inView`: under 40 degrees over the horizon and nearer than `PATROL_UNSEEN`, where it
 * still takes 2 px on the reference screen), and whose line of sight to it no building's walls (with
 * the superstructure, without the roof: the gables let more through) and no terrain blocks.
 */

type Finding = { readonly at: string; readonly what: string };
type Item = { readonly view: ViewDescriptor; readonly at: Vec3 };

/** Metres between the points of a line of sight tested. */
const RAY_STEP = 1;

interface Wall {
  readonly ring: readonly P2[];
  readonly bottom: number;
  readonly top: number;
}

/** A test of the lines of sight through the buildings' walls and over the terrain. */
export const sightLines = (items: readonly Item[], groundAt: (x: number, z: number) => number) => {
  const walls: Wall[] = [];
  const index = new BinIndex();
  for (const { view, at } of items) {
    if (view.kind !== "building") continue;
    const ring = cleanRing(view.outline.map((p) => ({ x: p.x + at.x, z: p.z + at.z })));
    if (ring.length < 3) continue;
    index.add(walls.push({ ring, bottom: at.y + (view.soffit ?? 0), top: at.y + view.height + Math.max(0, view.vertical?.rise ?? 0) }) - 1, boundsOf(ring));
  }
  /** Whether nothing stands between an observer's eyes and a point. */
  return (o: Observer, x: number, y: number, z: number): boolean => {
    const d = Math.hypot(x - o.x, z - o.z);
    const n = Math.ceil(d / RAY_STEP);
    // The ends left out: the eyes stand on the street, the patrol in the air.
    for (let k = 1; k < n; k++) {
      const t = k / n;
      const qx = o.x + (x - o.x) * t;
      const qz = o.z + (z - o.z) * t;
      const qy = o.eye + (y - o.eye) * t;
      if (qy < groundAt(qx, qz)) return false;
      for (const i of index.at(qx, qz)) {
        const w = walls[i] as Wall;
        if (qy > w.bottom && qy < w.top && pointInRing({ x: qx, z: qz }, w.ring)) return false;
      }
    }
    return true;
  };
};

/** Observers by their 32 m bins. */
const observerIndex = (observers: readonly Observer[]): ((p: P2, r: number) => Observer[]) => {
  const index = new BinIndex();
  observers.forEach((o, i) => index.add(i, { minX: o.x, maxX: o.x, minZ: o.z, maxZ: o.z }));
  return (p, r) => [...index.within({ minX: p.x - r, maxX: p.x + r, minZ: p.z - r, maxZ: p.z + r })].map((i) => observers[i] as Observer);
};

/** `drone-low-pop`: one finding per lane, at the first place its patrol comes into sight or goes in someone's view. */
export const popSight = (lanes: readonly PatrolLane[], observers: readonly Observer[], clear: ReturnType<typeof sightLines>): Finding[] => {
  const near = observerIndex(observers);
  return lanes.flatMap((lane) => {
    const tried = new Set<string>();
    for (const f of patrolPoints(lane)) {
      if (!f.edge) continue;
      const y = f.bottom + PATROL_SIZE.height / 2;
      const key = `${f.p.x.toFixed(0)},${f.p.z.toFixed(0)},${y.toFixed(0)}`;
      if (tried.has(key)) continue;
      tried.add(key);
      const seer = near(f.p, PATROL_UNSEEN).find((o) => inView(o, f.p.x, y, f.p.z) && clear(o, f.p.x, y, f.p.z));
      if (seer) {
        const d = Math.hypot(f.p.x - seer.x, f.p.z - seer.z);
        return [{ at: `patrol lane from ${lane.points[0]!.x.toFixed(0)},${lane.points[0]!.z.toFixed(0)} at ${f.p.x.toFixed(0)},${f.p.z.toFixed(0)} y ${y.toFixed(1)}`, what: `comes or goes in view of ${seer.x.toFixed(0)},${seer.z.toFixed(0)}: ${d.toFixed(0)} m off, ${((Math.atan2(y - seer.eye, d) * 180) / Math.PI).toFixed(0)} deg up` }];
      }
    }
    return [];
  });
};
