import type { StackableId, Vec3 } from "@seki/core";
import { v } from "./builders";
import type { DistrictId } from "./world-map";

/**
 * What a street encounter pays (ADR-0034). The ink of an encounter ends by raising a flag
 * `enc_<district>_<name>_<outcome>` (and changes standing itself); the outcome flags listed here
 * also pay eddies or items when the dialogue closes, once. The rest stay flags for later
 * content (a gate card, a favour).
 */
export interface EncounterReward {
  readonly eddies?: number;
  readonly items?: readonly { readonly item: StackableId; readonly qty: number }[];
}

export const ENCOUNTER_REWARDS: Readonly<Record<string, EncounterReward>> = {
  // The drowned Hebi bag: two datachips and a taped bundle of cash.
  enc_kanal_fisherman_bag: { eddies: 120, items: [{ item: "datachip", qty: 2 }] },
  // Going through the sleeping salaryman's pockets.
  enc_s7_salaryman_robbed: { eddies: 60 },
  // Hina's robot cat back home: her father's thanks.
  enc_s7_neko_returned: { eddies: 40 },
  // The vending machine saved from the scrapyard keeps a can for Seki.
  enc_kanal_vending_saved: { items: [{ item: "bandage", qty: 1 }] },
  // Daigo's chicken caught: a skewer on the house.
  enc_targ_chicken_caught: { items: [{ item: "yakitori", qty: 2 }] },
  // The Hebi collector scared off Akane's stall: she pays what she can.
  enc_targ_debt_scared: { eddies: 50 },
  // The sealed container opened: scrap and someone's emergency cash.
  enc_doki_container_opened: { eddies: 80, items: [{ item: "scrap", qty: 3 }] },
};

/**
 * Where a micro-event can take place (ADR-0034): street points of each district, off the
 * routes of the daily plans, where a passer-by and two gangers fit. On entering the district
 * the one farthest from the player within reach is used.
 */
export const MICRO_SPOTS: Readonly<Record<DistrictId, readonly Vec3[]>> = {
  "shinsekai-7": [v(-3, 0, 18), v(2, 0, -12), v(-2, 0, 32)],
  kanal: [v(30, 0, 78), v(58, 0, 77.5), v(7, 0, 60)],
  targ: [v(80, 0, 70), v(104, 0, 70), v(84, 0, 87)],
  doki: [v(0, 0, 100), v(20, 0, 112), v(-10, 0, 112)],
};
