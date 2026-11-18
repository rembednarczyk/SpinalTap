import {
  type ContractSiteId,
  type MicroEventKind,
  TERRITORIES,
  TESSEN_FOIL_STANDING,
  advanceStreetCrimes,
  bandLevel,
  closeStreetCrime,
  crimeSlot,
  grudgeAfter,
  streetCrimePay,
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

/** The kind of a crime by a roll: a mugging, an extortion, a passer-by in need. */
const kindOf = (r: number): MicroEventKind => (r < 0.45 ? "mugging" : r < 0.7 ? "extortion" : "aid");

/** The board of `slot`: per district 1–2 crimes at distinct spots, from the seed alone. */
export const crimeBoard = (seed: number, slot: number): readonly BoardCrime[] =>
  DISTRICT_IDS.flatMap((district) => {
    const spots = MICRO_SPOTS[district];
    const rng = deriveRandom(seed, `crime:${district}:${slot}`);
    const count = Math.min(spots.length, rng.next() < 0.5 ? 1 : 2);
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
  return crimeBoard(ctx.seed, crimeSlot(ctx.state.domain.clock)).filter((c) => !log.done.includes(c.id) && !hidden(ctx, c));
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
export const closeCrime = (ctx: SimContext, run: MicroEventRun & { readonly crime: BoardCrime }, outcome: "won" | "helped" | "failed" | "left"): number => {
  if (outcome === "left") return 0;
  const d = ctx.state.domain;
  const foiled = outcome === "won" || outcome === "helped";
  const level = bandLevel(d.progression.level, DISTRICT_BANDS[run.crime.district]);
  const eddies = foiled ? streetCrimePay(run.kind, level, d.streetCrimes.paidToday, d.reputation.tessen) : 0;
  ctx.state.domain = { ...d, streetCrimes: closeStreetCrime(d.streetCrimes, run.crime.id, foiled) };
  if (foiled) adjustReputation(ctx, "tessen", TESSEN_FOIL_STANDING);
  if (outcome === "won" && run.kind !== "aid" && heldBy(run.crime.district)) {
    ctx.state.domain = { ...ctx.state.domain, gangStandings: grudgeAfter(ctx.state.domain.gangStandings, "hebi", run.crime.district, "foil") };
  }
  return eddies;
};
