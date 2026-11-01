import { useState } from "react";
import { type DifficultyProfile, NORMAL_DIFFICULTY } from "@seki/core";
import { useDifficultyIntents, useUi } from "../use-ui";

/** What a difficulty picker shows and where its changes go. */
export interface DifficultyBinding {
  readonly value: DifficultyProfile;
  /** The value waits for the end of a fight (the pause menu in combat). */
  readonly pending: boolean;
  set(profile: DifficultyProfile): void;
}

/** The new game's choice: the screen's own until the start, "normal" at first (ADR-0066). */
export const useNewGameDifficulty = (): DifficultyBinding => {
  const [value, set] = useState<DifficultyProfile>(NORMAL_DIFFICULTY);
  return { value, pending: false, set };
};

/** The running game's difficulty: the one asked for in a fight if any, else the one in force. */
export const useRunDifficulty = (): DifficultyBinding => {
  const vm = useUi((s) => s.difficulty);
  const intents = useDifficultyIntents();
  return { value: vm.pending ?? vm.profile, pending: vm.pending !== null, set: (p) => intents.setDifficulty(p) };
};
