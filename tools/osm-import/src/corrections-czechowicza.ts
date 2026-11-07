/**
 * Added areas on Plac Czechowicza, ul. Kościuszki and Peowiaków (ADR-0042), the tail of `ADDED_AREAS`: kept apart so
 * `corrections.ts` stays within ADR-0031's 500 lines. Drawn after the areas there.
 */
import type { AddedArea } from "./corrections.ts";
import type { Pt } from "./geometry.ts";

/**
 * The pavement before the Sąd Okręgowy w69672563 (T-210): the square w505211283 ends 1-2 m short of
 * the court's north wall and the footway w288178955's band 2-3 m short of its east wall, where the
 * orthophoto (PZGiK) has the setts up to the walls (the roof, leaning north-east, hides the rest).
 * Two pieces parted at the square's corner (16.28; -104.69): one ring's edge along the square's would
 * be simplified in its chunk to a straight line, a 0.1 m crack under that corner.
 */
const PLAC_AREAS: readonly AddedArea[] = [
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

/**
 * A piece of the pavement along ul. Kościuszki (T-211): along a house's façade `wall` (north to south,
 * its nodes of the ways `wallOf`), across to the footway's axis and up it, `axis` (south to north,
 * drawn under the footway's band).
 */
const kosciuszki = (name: string, wall: readonly Pt[], wallOf: readonly (string | null)[], axis: readonly Pt[], axisOf: readonly (string | null)[]): AddedArea => ({
  id: `T-211/${name}`,
  tags: { "area:highway": "pedestrian", surface: "paving_stones" },
  ring: [...wall, ...axis],
  nodesOf: [...wallOf, ...axisOf],
  reason: "kostka chodnika ul. Kościuszki do fasad na ortofoto PZGiK, w OSM chodnik (linia) kończy się 1–1,5 m przed budynkami",
  ref: "T-211",
});

/**
 * The pavement along the façades of ul. Kościuszki (T-211): the footways w288178955 (west) and
 * w288178957 (east), lines with 2.5 m bands, end 1-1.5 m short of the houses, where the orthophoto
 * (PZGiK) has the setts up to the walls. One piece per house: a ring along several would be simplified
 * in its chunk (0.3 m) to a chord past the houses' own, a crack along the walls. The pieces part on the
 * houses' corners and the footway's axis abreast of them (off the nodes). Along w67508939 and
 * w67508949 the façade's jogs under 0.3 m are left out, as the houses' outlines leave them: kept,
 * they would part the setts from the simplified wall. w67508949's façade runs 0.4 m inside the wall,
 * from w67508939's corner to a point off its south-west corner: the chunk's edge (x 20) cuts the
 * piece by that corner, and on the wall the cut, simplified and rounded pieces leave cracks of 1-25 cm.
 */
const KOSCIUSZKI_AREAS: readonly AddedArea[] = [
  // West, on from T-210's south edge to the corner by Peowiaków.
  kosciuszki(
    "zachod-w69672561",
    [{ x: 17.11, z: -127.07 }, { x: 17.34, z: -127.15 }, { x: 16.74, z: -130.76 }, { x: 16.51, z: -130.69 }, { x: 15.19, z: -138.59 }, { x: 15.42, z: -138.67 }, { x: 14.43, z: -143.43 }],
    ["w69672561", "w69672561", "w69672561", "w69672561", "w69672561", "w69672561", "w69672561"],
    [{ x: 17.05, z: -143.43 }, { x: 20.15, z: -127.07 }],
    [null, null],
  ),
  kosciuszki(
    "zachod-w69672559",
    [{ x: 14.43, z: -143.43 }, { x: 11.9, z: -158.64 }, { x: 12.09, z: -158.79 }, { x: 11.36, z: -162.37 }],
    ["w69672559", "w69672559", "w69672559", "w69672559"],
    [{ x: 13.46, z: -162.37 }, { x: 17.05, z: -143.43 }],
    [null, null],
  ),
  kosciuszki(
    "zachod-w69672557",
    [{ x: 11.36, z: -162.37 }, { x: 7.78, z: -183.32 }],
    ["w69672557", "w69672557"],
    [{ x: 9.24, z: -184.64 }, { x: 13.46, z: -162.37 }],
    ["w288178955", null],
  ),
  // East, from the driveway w536680784's axis to the corner by Peowiaków.
  // w67508887's façade with w67508904's: apart, the corner between them is simplified out of the
  // first piece, a crack along w67508904's north wall.
  kosciuszki(
    "wschod-w67508904",
    [
      { x: 31.38, z: -110.01 },
      { x: 31.43, z: -111.6 },
      { x: 31.59, z: -114.53 },
      { x: 30.79, z: -114.64 },
      { x: 30.24, z: -118.91 },
      { x: 30.42, z: -118.93 },
      { x: 29.05, z: -129.35 },
      { x: 28.86, z: -129.33 },
      { x: 28.3, z: -133.56 },
    ],
    ["w536680784", "w67508887", "w67508887", "w67508904", "w67508904", "w67508904", "w67508904", "w67508904", "w67508904"],
    [{ x: 26.54, z: -133.56 }, { x: 29.37, z: -115.84 }, { x: 29.19, z: -110.05 }],
    [null, "w288178957", "w288178957"],
  ),
  kosciuszki("wschod-w67508881", [{ x: 28.3, z: -133.56 }, { x: 25.71, z: -151.92 }], ["w67508881", "w67508881"], [{ x: 23.6, z: -151.92 }, { x: 26.54, z: -133.56 }], [null, null]),
  kosciuszki(
    "wschod-w67508939",
    [{ x: 25.71, z: -151.92 }, { x: 23.33, z: -167.59 }],
    ["w67508939", "w67508939"],
    [{ x: 21.1, z: -167.59 }, { x: 23.6, z: -151.92 }],
    [null, null],
  ),
  kosciuszki(
    "wschod-w67508949",
    [{ x: 23.33, z: -167.59 }, { x: 19.89, z: -187.59 }, { x: 20.86, z: -190.43 }],
    ["w67508949", null, "w67508949"],
    [{ x: 18.22, z: -190.43 }, { x: 17.79, z: -188.27 }, { x: 21.1, z: -167.59 }],
    ["w288178957", "w288178957", null],
  ),
];

/** A piece of the pavement along the north frontage of Peowiaków (T-221), as `kosciuszki`'s: along the façade west to east, back along the footway's axis. */
const peowiakow = (name: string, wall: readonly Pt[], wallOf: readonly (string | null)[], axis: readonly Pt[], axisOf: readonly (string | null)[]): AddedArea => ({
  id: `T-221/${name}`,
  tags: { "area:highway": "pedestrian", surface: "paving_stones" },
  ring: [...wall, ...axis],
  nodesOf: [...wallOf, ...axisOf],
  reason: "kostka chodnika ul. Peowiaków do fasad na ortofoto PZGiK, w OSM chodnik (linia) kończy się 0,5–1,5 m przed budynkami",
  ref: "T-221",
});

/**
 * The pavement along the north frontage of Peowiaków by the corners with Kościuszki (T-221): the
 * footways w288178955 (west) and w288178957 (east) end 0.5-1.5 m short of the houses there, as on
 * Kościuszki (T-211), and the pieces go on from T-211's at the corners, round the footways' bends.
 * One piece per house, parted on the axis abreast of the houses' corners (off the nodes). The façade
 * jogs the houses' outlines simplify out are left out too: w67508949's by (25.0; -191.7), w67508955's
 * by (58.8; -202.2) (the piece follows the chord the house is drawn with) and its 0.1 m step at the
 * corner with r1207677. The chunk's edge (x 20) cuts w67508949's piece 0.9 m short of the house's
 * corner (20.86; -190.43), which the cut piece then simplifies out, a chord 0.2 m short of the wall:
 * the piece starts on that edge 0.4 m north of the corner instead, under T-211's piece and the wall.
 */
const PEOWIAKOW_AREAS: readonly AddedArea[] = [
  peowiakow(
    "zachod-w69672557",
    [{ x: -17.39, z: -178.45 }, { x: 4.82, z: -185.13 }, { x: 7.78, z: -183.32 }],
    ["w69672557", "w69672557", "w69672557"],
    [{ x: 9.24, z: -184.64 }, { x: 7.53, z: -186.47 }, { x: 4.4, z: -187.32 }, { x: -17.98, z: -180.35 }],
    ["w288178955", "w288178955", "w288178955", null],
  ),
  peowiakow(
    "wschod-w67508949",
    [{ x: 20, z: -190 }, { x: 32.48, z: -193.59 }, { x: 32.51, z: -194.06 }, { x: 36.52, z: -195.3 }],
    [null, "w67508949", "w67508949", "w67508949"],
    [{ x: 35.74, z: -197.59 }, { x: 19.83, z: -192.15 }, { x: 18.22, z: -190.43 }],
    [null, "w288178957", "w288178957"],
  ),
  peowiakow(
    "wschod-r1207677",
    [{ x: 36.52, z: -195.3 }, { x: 36.62, z: -194.96 }, { x: 54.09, z: -200.79 }],
    ["w67508949", "w67508946", "w67508946"],
    [{ x: 53.15, z: -203.55 }, { x: 35.74, z: -197.59 }],
    [null, null],
  ),
  peowiakow(
    "wschod-w67508955",
    [{ x: 54.09, z: -200.79 }, { x: 56.19, z: -201.63 }, { x: 56.77, z: -201.27 }, { x: 61.28, z: -203.28 }],
    ["w67508955", "w67508955", "w67508955", "w67508955"],
    [{ x: 60.34, z: -206.01 }, { x: 53.15, z: -203.55 }],
    [null, null],
  ),
];

/**
 * The pavement by the west wall of w67508886 (T-224): between the footway w288178957's band, the
 * driveway w536680784's axis and the church r5420680, 0.7-1 m left bare. Its north-east corner is
 * off the nodes, 0.1 m east of the house's corner and just inside the church's outline as the chunk
 * simplifies it (a chord 0.1-0.2 m north of its nodes there): on the nodes, the piece's simplified
 * edges left cracks of 1-15 cm along the house's west wall and under the church.
 */
const W67508886_AREA: AddedArea = {
  id: "T-224/chodnik-przy-w67508886",
  tags: { "area:highway": "pedestrian", surface: "paving_stones" },
  ring: [
    { x: 29.19, z: -110.05 },
    { x: 31.38, z: -110.01 },
    { x: 31.39, z: -108.77 },
    { x: 31.3, z: -104.8 },
    { x: 29.72, z: -104.94 },
  ],
  nodesOf: ["w536680784", "w536680784", "w67508886", null, "w67508885"],
  reason: "kostka chodnika ul. Kościuszki do zachodniej ściany budynku w67508886 na ortofoto PZGiK, w OSM chodnik (linia) kończy się 0,7–1 m przed nią",
  ref: "T-224",
};

/** The added areas of this file, in draw order. */
export const CZECHOWICZA_AREAS: readonly AddedArea[] = [...PLAC_AREAS, ...KOSCIUSZKI_AREAS, ...PEOWIAKOW_AREAS, W67508886_AREA];
