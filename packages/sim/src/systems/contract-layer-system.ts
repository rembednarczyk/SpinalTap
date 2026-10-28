import { CONTRACT_BONUS, type ContractGiverId, badgeHolds, contractKind, hasFlag } from "@seki/core";
import type { SimContext, System } from "../world/context";
import { noteTally, phoneFromFixer } from "../world/street";
import type { DistrictId } from "../content/world-map";

/** Where each fixer works and the flag that says Seki has met them (ADR-0029, phone offers). */
const FIXER_HOME: Readonly<Record<ContractGiverId, { readonly district: DistrictId; readonly met: string }>> = {
  kaito: { district: "shinsekai-7", met: "met_fixer" },
  hana: { district: "targ", met: "met_hana" },
  genzo: { district: "doki", met: "met_genzo" },
};

/** Seconds since the running contract was accepted (its counters' start). */
const secondsSoFar = (ctx: SimContext, startTick: number): number => ((ctx.state.domain.contracts.tally?.clearedTick ?? ctx.tick) - startTick) * ctx.dt;

/**
 * The contract layer (ADR-0028, ADR-0029), after the contract system. While a job runs it keeps
 * the counters the other systems do not see (the player's health for `untouched`, the clock for
 * `swift`) and reports the bonus condition lost, once. Entering a fixer's district without a job
 * brings one offer by phone (one per entry). The rest of the counters are kept where things
 * happen (AI, cameras, deaths, hacks); the debrief is made when the job is paid.
 */
export const contractLayerSystem: System = {
  name: "contract-layer",
  run(ctx) {
    const watch = ctx.session.watch;
    const player = ctx.world.with("player").first;
    const hp = player?.health?.current ?? null;
    const contract = ctx.state.domain.contracts.active;
    if (contract?.status === "active") {
      const hurt = hp !== null && watch.playerHp !== null && hp < watch.playerHp;
      // Starts the counters of a contract that has none yet (one placed in the domain directly).
      noteTally(ctx, (t) => (hurt && !t.damaged ? { ...t, damaged: true } : t));
      const tally = ctx.state.domain.contracts.tally;
      const kind = contractKind(contract);
      const condition = CONTRACT_BONUS[kind];
      if (tally && !tally.bonusLost && !badgeHolds(condition.badge, tally, secondsSoFar(ctx, tally.startTick), kind)) {
        noteTally(ctx, (t) => ({ ...t, bonusLost: true }));
        ctx.bus.emit("ContractBonusChanged", { contractId: contract.id, condition, kept: false });
      }
    }
    watch.playerHp = hp;
    const district = player ? ctx.streamer.districtAt(player.position) : null;
    if (district === null) return;
    const before = watch.district;
    watch.district = district;
    // The first step after a start or a load only takes note of where the player is.
    if (before === null || before === district || ctx.state.domain.contracts.active) return;
    for (const giver of Object.keys(FIXER_HOME) as ContractGiverId[]) {
      const home = FIXER_HOME[giver];
      if (home.district === district && hasFlag(ctx.state.domain.flags, home.met)) phoneFromFixer(ctx, giver, "offer");
    }
  },
};
