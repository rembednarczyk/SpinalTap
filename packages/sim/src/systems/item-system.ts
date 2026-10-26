import { ITEM_CATALOG, takeItem } from "@seki/core";
import type { System } from "../world/context";

/** Uses a medkit on the input edge. A full-health player keeps the medkit. */
export const itemSystem: System = {
  name: "item",
  run(ctx) {
    if (!ctx.input.useItem || ctx.session.dialogueActive || ctx.session.gameOver) return;
    const player = ctx.world.with("player", "health").first;
    if (!player || player.health.current >= player.health.max) return;
    const inventory = takeItem(ctx.state.domain.inventory, "medkit");
    if (!inventory) return;
    const before = player.health.current;
    player.health = { ...player.health, current: Math.min(player.health.max, before + ITEM_CATALOG.medkit.heal) };
    ctx.state.domain = { ...ctx.state.domain, inventory };
    ctx.bus.emit("ItemUsed", { itemId: "medkit", healed: player.health.current - before });
  },
};
