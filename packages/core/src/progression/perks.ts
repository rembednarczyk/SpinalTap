import type { AttributeId, Attributes } from "./attributes";

/**
 * The perk trees (ADR-0059, stages 3 and 3b): one per attribute, eight perks on four tiers the
 * attribute opens at 4, 8, 12 and 15; the last tier holds the tree's key perk. A tier above the
 * first also needs a perk bought on the tier below it in the same tree. A rank costs one perk point. The
 * names and descriptions the player reads are keys of the UI catalogs (`perk.<id>.name`,
 * `perk.<id>.desc`, ADR-0056). What a perk does lives in `perk-effects`, read by the systems
 * like the implants' perks (ADR-0033); `per` is its effect per rank there. Every number is the
 * ADR's first guess, tuned by the balance test of stage 8.
 */

/** The attribute value that opens each tier (0..3). */
export const PERK_TIERS = [4, 8, 12, 15] as const;

export type PerkTier = 0 | 1 | 2 | 3;

export interface PerkDefinition {
  readonly tree: AttributeId;
  readonly tier: PerkTier;
  /** Ranks it can be bought to. */
  readonly ranks: number;
  /** Its effect per rank (a share, metres, points; see `perk-effects`). */
  readonly per: number;
  /** The tree's key perk, on its last tier. */
  readonly key?: true;
}

export const PERKS = {
  // Might: melee, endurance.
  might_tough: { tree: "might", tier: 0, ranks: 3, per: 8 },
  might_brawler: { tree: "might", tier: 0, ranks: 2, per: 0.1 },
  might_thick_skull: { tree: "might", tier: 0, ranks: 2, per: 2 },
  might_second_wind: { tree: "might", tier: 1, ranks: 1, per: 0.5 },
  might_iron_guard: { tree: "might", tier: 1, ranks: 2, per: 0.25 },
  might_hardened: { tree: "might", tier: 2, ranks: 2, per: 2 },
  might_battering_ram: { tree: "might", tier: 2, ranks: 1, per: 1 },
  might_crushing_parry: { tree: "might", tier: 3, ranks: 1, per: 1, key: true },
  // Reflex: firearms, the dash.
  reflex_steady: { tree: "reflex", tier: 0, ranks: 3, per: 0.04 },
  reflex_quick_reload: { tree: "reflex", tier: 0, ranks: 2, per: 0.15 },
  reflex_sharpshooter: { tree: "reflex", tier: 0, ranks: 2, per: 0.03 },
  reflex_slipstream: { tree: "reflex", tier: 1, ranks: 1, per: 0.4 },
  reflex_light_step: { tree: "reflex", tier: 1, ranks: 2, per: 0.2 },
  reflex_deadeye: { tree: "reflex", tier: 2, ranks: 2, per: 0.2 },
  reflex_snap_aim: { tree: "reflex", tier: 2, ranks: 2, per: 0.15 },
  reflex_bullet_dance: { tree: "reflex", tier: 3, ranks: 1, per: 1, key: true },
  // Tech: implants, armor, medicine.
  tech_tailor: { tree: "tech", tier: 0, ranks: 2, per: 1 },
  tech_field_medic: { tree: "tech", tier: 0, ranks: 2, per: 0.25 },
  tech_stim_tolerance: { tree: "tech", tier: 0, ranks: 2, per: 0.25 },
  tech_overclock: { tree: "tech", tier: 1, ranks: 2, per: 2 },
  tech_capacitor: { tree: "tech", tier: 1, ranks: 2, per: 0.2 },
  tech_coolant: { tree: "tech", tier: 2, ranks: 1, per: 0.4 },
  tech_reinforced_seams: { tree: "tech", tier: 2, ranks: 1, per: 0.5 },
  tech_second_heart: { tree: "tech", tier: 3, ranks: 1, per: 0.25, key: true },
  // Net: quickhacks, cameras.
  net_buffer: { tree: "net", tier: 0, ranks: 2, per: 1 },
  net_fast_upload: { tree: "net", tier: 0, ranks: 2, per: 0.1 },
  net_long_range: { tree: "net", tier: 0, ranks: 2, per: 0.2 },
  net_recycler: { tree: "net", tier: 1, ranks: 1, per: 0.5 },
  net_persistence: { tree: "net", tier: 1, ranks: 2, per: 0.2 },
  net_ghost_signal: { tree: "net", tier: 2, ranks: 2, per: 0.15 },
  net_overload: { tree: "net", tier: 2, ranks: 2, per: 0.25 },
  net_chain: { tree: "net", tier: 3, ranks: 1, per: 8, key: true },
  // Shadow: sneaking, takedowns, bodies.
  shadow_soft_steps: { tree: "shadow", tier: 0, ranks: 2, per: 0.25 },
  shadow_quick_takedown: { tree: "shadow", tier: 0, ranks: 2, per: 0.2 },
  shadow_low_profile: { tree: "shadow", tier: 0, ranks: 2, per: 0.05 },
  shadow_mule: { tree: "shadow", tier: 1, ranks: 1, per: 0.25 },
  shadow_long_arms: { tree: "shadow", tier: 1, ranks: 1, per: 0.4 },
  shadow_prowler: { tree: "shadow", tier: 2, ranks: 1, per: 0.4 },
  shadow_assassin: { tree: "shadow", tier: 2, ranks: 2, per: 0.04 },
  shadow_ghost_reload: { tree: "shadow", tier: 3, ranks: 1, per: 1, key: true },
} as const satisfies Readonly<Record<string, PerkDefinition>>;

export type PerkId = keyof typeof PERKS;

export const PERK_IDS = Object.keys(PERKS) as readonly PerkId[];

export const isPerkId = (v: unknown): v is PerkId => typeof v === "string" && Object.hasOwn(PERKS, v);

/** The definition of `id`, typed as the general shape (the table keeps its literal types). */
export const perkDef = (id: PerkId): PerkDefinition => PERKS[id];

/** Perk id → rank bought, as `ProgressionState.perks` keeps it. */
export type PerkRanks = Readonly<Record<string, number>>;

/** The rank of `id` bought, within 0..its ranks (a broken value counts as nothing). */
export const perkRank = (perks: PerkRanks, id: PerkId): number => {
  const v = perks[id];
  return v !== undefined && Number.isFinite(v) ? Math.max(0, Math.min(perkDef(id).ranks, Math.floor(v))) : 0;
};

/** Perk points spent: the sum of the ranks. */
export const perkPointsSpent = (perks: PerkRanks): number => Object.values(perks).reduce((sum, v) => sum + v, 0);

/** The attribute value the perk's tier needs. */
export const perkRequirement = (id: PerkId): number => PERK_TIERS[perkDef(id).tier];

/** Does the attribute open the perk's tier? */
export const perkUnlocked = (attributes: Attributes, id: PerkId): boolean => attributes[perkDef(id).tree] >= perkRequirement(id);

/** The tier below the perk's, whose perk it needs; null on the first tier. */
export const previousTier = (id: PerkId): PerkTier | null => {
  const tier = perkDef(id).tier;
  return tier === 0 ? null : ((tier - 1) as PerkTier);
};

/**
 * Is a perk of the tier below bought in the same tree (stage 3b)? Always on the first tier, and
 * for a perk already bought: its next rank goes on from it (a stage 3 save may lack the path).
 */
export const perkPathMet = (perks: PerkRanks, id: PerkId): boolean => {
  const below = previousTier(id);
  if (below === null || perkRank(perks, id) > 0) return true;
  const { tree } = perkDef(id);
  return PERK_IDS.some((other) => perkDef(other).tree === tree && perkDef(other).tier === below && perkRank(perks, other) > 0);
};

/** Can a rank of the perk be bought on what she has: the attribute opens the tier and the tier below has a perk? */
export const perkOpen = (attributes: Attributes, perks: PerkRanks, id: PerkId): boolean => perkUnlocked(attributes, id) && perkPathMet(perks, id);

/** "locked": the attribute does not open the tier, or no perk of the tier below is bought. */
export type PerkRefusal = "unknown" | "no-points" | "locked" | "at-max";

/** Why a rank of `id` cannot be bought now, or null when it can. */
export const perkRefusal = (attributes: Attributes, perks: PerkRanks, unspent: number, id: string): PerkRefusal | null => {
  if (!isPerkId(id)) return "unknown";
  if (unspent < 1) return "no-points";
  if (!perkOpen(attributes, perks, id)) return "locked";
  if (perkRank(perks, id) >= perkDef(id).ranks) return "at-max";
  return null;
};

/**
 * Is every rank in `perks` a perk that exists, within its ranks, on a tier its attribute opens?
 * A save that fails this was edited (a respec takes the perks with the attributes). The path
 * through the tier below (stage 3b) is not checked: perks bought in stage 3 without it stay,
 * and only new ranks need it.
 */
export const validPerks = (attributes: Attributes, perks: PerkRanks): boolean =>
  Object.entries(perks).every(([id, rank]) => isPerkId(id) && Number.isInteger(rank) && rank >= 1 && rank <= perkDef(id).ranks && perkUnlocked(attributes, id));
