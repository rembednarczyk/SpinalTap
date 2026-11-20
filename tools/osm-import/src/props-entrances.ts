/**
 * The clear zones before the entrances (ADR-0094 stage 1): what people walk round keeps off the
 * ground in front of a door. A door is an entrance of the map (`entrance=*`, `door=*` in
 * `data/osm/points/entrances.json`) or the door under a venue's board (a shop's door is where its
 * sign is, as `props-doors.ts` places them). The zone is a disc of `ENTRANCE_ROOM` round the door's
 * point on the wall: the door's width and a step to either side, two metres out. A piece keeps its
 * own reach off it too.
 *
 * Pattern: clearance areas in constraint-based layout (Yu et al., "Make It Home", SIGGRAPH 2011:
 * a piece's access area no other piece may overlap), with the sidewalk's frontage zone of street
 * design guides (NACTO, "Sidewalk Zones": doors and entryways there). Ours tests a point against
 * discs in a spatial hash, in the plan's fixed order: no search, no randomness.
 */
import type { StreetPropKind } from "../../../packages/core/src/world/city-geo.ts";
import { SpatialHash } from "../../../packages/core/src/math/spatial-hash.ts";
import type { Pt } from "./geometry.ts";
import type { BoardSpan } from "./props-boards.ts";

/** How far in front of a door's point the ground stays clear (m). */
export const ENTRANCE_ROOM = 2.2;

/**
 * The pieces that keep off the entrances, and their reach from their point (m): what stands on the
 * pavement where people walk, not lamps at the kerb, posts in rows or covers in the road. A piece
 * the plan pins to a point of the map (a monument, a kiosk by its outline) stays where the map has it.
 */
export const KEEPS_OFF_ENTRANCES: Readonly<Partial<Record<StreetPropKind, number>>> = {
  "cafe-garden": 2.2,
  "a-frame-sign": 0.4,
  bench: 0.9,
  "waste-bin": 0.3,
  planter: 0.6,
  "bike-rack": 0.8,
  "bike-station": 1,
  "advertising-column": 0.6,
  "vending-machine": 0.5,
  "ticket-machine": 0.4,
  atm: 0.4,
  "market-stall": 1.6,
  "food-cart": 1.5,
  "fountain-jets": 0.5,
};

/** The door under a venue's board: the middle of the board, on its wall. */
export const boardDoor = (b: BoardSpan): Pt => ({ x: (b.a.x + b.b.x) / 2, z: (b.a.z + b.b.z) / 2 });

/** The doors' clear zones of a district, and the test of a piece against them. */
export class EntranceZones {
  private readonly doors = new SpatialHash<Pt>(8);
  private readonly points: readonly Pt[];
  readonly size: number;

  constructor(doors: readonly Pt[]) {
    for (const d of doors) this.doors.insertPoint(d, d.x, d.z);
    this.points = doors;
    this.size = doors.length;
  }

  /** These zones and more: a monument's viewing ground before its front is kept clear the same way (ADR-0094 stage 4). */
  with(more: readonly Pt[]): EntranceZones {
    return new EntranceZones([...this.points, ...more]);
  }

  /** Is a piece of `prop` at `p` off every door's zone (a piece that does not keep off them always is)? */
  clear(p: Pt, prop: StreetPropKind): boolean {
    const reach = KEEPS_OFF_ENTRANCES[prop];
    if (reach === undefined) return true;
    const r = ENTRANCE_ROOM + reach;
    return !this.doors.some(p.x - r, p.z - r, p.x + r, p.z + r, (d) => Math.hypot(d.x - p.x, d.z - p.z) < r);
  }
}
