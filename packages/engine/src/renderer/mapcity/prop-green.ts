import { MeshSink } from "../mesh-sink";
import { blob, block, glow, paint, ring, tube, v3 } from "./prop-kit";
import { TREE_SHAPE } from "./prop-shapes";

/**
 * Greenery of the street furniture (ADR-0047): five tree silhouettes of the centre's lime
 * trees, maples and horse chestnuts and of the oaks and poplars OSM names (G-423; low-poly crowns
 * with smooth normals, so the ink draws only their outline), shrubs, the deptak's planters and the
 * double flower baskets on the lamps.
 */

const BARK = paint("#4a3a2f");
const SENSOR = glow("#3ce0ff");

/** Crowns as (x, y, z, rx, ry, rz, colour) per species. */
const CROWNS: Readonly<Record<number, readonly (readonly [number, number, number, number, number, number, string])[]>> = {
  [TREE_SHAPE.lime]: [
    [0, 6.3, 0, 2.3, 3.3, 2.3, "#3f6b39"],
    [1.3, 7.1, 0.6, 1.4, 1.8, 1.4, "#4a7a41"],
    [-1.2, 5.6, -0.7, 1.5, 1.7, 1.5, "#457338"],
    [0.3, 8.7, -0.3, 1.1, 1.0, 1.1, "#4f8044"],
  ],
  [TREE_SHAPE.maple]: [
    [0, 5.4, 0, 2.9, 2.4, 2.9, "#4f7e3c"],
    [1.7, 6.1, 0.5, 1.7, 1.6, 1.7, "#5a8a43"],
    [-1.5, 6.0, -0.6, 1.8, 1.6, 1.8, "#47753a"],
    [0.2, 7.0, -0.2, 1.7, 1.4, 1.7, "#568541"],
  ],
  [TREE_SHAPE.chestnut]: [
    [0, 5.5, 0, 3.4, 2.5, 3.3, "#365f33"],
    [0, 6.9, 0, 2.3, 1.7, 2.3, "#3e6a38"],
    [1.9, 5.0, 0.9, 1.4, 1.2, 1.4, "#33592f"],
  ],
  // The pedunculate oaks of Plac Litewski: a broad, low, spreading dome, wider than it is tall.
  [TREE_SHAPE.oak]: [
    [0, 6.2, 0, 3.9, 2.4, 3.7, "#3a5f32"],
    [2.7, 5.6, 0.8, 1.8, 1.5, 1.8, "#43693a"],
    [-2.6, 5.8, -0.9, 1.9, 1.5, 1.8, "#365a30"],
    [0.5, 5.4, -2.7, 1.7, 1.4, 1.7, "#3f6436"],
    [-0.6, 5.5, 2.6, 1.7, 1.3, 1.7, "#466c3b"],
    [-0.2, 8.3, 0.3, 2.3, 1.3, 2.2, "#4a723e"],
  ],
  // An old black or white poplar (the "Baobab"): a tall, loose, uneven crown of greyish green.
  [TREE_SHAPE.poplar]: [
    [0, 7.0, 0, 2.6, 3.4, 2.5, "#5b7f45"],
    [1.6, 8.4, 0.5, 1.6, 2.1, 1.5, "#6a8d50"],
    [-1.5, 6.3, -0.6, 1.6, 1.9, 1.6, "#557a40"],
    [0.4, 6.0, 1.6, 1.4, 1.6, 1.4, "#62874a"],
    [-0.2, 10.3, -0.1, 1.3, 1.5, 1.3, "#6f9455"],
  ],
};

/** A limb from the trunk into the crown: from `dy` under the trunk's top to (x, top + up, z), of radius r. */
type Limb = readonly [dy: number, x: number, up: number, z: number, r: number];

/** A species' trunk: its height to the crown, its radius, the far tree's square trunk and the limbs. */
interface Trunk {
  readonly h: number;
  readonly r: number;
  readonly far: number;
  readonly limbs: readonly Limb[];
}

const TWO_LIMBS: readonly Limb[] = [
  [0.4, 0.8, 1.1, 0.3, 0.09],
  [0.6, -0.7, 0.9, -0.4, 0.08],
];

const TRUNK: Readonly<Record<number, Trunk>> = {
  [TREE_SHAPE.lime]: { h: 3.6, r: 0.26, far: 0.3, limbs: TWO_LIMBS },
  [TREE_SHAPE.maple]: { h: 3.3, r: 0.26, far: 0.3, limbs: TWO_LIMBS },
  [TREE_SHAPE.chestnut]: { h: 3.1, r: 0.26, far: 0.3, limbs: TWO_LIMBS },
  // A short, thick bole branching low into four heavy limbs (the simulation's trunk: `TREE_GIRTH`).
  [TREE_SHAPE.oak]: {
    h: 2.8,
    r: 0.42,
    far: 0.5,
    limbs: [
      [0.3, 2.0, 1.4, 0.6, 0.16],
      [0.5, -1.9, 1.2, -0.7, 0.15],
      [0.2, 0.5, 1.6, -1.8, 0.14],
      [0.4, -0.4, 1.5, 1.7, 0.13],
    ],
  },
  [TREE_SHAPE.poplar]: {
    h: 3.4,
    r: 0.45,
    far: 0.52,
    limbs: [
      [0.4, 1.0, 1.6, 0.3, 0.15],
      [0.6, -0.9, 1.4, -0.5, 0.14],
      [0.3, 0.2, 2.0, -0.9, 0.12],
    ],
  },
};

const trunkOf = (shape: number): Trunk => TRUNK[shape] ?? TRUNK[TREE_SHAPE.lime]!;

export const tree = (shape: number): MeshSink => {
  const sink = new MeshSink();
  const { h, r, limbs } = trunkOf(shape);
  sink.prism(v3(0, -0.3, 0), r, h + 0.3, 7, BARK, false, 0.15);
  for (const [dy, x, up, z, lr] of limbs) tube(sink, v3(0, h - dy, 0), v3(x, h + up, z), lr, BARK, 5, 0.05);
  for (const [x, y, z, rx, ry, rz, c] of CROWNS[shape] ?? CROWNS[0]!) blob(sink, v3(x, y, z), rx, ry, rz, paint(c), 8, 5);
  // 2077: sensor bands on the city's maples.
  if (shape === TREE_SHAPE.maple) ring(sink, v3(0, 1.35, 0), 0.25, 0.025, SENSOR, 10);
  return sink;
};

/** The far tree: a trunk and one crown, a fraction of the vertices. */
export const farTree = (shape: number): MeshSink => {
  const sink = new MeshSink();
  const { h, far } = trunkOf(shape);
  sink.box(v3(0, h / 2 - 0.15, 0), far, h + 0.3, far, BARK, { bottom: false });
  const c = (CROWNS[shape] ?? CROWNS[0]!)[0]!;
  blob(sink, v3(c[0], c[1] + 0.4, c[2]), c[3] * 1.05, c[4] * 1.15, c[5] * 1.05, paint(c[6]), 5, 3);
  return sink;
};

export const shrubs = (): MeshSink => {
  const sink = new MeshSink();
  blob(sink, v3(0, 0.55, 0), 0.9, 0.7, 0.8, paint("#3b6936"), 7, 4);
  blob(sink, v3(0.7, 0.45, 0.3), 0.6, 0.55, 0.6, paint("#467640"), 6, 3);
  blob(sink, v3(-0.6, 0.4, -0.25), 0.55, 0.5, 0.55, paint("#356232"), 6, 3);
  return sink;
};

/** A concrete planter of the deptak with greenery; 2077: violet hydroponic light along its rim. */
export const planter = (): MeshSink => {
  const sink = new MeshSink();
  block(sink, 0, -0.2, 0, 1.2, 0.8, 1.2, paint("#8b8d89"));
  blob(sink, v3(0, 0.75, 0), 0.62, 0.42, 0.62, paint("#4d7f3f"), 7, 4);
  blob(sink, v3(0.2, 0.95, -0.1), 0.25, 0.25, 0.25, paint("#d4487c"), 5, 3);
  const lit = glow("#b06bff");
  for (const [x, z, w, d] of [
    [0, 0.6, 1.22, 0.03],
    [0, -0.6, 1.22, 0.03],
    [0.6, 0, 0.03, 1.22],
    [-0.6, 0, 0.03, 1.22],
  ] as const) {
    sink.box(v3(x, 0.61, z), w, 0.025, d, lit);
  }
  return sink;
};

/** Double flower baskets on a lamp post at about 2.9 m (180 baskets on 90 lamps in the centre). */
export const hangingBasket = (): MeshSink => {
  const sink = new MeshSink();
  const iron = paint("#17191d");
  tube(sink, v3(-0.42, 3.3, 0), v3(0.42, 3.3, 0), 0.015, iron, 4);
  for (const sx of [-1, 1]) {
    tube(sink, v3(sx * 0.36, 3.3, 0), v3(sx * 0.36, 3.05, 0), 0.01, iron, 3);
    blob(sink, v3(sx * 0.36, 2.92, 0), 0.3, 0.16, 0.3, paint("#3a3226"), 6, 3);
    blob(sink, v3(sx * 0.36, 3.02, 0), 0.34, 0.2, 0.34, paint(sx > 0 ? "#e2457c" : "#f06a3a"), 7, 4);
    blob(sink, v3(sx * 0.36, 2.86, 0), 0.26, 0.24, 0.26, paint("#4c7d3d"), 6, 3);
  }
  return sink;
};
