import { GAME_SECONDS_PER_REAL_SECOND, type Vec3, hm } from "@seki/core";
import type { ScheduleDef } from "../world/components";
import type { ActorDef } from "./builders";
import { againstWall } from "./lublin/places";
import { ground } from "./lublin/terrain";

/**
 * Hebi on patrol in Stare Miasto (ADR-0048), their own ground: four gangers walk the Rynek
 * round the Trybunał, Grodzka down to Brama Grodzka and Bramowa up from Brama Krakowska. By
 * day one of them walks the Rynek and the others hold their corners; from 21:00 to 5:00 all four
 * walk. They are street patrols: a neutral player is watched, not attacked, while the heat,
 * a hostile standing, a blown Hebi disguise or a shot alerts them like any ganger. The plans are
 * pure functions of the clock (ADR-0017), so a save keeps only the gangers' own state.
 *
 * A loop is walked a whole number of times in its hours: the walker is back where the loop
 * starts when the next stop begins, so it never cuts across the houses to catch up.
 */

/** About this fast (m per real second); each plan rounds it to fit its hours. */
const PATROL_WALK = 1.6;
/** When the night patrols set off and when they go back to their corners. */
export const KANAL_NIGHT = { from: hm(21), to: hm(5) } as const;

type Route = readonly (readonly [number, number])[];

const pts = (route: Route): [Vec3, ...Vec3[]] => route.map(([x, z]) => ground(x, z)) as [Vec3, ...Vec3[]];

/** A route walked there and back as a loop: out along the points and back along them. */
const thereAndBack = (route: Route): Route => [...route, ...route.slice(1, -1).reverse()];

const ringLength = (route: Route): number => route.reduce((s, [x, z], i) => {
  const [nx, nz] = route[(i + 1) % route.length] as readonly [number, number];
  return s + Math.hypot(nx - x, nz - z);
}, 0);

/**
 * Round the Trybunał on the Rynek's open cobbles: north under KARAOKE and DENKI, down the east
 * side, back along the south side and up the west side past the Trybunał's door (Trasa
 * Podziemna). Clear of the walls by 2 m and more.
 */
export const RYNEK_LOOP: Route = [
  [560, -40],
  [599, -39],
  [606, -62],
  [603, -87],
  [563, -87],
  [561, -64],
];
/** The same loop the other way round, from the west side: the second night patrol. */
const RYNEK_LOOP_BACK: Route = [
  [561, -64],
  [563, -87],
  [603, -87],
  [606, -62],
  [599, -39],
  [560, -40],
];
/**
 * Grodzka from under the footbridge down to the foot of Brama Grodzka, back up to the Rynek and
 * back to the footbridge, along the street's middle line.
 */
export const GRODZKA_PATROL: Route = [
  ...thereAndBack([
    [659, 74.5],
    [668, 90],
    [676, 104],
    [682, 112],
    [691, 120],
    [697, 126],
  ]),
  [659, 74.5],
  ...thereAndBack([
    [637, 47],
    [610, 14],
    [577, -23],
    [573, -28],
  ]),
  [637, 47],
];
/** Bramowa from the middle of the street up to the Rynek, back down to Brama Krakowska and back. */
export const BRAMOWA_PATROL: Route = [
  [506, -72.7],
  [520, -63],
  [541, -52],
  [520, -63],
  [506, -72.7],
  [497, -79],
  [490, -84],
  [497, -79],
];

/** Corners the patrols hold by day: under the footbridge, on Bramowa, off the Rynek's west side. */
const POSTS = {
  grodzka: againstWall(654, 80.5),
  bramowa: againstWall(506, -71),
  rynek: againstWall(543, -60),
} as const;

const ganger = (key: string, at: Vec3, yaw: number): ActorDef => ({ kind: "ganger", spawn: { key, position: at, yaw, tag: null }, patrol: true });

export const KANAL_PATROL_ACTORS: readonly ActorDef[] = [
  ganger("hebi-rynek", ground(...(RYNEK_LOOP[0] as [number, number])), Math.PI / 2),
  ganger("hebi-grodzka", POSTS.grodzka.at, POSTS.grodzka.yaw),
  ganger("hebi-bramowa", POSTS.bramowa.at, POSTS.bramowa.yaw),
  ganger("hebi-rynek-noc", POSTS.rynek.at, POSTS.rynek.yaw),
];

/** Real seconds in `minutes` of the game. */
const realSeconds = (minutes: number): number => (minutes * 60) / GAME_SECONDS_PER_REAL_SECOND;

/** The whole day round one loop. */
const allDay = (route: Route): ScheduleDef => {
  const length = ringLength(route);
  const laps = Math.max(1, Math.round((PATROL_WALK * realSeconds(24 * 60)) / length));
  return { speed: (laps * length) / realSeconds(24 * 60), stops: [{ label: "patrol", at: 0, path: pts(route), yaw: 0, loop: true }] };
};

/** A corner by day and a loop at night, starting and ending at the loop's first point. */
const dayAndNight = (corner: { readonly at: Vec3; readonly yaw: number }, route: Route): ScheduleDef => {
  const [x0, z0] = route[0] as readonly [number, number];
  const leadIn = Math.hypot(x0 - corner.at.x, z0 - corner.at.z);
  const length = ringLength(route);
  const hours = realSeconds(24 * 60 - KANAL_NIGHT.from + KANAL_NIGHT.to);
  const laps = Math.max(1, Math.round((PATROL_WALK * hours - leadIn) / length));
  return {
    speed: (laps * length + leadIn) / hours,
    stops: [
      { label: "posterunek", at: KANAL_NIGHT.to, path: [corner.at], yaw: corner.yaw, activity: { cycle: ["guard", "smoke"], minutes: 30 } },
      { label: "patrol", at: KANAL_NIGHT.from, path: pts(route), yaw: corner.yaw, loop: true },
    ],
  };
};

export const KANAL_PATROL_SCHEDULES: Readonly<Record<string, ScheduleDef>> = {
  "hebi-rynek": allDay(RYNEK_LOOP),
  "hebi-grodzka": dayAndNight(POSTS.grodzka, GRODZKA_PATROL),
  "hebi-bramowa": dayAndNight(POSTS.bramowa, BRAMOWA_PATROL),
  "hebi-rynek-noc": dayAndNight(POSTS.rynek, RYNEK_LOOP_BACK),
};
