import {
  PARRY_COOLDOWN,
  STAGGER_MOVE,
  clamp,
  deriveStats,
  type DerivedStats,
  type CharacterState,
  type DomainState,
  garmentModifiers,
  wornGarments,
} from "@seki/core";
import type { Entity } from "../world/components";
import type { System } from "../world/context";

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

let cachedFor: { character: CharacterState; equipment: DomainState["equipment"] } | null = null;
let cachedPlayer: DerivedStats | null = null;

/**
 * The player's stats with worn garments (a ballistic vest slows her down). Memoised on the
 * character and the equipment, which only change on install, memory or equip.
 */
export const playerStatsOf = (domain: DomainState): DerivedStats => {
  if (!cachedPlayer || cachedFor?.character !== domain.character || cachedFor.equipment !== domain.equipment) {
    cachedFor = { character: domain.character, equipment: domain.equipment };
    cachedPlayer = deriveStats(domain.character, garmentModifiers(wornGarments(domain.inventory, domain.equipment)));
  }
  return cachedPlayer;
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

/** Turns the InputFrame into player look angles, desired velocity and the camera mode toggle. */
export const playerControlSystem: System = {
  name: "player-control",
  run(ctx) {
    const { input, session } = ctx;
    if (input.toggleCamera) {
      const mode = ctx.state.domain.preferences.cameraMode === "FPP" ? "TPP" : "FPP";
      ctx.state.domain = { ...ctx.state.domain, preferences: { ...ctx.state.domain.preferences, cameraMode: mode } };
      ctx.bus.emit("CameraModeChanged", { mode });
    }
    const stats = playerStatsOf(ctx.state.domain);
    for (const p of ctx.world.with("player", "velocity")) {
      if (p.health) p.health = { current: Math.min(p.health.current, stats.maxHp), max: stats.maxHp };
      const posture = p.posture;
      const frozen = session.dialogueActive || session.gameOver;
      if (posture) {
        // Frozen (dialogue, death) the stance stays as it was; otherwise it follows the held input.
        if (!frozen) posture.crouched = input.crouch;
        const target = posture.crouched ? 1 : 0;
        const step = ctx.dt / CROUCH_TIME;
        posture.amount = posture.amount < target ? Math.min(target, posture.amount + step) : Math.max(target, posture.amount - step);
        posture.sprinting = false;
      }
      updateAimAndGuard(p, input.aim, frozen, ctx.dt);
      if (frozen) {
        p.velocity = { x: 0, y: 0, z: 0 };
        continue;
      }
      p.yaw += input.lookYaw;
      p.pitch = clamp(p.pitch + input.lookPitch, -PITCH_LIMIT, PITCH_LIMIT);
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
      const speed = stats.moveSpeed * (sprinting ? SPRINT_MULTIPLIER : crouchSlow * aimSlow * guardSlow) * (staggered ? STAGGER_MOVE : 1);
      const sin = Math.sin(p.yaw);
      const cos = Math.cos(p.yaw);
      // Forward = (sin, cos); right = (cos, -sin).
      p.velocity = { x: (sin * nz + cos * nx) * speed, y: 0, z: (cos * nz - sin * nx) * speed };
    }
  },
};
