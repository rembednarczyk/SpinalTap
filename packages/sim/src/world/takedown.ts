import type { Entity } from "./components";
import type { InputFrame } from "@seki/core";
import type { SessionState, SimContext } from "./context";

/**
 * Out of the game for now (ADR-0065): knocked out, or held in the takedown under way. It sees
 * and hears nothing, does not act and is nobody's target.
 */
export const incapacitated = (ctx: SimContext, e: Entity): boolean => !!e.unconscious || ctx.session.takedown?.target === e.id;

/** The player does not act for herself: a conversation or the shop, death, or a takedown under way. */
export const playerHeld = (ctx: SimContext): boolean => ctx.session.dialogueActive || ctx.session.gameOver || ctx.session.takedown !== null;

/**
 * The step's input with the attack button eaten while it is still held from a takedown's end
 * (ADR-0065); letting it go frees it. Applied before every system, so no system fires on it.
 */
export const withAttackLock = (session: SessionState, input: InputFrame): InputFrame => {
  if (!session.attackLock) return input;
  if (!input.fire) {
    session.attackLock = false;
    return input;
  }
  return { ...input, fire: false };
};

/** The interaction prompt of a takedown (a key of the content catalogs, ADR-0056). */
export const TAKEDOWN_PROMPT = "prompt.takedown";
