import {
  ATTRIBUTE_POINTS_PER_LEVEL,
  type DomainState,
  type ItemInstance,
  MIN_LEVEL,
  PERK_POINTS_PER_LEVEL,
  type SaveSnapshot,
  WEAPON_CATALOG,
  addInstance,
  hasItemLevel,
  setAlias,
  xpForLevel,
} from "@seki/core";
import { GENZO_SPOT, ground, playerStatsOf } from "@seki/sim";

/**
 * W-3's start save (ADR-0082, user decision 15.11: "the slice's start save at level 12", G-909).
 * A new game's state taken further on: what the slice needs and nothing the content does not have.
 * - Level 12 with its XP; the 11 attribute and 11 perk points of the levels left to spend, as a
 *   save raised to a level has them (`enemy-level-session`): the build is the player's.
 * - The new game's kit at her level (loot lies at the player's level ± 2, ADR-0059): Unity-9, the
 *   jacket and the cargo pants at level 12, and Tessen's AR-5 of the armoury's chest (common, the
 *   tier of Oyaji's stock and the chest's) at level 12 in the primary slot, loaded and in hand.
 * - Four magazines of 5.56 in reserve (the chest's 90 rounded to whole magazines) and three medkits.
 * - The alias Kaito gives her in M0, the rest of the story as a new game: Genzō offers W-3 at once
 *   (only `w3:sabotage-offered` closes the offer) and the main thread waits at Kaito's.
 * - She stands on the public strip 1.8 m from Genzō, facing him, at the new game's 21:00: the
 *   batch leaves at 06:00, nine game hours later.
 */
export const W3_SLICE_LEVEL = 12;

/** What she carries besides the new game's kit. */
export const W3_SLICE_KIT = {
  rifleRounds: 4 * WEAPON_CATALOG.tessen_ar5.magazine,
  medkits: 3,
} as const;

/** Where she starts: where the W-3 session tests stand to talk to Genzō, facing him (yaw 0 is north, +z). */
export const W3_SLICE_SPOT = { x: GENZO_SPOT.x + 0.3, z: GENZO_SPOT.z - 1.8, yaw: 0 } as const;

const atSliceLevel = (item: ItemInstance): ItemInstance => (hasItemLevel(item.def) ? { ...item, level: W3_SLICE_LEVEL } : item);

/** The domain of a new game raised to the slice: the level, the kit and the AR-5 in hand. */
export const w3SliceDomain = (domain: DomainState): DomainState => {
  const levels = W3_SLICE_LEVEL - MIN_LEVEL;
  const kit = { ...domain.inventory, items: domain.inventory.items.map(atSliceLevel), stacks: { ...domain.inventory.stacks, medkit: W3_SLICE_KIT.medkits } };
  const rifle = addInstance(kit, domain.equipment, "tessen_ar5", { rarity: "common", level: W3_SLICE_LEVEL }, { loaded: WEAPON_CATALOG.tessen_ar5.magazine });
  // A new game's bag holds three pieces of its 24 cells.
  if (!rifle.ok) throw new Error("the slice's AR-5 does not fit the bag");
  return {
    ...domain,
    character: setAlias(domain.character, "Seki Senshi"),
    progression: {
      ...domain.progression,
      xp: xpForLevel(W3_SLICE_LEVEL),
      level: W3_SLICE_LEVEL,
      unspent: { attribute: levels * ATTRIBUTE_POINTS_PER_LEVEL, perk: levels * PERK_POINTS_PER_LEVEL },
    },
    inventory: rifle.inventory,
    equipment: { ...domain.equipment, primary: rifle.item.uid, active: "primary" },
    ammo: { ...domain.ammo, "556": W3_SLICE_KIT.rifleRounds },
  };
};

/**
 * The start save from a new game's snapshot (`Simulation.create(...).snapshot`): the slice's
 * domain, the player by Genzō at full health of her level, the rest of the city from the content
 * (no saved people, no chunks: those round her load), the story as a new game's.
 */
export const w3SliceSnapshot = (base: SaveSnapshot, meta: SaveSnapshot["meta"]): SaveSnapshot => {
  const player = base.entities.find((e) => e.key === "player");
  if (!player) throw new Error("a new game's snapshot without the player");
  const domain = w3SliceDomain(base.domain);
  const at = ground(W3_SLICE_SPOT.x, W3_SLICE_SPOT.z);
  const hp = playerStatsOf(domain).maxHp;
  return {
    ...base,
    entities: [{ ...player, position: at, yaw: W3_SLICE_SPOT.yaw, pitch: 0, hp }],
    streaming: { loadedChunks: [] },
    doors: [],
    domain,
    narrative: null,
    meta,
  };
};
