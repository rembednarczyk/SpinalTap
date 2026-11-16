import type { Field } from "../../../packages/sim/src/systems/ai/nav-field.ts";
import type { Raster } from "../../../packages/sim/src/systems/ai/nav-raster.ts";
import { MemoryStore } from "./memory-store.ts";

/** Bytes of rasters, and as many of fields, a worker keeps: a near raster on terrain is some 0.3 MB, a wide one 1.6 MB. */
export const NAV_BUDGET = 128 * 2 ** 20;

let stores: { readonly rasters: MemoryStore<Raster>; readonly fields: MemoryStore<Field> } | undefined;

/** The worker's stores of the steering, made at the first call. */
export const navStores = () => (stores ??= { rasters: new MemoryStore<Raster>(NAV_BUDGET), fields: new MemoryStore<Field>(NAV_BUDGET) });
