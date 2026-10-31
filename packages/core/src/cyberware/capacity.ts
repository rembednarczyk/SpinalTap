import { CYBERWARE_CATALOG, type CyberwareDefinition, type CyberwareId, type CyberwareLoadout } from "./cyberware";

/**
 * Cyberware capacity (ADR-0033): every implant takes 2 to 8 points of a pool that grows with
 * the character's level (ADR-0059: every third level) and with capacity shards. Installing past
 * the pool is refused, which turns buying everything into a choice of build. Pure numbers; the
 * simulation reads the level and the shards from the domain.
 */

/** The pool of a fresh game: the starting optics (2) and room for one or two implants. */
export const BASE_CYBER_CAPACITY = 12;

/** The pool grows by LEVEL_CYBER_CAPACITY every LEVEL_CYBER_CAPACITY_EVERY levels (3, 6, ... 30). */
export const LEVEL_CYBER_CAPACITY_EVERY = 3;
export const LEVEL_CYBER_CAPACITY = 2;

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

/** The pool at character level `level` with `shards` capacity shards used. */
export const capacityMax = (level: number, shards: number): number =>
  BASE_CYBER_CAPACITY +
  Math.floor(Math.max(0, level) / LEVEL_CYBER_CAPACITY_EVERY) * LEVEL_CYBER_CAPACITY +
  Math.max(0, Math.floor(shards)) * SHARD_CYBER_CAPACITY;

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
