import type { System } from "../world/context";
import { runMicroEvent, startCrime } from "../world/micro-events";
import { crimeInReach, tickStreetCrimes } from "../world/street-crimes";
import { runEncounters, streetMet } from "../world/street-scenes";

/**
 * Street encounters and the street's crimes (ADR-0034, ADR-0091), near the end of the step: the
 * crime under way is judged first (its fight was fought this step), then one of the board within
 * reach may start, then the district's encounters are checked. Nothing happens to a rider, in a
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
    if (district !== null) s.district = district;
    if (district === null) return;
    runEncounters(ctx, player, district);
  },
};
