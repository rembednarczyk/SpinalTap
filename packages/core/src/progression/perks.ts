import type { AttributeId, Attributes } from "./attributes";

/**
 * The perk trees (ADR-0059, stage 3): one per attribute, on four tiers the attribute opens at
 * 4, 8, 12 and 15; the last tier holds the tree's key perk. A rank costs one perk point. The
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
  might_second_wind: { tree: "might", tier: 1, ranks: 1, per: 0.5 },
  might_hardened: { tree: "might", tier: 2, ranks: 2, per: 2 },
  might_crushing_parry: { tree: "might", tier: 3, ranks: 1, per: 1, key: true },
  // Reflex: firearms, the dash.
  reflex_steady: { tree: "reflex", tier: 0, ranks: 3, per: 0.04 },
  reflex_quick_reload: { tree: "reflex", tier: 0, ranks: 2, per: 0.15 },
  reflex_slipstream: { tree: "reflex", tier: 1, ranks: 1, per: 0.4 },
  reflex_deadeye: { tree: "reflex", tier: 2, ranks: 2, per: 0.2 },
  reflex_bullet_dance: { tree: "reflex", tier: 3, ranks: 1, per: 1, key: true },
  // Tech: implants, armor, medicine.
  tech_tailor: { tree: "tech", tier: 0, ranks: 2, per: 1 },
  tech_field_medic: { tree: "tech", tier: 0, ranks: 2, per: 0.25 },
  tech_overclock: { tree: "tech", tier: 1, ranks: 2, per: 2 },
  tech_coolant: { tree: "tech", tier: 2, ranks: 1, per: 0.4 },
  tech_second_heart: { tree: "tech", tier: 3, ranks: 1, per: 0.25, key: true },
  // Net: quickhacks, cameras.
  net_buffer: { tree: "net", tier: 0, ranks: 2, per: 1 },
  net_fast_upload: { tree: "net", tier: 0, ranks: 2, per: 0.1 },
  net_recycler: { tree: "net", tier: 1, ranks: 1, per: 0.5 },
  net_ghost_signal: { tree: "net", tier: 2, ranks: 2, per: 0.15 },
  net_chain: { tree: "net", tier: 3, ranks: 1, per: 8, key: true },
  // Shadow: sneaking, takedowns, bodies.
  shadow_soft_steps: { tree: "shadow", tier: 0, ranks: 2, per: 0.25 },
  shadow_quick_takedown: { tree: "shadow", tier: 0, ranks: 2, per: 0.2 },
  shadow_mule: { tree: "shadow", tier: 1, ranks: 1, per: 0.25 },
  shadow_prowler: { tree: "shadow", tier: 2, ranks: 1, per: 0.4 },
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

export type PerkRefusal = "unknown" | "no-points" | "locked" | "at-max";

/** Why a rank of `id` cannot be bought now, or null when it can. */
export const perkRefusal = (attributes: Attributes, perks: PerkRanks, unspent: number, id: string): PerkRefusal | null => {
  if (!isPerkId(id)) return "unknown";
  if (unspent < 1) return "no-points";
  if (!perkUnlocked(attributes, id)) return "locked";
  if (perkRank(perks, id) >= perkDef(id).ranks) return "at-max";
  return null;
};

/**
 * Is every rank in `perks` a perk that exists, within its ranks, on a tier its attribute opens?
 * A save that fails this was edited (a respec takes the perks with the attributes).
 */
export const validPerks = (attributes: Attributes, perks: PerkRanks): boolean =>
  Object.entries(perks).every(([id, rank]) => isPerkId(id) && Number.isInteger(rank) && rank >= 1 && rank <= perkDef(id).ranks && perkUnlocked(attributes, id));
