export const FACTIONS = {
  fixers: "Sieć Kaito",
  hebi: "Gang Hebi",
  civilians: "Mieszkańcy Shinsekai",
} as const;

export type FactionId = keyof typeof FACTIONS;

export const isFactionId = (id: string): id is FactionId => Object.hasOwn(FACTIONS, id);

export type ReputationState = Readonly<Record<FactionId, number>>;

export const REPUTATION_MIN = -100;
export const REPUTATION_MAX = 100;

export type ReputationTier = "hostile" | "wary" | "neutral" | "friendly" | "trusted";

export const createReputation = (): ReputationState => ({ fixers: 0, hebi: 0, civilians: 0 });

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
