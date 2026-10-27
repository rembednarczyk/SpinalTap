/**
 * Factions of Shinsekai, block 7. Each one is a group the player can be on good or bad
 * terms with; NPCs read their faction's standing to decide how to treat the player.
 */
export const FACTIONS = {
  /** Kaito's fixer network, run out of the Neon Koi bar. */
  fixers: "Sieć Kaito",
  /** The street gang holding the alley behind the car wash. */
  hebi: "Gang Hebi",
  /** Ordinary residents of the street. */
  civilians: "Mieszkańcy Shinsekai",
  /** Doktor Mori's ripperdoc clinic. */
  clinic: "Klinika Mori",
} as const;

export type FactionId = keyof typeof FACTIONS;

export const FACTION_IDS = Object.keys(FACTIONS) as readonly FactionId[];

export const isFactionId = (id: string): id is FactionId => Object.hasOwn(FACTIONS, id);

export type ReputationState = Readonly<Record<FactionId, number>>;

export const REPUTATION_MIN = -100;
export const REPUTATION_MAX = 100;

export type ReputationTier = "hostile" | "wary" | "neutral" | "friendly" | "trusted";

/**
 * The coarse attitude NPCs act on. Finer tiers are for display and prices;
 * behaviour only distinguishes these three.
 */
export type FactionStance = "hostile" | "neutral" | "friendly";

export const createReputation = (): ReputationState => ({ fixers: 0, hebi: 0, civilians: 0, clinic: 0 });

export const changeReputation = (state: ReputationState, faction: FactionId, delta: number): ReputationState => ({
  ...state,
  [faction]: Math.max(REPUTATION_MIN, Math.min(REPUTATION_MAX, state[faction] + delta)),
});

export const reputationTier = (value: number): ReputationTier => {
  if (value <= -50) return "hostile";
  if (value < -10) return "wary";
  if (value <= 10) return "neutral";
  if (value < 50) return "friendly";
  return "trusted";
};

/** Below -10 a faction treats the player as a threat; above +10 as one of their own. */
export const stanceOf = (value: number): FactionStance => {
  const tier = reputationTier(value);
  if (tier === "hostile" || tier === "wary") return "hostile";
  if (tier === "friendly" || tier === "trusted") return "friendly";
  return "neutral";
};

export const factionStance = (state: ReputationState, faction: FactionId): FactionStance => stanceOf(state[faction]);

/** Things the player does that the factions of the district notice. */
export type ReputationCause =
  | { readonly type: "member-killed"; readonly faction: FactionId }
  | { readonly type: "contract-completed" }
  | { readonly type: "clinic-purchase"; readonly kind: "cyberware" | "item" };

export interface ReputationDelta {
  readonly faction: FactionId;
  readonly delta: number;
}

/**
 * Who reacts to a cause, and by how much. Killing a ganger makes the gang angry and the
 * street a little more afraid of you; killing anyone else is far worse.
 */
export const reputationEffects = (cause: ReputationCause): readonly ReputationDelta[] => {
  switch (cause.type) {
    case "member-killed":
      if (cause.faction === "hebi") return [{ faction: "hebi", delta: -4 }, { faction: "civilians", delta: -1 }];
      if (cause.faction === "civilians") return [{ faction: "civilians", delta: -25 }];
      return [{ faction: cause.faction, delta: -25 }, { faction: "civilians", delta: -10 }];
    case "contract-completed":
      return [
        { faction: "fixers", delta: 3 },
        { faction: "hebi", delta: -5 },
        { faction: "civilians", delta: 1 },
      ];
    case "clinic-purchase":
      return [{ faction: "clinic", delta: cause.kind === "cyberware" ? 4 : 1 }];
  }
};
