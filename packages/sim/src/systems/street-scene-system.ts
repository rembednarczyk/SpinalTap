import type { System } from "../world/context";
import { rollMicroEvent, runMicroEvent } from "../world/micro-events";
import { runEncounters } from "../world/street-scenes";

/**
 * Street encounters and micro-events (ADR-0034), near the end of the step: the micro-event
 * under way is judged first (its fight was fought this step), then entering a district may
 * start one, then the district's encounters are checked. Nothing happens to a rider, in a
 * dialogue or after death; the first step after a start or a load only notes the district.
 */
export const streetSceneSystem: System = {
  name: "street-scenes",
  run(ctx) {
    const player = ctx.world.with("player").first ?? null;
    runMicroEvent(ctx, player);
    if (!player || ctx.session.gameOver) return;
    const s = ctx.session.street2;
    const district = ctx.streamer.districtAt(player.position);
    const before = s.district;
    if (district !== null) s.district = district;
    if (district === null) return;
    if (before !== null && before !== district) rollMicroEvent(ctx, district, player);
    runEncounters(ctx, player, district);
  },
};
