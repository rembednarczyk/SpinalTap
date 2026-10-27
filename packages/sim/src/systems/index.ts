import type { System } from "../world/context";
import { createGangerAiSystem } from "./ai";
import { abilitySystem } from "./ability-system";
import { combatSystem } from "./combat-system";
import { deathSystem } from "./death-system";
import { interactionSystem } from "./interaction-system";
import { interpolationSystem } from "./interpolation-system";
import { itemSystem } from "./item-system";
import { movementSystem } from "./movement-system";
import { playerControlSystem } from "./player-control-system";
import { questSystem } from "./quest-system";
import { streamingSystem } from "./streaming-system";

export { fireShot, HEAD_ZONE } from "./combat-system";
export { equippedAbility, worldTimeScale } from "./ability-system";
export { deadFlag } from "./death-system";
export { statsFor, PITCH_LIMIT, SPRINT_MULTIPLIER } from "./player-control-system";

/**
 * Explicit, fixed system order (determinism: never derived from map iteration).
 * Returns fresh instances because some systems keep per-simulation caches.
 */
export const createSystems = (): readonly System[] => [
  streamingSystem,
  interpolationSystem,
  abilitySystem,
  itemSystem,
  playerControlSystem,
  createGangerAiSystem(),
  movementSystem,
  combatSystem,
  interactionSystem,
  deathSystem,
  questSystem,
];
