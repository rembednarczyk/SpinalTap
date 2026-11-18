import type { System } from "../world/context";
import { rollMicroEvent, runMicroEvent, startCrime } from "../world/micro-events";
import { crimeInReach, tickStreetCrimes } from "../world/street-crimes";
import { runEncounters, streetMet } from "../world/street-scenes";

/**
 * Street encounters and micro-events (ADR-0034), near the end of the step: the micro-event
 * under way is judged first (its fight was fought this step), then entering a district may
 * start one, then the district's encounters are checked. Nothing happens to a rider, in a
 * dialogue or after death; the first step of a new game only notes the district (a load reads
 * it from the saved position, G-174).
 */
export const streetSceneSystem: System = {
  name: "street-scenes",
  run(ctx) {
    const player = ctx.world.with("player").first ?? null;
    runMicroEvent(ctx, player);
    tickStreetCrimes(ctx);
    if (!player || ctx.session.gameOver) return;
    const s = ctx.session.street2;
    // A crime of the board (ADR-0091 stage 5): any time, the contract's district aside, once the street knows her.
    if (!s.micro && s.encounter === null && !ctx.session.dialogueActive && ctx.state.domain.metro.ride === null && streetMet(ctx)) {
      const crime = crimeInReach(ctx, player);
      if (crime) startCrime(ctx, crime);
    }
    const district = ctx.streamer.districtAt(player.position);
    const before = s.district;
    if (district !== null) s.district = district;
    if (district === null) return;
    if (before !== null && before !== district) rollMicroEvent(ctx, district, player);
    runEncounters(ctx, player, district);
  },
};
