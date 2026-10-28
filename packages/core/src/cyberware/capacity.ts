import { CYBERWARE_CATALOG, type CyberwareDefinition, type CyberwareId, type CyberwareLoadout } from "./cyberware";

/**
 * Cyberware capacity (ADR-0033): every implant takes 2 to 8 points of a pool that grows with
 * finished contracts and with capacity shards. Installing past the pool is refused, which turns
 * buying everything into a choice of build. Pure numbers; the simulation reads the contract
 * count and the shards from the domain.
 */

/** The pool of a fresh game: the starting optics (2) and room for one or two implants. */
export const BASE_CYBER_CAPACITY = 12;

/** Finished contracts at which the pool grows, and by how much each time. */
export const CYBER_CAPACITY_STEPS: readonly { readonly contracts: number; readonly bonus: number }[] = [
  { contracts: 3, bonus: 3 },
  { contracts: 6, bonus: 3 },
  { contracts: 10, bonus: 3 },
];

/** Points one capacity shard adds, for good. */
export const SHARD_CYBER_CAPACITY = 2;

export interface CapacityUse {
  readonly used: number;
  readonly max: number;
}

/** Points the installed implants take. */
export const capacityUsed = (loadout: CyberwareLoadout): number => {
  let used = 0;
  for (const id of Object.values(loadout)) {
    if (id === undefined) continue;
    const def: CyberwareDefinition = CYBERWARE_CATALOG[id];
    used += def.capacity;
  }
  return used;
};

/** The pool after `completed` contracts and `shards` capacity shards. */
export const capacityMax = (completed: number, shards: number): number =>
  BASE_CYBER_CAPACITY + CYBER_CAPACITY_STEPS.reduce((sum, s) => sum + (completed >= s.contracts ? s.bonus : 0), 0) + Math.max(0, Math.floor(shards)) * SHARD_CYBER_CAPACITY;

/** Points in use once `id` takes its slot (the implant there now comes out). */
export const capacityAfter = (loadout: CyberwareLoadout, id: CyberwareId): number => {
  const def = CYBERWARE_CATALOG[id];
  const out = loadout[def.slot];
  return capacityUsed(loadout) - (out === undefined ? 0 : CYBERWARE_CATALOG[out].capacity) + def.capacity;
};

/** Does `id` fit into a pool of `max`? Swapping a bigger implant for a smaller one always fits. */
export const fitsCapacity = (loadout: CyberwareLoadout, id: CyberwareId, max: number): boolean => {
  const after = capacityAfter(loadout, id);
  return after <= max || after <= capacityUsed(loadout);
};
