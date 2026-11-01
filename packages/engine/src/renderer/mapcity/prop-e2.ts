import { MeshSink } from "../mesh-sink";
import { arc, block, glow, paint, path, tube, v3 } from "./prop-kit";
import { bikeRack } from "./prop-street";

/**
 * Procedural street furniture of ADR-0058 stage 2, front +z, foot at the origin, each inside its
 * kind's solid (sim `content/lublin/furniture.ts`): what phones draw (`low`) and every quality before
 * the props files load; the models of `street-props.glb` stand in for them on the others
 * (`street-models.ts`). Free-standing cash machines, fire hydrants, bike racks with the bikes parked
 * across their hoops, food carts and shipping containers.
 */

const DARK = paint("#24272d");
const STEEL = paint("#5f656d");
const TYRE = paint("#18191d");

/** A free-standing cash machine 0.7 x 1.75 x 0.6 m: a dark body, its screen and card slot lit. */
export const atm = (): MeshSink => {
  const sink = new MeshSink();
  block(sink, 0, -0.1, 0, 0.7, 1.85, 0.6, paint("#3a3f4b"));
  block(sink, 0, 1.0, 0.29, 0.56, 0.6, 0.04, DARK);
  sink.box(v3(0, 1.32, 0.315), 0.4, 0.3, 0.01, glow("#7ff3ff"));
  sink.box(v3(0, 0.98, 0.29), 0.5, 0.05, 0.06, paint("#596070"));
  sink.box(v3(0.2, 1.15, 0.315), 0.08, 0.03, 0.01, glow("#00e5ff"));
  return sink;
};

/** A red fire hydrant 0.9 m tall: a column, its cap and two outlets. */
export const hydrant = (): MeshSink => {
  const sink = new MeshSink();
  const red = paint("#a8242c");
  sink.prism(v3(0, -0.1, 0), 0.11, 0.85, 8, red);
  sink.prism(v3(0, 0.75, 0), 0.13, 0.08, 8, red);
  sink.prism(v3(0, 0.83, 0), 0.09, 0.07, 8, DARK, true, 0.04);
  for (const sx of [-1, 1]) tube(sink, v3(0, 0.55, 0), v3(sx * 0.15, 0.55, 0), 0.04, red, 6);
  return sink;
};

/** Where the bikes of a rack stand along its hoops (x), each across them. */
export const RACK_SLOTS = [-0.58, 0.22] as const;

/** What a rack's slots hold, by its shape (`PROP_SHAPES`): bikes, a scooter, nothing. */
export type RackSlot = "bike" | "scooter" | null;
export const RACK_SHAPES: readonly (readonly [RackSlot, RackSlot])[] = [
  ["bike", "bike"],
  ["bike", null],
  [null, "bike"],
  ["bike", "scooter"],
];

/** A bike across the hoops at x: two wheels, the frame and the handlebar (1.65 m long). */
const bike = (sink: MeshSink, x: number): void => {
  const frame = paint("#167a80");
  for (const z of [-0.5, 0.5]) path(sink, arc(v3(x, 0.3, z), v3(0, 0, 1), v3(0, 1, 0), 0.3, 0, Math.PI * 2, 10), 0.025, TYRE, 4);
  path(sink, [v3(x, 0.3, -0.5), v3(x, 0.75, -0.1), v3(x, 0.8, 0.45), v3(x, 0.3, 0.5)], 0.025, frame, 4);
  tube(sink, v3(x, 0.3, -0.5), v3(x, 0.3, 0.05), 0.02, frame, 4);
  tube(sink, v3(x, 0.3, 0.05), v3(x, 0.75, -0.1), 0.02, frame, 4);
  tube(sink, v3(x - 0.25, 0.98, 0.45), v3(x + 0.25, 0.98, 0.45), 0.02, DARK, 4);
  tube(sink, v3(x, 0.8, 0.45), v3(x, 0.98, 0.45), 0.02, DARK, 4);
};

/** The rack's hoops (`bikeRack`) with what its shape parks there; a scooter is a bike on phones. */
export const bikeRackWithBikes = (shape: number): MeshSink => {
  const sink = bikeRack();
  (RACK_SHAPES[shape] ?? RACK_SHAPES[0]!).forEach((slot, i) => {
    if (slot) bike(sink, RACK_SLOTS[i]!);
  });
  return sink;
};

/** A food cart 3.9 x 1.5 m: the counter with its grill, four posts and a tin roof with bulbs under it. */
export const foodCart = (): MeshSink => {
  const sink = new MeshSink();
  block(sink, -0.1, 0.25, 0.05, 3.3, 0.85, 1.0, paint("#9c6a1c"));
  sink.box(v3(-0.1, 1.12, 0.05), 3.2, 0.06, 0.9, STEEL);
  for (const x of [-1.4, -0.6, 0.2, 1.0]) sink.box(v3(x, 1.2, 0.05), 0.5, 0.08, 0.5, glow("#ffb000"));
  for (const x of [-1.6, 1.4]) for (const z of [-0.6, 0.6]) tube(sink, v3(x, 0.2, z), v3(x, 2.5, z), 0.03, DARK, 5);
  sink.box(v3(0, 2.55, 0), 3.9, 0.1, 1.5, paint("#5b3a2c"));
  for (const x of [-1, 0, 1]) sink.box(v3(x, 2.4, 0.4), 0.1, 0.12, 0.1, glow("#fff6d8"));
  for (const x of [-1.5, 1.5]) path(sink, arc(v3(x, 0.17, -0.3), v3(0, 0, 1), v3(0, 1, 0), 0.17, 0, Math.PI * 2, 8), 0.04, TYRE, 4);
  return sink;
};

/** The container colours, as the models of `street-props.glb` (`st-container-rust`, `-dumpster`). */
const CONTAINERS = ["#5b3a2c", "#1f5a52"];

/** A 20 ft shipping container 6.06 x 2.6 x 2.44 m, its colour by its shape, ribbed sides. */
export const container = (shape: number): MeshSink => {
  const sink = new MeshSink();
  const body = paint(CONTAINERS[shape % CONTAINERS.length]!);
  block(sink, 0, -0.1, 0, 6.06, 2.7, 2.44, body);
  for (let i = 0; i < 9; i++) for (const sz of [-1, 1]) sink.box(v3(-2.6 + i * 0.65, 1.3, sz * 1.225), 0.08, 2.3, 0.02, DARK);
  for (const sx of [-1, 1]) for (const z of [-0.3, 0.3]) sink.box(v3(sx * 3.035, 1.3, z), 0.02, 2.3, 0.05, STEEL);
  return sink;
};
