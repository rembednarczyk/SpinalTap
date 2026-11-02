import type { Vec3 } from "@seki/core";
import { CAPSULE_CEILING_SLAB, CAPSULE_FLOOR_SLAB, CAPSULE_FURNITURE, CAPSULE_ORIGIN, CAPSULE_WALLS, type StaticProp } from "@seki/sim";
import { type CityKitData, GeometrySink, swatchUv } from "../city-kit-data";
import { type CityProps, addPropToKit, facing, kitUvs } from "../city-props";

/**
 * The capsule room on Jezuicka (ADR-0063 stage 3) as one piece of geometry on the city kit's
 * texture, in the world: the shell the simulation's solids give (`packages/sim/src/content/capsule-room.ts`:
 * the front wall with the door, the side and back walls, the ceiling) and the room's model from
 * `room-props.glb` (tools/city_room.py) standing on the floor, its door side to the south.
 * Without the file the furniture's solids are drawn as boxes instead. Pure data, no Babylon.
 */

/** The model's key in `room-props.glb`. */
export const CAPSULE_MODEL = "room-capsule";

/** Swatches of the shell (the model's own panels are `ac`) and of the boxes drawn without the file. */
const SHELL = { wall: "ac", ceiling: "trim-light", floor: "plant" } as const;
const FURNITURE = ["trim-light", "glass-blue", "fabric-magenta"] as const;

const AXES: readonly [Vec3, Vec3, Vec3] = [
  { x: 1, y: 0, z: 0 },
  { x: 0, y: 1, z: 0 },
  { x: 0, y: 0, z: 1 },
];

const SOUTH: Vec3 = { x: 0, y: 0, z: -1 };
const ONE: Vec3 = { x: 1, y: 1, z: 1 };

/** A solid of the room as a box; `drop` metres lower (the floor under the model's own tiles). */
const addBox = (sink: GeometrySink, data: CityKitData, p: StaticProp, swatch: string, drop = 0): void => {
  if (p.view.kind !== "block") return;
  const s = p.view.size;
  sink.box({ ...p.center, y: p.center.y - drop }, AXES, [s.x / 2, s.y / 2, s.z / 2], swatchUv(data, swatch));
};

/** The floor under the model's tiles, out of their depth (the doorway and the strip along the walls show it). */
const UNDER_TILES = 0.01;

/** The room's geometry, and whether it holds the model (false: boxes in its place). */
export const capsuleGeometry = (data: CityKitData, props: CityProps | null): { readonly sink: GeometrySink; readonly model: boolean } => {
  const sink = new GeometrySink();
  for (const w of CAPSULE_WALLS) addBox(sink, data, w, SHELL.wall);
  addBox(sink, data, CAPSULE_CEILING_SLAB, SHELL.ceiling);
  const m = props?.models.get(CAPSULE_MODEL);
  addBox(sink, data, CAPSULE_FLOOR_SLAB, SHELL.floor, m ? UNDER_TILES : 0);
  if (props && m) {
    // The model's door side faces -Z once parsed (glTF +Z): to the south, where the door is.
    addPropToKit(sink, props, kitUvs(props, data), m, facing(CAPSULE_ORIGIN, SOUTH, ONE));
    return { sink, model: true };
  }
  CAPSULE_FURNITURE.forEach((p, i) => addBox(sink, data, p, FURNITURE[i % FURNITURE.length] ?? "trim-light"));
  return { sink, model: false };
};
