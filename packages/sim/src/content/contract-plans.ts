import type { ContractSiteId, Vec3 } from "@seki/core";
import { v } from "./builders";
import type { ScheduleDef } from "../world/components";

/**
 * Where the parts of a contract variation stand (ADR-0034), per site. Every point is open
 * ground, off the walls (checked by test/contract-variation.test.ts):
 * - `guards`: the mark's two bodyguards (`bodyguards`), a step from the mark;
 * - `twin`: the look-alike (`twin`; with `wrong_target` the two swap places);
 * - `lookout`: the extra guard of a `lockdown`, where the site is watched from the street;
 * - `ambush`: the crew waiting by the way out (`ambush`, or the `setup` twist).
 */
export interface SitePlan {
  readonly guards?: readonly [Vec3, Vec3];
  readonly twin?: Vec3;
  readonly lookout?: Vec3;
  readonly ambush?: readonly Vec3[];
}

export const SITE_PLANS: Readonly<Partial<Record<ContractSiteId, SitePlan>>> = {
  east_lot: { guards: [v(9, 0, -16.2), v(11.8, 0, -16.3)], twin: v(17.5, 0, -10), lookout: v(6, 0, -12), ambush: [v(5, 0, -13), v(4, 0, -6), v(5, 0, -20)] },
  koi_back: { guards: [v(4.2, 0, 11.2), v(2, 0, 13.2)], twin: v(-4, 0, 11), lookout: v(0, 0, 20), ambush: [v(0, 0, 22), v(-5, 0, 5), v(4, 0, -2)] },
  car_wash: { guards: [v(0, 0, 44.2), v(2.2, 0, 42.4)], twin: v(-1.5, 0, 46.5), lookout: v(2, 0, 36.5), ambush: [v(0, 0, 33), v(-4, 0, 30), v(4, 0, 31)] },
  south_gate: { guards: [v(-5, 0, -34.2), v(-3, 0, -34.6)], twin: v(8.5, 0, -34.5), lookout: v(-3, 0, -29), ambush: [v(0, 0, -24), v(-5, 0, -26), v(5, 0, -25)] },
  kanal_bridge: { guards: [v(54.4, 0, 79), v(52, 0, 79.2)], twin: v(58.5, 0, 79.5), lookout: v(46, 0, 78), ambush: [v(44, 0, 80), v(60, 0, 76.5), v(47, 0, 79.5)] },
  hebi_stash: { guards: [v(117, 0, 88.2), v(119, 0, 90)], lookout: v(110, 0, 92), ambush: [v(106, 0, 90), v(108, 0, 96), v(106, 0, 86)] },
  raid_north: { lookout: v(92, 0, 96) },
  raid_east: { lookout: v(106, 0, 80) },
  tessen_office: { guards: [v(-22.5, 0, 135.6), v(-19.6, 0, 135.6)], lookout: v(-12, 0, 128) },
  quay_terminal: { lookout: v(0, 0, 130), ambush: [v(12, 0, 121), v(4, 0, 121.5), v(20, 0, 125)] },
  docks_escort: { lookout: v(0, 0, 113) },
};

/** Where the night drinker drinks: at the counter by Neon Koi's door. */
export const BAR_SPOT: Vec3 = v(5.6, 0, 3);

/** From the mark's post (the site's first point) to the bar, and back the same way. */
const DRINKER_WAYS: Readonly<Partial<Record<ContractSiteId, readonly [Vec3, ...Vec3[]]>>> = {
  east_lot: [v(10.5, 0, -15.5), v(5, 0, -14), BAR_SPOT],
  koi_back: [v(3, 0, 12), BAR_SPOT],
  car_wash: [v(1, 0, 43), v(2, 0, 30), BAR_SPOT],
  south_gate: [v(-4, 0, -33), v(4, 0, -20), BAR_SPOT],
};

export const drinkerWay = (site: ContractSiteId): readonly [Vec3, ...Vec3[]] | undefined => DRINKER_WAYS[site];

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
