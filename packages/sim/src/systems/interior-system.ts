import { interiorAt } from "../content/interior-areas";
import type { System } from "../world/context";

/** How far past an interior's walls the player still counts as inside it (no flicker in a doorway). */
export const INTERIOR_KEEP = 0.25;

/**
 * Interiors (ADR-0061): which of `INTERIORS` the player is in, compared with the last step, and
 * `InteriorLeft` then `InteriorEntered` when it changes. The first step of a new game only reads
 * it from the position, without an event (a load reads it from the saved position, G-174); a
 * rider of the metro (out of the world) and a dead player keep the last one.
 */
export const interiorSystem: System = {
  name: "interior",
  run(ctx) {
    const player = ctx.world.with("player").first;
    if (!player || ctx.session.gameOver) return;
    const before = ctx.session.interior;
    const now = interiorAt(player.position, before ?? null, INTERIOR_KEEP)?.id ?? null;
    ctx.session.interior = now;
    if (before === undefined || before === now) return;
    if (before !== null) ctx.bus.emit("InteriorLeft", { interiorId: before });
    if (now !== null) ctx.bus.emit("InteriorEntered", { interiorId: now });
  },
};
