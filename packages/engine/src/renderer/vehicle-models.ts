import { VEHICLE_SIZE, type Vec3, type VehicleModel } from "@seki/core";
import { type CityKitData, GeometrySink, hexRgb, swatchUv } from "./city-kit-data";

/**
 * The street's vehicles (ADR-0050) as geometry on the city kit's texture (ADR-0022), in the
 * vehicle's own frame: front +z, wheels on y = 0, centred. The cars are the kit's Car Kit models
 * stretched to real sizes (VEHICLE_SIZE); the trolleybus is procedural, white and green with a
 * red roof like Lublin's, with its two booms up to the wires. Each has a far version of a few
 * boxes. Pure data, no Babylon.
 */

export interface VehicleTemplate {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly uvs: Float32Array;
  readonly colors: Float32Array;
  readonly indices: Uint32Array;
  readonly vertexCount: number;
}

/** The kit's model behind each car. */
export const KIT_CARS: Readonly<Partial<Record<VehicleModel, string>>> = {
  sedan: "car-sedan",
  hatchback: "car-hatchback",
  taxi: "car-taxi",
  van: "car-van",
  delivery: "car-delivery",
};

/** Paints of Lublin 2077: magenta, teal, silver, graphite, amber, oxblood, slate, white, black. */
export const PAINTS = ["#a8255f", "#178a90", "#c4c8d0", "#323a4c", "#d8a640", "#7c2430", "#5a6470", "#e9e9e4", "#1c1e24"] as const;

/** The paint a vehicle's tint seed picks (a trolleybus keeps its livery). */
export const paintOf = (model: VehicleModel, tint: number): number => (model === "trolleybus" ? 0 : (tint >>> 3) % PAINTS.length);

const toTemplate = (sink: GeometrySink): VehicleTemplate => ({
  positions: Float32Array.from(sink.positions),
  normals: Float32Array.from(sink.normals),
  uvs: Float32Array.from(sink.uvs),
  colors: Float32Array.from(sink.colors),
  indices: Uint32Array.from(sink.indices),
  vertexCount: sink.vertexCount,
});

const X: Vec3 = { x: 1, y: 0, z: 0 };
const Y: Vec3 = { x: 0, y: 1, z: 0 };
const Z: Vec3 = { x: 0, y: 0, z: 1 };

/** A box of the vehicle's frame on a swatch, tinted when given (the swatch must be a "tint" one to show it). */
const box = (sink: GeometrySink, data: CityKitData, c: Vec3, half: readonly [number, number, number], swatch: string, tint?: string, axes: readonly [Vec3, Vec3, Vec3] = [X, Y, Z]): void => {
  const from = sink.vertexCount;
  sink.box(c, axes, half, swatchUv(data, swatch));
  if (!tint) return;
  const [r, g, b] = hexRgb(tint);
  for (let v = from; v < sink.vertexCount; v++) sink.colors.splice(v * 4, 3, r, g, b);
};

/** A thin box from `a` to `b` (a boom), `r` thick. */
const rod = (sink: GeometrySink, data: CityKitData, a: Vec3, b: Vec3, r: number, swatch: string): void => {
  const d = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const len = Math.hypot(d.x, d.y, d.z);
  const u = { x: d.x / len, y: d.y / len, z: d.z / len };
  // An axis across the boom, and the third from both.
  const side = { x: 1, y: 0, z: 0 };
  const up = { x: u.y * side.z - u.z * side.y, y: u.z * side.x - u.x * side.z, z: u.x * side.y - u.y * side.x };
  box(sink, data, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 }, [r, r, len / 2], swatch, undefined, [side, up, u]);
};

/** A car of the kit stretched to its real size, its paint in the vertex colour. */
const kitCar = (data: CityKitData, model: VehicleModel, paint: string): VehicleTemplate | null => {
  const key = KIT_CARS[model];
  const m = key ? data.models.get(key) : undefined;
  if (!m) return null;
  const size = VEHICLE_SIZE[model];
  const sink = new GeometrySink();
  // The kit's cars face -z: turned round to face +z.
  sink.addModel(m, { key: m.key, x: 0, y: 0, z: 0, turn: Math.PI, sx: size.width / m.size.x, sy: size.height / m.size.y, sz: size.length / m.size.z, tint: paint });
  return toTemplate(sink);
};

/** Lublin's trolleybus: white over a green skirt, a red roof, dark glass, two booms up to the wires. */
const trolleybus = (data: CityKitData): VehicleTemplate => {
  const sink = new GeometrySink();
  const { width, length } = VEHICLE_SIZE.trolleybus;
  const hw = width / 2;
  const hl = length / 2;
  box(sink, data, { x: 0, y: 1.75, z: 0 }, [hw, 1.15, hl], "paint", "#e8ebe6");
  box(sink, data, { x: 0, y: 0.62, z: 0 }, [hw + 0.01, 0.3, hl + 0.01], "paint", "#1f7a45");
  box(sink, data, { x: 0, y: 1.95, z: -0.3 }, [hw + 0.015, 0.5, hl - 0.5], "glass-dark");
  box(sink, data, { x: 0, y: 1.8, z: hl + 0.01 }, [hw - 0.15, 0.75, 0.02], "glass-blue");
  box(sink, data, { x: 0, y: 2.97, z: 0 }, [hw - 0.08, 0.08, hl - 0.2], "paint", "#b0242c");
  box(sink, data, { x: 0, y: 3.18, z: -1.5 }, [0.8, 0.14, 2.4], "metal");
  for (const sx of [-1, 1]) {
    rod(sink, data, { x: sx * 0.32, y: 3.32, z: 0.8 }, { x: sx * 0.32, y: 6.05, z: -4.6 }, 0.04, "dark");
    box(sink, data, { x: sx * 0.85, y: 0.9, z: hl + 0.02 }, [0.2, 0.09, 0.02], "headlight");
    box(sink, data, { x: sx * 0.95, y: 0.95, z: -hl - 0.02 }, [0.14, 0.12, 0.02], "taillight");
    // 2077: a cyan strip along each side under the windows.
    box(sink, data, { x: sx * (hw + 0.02), y: 1.38, z: 0 }, [0.01, 0.03, hl - 0.6], "neon-cyan");
    for (const z of [-3.9, 3.6]) box(sink, data, { x: sx * (hw - 0.12), y: 0.5, z }, [0.16, 0.5, 0.5], "tyre");
  }
  box(sink, data, { x: 0, y: 2.72, z: hl + 0.02 }, [0.95, 0.15, 0.02], "neon-amber");
  return toTemplate(sink);
};

/** The far vehicle: its body, a cabin, lamps front and back. A few dozen vertices. */
const farVehicle = (data: CityKitData, model: VehicleModel, paint: string): VehicleTemplate => {
  const sink = new GeometrySink();
  const { width, length, height } = VEHICLE_SIZE[model];
  const hw = width / 2;
  const hl = length / 2;
  const bus = model === "trolleybus";
  const body = bus ? "#e8ebe6" : paint;
  const low = bus ? height * 0.92 : height * 0.55;
  box(sink, data, { x: 0, y: 0.25 + low / 2, z: 0 }, [hw, low / 2, hl], "paint", body);
  if (!bus) box(sink, data, { x: 0, y: 0.25 + low + (height - low - 0.25) / 2, z: -hl * 0.1 }, [hw * 0.85, (height - low - 0.25) / 2, hl * 0.55], "glass-dark");
  for (const sx of [-1, 1]) {
    box(sink, data, { x: sx * hw * 0.65, y: 0.7, z: hl + 0.02 }, [0.18, 0.08, 0.02], "headlight");
    box(sink, data, { x: sx * hw * 0.7, y: 0.75, z: -hl - 0.02 }, [0.15, 0.08, 0.02], "taillight");
  }
  return toTemplate(sink);
};

/** The near and far geometry of a model in a paint (index into PAINTS); null for a car the kit lacks. */
export const vehicleTemplates = (data: CityKitData, model: VehicleModel, paint: number): { readonly near: VehicleTemplate; readonly far: VehicleTemplate } | null => {
  const color = PAINTS[paint] ?? PAINTS[0];
  const near = model === "trolleybus" ? trolleybus(data) : kitCar(data, model, color);
  return near ? { near, far: farVehicle(data, model, color) } : null;
};
