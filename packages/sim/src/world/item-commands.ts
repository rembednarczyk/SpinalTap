import {
  STACKABLE_CATALOG,
  type StackableDefinition,
  applyBuff,
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

type ItemCommandType = "equip-item" | "unequip-item" | "use-item" | "drop-item" | "install-mod" | "remove-mod" | "take-loot";

type ItemCommand = Extract<GameCommand, { type: ItemCommandType }>;

type Command<K extends ItemCommandType> = Extract<GameCommand, { type: K }>;

type Domain = SimContext["state"]["domain"];

const equipItem = (ctx: SimContext, cmd: Command<"equip-item">): void => {
  const domain = ctx.state.domain;
  const r = equip(domain.inventory, domain.equipment, cmd.uid, cmd.slot);
  if (!r.ok) return;
  ctx.state.domain = { ...domain, equipment: r.equipment };
  ctx.bus.emit("ItemEquipped", { uid: cmd.uid, slot: r.slot, replaced: r.replaced });
};

const unequipItem = (ctx: SimContext, cmd: Command<"unequip-item">): void => {
  const domain = ctx.state.domain;
  const { inventory, equipment } = domain;
  const r = unequip(inventory, equipment, cmd.slot);
  if (!r.ok) {
    const uid = equipment[cmd.slot];
    const item = uid === null ? undefined : findItem(inventory, uid);
    if (r.reason === "inventory-full" && item) ctx.bus.emit("InventoryFull", { defId: item.def });
    return;
  }
  ctx.state.domain = { ...domain, equipment: r.equipment };
  ctx.bus.emit("ItemUnequipped", { uid: r.uid, slot: cmd.slot });
};

const useItem = (ctx: SimContext, cmd: Command<"use-item">): void => {
  const domain = ctx.state.domain;
  if (!("stack" in cmd.ref) || !isConsumableId(cmd.ref.stack)) return;
  const player = ctx.world.with("player", "health").first;
  if (!player) return;
  const r = useConsumable(domain.inventory, cmd.ref.stack, player.health);
  if (!r.ok) return;
  player.health = r.health;
  // Wave 2 (ADR-0033): a buff starts (or refreshes), a capacity shard counts for good. The body
  // system reports both (BuffApplied, CyberwareCapacityChanged) at its turn in this step.
  const def: StackableDefinition = STACKABLE_CATALOG[cmd.ref.stack];
  const buffs = def.buff ? applyBuff(domain.buffs, def.buff) : domain.buffs;
  const capacityShards = domain.capacityShards + (def.cyberCapacity ? 1 : 0);
  ctx.state.domain = { ...domain, inventory: r.inventory, buffs, capacityShards };
  ctx.bus.emit("ItemUsed", { itemId: cmd.ref.stack, healed: r.healed });
  ctx.bus.emit("ItemRemoved", { ref: cmd.ref, qty: 1, reason: "used" });
};

const installWeaponMod = (ctx: SimContext, cmd: Command<"install-mod">): void => {
  const domain = ctx.state.domain;
  const r = installMod(domain.inventory, domain.equipment, cmd.weaponUid, cmd.modUid);
  if (!r.ok) return;
  ctx.state.domain = { ...domain, inventory: r.inventory };
  if (r.replaced) ctx.bus.emit("ModRemoved", { weaponUid: cmd.weaponUid, modUid: r.replaced, slot: r.slot });
  ctx.bus.emit("ModInstalled", { weaponUid: cmd.weaponUid, modUid: cmd.modUid, slot: r.slot });
};

const takeLootLine = (ctx: SimContext, cmd: Command<"take-loot">): void => {
  const domain = ctx.state.domain;
  const container = domain.loot.containers.find((c) => c.key === cmd.containerKey);
  if (!container) return;
  const r = takeLoot({ wallet: domain.wallet, inventory: domain.inventory, equipment: domain.equipment, ammo: domain.ammo }, container.lines, cmd.line);
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
};

/** Takes what `drop-item` names out of the bag: the loot line it becomes and the domain without it; null if refused. */
const takeOutForDrop = (domain: Domain, cmd: Command<"drop-item">): { line: LootLine; next: Domain } | null => {
  const { inventory, equipment } = domain;
  if ("stack" in cmd.ref) {
    const qty = Math.floor(cmd.qty);
    const inv = removeStack(inventory, cmd.ref.stack, qty);
    if (!inv) return null;
    return { line: { kind: "stack", item: cmd.ref.stack, qty }, next: { ...domain, inventory: inv } };
  }
  const r = removeInstance(inventory, equipment, cmd.ref.uid);
  if (!r.ok) return null;
  const line: LootLine = { kind: "item", item: r.item.def, rarity: r.item.rarity, qty: 1 };
  // Rounds in a dropped gun go back to the pouch first.
  const ammoId = weaponStatsOf(inventory, r.item.uid)?.ammo;
  const ammo = ammoId && (r.item.loaded ?? 0) > 0 ? addAmmo(domain.ammo, ammoId, r.item.loaded ?? 0).ammo : domain.ammo;
  return { line, next: { ...domain, inventory: r.inventory, ammo } };
};

const dropItem = (ctx: SimContext, cmd: Command<"drop-item">): void => {
  const player = ctx.world.with("player").first;
  if (!player) return;
  const out = takeOutForDrop(ctx.state.domain, cmd);
  if (!out) return;
  const { line, next } = out;
  const key = `drop:${next.loot.dropSeq}`;
  ctx.state.domain = { ...next, loot: { ...next.loot, dropSeq: next.loot.dropSeq + 1 } };
  ctx.bus.emit("ItemRemoved", { ref: cmd.ref, qty: line.qty, reason: "dropped" });
  dropLoot(ctx, key, player.position, [line]);
};

const removeWeaponMod = (ctx: SimContext, cmd: Command<"remove-mod">): void => {
  const domain = ctx.state.domain;
  const { inventory, equipment } = domain;
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
};

/**
 * Inventory commands from the menu (ADR-0015). Pure domain changes through core functions; none
 * consumes randomness or time. A refused command changes nothing; a full bag says so.
 * The player's combatant picks up the new weapon on the next `weapon` step.
 */
export const applyItemCommand = (ctx: SimContext, cmd: ItemCommand): void => {
  switch (cmd.type) {
    case "equip-item":
      return equipItem(ctx, cmd);
    case "unequip-item":
      return unequipItem(ctx, cmd);
    case "use-item":
      return useItem(ctx, cmd);
    case "install-mod":
      return installWeaponMod(ctx, cmd);
    case "take-loot":
      return takeLootLine(ctx, cmd);
    case "drop-item":
      return dropItem(ctx, cmd);
    case "remove-mod":
      return removeWeaponMod(ctx, cmd);
  }
};
