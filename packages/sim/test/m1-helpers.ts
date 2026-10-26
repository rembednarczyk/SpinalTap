import { CONTRACT_SITE_IDS } from "@seki/core";
import { CONTRACT_SITE_SPAWNS } from "../src";

export { ABILITY_CATALOG, contractTag, type Contract } from "@seki/core";

/** Every contract site has enough spawn points for the largest contract (4 targets). */
export const CONTRACT_SITE_SPAWNS_COUNT_GUARD = CONTRACT_SITE_IDS.every((id) => CONTRACT_SITE_SPAWNS[id].length >= 4);
