import type { ContractKind } from "../contracts/kinds";
import type { CrimeKind } from "../crime/heat";

/**
 * Factions of Shinsekai, block 7. Each one is a group the player can be on good or bad
 * terms with; NPCs read their faction's standing to decide how to treat the player. Each id
 * maps to the catalog key of its name (`faction.<id>`, ADR-0056).
 */
export const FACTIONS = {
  /** Kaito's fixer network, run out of the Neon Koi bar. */
  fixers: "faction.fixers",
  /** The street gang holding the alley behind the car wash. */
  hebi: "faction.hebi",
  /** Ordinary residents of the street. */
  civilians: "faction.civilians",
  /** Doktor Mori's ripperdoc clinic. */
  clinic: "faction.clinic",
  /** The corporation that records and rewrites memories (act II, ADR-0023). */
  kagami: "faction.kagami",
  /** Tessen Kōgyō, the corporation that runs the docks, and its private security (ADR-0024). */
  tessen: "faction.tessen",
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

export const createReputation = (): ReputationState => ({ fixers: 0, hebi: 0, civilians: 0, clinic: 0, kagami: 0, tessen: 0 });

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

/** How someone died, as the street sees it (ADR-0070). Without it: in a fight, on the street. */
export interface KillContext {
  /** Hurt while not fighting (from behind, a takedown): its witnesses report a murder instead. */
  readonly wronged?: boolean;
  /** Sent in by the heat (ADR-0029): no farming the street's favour through the heat. */
  readonly security?: boolean;
  /** Of a contract's crew or a micro-event's muggers: the outcome of the job counts, not each body. */
  readonly crew?: boolean;
}

/** Things the player does that the factions of the district notice. */
export type ReputationCause =
  | { readonly type: "member-killed"; readonly faction: FactionId; readonly how?: KillContext }
  /**
   * Without `kind`: an elimination (the M1 rule). `clean`: no alarm and nobody killed besides
   * the targets (`ContractTally`, ADR-0029).
   */
  | { readonly type: "contract-completed"; readonly kind?: ContractKind; readonly clean?: boolean }
  /**
   * A crime of the player's reached the security (`CrimeReported`): the street judges what it
   * sees. `charged`: what the same victim's crimes already cost the street (0 or less), so one
   * deed counts once: an assault reported, then the murder of its victim, cost a murder.
   */
  | { readonly type: "crime-reported"; readonly crime: CrimeKind; readonly charged?: number }
  | { readonly type: "contract-failed"; readonly kind: ContractKind }
  | { readonly type: "clinic-purchase"; readonly kind: "cyberware" | "item" };

export interface ReputationDelta {
  readonly faction: FactionId;
  readonly delta: number;
}

/**
 * Finished jobs. Kaito's network cares about its own work; Hana's jobs are for the market, so
 * the street notices them most. The gangers killed on the way count on their own.
 */
const CONTRACT_COMPLETED: Readonly<Record<ContractKind, readonly ReputationDelta[]>> = {
  // The targets cost the street nothing on their own (ADR-0070): the job is judged as a whole.
  eliminate: [
    { faction: "fixers", delta: 3 },
    { faction: "hebi", delta: -5 },
    { faction: "civilians", delta: 2 },
  ],
  delivery: [
    { faction: "fixers", delta: 2 },
    { faction: "civilians", delta: 1 },
  ],
  retrieve: [
    { faction: "civilians", delta: 3 },
    { faction: "hebi", delta: -4 },
    { faction: "fixers", delta: 1 },
  ],
  protect: [
    { faction: "civilians", delta: 6 },
    { faction: "hebi", delta: -3 },
  ],
  // Genzō's jobs in the docks (ADR-0024): the corporation notices what goes missing.
  escort: [
    { faction: "civilians", delta: 3 },
    { faction: "fixers", delta: 1 },
    { faction: "tessen", delta: -3 },
  ],
  infiltrate: [
    { faction: "fixers", delta: 3 },
    { faction: "tessen", delta: -1 },
  ],
  hack: [
    { faction: "fixers", delta: 2 },
    { faction: "tessen", delta: -5 },
  ],
};

/**
 * A late package costs Kaito a client; a dead Oyaji costs the market's trust; a botched docks
 * job costs Genzō (part of Kaito's network) face. Eliminations and retrievals cannot fail.
 */
const CONTRACT_FAILED: Readonly<Record<ContractKind, readonly ReputationDelta[]>> = {
  eliminate: [],
  delivery: [{ faction: "fixers", delta: -4 }],
  retrieve: [],
  protect: [{ faction: "civilians", delta: -5 }],
  escort: [
    { faction: "civilians", delta: -3 },
    { faction: "fixers", delta: -2 },
  ],
  // Seen in the office: Tessen knows the face now.
  infiltrate: [
    { faction: "fixers", delta: -3 },
    { faction: "tessen", delta: -5 },
  ],
  hack: [{ faction: "fixers", delta: -3 }],
};

/** What the street adds for a clean job (ADR-0070): the quiet kinds of work only. */
export const CLEAN_JOB_BONUS: Readonly<Partial<Record<ContractKind, number>>> = { eliminate: 2, retrieve: 2 };

/** A Hebi ganger killed in a fight on the street: the street's thanks, below `GANG_KILL_CEILING` (ADR-0070). */
export const GANG_KILL_GAIN = 1;
export const GANG_KILL_CEILING = 25;

/** What a reported crime costs with the street (ADR-0070); the others only raise the heat. */
export const CRIME_REPORTED_COST: Readonly<Partial<Record<CrimeKind, number>>> = { assault: -1, murder: -2 };

/**
 * The street's view of a dead ganger (ADR-0070): thanks for one killed in a fight, outside
 * jobs, not of the heat's people, not a score between friends, and while it still has
 * something to give.
 */
const streetOnGangKill = (how: KillContext, standing: ReputationState): number => {
  if (how.wronged || how.security || how.crew) return 0;
  if (stanceOf(standing.hebi) === "friendly" || standing.civilians >= GANG_KILL_CEILING) return 0;
  return GANG_KILL_GAIN;
};

const completed = (kind: ContractKind, clean: boolean): readonly ReputationDelta[] => {
  const base = CONTRACT_COMPLETED[kind];
  const bonus = clean ? (CLEAN_JOB_BONUS[kind] ?? 0) : 0;
  return bonus === 0 ? base : base.map((d) => (d.faction === "civilians" ? { ...d, delta: d.delta + bonus } : d));
};

/**
 * Who reacts to a cause, and by how much, given the standing before it (`standing`, read by
 * the street's view of a dead ganger). Killing a ganger angers the gang and, in a fair fight,
 * pleases the street; killing anyone else is far worse.
 */
export const reputationEffects = (cause: ReputationCause, standing: ReputationState = createReputation()): readonly ReputationDelta[] => {
  switch (cause.type) {
    case "member-killed":
      if (cause.faction === "hebi") {
        const street = streetOnGangKill(cause.how ?? {}, standing);
        return street === 0 ? [{ faction: "hebi", delta: -4 }] : [{ faction: "hebi", delta: -4 }, { faction: "civilians", delta: street }];
      }
      if (cause.faction === "civilians") return [{ faction: "civilians", delta: -25 }];
      // Corporate cleaners: the street does not mourn them.
      if (cause.faction === "kagami") return [{ faction: "kagami", delta: -6 }];
      // A corporate guard: the corporation remembers, the street does not mourn.
      if (cause.faction === "tessen") return [{ faction: "tessen", delta: -4 }];
      return [{ faction: cause.faction, delta: -25 }, { faction: "civilians", delta: -10 }];
    case "contract-completed":
      return completed(cause.kind ?? "eliminate", cause.clean ?? false);
    case "crime-reported": {
      // Only the worse of a victim's crimes counts: the rest of it, if it is worse than what was charged.
      const delta = Math.min(0, (CRIME_REPORTED_COST[cause.crime] ?? 0) - (cause.charged ?? 0));
      return delta === 0 ? [] : [{ faction: "civilians", delta }];
    }
    case "contract-failed":
      return CONTRACT_FAILED[cause.kind];
    case "clinic-purchase":
      return [{ faction: "clinic", delta: cause.kind === "cyberware" ? 4 : 1 }];
  }
};
