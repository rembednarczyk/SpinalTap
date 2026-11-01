import { doorLayout } from "@seki/core";
import type { KitModel } from "../city-kit-data";
import { type CityProps, type PropXform, addPropToSink, facing } from "../city-props";
import { MeshSink } from "../mesh-sink";
import { type WorldProp, bake, placePoint } from "./prop-batch";
import { DOOR_FRAME, doorSurround, leafHeight, proceduralDoor } from "./prop-door";

/**
 * The doors on the facades (ADR-0058 stage 9) at their place: a door's surround from `prop-door.ts`
 * and its leaf, a model of `door-props.glb` (style `door-<model>`, the user's CC-BY pack and CC0)
 * stretched to the leaf's opening, or the procedural leaf without the file (phones, `low`, and
 * before it loads). Baked into the street furniture's block mesh: vertices, not draw calls.
 */

/** The leaf model of a door's model, or null without the file or the style. */
export const doorModel = (props: CityProps | null, model: string): KitModel | null => props?.byStyle.get(`door-${model}`)?.[0] ?? null;

const surrounds = new Map<number, MeshSink>();

/** The surround of a variant alone, built once per variant. */
const surroundOf = (variant: number): MeshSink => {
  let m = surrounds.get(variant);
  if (!m) {
    m = new MeshSink();
    doorSurround(m, doorLayout(variant));
    surrounds.set(variant, m);
  }
  return m;
};

/** Where a leaf model goes in a door: between the jambs from the sill up, its face at the leaf's. */
export const leafXform = (p: WorldProp, variant: number, m: KitModel): PropXform => {
  const d = doorLayout(variant);
  const w = d.width - 2 * DOOR_FRAME.side;
  const h = leafHeight(d);
  const front = { x: Math.sin(p.yaw), y: 0, z: Math.cos(p.yaw) };
  return facing(placePoint(p, { x: 0, y: 0, z: DOOR_FRAME.leafAt }), front, { x: w / m.size.x, y: h / m.size.y, z: DOOR_FRAME.leafDepth / m.size.z });
};

/** Bakes a door: the procedural one without its leaf model, else the surround and the model. */
export const bakeDoor = (sink: MeshSink, props: CityProps | null, p: WorldProp): void => {
  const variant = p.variant ?? 0;
  const m = doorModel(props, doorLayout(variant).model);
  if (!m || !props) {
    bake(sink, proceduralDoor(variant), p);
    return;
  }
  bake(sink, surroundOf(variant), p);
  addPropToSink(sink, props, m, leafXform(p, variant, m));
};
