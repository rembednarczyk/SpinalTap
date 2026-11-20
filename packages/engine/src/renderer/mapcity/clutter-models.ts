import { CLUTTER, CLUTTER_SHAPES } from "@seki/core";
import type { RenderQuality } from "../../npr/quality";
import { type CityProps, addPropToSink } from "../city-props";
import { MeshSink } from "../mesh-sink";
import { pieceXform } from "./market-models";
import type { WorldProp } from "./prop-batch";
import { block, paint } from "./prop-kit";

/**
 * The odds and ends of ADR-0096 at their place: a piece of kind `clutter` is the model of
 * `extra-props.glb` its shape names (`CLUTTER_SHAPES`), baked into the street furniture's block mesh
 * like the other props: vertices, not draw calls. Nothing before the file loads. The phones keep only
 * the cash machines in the walls (LOD by quality, `docs/zasady-lokacji.md` §9): the bags and boxes
 * at the backs of the restaurants are detail they do without.
 */
export const bakeClutter = (sink: MeshSink, props: CityProps | null, p: WorldProp, quality: RenderQuality): void => {
  if (!props || (quality === "low" && p.shape !== CLUTTER.atmWall)) return;
  const key = CLUTTER_SHAPES[p.shape]?.key;
  const model = key ? props.models.get(key) : undefined;
  if (model) addPropToSink(sink, props, model, pieceXform(p));
};

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
