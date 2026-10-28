import { cooldownRateOf, hasPerk } from "@seki/core";
import type { Entity, PerkState } from "../world/components";
import type { SimContext, System } from "../world/context";

/** Speed of the dash burst, m/s (ADR-0033): with DASH_TIME about 2.5 m. */
export const DASH_SPEED = 14;
/** Seconds the burst lasts. */
export const DASH_TIME = 0.18;
/** Seconds between dashes (shorter with the quick_cooldown buff). */
export const DASH_COOLDOWN = 1.5;
/** Seconds from the start of a dash in which bullets pass the player by. */
export const DASH_IFRAMES = 0.3;
/** Horizontal speed the player keeps when a dash in the air ends, m/s (a run, not a missile). */
export const DASH_EXIT_SPEED = 6;
/** Stamina regained per second with the guard down; none while it is up (the guard has to drop to rest). */
export const STAMINA_REGEN = 0.35;
export const STAMINA_GUARD_REGEN = 0;

export const freshPerks = (): PerkState => ({ dash: 0, dashDir: { x: 0, z: 1 }, dashCooldown: 0, airDash: false, iframes: 0, stamina: 1 });

/** The perk state of the player, created on first use. */
export const perksOf = (p: Entity): PerkState => (p.perks ??= freshPerks());

/** Is the player in the middle of a dash? */
export const dashing = (p: Entity): boolean => (p.perks?.dash ?? 0) > 0;

/** Where the dash goes: along the stick, relative to the facing; straight ahead without input. */
const dashDirection = (p: Entity, moveX: number, moveZ: number): { x: number; z: number } => {
  const len = Math.hypot(moveX, moveZ);
  const nx = len > 1e-3 ? moveX / len : 0;
  const nz = len > 1e-3 ? moveZ / len : 1;
  const sin = Math.sin(p.yaw);
  const cos = Math.cos(p.yaw);
  return { x: sin * nz + cos * nx, z: cos * nz - sin * nx };
};

type Mover = Entity & { velocity: NonNullable<Entity["velocity"]> };

/** Carries a running burst on; at its end in the air the speed drops to a run. */
const carryDash = (p: Mover, s: PerkState, dt: number): void => {
  p.velocity = { x: s.dashDir.x * DASH_SPEED, y: 0, z: s.dashDir.z * DASH_SPEED };
  s.dash = Math.max(0, s.dash - dt);
  if (s.dash > 0) return;
  const speed = Math.hypot(p.velocity.x, p.velocity.z);
  const k = speed > DASH_EXIT_SPEED ? DASH_EXIT_SPEED / speed : 1;
  p.velocity = { x: p.velocity.x * k, y: 0, z: p.velocity.z * k };
};

/** Can a dash start now? Legs implant, cooldown, not on a ladder or a ledge, not off balance, one in the air. */
const canDash = (ctx: SimContext, p: Entity, s: PerkState, grounded: boolean): boolean => {
  if (!ctx.input.dash || ctx.session.dialogueActive || ctx.session.gameOver) return false;
  if (!hasPerk(ctx.state.domain.character.cyberware, "dash") || s.dashCooldown > 0) return false;
  if (p.climb || p.mantle || (p.melee?.stagger ?? 0) > 0) return false;
  return grounded || !s.airDash;
};

/**
 * The dash and the guard's stamina (ADR-0033), after the player's control and before the ladder
 * and the movement: a burst of DASH_SPEED along the stick for DASH_TIME, on the ground or once
 * in the air (the one air dash comes back on landing). It stops a fall for its start, makes
 * bullets miss for DASH_IFRAMES and waits DASH_COOLDOWN. No randomness.
 */
export const perkSystem: System = {
  name: "perk",
  run(ctx) {
    const rate = cooldownRateOf(ctx.state.domain.buffs);
    for (const p of ctx.world.with("player", "velocity")) {
      const s = perksOf(p);
      s.dashCooldown = Math.max(0, s.dashCooldown - ctx.dt * rate);
      s.iframes = Math.max(0, s.iframes - ctx.dt);
      s.stamina = Math.min(1, s.stamina + ctx.dt * (p.melee?.guard ? STAMINA_GUARD_REGEN : STAMINA_REGEN));
      const grounded = p.fall === undefined && !p.climb && !p.mantle;
      if (grounded) s.airDash = false;
      if (s.dash > 0) {
        carryDash(p, s, ctx.dt);
        continue;
      }
      if (!canDash(ctx, p, s, grounded)) continue;
      s.dashDir = dashDirection(p, ctx.input.moveX, ctx.input.moveZ);
      s.dash = DASH_TIME;
      s.dashCooldown = DASH_COOLDOWN;
      s.iframes = DASH_IFRAMES;
      if (!grounded) {
        s.airDash = true;
        // The burst holds the body up for its start: a fall pauses, a rise goes on.
        p.fall = Math.max(p.fall ?? 0, 0);
      }
      carryDash(p, s, ctx.dt);
      ctx.bus.emit("Dashed", { entityId: p.id, air: !grounded, at: { ...p.position } });
    }
  },
};
