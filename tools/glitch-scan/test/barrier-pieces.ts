import { BARRIER_THICKNESS, type StreetPropItem, barrierLayout, doorLayout } from "../../../packages/core/src";
import { barrierPrism } from "../../../packages/sim/src/content/lublin/barriers";

/**
 * The map's walls, fences and hedges of ADR-0077 checked against what the game draws and runs:
 * the doors on the facades and of the game's rooms, the carriageways and zebras, the steps drawn,
 * the buildings' solids and the crowd's lanes. A barrier is a solid of the game, so where it
 * stands in a doorway, on a road, on steps or across a walker's way, the player walks into it.
 */

type Pt = { readonly x: number; readonly z: number };
type Finding = { readonly at: string; readonly what: string };

/** A door of the game: its middle on the wall, the unit direction out of it, its width. */
export interface ScanDoor extends Pt {
  readonly ox: number;
  readonly oz: number;
  readonly width: number;
}

/** The game the barriers are checked against. */
export interface BarrierWorld {
  readonly doors: readonly ScanDoor[];
  /** A zebra drawn at (x, z). */
  readonly onCrossing: (x: number, z: number) => boolean;
  /** The cars' lanes as lines (a car 1 m either side of its line, delivery vans included). */
  readonly carLanes: readonly (readonly Pt[])[];
  /** Steps drawn at (x, z). */
  readonly onSteps: (x: number, z: number) => boolean;
  /** How deep (x, z) lies inside a building's solid, 0 outside. */
  readonly inBuilding: (x: number, z: number) => number;
  /** The crowd's lanes as closed lines (walkers keep 0.28 m to a side, a body 0.3 m round). */
  readonly crowdLanes: readonly (readonly Pt[])[];
  /** Inside a piece of furniture at (x, z): a solid one's footprint, a café's garden, a planter, shrubs. */
  readonly inFurniture: (x: number, z: number) => boolean;
  /** The residents' places: seats, wall spots, activities. */
  readonly spots: readonly Pt[];
}

/** A door's way out stays clear this far (m); a walker reaches this far off its lane, a car's side this far off its line. */
const DOOR_OUT = 1.2;
const WALKER = 0.58;
/** A route along a barrier may pass it this close (its walkers brush past, G-606); a resident keeps this round its place. */
const ALONG = 0.2;
const SEAT = 0.5;
const CAR = 1.2;
/** A barrier may run this far into a building's wall, where it meets it (m). */
const INTO_WALL = 0.5;

const near = (x: number, z: number): string => `${x.toFixed(0)},${z.toFixed(0)}`;

/** The solid pieces, each sampled every 0.25 m along its line and on both its faces. */
const samplesOf = (i: StreetPropItem): Pt[] => {
  const b = barrierLayout(i.variant);
  const n = Math.max(1, Math.ceil(b.length / 0.25));
  const half = BARRIER_THICKNESS[b.kind] / 2;
  const out: Pt[] = [];
  for (let k = 0; k <= n; k++) {
    const s = -b.length / 2 + (b.length * k) / n;
    for (const a of [-half, 0, half]) out.push({ x: i.x + Math.sin(i.yaw) * s + Math.cos(i.yaw) * a, z: i.z + Math.cos(i.yaw) * s - Math.sin(i.yaw) * a });
  }
  return out;
};

const segDistance = (p: Pt, a: Pt, b: Pt): number => {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t));
};

/** The sine of the angle between two directions. */
const sine = (u: Pt, v: Pt): number => (u.x * v.z - u.z * v.x) / (Math.hypot(u.x, u.z) * Math.hypot(v.x, v.z) || 1);

/** Lines' segments bucketed by 8 m: is a point within `r` (under 8 m) of one; with `across`, of one crossing it at 30 degrees and more? */
const segmentsNear = (lines: readonly (readonly Pt[])[], r: number): ((p: Pt, across?: Pt) => boolean) => {
  const cells = new Map<string, [Pt, Pt][]>();
  for (const l of lines) {
    for (let k = 1; k < l.length; k++) {
      const [a, b] = [l[k - 1]!, l[k]!];
      for (let i = Math.floor(Math.min(a.x, b.x) / 8); i <= Math.floor(Math.max(a.x, b.x) / 8); i++) {
        for (let j = Math.floor(Math.min(a.z, b.z) / 8); j <= Math.floor(Math.max(a.z, b.z) / 8); j++) cells.set(`${i}:${j}`, [...(cells.get(`${i}:${j}`) ?? []), [a, b]]);
      }
    }
  }
  return (p, across) => {
    const [ci, cj] = [Math.floor(p.x / 8), Math.floor(p.z / 8)];
    for (let i = ci - 1; i <= ci + 1; i++) {
      for (let j = cj - 1; j <= cj + 1; j++) {
        for (const [a, b] of cells.get(`${i}:${j}`) ?? []) {
          if (across && Math.abs(sine(across, { x: b.x - a.x, z: b.z - a.z })) < 0.5) continue;
          if (segDistance(p, a, b) < r) return true;
        }
      }
    }
    return false;
  };
};

/** The first sample of a piece where `bad` holds (given the piece's direction), as a finding. */
const findOn = (pieces: readonly StreetPropItem[], what: string, bad: (p: Pt, dir: Pt) => boolean): Finding[] =>
  pieces.flatMap((i) => {
    const dir = { x: Math.sin(i.yaw), z: Math.cos(i.yaw) };
    const hit = samplesOf(i).find((p) => bad(p, dir));
    return hit ? [{ at: near(hit.x, hit.z), what: `${barrierLayout(i.variant).kind} ${what}` }] : [];
  });

export const barrierChecks = (items: readonly StreetPropItem[], w: BarrierWorld): Record<string, () => Finding[]> => {
  const solid = items.filter((i) => barrierPrism(i) !== null);
  const byCar = segmentsNear(w.carLanes, CAR);
  const byWalker = segmentsNear(w.crowdLanes, WALKER);
  const onWalkerLine = segmentsNear(w.crowdLanes, ALONG);
  return {
    /** A wall, fence or hedge in a door's way out: within 1.2 m in front of it, as wide as the door. */
    "barrier-blocks-door": () =>
      findOn(solid, "before a door", (p) =>
        w.doors.some((d) => {
          const dx = p.x - d.x;
          const dz = p.z - d.z;
          if (Math.abs(dx) > 3 || Math.abs(dz) > 3) return false;
          const out = dx * d.ox + dz * d.oz;
          return out > 0.05 && out < DOOR_OUT && Math.abs(dx * d.oz - dz * d.ox) < d.width / 2;
        }),
      ),
    /** A barrier in a car's way (within 1.2 m of its lane's line) or on a zebra. */
    "barrier-on-road": () => findOn(solid, "on a road", (p) => byCar(p) || w.onCrossing(p.x, p.z)),
    /** A barrier on the steps drawn. */
    "barrier-on-steps": () => findOn(solid, "on steps", (p) => w.onSteps(p.x, p.z)),
    /** A barrier more than 0.5 m inside a building's solid. */
    "barrier-in-building": () => findOn(solid, "in a building", (p) => w.inBuilding(p.x, p.z) > INTO_WALL),
    /**
     * A barrier across a crowd's lane within a walker's reach of its line, or on the line itself
     * (G-606: a lane running along a barrier passes it; its walkers brush past).
     */
    "barrier-on-crowd-lane": () => findOn(solid, "on a crowd's lane", (p, dir) => byWalker(p, dir) || onWalkerLine(p)),
    /** A barrier through a piece of furniture: a solid one, a café's garden, a planter, shrubs (G-612). */
    "barrier-in-furniture": () => findOn(solid, "through furniture", (p) => w.inFurniture(p.x, p.z)),
    /** A barrier on a resident's place: a seat, a wall spot, an activity, within a body and a step before its face (G-612). */
    "barrier-on-seat": () => findOn(solid, "on a resident's place", (p) => w.spots.some((s) => Math.abs(s.x - p.x) < 1 && Math.abs(s.z - p.z) < 1 && Math.hypot(s.x - p.x, s.z - p.z) < SEAT)),
  };
};

/** A door on a facade (ADR-0058 stage 9) as the scan's door: out of it along its +z. */
export const facadeDoor = (i: StreetPropItem): ScanDoor => ({ x: i.x, z: i.z, ox: Math.sin(i.yaw), oz: Math.cos(i.yaw), width: doorLayout(i.variant).width });
