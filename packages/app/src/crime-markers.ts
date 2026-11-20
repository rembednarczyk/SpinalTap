import { boardOpen, crimeReward } from "@seki/sim";
import { type CrimeMarkerVm, translate } from "@seki/ui";
import type { DomainState, Locale } from "@seki/core";

/*
 * The street's crimes on the map (ADR-0091 stage 6), as the NCPD's blue icons of Cyberpunk 2077:
 * every crime of the open board on the city map from the board's start; its kind and pay only
 * within `CRIME_DETAIL_RANGE`. The board is the simulation's own (`boardOpen`), so a marker stands
 * where the crime will start.
 */

/** Within this of the player a crime shows its kind and pay, and the minimap shows it (ADR-0091: 300 m). */
export const CRIME_DETAIL_RANGE = 300;

const same = (a: readonly CrimeMarkerVm[], b: readonly CrimeMarkerVm[]): boolean =>
  a.length === b.length &&
  a.every((m, i) => {
    const n = b[i]!;
    return m.id === n.id && m.near === n.near && m.reward === n.reward && m.tracked === n.tracked;
  });

/**
 * The crime markers of a frame; the previous array while nothing the map shows changed, so the
 * per-frame store push does not re-render.
 */
export const createCrimeMarkers = () => {
  let last: readonly CrimeMarkerVm[] = [];
  return (seed: number, domain: DomainState, player: { readonly x: number; readonly z: number } | null): readonly CrimeMarkerVm[] => {
    const tracked = domain.streetCrimes.tracked;
    const next = boardOpen(seed, domain).map((c): CrimeMarkerVm => {
      const near = player !== null && Math.hypot(c.at.x - player.x, c.at.z - player.z) <= CRIME_DETAIL_RANGE;
      return { id: c.id, x: c.at.x, z: c.at.z, kind: c.kind, near, reward: near ? crimeReward(domain, c) : null, tracked: c.id === tracked };
    });
    if (!same(last, next)) last = next;
    return last;
  };
};

/** Metres the objective's distance is rounded to, so the HUD line does not change every step. */
const DISTANCE_STEP = 10;

/**
 * The HUD's objective while a crime is followed (ADR-0091 stage 6): it takes the place of the
 * journal's, as a tracked NCPD crime does in Cyberpunk 2077 (following it let go of the pin).
 */
export const crimeObjective = (crime: CrimeMarkerVm, locale: Locale, player: { readonly x: number; readonly z: number } | null): { title: string; objective: string } => {
  const kind = translate(locale, `crime.kind.${crime.kind}`);
  if (!player) return { title: translate(locale, "crime.objective.title"), objective: kind };
  const metres = Math.max(DISTANCE_STEP, Math.round(Math.hypot(crime.x - player.x, crime.z - player.z) / DISTANCE_STEP) * DISTANCE_STEP);
  return { title: translate(locale, "crime.objective.title"), objective: translate(locale, "crime.objective", { kind, metres }) };
};
