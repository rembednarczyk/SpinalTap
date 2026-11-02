import type { VehicleModel } from "@seki/core";
import { propHash } from "./city-props";

/**
 * The looks of the street's vehicles (ADR-0058 stage 4). The simulation gives a vehicle its body
 * (`VehicleModel`, `VEHICLE_SIZE`: collision and size) and a tint seed; the renderer picks one of
 * the body's looks from the seed, fitted to the body. So the sim's vehicles, where they drive and
 * park (OSM roads, kerb strips, delivery routes on the pedestrian streets, the trolleybus lines),
 * stay as they are and the golden hashes do not change: a garbage truck is a delivery body, an
 * SUV or a pickup a van's. Pure data, no Babylon.
 */
export interface VehicleVariant {
  /** The near model: a car of the city kit (`car-*`) or of `vehicle-props.glb` (`veh-*`); its phone and far versions are `<key>-lite` and `<key>-far` there. */
  readonly key: string;
  /** How often it is picked among the body's looks. */
  readonly weight: number;
  /** A paint of its own (an index of `PAINTS`) instead of the seed's: the city's garbage trucks are amber. */
  readonly paint?: number;
}

export const VEHICLE_VARIANTS: Readonly<Record<VehicleModel, readonly VehicleVariant[]>> = {
  // The kit's saloon and the user's old one (Dirty car, 3D Error 404).
  sedan: [
    { key: "car-sedan", weight: 3 },
    { key: "veh-dirty", weight: 2 },
  ],
  // The kit's hatchback and the user's sports car (Cyberpunk car, 4d_Bob).
  hatchback: [
    { key: "car-hatchback", weight: 3 },
    { key: "veh-cyber", weight: 2 },
  ],
  taxi: [{ key: "car-taxi", weight: 1 }],
  // Vans, SUVs and pickups share a body.
  van: [
    { key: "car-van", weight: 2 },
    { key: "veh-suv", weight: 2 },
    { key: "veh-pickup", weight: 1 },
  ],
  // Box vans, and one in five a garbage truck.
  delivery: [
    { key: "car-delivery", weight: 4 },
    { key: "veh-garbage", weight: 1, paint: 4 },
  ],
  // Quaternius' bus lengthened to Lublin's trolleybus; without the file the procedural one.
  trolleybus: [{ key: "veh-trolleybus", weight: 1 }],
};

/** The trolleybus's livery by swatch: white body, red roof, green skirt, like Lublin's. */
export const TROLLEY_LIVERY: Readonly<Record<string, string>> = { paint: "#e8ebe6", wall: "#b0242c", "wall-dark": "#1f7a45" };

/**
 * The look of a body for a tint seed, among those whose model has loaded (`has`); null when none
 * has (the trolleybus before its file: the procedural one). The same seed always gets the same look.
 */
export const pickVariant = (model: VehicleModel, tint: number, has: (key: string) => boolean): VehicleVariant | null => {
  const pool = VEHICLE_VARIANTS[model].filter((v) => has(v.key));
  const total = pool.reduce((s, v) => s + v.weight, 0);
  if (total <= 0) return null;
  let at = propHash(tint >>> 0, 11) % total;
  for (const v of pool) {
    if (at < v.weight) return v;
    at -= v.weight;
  }
  return null;
};
