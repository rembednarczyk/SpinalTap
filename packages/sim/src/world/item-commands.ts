import {
  type GameCommand,
  addAmmo,
  equip,
  findItem,
  installMod,
  isConsumableId,
  removeMod,
  unequip,
  useConsumable,
  weaponStatsOf,
} from "@seki/core";
import type { SimContext } from "./context";

type ItemCommand = Extract<GameCommand, { type: "equip-item" | "unequip-item" | "use-item" | "install-mod" | "remove-mod" }>;

export const isItemCommand = (cmd: GameCommand): cmd is ItemCommand =>
  cmd.type === "equip-item" || cmd.type === "unequip-item" || cmd.type === "use-item" || cmd.type === "install-mod" || cmd.type === "remove-mod";

/**
 * Inventory commands from the menu (ADR-0015). Pure domain changes through core functions; none
 * consumes randomness or time. A refused command changes nothing; a full bag says so.
 * The player's combatant picks up the new weapon on the next `weapon` step.
 */
export const applyItemCommand = (ctx: SimContext, cmd: ItemCommand): void => {
  const domain = ctx.state.domain;
  const { inventory, equipment } = domain;
  switch (cmd.type) {
    case "equip-item": {
      const r = equip(inventory, equipment, cmd.uid, cmd.slot);
      if (!r.ok) return;
      ctx.state.domain = { ...domain, equipment: r.equipment };
      ctx.bus.emit("ItemEquipped", { uid: cmd.uid, slot: r.slot, replaced: r.replaced });
      return;
    }
    case "unequip-item": {
      const r = unequip(inventory, equipment, cmd.slot);
      if (!r.ok) {
        const uid = equipment[cmd.slot];
        const item = uid === null ? undefined : findItem(inventory, uid);
        if (r.reason === "inventory-full" && item) ctx.bus.emit("InventoryFull", { defId: item.def });
        return;
      }
      ctx.state.domain = { ...domain, equipment: r.equipment };
      ctx.bus.emit("ItemUnequipped", { uid: r.uid, slot: cmd.slot });
      return;
    }
    case "use-item": {
      if (!("stack" in cmd.ref) || !isConsumableId(cmd.ref.stack)) return;
      const player = ctx.world.with("player", "health").first;
      if (!player) return;
      const r = useConsumable(inventory, cmd.ref.stack, player.health);
      if (!r.ok) return;
      player.health = r.health;
      ctx.state.domain = { ...domain, inventory: r.inventory };
      ctx.bus.emit("ItemUsed", { itemId: cmd.ref.stack, healed: r.healed });
      ctx.bus.emit("ItemRemoved", { ref: cmd.ref, qty: 1, reason: "used" });
      return;
    }
    case "install-mod": {
      const r = installMod(inventory, equipment, cmd.weaponUid, cmd.modUid);
      if (!r.ok) return;
      ctx.state.domain = { ...domain, inventory: r.inventory };
      if (r.replaced) ctx.bus.emit("ModRemoved", { weaponUid: cmd.weaponUid, modUid: r.replaced, slot: r.slot });
      ctx.bus.emit("ModInstalled", { weaponUid: cmd.weaponUid, modUid: cmd.modUid, slot: r.slot });
      return;
    }
    case "remove-mod": {
      const r = removeMod(inventory, equipment, cmd.weaponUid, cmd.slot);
      if (!r.ok) {
        const mod = findItem(inventory, findItem(inventory, cmd.weaponUid)?.mods?.[cmd.slot] ?? "");
        if (r.reason === "inventory-full" && mod) ctx.bus.emit("InventoryFull", { defId: mod.def });
        return;
      }
      const ammoId = weaponStatsOf(r.inventory, cmd.weaponUid)?.ammo;
      const ammo = ammoId && r.excess > 0 ? addAmmo(domain.ammo, ammoId, r.excess).ammo : domain.ammo;
      ctx.state.domain = { ...domain, inventory: r.inventory, ammo };
      ctx.bus.emit("ModRemoved", { weaponUid: cmd.weaponUid, modUid: r.modUid, slot: cmd.slot });
      return;
    }
  }
};
