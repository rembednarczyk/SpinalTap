import type { EncounterDef } from "@seki/core";

/**
 * Street encounters (ADR-0032): short ink scenes, three to five per district, that start when
 * the player comes within `radius` of `at` between `fromHour` and `toHour` (wrapping past
 * midnight). Each point lies on a street, a market aisle or a yard path the player can walk to.
 * The knots live in `packages/narrative/ink/enc-<district>.ink`.
 */
export const ENCOUNTERS: readonly EncounterDef[] = [
  // Shinsekai, block 7: the main street runs north along X ∈ [-7, 7].
  // Nobu on the kerb in front of PACHINKO, west side, in the evening and at night.
  { id: "s7_pachinko", district: "shinsekai-7", knot: "enc_s7_pachinko", fromHour: 19, toHour: 4, at: { x: -5, z: 24 }, radius: 4, npcKey: "enc-nobu", once: true },
  // A salaryman asleep on the pavement south of Neon Koi, before dawn.
  { id: "s7_salaryman", district: "shinsekai-7", knot: "enc_s7_salaryman", fromHour: 1, toHour: 6, at: { x: 5, z: -5 }, radius: 4, npcKey: "enc-salaryman", once: true },
  // Hina looks for her robot cat on the street by the car wash, by day.
  { id: "s7_neko", district: "shinsekai-7", knot: "enc_s7_neko", fromHour: 9, toHour: 18, at: { x: 3, z: 28 }, radius: 5, npcKey: "enc-hina", once: true },
  // Shiro reads his poems under the south-west lamp in the evening.
  { id: "s7_poet", district: "shinsekai-7", knot: "enc_s7_poet", fromHour: 18, toHour: 23, at: { x: -5, z: -20 }, radius: 4, npcKey: "enc-shiro", once: true },

  // Ulica Kanałowa: segment A north from Shinsekai (X ∈ [4, 10]), segment B east (Z ∈ [74, 82]).
  // Takumi with plastic flowers outside KARAOKE while Mei sings.
  { id: "kanal_flowers", district: "kanal", knot: "enc_kanal_flowers", fromHour: 20, toHour: 3, at: { x: 12, z: 78.5 }, radius: 4, npcKey: "enc-takumi", once: true },
  // Old Sabu fishing through a drain grate in segment A, at dawn.
  { id: "kanal_fisherman", district: "kanal", knot: "enc_kanal_fisherman", fromHour: 4, toHour: 9, at: { x: 7, z: 66 }, radius: 4, npcKey: "enc-sabu", once: true },
  // The vending machine near DENKI that does not want to be scrapped; no NPC, the machine talks.
  { id: "kanal_vending", district: "kanal", knot: "enc_kanal_vending", fromHour: 10, toHour: 22, at: { x: 38, z: 80 }, radius: 3, once: true },
  // Koji, a Hebi recruit, practises his threats by the footbridge.
  { id: "kanal_recruit", district: "kanal", knot: "enc_kanal_recruit", fromHour: 16, toHour: 23, at: { x: 48, z: 78 }, radius: 4, npcKey: "enc-koji", once: true },

  // Targ pod estakadą: the market floor between the stall rows (Z ≈ 72-100).
  // Kiku the fortune teller between the south stalls, at night.
  { id: "targ_fortune", district: "targ", knot: "enc_targ_fortune", fromHour: 18, toHour: 2, at: { x: 84, z: 76 }, radius: 4, npcKey: "enc-kiku", once: true },
  // Daigo's synthetic chicken runs loose across the middle of the market, in the morning.
  { id: "targ_chicken", district: "targ", knot: "enc_targ_chicken", fromHour: 6, toHour: 13, at: { x: 100, z: 84 }, radius: 6, npcKey: "enc-daigo", once: true },
  // Akane and a Hebi collector by the east wall, in the afternoon.
  { id: "targ_debt", district: "targ", knot: "enc_targ_debt", fromHour: 12, toHour: 20, at: { x: 108, z: 78 }, radius: 4, npcKey: "enc-akane", once: true },
  // Riko sings in front of the north row in the evening.
  { id: "targ_idol", district: "targ", knot: "enc_targ_idol", fromHour: 19, toHour: 23, at: { x: 98, z: 99 }, radius: 5, npcKey: "enc-riko", once: true },

  // Doki Tessen: the container yard and the quay.
  // Tomo, laid off by an algorithm, smokes at the north end of the yard in the morning.
  { id: "doki_laidoff", district: "doki", knot: "enc_doki_laidoff", fromHour: 5, toHour: 11, at: { x: 16, z: 119 }, radius: 4, npcKey: "enc-tomo", once: true },
  // A Tessen guard against a cyber gull on the quay, by day.
  { id: "doki_gull", district: "doki", knot: "enc_doki_gull", fromHour: 10, toHour: 17, at: { x: 2, z: 132 }, radius: 5, npcKey: "enc-gull-guard", once: true },
  // Knocking from a sealed container on the east side of the yard, at night; nobody to spawn.
  { id: "doki_container", district: "doki", knot: "enc_doki_container", fromHour: 22, toHour: 4, at: { x: 17, z: 106 }, radius: 3, once: true },
];
