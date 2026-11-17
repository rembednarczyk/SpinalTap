import { type Contract, W3_LOCKER_LOOT, addKeyItem, contractKind, jobKeyItems, lockerKey } from "@seki/core";
import { W3_LOCKER_14 } from "../content/tessen-w3";
import { placeChest } from "../systems/loot-system";
import type { SimContext } from "./context";
import { tellBriefHooks } from "./hook-tracker";

/**
 * What the giver hands over with a job just taken (ADR-0082 §1 p. 1, G-907): its story items (W-3's
 * pendrive with the virus), the hooks the giver tells (the quiet ways in), and for W-3's sabotage
 * the technician's overalls in locker 14 at the culvert's top. All of it lives in the domain
 * (inventory, the contract log, a container), so a save keeps it without a schema change.
 */
export const briefJob = (ctx: SimContext, contract: Contract): void => {
  const kind = contractKind(contract);
  const inventory = jobKeyItems(kind).reduce(addKeyItem, ctx.state.domain.inventory);
  ctx.state.domain = { ...ctx.state.domain, inventory };
  if (kind === "sabotage") placeChest(ctx, lockerKey(contract.id), W3_LOCKER_14, W3_LOCKER_LOOT);
  tellBriefHooks(ctx, contract);
};
