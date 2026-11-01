import {
  PARRY_COOLDOWN,
  STAGGER_MOVE,
  clamp,
  deriveStats,
  type DerivedStats,
  type CharacterState,
  type DomainState,
  type InputFrame,
  garmentModifiers,
  wornGarments,
  buffModifiers,
  BUFF_CATALOG,
  levelModifiers,
} from "@seki/core";
import type { Entity } from "../world/components";
import { playerHeld } from "../world/takedown";
import { knockbackVelocity } from "../world/knockback";
import type { SimContext, System } from "../world/context";
import { overFootprint } from "../world/collision";
import { restingLevel } from "./elevator-system";

export const PITCH_LIMIT = 1.25;
export const SPRINT_MULTIPLIER = 1.65;
/** Walk speed multiplier while crouched. Crouching also rules out sprinting. */
export const CROUCH_SPEED_MULTIPLIER = 0.5;
/** Seconds to get fully down or back up. */
export const CROUCH_TIME = 0.22;

let cachedCharacter: CharacterState | null = null;
let cachedStats: DerivedStats | null = null;

/** Memoised on the (immutable) character object; stats only change when it does. */
export const statsFor = (c: CharacterState): DerivedStats => {
  if (c !== cachedCharacter || !cachedStats) {
    cachedCharacter = c;
    cachedStats = deriveStats(c);
  }
  return cachedStats;
};

let cachedFor: { character: CharacterState; equipment: DomainState["equipment"]; buffs: string; level: number } | null = null;
let cachedPlayer: DerivedStats | null = null;

/** The buffs that change stats, as a key: their seconds left tick every step, the stats do not. */
const statBuffKey = (domain: DomainState): string =>
  domain.buffs.length === 0 ? "" : domain.buffs.filter((b) => BUFF_CATALOG[b.id].modifiers).map((b) => b.id).join(",");

/**
 * The player's stats with worn garments (a ballistic vest slows her down), running buffs (the
 * stim steadies the aim, ADR-0033) and the character's level (health, ADR-0059). Memoised on the
 * character, the equipment, the stat buffs and the level, which only change on install, memory,
 * equip, a buff starting or ending, or a level up.
 */
export const playerStatsOf = (domain: DomainState): DerivedStats => {
  const buffs = statBuffKey(domain);
  const level = domain.progression.level;
  const stale = cachedFor?.character !== domain.character || cachedFor.equipment !== domain.equipment || cachedFor.buffs !== buffs || cachedFor.level !== level;
  if (!cachedPlayer || stale) {
    cachedFor = { character: domain.character, equipment: domain.equipment, buffs, level };
    const worn = garmentModifiers(wornGarments(domain.inventory, domain.equipment));
    cachedPlayer = deriveStats(domain.character, [...worn, ...buffModifiers(domain.buffs), levelModifiers(domain.progression)]);
  }
  return cachedPlayer;
};

/** Take-off speed of a jump, m/s: about 1.2 m of clearance under GRAVITY (ADR-0021). */
export const JUMP_SPEED = 7;
/** Seconds after leaving an edge in which a jump still counts (coyote time). */
export const COYOTE_TIME = 0.12;
/** Seconds a jump pressed too early waits for the ground (jump buffer). */
export const JUMP_BUFFER = 0.12;
/** How fast the player can change horizontal velocity in the air, m/s². On the ground it is instant. */
export const AIR_ACCEL = 7;
/** Walk speed multiplier for the moment after a hard landing. */
export const LANDING_SLOW_MULTIPLIER = 0.4;

/** Standing on a lift platform that is on its way: riders hold still (ADR-0020), so no jump either. */
const ridingMovingLift = (ctx: SimContext, p: Entity): boolean => {
  for (const l of ctx.world.with("elevator", "solid")) {
    if (restingLevel(l) === null && overFootprint(l.solid, p.position.x, p.position.z) && Math.abs(p.position.y - l.solid.max.y) < 0.05) return true;
  }
  return false;
};

/**
 * The jump button (ADR-0021): a press is kept for JUMP_BUFFER, and it takes off while the
 * player is on the ground or left it without a jump less than COYOTE_TIME ago. One jump per
 * time in the air: no double jump. Not on a ladder (the ladder lets go instead), not while
 * staggered, not on a moving lift.
 */
const updateJump = (ctx: SimContext, p: Entity, frozen: boolean): void => {
  const j = (p.jump ??= { coyote: 0, buffer: 0 });
  const grounded = p.fall === undefined && !p.climb && !p.mantle;
  j.coyote = grounded ? COYOTE_TIME : Math.max(0, j.coyote - ctx.dt);
  j.buffer = ctx.input.jump && !frozen && !p.climb && !p.mantle ? JUMP_BUFFER : Math.max(0, j.buffer - ctx.dt);
  if (j.buffer <= 0 || j.coyote <= 0 || frozen || (p.melee?.stagger ?? 0) > 0) return;
  if (ridingMovingLift(ctx, p)) return;
  j.buffer = 0;
  j.coyote = 0;
  p.fall = JUMP_SPEED;
  p.airPeak = p.position.y;
  ctx.bus.emit("Jumped", { entityId: p.id, at: p.position });
};

/** Seconds to aim when the weapon has no ADS profile (never used by the catalog's firearms). */
const DEFAULT_ADS_TIME = 0.2;

/** The weapon is out and ready in the hands: drawn, not being drawn, not reloading. */
const weaponReady = (p: Entity): boolean => {
  const c = p.combatant;
  return !!c?.stats && !c.holstered && c.drawing === 0 && c.reloading === 0;
};

/**
 * The aim button (ADR-0019): with a firearm it eases the aim down sights in and out over the
 * weapon's `ads.time`; with a melee weapon it raises the guard, which opens a parry window
 * unless the guard went up less than PARRY_COOLDOWN ago. Neither while staggered, a swing is
 * on its way or the weapon is not ready. Frozen (dialogue, death) both drop.
 */
const updateAimAndGuard = (p: Entity, wantsAim: boolean, frozen: boolean, dt: number): void => {
  const weapon = p.combatant?.stats ?? null;
  const posture = p.posture;
  const melee = p.melee;
  const staggered = (melee?.stagger ?? 0) > 0;
  const able = wantsAim && !frozen && !staggered && weaponReady(p);
  if (posture) {
    posture.aiming = able && !!weapon?.ads;
    const step = dt / (weapon?.ads?.time ?? DEFAULT_ADS_TIME);
    const target = posture.aiming ? 1 : 0;
    posture.aim = posture.aim < target ? Math.min(target, posture.aim + step) : Math.max(target, posture.aim - step);
  }
  if (melee) {
    const guard = able && !!weapon?.melee && melee.phase === "idle";
    if (guard && !melee.guard) {
      melee.parry = melee.parryCooldown <= 0 && weapon?.melee ? weapon.melee.block.parryWindow : 0;
      melee.parryCooldown = PARRY_COOLDOWN;
    }
    if (!guard) melee.parry = 0;
    melee.guard = guard;
  }
};

/** The camera toggle flips the preferred mode between first and third person. */
const toggleCameraMode = (ctx: SimContext): void => {
  const mode = ctx.state.domain.preferences.cameraMode === "FPP" ? "TPP" : "FPP";
  ctx.state.domain = { ...ctx.state.domain, preferences: { ...ctx.state.domain.preferences, cameraMode: mode } };
  ctx.bus.emit("CameraModeChanged", { mode });
};

/** Eases the crouch towards the held input. Frozen (dialogue, death) the stance stays as it was. */
const updateCrouch = (posture: NonNullable<Entity["posture"]>, crouch: boolean, frozen: boolean, dt: number): void => {
  if (!frozen) posture.crouched = crouch;
  const target = posture.crouched ? 1 : 0;
  const step = dt / CROUCH_TIME;
  posture.amount = posture.amount < target ? Math.min(target, posture.amount + step) : Math.max(target, posture.amount - step);
  posture.sprinting = false;
};

/** Counts the slow walk after a hard landing down; true while it lasted into this step. */
const tickLanding = (p: Entity, dt: number): boolean => {
  const landingSlow = (p.landing ?? 0) > 0;
  if (p.landing !== undefined) {
    p.landing -= dt;
    if (p.landing <= 0) delete p.landing;
  }
  return landingSlow;
};

/**
 * The velocity the stick asks for on the ground, along the player's facing: walk, crouch, aim,
 * guard or sprint speed, slowed by a stagger or a hard landing, plus any knockback. Sets the
 * sprint flag of the posture.
 */
const wantedVelocity = (p: Entity, input: InputFrame, stats: DerivedStats, landingSlow: boolean): { x: number; z: number } => {
  const posture = p.posture;
  const len = Math.hypot(input.moveX, input.moveZ);
  const nx = len > 1 ? input.moveX / len : input.moveX;
  const nz = len > 1 ? input.moveZ / len : input.moveZ;
  const crouched = posture?.crouched ?? false;
  const weapon = p.combatant?.stats ?? null;
  const guarding = p.melee?.guard ?? false;
  const staggered = (p.melee?.stagger ?? 0) > 0;
  // No sprint while aiming down sights, guarding or off balance.
  const sprinting = input.sprint && nz > 0 && !crouched && !(posture?.aiming ?? false) && !guarding && !staggered;
  if (posture) posture.sprinting = sprinting;
  // Speed follows the eased crouch and aim, so getting down or aiming slows the step smoothly.
  const crouchSlow = 1 + (CROUCH_SPEED_MULTIPLIER - 1) * (posture?.amount ?? 0);
  const aimSlow = 1 + ((weapon?.ads?.move ?? 1) - 1) * (posture?.aim ?? 0);
  const guardSlow = guarding && weapon?.melee ? weapon.melee.block.move : 1;
  const speed =
    stats.moveSpeed * (sprinting ? SPRINT_MULTIPLIER : crouchSlow * aimSlow * guardSlow) * (staggered ? STAGGER_MOVE : 1) * (landingSlow ? LANDING_SLOW_MULTIPLIER : 1);
  const sin = Math.sin(p.yaw);
  const cos = Math.cos(p.yaw);
  // Forward = (sin, cos); right = (cos, -sin).
  const knock = knockbackVelocity(p);
  return { x: (sin * nz + cos * nx) * speed + knock.x, z: (cos * nz - sin * nx) * speed + knock.z };
};

/** On the ground the player moves as wanted; in the air the take-off momentum carries on and the stick only nudges it (ADR-0021). */
const steer = (p: Entity & { velocity: NonNullable<Entity["velocity"]> }, want: { x: number; z: number }, dt: number): void => {
  if (p.fall === undefined) {
    p.velocity = { x: want.x, y: 0, z: want.z };
    return;
  }
  const dx = want.x - p.velocity.x;
  const dz = want.z - p.velocity.z;
  const change = Math.hypot(dx, dz);
  const k = change > AIR_ACCEL * dt ? (AIR_ACCEL * dt) / change : 1;
  p.velocity = { x: p.velocity.x + dx * k, y: 0, z: p.velocity.z + dz * k };
};

/** Turns the InputFrame into player look angles, desired velocity and the camera mode toggle. */
export const playerControlSystem: System = {
  name: "player-control",
  run(ctx) {
    const { input } = ctx;
    if (input.toggleCamera) toggleCameraMode(ctx);
    const stats = playerStatsOf(ctx.state.domain);
    for (const p of ctx.world.with("player", "velocity")) {
      if (p.health) p.health = { current: Math.min(p.health.current, stats.maxHp), max: stats.maxHp };
      const frozen = playerHeld(ctx);
      if (p.posture) updateCrouch(p.posture, input.crouch, frozen, ctx.dt);
      updateAimAndGuard(p, input.aim, frozen, ctx.dt);
      updateJump(ctx, p, frozen);
      const landingSlow = tickLanding(p, ctx.dt);
      if (frozen) {
        p.velocity = { x: 0, y: 0, z: 0 };
        continue;
      }
      p.yaw += input.lookYaw;
      p.pitch = clamp(p.pitch + input.lookPitch, -PITCH_LIMIT, PITCH_LIMIT);
      steer(p, wantedVelocity(p, input, stats, landingSlow), ctx.dt);
    }
  },
};
