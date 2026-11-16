import type { NavEdge, NavNode } from "../builders";
import {
  AIRLOCK_N_DOOR,
  AIRLOCK_S_CORRIDOR,
  AIRLOCK_S_DOOR,
  BASEMENT_FLOOR,
  DOORS_N,
  DOORS_S,
  HALL_DOORS,
  MEZZANINE,
  MEZZANINE_DOORS,
  STAIR_A,
  STAIR_B,
  STAIR_N,
  STAIR_N_DOOR,
  STAIR_N_LANDING,
} from "./layout";
import { w3 } from "./site";

/**
 * W-3's level graph inside the hall (ADR-0082 stage 2, ADR-0021): the airlocks from the west yard,
 * the assembly hall's aisle and its strips by the long walls, the test chamber, corridors S and N
 * with a node at each door and one in each room behind it, the stair up from airlock N to the
 * mezzanine's gallery and its rooms, the basement down stair A from the parts line and up stair B into
 * workshop W2. The roof hatch, the crane's track, the goods lift's shaft and the culvert are the
 * player's (a ladder, a crawl). Armoury N is shut for good in v1 and has no node.
 */

const node = (id: string, at: NavNode["at"]): NavNode => ({ id, at });
const F = BASEMENT_FLOOR;
const M = MEZZANINE;
const [hallW, hallE] = HALL_DOORS as [number, number];
/** Corridors S and N run along these z. */
const CS = 405;
const CN = 431;

export const W3_HALL_NODES: readonly NavNode[] = [
  // The airlocks, from the west yard.
  node("w3-als-out", w3(2497.5, 0, AIRLOCK_S_DOOR)),
  node("w3-als", w3(2505, 0, AIRLOCK_S_DOOR)),
  node("w3-wagon", w3(2505, 0, 418)),
  node("w3-aln-out", w3(2497.5, 0, AIRLOCK_N_DOOR)),
  node("w3-aln", w3(2505, 0, AIRLOCK_N_DOOR)),
  // The assembly hall: its aisle, the strips by the long walls at the corridors' doors, the chamber.
  node("w3-aisle-w", w3(2511.6, 0, 418)),
  node("w3-aisle-mid", w3(2529, 0, 418)),
  node("w3-aisle-e", w3(2546.6, 0, 418)),
  node("w3-hall-sw", w3(hallW, 0, AIRLOCK_S_DOOR)),
  node("w3-hall-se", w3(hallE, 0, 408.6)),
  node("w3-hall-nw", w3(2511.6, 0, AIRLOCK_N_DOOR)),
  node("w3-hall-n", w3(hallW, 0, STAIR_N_DOOR.z)),
  node("w3-hall-ne", w3(hallE, 0, 428.4)),
  node("w3-chamber", w3(2554, 0, 418)),
  // Corridor S, a node at each door; the rooms behind them.
  ...[DOORS_S.store, AIRLOCK_S_CORRIDOR, hallW, DOORS_S.line, DOORS_S.w1, DOORS_S.w2, hallE, DOORS_S.armoury, DOORS_S.server].map((x) => node(`w3-cs-${x}`, w3(x, 0, CS))),
  node("w3-store-s", w3(DOORS_S.store, 0, 403)),
  node("w3-store-s-mid", w3(2505, 0, 401)),
  node("w3-store-s-in", w3(2510, 0, 399.6)),
  node("w3-parts-line-door", w3(DOORS_S.line, 0, 403)),
  node("w3-parts-line-e", w3(2526.6, 0, 401.3)),
  node("w3-parts-line", w3(2522, 0, 400)),
  node("w3-stair-a-top", w3(STAIR_A.maxX + 0.6, 0, (STAIR_A.minZ + STAIR_A.maxZ) / 2)),
  node("w3-workshop-1", w3(DOORS_S.w1, 0, 400)),
  node("w3-workshop-2", w3(DOORS_S.w2, 0, 401)),
  node("w3-workshop-2-s", w3(2542.2, 0, 397)),
  node("w3-stair-b-top", w3((STAIR_B.minX + STAIR_B.maxX) / 2, 0, STAIR_B.minZ - 0.6)),
  node("w3-armoury-s", w3(DOORS_S.armoury, 0, 400)),
  node("w3-server-s", w3(DOORS_S.server, 0, 402.9)),
  // Corridor N and the rooms off it.
  ...[DOORS_N.n1, hallW, DOORS_N.n2, DOORS_N.modules, DOORS_N.calibration, hallE, DOORS_N.server].map((x) => node(`w3-cn-${x}`, w3(x, 0, CN))),
  node("w3-store-n1", w3(DOORS_N.n1, 0, 436)),
  node("w3-store-n2", w3(DOORS_N.n2, 0, 436)),
  node("w3-modules", w3(DOORS_N.modules, 0, 435.5)),
  node("w3-calibration", w3(DOORS_N.calibration, 0, 436)),
  node("w3-server-n", w3(DOORS_N.server, 0, 434.6)),
  // The stair from airlock N, the landing, the gallery, the mezzanine's rooms.
  node("w3-stair-n-top", w3(STAIR_N_LANDING.minX + 1, M, 429.2)),
  node("w3-mez-w", w3(2502, M, 433)),
  ...MEZZANINE_DOORS.map((x) => node(`w3-mez-${x}`, w3(x, M, 433))),
  node("w3-mez-e", w3(2558, M, 433)),
  node("w3-mez-lockers", w3(MEZZANINE_DOORS[0] as number, M, 438)),
  node("w3-mez-office", w3(MEZZANINE_DOORS[1] as number, M, 436.9)),
  node("w3-mez-tech", w3(MEZZANINE_DOORS[2] as number, M, 438)),
  // The basement: the feet of stairs A and B, its middle, the locker room.
  node("w3-cellar-a", w3(STAIR_A.minX - 1, F, (STAIR_A.minZ + STAIR_A.maxZ) / 2)),
  node("w3-cellar-w", w3(STAIR_A.minX - 1, F, 405.5)),
  node("w3-cellar-mid", w3(2530, F, 405.5)),
  node("w3-cellar-b", w3((STAIR_B.minX + STAIR_B.maxX) / 2, F, STAIR_B.maxZ + 1)),
  node("w3-cellar-s", w3(2520, F, 398.4)),
];

const e = (a: string, b: string, via?: NavEdge["via"]): NavEdge => (via ? { a, b, via } : { a, b });
const chain = (ids: readonly string[]): NavEdge[] => ids.slice(1).map((id, i) => e(ids[i] as string, id));

export const W3_HALL_EDGES: readonly NavEdge[] = [
  // In from the west yard (`w3-gate-w`, `w3-west` of stage 1).
  e("w3-gate-w", "w3-als-out"),
  e("w3-als-out", "w3-als"),
  e("w3-west", "w3-aln-out"),
  e("w3-aln-out", "w3-aln"),
  e("w3-als", "w3-hall-sw"),
  e("w3-als", `w3-cs-${AIRLOCK_S_CORRIDOR}`),
  e("w3-wagon", "w3-aisle-w"),
  e("w3-aln", "w3-hall-nw"),
  // The hall.
  ...chain(["w3-hall-sw", "w3-aisle-w", "w3-aisle-mid", "w3-aisle-e", "w3-hall-se"]),
  ...chain(["w3-aisle-w", "w3-hall-nw", "w3-hall-n"]),
  e("w3-aisle-e", "w3-hall-ne"),
  e("w3-aisle-e", "w3-chamber"),
  e("w3-hall-sw", `w3-cs-${hallW}`),
  e("w3-hall-se", `w3-cs-${hallE}`),
  e("w3-hall-n", `w3-cn-${hallW}`),
  e("w3-hall-ne", `w3-cn-${hallE}`),
  // Corridor S and its rooms.
  ...chain([DOORS_S.store, AIRLOCK_S_CORRIDOR, hallW, DOORS_S.line, DOORS_S.w1, DOORS_S.w2, hallE, DOORS_S.armoury, DOORS_S.server].map((x) => `w3-cs-${x}`)),
  e(`w3-cs-${DOORS_S.store}`, "w3-store-s"),
  ...chain(["w3-store-s", "w3-store-s-mid", "w3-store-s-in"]),
  e(`w3-cs-${DOORS_S.line}`, "w3-parts-line-door"),
  ...chain(["w3-parts-line-door", "w3-parts-line-e", "w3-parts-line"]),
  e("w3-parts-line-door", "w3-stair-a-top"),
  e(`w3-cs-${DOORS_S.w1}`, "w3-workshop-1"),
  e(`w3-cs-${DOORS_S.w2}`, "w3-workshop-2"),
  e("w3-workshop-2", "w3-workshop-2-s"),
  e(`w3-cs-${DOORS_S.armoury}`, "w3-armoury-s"),
  e(`w3-cs-${DOORS_S.server}`, "w3-server-s"),
  // Corridor N and its rooms.
  ...chain([DOORS_N.n1, hallW, DOORS_N.n2, DOORS_N.modules, DOORS_N.calibration, hallE, DOORS_N.server].map((x) => `w3-cn-${x}`)),
  e(`w3-cn-${DOORS_N.n1}`, "w3-store-n1"),
  e(`w3-cn-${DOORS_N.n2}`, "w3-store-n2"),
  e(`w3-cn-${DOORS_N.modules}`, "w3-modules"),
  e(`w3-cn-${DOORS_N.calibration}`, "w3-calibration"),
  e(`w3-cn-${DOORS_N.server}`, "w3-server-n"),
  // Up the stair through its door in the hall's wall, along the gallery, into the rooms.
  e("w3-hall-n", "w3-stair-n-top", { minX: STAIR_N_LANDING.minX, maxX: hallW + 0.6, minZ: STAIR_N.minZ, maxZ: STAIR_N.maxZ }),
  e("w3-stair-n-top", "w3-mez-w"),
  ...chain(["w3-mez-w", ...MEZZANINE_DOORS.map((x) => `w3-mez-${x}`), "w3-mez-e"]),
  e(`w3-mez-${MEZZANINE_DOORS[0]}`, "w3-mez-lockers"),
  e(`w3-mez-${MEZZANINE_DOORS[1]}`, "w3-mez-office"),
  e(`w3-mez-${MEZZANINE_DOORS[2]}`, "w3-mez-tech"),
  // Down into the basement and up out of it.
  e("w3-stair-a-top", "w3-cellar-a", { minX: STAIR_A.minX - 1.2, maxX: STAIR_A.maxX + 0.8, minZ: STAIR_A.minZ, maxZ: STAIR_A.maxZ }),
  ...chain(["w3-cellar-a", "w3-cellar-w", "w3-cellar-mid", "w3-cellar-b"]),
  e("w3-cellar-a", "w3-cellar-s"),
  e("w3-cellar-b", "w3-stair-b-top", { minX: STAIR_B.minX, maxX: STAIR_B.maxX, minZ: STAIR_B.minZ - 0.8, maxZ: STAIR_B.maxZ + 1.2 }),
  e("w3-stair-b-top", "w3-workshop-2-s"),
];
