import type { ContractSiteId, Vec3 } from "@seki/core";
import { KRAKOWSKIE_SITE_POINTS } from "./district-m0";
import { w3 } from "./tessen-w3/site";
import { inShelter } from "./alchemia/market";
import { P2 } from "./alchemia/p2";
import { koiPoint } from "./interiors";
import { spotNear } from "./lublin/places";
import { ground } from "./lublin/terrain";
import type { ScheduleDef } from "../world/components";

/**
 * Where the parts of a contract variation stand (ADR-0034), per site. Every point is open
 * ground, off the walls (checked by test/contract-variation.test.ts):
 * - `guards`: the mark's two bodyguards (`bodyguards`), a step from the mark;
 * - `twin`: the look-alike (`twin`; with `wrong_target` the two swap places);
 * - `lookout`: the extra guard of a `lockdown`, where the site is watched from the street;
 * - `ambush`: the crew waiting by the way out (`ambush`, or the `setup` twist);
 * - `delay`: seconds from the acceptance before the job's crew turns up (a raid on its way).
 */
export interface SitePlan {
  readonly guards?: readonly [Vec3, Vec3];
  readonly twin?: Vec3;
  readonly lookout?: Vec3;
  readonly ambush?: readonly Vec3[];
  readonly delay?: number;
}

const { east_lot: lot, koi_back: back, car_wash: wash, south_gate: gate } = KRAKOWSKIE_SITE_POINTS;

export const SITE_PLANS: Readonly<Partial<Record<ContractSiteId, SitePlan>>> = {
  east_lot: { guards: [lot(9, -16.2), lot(11.8, -16.3)], twin: lot(17.5, -10), lookout: lot(6, -12), ambush: [lot(5, -13), lot(4, -6), lot(5, -20)] },
  koi_back: { guards: [back(4.2, 11.2), back(2, 13.2)], twin: back(-4, 11), lookout: back(0, 20), ambush: [back(0, 22), back(-5, 5), back(4, -2)] },
  car_wash: { guards: [wash(0, 44.2), wash(2.2, 42.4)], twin: wash(-1.5, 46.5), lookout: wash(2, 36.5), ambush: [wash(0, 33), wash(-1.5, 29.5), wash(4, 31)] },
  south_gate: { guards: [gate(-5, -34.2), gate(-3, -34.6)], twin: gate(8.5, -34.5), lookout: gate(-3, -29), ambush: [gate(0, -24), gate(-5, -26), gate(5, -25)] },
  kanal_bridge: { guards: [spotNear(660.5, 75.5), spotNear(658, 73.5)], twin: spotNear(664, 79.5), lookout: spotNear(650, 63), ambush: [spotNear(646, 58), spotNear(668, 84), spotNear(652, 66)] },
  // In the shelter under T2 (ADR-0074 stage 5d2): the guards by the stash's cover, the lockdown's lookout on T2 by the
  // hatch, the ambush at both ways out (P-2's corridor before the gate, T2 round the hatch).
  hebi_stash: {
    guards: [inShelter(422.4, 89.2), inShelter(423.8, 90.4)],
    lookout: ground(444.6, 96.2),
    ambush: [{ x: 418.6, y: P2.floor, z: 66.0 }, ground(446.0, 99.6), ground(439.0, 101.0)],
  },
  // The raids turn up at the gallery's cores on P2 (ADR-0093 O3) once they have climbed to there: Oyaji
  // is hit some 18 s after the job is taken, as on T1's level before O3 (1020 steps), and the
  // player running up from Hana's cart gets to P3 before them.
  raid_north: { lookout: ground(431.5, 123), delay: 6.5 },
  raid_east: { lookout: ground(445, 74), delay: 9.5 },
  // W-3 (ADR-0082): the pass office in the tower, the quay by the pier, the riverside path.
  tessen_office: { guards: [w3(2490, 0, 439), w3(2493, 0, 438.2)], lookout: w3(2492, 0, 432) },
  quay_terminal: { lookout: w3(2488, 0, 426), ambush: [w3(2497, 0, 424), w3(2493, 0, 420), w3(2498, 0, 433)] },
  docks_escort: { lookout: ground(2480, 384) },
};

/** Where the night drinker drinks: at the street counter by Neon Koi's door, on the deptak. */
export const BAR_SPOT: Vec3 = koiPoint(5.6, 0, 3);

/** From the mark's post (the site's first point) to the bar along the deptak, and back the same way. */
const DRINKER_WAYS: Readonly<Partial<Record<ContractSiteId, readonly [Vec3, ...Vec3[]]>>> = {
  east_lot: [lot(10.5, -15.5), ground(150, -53), ground(240, -66), ground(300, -86.5), BAR_SPOT],
  koi_back: [back(3, 12), ground(296, -112), ground(283, -108), ground(282, -88), ground(300, -89), BAR_SPOT],
  // Out of the yard by Lubartowska, down to Plac Łokietka and west along the deptak.
  car_wash: [wash(1, 43), ground(420, -30), ground(441, -40), ground(441, -88), ground(420, -98), ground(342, -91.5), BAR_SPOT],
  south_gate: [gate(-4, -33), ground(240, -66), ground(300, -86.5), BAR_SPOT],
};

export const drinkerWay = (site: ContractSiteId): readonly [Vec3, ...Vec3[]] | undefined => DRINKER_WAYS[site];

/** The sites with a way to the bar. */
export const DRINKER_SITES = Object.keys(DRINKER_WAYS) as ContractSiteId[];

/** Off to the bar at 22:00, back on the post at 02:00 (ADR-0034, the `drinker` trait). */
export const DRINKER_FROM = 22 * 60;
export const DRINKER_TO = 2 * 60;

/** The mark's night out as a daily plan, or undefined for a site without a way to the bar. */
export const drinkerSchedule = (site: ContractSiteId, postYaw: number): ScheduleDef | undefined => {
  const way = drinkerWay(site);
  if (!way) return undefined;
  const [post, ...rest] = way;
  const back = [...way].reverse().slice(1);
  const there = rest.length > 0 ? rest : [post];
  return {
    speed: 1.6,
    stops: [
      { label: "posterunek", at: DRINKER_TO, path: [back[0] ?? post, ...back.slice(1)], yaw: postYaw },
      { label: "bar", at: DRINKER_FROM, path: [there[0] ?? post, ...there.slice(1)], yaw: Math.PI / 2 },
    ],
  };
};
