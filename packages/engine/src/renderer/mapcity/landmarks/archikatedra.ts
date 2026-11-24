import type {
  BlindRow,
  LandmarkRecipe,
  PartRecipe,
  Tier,
} from "./recipe-types";

/**
 * The Archikatedra (w66286341 with its parts, T-349, `docs/plany/archikatedra.md`), after the user's
 * photographs of 24.11 and GUGiK NMPT: a Jesuit church of 1586-1604 with a classicist front by
 * Corazzi (1819-1821) in pale grey-white plaster (`building:colour=lightgrey`). The massing is the
 * import's (`corrections-katedra.ts`): the annexes to y 8.3, the chapels and vestibule to 14, the
 * presbytery's side rooms to 11.5, the nave to its eaves at 25 under a dark sheet-metal roof to 31.5
 * with the apse's half cone, the screen front between the turrets to 33 under a pediment to 35.3, and
 * the two turrets to 33.5 under copper onion helmets with an open lantern and a cross to 43. Before
 * the front the portico of six columns of a giant order (the simulation's `PORTICOES`) carries a
 * terrace with a balustrade at y 13. Stage K1: the solids in their materials with pilasters,
 * cornices, the belfries' openings and the helmets; the front's bays, windows and pediment, the
 * dormers, the ridge turret and the chapels' domes come in K2 and K3. Plac Katedralny is the Old
 * Town: Lublin 2077's subdued layer (ADR-0058).
 */

import { ANNEX_WINDOWS, CHAPEL_WINDOWS, CLERESTORY, NAVE_ROOF, SIDE_ROOM_WINDOWS } from "./archikatedra-roof";

const NO_BLINDS: readonly BlindRow[] = [];

/** The church's pale plaster with its pilasters and a cornice at the top: the common tier of its parts. */
const PLASTER: Tier = {
  material: "plaster",
  colour: "pale",
  plinth: 0,
  blinds: NO_BLINDS,
  pilasters: true,
  cornice: true,
  base: false,
  openings: false,
  clock: false,
};

/** A part of plain plaster walls under a flat roof (a terrace or a roof hidden by the parts over it). */
const flat = (osm: string, tier: Partial<Tier> = {}): PartRecipe => ({
  osm,
  tier: { ...PLASTER, ...tier },
  crown: { kind: "flat" },
});

/** The portal at the top of its steps (w66335060): the church's axis through it, the bays' offsets measured from it. */
const AXIS = { x: 603.52, z: -184.59 } as const;

/** A round-headed opening `width` metres wide on the axis or off it, world y from y0 to y1. */
const at = (
  offset: number,
  width: number,
  y0: number,
  y1: number,
): FrontOpening => ({ at: offset, width, y0, y1 });

/**
 * The vestibule behind the portico: a pilaster behind each column (their axes 4.16 m apart, the
 * middle bay on the axis), the main door at the top of the steps (y −1.5) and a window over each of
 * the three middle bays under the portico's ceiling.
 */
const VESTIBULE: WestFront = {
  axis: AXIS,
  pilasters: [-10.4, -6.24, -2.08, 2.08, 6.24, 10.4],
  doors: [at(0, 2.6, -1.5, 6.2)],
};
const VESTIBULE_UP: WestFront = {
  axis: AXIS,
  pilasters: VESTIBULE.pilasters!,
  windows: [
    at(0, 2, 9, 12),
    at(-4.16, 1.4, 9.4, 11.8),
    at(4.16, 1.4, 9.4, 11.8),
  ],
};

/**
 * The upper storey between the turrets: four pilasters (the middle bay 5.2 m wide), a tall
 * round-headed window on the axis and narrower ones in the side bays on the nave's west wall,
 * one more on the axis in the screen front, the sun in its pediment (the photograph of the front).
 */
const UPPER: readonly number[] = [-6.6, -2.6, 2.6, 6.6];
const NAVE_FRONT: WestFront = {
  axis: AXIS,
  pilasters: UPPER,
  windows: [at(0, 2.6, 16, 23.4), at(-4.6, 1.4, 17, 22), at(4.6, 1.4, 17, 22)],
};
const SCREEN_FRONT: WestFront = {
  axis: AXIS,
  pilasters: UPPER,
  windows: [at(0, 1.8, 26.3, 31.2)],
  sun: true,
};

export const ARCHIKATEDRA: LandmarkRecipe = {
  key: "archikatedra",
  parts: [
    // The outline at the annexes' height: a stone plinth on the podium, a cornice only on the annexes
    // (the chapels and the vestibule stand on the rest), the portico before its west front.
    flat("w66286341", {
      plinth: 0.6,
      cornice: false,
      eaves: true,
      portico: { floor: 13 },
      westFront: VESTIBULE,
      sideWindows: ANNEX_WINDOWS,
    }),
    flat("T-349/katedra-korpus", { westFront: VESTIBULE_UP, sideWindows: CHAPEL_WINDOWS }),
    flat("T-349/katedra-pod-nawa", { pilasters: false, cornice: false }),
    flat("T-349/katedra-prezbiterium-pn", { sideWindows: SIDE_ROOM_WINDOWS }),
    flat("T-349/katedra-prezbiterium-pd", { sideWindows: SIDE_ROOM_WINDOWS }),
    // The nave and the apse under the data's gabled roof in dark sheet metal (the photograph in the snow).
    {
      osm: "w617763433",
      tier: { ...PLASTER, roofing: "metal", westFront: NAVE_FRONT, sideWindows: CLERESTORY, roofscape: NAVE_ROOF },
      crown: { kind: "roof" },
    },
    // The screen front: its pediment's slopes in the same metal over the cornice.
    {
      osm: "T-349/katedra-fronton",
      tier: { ...PLASTER, roofing: "metal", westFront: SCREEN_FRONT },
      crown: { kind: "roof" },
    },
    ...["w617763434", "w617763435"].map(
      (osm): PartRecipe => ({
        osm,
        // From the chapels' roof at y 14 the turret's plain shaft to a string course at y 28, the belfry's
        // round-headed openings over it to the cornice at 33.5.
        tier: { ...PLASTER, openings: true, split: 14 },
        crown: {
          kind: "helm",
          height: 9.5,
          profile: {
            // A low drum and a swelling copper onion to two fifths of the helmet, the open lantern, a
            // small onion and the spire with its ball and cross (the photograph of the front).
            shell: [
              [0.92, 0],
              [0.92, 0.05],
              [1.0, 0.12],
              [0.98, 0.2],
              [0.8, 0.29],
              [0.5, 0.36],
              [0.3, 0.4],
            ],
            lantern: [0.4, 0.58],
            lanternRadius: 0.28,
            onion: 0.7,
            ball: 0.8,
            mast: 0.9,
            cross: true,
          },
        },
      }),
    ),
  ],
  // The front faces Plac Katedralny (west), its normal.
  layer: {
    newTown: { x: -0.99, z: -0.11 },
    neon: "#ffc98a",
    warm: "#ffc98a",
    checkpoint: false,
    subdued: true,
  },
};
