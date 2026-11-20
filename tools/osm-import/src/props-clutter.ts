/**
 * The odds and ends of ADR-0096 (`clutter`, the models of `extra-props.glb`), by rules on the map's
 * venues, as ADR-0094 puts the gardens and boards (anchors and clear zones; CityEngine's rules per
 * element; no randomness: venues in the order of a hash of their names, the pieces' mix and turn from
 * that hash):
 * - **The back of a restaurant** (rule 1): a kitchen's refuse waits behind the house, not on a
 *   street (4 m from any street's axis, the pedestrians' lanes too). From the venue's door straight through its building (and the row behind it, up to 40 m)
 *   to the first open ground beyond: there, against that wall, two to four pieces side by side (bin
 *   bags, boxes, a boarded bin or a barrel, now and then a bottle or a cup), each on open paving off
 *   the paths, the car lanes, the doors' clear zones and the solids placed before.
 * - **A bank's cash machine** (rule 3): set into the bank's wall beside its door, outside the door's
 *   clear zone, the wall behind it; one per bank, the side by the hash.
 */
import type { StreetPropKind } from "../../../packages/core/src/world/city-geo.ts";
import { CLUTTER } from "../../../packages/core/src/world/clutter.ts";
import type { LublinChunkData } from "../../../packages/sim/src/content/lublin/types.ts";
import type { Pt } from "./geometry.ts";
import type { BoardSpan } from "./props-boards.ts";
import { type EntranceZones, boardDoor } from "./props-entrances.ts";
import { type Clearances, open } from "./props-food.ts";
import type { Placed } from "./props-gen.ts";
import { fnv, yawOf } from "./props-place.ts";
import type { Site } from "./props-site.ts";
import { nearStreet, nearTraffic } from "./props-streets.ts";

/** The venues with a kitchen whose refuse goes out the back (`VenueKind`). */
export const KITCHEN_VENUES: ReadonlySet<string> = new Set(["restaurant", "cafe", "fast-food", "bar", "pub"]);
const KIND: StreetPropKind = "clutter";
/** How far through the building and its row the back is looked for (m), and the step. */
const THROUGH = { reach: 40, step: 0.25 } as const;
/** The pieces' centres off the back wall (m) and their spacing along it. */
const OFF_WALL = 0.5;
const SPACING = 0.8;
/** How far the pieces keep from a car street's axis (m): a yard, not a kerb. */
const TRAFFIC_REACH = 4;
/**
 * And from any street's axis, the pedestrians' lanes and living streets too (m): the way through a
 * building of the Old Town often comes out on the next lane (Jezuicka, Przechodnia, Szambelańska),
 * which is a street, not a back yard.
 */
const STREET_REACH = 4;
/** A piece's footprint, sampled: its centre and 0.3 m round it, so no corner of a wall cuts into it. */
const FOOT: readonly (readonly [number, number])[] = [[0, 0], [0.3, 0], [-0.3, 0], [0, 0.3], [0, -0.3]];
/** A cash machine's face off the wall (m): its body is set into it, the screen proud. */
const ATM_OUT = 0.12;
/** Its centre past the board's end (m), clear of the door's zone. */
const ATM_PAST = 0.9;

/** Each venue's first board whose venue is of `kinds`, in the order of its name's hash. */
export const venueBoards = (chunks: readonly LublinChunkData[], boards: readonly BoardSpan[], kinds: ReadonlySet<string>): BoardSpan[] => {
  const names = new Set(chunks.flatMap((c) => c.buildings.flatMap((b) => (b.venues ?? []).filter((v) => kinds.has(v.kind)).map((v) => v.name))));
  const seen = new Set<string>();
  return boards
    .filter((b) => {
      if (!names.has(b.text) || seen.has(b.text)) return false;
      seen.add(b.text);
      return true;
    })
    .sort((a, b) => fnv(a.text) - fnv(b.text) || a.text.localeCompare(b.text));
};

/** The first open point behind the venue's building, straight back from its door, or null. */
export const backOf = (site: Site, board: BoardSpan): Pt | null => {
  const door = boardDoor(board);
  let inside = false;
  for (let t = 0.3; t <= THROUGH.reach; t += THROUGH.step) {
    const q = { x: door.x - board.nx * t, z: door.z - board.nz * t };
    if (site.surfaceAt(q) === "building") inside = true;
    else if (inside) return q;
  }
  return null;
};

/** The mix behind one venue: shapes from its hash, two to four. */
export const backMix = (text: string): number[] => {
  const h = fnv(`${text}#back`);
  const mix: number[] = [CLUTTER.bags[h & 1]!];
  if (h & 2) mix.push(CLUTTER.bags[(h >> 2) & 1]!);
  mix.push((h >> 3) & 3 ? CLUTTER.boxes[(h >> 5) & 1]! : (h >> 6) & 1 ? CLUTTER.bin : CLUTTER.barrel);
  if ((h >> 7) & 1) mix.push(CLUTTER.litter[(h >> 8) & 1]!);
  return mix;
};

/** A spot a piece may stand on: open paving off the paths and car lanes, clear of doors and solids. */
const free = (site: Site, clear: Clearances, zones: EntranceZones, q: Pt): boolean =>
  FOOT.every(([dx, dz]) => open(site, { x: q.x + dx, z: q.z + dz })) && !site.onPath(q) && clear.clear(q) && zones.clear(q, KIND) && !nearTraffic(site, q, TRAFFIC_REACH) && !nearStreet(site.streets, q, STREET_REACH);

/** The pieces behind one venue, against its back wall, or none. */
export const backClutter = (site: Site, clear: Clearances, zones: EntranceZones, board: BoardSpan): Placed[] => {
  const back = backOf(site, board);
  if (!back) return [];
  // The wall's line: across the way back; the pieces face away from the wall.
  const along = { x: -board.nz, z: board.nx };
  const yaw = yawOf(-board.nx, -board.nz);
  const at = { x: back.x - board.nx * OFF_WALL, z: back.z - board.nz * OFF_WALL };
  const mix = backMix(board.text);
  const h = fnv(`${board.text}#turn`);
  const out: Placed[] = [];
  mix.forEach((shape, i) => {
    const u = (i - (mix.length - 1) / 2) * SPACING;
    const p = { x: at.x + along.x * u, z: at.z + along.z * u };
    if (!free(site, clear, zones, p)) return;
    // Bags and boxes dropped, not set square: a turn of up to ±0.6 rad from the hash.
    const turn = (((h >> (i * 3)) & 7) - 3.5) * 0.17;
    out.push({ prop: KIND, p, yaw: yaw + turn, key: `clutter:back:${board.text}:${i}`, shape });
  });
  return out;
};

/** The cash machine in a bank's wall beside its door, or null: the side by the hash, then the other. */
export const bankAtm = (site: Site, zones: EntranceZones, board: BoardSpan): Placed | null => {
  const door = boardDoor(board);
  const len = Math.hypot(board.b.x - board.a.x, board.b.z - board.a.z) || 1;
  const dir = { x: (board.b.x - board.a.x) / len, z: (board.b.z - board.a.z) / len };
  const first = fnv(`${board.text}#atm`) & 1 ? 1 : -1;
  for (const side of [first, -first]) {
    const u = side * (len / 2 + ATM_PAST);
    const p = { x: door.x + dir.x * u + board.nx * ATM_OUT, z: door.z + dir.z * u + board.nz * ATM_OUT };
    const wall = { x: p.x - board.nx * 0.4, z: p.z - board.nz * 0.4 };
    const front = { x: p.x + board.nx * 0.6, z: p.z + board.nz * 0.6 };
    if (site.surfaceAt(wall) !== "building" || !open(site, front) || !zones.clear(front, KIND)) continue;
    return { prop: KIND, p, yaw: yawOf(board.nx, board.nz), key: `clutter:atm:${board.text}`, shape: CLUTTER.atmWall };
  }
  return null;
};

/** Every rule of ADR-0096 stage 2 in its order: the restaurants' backs, then the banks' machines. */
export const venueClutter = (site: Site, clear: Clearances, zones: EntranceZones, boards: readonly BoardSpan[]): Placed[] => {
  const out: Placed[] = [];
  for (const board of venueBoards(site.chunks, boards, KITCHEN_VENUES)) out.push(...backClutter(site, clear, zones, board));
  for (const board of venueBoards(site.chunks, boards, new Set(["bank"]))) {
    const atm = bankAtm(site, zones, board);
    if (atm) out.push(atm);
  }
  return out;
};
