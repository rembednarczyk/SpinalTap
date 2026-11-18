import { type FactionId, reputationTier } from "../reputation/reputation";
import { type GameClock, SECONDS_PER_DAY, SECONDS_PER_HOUR } from "../time/game-clock";

/*
 * The gangs' territories between contracts (ADR-0091). A territory is a group of a gang standing
 * in a real place of a district. The gang's grudge and its provocation are kept per district
 * (the user's decision of 18.11): the territories of one district share them. Nothing here
 * assumes the gang is Hebi; a new gang is new rows in `TERRITORIES`.
 */

/** The districts of the city (ADR-0042), as the simulation's content names them. */
export type CityDistrictId = "shinsekai-7" | "kanal" | "targ" | "doki";

export const CITY_DISTRICT_IDS: readonly CityDistrictId[] = ["shinsekai-7", "kanal", "targ", "doki"];

/** The territories of ADR-0091 §1; the content places their people (stage 3 and 4). */
export const TERRITORIES = {
  /** Behind the car wash, where M0 played: the gang comes back after the prologue. */
  "car-wash-yard": { faction: "hebi", district: "shinsekai-7" },
  /** Under Alchemia's arcades, by today's lookout. */
  "alchemia-arcades": { faction: "hebi", district: "shinsekai-7" },
  /** An alley off Kapucyńska or Karmelicka. */
  "kapucynska-alley": { faction: "hebi", district: "shinsekai-7" },
  /** The Rynek round the Trybunał: the street patrols of ADR-0048. */
  rynek: { faction: "hebi", district: "kanal" },
  /** The footbridge over Grodzka (dealing). */
  "grodzka-bridge": { faction: "hebi", district: "kanal" },
  /** Zaułek Panasa or Podwale. */
  "panasa-lane": { faction: "hebi", district: "kanal" },
  /** The stalls by the bus station. */
  "bus-station": { faction: "hebi", district: "targ" },
  /** The bazaar's halls by Aleja Tysiąclecia. */
  "bazaar-halls": { faction: "hebi", district: "targ" },
  /** Nowy Plac Targowy by Ruska. */
  "ruska-market": { faction: "hebi", district: "targ" },
  /** Lubartowska by the roundabout. */
  lubartowska: { faction: "hebi", district: "targ" },
} as const satisfies Readonly<Record<string, { readonly faction: FactionId; readonly district: CityDistrictId }>>;

export type TerritoryId = keyof typeof TERRITORIES;

export const TERRITORY_IDS = Object.keys(TERRITORIES) as readonly TerritoryId[];

export const isTerritoryId = (id: string): id is TerritoryId => Object.hasOwn(TERRITORIES, id);

/** A gang's memory of the player in one district: its grudge 0..100, and until when (clock seconds) it is provoked. */
export interface GangStanding {
  readonly grudge: number;
  readonly provokedUntil: number | null;
}

/** No entry: calm, no grudge. */
export const NO_GANG_STANDING: GangStanding = { grudge: 0, provokedUntil: null };

/** `<faction>:<district>`. */
export type GangStandingKey = `${FactionId}:${CityDistrictId}`;

/** The saved standings (ADR-0091, save v48); absent keys are calm. */
export type GangStandings = Readonly<Partial<Record<GangStandingKey, GangStanding>>>;

export const NO_GANG_STANDINGS: GangStandings = {};

export const gangStandingKey = (faction: FactionId, district: CityDistrictId): GangStandingKey => `${faction}:${district}`;

export const standingOf = (standings: GangStandings, faction: FactionId, district: CityDistrictId): GangStanding =>
  standings[gangStandingKey(faction, district)] ?? NO_GANG_STANDING;

/** The rules' numbers (ADR-0091 §2 and the decisions of 18.11); stage 7 tunes them. */
export const GANG_RULES = {
  /** From this grudge on the gang is hostile in the district without a provocation. */
  hostileGrudge: 60,
  maxGrudge: 100,
  /** A provocation holds this many game hours. */
  provokedHours: 6,
  /** The hour of the dawn, when the grudge falls by `dawnRelief`. */
  dawnHour: 5,
  dawnRelief: 20,
} as const;

/** What changes a gang's grudge in a district, and by how much. */
export const GRUDGE_STEP = {
  /** A member killed. */
  kill: 20,
  /** A member knocked out. */
  knockout: 10,
  /** A provocation (the warning ran out, a gun aimed at a member, a member hit, a shot within earshot). */
  provoke: 5,
  /** A crime of the gang holding the district foiled (decision 9 of 18.11). */
  foil: 8,
  /** The gang helped with its crime (a dark job, decision 8 of 18.11). */
  assist: -10,
} as const;

export type GrudgeCause = keyof typeof GRUDGE_STEP;

const clampGrudge = (g: number): number => Math.min(GANG_RULES.maxGrudge, Math.max(0, g));

const withStanding = (standings: GangStandings, faction: FactionId, district: CityDistrictId, next: GangStanding): GangStandings => ({
  ...standings,
  [gangStandingKey(faction, district)]: next,
});

/** The standings once `cause` happened to the gang in the district. */
export const grudgeAfter = (standings: GangStandings, faction: FactionId, district: CityDistrictId, cause: GrudgeCause): GangStandings => {
  const s = standingOf(standings, faction, district);
  return withStanding(standings, faction, district, { ...s, grudge: clampGrudge(s.grudge + GRUDGE_STEP[cause]) });
};

/** The gang provoked in the district at `clock`: provoked for `provokedHours`, and its grudge up by `provoke`. */
export const provokeGang = (standings: GangStandings, faction: FactionId, district: CityDistrictId, clock: GameClock): GangStandings => {
  const s = standingOf(standings, faction, district);
  return withStanding(standings, faction, district, {
    grudge: clampGrudge(s.grudge + GRUDGE_STEP.provoke),
    provokedUntil: clock.seconds + GANG_RULES.provokedHours * SECONDS_PER_HOUR,
  });
};

/** Is the gang provoked in the district at `clock`? */
export const gangProvoked = (s: GangStanding, clock: GameClock): boolean => s.provokedUntil !== null && clock.seconds < s.provokedUntil;

/** What else stops a gang tolerating the player: its heat on her, or its disguise seen through. */
export interface ToleranceContext {
  readonly hunted: boolean;
  readonly disguiseBurned: boolean;
}

/** Does a group of the gang tolerate the player in the district: watch her instead of fighting? */
export const gangTolerates = (s: GangStanding, clock: GameClock, ctx: ToleranceContext): boolean =>
  !ctx.hunted && !ctx.disguiseBurned && !gangProvoked(s, clock) && s.grudge < GANG_RULES.hostileGrudge;

/** How many dawns (`dawnHour`) fall in (from, to]. */
export const dawnsBetween = (from: GameClock, to: GameClock): number => {
  const shift = GANG_RULES.dawnHour * SECONDS_PER_HOUR;
  const dayIndex = (s: number): number => Math.floor((s - shift) / SECONDS_PER_DAY);
  return Math.max(0, dayIndex(to.seconds) - dayIndex(from.seconds));
};

/**
 * The standings from `from` to `to`: every dawn between them lowers each grudge by `dawnRelief`,
 * and a provocation that ran out is forgotten. Entries back to calm leave the map.
 */
export const dawnGrudge = (standings: GangStandings, from: GameClock, to: GameClock): GangStandings => {
  const relief = dawnsBetween(from, to) * GANG_RULES.dawnRelief;
  const out: Partial<Record<GangStandingKey, GangStanding>> = {};
  for (const [key, s] of Object.entries(standings) as [GangStandingKey, GangStanding][]) {
    const next: GangStanding = { grudge: clampGrudge(s.grudge - relief), provokedUntil: s.provokedUntil !== null && to.seconds < s.provokedUntil ? s.provokedUntil : null };
    if (next.grudge > 0 || next.provokedUntil !== null) out[key] = next;
  }
  return out;
};

/** The warning before a group fights (decision 3 of 18.11): how near a drawn gun sets it off, and the seconds to put it away or leave. */
export interface GangWarning {
  readonly range: number;
  readonly seconds: number;
}

/** The warning at the gang's standing with the player: wary groups warn from farther, hostile ones also sooner. */
export const gangWarning = (reputation: number): GangWarning => {
  const tier = reputationTier(reputation);
  if (tier === "hostile") return { range: 12, seconds: 2 };
  if (tier === "wary") return { range: 10, seconds: 3 };
  return { range: 8, seconds: 3 };
};
