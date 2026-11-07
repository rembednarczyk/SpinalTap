/**
 * The map's ways the game's set pieces replace (ADR-0042, ADR-0074 stage 7): an OSM element that
 * stands where a building or a square of 2077 is, dropped from the import with its row in
 * `docs/topografia.md`. The raw data in `data/osm` stays as downloaded; the glitch scan's
 * `cut-on-road` reads this list to tell a street the game replaced on purpose from one it cut by
 * mistake. Kept apart so `corrections.ts` stays within ADR-0031's 500 lines.
 */
import type { AddedArea } from "./corrections.ts";
import type { Area, Line } from "./features.ts";
import type { Pt } from "./geometry.ts";

export interface ReplacedWay {
  /** `w<id>`, as `Area.id` or `Line.id`. */
  readonly id: string;
  /** What of the game stands there instead. */
  readonly by: string;
  readonly reason: string;
  /** The entry of `docs/topografia.md` it answers. */
  readonly ref: string;
}

/**
 * Alchemia's car park w173531008 and its aisles (ADR-0074 stage 7, decision 7.11): the cars went
 * under the ground to P-1 (stage 4), the ramp from Bajkowskiego taking the driveway's place, so its
 * asphalt and the aisles' loop with the way out onto Lubartowska by the stop (447; 16) give way to
 * T0's square, paved, with lawns, pergolas and the deptak's lamps (`ALCHEMIA_AREAS`, the square's
 * pieces in `sim/content/alchemia/square.ts`).
 */
export const REPLACED_WAYS: readonly ReplacedWay[] = [
  {
    id: "w173531008",
    by: "plac T0 nad P−1",
    reason: "parking naziemny Alchemii: auta zjechały na P−1 (ADR-0074 etap 4), asfalt zastępuje plac z kostki z trawnikami i pergolami (decyzja użytkownika 7.11)",
    ref: "T-241",
  },
  {
    id: "w177513189",
    by: "plac T0, rampa P−1 i druga klatka",
    reason: "alejka parkingu od wjazdu z Bajkowskiego z wyjazdem na Lubartowską przy przystanku (447; 16): wjazd przejęła rampa P−1, reszta to plac T0 (G-500)",
    ref: "T-241",
  },
  {
    id: "w173567309",
    by: "plac T0",
    reason: "zachodnia pętla alejek parkingu: bez aut na T0 zostaje plac z trawnikiem i pergolą (decyzja użytkownika 7.11)",
    ref: "T-241",
  },
];

const REPLACED_IDS: ReadonlySet<string> = new Set(REPLACED_WAYS.map((w) => w.id));

/** Whether the import leaves the element out: the game's set piece stands in its place. */
export const isReplaced = (id: string, replaced: ReadonlySet<string> = REPLACED_IDS): boolean => replaced.has(id);

/** The map's features without the replaced ways, before the corrections read them. */
export const withoutReplaced = <T extends { readonly areas: readonly Area[]; readonly lines: readonly Line[] }>(f: T, replaced: ReadonlySet<string> = REPLACED_IDS): { areas: Area[]; lines: Line[] } => ({
  areas: f.areas.filter((a) => !isReplaced(a.id, replaced)),
  lines: f.lines.filter((l) => !isReplaced(l.id, replaced)),
});

/** The car park's outline, from its own nodes (by Bajkowskiego first, as mapped). */
const CAR_PARK: readonly Pt[] = [
  { x: 383.6, z: -9.27 },
  { x: 379.27, z: -4.49 },
  { x: 395.27, z: 38.55 },
  { x: 441.23, z: 26.62 },
  { x: 439.28, z: 18.18 },
  { x: 436.1, z: 4.42 },
  { x: 423.53, z: 5.97 },
  { x: 422.08, z: -5.67 },
  { x: 421.98, z: -8.82 },
];

/** A lawn: a rectangle with its corners cut by `c` (m), counter-clockwise. */
const lawn = (x0: number, x1: number, z0: number, z1: number, c: number): Pt[] => [
  { x: x0 + c, z: z0 },
  { x: x1 - c, z: z0 },
  { x: x1, z: z0 + c },
  { x: x1, z: z1 - c },
  { x: x1 - c, z: z1 },
  { x: x0 + c, z: z1 },
  { x: x0, z: z1 - c },
  { x: x0, z: z0 + c },
];

const LAWN_REASON = "trawnik placu T0 Alchemii na miejscu parkingu w173531008 (decyzja użytkownika 7.11: plac i zielony dach z trawnikami)";

/** T0's lawns (T-241): world rectangles with their corners cut. */
export const T0_LAWNS: readonly { readonly name: string; readonly ring: readonly Pt[] }[] = [
  { name: "trawnik-zachod", ring: lawn(391, 403.6, 3, 21, 1.5) },
  { name: "trawnik-wschod", ring: lawn(424, 434, 9, 21, 1.5) },
  { name: "trawnik-bajkowskiego", ring: lawn(385, 398, -5.5, -1.5, 1) },
];

/**
 * T0's square (T-241): the car park's outline paved as a square, the deptak's setts, and three lawns
 * in it, which the import cuts out of the paving as holes (`openPavings`): west of the ramp's trench
 * over P-1's deck, east of it between P-1's stair core and metro B's pavilion, and one by
 * Bajkowskiego west of the driveway. They keep clear of the trench's parapets and their beds, the
 * pergolas' walks, the stair house's door and the level graph's nodes on the square (`parking-nav.ts`).
 */
export const ALCHEMIA_AREAS: readonly AddedArea[] = [
  {
    id: "T-241/plac-t0",
    tags: { "area:highway": "pedestrian", surface: "paving_stones" },
    ring: CAR_PARK,
    nodesOf: CAR_PARK.map(() => "w173531008"),
    reason: "plac T0 Alchemii z kostki w obrysie dawnego parkingu w173531008, styl deptaku Krakowskiego Przedmieścia (decyzja użytkownika 7.11)",
    ref: "T-241",
  },
  ...T0_LAWNS.map((l): AddedArea => ({ id: `T-241/${l.name}`, tags: { landuse: "grass" }, ring: l.ring, nodesOf: l.ring.map(() => null), reason: LAWN_REASON, ref: "T-241" })),
];
