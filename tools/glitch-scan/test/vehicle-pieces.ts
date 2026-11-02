import { readFileSync } from "node:fs";
import { VEHICLE_MODELS, VEHICLE_SIZE, type VehicleModel } from "../../../packages/core/src";
import { parseCityKit } from "../../../packages/engine/src/renderer/city-kit-data";
import { kitUvs, parseCityProps } from "../../../packages/engine/src/renderer/city-props";
import { type VehicleTemplate, paintOf, vehicleTemplates } from "../../../packages/engine/src/renderer/vehicle-models";
import { VEHICLE_VARIANTS, type VehicleVariant, pickVariant } from "../../../packages/engine/src/renderer/vehicle-variants";
import type { ParkedCar } from "../../../packages/sim/src/content/parked-cars";

/**
 * The street's vehicles of ADR-0058 stage 4 as the renderer draws them, against the bodies the
 * simulation gives them (`VEHICLE_SIZE`: what the player bumps into and hides behind). A look is
 * a model fitted to a body; a look that leaves part of its body bare, reaches out of it or hangs
 * above the road is a glitch wherever such a vehicle stands. Every parked car of the city is
 * checked in the look its seed picks (near, far and on the phone), and every look once for the
 * traffic, whose seeds come as it drives. With the file loaded, as the game draws them: the
 * fallbacks before it loads (the kit's cars with the boxes far away, the procedural trolleybus)
 * are not looks.
 */

type Finding = { readonly at: string; readonly what: string };
export type VehicleLod = "near" | "far" | "lite";

/** How far a look may reach out of its body's footprint (m): the trolleybus's neon strips stand 3 cm off its sides. */
const OUT = 0.02;
const OUT_TROLLEY = 0.04;
/** The share of its body's length and width a look must cover. */
const COVER_LENGTH = 0.97;
const COVER_WIDTH = 0.9;
/** How far its lowest point may stand off the road (m). */
const OFF_ROAD = 0.05;

const extent = (t: VehicleTemplate) => {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < t.positions.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k]!, t.positions[i + k]!);
      max[k] = Math.max(max[k]!, t.positions[i + k]!);
    }
  }
  return { min: min as [number, number, number], max: max as [number, number, number] };
};

/** What is wrong with a drawn vehicle in its own frame against its body, by check; empty when nothing. */
export const vehicleFaults = (model: VehicleModel, lod: VehicleLod, t: VehicleTemplate): Partial<Record<"vehicle-off-body" | "vehicle-short-of-body" | "vehicle-floating", string>> => {
  const { width, length, height } = VEHICLE_SIZE[model];
  const { min, max } = extent(t);
  const out: Partial<Record<"vehicle-off-body" | "vehicle-short-of-body" | "vehicle-floating", string>> = {};
  const reach = model === "trolleybus" ? OUT_TROLLEY : OUT;
  // The trolleybus's booms rise to the wires above its body.
  const top = model === "trolleybus" && lod !== "far" ? Infinity : height + 0.01;
  if (Math.max(-min[0], max[0]) > width / 2 + reach || Math.max(-min[2], max[2]) > length / 2 + reach || max[1] > top) {
    out["vehicle-off-body"] = `${lod} x ${min[0].toFixed(2)}..${max[0].toFixed(2)}, z ${min[2].toFixed(2)}..${max[2].toFixed(2)}, top ${max[1].toFixed(2)} for ${width} x ${length} x ${height}`;
  }
  if (max[2] - min[2] < length * COVER_LENGTH || max[0] - min[0] < width * COVER_WIDTH) {
    out["vehicle-short-of-body"] = `${lod} ${(max[0] - min[0]).toFixed(2)} x ${(max[2] - min[2]).toFixed(2)} for ${width} x ${length}`;
  }
  if (min[1] > OFF_ROAD || min[1] < -0.01) out["vehicle-floating"] = `${lod} lowest at ${min[1].toFixed(2)} m`;
  return out;
};

const file = (name: string): ArrayBuffer => {
  const b = readFileSync(new URL(`../../../packages/app/public/city/${name}`, import.meta.url));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};

/** The checks of the vehicles' looks over the city's parked cars and the traffic's looks. */
export const vehicleChecks = (parked: readonly ParkedCar[]): Record<string, () => Finding[]> => {
  let memo: Map<string, Partial<Record<string, string>>> | null = null;
  const kit = parseCityKit(file("city-kit.glb"));
  const props = parseCityProps(file("vehicle-props.glb"));
  const look = { data: props, uvs: kitUvs(props, kit) };
  const has = (k: string) => kit.models.has(k) || props.models.has(k);
  const keyOf = (model: VehicleModel, v: VehicleVariant | null) => `${model}:${v?.key ?? "procedural"}`;
  /** The faults of every look of every body, near, far and on the phone. */
  const faults = (): Map<string, Partial<Record<string, string>>> => {
    if (memo) return memo;
    memo = new Map();
    for (const model of VEHICLE_MODELS) {
      for (const variant of VEHICLE_VARIANTS[model]) {
        const pair = vehicleTemplates(kit, model, 0, { props: look, variant });
        const lite = vehicleTemplates(kit, model, 0, { props: look, variant, lite: true });
        if (!pair || !lite) continue;
        memo.set(keyOf(model, variant), { ...vehicleFaults(model, "far", pair.far), ...vehicleFaults(model, "lite", lite.near), ...vehicleFaults(model, "near", pair.near) });
      }
    }
    return memo;
  };
  const check = (name: string) => (): Finding[] => {
    const all = faults();
    const cars = parked.flatMap((c) => {
      const what = all.get(keyOf(c.model, pickVariant(c.model, c.tint, has)))?.[name];
      return what ? [{ at: `${c.x.toFixed(0)},${c.z.toFixed(0)}`, what: `${c.model} (paint ${paintOf(c.model, c.tint)}): ${what}` }] : [];
    });
    const looks = [...all].flatMap(([k, f]) => (f[name] ? [{ at: `traffic ${k}`, what: f[name] }] : []));
    return [...cars, ...looks];
  };
  return {
    /** A vehicle drawn out of its body: past its footprint or above its roof (the trolleybus's booms aside). */
    "vehicle-off-body": check("vehicle-off-body"),
    /** A vehicle drawn short of its body: the player bumps into a car where none shows. */
    "vehicle-short-of-body": check("vehicle-short-of-body"),
    /** A vehicle hanging over the road or sunk into it. */
    "vehicle-floating": check("vehicle-floating"),
  };
};
