import { credit, type Wallet } from "../economy/wallet";
import type { Vec3 } from "../math/vec3";
import type { RandomPort } from "../ports/random-port";
import { isAmmoId, isStackableId } from "./catalog";
import { type AmmoPouch, type Equipment, type InventoryState, addAmmo, addInstance, addStack } from "./inventory";
import { bestRarity } from "./rarity";
import type { AmmoId, InstanceDefId, ItemDefId, ItemRef, LootLine, Rarity, StackableId } from "./types";

/**
 * A bag in the world (ADR-0015). Domain state, not an ECS snapshot: the simulation spawns a
 * bag entity for every container in a resident chunk.
 */
export interface LootContainer {
  /** "loot:<enemy key>" or "drop:<n>". */
  readonly key: string;
  readonly position: Vec3;
  /** Streaming chunk it lies in; "" outside every chunk. */
  readonly chunk: string;
  /** Simulation tick from which it is gone, loaded or not. */
  readonly expiresAtTick: number;
  readonly lines: readonly LootLine[];
}

export interface LootState {
  /** Oldest first. */
  readonly containers: readonly LootContainer[];
  /** Number of the next player drop ("drop:<n>"). */
  readonly dropSeq: number;
}

export const EMPTY_LOOT: LootState = { containers: [], dropSeq: 0 };

/** Seconds of simulation time a bag stays (plan §5.4). */
export const LOOT_LIFETIME_SECONDS = 300;
/** Most bags lying around at once; a new one pushes out the oldest. */
export const MAX_LOOT_CONTAINERS = 12;

export interface LootEntry {
  readonly item: ItemDefId | AmmoId;
  readonly qty: readonly [min: number, max: number];
  /** "roll": 75 / 20 / 5 common / uncommon / rare. Only instances use it. */
  readonly rarity?: "roll" | Rarity;
}

export interface WeightedLootEntry extends LootEntry {
  readonly weight: number;
}

export interface LootTable {
  readonly eddies: readonly [min: number, max: number];
  readonly guaranteed: readonly LootEntry[];
  /** Draws from `entries`. */
  readonly rolls: number;
  readonly entries: readonly WeightedLootEntry[];
}

export type LootTableId = "hebi_common" | "hebi_enforcer" | "tessen_guard" | "tessen_sniper";

/** Faction base table (plan §5.2). Mods share one weight of 3 between the three of them. */
const HEBI_COMMON: readonly WeightedLootEntry[] = [
  { item: "9mm", weight: 36, qty: [6, 14] },
  { item: "scrap", weight: 24, qty: [1, 2] },
  { item: "medkit", weight: 10, qty: [1, 1] },
  { item: "bandage", weight: 10, qty: [1, 1] },
  { item: "weapon_parts", weight: 8, qty: [1, 1] },
  { item: "hebi_smg", weight: 5, qty: [1, 1], rarity: "roll" },
  { item: "hebi_jacket", weight: 3, qty: [1, 1], rarity: "roll" },
  { item: "suppressor", weight: 1, qty: [1, 1] },
  { item: "holo_sight", weight: 1, qty: [1, 1] },
  { item: "extended_mag", weight: 1, qty: [1, 1] },
  { item: "steady_grip", weight: 1, qty: [1, 1], rarity: "common" },
];

/** Corporate stores (ADR-0024): rifle rounds and medical supplies, the odd plate or chip. */
const TESSEN_COMMON: readonly WeightedLootEntry[] = [
  { item: "556", weight: 34, qty: [10, 20] },
  { item: "medkit", weight: 14, qty: [1, 1] },
  { item: "datachip", weight: 12, qty: [1, 1] },
  { item: "bandage", weight: 10, qty: [1, 2] },
  { item: "weapon_parts", weight: 10, qty: [1, 2] },
  { item: "tessen_ar5", weight: 4, qty: [1, 1], rarity: "roll" },
  { item: "kevlar_pants", weight: 3, qty: [1, 1], rarity: "roll" },
  { item: "tessen_vest", weight: 2, qty: [1, 1], rarity: "roll" },
  // Disguises of the docks (ADR-0033): the guard's uniform off a guard, the staff's overalls from the stores.
  { item: "tessen_uniform", weight: 4, qty: [1, 1], rarity: "common" },
  { item: "tessen_overalls", weight: 2, qty: [1, 1], rarity: "common" },
  { item: "capacity_shard", weight: 1, qty: [1, 1] },
  { item: "holo_sight", weight: 2, qty: [1, 1] },
  { item: "suppressor", weight: 1, qty: [1, 1] },
];

export const LOOT_TABLES: Readonly<Record<LootTableId, LootTable>> = {
  hebi_common: { eddies: [10, 34], guaranteed: [], rolls: 1, entries: HEBI_COMMON },
  hebi_enforcer: {
    eddies: [30, 80],
    guaranteed: [
      { item: "raijin12", qty: [1, 1], rarity: "roll" },
      { item: "12g", qty: [6, 12] },
    ],
    rolls: 3,
    entries: HEBI_COMMON,
  },
  tessen_guard: { eddies: [25, 60], guaranteed: [], rolls: 2, entries: TESSEN_COMMON },
  tessen_sniper: {
    eddies: [30, 70],
    guaranteed: [{ item: "556", qty: [6, 12] }],
    rolls: 1,
    entries: [...TESSEN_COMMON, { item: "kagero_dmr", weight: 6, qty: [1, 1], rarity: "roll" }],
  },
};

/** Integer in [min, max] from one random number. */
const between = (r: number, [min, max]: readonly [number, number]): number => min + Math.min(max - min, Math.floor(r * (max - min + 1)));

const rollRarity = (r: number): Rarity => (r < 0.75 ? "common" : r < 0.95 ? "uncommon" : "rare");

const lineOf = (entry: LootEntry, qtyRoll: number, rarityRoll: number): LootLine => {
  const qty = between(qtyRoll, entry.qty);
  if (isAmmoId(entry.item)) return { kind: "ammo", ammo: entry.item, qty };
  if (isStackableId(entry.item)) return { kind: "stack", item: entry.item, qty };
  const rarity = entry.rarity === undefined ? "common" : entry.rarity === "roll" ? rollRarity(rarityRoll) : entry.rarity;
  return { kind: "item", item: entry.item as InstanceDefId, rarity, qty: 1 };
};

const pick = (entries: readonly WeightedLootEntry[], r: number): WeightedLootEntry => {
  const total = entries.reduce((sum, e) => sum + e.weight, 0);
  let left = r * total;
  for (const e of entries) {
    left -= e.weight;
    if (left < 0) return e;
  }
  return entries[entries.length - 1] as WeightedLootEntry;
};

/**
 * Draws a container's contents. Always the same count of random numbers, whatever comes out:
 * 1 for eddies, 2 per guaranteed entry (quantity, rarity), 3 per roll (entry, quantity,
 * rarity). Changing weights therefore never shifts the stream.
 */
export const rollLoot = (table: LootTable, rng: RandomPort): LootLine[] => {
  const lines: LootLine[] = [{ kind: "eddies", qty: between(rng.next(), table.eddies) }];
  for (const g of table.guaranteed) {
    const q = rng.next();
    lines.push(lineOf(g, q, rng.next()));
  }
  for (let i = 0; i < table.rolls; i++) {
    const entry = pick(table.entries, rng.next());
    const q = rng.next();
    lines.push(lineOf(entry, q, rng.next()));
  }
  return lines;
};

/** Rarest item in the lines, for the bag's neon strip; null when only stacks and money. */
export const bestLootRarity = (lines: readonly LootLine[]): Rarity | null =>
  bestRarity(lines.flatMap((l) => (l.kind === "item" ? [l.rarity] : [])));

export interface Pockets {
  readonly wallet: Wallet;
  readonly inventory: InventoryState;
  readonly equipment: Equipment;
  readonly ammo: AmmoPouch;
}

export interface TakeResult extends Pockets {
  /** What moved, line by line (partial quantities included). */
  readonly taken: readonly LootLine[];
  /** What stays in the container. */
  readonly left: readonly LootLine[];
  /** Pieces added to the inventory, for events. */
  readonly added: readonly { readonly ref: ItemRef; readonly defId: ItemDefId; readonly qty: number }[];
  /** Kinds that did not fit. */
  readonly full: readonly (ItemDefId | AmmoId)[];
}

/**
 * Moves loot lines into the player's pockets: eddies always, ammo up to the pouch limit, stacks
 * and pieces as far as the bag has room. What does not fit stays in the container.
 */
export const takeLoot = (pockets: Pockets, lines: readonly LootLine[], which: number | "all"): TakeResult => {
  let { wallet, inventory, ammo } = pockets;
  const { equipment } = pockets;
  const taken: LootLine[] = [];
  const left: LootLine[] = [];
  const added: { ref: ItemRef; defId: ItemDefId; qty: number }[] = [];
  const full: (ItemDefId | AmmoId)[] = [];
  lines.forEach((line, i) => {
    if (which !== "all" && which !== i) {
      left.push(line);
      return;
    }
    let moved = 0;
    if (line.kind === "eddies") {
      const r = credit(wallet, line.qty);
      if (r.ok) {
        wallet = r.wallet;
        moved = line.qty;
      }
    } else if (line.kind === "ammo") {
      const r = addAmmo(ammo, line.ammo, line.qty);
      ammo = r.ammo;
      moved = r.added;
    } else if (line.kind === "stack") {
      const r = addStack(inventory, equipment, line.item, line.qty);
      inventory = r.inventory;
      moved = r.added;
      if (moved > 0) added.push({ ref: { stack: line.item as StackableId }, defId: line.item, qty: moved });
    } else {
      const r = addInstance(inventory, equipment, line.item, line.rarity);
      if (r.ok) {
        inventory = r.inventory;
        moved = 1;
        added.push({ ref: { uid: r.item.uid }, defId: line.item, qty: 1 });
      }
    }
    if (moved > 0) taken.push({ ...line, qty: moved } as LootLine);
    if (moved < line.qty) {
      left.push({ ...line, qty: line.qty - moved } as LootLine);
      if (line.kind !== "eddies") full.push(line.kind === "ammo" ? line.ammo : line.item);
    }
  });
  return { wallet, inventory, equipment, ammo, taken, left, added, full };
};

/** A container that never expires: a stash placed by the world, not a bag dropped in play. */
export const isPermanentContainer = (c: LootContainer): boolean => c.expiresAtTick === Number.MAX_SAFE_INTEGER;

/**
 * Adds a container at the end; past the limit the oldest ones go and are returned. Stashes
 * (ADR-0021, ADR-0026) neither count towards the limit nor get pushed out: they are placed once
 * and would never come back.
 */
export const addContainer = (loot: LootState, container: LootContainer, limit = MAX_LOOT_CONTAINERS): { loot: LootState; evicted: LootContainer[] } => {
  const all = [...loot.containers.filter((c) => c.key !== container.key), container];
  const dropped = all.filter((c) => !isPermanentContainer(c));
  const evicted = dropped.slice(0, Math.max(0, dropped.length - limit));
  return { loot: { ...loot, containers: evicted.length === 0 ? all : all.filter((c) => !evicted.includes(c)) }, evicted };
};

/** Replaces a container's lines; an emptied container is removed. */
export const updateContainer = (loot: LootState, key: string, lines: readonly LootLine[]): LootState => ({
  ...loot,
  containers: lines.length === 0 ? loot.containers.filter((c) => c.key !== key) : loot.containers.map((c) => (c.key === key ? { ...c, lines } : c)),
});

/** Splits off the containers whose time is up at `tick`. */
export const expireContainers = (loot: LootState, tick: number): { loot: LootState; expired: LootContainer[] } => {
  const expired = loot.containers.filter((c) => c.expiresAtTick <= tick);
  return expired.length === 0 ? { loot, expired } : { loot: { ...loot, containers: loot.containers.filter((c) => c.expiresAtTick > tick) }, expired };
};
