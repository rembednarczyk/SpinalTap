/**
 * The cafés' gardens by their venues (ADR-0094 stage 2): a garden belongs to the restaurant, café,
 * ice-cream parlour, bar or pub that runs it, as the old towns' rules have it (Kraków, Wrocław) and
 * as the frontage zone of street design guides puts it (NACTO, "Sidewalk Zones": doors, entryways
 * and sidewalk cafés along the facade). Until now the plan's gardens were scattered over the Rynek
 * and stepped along the deptak's line with no venue behind them, round the Trybunał's walls too.
 *
 * Each such venue's first board (`BoardSpan`, a corner venue has one on each street) gets one garden:
 * its back against the facade, a step off it, its fence towards the street; slid along the wall from
 * the board's door both ways (its door's clear zone stays free, ADR-0094 stage 1), with its building
 * or the next one's facade behind its whole width; on open paving, off the zebras, the stops and the
 * car lanes, the solids placed before a walkway away, and with the pedestrians' through zone (1.8 m)
 * kept between its fence and the kerb. The plan's numbers of gardens per district (its areas and
 * lines, not its points of the map) are the most a district gets; venues take them in the order of a
 * hash of their names. No randomness.
 */
import type { StreetPropKind } from "../../../packages/core/src/world/city-geo.ts";
import type { LublinChunkData } from "../../../packages/sim/src/content/lublin/types.ts";
import { type Pt, ringBounds } from "./geometry.ts";
import type { BoardSpan } from "./props-boards.ts";
import { type EntranceZones, boardDoor } from "./props-entrances.ts";
import { type Clearances, Nearby, districtAt, forecourt, open, rect, streetsNear, walkwayClear } from "./props-food.ts";
import type { Placed } from "./props-gen.ts";
import { fnv, yawOf } from "./props-place.ts";
import type { Site } from "./props-site.ts";
import { nearTraffic } from "./props-streets.ts";

/** The venues that run a garden (`VenueKind`): fast food gets its booth instead (`props-food.ts`). */
export const GARDEN_VENUES: ReadonlySet<string> = new Set(["restaurant", "cafe", "ice-cream", "bar", "pub"]);

/** The garden's deck in its frame (`cafeGarden` in the renderer: 4.2 x 3 m, its fence at the front). */
const GARDEN = { hx: 2.1, back: -1.5, front: 1.5 } as const;
/** Its centre off the facade (m): the deck's back a hand off the wall. */
export const GARDEN_WALL = 1.8;
/** The pedestrians' through zone kept between its fence and the kerb (m, NACTO: 5-7 ft and more). */
export const THROUGH_ZONE = 1.8;
/** How far it slides along the wall from the board's door, in steps (m). */
const SLIDE = { step: 0.5, reach: 9 } as const;
/** How far from a car street's axis its deck keeps (m), as the booths. */
const TRAFFIC_REACH = 4.5;
/** The walkway kept from the solids placed before (m). */
const SOLID_WALKWAY = 1;

/** The boards of the venues that run a garden: each venue's first board. */
export const gardenBoards = (chunks: readonly LublinChunkData[], boards: readonly BoardSpan[]): BoardSpan[] => {
  const names = new Set(chunks.flatMap((c) => c.buildings.flatMap((b) => (b.venues ?? []).filter((v) => GARDEN_VENUES.has(v.kind)).map((v) => v.name))));
  const seen = new Set<string>();
  return boards
    .filter((b) => {
      if (!names.has(b.text) || seen.has(b.text)) return false;
      seen.add(b.text);
      return true;
    })
    .sort((a, b) => fnv(a.text) - fnv(b.text) || a.text.localeCompare(b.text));
};

/** A garden for one venue's board, or null: slid along its wall from the board's door, nearest first, the side by a hash. */
export const gardenAt = (site: Site, clear: Clearances, zones: EntranceZones, board: BoardSpan, near: Nearby): Placed | null => {
  const len = Math.hypot(board.b.x - board.a.x, board.b.z - board.a.z) || 1;
  const dir = { x: (board.b.x - board.a.x) / len, z: (board.b.z - board.a.z) / len };
  const door = boardDoor(board);
  const yaw = yawOf(board.nx, board.nz);
  const first = fnv(`${board.text}#garden`) & 1 ? 1 : -1;
  const shifts: number[] = [];
  for (let t = 0; t <= SLIDE.reach; t += SLIDE.step) shifts.push(first * t, -first * t);
  const traffic = streetsNear(site, ringBounds([board.a, board.b]), SLIDE.reach + TRAFFIC_REACH + 5);
  const kind: StreetPropKind = "cafe-garden";
  for (const u of shifts) {
    const along = (x: number, out: number): Pt => ({ x: door.x + dir.x * (u + x) + board.nx * out, z: door.z + dir.z * (u + x) + board.nz * out });
    // A facade behind its whole width: this building's wall or the next one's in the row.
    if (![-GARDEN.hx, 0, GARDEN.hx].every((x) => site.surfaceAt(along(x, -0.3)) === "building")) continue;
    const p = along(0, GARDEN_WALL);
    if (districtAt(site, p) === null || !zones.clear(p, kind)) continue;
    const foot = rect(p, yaw, -GARDEN.hx, GARDEN.hx, GARDEN.back, GARDEN.front);
    if (!foot.every((q) => forecourt(site, q) && clear.clear(q) && !nearTraffic(traffic, q, TRAFFIC_REACH))) continue;
    // The through zone in front of its fence: open ground, and that much to the carriageway's edge.
    const ahead = rect(p, yaw, -GARDEN.hx, GARDEN.hx, GARDEN.front, GARDEN.front + THROUGH_ZONE);
    if (!ahead.every((q) => open(site, q))) continue;
    if (!rect(p, yaw, -GARDEN.hx, GARDEN.hx, GARDEN.front, GARDEN.front).every((q) => clear.kerbGap(q) >= THROUGH_ZONE)) continue;
    if (!walkwayClear(foot, near, null, SOLID_WALKWAY, SOLID_WALKWAY) || !walkwayClear(ahead, near, null, 0.2, 0.2)) continue;
    return { prop: kind, p, yaw, key: `cafe-garden:${board.text}` };
  }
  return null;
};

/**
 * A garden by every venue that runs one and has room, up to each district's number (`caps`, from
 * the plan); the venues in the order of their names' hash.
 */
export const venueGardens = (site: Site, clear: Clearances, zones: EntranceZones, boards: readonly BoardSpan[], placed: readonly Placed[], caps: ReadonlyMap<string, number>): Placed[] => {
  const left = new Map(caps);
  const near = new Nearby(placed);
  const out: Placed[] = [];
  for (const board of gardenBoards(site.chunks, boards)) {
    const d = districtAt(site, boardDoor(board));
    if (d === null || (left.get(d) ?? 0) <= 0) continue;
    const g = gardenAt(site, clear, zones, board, near);
    if (!g) continue;
    out.push(g);
    near.add(g);
    left.set(d, left.get(d)! - 1);
  }
  return out;
};
