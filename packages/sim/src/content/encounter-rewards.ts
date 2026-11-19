import type { StackableId, Vec3 } from "@seki/core";
import type { DistrictId } from "./world-map";
import { spotNear } from "./lublin/places";
import { ground } from "./lublin/terrain";

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
  // ADR-0091 stage 5b: 7 per district, on pavements and squares of real streets, 40 m and more off the gangs' cores,
  // 50 m off churches and 100 m off places of memory (`street-crime-board.test.ts`). Then the deptak of Krakowskie
  // Przedmieście, Plac Litewski, Karmelicka and Peowiaków. The second moved 44 m south-west, off the church it stood 18 m from.
  "shinsekai-7": [spotNear(290, -84), spotNear(313, -113), spotNear(205, -63), spotNear(0, -54), spotNear(108, 72), spotNear(264, 144), spotNear(66, -222)],
  // The third off Zaułek Panasa to the square east of the Trybunał: 40 m and more off the gangs' cores (ADR-0091, decision 9).
  // The second 6 m north-east of where it stood, clear of the corner by it (its people and the van need the room).
  // Then Podwale under the Old Town's east slope, Kowalska, Olejna and Rybna.
  kanal: [spotNear(528, -58), spotNear(623, 32), spotNear(640, -10), spotNear(744, 48), spotNear(594, 144), spotNear(480, 36), spotNear(552, 72)],
  // Podzamcze without its market (ADR-0063): Plac Zamkowy and the squares along Aleja Tysiąclecia, the two by the bus
  // station moved off its gang's core (ADR-0091, decision 9). Then Furmańska, the west end of Plac Zamkowy, Nadstawna
  // and Ruska east of the ghetto's trace.
  targ: [spotNear(740, 306), spotNear(760, 330), spotNear(845, 360), spotNear(624, 192), spotNear(702, 234), spotNear(786, 438), spotNear(792, 540)],
  // The public strip by W-3's fence (ADR-0082): past the metro, east of it, by the bridge's path. Then the streets
  // north of it: Montażowa, Towarowa, Kresowa and Kalinowszczyzna.
  doki: [ground(2540, 387), ground(2570, 386.5), ground(2478, 390.5), spotNear(2682, 78), spotNear(2316, 342), spotNear(2520, 78), spotNear(2358, 444)],
};
