import { attributeCyberCapacity } from "../progression/attribute-effects";
import { perkCyberCapacity } from "../progression/perk-effects";
import type { DomainState } from "../state/domain-state";
import { type CapacityUse, capacityMax, capacityUsed } from "./capacity";
import { CYBERWARE_CATALOG, type CyberwareId, type CyberwareLoadout, type CyberwareSlot } from "./cyberware";

/**
 * Implants over the pool (ADR-0059, stage 3c). A respec that takes Tech and Overclock away leaves
 * the implants in, but those that no longer fit stop working until room is freed (taking one
 * out, Tech, Overclock, a shard): their stats, perks (`hasPerk`) and ability are off. Which ones
 * goes by a fixed order of the slots, not by when they went in, so the state follows from the
 * implants and the pool alone and the save needs no new field: each implant in turn works when it
 * fits what is left of the pool, else it is off and the count goes on with the next.
 */

/** The order the pool is handed out in: the starting optics first, the arms (the deflect) last. */
export const CAPACITY_ORDER: readonly CyberwareSlot[] = ["optics", "nervous", "skeleton", "arms"];

/** The installed implants that do not fit the pool `max`, in CAPACITY_ORDER; empty within the pool. */
export const inactiveCyberware = (loadout: CyberwareLoadout, max: number): CyberwareId[] => {
  if (capacityUsed(loadout) <= max) return [];
  const off: CyberwareId[] = [];
  let left = max;
  for (const slot of CAPACITY_ORDER) {
    const id = loadout[slot];
    if (id === undefined) continue;
    const cost = CYBERWARE_CATALOG[id].capacity;
    if (cost <= left) left -= cost;
    else off.push(id);
  }
  return off;
};

/** The implants that work in a pool of `max`: the loadout itself while it fits (the same object). */
export const activeCyberware = (loadout: CyberwareLoadout, max: number): CyberwareLoadout => {
  const off = inactiveCyberware(loadout, max);
  if (off.length === 0) return loadout;
  const active: Partial<Record<CyberwareSlot, CyberwareId>> = {};
  for (const slot of CAPACITY_ORDER) {
    const id = loadout[slot];
    if (id !== undefined && !off.includes(id)) active[slot] = id;
  }
  return active;
};

/** The pool and its use, from the domain (ADR-0033): level, shards, Tech and Overclock (ADR-0059). */
export const cyberPoolOf = (domain: DomainState): CapacityUse => ({
  used: capacityUsed(domain.character.cyberware),
  max: capacityMax(domain.progression.level, domain.capacityShards, attributeCyberCapacity(domain.progression.attributes) + perkCyberCapacity(domain.progression.perks)),
});

/** The player's working implants: what the simulation reads for stats, perks and the ability. */
export const workingCyberware = (domain: DomainState): CyberwareLoadout => activeCyberware(domain.character.cyberware, cyberPoolOf(domain).max);
