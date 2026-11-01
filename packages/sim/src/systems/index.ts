import type { System } from "../world/context";
import { bodyWatchSystem, createCivilianAiSystem, createGangerAiSystem, escortAiSystem, sniperAiSystem } from "./ai";
import { abilitySystem } from "./ability-system";
import { combatSystem } from "./combat-system";
import { contractSystem } from "./contract-system";
import { deathSystem } from "./death-system";
import { elevatorSystem } from "./elevator-system";
import { doorSystem } from "./door-system";
import { interactionSystem } from "./interaction-system";
import { interiorSystem } from "./interior-system";
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
import { metroSystem } from "../world/metro-ride";
import { hookSystem } from "../world/hook-tracker";
import { contractPlanSystem } from "./contract-plan-system";
import { streetSceneSystem } from "./street-scene-system";
import { createPasserbySystem } from "./passerby-system";
import { createCrowdSystem } from "./crowd-system";
import { activitySystem } from "./activity-system";
import { createTrafficSystem } from "./traffic-system";
import { takedownSystem } from "./takedown-system";
import { carrySystem } from "./carry-system";
import { difficultySystem } from "../world/difficulty";

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
export { doorForcedFlag, doorSnapshots, doorSystem, forceDoor, restoreDoors } from "./door-system";
export { CARRY_REACH, CARRY_SPEED, HIDE_REACH, bodyCandidate, carriedBody, carrySystem, hideSpotNear } from "./carry-system";
export { TAKEDOWN_BACK_CONE, TAKEDOWN_REACH, TAKEDOWN_TIME, takedownCandidate, takedownDistance, takedownSystem } from "./takedown-system";

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
 * ADR-0034: the metro before streaming (a rider's destination streams in), the contract plan and
 * the hooks after the contract system (a shard's bag exists once its carrier is down), the street
 * scenes after the contract layer.
 * ADR-0038: the doors after the lifts and before movement (both move solids the collision sees).
 * ADR-0040: the passers-by after the daily plans (their routine is set before the AI walks
 * them), the activities right after the movement (they see where everyone ended up).
 * ADR-0041: the residents right after the passers-by, for the same reason.
 * ADR-0050: the traffic right after the movement (it drives itself, sees where everyone ended up
 * and pushes the player out of a vehicle), before the activities.
 * ADR-0061: the interiors last, after everything that moves the player (movement, traffic,
 * knockback), so an event follows where the step left her.
 * ADR-0065: the takedowns after combat (a hit on the player this step breaks the hold), before
 * interaction (the prompt) and death (a lethal takedown dies in the same step).
 * ADR-0066: the difficulty first, so a profile that waited for the end of a fight is in force for
 * the whole of the next step.
 */
export const createSystems = (): readonly System[] => [
  difficultySystem,
  clockSystem,
  metroSystem,
  streamingSystem,
  interpolationSystem,
  abilitySystem,
  createBodySystem(),
  itemSystem,
  playerControlSystem,
  perkSystem,
  ladderSystem,
  scheduleSystem,
  createPasserbySystem(),
  createCrowdSystem(),
  scannerSystem,
  createGangerAiSystem(),
  sniperAiSystem,
  createCivilianAiSystem(),
  escortAiSystem,
  elevatorSystem,
  doorSystem,
  movementSystem,
  createTrafficSystem(),
  activitySystem,
  weaponSystem,
  meleeSystem,
  combatSystem,
  takedownSystem,
  carrySystem,
  interactionSystem,
  deathSystem,
  createCrimeSystem(),
  bodyWatchSystem,
  lootSystem,
  contractSystem,
  contractPlanSystem,
  hookSystem,
  contractLayerSystem,
  streetSceneSystem,
  questSystem,
  interiorSystem,
];
