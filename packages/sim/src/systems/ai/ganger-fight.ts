import { State } from "mistreevous";
import { angleTo, normalize, strikeAt, sub } from "@seki/core";
import type { Entity } from "../../world/components";
import { chestOf, eyeOf } from "../../world/hitscan";
import { readyToFire } from "../../world/player-weapon";
import { NPC_CRIT, fireShot, npcSpreadOf } from "../combat-system";
import { startSwing } from "../melee-system";
import type { GangerBinding } from "./ganger-walk";

/* How a ganger turns to and attacks whoever it fights: a gun burst or a melee swing (ADR-0019). */

/** Pause after a melee swing's recovery before the next one, plus up to `MELEE_REST_JITTER`. */
export const MELEE_REST = 0.45;
const MELEE_REST_JITTER = 0.4;
const TURN_RATE = 6;

/** Turns the ganger towards the target, no faster than its turn rate. */
export const faceTowards = ({ self, ctx, timeScale }: GangerBinding, target: Entity): void => {
  if (!self || !ctx) return;
  const desired = Math.atan2(target.position.x - self.position.x, target.position.z - self.position.z);
  let delta = (desired - self.yaw) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  const maxTurn = TURN_RATE * ctx.dt * timeScale;
  self.yaw += Math.max(-maxTurn, Math.min(maxTurn, delta));
};

/** Stands, faces the target and swings or fires once ready. */
export const attack = (at: GangerBinding, target: Entity): State => {
  const { ctx, self } = at;
  if (!ctx || !self) return State.FAILED;
  self.velocity = { x: 0, y: 0, z: 0 };
  faceTowards(at, target);
  const combatant = self.combatant;
  if (combatant) combatant.engaged = true;
  const melee = combatant?.stats?.melee;
  if (melee && combatant && self.melee) {
    // Swing once it faces the target well inside the arc; the windup telegraphs the blow.
    const m = self.melee;
    const facing = Math.abs(angleTo({ x: self.position.x, z: self.position.z, yaw: self.yaw }, target.position.x, target.position.z));
    if (m.phase === "idle" && m.stagger === 0 && facing <= melee.arc * 0.5 && readyToFire(combatant, combatant.loaded)) {
      // Alternate the first two swings of the combo, so the blows read differently.
      const strike = (m.strike + 1) % Math.min(2, melee.combo.length);
      startSwing(ctx, self.id, m, melee, strike, melee.npcWindup);
      combatant.cooldown = melee.npcWindup + strikeAt(melee, strike).recovery + MELEE_REST + ctx.rng.next() * MELEE_REST_JITTER;
    }
    return State.SUCCEEDED;
  }
  if (combatant && readyToFire(combatant, combatant.loaded)) {
    const origin = eyeOf(self);
    const dir = normalize(sub(chestOf(target), origin));
    fireShot(ctx, { shooter: self, origin, dir, spread: npcSpreadOf(ctx, self), ...NPC_CRIT }, ctx.rng);
    // Stagger the next burst so the two gangers do not fire in lockstep.
    combatant.cooldown += ctx.rng.next() * 0.5;
  }
  return State.SUCCEEDED;
};
