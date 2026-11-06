import { credit, type Wallet } from "../economy/wallet";
import type { Vec3 } from "../math/vec3";
import type { RandomPort } from "../ports/random-port";
import { type StyleKind, styleShares, weaponStyle } from "../progression/style";
import { isAmmoId, isStackableId, isWeaponId } from "./catalog";
import { type AmmoPouch, type Equipment, type InventoryState, type ItemInstance, addAmmo, addInstance, addStack } from "./inventory";
import { MIN_ITEM_LEVEL, enemyLootLevel, hasItemLevel, lootLevel, rollGrade } from "./grade";
import { RARITIES, bestRarity } from "./rarity";
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
  /** "roll": by the item level (`rarityWeights`), 75 / 20 / 5 common / uncommon / rare at level 1. Only instances use it. */
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

/**
 * Faction base table (plan §5.2), 100 in all. Mods share one weight of 3 between the three of
 * them. A ganger's pistol and baton (ADR-0059 stage 6, the user's call), their weight taken from
 * the scrap and the weapon parts.
 */
const HEBI_COMMON: readonly WeightedLootEntry[] = [
  { item: "9mm", weight: 36, qty: [6, 14] },
  { item: "scrap", weight: 22, qty: [1, 2] },
  { item: "medkit", weight: 10, qty: [1, 1] },
  { item: "bandage", weight: 10, qty: [1, 1] },
  { item: "weapon_parts", weight: 6, qty: [1, 1] },
  { item: "hebi_smg", weight: 5, qty: [1, 1], rarity: "roll" },
  { item: "hebi_jacket", weight: 3, qty: [1, 1], rarity: "roll" },
  { item: "unity9", weight: 2, qty: [1, 1], rarity: "roll" },
  { item: "baton", weight: 2, qty: [1, 1], rarity: "roll" },
  { item: "suppressor", weight: 1, qty: [1, 1] },
  { item: "holo_sight", weight: 1, qty: [1, 1] },
  { item: "extended_mag", weight: 1, qty: [1, 1] },
  { item: "steady_grip", weight: 1, qty: [1, 1], rarity: "common" },
];

/**
 * Corporate stores (ADR-0024): rifle rounds and medical supplies, the odd plate or chip. A guard's
 * sidearm and baton (ADR-0059 stage 6) and, rarely, a neural implant off the stores' shelf, their
 * weight taken from the rifle rounds (99 in all, as before).
 */
const TESSEN_COMMON: readonly WeightedLootEntry[] = [
  { item: "556", weight: 29, qty: [10, 20] },
  { item: "medkit", weight: 14, qty: [1, 1] },
  { item: "datachip", weight: 12, qty: [1, 1] },
  { item: "bandage", weight: 10, qty: [1, 2] },
  { item: "weapon_parts", weight: 10, qty: [1, 2] },
  { item: "tessen_ar5", weight: 4, qty: [1, 1], rarity: "roll" },
  { item: "kevlar_pants", weight: 3, qty: [1, 1], rarity: "roll" },
  { item: "tessen_vest", weight: 2, qty: [1, 1], rarity: "roll" },
  { item: "unity9", weight: 2, qty: [1, 1], rarity: "roll" },
  { item: "baton", weight: 2, qty: [1, 1], rarity: "roll" },
  // Disguises of the docks (ADR-0033): the guard's uniform off a guard, the staff's overalls from the stores.
  { item: "tessen_uniform", weight: 4, qty: [1, 1], rarity: "common" },
  { item: "tessen_overalls", weight: 2, qty: [1, 1], rarity: "common" },
  { item: "capacity_shard", weight: 1, qty: [1, 1] },
  { item: "synapse_booster", weight: 1, qty: [1, 1], rarity: "common" },
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
    // The enforcers' own (ADR-0059 stage 6): the revolver and the shirasaya of the gang's hard men.
    entries: [...HEBI_COMMON, { item: "oni44", weight: 2, qty: [1, 1], rarity: "roll" }, { item: "shirasaya", weight: 2, qty: [1, 1], rarity: "roll" }],
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

/**
 * Who drops the loot (ADR-0059): the source's level (an enemy's, by its district's band) and the
 * player's, which keeps the loot in its band, and a stream of its own for the levels and traits,
 * so the old draws of the main stream stay where they were.
 */
export interface LootGrade {
  readonly source: number;
  readonly player: number;
  readonly rng?: RandomPort;
}

/** Level 1 everywhere, every roll of the grade in the middle: the loot as it was before levels. */
export const BASE_LOOT_GRADE: LootGrade = { source: MIN_ITEM_LEVEL, player: MIN_ITEM_LEVEL };

type GradeRolls = readonly [level: number, t1: number, t2: number];

const lineOf = (entry: LootEntry, qtyRoll: number, rarityRoll: number, grade: LootGrade, rolls: GradeRolls, floor?: Rarity): LootLine => {
  const qty = between(qtyRoll, entry.qty);
  if (isAmmoId(entry.item)) return { kind: "ammo", ammo: entry.item, qty };
  if (isStackableId(entry.item)) return { kind: "stack", item: entry.item, qty };
  const item = entry.item as InstanceDefId;
  const level = enemyLootLevel(grade.source, grade.player, rolls[0]);
  return { kind: "item", item, ...rollGrade(item, entry.rarity ?? "common", level, rarityRoll, rolls[1], rolls[2], floor), qty: 1 };
};

/** Three numbers of the grade stream per line, whatever the line is; the middle without a stream. */
const gradeRolls = (grade: LootGrade): GradeRolls => {
  const next = (): number => grade.rng?.next() ?? 0.5;
  return [next(), next(), next()];
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
 * rarity), and 3 more per entry and roll from the grade's own stream (level, two traits).
 * Changing weights therefore never shifts either stream. A rolled tier depends on the level.
 */
export const rollLoot = (table: LootTable, rng: RandomPort, grade: LootGrade = BASE_LOOT_GRADE): LootLine[] => rollLootFor(table, rng, grade, NO_LUCK).lines;

/**
 * Loot fitted to the player (ADR-0059, stage 6): her style of the last fights and her bad luck.
 * `pity` is the count of rolled pieces in a row below rare she has had so far; absent, the bag is
 * not hers to count (an enemy someone else killed) and nothing lifts a tier.
 */
export interface LootLuck {
  readonly style: readonly StyleKind[];
  readonly pity?: number;
}

export const NO_LUCK: LootLuck = { style: [] };

/** A loot entry's weight grows by at most this share for a player whose every fight was of its kind. */
export const STYLE_LOOT_BONUS = 0.6;
/** After this many rolled pieces in a row below rare, the next one is rare at least. */
export const PITY_AFTER = 8;
export const PITY_FLOOR: Rarity = "rare";

/**
 * Pieces that lean to a path rather than a weapon (ADR-0059 stage 6): the suppressor and the
 * disguises (Hebi's jacket, Tessen's uniform and overalls) sneak; the datachip, the capacity shard
 * and the neural Synapse booster hack (the game has no implant of the deck itself yet).
 */
const PATH_OF_ITEM: Partial<Record<ItemDefId | AmmoId, StyleKind>> = {
  suppressor: "stealth",
  hebi_jacket: "stealth",
  tessen_uniform: "stealth",
  tessen_overalls: "stealth",
  datachip: "quickhack",
  capacity_shard: "quickhack",
  synapse_booster: "quickhack",
};

/** The style an entry of the loot tables belongs to: a weapon its kind, a few pieces a path; null for the rest. */
export const lootStyleOf = (item: ItemDefId | AmmoId): StyleKind | null => (isWeaponId(item) ? weaponStyle(item) : (PATH_OF_ITEM[item] ?? null));

/**
 * The table's entries with their weights leant towards the style: an entry of a kind gets
 * `× (1 + STYLE_LOOT_BONUS × share)`, at most +60% for a player who fought with nothing else.
 * The other entries keep their weight, so every kind still drops.
 */
export const styledEntries = (entries: readonly WeightedLootEntry[], style: readonly StyleKind[]): readonly WeightedLootEntry[] => {
  if (style.length === 0) return entries;
  const shares = styleShares(style);
  return entries.map((e) => {
    const kind = lootStyleOf(e.item);
    return kind === null || shares[kind] === 0 ? e : { ...e, weight: e.weight * (1 + STYLE_LOOT_BONUS * shares[kind]) };
  });
};

/** A rare piece or better ends a run of bad luck. */
const breaksLuck = (line: LootLine): boolean => line.kind === "item" && RARITIES.indexOf(line.rarity) >= RARITIES.indexOf(PITY_FLOOR);

/**
 * `rollLoot` fitted to the player: weights by her style and, when the bag is hers (`luck.pity`),
 * the protection against bad luck. A piece of rolled tier is a draw of luck: after PITY_AFTER of
 * them in a row below rare, the next one is rare at least, and a rare one or better starts the
 * count again. Fixed tiers, stacks and money do not count. The same random numbers as `rollLoot`.
 */
export const rollLootFor = (table: LootTable, rng: RandomPort, grade: LootGrade, luck: LootLuck): { lines: LootLine[]; pity?: number } => {
  const entries = styledEntries(table.entries, luck.style);
  let pity = luck.pity;
  const line = (entry: LootEntry, q: number, r: number): LootLine => {
    if (pity === undefined || entry.rarity !== "roll") return lineOf(entry, q, r, grade, gradeRolls(grade));
    const l = lineOf(entry, q, r, grade, gradeRolls(grade), pity >= PITY_AFTER ? PITY_FLOOR : undefined);
    pity = breaksLuck(l) ? 0 : pity + 1;
    return l;
  };
  const lines: LootLine[] = [{ kind: "eddies", qty: between(rng.next(), table.eddies) }];
  for (const g of table.guaranteed) {
    const q = rng.next();
    lines.push(line(g, q, rng.next()));
  }
  for (let i = 0; i < table.rolls; i++) {
    const entry = pick(entries, rng.next());
    const q = rng.next();
    lines.push(line(entry, q, rng.next()));
  }
  return pity === undefined ? { lines } : { lines, pity };
};

/**
 * A fixed container's lines (a stash) found in a district of level `district` (ADR-0059): a weapon
 * or garment the content gives no level gets the district's, kept within the player's ± 2. The
 * tier stays the content's; everything else is as the content has it.
 */
export const stashLines = (lines: readonly LootLine[], district: number, player: number): LootLine[] =>
  lines.map((l) => (l.kind === "item" && l.level === undefined && hasItemLevel(l.item) ? { ...l, level: lootLevel(district, player) } : l));

/** The loot line a piece becomes when dropped: kind, tier, level and traits, nothing of its state. */
export const itemLine = (item: ItemInstance): LootLine => ({
  kind: "item",
  item: item.def,
  rarity: item.rarity,
  ...(item.level === undefined ? {} : { level: item.level }),
  ...(item.traits === undefined ? {} : { traits: item.traits }),
  qty: 1,
});

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
      const r = addInstance(inventory, equipment, line.item, line);
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
