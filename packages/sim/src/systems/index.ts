import type { System } from "../world/context";
import { createCivilianAiSystem, createGangerAiSystem } from "./ai";
import { abilitySystem } from "./ability-system";
import { combatSystem } from "./combat-system";
import { contractSystem } from "./contract-system";
import { deathSystem } from "./death-system";
import { interactionSystem } from "./interaction-system";
import { interpolationSystem } from "./interpolation-system";
import { itemSystem } from "./item-system";
import { movementSystem } from "./movement-system";
import { playerControlSystem } from "./player-control-system";
import { questSystem } from "./quest-system";
import { streamingSystem } from "./streaming-system";
import { clockSystem } from "./clock-system";
import { scheduleSystem } from "./schedule-system";

export { aimSpreadOf, fireShot, GUNFIRE_INTERRUPT_RADIUS } from "./combat-system";
export { equippedAbility, worldTimeScale } from "./ability-system";
export { deadFlag } from "./death-system";
export { gameSecondsPerStep } from "./clock-system";
export { statsFor, CROUCH_SPEED_MULTIPLIER, CROUCH_TIME, PITCH_LIMIT, SPRINT_MULTIPLIER } from "./player-control-system";

/**
 * Explicit, fixed system order (determinism: never derived from map iteration).
 * Returns fresh instances because some systems keep per-simulation caches.
 */
export const createSystems = (): readonly System[] => [
  clockSystem,
  streamingSystem,
  interpolationSystem,
  abilitySystem,
  itemSystem,
  playerControlSystem,
  scheduleSystem,
  createGangerAiSystem(),
  createCivilianAiSystem(),
  movementSystem,
  combatSystem,
  interactionSystem,
  deathSystem,
  contractSystem,
  questSystem,
];
