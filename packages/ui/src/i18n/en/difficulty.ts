import type { Message } from "../message";

/**
 * English texts of the difficulty (ADR-0066, stage 2): the presets, their one-line descriptions,
 * the sliders of a custom profile, the new game's setup and the pause menu's tab.
 */
export const enDifficulty = {
  "difficulty.heading": "Difficulty",
  "difficulty.preset.story": "Story",
  "difficulty.preset.normal": "Normal",
  "difficulty.preset.hard": "Hard",
  "difficulty.preset.custom": "Custom",
  "difficulty.desc.story": "For the story: enemies hit softer, notice you later, go down sooner and fire one at a time.",
  "difficulty.desc.normal": "The game as it is balanced, the way it is meant to be played.",
  "difficulty.desc.hard": "The same rules with sharper numbers: enemies hit harder, aim better, notice you sooner and more of them fire at once.",
  "difficulty.desc.custom": "Your own mix of the multipliers below.",
  "difficulty.custom": "Custom settings",
  "difficulty.field.damageTaken": "Damage taken",
  "difficulty.field.npcAccuracy": "Enemy accuracy",
  "difficulty.field.awareness": "Enemy awareness",
  "difficulty.field.reinforce": "Reinforcements",
  "difficulty.field.npcHealth": "Enemy health",
  "difficulty.field.snipeTell": "Sniper warning",
  "difficulty.field.npcPressure": "Enemy pressure",
  "difficulty.pending": "Changes after the fight.",
  "difficulty.slot": "Difficulty: {preset}",
  "newGame.heading": "New Game",
  "newGame.start": "Start",
  // W-3's start save (ADR-0082): the slice at level 12, by Genzō.
  "newGame.w3Slice": "Start at W-3 (level 12)",
  "newGame.w3Place": "Nabrzeże · W-3",
  "newGame.w3Intro": "Level 12, the AR-5 loaded in hand and your points to spend. Genzō waits by the KAIUN container at the metro: ask him about the drone batch.",
  "pause.difficulty": "Difficulty",
} as const satisfies Readonly<Record<string, Message>>;

export type DifficultyKey = keyof typeof enDifficulty;
