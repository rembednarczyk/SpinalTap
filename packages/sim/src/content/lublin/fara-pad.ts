import type { Pad } from "./shape";

/*
 * Plac po Farze's foundations of St Michael's parish church on one level (the user's proposal of 24.11): the square
 * under the ruin's low walls (`historic=ruins` r18507552 and r18507551, 0.5 m over the paving, `barriers.ts`) levelled
 * to the median of the NMT under them, so every wall's top is at the same height and the church's hologram
 * (`fara-holo.ts`) stands on them as on one plinth. Under the walls the NMT ran from -4.9 m (the north-west chapels) to
 * -2.4 m (the south-west chapel's corner), four in five samples within -4.0..-3.4 m. Pattern: a pad of the terrain's
 * shaping (ADR-0045), as under the set pieces; its row T-347 in `docs/topografia.md`.
 */

/** The level of the square under the foundations (m): the median of the NMT under their walls. */
export const FARA_LEVEL = -3.6;

/** The foundations' walls stand this high over it (`RUIN_WALL_HEIGHT`): the hologram's foot. */
export const FARA_FOUNDATION_TOP = FARA_LEVEL + 0.5;

/**
 * The foundations' masonry on the map (`barriers.ts`): the ruin's two outlines and its seven piers and blocks. Their
 * walls' tops lie level at `FARA_FOUNDATION_TOP` all round (the user's note of 24.11): a piece where the ground falls
 * off the pad stands taller (`world-barriers.ts`), so the hologram meets the foundations everywhere.
 */
/** The ruin's area on the map, "Fundamenty Kościoła Farnego" (`historic=ruins`): the whole foundations' outline. */
export const FARA_RUIN_AREA = "w173519315";

export const FARA_RUIN_IDS: readonly string[] = ["r18507552", "r18507551", "w1348806697", "w1348806700", "w1348806701", "w1348806702", "w1348806706", "w1348806707", "w1348806708"];

/**
 * The convex hull of the foundations' walls (counter-clockwise), 0.5 m out round them, less the south-west wedge (the
 * south-west chapel's corner lies on Archidiakońska's paving, which climbs to it, -2.4 m: its walls stay on the NMT),
 * and pulled in on the north, the east and the south-east so the blend, which on the terrain's 2.5 m grid reaches some
 * 2.5 m past the ring, leaves the footway of Plac Po Farze, the steps of Zaułek Panasa and the pavement south-east of the
 * chancel within 0.2 m of the NMT (the curator's review of 24.11).
 */
const HULL: readonly (readonly [number, number])[] = [
  [659.3, 33.4], [678.9, 26.7], [691.8, 36.6], [694.4, 38.9], [695.0, 40.1], [694.6, 45.0],
  [693.0, 52.6], [691.3, 54.0], [680.8, 57.4], [677.5, 58.3], [671.6, 59.2], [661.7, 57.3], [657.9, 55.8],
];
const MIDDLE = { x: 676, z: 42 } as const;
const OUT = 0.5;
const ring = HULL.map(([x, z]) => {
  const l = Math.hypot(x - MIDDLE.x, z - MIDDLE.z);
  return { x: x + ((x - MIDDLE.x) / l) * OUT, z: z + ((z - MIDDLE.z) / l) * OUT };
});

/** The pad: flat inside the ring, blending into the square over 1.5 m round it (off Archidiakońska and the steps of Zaułek Panasa). */
export const FARA_PAD: Pad = {
  rect: { minX: Math.min(...ring.map((p) => p.x)), maxX: Math.max(...ring.map((p) => p.x)), minZ: Math.min(...ring.map((p) => p.z)), maxZ: Math.max(...ring.map((p) => p.z)) },
  ring,
  y: FARA_LEVEL,
  blend: 1.5,
  row: "T-347",
};
