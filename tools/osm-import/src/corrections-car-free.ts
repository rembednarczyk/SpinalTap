/**
 * The map's streets the game closes to cars (ADR-0074, decision of 15.11): a carriageway of OSM
 * that is a deptak in 2077, with stalls on it and bollards at its ends. Its geometry, kerbs and width
 * stay the map's; the import lays setts on it instead of asphalt (no painted lanes, the stalls stand
 * on paving) and marks its pieces `carFree`, so the traffic gives it no car lane, only deliveries
 * (`sim/content/lublin/roads.ts`). The glitch scan's `road-retag-row` reads this list: every way of it
 * has its row in `docs/topografia.md`. Kept apart so `corrections.ts` stays within ADR-0031's 500 lines.
 */
import type { TagCorrection } from "./corrections.ts";

export interface CarFreeWay {
  /** `w<id>`, as `Line.id`. */
  readonly id: string;
  readonly reason: string;
  /** The entry of `docs/topografia.md` it answers. */
  readonly ref: string;
  /**
   * Where its setts end square across it, metres back from its first (`start`) or last (`end`) node
   * at a street it meets (user's notes of 21.11: the deptak "evenly finished"): at that street's kerb,
   * the rest to the node asphalt of the junction (`deptak-ends.ts`). Without it the setts reach the node,
   * where the junction's asphalt cuts them along the other streets' slanting edges.
   */
  readonly trim?: { readonly start?: number; readonly end?: number };
  /**
   * The map's areas beside it laid as its setts up to its trimmed ends (user's notes of 21.11): a
   * parking lane along the old carriageway, left a narrow strip of asphalt between the setts and the
   * pavement. Past the ends it stays as the map draws it.
   */
  readonly lanes?: readonly string[];
}

export const CAR_FREE_WAYS: readonly CarFreeWay[] = [
  {
    // Lubartowska from Bajkowskiego (442.9; -9.9) to Olejna (454.9; 42.8), 54 m along the front of
    // T0, metro B's exit and the pavilion on the corner. Lubartowska north of Olejna stays a street.
    id: "w216497220",
    reason: "Lubartowska od Bajkowskiego do Olejnej: deptak z kioskami i straganami bez ruchu aut (decyzja użytkownika 15.11), kostka zamiast asfaltu",
    ref: "T-324",
    // Square at Olejna's south kerb (its half 1.7 m by the node), 1.8 m short of the node.
    trim: { end: 1.8 },
    // The parking lane on its west side (z 27..43), where the stalls stand; north of Olejna it goes on along Lubartowska.
    lanes: ["w522482244"],
  },
  {
    // Its 6 m south to Bajkowskiego (-15.8..-9.9), the deptak's mouth: no car lane ran along it (a chain
    // under `MIN_ROUTE`), and the cars turning from Bajkowskiego into Lubartowska w40050981 keep to
    // the asphalt south of it. Asphalt here left the setts' edge across the mouth, where the ground's
    // partition parts the two by millimetres (`kerb-gap-bare` at (443.1; -9.9)); setts to Bajkowskiego
    // leave none, and the junction's asphalt is the two streets'.
    id: "w173533826",
    reason: "wylot deptaku przy Bajkowskiego: 6 m Lubartowskiej, którymi nie jechał żaden pas aut; skręt z Bajkowskiego w w40050981 zostaje na asfalcie",
    ref: "T-324",
    // Square at Bajkowskiego's north kerb (its half 3.65-3.7 m by the node), 3.7 m short of the node.
    trim: { start: 3.7 },
  },
];

const CAR_FREE_IDS: ReadonlySet<string> = new Set(CAR_FREE_WAYS.map((w) => w.id));

/** Whether the game closes the way to cars. */
export const isCarFree = (id: string): boolean => CAR_FREE_IDS.has(id);

/** The deptaki paved with setts: no asphalt and no painted lanes on them. */
export const CAR_FREE_CORRECTIONS: readonly TagCorrection[] = CAR_FREE_WAYS.map((w) => ({ id: w.id, tags: { surface: "sett" }, reason: w.reason, ref: w.ref }));
