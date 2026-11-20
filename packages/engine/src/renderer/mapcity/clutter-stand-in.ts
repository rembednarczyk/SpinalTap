import { CLUTTER_SHAPES } from "@seki/core";
import { MeshSink } from "../mesh-sink";
import { block, paint } from "./prop-kit";

/** The gallery's stand-in of a shape: a box of about its size (the city bakes only the models). */
export const clutterStandIn = (shape: number): MeshSink => {
  const sink = new MeshSink();
  const solid = CLUTTER_SHAPES[shape]?.solid;
  const w = solid ? solid.hx * 2 : 0.5;
  const d = solid ? solid.hz * 2 : 0.4;
  const h = solid ? solid.top : 0.5;
  block(sink, 0, 0, 0, w, h, d, paint("#4a4f57"));
  return sink;
};
