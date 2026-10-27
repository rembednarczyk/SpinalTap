import { HIT_ZONES, type HitZone } from "../combat/combat-rules";
import { type WornGarment, garmentArmor } from "./armor";
import { GARMENT_CATALOG, STACKABLE_CATALOG, type GarmentDefinition, isConsumableId, isWeaponId } from "./catalog";
import { type Equipment, type InventoryState, type ItemInstance, findItem, isPlaced, slotFor } from "./inventory";
import type { EquipSlot, GarmentId, ItemRef, StackableId } from "./types";
import { type WeaponStats, usesAmmo, weaponStatsOf } from "./weapons";

/**
 * What the character menu shows about a piece (plan §7): the bag as cells and the numbers of
 * a piece next to the one it would replace. The menu and the shop read these, so they never
 * work the numbers out on their own.
 */

/** One cell of the bag: a loose instance, or up to one stack's worth of a stackable. */
export type BagCell =
  | { readonly kind: "item"; readonly item: ItemInstance }
  | { readonly kind: "stack"; readonly id: StackableId; readonly qty: number; readonly total: number };

/**
 * The bag as the grid shows it: loose instances in pick-up order, then each stackable split
 * into cells of its stack size. As many cells as `usedCells` counts.
 */
export const bagCells = (inv: InventoryState, eq: Equipment): BagCell[] => {
  const cells: BagCell[] = [];
  for (const item of inv.items) if (!isPlaced(inv, eq, item.uid)) cells.push({ kind: "item", item });
  for (const [id, total] of Object.entries(inv.stacks) as [StackableId, number][]) {
    const per = STACKABLE_CATALOG[id].stack;
    for (let left = total; left > 0; left -= per) cells.push({ kind: "stack", id, qty: Math.min(per, left), total });
  }
  return cells;
};

export type StatKey = "damage" | "rate" | "magazine" | "reload" | "spread" | "range" | `armor-${HitZone}` | "speed" | "heal";

export interface StatLine {
  readonly key: StatKey;
  readonly value: number;
  /** The same number on the piece it would replace; null with nothing to compare against. */
  readonly current: number | null;
  readonly trend: "better" | "worse" | null;
}

export interface ItemComparison {
  /** Slot the piece goes to; null for things that are not worn or held. */
  readonly slot: EquipSlot | null;
  /** The piece in that slot now, if it is another one. */
  readonly against: string | null;
  /** The piece itself sits in the slot. */
  readonly equipped: boolean;
  readonly lines: readonly StatLine[];
}

/** Less is better for these. */
const LOWER_IS_BETTER: readonly StatKey[] = ["reload", "spread"];

type Numbers = ReadonlyMap<StatKey, number>;

const weaponNumbers = (s: WeaponStats): Numbers => {
  const out = new Map<StatKey, number>([
    ["damage", s.damage * s.pellets],
    ["rate", 60 / s.interval],
  ]);
  if (usesAmmo(s)) {
    out.set("magazine", s.magazine);
    out.set("reload", s.reload);
    // Degrees read better than radians.
    out.set("spread", (s.spread.base * 180) / Math.PI);
  }
  out.set("range", s.range);
  return out;
};

const garmentNumbers = (g: WornGarment): Numbers => {
  const out = new Map<StatKey, number>();
  for (const zone of HIT_ZONES) {
    const armor = garmentArmor(g, zone);
    if (armor > 0) out.set(`armor-${zone}`, armor);
  }
  const def: GarmentDefinition = GARMENT_CATALOG[g.def];
  if (def.modifiers?.moveSpeed) out.set("speed", def.modifiers.moveSpeed);
  return out;
};

/** Numbers of a weapon or a garment (anything with a slot). */
const numbersOf = (inv: InventoryState, item: ItemInstance): Numbers =>
  isWeaponId(item.def)
    ? weaponNumbers(weaponStatsOf(inv, item.uid)!)
    : garmentNumbers({ def: item.def as GarmentId, rarity: item.rarity, condition: item.condition ?? 100 });

const trendOf = (key: StatKey, value: number, current: number | null): StatLine["trend"] => {
  if (current === null || Math.abs(value - current) < 1e-9) return null;
  return value > current !== LOWER_IS_BETTER.includes(key) ? "better" : "worse";
};

/** Lines of `mine` beside `theirs`; a number only one of them has counts as 0 on the other. */
const lines = (mine: Numbers, theirs: Numbers | null): StatLine[] => {
  const keys = [...mine.keys()];
  if (theirs) for (const k of theirs.keys()) if (!keys.includes(k)) keys.push(k);
  return keys.map((key) => {
    const value = mine.get(key) ?? 0;
    const current = theirs ? (theirs.get(key) ?? 0) : null;
    return { key, value, current, trend: trendOf(key, value, current) };
  });
};

const NOTHING: ItemComparison = { slot: null, against: null, equipped: false, lines: [] };

/**
 * A piece next to what sits in its slot: weapons by damage per shot, rate, magazine, reload,
 * spread (degrees) and range with rarity and mods applied; garments by armor per zone (with
 * condition) and speed. Consumables show what they heal. Null when the piece is not there.
 */
export const compareItems = (inv: InventoryState, eq: Equipment, ref: ItemRef): ItemComparison | null => {
  if ("stack" in ref) {
    if ((inv.stacks[ref.stack] ?? 0) <= 0) return null;
    if (!isConsumableId(ref.stack)) return NOTHING;
    return { ...NOTHING, lines: [{ key: "heal", value: STACKABLE_CATALOG[ref.stack].heal, current: null, trend: null }] };
  }
  const item = findItem(inv, ref.uid);
  if (!item) return null;
  const slot = slotFor(item.def);
  if (slot === null) return NOTHING;
  const mine = numbersOf(inv, item);
  const equipped = eq[slot] === item.uid;
  const otherUid = equipped ? null : eq[slot];
  const other = otherUid === null ? undefined : findItem(inv, otherUid);
  const theirs = other ? numbersOf(inv, other) : null;
  return { slot, against: other ? other.uid : null, equipped, lines: lines(mine, theirs) };
};
