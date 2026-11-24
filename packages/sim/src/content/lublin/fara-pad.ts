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
 * The convex hull of the foundations' walls (counter-clockwise), 0.5 m out round them, less the south-west wedge: the
 * south-west chapel's corner lies on Archidiakońska's paving, which climbs to it (-2.4 m), so its walls stay on the NMT.
 */
const HULL: readonly (readonly [number, number])[] = [
  [658.0, 32.5], [678.5, 25.8], [692.3, 35.8], [695.0, 38.7], [695.7, 40.1], [695.3, 45.0],
  [693.5, 53.1], [691.3, 54.0], [680.8, 58.0], [677.5, 59.0], [671.6, 60.0], [661.7, 57.9], [657.7, 56.3],
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
