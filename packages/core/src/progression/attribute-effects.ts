import type { StatModifiers } from "../character/stats";
import { ATTRIBUTE_MAX, ATTRIBUTE_START, type AttributeId, type Attributes } from "./attributes";

/**
 * The passive effects of the attributes (ADR-0059, stage 2). Every point above the starting 3
 * counts, so a new character plays exactly as before the attributes existed. The stats go
 * through `StatModifiers`; RAM, the cyberware pool, the aim, the upload and the detection are
 * numbers the systems read from here. All values are the ADR's first guess, tuned by the
 * balance test of stage 8.
 */

/** Might: maximum health and melee damage (share) per point. */
export const MIGHT_HP = 4;
export const MIGHT_MELEE_DAMAGE = 0.02;
/** Reflex: aim stability per point, and the share of the time to aim down sights it takes off. */
export const REFLEX_AIM_STABILITY = 0.01;
export const REFLEX_ADS_TIME = 0.02;
/** Tech: armor on every zone a worn garment protects, per point; one cyberware point per TECH_CAPACITY_EVERY points. */
export const TECH_GARMENT_ARMOR = 1;
export const TECH_CAPACITY_EVERY = 3;
/** Net: one RAM per NET_RAM_EVERY points, and the share of the upload time each point takes off. */
export const NET_RAM_EVERY = 2;
export const NET_UPLOAD_TIME = 0.02;
/** Shadow: the share of the detection pace each point takes off, and the crit chance it adds. */
export const SHADOW_DETECTION = 0.02;
export const SHADOW_CRIT = 0.005;

/** Points put into `id` above the start (0..12); a broken value counts within 3..15. */
export const attributePoints = (attributes: Attributes, id: AttributeId): number => {
  const v = attributes[id];
  return Number.isFinite(v) ? Math.max(0, Math.min(ATTRIBUTE_MAX, Math.floor(v)) - ATTRIBUTE_START) : 0;
};

/** What the attributes do to the stats: health, melee damage, aim stability, armor from clothes, crits. */
export const attributeModifiers = (attributes: Attributes): StatModifiers => ({
  maxHp: attributePoints(attributes, "might") * MIGHT_HP,
  meleeDamage: attributePoints(attributes, "might") * MIGHT_MELEE_DAMAGE,
  aimStability: attributePoints(attributes, "reflex") * REFLEX_AIM_STABILITY,
  garmentArmor: attributePoints(attributes, "tech") * TECH_GARMENT_ARMOR,
  critChance: attributePoints(attributes, "shadow") * SHADOW_CRIT,
});

/** Multiplier of the time to aim down sights (Reflex). */
export const adsTimeScale = (attributes: Attributes): number => 1 - attributePoints(attributes, "reflex") * REFLEX_ADS_TIME;

/** Multiplier of a quickhack's upload time (Net). */
export const uploadTimeScale = (attributes: Attributes): number => 1 - attributePoints(attributes, "net") * NET_UPLOAD_TIME;

/** Multiplier of the pace at which enemies and cameras fill their suspicion of the player (Shadow). */
export const detectionScale = (attributes: Attributes): number => 1 - attributePoints(attributes, "shadow") * SHADOW_DETECTION;

/** RAM the cyberdeck gets above its base (Net). */
export const attributeRam = (attributes: Attributes): number => Math.floor(attributePoints(attributes, "net") / NET_RAM_EVERY);

/** Cyberware capacity points above the level's pool (Tech). */
export const attributeCyberCapacity = (attributes: Attributes): number => Math.floor(attributePoints(attributes, "tech") / TECH_CAPACITY_EVERY);
