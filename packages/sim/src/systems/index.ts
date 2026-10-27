import type { System } from "../world/context";
import { createCivilianAiSystem, createGangerAiSystem } from "./ai";
import { abilitySystem } from "./ability-system";
import { combatSystem } from "./combat-system";
import { contractSystem } from "./contract-system";
import { deathSystem } from "./death-system";
import { elevatorSystem } from "./elevator-system";
import { interactionSystem } from "./interaction-system";
import { interpolationSystem } from "./interpolation-system";
import { ladderSystem } from "./ladder-system";
import { itemSystem } from "./item-system";
import { movementSystem } from "./movement-system";
import { playerControlSystem } from "./player-control-system";
import { questSystem } from "./quest-system";
import { streamingSystem } from "./streaming-system";
import { weaponSystem } from "./weapon-system";
import { meleeSystem } from "./melee-system";
import { lootSystem } from "./loot-system";
import { clockSystem } from "./clock-system";
import { scheduleSystem } from "./schedule-system";

export { aimSpreadOf, fireShot, GUNFIRE_INTERRUPT_RADIUS, NPC_CRIT } from "./combat-system";
export { meleeSystem, stagger, startSwing } from "./melee-system";
export { equippedAbility, worldTimeScale } from "./ability-system";
export { deadFlag } from "./death-system";
export { LOOT_REACH, syncBags } from "./loot-system";
export { gameSecondsPerStep } from "./clock-system";
export {
  playerStatsOf,
  statsFor,
  AIR_ACCEL,
  COYOTE_TIME,
  CROUCH_SPEED_MULTIPLIER,
  CROUCH_TIME,
  JUMP_BUFFER,
  JUMP_SPEED,
  LANDING_SLOW_MULTIPLIER,
  PITCH_LIMIT,
  SPRINT_MULTIPLIER,
} from "./player-control-system";
export { FALL_DAMAGE_PER_METRE, FALL_SAFE_HEIGHT, GRAVITY, HARD_LANDING_HEIGHT, MANTLE_REACH, MANTLE_TIME, fallDamage } from "./movement-system";
export { CLIMB_SPEED, grabLadder } from "./ladder-system";

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
  ladderSystem,
  scheduleSystem,
  createGangerAiSystem(),
  createCivilianAiSystem(),
  elevatorSystem,
  movementSystem,
  weaponSystem,
  meleeSystem,
  combatSystem,
  interactionSystem,
  deathSystem,
  lootSystem,
  contractSystem,
  questSystem,
];
