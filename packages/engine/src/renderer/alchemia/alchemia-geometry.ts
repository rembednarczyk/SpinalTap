import type { Vec3 } from "@seki/core";
import { ALCHEMIA_MODULES, type PlacedAlchemiaModule } from "@seki/sim";
import { type CityKitData, GeometrySink, swatchUv } from "../city-kit-data";
import { type CityProps, addPropToKit, facing, kitUvs } from "../city-props";

/**
 * Alchemia on Plac Ofiar Getta (ADR-0063 stage 4) as one piece of geometry on the city kit's
 * texture, in the world: each module of `ALCHEMIA_MODULES` (the simulation's layout) as its model
 * from `alchemia-props.glb` (tools/city_alchemia.py) standing on its floor, its front to its
 * yaw, on a concrete plinth down to the lowest paving under it. Without the file the modules are
 * drawn as boxes of their size instead. Pure data, no Babylon.
 */

/** Swatches of the plinths and of the boxes drawn without the file. */
const PLINTH = "trim-light";
const BOX = "trim";

const UP: Vec3 = { x: 0, y: 1, z: 0 };
const ONE: Vec3 = { x: 1, y: 1, z: 1 };

/** The module's axes in the world: right of its front, up, its front. */
const axesOf = (m: PlacedAlchemiaModule): readonly [Vec3, Vec3, Vec3] => {
  const fx = Math.sin(m.yaw);
  const fz = Math.cos(m.yaw);
  return [{ x: fz, y: 0, z: -fx }, UP, { x: fx, y: 0, z: fz }];
};

/** A box over the module's footprint from world y0 to y1. */
const footprintBox = (sink: GeometrySink, data: CityKitData, m: PlacedAlchemiaModule, y0: number, y1: number, swatch: string): void => {
  sink.box({ x: m.x, y: (y0 + y1) / 2, z: m.z }, axesOf(m), [m.width / 2, (y1 - y0) / 2, m.depth / 2], swatchUv(data, swatch));
};

/** The hall's geometry, and how many modules stand as their models (0: boxes in their place). */
export const alchemiaGeometry = (data: CityKitData, props: CityProps | null, modules: readonly PlacedAlchemiaModule[] = ALCHEMIA_MODULES): { readonly sink: GeometrySink; readonly models: number } => {
  const sink = new GeometrySink();
  const uvs = props ? kitUvs(props, data) : null;
  let models = 0;
  for (const m of modules) {
    footprintBox(sink, data, m, m.base, m.floor, PLINTH);
    const model = props?.models.get(m.key);
    if (props && uvs && model) {
      // The model's front (glTF +Z) faces -Z once parsed: `facing` turns it to the module's yaw.
      addPropToKit(sink, props, uvs, model, facing({ x: m.x, y: m.floor, z: m.z }, axesOf(m)[2], ONE));
      models++;
    } else footprintBox(sink, data, m, m.floor, m.floor + m.height, BOX);
  }
  return { sink, models };
};
