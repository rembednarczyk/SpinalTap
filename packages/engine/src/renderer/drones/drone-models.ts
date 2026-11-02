import type { Vec3 } from "@seki/core";
import { type CityKitData, GeometrySink, swatchUv } from "../city-kit-data";
import { type CityProps, kitUvs, swatchAt } from "../city-props";
import { DRONE_SIZE, type DroneKind } from "./drone-flight";

/**
 * The drones' geometry on the city kit's texture (ADR-0022), in the drone's own frame: front +z,
 * foot on y = 0, centred. Near: the model of its kind from `drone-props.glb` (ADR-0058 stage 7,
 * tools/city_drones.py), or boxes without it; far: a few boxes after the kind's shape, its lights
 * kept, since at night they are what shows. Pure data, no Babylon.
 */

export interface DroneTemplate {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly uvs: Float32Array;
  readonly colors: Float32Array;
  readonly indices: Uint32Array;
  readonly vertexCount: number;
}

const toTemplate = (sink: GeometrySink): DroneTemplate => ({
  positions: Float32Array.from(sink.positions),
  normals: Float32Array.from(sink.normals),
  uvs: Float32Array.from(sink.uvs),
  colors: Float32Array.from(sink.colors),
  indices: Uint32Array.from(sink.indices),
  vertexCount: sink.vertexCount,
});

const AXES: readonly [Vec3, Vec3, Vec3] = [
  { x: 1, y: 0, z: 0 },
  { x: 0, y: 1, z: 0 },
  { x: 0, y: 0, z: 1 },
];

/** Each kind's hull and lights on the kit's swatches. */
const LOOK: Readonly<Record<DroneKind, { readonly hull: string; readonly lights: readonly [string, string] }>> = {
  patrol: { hull: "paint", lights: ["neon-red", "neon-blue"] },
  delivery: { hull: "fabric-amber", lights: ["neon-amber", "neon-amber"] },
  ad: { hull: "dark", lights: ["neon-pink", "neon-cyan"] },
};

/**
 * The far drone, and the near one without the props file: a hull between two fans, the lights on
 * top, the parcel or the screen under it. Some 100 triangles.
 */
export const boxDrone = (data: CityKitData, kind: DroneKind): DroneTemplate => {
  const sink = new GeometrySink();
  const { width, height, length } = DRONE_SIZE[kind];
  const look = LOOK[kind];
  const box = (x: number, y: number, z: number, hx: number, hy: number, hz: number, swatch: string) => sink.box({ x, y, z }, AXES, [hx, hy, hz], swatchUv(data, swatch));
  // The frame: patrols are all frame, the others carry their gear under it.
  const frame = kind === "patrol" ? height : Math.min(height, (width / 3.2) * 0.97);
  const y0 = height - frame;
  const fan = Math.min(length / 2, width / 6);
  box(0, y0 + frame * 0.45, 0, width * 0.1, frame * 0.35, length * 0.45, look.hull);
  for (const sx of [-1, 1]) {
    box(sx * (width / 2 - fan), y0 + frame * 0.4, 0, fan, frame * 0.12, fan, "trim");
    box(sx * width * 0.15, y0 + frame * 0.45, 0, width * 0.1, 0.04, 0.06, "metal");
  }
  box(-0.16, y0 + frame * 0.85, 0, 0.15, 0.04, 0.11, look.lights[0]);
  box(0.16, y0 + frame * 0.85, 0, 0.15, 0.04, 0.11, look.lights[1]);
  if (kind === "delivery") box(0, y0 * 0.45, 0, 0.4, y0 * 0.42, 0.4, "dumpster");
  if (kind === "ad") {
    const face = y0 - 0.3;
    box(0, face / 2, 0, width / 2, face / 2, 0.05, "sign-back");
    for (const [k, s] of ["neon-pink", "neon-cyan", "neon-violet"].entries()) box(0, 0.3 + (k * (face - 0.6)) / 2, 0, width * 0.42, face / 14, 0.06, s);
  }
  return toTemplate(sink);
};

/** The model of a kind from the props, turned to face +z, on the kit's UVs; null when the props lack it. */
export const propsDrone = (data: CityKitData, props: CityProps, kind: DroneKind): DroneTemplate | null => {
  const m = props.models.get(`drone-${kind}`);
  if (!m) return null;
  const sink = new GeometrySink();
  // Props face -z in Babylon space (glTF's +z): turned round.
  sink.addModel(m, { key: m.key, x: 0, y: 0, z: 0, turn: Math.PI, sx: 1, sy: 1, sz: 1, tint: "#ffffff" });
  const uvs = kitUvs(props, data);
  for (let v = 0; v * 2 < m.uvs.length; v++) {
    const uv = uvs[swatchAt(props, m.uvs[v * 2] ?? 0, m.uvs[v * 2 + 1] ?? 0)] ?? [0, 0];
    sink.uvs[v * 2] = uv[0];
    sink.uvs[v * 2 + 1] = uv[1];
  }
  return toTemplate(sink);
};

/** The near and far geometry of each kind: the props' model near when there is one. */
export const droneTemplates = (data: CityKitData, props: CityProps | null): Readonly<Record<DroneKind, { readonly near: DroneTemplate; readonly far: DroneTemplate }>> => {
  const pair = (kind: DroneKind) => {
    const far = boxDrone(data, kind);
    return { near: (props && propsDrone(data, props, kind)) ?? far, far };
  };
  return { patrol: pair("patrol"), delivery: pair("delivery"), ad: pair("ad") };
};
