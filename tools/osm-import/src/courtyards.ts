/**
 * Courtyards (G-798 review, Dziedziniec Zamkowy): a pedestrian square mapped as an area (`highway=
 * pedestrian` + `area=yes`) whose outline runs along buildings for the most part. Such a court is lit
 * from its facades (lanterns on the walls, lights in the paving), not by lamps on posts: the `lit`
 * rule hangs wall lanterns round it and lamps none of the ways crossing it, and the glitch scan's
 * `lamp-freestanding-in-courtyard` finds a lamp on a post inside one.
 */
import { segmentDistance } from "../../../packages/core/src/math/geometry2d.ts";
import { type Pt, pointInRing } from "./geometry.ts";
import type { Tags } from "./osm.ts";

/** How near a building an outline's point lies to run along it (m). */
export const COURTYARD_WALL = 3;
/**
 * The share of an outline's points along buildings for a square to be a courtyard: Dziedziniec
 * Zamkowy runs along the game's buildings for 96% of its outline, closed but for its gates; Plac
 * Łokietka, an open square with streets running into it and its lamps on posts in the plan and in
 * Lublin, for 76%. The review's 70% took it in.
 */
export const COURTYARD_SHARE = 0.9;
/** The step the outline is sampled in (m). */
const STEP = 1;
const CELL = 20;

/** Whether tags are a pedestrian square mapped as an area. */
export const isPedestrianSquare = (tags: Tags | undefined): boolean => tags?.highway === "pedestrian" && tags.area === "yes";

/** Building outlines on a grid, asked whether a point lies within `r` of one's edge. */
export class WallIndex {
  private readonly cells = new Map<string, [Pt, Pt][]>();

  constructor(rings: readonly (readonly Pt[])[]) {
    for (const r of rings)
      for (let i = 0; i < r.length; i++) {
        const [a, b] = [r[i]!, r[(i + 1) % r.length]!];
        for (let x = Math.floor(Math.min(a.x, b.x) / CELL); x <= Math.floor(Math.max(a.x, b.x) / CELL); x++)
          for (let z = Math.floor(Math.min(a.z, b.z) / CELL); z <= Math.floor(Math.max(a.z, b.z) / CELL); z++) {
            const k = `${x},${z}`;
            const list = this.cells.get(k);
            if (list) list.push([a, b]);
            else this.cells.set(k, [[a, b]]);
          }
      }
  }

  near(p: Pt, r: number): boolean {
    for (let x = Math.floor((p.x - r) / CELL); x <= Math.floor((p.x + r) / CELL); x++)
      for (let z = Math.floor((p.z - r) / CELL); z <= Math.floor((p.z + r) / CELL); z++)
        for (const [a, b] of this.cells.get(`${x},${z}`) ?? []) if (segmentDistance(p.x, p.z, a.x, a.z, b.x, b.z) <= r) return true;
    return false;
  }
}

/** The points of a closed ring every `STEP` metres or less. */
const ringPoints = (ring: readonly Pt[]): Pt[] =>
  ring.flatMap((a, i) => {
    const b = ring[(i + 1) % ring.length]!;
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / STEP));
    return Array.from({ length: n }, (_, k) => ({ x: a.x + ((b.x - a.x) * k) / n, z: a.z + ((b.z - a.z) * k) / n }));
  });

/** The share of a ring's outline within `COURTYARD_WALL` of a building. */
export const alongWalls = (ring: readonly Pt[], walls: WallIndex): number => {
  const pts = ringPoints(ring);
  return pts.length === 0 ? 0 : pts.filter((p) => walls.near(p, COURTYARD_WALL)).length / pts.length;
};

/** Whether a square's outline is a courtyard's: `COURTYARD_SHARE` of it along buildings. */
export const isCourtyard = (ring: readonly Pt[], walls: WallIndex): boolean => ring.length >= 3 && alongWalls(ring, walls) >= COURTYARD_SHARE;

/** Whether most of a line (half its points or more) lies inside a ring. */
export const mostlyInside = (line: readonly Pt[], ring: readonly Pt[]): boolean => line.length > 0 && line.filter((p) => pointInRing(p, ring)).length * 2 >= line.length;
