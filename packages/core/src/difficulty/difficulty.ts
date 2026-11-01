/**
 * The difficulty axis (ADR-0066): a table of multipliers the simulation applies to its own
 * constants of combat and detection. Every system multiplies in one place and never branches
 * on the preset's name; "normal" is all ones, so its runs are those of a game without the axis.
 */
export interface DifficultyProfile {
  /** Damage the player takes, after armour. */
  readonly damageTaken: number;
  /** An NPC's shots: the inverse of their aim cone (higher is a narrower cone). */
  readonly npcAccuracy: number;
  /** How fast the suspicion of NPCs and cameras fills, per second. */
  readonly awareness: number;
  /** How often the heat's reinforcements come in (the inverse of their interval). */
  readonly reinforce: number;
  /** Health of hostile NPCs when they appear. */
  readonly npcHealth: number;
  /** How long a sniper's laser warns before the shot. */
  readonly snipeTell: number;
}

export type DifficultyField = keyof DifficultyProfile;

export const DIFFICULTY_FIELDS: readonly DifficultyField[] = ["damageTaken", "npcAccuracy", "awareness", "reinforce", "npcHealth", "snipeTell"];

export type DifficultyPresetId = "story" | "normal" | "hard";

/** The presets of ADR-0066; starting values, tuned by stage 8 of ADR-0059. */
export const DIFFICULTY_PRESETS: Readonly<Record<DifficultyPresetId, DifficultyProfile>> = {
  story: { damageTaken: 0.5, npcAccuracy: 0.6, awareness: 0.6, reinforce: 0.5, npcHealth: 0.8, snipeTell: 1.6 },
  normal: { damageTaken: 1, npcAccuracy: 1, awareness: 1, reinforce: 1, npcHealth: 1, snipeTell: 1 },
  hard: { damageTaken: 1.4, npcAccuracy: 1.25, awareness: 1.3, reinforce: 1.5, npcHealth: 1.2, snipeTell: 0.8 },
};

/** The default, and the only level the balance of ADR-0059 is measured on. */
export const NORMAL_DIFFICULTY: DifficultyProfile = DIFFICULTY_PRESETS.normal;

/** Range of every multiplier of a custom profile: never zero, never absurd. */
export const DIFFICULTY_MIN = 0.25;
export const DIFFICULTY_MAX = 3;

/** A whole profile with every field a number in DIFFICULTY_MIN..DIFFICULTY_MAX (a command, a save). */
export const isDifficultyProfile = (v: unknown): v is DifficultyProfile => {
  if (typeof v !== "object" || v === null) return false;
  const fields = v as Readonly<Record<string, unknown>>;
  return DIFFICULTY_FIELDS.every((f) => {
    const x = fields[f];
    return typeof x === "number" && Number.isFinite(x) && x >= DIFFICULTY_MIN && x <= DIFFICULTY_MAX;
  });
};

/** The preset a profile is, or "custom" when it differs from each of them in some multiplier. */
export const presetOf = (p: DifficultyProfile): DifficultyPresetId | "custom" => {
  for (const id of ["normal", "story", "hard"] as const) {
    const preset = DIFFICULTY_PRESETS[id];
    if (DIFFICULTY_FIELDS.every((f) => preset[f] === p[f])) return id;
  }
  return "custom";
};

/** Only the six multipliers, as a fresh object (a command or a save may carry more). */
export const difficultyProfile = (p: DifficultyProfile): DifficultyProfile => ({
  damageTaken: p.damageTaken,
  npcAccuracy: p.npcAccuracy,
  awareness: p.awareness,
  reinforce: p.reinforce,
  npcHealth: p.npcHealth,
  snipeTell: p.snipeTell,
});
