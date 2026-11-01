import { disguiseSuspicionRate } from "@seki/core";
import type { Entity } from "../../world/components";
import type { SimContext } from "../../world/context";
import { blowDisguise, forbiddenAct } from "../../world/disguise";
import { difficultyOf } from "../../world/difficulty";

/** The AI fields the disguise sight reads and keeps. */
type Watcher = Entity & { ai: NonNullable<Entity["ai"]> };

/**
 * What an AI of the disguise's faction makes of the player (ADR-0033). `sees` is its plain sight
 * this step (a guard's cone already applied). An AI already fighting sees through her at once.
 * Otherwise its suspicion grows only if it is an enforcer or sees a forbidden act, faster the
 * closer it is, and drains again otherwise; full, it blows the disguise. Returns whether the AI
 * now sees the player for who she is (the caller then alerts it as usual).
 */
export const disguisedSight = (ctx: SimContext, g: Watcher, player: Entity, sees: boolean, distance: number, sight: number, timeScale: number): boolean => {
  if (g.ai.alerted) {
    if (sees) blowDisguise(ctx, g.id);
    return sees;
  }
  const forbidden = sees && forbiddenAct(ctx, player, g.faction ?? "hebi");
  const base = disguiseSuspicionRate(sees, !!g.ai.enforcer, forbidden, distance, sight);
  // It grows at the difficulty's pace (`awareness`, ADR-0066) and drains as ever.
  const rate = base > 0 ? base * difficultyOf(ctx).awareness : base;
  g.ai.suspicion = Math.max(0, Math.min(1, (g.ai.suspicion ?? 0) + rate * ctx.dt * timeScale));
  if (g.ai.suspicion < 1) return false;
  blowDisguise(ctx, g.id);
  return true;
};
