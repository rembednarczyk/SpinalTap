import { ROOM_DETAIL_SHAPES } from "@seki/core";
import type { RenderQuality } from "../../npr/quality";
import { type CityProps, addPropToSink } from "../city-props";
import type { MeshSink } from "../mesh-sink";
import { pieceXform } from "./market-models";
import type { WorldProp } from "./prop-batch";

/**
 * The rooms' detail of ADR-0098 at its place: a piece of kind `room-detail` is the model of
 * `room-detail-props.glb` its shape names (`ROOM_DETAIL_SHAPES`), built by Blender after the room's card
 * (`docs/pomieszczenia/`), baked into the street furniture's block mesh like the other props: vertices,
 * not draw calls. Nothing before the file loads; the room's solids (the simulation's blocks) stay
 * without a view. On every quality the furniture of a room, what a walker meets; its small detail (`fine`) not on
 * the phones, as the fine decals and most clutter (W-3's budget on a phone, `npr-perf`).
 */
export const bakeRoomDetail = (sink: MeshSink, props: CityProps | null, p: WorldProp, quality: RenderQuality): void => {
  const shape = ROOM_DETAIL_SHAPES[p.shape];
  if (!shape || (quality === "low" && shape.fine)) return;
  const model = props ? props.models.get(quality === "low" && shape.lod ? shape.lod : shape.key) : undefined;
  if (model) addPropToSink(sink, props!, model, pieceXform(p));
};
