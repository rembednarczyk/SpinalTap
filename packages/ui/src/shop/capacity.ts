import { CYBERWARE_CATALOG, type CyberwareId, type CyberwareLoadout, capacityAfter, fitsCapacity } from "@seki/core";
import type { CapacityVm } from "../store/ui-store";

/** What an implant takes of the cyberware capacity (ADR-0033): the catalogue's own number, 2 to 8. */
export const capacityCost = (id: CyberwareId): number => CYBERWARE_CATALOG[id].capacity;

export interface CapacityFit {
  readonly cost: number;
  /** Capacity in use once it is installed (the implant it replaces comes out). */
  readonly after: number;
  /** Over the limit: the clinic refuses the install. */
  readonly over: boolean;
}

/**
 * Whether `id` fits the capacity left, by core's own rule (a smaller implant for a bigger one
 * always fits); with no capacity reported yet, everything fits.
 */
export const capacityFit = (id: CyberwareId, loadout: CyberwareLoadout, capacity: CapacityVm | null): CapacityFit => {
  const cost = capacityCost(id);
  return { cost, after: capacityAfter(loadout, id), over: capacity !== null && !fitsCapacity(loadout, id, capacity.max) };
};

/** The refusal shown and toasted when an implant does not fit. */
export const overCapacityText = (fit: CapacityFit, capacity: CapacityVm): string => `Za mało pojemności: ${fit.after} / ${capacity.max}`;
