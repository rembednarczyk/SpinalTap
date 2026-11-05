import type { Vec3 } from "@seki/core";
import type { Entity } from "../../world/components";
import type { SimContext } from "../../world/context";
import { LEVEL_GAP } from "../../world/nav";
import { incapacitated } from "../../world/takedown";
import { difficultyOf } from "../../world/difficulty";
import { giveLead, lenientTo } from "./ganger-perception";

/*
 * Hearing the player's steps (ADR-0069, stage 2). Deterministic: a moving player makes a noise
 * of a radius set by her gait, a landing one of its own. An unalerted enemy within it, on the
 * same level, grows suspicious and goes to look where she was. A noise never raises the alarm
 * (the weapons' noise, `alertNearbyGangers`, does, and stays as it was).
 */

/** Noise radius of the player's steps, m, by gait. Crouching is silent. */
export const NOISE_SPRINT = 9;
export const NOISE_WALK = 3.5;
/** Back on the ground after a jump or a fall. */
export const NOISE_LANDING = 6;
/** Slower than this (m/s, horizontal) she is standing, not walking. */
const STEP_SPEED = 0.5;
/** What a heard noise puts in the suspicion, before the difficulty's `awareness` (ADR-0066). */
export const NOISE_SUSPICION = 0.35;

/** The radius of the noise the player's steps make this step: 0 standing, crouched, in the air or on a ladder. */
export const footstepNoise = (p: Entity): number => {
  if (p.fall !== undefined || p.climb || p.mantle || !p.velocity) return 0;
  if (Math.hypot(p.velocity.x, p.velocity.z) < STEP_SPEED) return 0;
  const posture = p.posture;
  if (posture?.crouched || (posture?.amount ?? 0) > 0.5) return 0;
  return posture?.sprinting ? NOISE_SPRINT : NOISE_WALK;
};

/**
 * A noise of the player's at `at`, heard `radius` m round on its level: every unalerted enemy
 * there that would go for her gets a lead to `at` and at least `NOISE_SUSPICION × awareness`.
 * One that only watches her (friendly, a tolerant patrol, her disguise of its faction) does not
 * come over for a step it hears.
 */
export const hearNoise = (ctx: SimContext, at: Vec3, radius: number): void => {
  if (radius <= 0) return;
  const level = Math.min(1, NOISE_SUSPICION * difficultyOf(ctx).awareness);
  for (const g of ctx.world.with("ai", "velocity")) {
    if (g.ai.alerted || g.unconscious || Math.abs(g.position.y - at.y) >= LEVEL_GAP) continue;
    if (Math.hypot(g.position.x - at.x, g.position.z - at.z) > radius) continue;
    if (incapacitated(ctx, g) || lenientTo(ctx, g)) continue;
    g.ai.suspicion = Math.max(g.ai.suspicion ?? 0, level);
    giveLead(g, at);
  }
};
