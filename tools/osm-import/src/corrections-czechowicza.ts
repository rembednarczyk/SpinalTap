/**
 * Added areas on Plac Czechowicza (ADR-0042), the tail of `ADDED_AREAS`: kept apart so
 * `corrections.ts` stays within ADR-0031's 500 lines. Drawn after the areas there.
 */
import type { AddedArea } from "./corrections.ts";

/**
 * The pavement before the Sąd Okręgowy w69672563 (T-210): the square w505211283 ends 1-2 m short of
 * the court's north wall and the footway w288178955's band 2-3 m short of its east wall, where the
 * orthophoto (PZGiK) has the setts up to the walls (the roof, leaning north-east, hides the rest).
 * Two pieces parted at the square's corner (16.28; -104.69): one ring's edge along the square's would
 * be simplified in its chunk to a straight line, a 0.1 m crack under that corner.
 */
export const CZECHOWICZA_AREAS: readonly AddedArea[] = [
  {
    // From the square's south edge to the court's north wall, west of the square's corner. Off the
    // nodes: the point on the wall abreast of the corner.
    id: "T-210/chodnik-przed-sadem",
    tags: { "area:highway": "pedestrian", surface: "paving_stones" },
    ring: [
      { x: 2.26, z: -107.03 },
      { x: 16.28, z: -106.17 },
      { x: 16.28, z: -104.69 },
      { x: 2.07, z: -105.02 },
    ],
    nodesOf: ["w69672563", null, "w505211283", "w505211283"],
    reason: "kostka chodnika między Placem Czechowicza a północną ścianą Sądu Okręgowego na ortofoto PZGiK, w OSM plac kończy się 1–2 m przed budynkiem",
    ref: "T-210",
  },
  {
    // East of the corner: along the court's walls and on along the east wall of the house w69672561
    // to its corner, across to the footway's axis (drawn over it), up the axis to the square's edge
    // and along that edge back. Off the nodes: the point on the court's wall and the two on the
    // footway's axis.
    id: "T-210/chodnik-przy-sadzie",
    tags: { "area:highway": "pedestrian", surface: "paving_stones" },
    ring: [
      { x: 16.28, z: -106.17 },
      { x: 17.97, z: -106.07 },
      { x: 19.03, z: -115.46 },
      { x: 17.11, z: -127.07 },
      { x: 20.15, z: -127.07 },
      { x: 23.03, z: -111.88 },
      { x: 22.27, z: -104.8 },
      { x: 16.28, z: -104.69 },
    ],
    nodesOf: [null, "w69672563", "w69672563", "w69672561", null, "w288178955", null, "w505211283"],
    reason: "kostka chodnika wzdłuż wschodniej ściany Sądu Okręgowego do osi chodnika przy ul. Kościuszki na ortofoto PZGiK, w OSM chodnik kończy się 2–3 m przed budynkiem",
    ref: "T-210",
  },
];
