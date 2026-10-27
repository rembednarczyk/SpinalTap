import { PROTECTEE_KEY, contractKind } from "@seki/core";
import type { System } from "../world/context";
import { failContract } from "../world/domain-ops";
import { deadFlag } from "./death-system";

/**
 * Fails a running contract whose job can no longer be done: a delivery past its deadline
 * (the tick is part of the save, so the clock survives a load) or a protection job whose
 * Oyaji is dead. Runs after the death system, so a kill and its consequence share a step.
 */
export const contractSystem: System = {
  name: "contract",
  run(ctx) {
    const contract = ctx.state.domain.contracts.active;
    if (contract?.status !== "active") return;
    const kind = contractKind(contract);
    if (kind === "delivery" && contract.deadlineTick !== undefined && ctx.tick >= contract.deadlineTick) failContract(ctx, "timeout");
    else if (kind === "protect" && ctx.state.domain.flags.includes(deadFlag(PROTECTEE_KEY))) failContract(ctx, "protectee-killed");
  },
};
