import type { Vec3 } from "@seki/core";
import { ground } from "../lublin/terrain";
import { opening } from "./foodhall";
import { FUMIKO_WINDOW_SPOT, beforeHatch } from "./fumiko-p0";
import { ESCALATORS, LANE_A, LANE_B, MALL_LEVELS, escalatorHead } from "./mall-plan";
import { HALL } from "./plan";
import { KEEPER_SPOTS, onP3 } from "./units";

/*
 * The food hall's keepers' ways about the building (ADR-0093 O3), for their daily plans
 * (`schedules.ts`): straight lines between these points, clear of the solids, each point on its floor.
 * Fumiko goes down from her bar on P3 to her second place on P0 after midnight, out of its door onto
 * T1 to her stool before its hatch at four, and back up to P3 at four in the afternoon: by the
 * escalators (criss-cross along the atrium's south edge, `mall-plan.ts`), P0's east and north
 * walkways and the way in from T1. Oyaji only steps back from his counter to sit behind his grille.
 */

const L = MALL_LEVELS;
const [E1, E2, E3] = ESCALATORS as readonly [(typeof ESCALATORS)[number], (typeof ESCALATORS)[number], (typeof ESCALATORS)[number]];
const za = (LANE_A.z0 + LANE_A.z1) / 2;
const zb = (LANE_B.z0 + LANE_B.z1) / 2;
const at = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

/** Where the walks turn between the flights: on P3's landing, past P2's (on the gallery's east side), on P1's. */
const P3_LANDING = 416.6;
const P2_TURN = 425.3;
const P1_TURN = 416.4;
/** Past the first flight's foot on P0, east of it. */
const P0_FOOT = 425.6;

/** Down the escalators from P3's gallery by the landing to P0 by the first flight's foot: each flight's ends on its floors. */
const ESCALATORS_DOWN: readonly Vec3[] = [
  at(P3_LANDING, L.p3, 39.2),
  at(P3_LANDING, L.p3, za),
  at(escalatorHead(E3), L.p3, za),
  at(E3.x0, L.p2, za),
  at(P2_TURN, L.p2, za),
  at(P2_TURN, L.p2, zb),
  at(escalatorHead(E2), L.p2, zb),
  at(E2.x0, L.p1, zb),
  at(P1_TURN, L.p1, zb),
  at(P1_TURN, L.p1, za),
  at(escalatorHead(E1), L.p1, za),
  at(E1.x0, L.p0, za),
  at(P0_FOOT, L.p0, za),
];

/** From the escalators' foot on P0 to the way in from T1: up the east walkway, west along the north one, out onto T1. */
const entrance = (opening("entrance").x0 + opening("entrance").x1) / 2 - 0.5;
const P0_TO_T1: readonly Vec3[] = [at(426.3, L.p0, 42.0), at(426.3, L.p0, 51.4), at(entrance, L.p0, 51.8), at(entrance, L.p0, HALL.maxZ - 1.4), ground(entrance, HALL.maxZ + 1.6)];

/** Along T1 to her own door and in: a step outside it, a step inside it. */
const door = (opening("fumiko-door").x0 + opening("fumiko-door").x1) / 2;
const OUTSIDE_DOOR = ground(door, HALL.maxZ + 1.6);
const INSIDE_DOOR = at(door, L.p0, HALL.maxZ - 1.4);

/** Out of her bar on P3 by the flap at its south end, round the west tables to the gallery's south side. */
const FUMIKO_BAR = KEEPER_SPOTS.fumiko;
const OUT_OF_BAR: readonly Vec3[] = [onP3(FUMIKO_BAR.x, 49.8), onP3(405.3, 49.8), onP3(408.8, 48.6), onP3(408.8, 39.2)];

/** Her stool before the hatch on T1, by day: the last one, east of the passers-by's. */
export const FUMIKO_STOOL: Vec3 = beforeHatch(1.2, 1.4);

/** After midnight, from her bar on P3 down to her second place on P0, its hatch onto T1. */
export const FUMIKO_DOWN: readonly Vec3[] = [FUMIKO_BAR, ...OUT_OF_BAR, ...ESCALATORS_DOWN, ...P0_TO_T1, OUTSIDE_DOOR, INSIDE_DOOR, FUMIKO_WINDOW_SPOT];

/** At four, out of her own door onto her stool. */
export const FUMIKO_OUT: readonly Vec3[] = [FUMIKO_WINDOW_SPOT, INSIDE_DOOR, OUTSIDE_DOOR, FUMIKO_STOOL];

/** At four in the afternoon, from her stool in through the way in and up the escalators to her bar. */
export const FUMIKO_UP: readonly Vec3[] = [FUMIKO_STOOL, OUTSIDE_DOOR, ...[...P0_TO_T1].reverse(), ...[...ESCALATORS_DOWN].reverse(), ...[...OUT_OF_BAR].reverse(), FUMIKO_BAR];

/** Oyaji's night: behind his grille at the counter's south end, sitting, the shop dark (in reach across the counter). */
export const OYAJI_NIGHT: Vec3 = onP3(429.7, 33.1);
