/**
 * The boards on the pavement (`a-frame-sign`) by the venues' doors (ADR-0094 stage 2): a sandwich
 * board stands beside the door of the shop or the café it advertises, a step off the facade, in the
 * frontage zone (NACTO, "Sidewalk Zones"), square to the wall, so a walker coming along the pavement
 * reads one face and the one going the other way the other. Until now the plan's boards stepped along
 * a line of the old town, on both sides by turns, with no shop behind them.
 *
 * One board per venue's first board on the wall: beside its door, the side by a hash, out of the
 * door's clear zone (ADR-0094 stage 1), with a facade behind it, on open paving off the zebras and
 * the stops, a walkway away from the solids placed before. The plan's numbers per district are the
 * most a district gets; the venues in the order of a hash of their names. No randomness.
 */
import type { StreetPropKind } from "../../../packages/core/src/world/city-geo.ts";
import type { Pt } from "./geometry.ts";
import type { BoardSpan } from "./props-boards.ts";
import { type EntranceZones, boardDoor } from "./props-entrances.ts";
import { type Clearances, Nearby, districtAt, forecourt, walkwayClear } from "./props-food.ts";
import type { Placed } from "./props-gen.ts";
import { fnv, yawOf } from "./props-place.ts";
import type { Site } from "./props-site.ts";

/** Its point off the facade (m): a step out, in the frontage zone. */
export const AFRAME_WALL = 0.8;
/** How far along the wall from the door it stands, nearest first (m): just past the door's clear zone. */
const ALONG = [2.7, 3.2, 3.8, 4.5] as const;
/** The walkway kept from the solids placed before (m). */
const SOLID_WALKWAY = 0.8;

/** Each venue's first board, in the order of a hash of its text. */
const firstBoards = (boards: readonly BoardSpan[]): BoardSpan[] => {
  const seen = new Set<string>();
  return boards
    .filter((b) => {
      if (seen.has(b.text)) return false;
      seen.add(b.text);
      return true;
    })
    .sort((a, b) => fnv(a.text) - fnv(b.text) || a.text.localeCompare(b.text));
};

/** A board on the pavement beside a venue's door, or null. */
export const aFrameAt = (site: Site, clear: Clearances, zones: EntranceZones, board: BoardSpan, near: Nearby): Placed | null => {
  const len = Math.hypot(board.b.x - board.a.x, board.b.z - board.a.z) || 1;
  const dir = { x: (board.b.x - board.a.x) / len, z: (board.b.z - board.a.z) / len };
  const door = boardDoor(board);
  const kind: StreetPropKind = "a-frame-sign";
  const first = fnv(`${board.text}#a-frame`) & 1 ? 1 : -1;
  for (const u of ALONG.flatMap((t) => [first * t, -first * t])) {
    const at = (out: number): Pt => ({ x: door.x + dir.x * u + board.nx * out, z: door.z + dir.z * u + board.nz * out });
    if (site.surfaceAt(at(-0.3)) !== "building") continue;
    const p = at(AFRAME_WALL);
    if (districtAt(site, p) === null || !zones.clear(p, kind) || !forecourt(site, p) || !clear.clear(p)) continue;
    if (!walkwayClear([p], near, null, SOLID_WALKWAY, SOLID_WALKWAY)) continue;
    // Square to the wall: its faces along the pavement.
    return { prop: kind, p, yaw: yawOf(dir.x, dir.z), key: `a-frame:${board.text}` };
  }
  return null;
};

/** A board beside the door of every venue with room for one, up to each district's number (`caps`). */
export const venueAFrames = (site: Site, clear: Clearances, zones: EntranceZones, boards: readonly BoardSpan[], placed: readonly Placed[], caps: ReadonlyMap<string, number>): Placed[] => {
  const left = new Map(caps);
  const near = new Nearby(placed);
  const out: Placed[] = [];
  for (const board of firstBoards(boards)) {
    const d = districtAt(site, boardDoor(board));
    if (d === null || (left.get(d) ?? 0) <= 0) continue;
    const a = aFrameAt(site, clear, zones, board, near);
    if (!a) continue;
    out.push(a);
    near.add(a);
    left.set(d, left.get(d)! - 1);
  }
  return out;
};
