import { SITE_CRANE, siteCraneLayout } from "@seki/core";
import { MeshSink, type Rgba } from "../../mesh-sink";
import { glow, paint, tube, v3 } from "../prop-kit";
import { ADS, GRAPHITE, GRAPHITE_LIGHT, HAZARD, LEDS, STEEL, facing, slab } from "./site-slab";

/**
 * The tower crane of a building site (ADR-0087 step 4, stage 2) in its own frame: the mast's foot
 * at the origin on a concrete base, its jib along local +x, the counter-jib with its weights the
 * other way, the cab by the slewing ring, the tower head with its ties, the trolley and the hook
 * halfway out. A neon strip along the jib's top chord, a developer's hologram on the weights. The
 * beacon on the head blinks in the map's signs' mesh (`site-signs.ts`), not here.
 */

const CONCRETE = paint("#6d6b66");
const CAB = paint("#e8e4d8");
const CAB_GLASS = glow("#9fe8ff");
const FLAT = { rise: 0, length: 1 };

/** The mast's chords' half spacing, the lattice's bay, the tube's radius (m). */
const HALF = SITE_CRANE.mast - 0.05;
const BAY = 2.5;
const CHORD = 0.07;
const LACE = 0.035;
/** How far under the top the jib's bottom chords hang, and the jib's depth (m). */
export const CRANE_HEAD = 4.5;
const JIB_DEPTH = 1.4;
const JIB_HALF = 0.6;

/** The height of the slewing ring's top: the jib's bottom chords, for a crane of `height`. */
export const jibLevel = (height: number): number => height - CRANE_HEAD + 0.6;

const beam = (sink: MeshSink, a: readonly [number, number, number], b: readonly [number, number, number], r: number, color: Rgba): void =>
  tube(sink, v3(a[0], a[1], a[2]), v3(b[0], b[1], b[2]), r, color, 4);

/** The mast's lattice from the base up to `top`: four chords, a ring and a diagonal on each face every bay. */
const mast = (sink: MeshSink, top: number): void => {
  const c = [
    [-HALF, -HALF],
    [HALF, -HALF],
    [HALF, HALF],
    [-HALF, HALF],
  ] as const;
  for (const [x, z] of c) beam(sink, [x, 0.9, z], [x, top, z], CHORD, HAZARD);
  const bays = Math.max(1, Math.floor((top - 0.9) / BAY));
  for (let k = 0; k <= bays; k++) {
    const y = 0.9 + ((top - 0.9) * k) / bays;
    for (let i = 0; i < 4; i++) {
      const [a, b] = [c[i]!, c[(i + 1) % 4]!];
      beam(sink, [a[0], y, a[1]], [b[0], y, b[1]], LACE, HAZARD);
      if (k < bays) {
        const y1 = 0.9 + ((top - 0.9) * (k + 1)) / bays;
        const [p, q] = k % 2 === 0 ? [a, b] : [b, a];
        beam(sink, [p[0], y, p[1]], [q[0], y1, q[1]], LACE, HAZARD);
      }
    }
  }
};

/** The jib's triangular lattice from x0 to x1 at `y`: two bottom chords, the top chord, a bay's lacing. */
const jib = (sink: MeshSink, x0: number, x1: number, y: number): void => {
  const top = y + JIB_DEPTH;
  for (const z of [-JIB_HALF, JIB_HALF]) beam(sink, [x0, y, z], [x1, y, z], CHORD, HAZARD);
  beam(sink, [x0, top, 0], [x1, top, 0], CHORD, HAZARD);
  const bays = Math.max(1, Math.round((x1 - x0) / BAY));
  for (let k = 0; k <= bays; k++) {
    const x = x0 + ((x1 - x0) * k) / bays;
    beam(sink, [x, y, -JIB_HALF], [x, y, JIB_HALF], LACE, HAZARD);
    for (const z of [-JIB_HALF, JIB_HALF]) {
      beam(sink, [x, y, z], [x, top, 0], LACE, HAZARD);
      if (k < bays) beam(sink, [x, y, z], [x + (x1 - x0) / bays, top, 0], LACE, HAZARD);
    }
  }
  // The neon strip along the top chord, the city's magenta.
  beam(sink, [x0, top + 0.09, 0], [x1, top + 0.09, 0], 0.035, LEDS[1]!);
};

/** The crane of a variant (`siteCraneLayout`): its height, its jib's length. */
export const craneModel = (variant: number): MeshSink => {
  const c = siteCraneLayout(variant);
  const sink = new MeshSink();
  const y = jibLevel(c.height);
  const counter = Math.max(6, c.jib * SITE_CRANE.counter);
  // The base, the mast and the slewing ring.
  slab(sink, FLAT, -SITE_CRANE.base, SITE_CRANE.base, -SITE_CRANE.base, SITE_CRANE.base, 0, 0.9, CONCRETE);
  mast(sink, y - 0.6);
  slab(sink, FLAT, -1, 1, -1, 1, y - 0.6, y, STEEL);
  // The cab on the jib's side, its glass to the tip.
  slab(sink, FLAT, 0.1, 1.9, JIB_HALF + 0.1, JIB_HALF + 1.9, y - 0.4, y + 1.6, CAB);
  slab(sink, FLAT, 1.9, 1.92, JIB_HALF + 0.3, JIB_HALF + 1.7, y + 0.3, y + 1.4, CAB_GLASS);
  jib(sink, 0.8, c.jib, y);
  // The counter-jib: two chords, its walkway and the weights at its end with the developer's hologram.
  for (const z of [-JIB_HALF, JIB_HALF]) beam(sink, [-0.8, y + 0.2, z], [-counter, y + 0.2, z], CHORD, HAZARD);
  slab(sink, FLAT, -counter, -0.8, -JIB_HALF + 0.1, JIB_HALF - 0.1, y + 0.05, y + 0.25, GRAPHITE_LIGHT);
  slab(sink, FLAT, -counter, -counter + 2.4, -1, 1, y - 1.6, y + 0.25, GRAPHITE);
  facing(sink, FLAT, 1.005, -counter + 0.2, -counter + 2.2, y - 1.4, y + 0.05, ADS[0]![0]);
  facing(sink, FLAT, -1.005, -counter + 0.2, -counter + 2.2, y - 1.4, y + 0.05, ADS[1]![0], -1);
  beam(sink, [-0.8, y + 0.35, 0], [-counter, y + 0.35, 0], 0.035, LEDS[0]!);
  // The tower head and its ties to the jib and the counter-jib.
  const apex: readonly [number, number, number] = [0, c.height, 0];
  for (const [x, z] of [
    [-0.6, -0.6],
    [0.6, -0.6],
    [0.6, 0.6],
    [-0.6, 0.6],
  ] as const)
    beam(sink, [x, y + JIB_DEPTH, z], apex, CHORD, HAZARD);
  beam(sink, apex, [c.jib * 0.62, y + JIB_DEPTH, 0], 0.03, STEEL);
  beam(sink, apex, [-counter + 1, y + 0.25, 0], 0.03, STEEL);
  // The trolley, the rope and the hook block halfway out, over the site.
  const tx = c.jib * 0.45;
  slab(sink, FLAT, tx - 0.5, tx + 0.5, -JIB_HALF, JIB_HALF, y - 0.35, y - 0.05, STEEL);
  beam(sink, [tx, y - 0.35, 0], [tx, 6.4, 0], 0.025, GRAPHITE);
  slab(sink, FLAT, tx - 0.3, tx + 0.3, -0.25, 0.25, 5.6, 6.4, HAZARD);
  return sink;
};
