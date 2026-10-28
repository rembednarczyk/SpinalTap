import { CYBERWARE_CATALOG, type CyberwareId, type CyberwareLoadout } from "@seki/core";
import type { CapacityVm } from "../store/ui-store";

/** Capacity cost range of an implant (ADR-0032). */
export const CAPACITY_COST_RANGE: readonly [number, number] = [2, 8];

/**
 * What an implant takes of the cyberware capacity (ADR-0032): the catalogue's `capacity` once
 * core has it, otherwise an estimate from the price.
 * TODO(core): read `CyberwareDefinition.capacity` only, once the catalogue carries it.
 */
export const capacityCost = (id: CyberwareId): number => {
  const def: object = CYBERWARE_CATALOG[id];
  const own = "capacity" in def ? def.capacity : undefined;
  if (typeof own === "number") return own;
  const [min, max] = CAPACITY_COST_RANGE;
  return Math.min(max, Math.max(min, Math.round(CYBERWARE_CATALOG[id].price / 200)));
};

export interface CapacityFit {
  readonly cost: number;
  /** Capacity in use once it is installed (the implant it replaces comes out). */
  readonly after: number;
  /** Over the limit: the clinic refuses the install. */
  readonly over: boolean;
}

/** Whether `id` fits the capacity left; with no capacity reported yet, everything fits. */
export const capacityFit = (id: CyberwareId, loadout: CyberwareLoadout, capacity: CapacityVm | null): CapacityFit => {
  const cost = capacityCost(id);
  if (!capacity) return { cost, after: cost, over: false };
  const current = loadout[CYBERWARE_CATALOG[id].slot];
  const freed = current && current !== id ? capacityCost(current) : 0;
  const after = capacity.used - freed + (current === id ? 0 : cost);
  return { cost, after, over: after > capacity.max };
};

/** The refusal shown and toasted when an implant does not fit. */
export const overCapacityText = (fit: CapacityFit, capacity: CapacityVm): string => `Za mało pojemności: ${fit.after} / ${capacity.max}`;
