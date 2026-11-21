import { CLUTTER, CLUTTER_SHAPES, SITE_CLUTTER_FROM } from "@seki/core";
import type { RenderQuality } from "../../npr/quality";
import { type CityProps, addPropToSink } from "../city-props";
import type { MeshSink } from "../mesh-sink";
import { pieceXform } from "./market-models";
import type { WorldProp } from "./prop-batch";

/**
 * The odds and ends of ADR-0096 at their place: a piece of kind `clutter` is the model of
 * `extra-props.glb` its shape names (`CLUTTER_SHAPES`), baked into the street furniture's block mesh
 * like the other props: vertices, not draw calls. Nothing before the file loads. The phones keep only
 * the cash machines in the walls and the building sites' cones and barriers, which are solids a
 * walker meets (LOD by quality, `docs/zasady-lokacji.md` §9): the bags and boxes at the backs of
 * the restaurants are detail they do without.
 */
export const bakeClutter = (sink: MeshSink, props: CityProps | null, p: WorldProp, quality: RenderQuality): void => {
  if (!props || (quality === "low" && p.shape !== CLUTTER.atmWall && p.shape < SITE_CLUTTER_FROM)) return;
  const key = CLUTTER_SHAPES[p.shape]?.key;
  const model = key ? props.models.get(key) : undefined;
  if (model) addPropToSink(sink, props, model, pieceXform(p));
};
