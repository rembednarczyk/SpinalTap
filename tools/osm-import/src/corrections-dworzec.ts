/**
 * Added areas east of the Dworzec Autobusowy (ADR-0042), the tail of `ADDED_AREAS`: kept apart so
 * `corrections.ts` stays within ADR-0031's 500 lines. Drawn after the areas there.
 */
import type { AddedArea } from "./corrections.ts";

export const DWORZEC_EAST_AREAS: readonly AddedArea[] = [
  {
    // The wedge between the sidewalk w1435832518 and the cycleway w1435832523 east of T-165, beige
    // setts with the bus stop's shelter w672635871 on the orthophoto (PZGiK), bare in OSM. Both ways
    // are drawn over it; it meets T-165/chodnik-tysiaclecia and T-173/chodnik-tysiaclecia-wschod on
    // their edges. Every corner is the map's node.
    id: "T-184/klin-przystanku",
    tags: { "area:highway": "pedestrian", surface: "paving_stones" },
    ring: [
      { x: 804.67, z: 360.04 },
      { x: 838.98, z: 355.26 },
      { x: 850.34, z: 355.9 },
      { x: 839.01, z: 360.04 },
      { x: 805.33, z: 364.6 },
    ],
    nodesOf: ["w1435832518", "w1435832518", "w1435832518", "w1435832523", "w1435832523"],
    reason: "beżowa kostka przystanku z wiatą między chodnikiem a drogą rowerową na wschód od Dworca na ortofoto PZGiK, w OSM tylko linie ścieżek",
    ref: "T-184",
  },
];
