import type { EntityId, Vec3 } from "@seki/core";
import type { World } from "miniplex";
import type { Entity } from "../world/components";
import { chestOf, eyeOf, lineOfSight } from "../world/hitscan";
import { inCreationOrder } from "../world/ordering";

/** The farthest an enemy pulls the aim assist (ADR-0072), metres; less with a shorter weapon. */
export const AIM_ASSIST_RANGE = 40;

/**
 * An enemy the aim assist may slow over or snap to (ADR-0072), in world space: the adapter turns
 * it into angles against its own camera. Read only, after a step.
 */
export interface AimCandidate {
  readonly id: EntityId;
  /** Its chest, where the snap aims (the point the AI aims at too). */
  readonly point: Vec3;
  /** From the player's eye to `point`, metres. */
  readonly distance: number;
  /** Half the width of its silhouette, metres (its body's radius). */
  readonly radius: number;
}

/**
 * Fighting the player: alerted (ADR-0029), or a sniper (no `ai`, ADR-0024) aiming at her with
 * its laser on (user decision 6.11); alive and on its feet. Not a civilian, a neutral patrol, an
 * unaware guard (ADR-0069) or a sniper resting, moving or idle.
 */
const inCombat = (e: Entity): boolean => (!!e.ai?.alerted || e.sniper?.phase === "aim") && !e.unconscious && (e.health?.current ?? 0) > 0 && !!e.body;

/**
 * Who the aim assist may pull to (ADR-0072, stages 2 and 3): the enemies fighting the player, within
 * `range` (`AIM_ASSIST_RANGE` and the reach of her active weapon, whichever is shorter) and in
 * plain sight of her eye. In creation order. A pure query: no state, no randomness, outside
 * `createSystems()`, so the simulation and its golden hashes do not change.
 */
export const aimTargets = (world: World<Entity>, player: Entity, range = aimRangeOf(player)): AimCandidate[] => {
  const eye = eyeOf(player);
  const out: AimCandidate[] = [];
  for (const e of inCreationOrder([...world.with("ai"), ...world.with("sniper")])) {
    if (e === player || !inCombat(e)) continue;
    const point = chestOf(e);
    const distance = Math.hypot(point.x - eye.x, point.y - eye.y, point.z - eye.z);
    if (distance > range || distance < 1e-6) continue;
    if (!lineOfSight(world, eye, point)) continue;
    out.push({ id: e.id, point, distance, radius: e.body?.radius ?? 0 });
  }
  return out;
};

/** The assist's reach for her active weapon: `AIM_ASSIST_RANGE`, or less when the weapon reaches less. */
export const aimRangeOf = (player: Entity): number => Math.min(AIM_ASSIST_RANGE, player.combatant?.stats?.range ?? AIM_ASSIST_RANGE);
