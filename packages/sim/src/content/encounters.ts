import type { EncounterDef } from "@seki/core";
import { DOCKS_PLACE, MARKET_PLACE } from "./lublin/sites";

/**
 * Street encounters (ADR-0032): short ink scenes, three to five per district, that start when
 * the player comes within `radius` of `at` between `fromHour` and `toHour` (wrapping past
 * midnight). Each point lies on a street, a market aisle or a yard path the player can walk to.
 * The knots live in `packages/narrative/ink/enc-<district>.ink`.
 */
/** The (x, z) of a point of the market or the docks, from their own coordinates. */
const inMarket = (x: number, z: number) => ({ x: x + MARKET_PLACE.x, z: z + MARKET_PLACE.z });
const inDocks = (x: number, z: number) => ({ x: x + DOCKS_PLACE.x, z: z + DOCKS_PLACE.z });

export const ENCOUNTERS: readonly EncounterDef[] = [
  // Krakowskie Przedmieście: the deptak from Plac Litewski to Plac Łokietka.
  // Nobu on the deptak in front of PACHINKO, in the evening and at night.
  { id: "s7_pachinko", district: "shinsekai-7", knot: "enc_s7_pachinko", fromHour: 19, toHour: 4, at: { x: 306, z: -77 }, radius: 4, npcKey: "enc-nobu", once: true },
  // A salaryman asleep on the pavement by Neon Koi, before dawn.
  { id: "s7_salaryman", district: "shinsekai-7", knot: "enc_s7_salaryman", fromHour: 1, toHour: 6, at: { x: 328, z: -91 }, radius: 4, npcKey: "enc-salaryman", once: true },
  // Hina looks for her robot cat on Plac Łokietka, by day.
  { id: "s7_neko", district: "shinsekai-7", knot: "enc_s7_neko", fromHour: 9, toHour: 18, at: { x: 428, z: -99 }, radius: 5, npcKey: "enc-hina", once: true },
  // Shiro reads his poems under the lamp on Plac Litewski in the evening.
  { id: "s7_poet", district: "shinsekai-7", knot: "enc_s7_poet", fromHour: 18, toHour: 23, at: { x: 102, z: -23 }, radius: 4, npcKey: "enc-shiro", once: true },

  // Stare Miasto: Bramowa, the Rynek round the Trybunał, Grodzka down to Brama Grodzka.
  // Takumi with plastic flowers outside KARAOKE on the Rynek while Mei sings.
  { id: "kanal_flowers", district: "kanal", knot: "enc_kanal_flowers", fromHour: 20, toHour: 3, at: { x: 551, z: -45 }, radius: 4, npcKey: "enc-takumi", once: true },
  // Old Sabu fishing the Czechówka through a drain grate on Bramowa, at dawn.
  { id: "kanal_fisherman", district: "kanal", knot: "enc_kanal_fisherman", fromHour: 4, toHour: 9, at: { x: 510, z: -68 }, radius: 4, npcKey: "enc-sabu", once: true },
  // The vending machine near DENKI that does not want to be scrapped; no NPC, the machine talks.
  { id: "kanal_vending", district: "kanal", knot: "enc_kanal_vending", fromHour: 10, toHour: 22, at: { x: 590, z: -10 }, radius: 3, once: true },
  // Koji, a Hebi recruit, practises his threats under the footbridge on Grodzka.
  { id: "kanal_recruit", district: "kanal", knot: "enc_kanal_recruit", fromHour: 16, toHour: 23, at: { x: 652, z: 64 }, radius: 4, npcKey: "enc-koji", once: true },

  // Podzamcze: the market floor between the stall rows, under the viaduct.
  // Kiku the fortune teller between the south stalls, at night.
  { id: "targ_fortune", district: "targ", knot: "enc_targ_fortune", fromHour: 18, toHour: 2, at: inMarket(84, 76), radius: 4, npcKey: "enc-kiku", once: true },
  // Daigo's synthetic chicken runs loose across the middle of the market, in the morning.
  { id: "targ_chicken", district: "targ", knot: "enc_targ_chicken", fromHour: 6, toHour: 13, at: inMarket(100, 84), radius: 6, npcKey: "enc-daigo", once: true },
  // Akane and a Hebi collector by the east wall of the hall, in the afternoon.
  { id: "targ_debt", district: "targ", knot: "enc_targ_debt", fromHour: 12, toHour: 20, at: inMarket(108, 78), radius: 4, npcKey: "enc-akane", once: true },
  // Riko sings in front of the north stalls in the evening.
  { id: "targ_idol", district: "targ", knot: "enc_targ_idol", fromHour: 19, toHour: 23, at: inMarket(98, 99), radius: 5, npcKey: "enc-riko", once: true },

  // Nabrzeże Bystrzycy: the container yard and the quay.
  // Tomo, laid off by an algorithm, smokes at the north end of the yard in the morning.
  { id: "doki_laidoff", district: "doki", knot: "enc_doki_laidoff", fromHour: 5, toHour: 11, at: inDocks(16, 119), radius: 4, npcKey: "enc-tomo", once: true },
  // A Tessen guard against a cyber gull on the quay, by day.
  { id: "doki_gull", district: "doki", knot: "enc_doki_gull", fromHour: 10, toHour: 17, at: inDocks(2, 132), radius: 5, npcKey: "enc-gull-guard", once: true },
  // Knocking from a sealed container on the east side of the yard, at night; nobody to spawn.
  { id: "doki_container", district: "doki", knot: "enc_doki_container", fromHour: 22, toHour: 4, at: inDocks(17, 106), radius: 3, once: true },
];
