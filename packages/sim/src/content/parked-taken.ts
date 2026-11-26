import { PARKED_CARS } from "./parked-cars";

/**
 * The flag of a parked car she broke into (ADR-0097): the car is hers from then on, so its place
 * stays empty, in the street's solids and in the scenery, also after a load (the flags are saved).
 * The flag names the car by its place on the map, a decimetre's grid (G-978): its index in
 * `PARKED_CARS` moves whenever the city's cars change (a car park more, a car fewer), and a save's
 * flag would empty another car's bay. A flag of a save from before it, the index, reads as it did.
 */
export const PARKED_TAKEN_PREFIX = "parked-taken:";

/** A car's place as its flag has it: x and z on a decimetre's grid. */
const placeOf = (c: { readonly x: number; readonly z: number }): string => `${c.x.toFixed(1)},${c.z.toFixed(1)}`;

let byPlace: ReadonlyMap<string, number> | null = null;
/** The cars of `PARKED_CARS` by their place, built on the first flag read. */
const indexOfPlace = (place: string): number | undefined => (byPlace ??= new Map(PARKED_CARS.map((c, i) => [placeOf(c), i]))).get(place);

/** The flag of the parked car at `index` in `PARKED_CARS`. */
export const parkedTakenFlag = (index: number): string => `${PARKED_TAKEN_PREFIX}${placeOf(PARKED_CARS[index]!)}`;

/** The places in `PARKED_CARS` of the parked cars taken under these flags: by their place, or by the index of an older save. */
export const takenParked = (flags: readonly string[]): ReadonlySet<number> => {
  const out = new Set<number>();
  for (const f of flags) {
    if (!f.startsWith(PARKED_TAKEN_PREFIX)) continue;
    const key = f.slice(PARKED_TAKEN_PREFIX.length);
    const index = key.includes(",") ? indexOfPlace(key) : Number(key);
    if (index !== undefined && Number.isInteger(index)) out.add(index);
  }
  return out;
};
