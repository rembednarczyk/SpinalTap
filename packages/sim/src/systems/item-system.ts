import { type ConsumableId, type DomainState, type Health, type UseResult, healScale, stackCount, useConsumable } from "@seki/core";
import type { System } from "../world/context";
import { playerHeld } from "../world/takedown";
import { withPlayerMaxHp } from "./player-control-system";

/** Quick use takes the strongest consumable first. */
const QUICK_USE: readonly ConsumableId[] = ["medkit", "bandage"];

/**
 * The player uses one consumable from the bag: her stats' maximum first (G-892), Field Medic
 * (ADR-0059) on what it heals. Quick use and the `use-item` command both heal here (G-895).
 */
export const usePlayerConsumable = (domain: DomainState, id: ConsumableId, health: Health): UseResult =>
  useConsumable(domain.inventory, id, withPlayerMaxHp(health, domain), healScale(domain.progression.perks));

/** Uses a medkit (or, without one, a bandage) on the input edge. A full-health player keeps it. */
export const itemSystem: System = {
  name: "item",
  run(ctx) {
    if (!ctx.input.useItem || playerHeld(ctx)) return;
    const player = ctx.world.with("player", "health").first;
    if (!player) return;
    const inventory = ctx.state.domain.inventory;
    const id = QUICK_USE.find((c) => stackCount(inventory, c) > 0);
    if (!id) return;
    const r = usePlayerConsumable(ctx.state.domain, id, player.health);
    if (!r.ok) return;
    player.health = r.health;
    ctx.state.domain = { ...ctx.state.domain, inventory: r.inventory };
    ctx.bus.emit("ItemUsed", { itemId: id, healed: r.healed });
  },
};
