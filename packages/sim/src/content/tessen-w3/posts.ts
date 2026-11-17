import type { ContractSiteId, EnemyTypeId, Vec3 } from "@seki/core";
import { ground } from "../lublin/terrain";
import { W3_PLATFORM, W3_ROOF, w3 } from "./site";
import { W3_AIRLOCK_POST, W3_ARMOURY_POST, W3_PATROL_HALL, W3_PATROL_MANAGER, W3_PATROL_MEZZANINE, W3_VIRUS_TERMINAL } from "./mission";


/**
 * Where the riverside's jobs stand in W-3 (ADR-0082 stage 1): the infiltration in the tower's
 * pass office, the hack on the quay by the pier with its wave and a sniper on row N's roof,
 * the escort (retired from Genzō's offers, ADR-0082) along the riverside path.
 */

/**
 * A guard post of a riverside job: where a Tessen man stands, which way he looks, what he is. With
 * `onAlarm` he arrives only when the job's alarm goes up (the escort's ambush, the hack's wave).
 */
export interface ContractPost {
  readonly at: Vec3;
  readonly yaw: number;
  readonly type: EnemyTypeId;
  readonly onAlarm?: true;
  /** A patrol (ADR-0082 §3): it walks this loop by the clock in place of holding `at`, where it spawns. */
  readonly route?: readonly [Vec3, ...Vec3[]];
  /**
   * Does the guard see through disguises? Absent: the crew's rule (Tessen's first post is the
   * shift boss, ADR-0033). The hall's patrol P1 is the sabotage's first post, but the ADR's
   * enforcer there is the shift manager (ADR-0082 §1, G-907): P1 says `false`.
   */
  readonly enforcer?: boolean;
}

const post = (at: Vec3, yaw: number, type: EnemyTypeId = "tessen_guard", onAlarm = false): ContractPost => (onAlarm ? { at, yaw, type, onAlarm: true } : { at, yaw, type });

/** A patrol starting at its route's first point, facing along the first leg. */
const patrol = (route: readonly [Vec3, ...Vec3[]]): ContractPost => {
  const [a, b = a] = route;
  return { at: a, yaw: Math.atan2(b.x - a.x, b.z - a.z), type: "tessen_guard", route };
};

/**
 * Sniper perches (ADR-0024, ADR-0082): row N's roof at its west parapet over the quay and the
 * pier, the tower's platform at its south-west and north-east corners, row N's roof at its east
 * end over the east yard. Each stands at a railing 1.05 m high, so the shooter sees down over it.
 */
export const SNIPER_PERCHES: readonly Vec3[] = [w3(2500.7, W3_ROOF, 434), w3(2486.9, W3_PLATFORM, 436.9), w3(2495, W3_PLATFORM, 444.9), w3(2566, W3_ROOF, 439.2)];

/**
 * Posts of the riverside jobs, in target index order (the first one decides the chunk). The
 * infiltration: the office guard looks over the room, the door guard down the gap by the hall,
 * the others over the zone, the quay and the pickup yard. The hack: the wave, with a sniper on
 * row N's roof always among them. The escort: the ambush on the riverside path.
 */
export const W3_CONTRACT_POSTS: Readonly<Partial<Record<ContractSiteId, readonly ContractPost[]>>> = {
  docks_escort: [post(ground(2470, 393), 1.2, "tessen_guard", true), post(ground(2466.5, 399), 2.4, "tessen_guard", true), post(ground(2477, 381), 0, "tessen_guard", true), post(ground(2461, 408), Math.PI, "tessen_guard", true)],
  tessen_office: [
    post(w3(2488.6, 0, 438.4), Math.PI),
    post(w3(2497.8, 0, 445.4), Math.PI),
    post(w3(2492, 0, 428), Math.PI),
    post(w3(2482, 0, 428.5), -Math.PI / 2),
    post(w3(2506, 0, 446), Math.PI / 2),
  ],
  quay_terminal: [
    post(w3(2498.4, 0, 444.5), -2.3, "tessen_guard", true),
    post(SNIPER_PERCHES[0] as Vec3, -2.5, "tessen_sniper", true),
    post(w3(2497, 0, 420), -Math.PI / 2, "tessen_guard", true),
    post(w3(2505, 0, 447), -2.4, "tessen_guard", true),
    post(w3(2494, 0, 412.5), -0.6, "tessen_guard", true),
  ],
  // The sabotage (ADR-0082 stage 3): P1 in the hall, P2 on the mezzanine, the wagon airlock's and armoury S's guards.
  w3_hall: [{ ...patrol(W3_PATROL_HALL), enforcer: false }, patrol(W3_PATROL_MEZZANINE), post(W3_AIRLOCK_POST, Math.PI / 2), post(W3_ARMOURY_POST, Math.PI)],
};

/**
 * The sabotage's shift manager on the mezzanine (ADR-0082 §1 p. 2, G-929): the hall's enforcer of
 * disguises, by the rule of the pass office's shift boss (ADR-0033). Not one of the crew's posts
 * (`SABOTAGE.crew`): the job's templates put him after all the others, so their ids stay and a
 * saved job finds him too.
 */
export const W3_SHIFT_MANAGER: ContractPost = { ...patrol(W3_PATROL_MANAGER), enforcer: true };

/**
 * The technician on a cigarette by the service gate (ADR-0082 §1 p. 2, `enc_w3_smoker`), out on
 * the public strip east of it, facing the gate, from 19:00 to 23:00 while the sabotage runs: within
 * earshot he tells of locker 14 (the hook `hook_sabotage_2`).
 */
export const W3_SMOKER = { at: ground(2552.3, 390.4), yaw: -Math.PI / 2, fromHour: 19, toHour: 23 } as const;

/** Mika's way from Genzō's container down the riverside path to the river's bench under the terrace. */
export const ESCORT_ROUTE: readonly [Vec3, ...Vec3[]] = [ground(2489.4, 386.6), ground(2482, 385.5), ground(2475, 386.5), ground(2469, 390), ground(2463.5, 396), ground(2461.5, 405)];

/** Mika passing this line (down the bank, onto the bench) springs the ambush. */
export const ESCORT_AMBUSH_Z = 394;

/** Where the data of an infiltration lies (on the office desk) and where the hack terminal stands (on the quay by the pier). */
export const W3_ITEM_SPOTS: Readonly<Partial<Record<ContractSiteId, Vec3>>> = {
  tessen_office: w3(2487.2, 0.9, 441),
};
export const W3_TERMINAL_SPOTS: Readonly<Partial<Record<ContractSiteId, Vec3>>> = {
  quay_terminal: w3(2484, 0, 430),
  w3_hall: W3_VIRUS_TERMINAL,
};

/** Spawn points by site, for the shared table (the posts' positions). */
export const W3_CONTRACT_SITE_SPAWNS: Readonly<Record<"docks_escort" | "tessen_office" | "quay_terminal" | "w3_hall", readonly Vec3[]>> = {
  docks_escort: (W3_CONTRACT_POSTS.docks_escort ?? []).map((p) => p.at),
  tessen_office: (W3_CONTRACT_POSTS.tessen_office ?? []).map((p) => p.at),
  quay_terminal: (W3_CONTRACT_POSTS.quay_terminal ?? []).map((p) => p.at),
  w3_hall: (W3_CONTRACT_POSTS.w3_hall ?? []).map((p) => p.at),
};
