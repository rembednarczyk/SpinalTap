import type { System } from "../world/context";
import { createGangerAiSystem } from "./ai";
import { combatSystem } from "./combat-system";
import { deathSystem } from "./death-system";
import { interactionSystem } from "./interaction-system";
import { interpolationSystem } from "./interpolation-system";
import { movementSystem } from "./movement-system";
import { playerControlSystem } from "./player-control-system";
import { questSystem } from "./quest-system";

export { fireShot } from "./combat-system";
export { deadFlag } from "./death-system";
export { statsFor, PITCH_LIMIT, SPRINT_MULTIPLIER } from "./player-control-system";

/**
 * Explicit, fixed system order (determinism: never derived from map iteration).
 * Returns fresh instances because some systems keep per-simulation caches.
 */
export const createSystems = (): readonly System[] => [
  interpolationSystem,
  playerControlSystem,
  createGangerAiSystem(),
  movementSystem,
  combatSystem,
  interactionSystem,
  deathSystem,
  questSystem,
];
