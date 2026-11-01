import { MeshSink } from "../mesh-sink";
import { block, blob, glow, paint, pyramid, v3 } from "./prop-kit";

/**
 * Procedural market furniture of ADR-0058 stage 3, front +z, foot at the origin, each inside its
 * kind's solid (sim `content/lublin/furniture.ts`): what phones draw (`low`) and every quality
 * before the props files load; the models of `market-props.glb` stand in for them on the others
 * (`market-models.ts`). The stock beside the market's stalls and the food booths (yatai) in front
 * of the fast-food venues.
 */

const WOOD = paint("#7b5537");
const PALLET = paint("#8a6a45");
const CARTON = paint("#9c6a1c");
const DARK = paint("#24272d");

/** A pallet 1.2 x 0.8 m (`block` slats on three runners). */
const pallet = (sink: MeshSink, y = 0): void => {
  for (const x of [-0.5, 0, 0.5]) block(sink, x, y, 0, 0.1, 0.1, 0.8, PALLET);
  for (const z of [-0.3, 0, 0.3]) block(sink, 0, y + 0.1, z, 1.2, 0.04, 0.16, PALLET);
};

/** Cartons on a pallet: the stock's shape 0, 1.2 x 1.0 x 0.8 m. */
const cartons = (sink: MeshSink): void => {
  pallet(sink);
  block(sink, -0.3, 0.14, 0, 0.56, 0.42, 0.76, CARTON);
  block(sink, 0.3, 0.14, 0, 0.56, 0.42, 0.76, CARTON);
  block(sink, -0.15, 0.56, 0.05, 0.6, 0.38, 0.6, paint("#a8773a"));
};

/** Two barrels and a third smaller one: shape 1, 1.24 x 0.95 x 0.64 m. */
const barrels = (sink: MeshSink): void => {
  for (const [x, c] of [
    [-0.31, "#2c6d8a"],
    [0.31, "#c8452f"],
  ] as const) {
    sink.prism(v3(x, 0, 0), 0.3, 0.95, 10, paint(c));
    for (const y of [0.25, 0.7]) sink.prism(v3(x, y, 0), 0.31, 0.05, 10, DARK, false);
  }
};

/** Crates of produce, two stacked and one beside: shape 2, 1.1 x 0.9 x 0.8 m. */
const crates = (sink: MeshSink): void => {
  const produce = ["#a8c94a", "#c84a3a", "#d9a33a"];
  [
    [-0.27, 0],
    [0.27, 0],
    [-0.27, 0.42],
  ].forEach(([x, y], k) => {
    block(sink, x!, y!, 0, 0.52, 0.4, 0.78, WOOD);
    blob(sink, v3(x!, y! + 0.4, 0), 0.22, 0.06, 0.34, paint(produce[k]!), 6, 2);
  });
};

/** Goods under a canvas on four posts: shape 3, 1.4 x 1.4 x 1.0 m. */
const covered = (sink: MeshSink): void => {
  block(sink, -0.25, 0, 0, 0.7, 0.6, 0.8, CARTON);
  sink.prism(v3(0.38, 0, 0.1), 0.24, 0.8, 8, paint("#2c6d8a"));
  for (const x of [-0.66, 0.66]) for (const z of [-0.46, 0.46]) block(sink, x, 0, z, 0.05, 1.3, 0.05, DARK);
  sink.box(v3(0, 1.32, 0), 1.4, 0.04, 1.0, paint("#167a80"));
  pyramid(sink, v3(0, 1.34, 0), 1.4, 1.0, 0.06, paint("#167a80"));
};

const GOODS = [cartons, barrels, crates, covered];

/** The market's stock by shape (sim `MARKET_GOODS`). */
export const marketGoods = (shape: number): MeshSink => {
  const sink = new MeshSink();
  (GOODS[shape] ?? cartons)(sink);
  return sink;
};

const NOREN = ["#8e2457", "#167a80", "#9c6a1c"];

/**
 * A food booth (yatai) 2.1 m wide in the frame of sim `FOOD_STALL`: the counter, a roof on four
 * posts, a noren of cloth strips along the roof's front, two lit lanterns and three stools.
 */
export const foodStall = (): MeshSink => {
  const sink = new MeshSink();
  block(sink, 0, -0.1, 0.1, 2.1, 1.05, 0.6, WOOD);
  sink.box(v3(0, 1.0, 0.12), 2.2, 0.06, 0.7, paint("#a07b55"));
  for (const x of [-1.05, 1.05]) for (const z of [-0.7, 0.4]) block(sink, x, -0.1, z, 0.08, 2.5, 0.08, DARK);
  sink.box(v3(0, 2.42, -0.15), 2.4, 0.06, 1.6, paint("#5b3a2c"));
  pyramid(sink, v3(0, 2.45, -0.15), 2.4, 1.6, 0.3, paint("#5b3a2c"));
  // The noren: four strips hanging from the roof's front edge over the counter.
  for (let i = 0; i < 4; i++) sink.box(v3(-0.81 + i * 0.54, 2.12, 0.62), 0.5, 0.56, 0.02, paint(NOREN[i % NOREN.length]!));
  for (const x of [-0.85, 0.85]) blob(sink, v3(x, 1.95, 0.6), 0.13, 0.17, 0.13, glow("#ff4040"), 6, 3);
  sink.box(v3(0, 1.1, 0.0), 0.5, 0.12, 0.3, paint("#3a3d42"));
  for (const x of [-0.65, 0, 0.65]) {
    sink.prism(v3(x, 0, 0.85), 0.04, 0.7, 5, DARK);
    sink.prism(v3(x, 0.7, 0.85), 0.17, 0.05, 8, paint("#c8452f"));
  }
  return sink;
};
