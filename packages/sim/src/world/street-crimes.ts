import {
  type ContractSiteId,
  type MicroEventKind,
  QUIET_DEAL_BONUS,
  TERRITORIES,
  TESSEN_FOIL_STANDING,
  advanceStreetCrimes,
  bandLevel,
  closeStreetCrime,
  crimeSlot,
  grudgeAfter,
  streetCrimePay,
  streetDistrusts,
} from "@seki/core";
import { MICRO_SPOTS } from "../content/encounter-rewards";
import { CONTRACT_SITE_BANDS, DISTRICT_BANDS } from "../content/district-bands";
import { DISTRICTS, type DistrictId } from "../content/world-map";
import { deriveRandom } from "../rng/derive-random";
import type { Entity } from "./components";
import type { MicroEventRun, SimContext } from "./context";
import type { BoardCrime } from "./street-crime-types";
import { adjustReputation } from "./domain-ops";

/*
 * The street's crimes in progress (ADR-0091 stage 5): the board of every 4 game hours, 1–2 crimes
 * per district at the street's spots, a pure function of the seed and the slot. One starts when
 * the player comes within reach of it (its people step in where she does not yet see them),
 * through the micro-events' run (micro-events.ts). Foiled, Tessen pays as the game's police; the
 * gang holding the district takes it badly. Over, it does not come back before the next board.
 */

/** A crime of the board starts when the player is within this of it, and not nearer than `NEAR`. */
export const CRIME_REACH = 60;
const NEAR = 12;
/** Farther than this from a started crime the player has walked away (ADR-0091: 80 m). */
export const CRIME_LEAVE = 80;

export type { BoardCrime } from "./street-crime-types";

const DISTRICT_IDS = Object.keys(DISTRICTS) as DistrictId[];

/** The kinds of the board and their shares of the roll (ADR-0091 §3: all six). */
const KINDS: readonly (readonly [MicroEventKind, number])[] = [
  ["mugging", 0.24],
  ["extortion", 0.16],
  ["aid", 0.18],
  ["deal", 0.14],
  ["droneTheft", 0.14],
  ["kidnap", 0.14],
];

/** The kind of a crime by a roll in [0, 1). */
const kindOf = (r: number): MicroEventKind => {
  let acc = 0;
  for (const [kind, share] of KINDS) {
    acc += share;
    if (r < acc) return kind;
  }
  return KINDS[KINDS.length - 1]![0];
};

/**
 * The board of `slot`: per district 1–2 crimes at distinct spots, from the seed alone; two in each
 * while the street distrusts the player (`streetDistrusts`), the first the same either way.
 */
export const crimeBoard = (seed: number, slot: number, distrusted = false): readonly BoardCrime[] =>
  DISTRICT_IDS.flatMap((district) => {
    const spots = MICRO_SPOTS[district];
    const rng = deriveRandom(seed, `crime:${district}:${slot}`);
    const rolled = rng.next() < 0.5 ? 1 : 2;
    const count = Math.min(spots.length, distrusted ? 2 : rolled);
    const first = Math.floor(rng.next() * spots.length);
    return Array.from({ length: count }, (_, n): BoardCrime => ({
      id: `crime:${slot}:${district}:${n}`,
      district,
      kind: kindOf(rng.next()),
      at: spots[(first + n) % spots.length]!,
    }));
  });

/** A crime is hidden in the district of a running contract's site (§3: not mixed with the job). */
export const crimeHidden = (site: ContractSiteId | null, district: BoardCrime["district"]): boolean => site !== null && CONTRACT_SITE_BANDS[site] === district;

const hidden = (ctx: SimContext, c: BoardCrime): boolean => crimeHidden(ctx.state.domain.contracts.active?.siteId ?? null, c.district);

/** The board's crimes the player may still run into now. */
export const openCrimes = (ctx: SimContext): readonly BoardCrime[] => {
  const log = ctx.state.domain.streetCrimes;
  const distrusted = streetDistrusts(ctx.state.domain.reputation.civilians);
  return crimeBoard(ctx.seed, crimeSlot(ctx.state.domain.clock), distrusted).filter((c) => !log.done.includes(c.id) && !hidden(ctx, c));
};

/** The first board from `from` (up to `horizon` boards on) with a crime that passes `test`: tools and tests. */
export const nextCrime = (
  seed: number,
  from: number,
  test: (c: BoardCrime) => boolean,
  distrusted = false,
  horizon = 2000,
): { readonly slot: number; readonly crime: BoardCrime } | null => {
  for (let slot = from; slot < from + horizon; slot++) {
    const crime = crimeBoard(seed, slot, distrusted).find(test);
    if (crime) return { slot, crime };
  }
  return null;
};

/** Keeps the log on the clock's board and day. */
export const tickStreetCrimes = (ctx: SimContext): void => {
  const d = ctx.state.domain;
  const next = advanceStreetCrimes(d.streetCrimes, d.clock);
  if (next !== d.streetCrimes) ctx.state.domain = { ...d, streetCrimes: next };
};

/** The board's crime the player came within reach of, if any (the nearest). */
export const crimeInReach = (ctx: SimContext, player: Entity): BoardCrime | null => {
  let best: BoardCrime | null = null;
  let bestD = Infinity;
  for (const c of openCrimes(ctx)) {
    const d = Math.hypot(c.at.x - player.position.x, c.at.z - player.position.z);
    if (d >= NEAR && d <= CRIME_REACH && d < bestD) {
      best = c;
      bestD = d;
    }
  }
  return best;
};

/** Does a gang hold territory in the district (its crimes there are its own)? */
const heldBy = (district: DistrictId): boolean => Object.values(TERRITORIES).some((t) => t.district === district);

/**
 * A crime of the board over: foiled (Tessen pays, the street thanks her, the gang of the district
 * holds it against her), failed or left.
 */
export const closeCrime = (ctx: SimContext, run: MicroEventRun, outcome: "won" | "helped" | "failed" | "left"): number => {
  if (outcome === "left") return 0;
  const d = ctx.state.domain;
  const foiled = outcome === "won" || outcome === "helped";
  const level = bandLevel(d.progression.level, DISTRICT_BANDS[run.crime.district]);
  const pay = foiled ? streetCrimePay(run.kind, level, d.streetCrimes.paidToday, d.reputation.tessen) : 0;
  // A deal taken down with none of the dealers alerted (§3, organized crime in CP2077).
  const eddies = run.kind === "deal" && !run.alarmed ? Math.round(pay * (1 + QUIET_DEAL_BONUS)) : pay;
  ctx.state.domain = { ...d, streetCrimes: closeStreetCrime(d.streetCrimes, run.crime.id, foiled) };
  if (foiled) adjustReputation(ctx, "tessen", TESSEN_FOIL_STANDING);
  if (outcome === "won" && run.kind !== "aid" && heldBy(run.crime.district)) {
    ctx.state.domain = { ...ctx.state.domain, gangStandings: grudgeAfter(ctx.state.domain.gangStandings, "hebi", run.crime.district, "foil") };
  }
  return eddies;
};
