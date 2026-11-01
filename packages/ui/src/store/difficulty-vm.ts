import { type DifficultyPresetId, type DifficultyProfile, NORMAL_DIFFICULTY, type SaveSlotInfo } from "@seki/core";

/** The difficulty of the running game (ADR-0066), written by the app's difficulty controller. */
export interface DifficultyVm {
  /** The profile in force. */
  readonly profile: DifficultyProfile;
  /** A profile asked for during a fight: it takes effect when the fight is over. Null when none. */
  readonly pending: DifficultyProfile | null;
}

export const NO_DIFFICULTY_CHANGE: DifficultyVm = { profile: NORMAL_DIFFICULTY, pending: null };

/** A save slot in the list, with the preset it was played on (a small label); none when unknown. */
export interface SlotVm extends SaveSlotInfo {
  readonly difficulty?: DifficultyPresetId | "custom";
}
