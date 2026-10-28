import type { System } from "../world/context";
import { createCivilianAiSystem, createGangerAiSystem, escortAiSystem, sniperAiSystem } from "./ai";
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
import { scannerSystem } from "./scanner-system";
import { createCrimeSystem } from "./crime-system";
import { contractLayerSystem } from "./contract-layer-system";
import { perkSystem } from "./perk-system";
import { createBodySystem } from "./body-system";

export { aimSpreadOf, fireShot, GUNFIRE_INTERRUPT_RADIUS, NPC_CRIT } from "./combat-system";
export { meleeSystem, stagger, startSwing } from "./melee-system";
export { equippedAbility, scanning, worldTimeScale } from "./ability-system";
export { DEVICE_SHORT_SECONDS, hackTargetKind, scanFocus, scannerSystem } from "./scanner-system";
export {
  CAMERA_ALARM_RADIUS,
  CAMERA_CONE,
  CAMERA_RANGE,
  CAMERA_REPORT_COOLDOWN,
  CAMERA_SPOT_SECONDS,
  REINFORCE_INTERVAL,
  REPORT_LEAD_RADIUS,
  SPAWN_MAX,
  SPAWN_MIN,
  VIEW_HALF_ANGLE,
  cameraSees,
  createCrimeSystem,
  inPlayerView,
  securityAt,
} from "./crime-system";
export { contractLayerSystem } from "./contract-layer-system";
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
export {
  DASH_COOLDOWN,
  DASH_EXIT_SPEED,
  DASH_IFRAMES,
  DASH_SPEED,
  DASH_TIME,
  STAMINA_GUARD_REGEN,
  STAMINA_REGEN,
  dashing,
  freshPerks,
  perkSystem,
  perksOf,
} from "./perk-system";
export { createBodySystem, cyberCapacityOf } from "./body-system";

/**
 * Explicit, fixed system order (determinism: never derived from map iteration).
 * Returns fresh instances because some systems keep per-simulation caches.
 *
 * ADR-0029: the scanner runs before the AI (a hack's effect counts in the same step), the crime
 * system after the deaths (a kill and its witnesses share a step), the contract layer after the
 * contract system (it sees the job's state of this step).
 *
 * ADR-0033: the body (buffs, disguise, capacity) after the ability, the perks (dash, stamina)
 * right after the player's control, so a dash overrides the velocity the stick asked for.
 */
export const createSystems = (): readonly System[] => [
  clockSystem,
  streamingSystem,
  interpolationSystem,
  abilitySystem,
  createBodySystem(),
  itemSystem,
  playerControlSystem,
  perkSystem,
  ladderSystem,
  scheduleSystem,
  scannerSystem,
  createGangerAiSystem(),
  sniperAiSystem,
  createCivilianAiSystem(),
  escortAiSystem,
  elevatorSystem,
  movementSystem,
  weaponSystem,
  meleeSystem,
  combatSystem,
  interactionSystem,
  deathSystem,
  createCrimeSystem(),
  lootSystem,
  contractSystem,
  contractLayerSystem,
  questSystem,
];
