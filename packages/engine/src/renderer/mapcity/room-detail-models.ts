import { ROOM_DETAIL_SHAPES } from "@seki/core";
import { type CityProps, addPropToSink } from "../city-props";
import type { MeshSink } from "../mesh-sink";
import { pieceXform } from "./market-models";
import type { WorldProp } from "./prop-batch";

/**
 * The rooms' detail of ADR-0098 at its place: a piece of kind `room-detail` is the model of
 * `room-detail-props.glb` its shape names (`ROOM_DETAIL_SHAPES`), built by Blender after the room's card
 * (`docs/pomieszczenia/`), baked into the street furniture's block mesh like the other props: vertices,
 * not draw calls. Nothing before the file loads; the room's solids (the simulation's blocks) stay
 * without a view. On every quality: the furniture of a room is what a walker meets.
 */
export const bakeRoomDetail = (sink: MeshSink, props: CityProps | null, p: WorldProp): void => {
  const key = ROOM_DETAIL_SHAPES[p.shape]?.key;
  const model = key && props ? props.models.get(key) : undefined;
  if (model) addPropToSink(sink, props!, model, pieceXform(p));
};
