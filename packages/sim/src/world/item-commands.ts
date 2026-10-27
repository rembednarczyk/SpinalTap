import {
  type GameCommand,
  type ItemDefId,
  type LootLine,
  addAmmo,
  isAmmoId,
  removeInstance,
  removeStack,
  takeLoot,
  updateContainer,
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
import { dropLoot } from "./domain-ops";

const ITEM_COMMANDS = ["equip-item", "unequip-item", "use-item", "drop-item", "install-mod", "remove-mod", "take-loot"] as const;

type ItemCommand = Extract<GameCommand, { type: (typeof ITEM_COMMANDS)[number] }>;

export const isItemCommand = (cmd: GameCommand): cmd is ItemCommand => (ITEM_COMMANDS as readonly string[]).includes(cmd.type);

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
    case "take-loot": {
      const container = domain.loot.containers.find((c) => c.key === cmd.containerKey);
      if (!container) return;
      const r = takeLoot({ wallet: domain.wallet, inventory, equipment, ammo: domain.ammo }, container.lines, cmd.line);
      if (r.taken.length === 0 && r.full.length === 0) return;
      ctx.state.domain = {
        ...domain,
        wallet: r.wallet,
        inventory: r.inventory,
        ammo: r.ammo,
        loot: updateContainer(domain.loot, container.key, r.left),
      };
      const delta = r.wallet.eddies - domain.wallet.eddies;
      if (delta > 0) ctx.bus.emit("EddiesChanged", { balance: r.wallet.eddies, delta, source: "loot" });
      for (const a of r.added) ctx.bus.emit("ItemAdded", { ...a, source: "loot" });
      // A full pouch is no news (the rounds wait in the bag); a full bag is.
      const blocked = r.full.find((id): id is ItemDefId => !isAmmoId(id));
      if (blocked !== undefined) ctx.bus.emit("InventoryFull", { defId: blocked });
      ctx.bus.emit("LootTaken", { containerKey: container.key, lines: r.taken, left: r.left.length });
      return;
    }
    case "drop-item": {
      const player = ctx.world.with("player").first;
      if (!player) return;
      let line: LootLine;
      let next: typeof domain;
      if ("stack" in cmd.ref) {
        const qty = Math.floor(cmd.qty);
        const inv = removeStack(inventory, cmd.ref.stack, qty);
        if (!inv) return;
        line = { kind: "stack", item: cmd.ref.stack, qty };
        next = { ...domain, inventory: inv };
      } else {
        const r = removeInstance(inventory, equipment, cmd.ref.uid);
        if (!r.ok) return;
        line = { kind: "item", item: r.item.def, rarity: r.item.rarity, qty: 1 };
        // Rounds in a dropped gun go back to the pouch first.
        const ammoId = weaponStatsOf(inventory, r.item.uid)?.ammo;
        const ammo = ammoId && (r.item.loaded ?? 0) > 0 ? addAmmo(domain.ammo, ammoId, r.item.loaded ?? 0).ammo : domain.ammo;
        next = { ...domain, inventory: r.inventory, ammo };
      }
      const key = `drop:${next.loot.dropSeq}`;
      ctx.state.domain = { ...next, loot: { ...next.loot, dropSeq: next.loot.dropSeq + 1 } };
      ctx.bus.emit("ItemRemoved", { ref: cmd.ref, qty: line.qty, reason: "dropped" });
      dropLoot(ctx, key, player.position, [line]);
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
