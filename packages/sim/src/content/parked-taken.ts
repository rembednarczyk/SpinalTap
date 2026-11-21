/**
 * The flag of a parked car she broke into (ADR-0097): the car is hers from then on, so its place
 * stays empty, in the street's solids and in the scenery, also after a load (the flags are saved).
 */
export const PARKED_TAKEN_PREFIX = "parked-taken:";
export const parkedTakenFlag = (index: number): string => `${PARKED_TAKEN_PREFIX}${index}`;

/** The places in `PARKED_CARS` of the parked cars taken under these flags. */
export const takenParked = (flags: readonly string[]): ReadonlySet<number> => {
  const out = new Set<number>();
  for (const f of flags) if (f.startsWith(PARKED_TAKEN_PREFIX)) out.add(Number(f.slice(PARKED_TAKEN_PREFIX.length)));
  return out;
};
