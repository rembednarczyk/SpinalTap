import { AMMO_CATALOG, GARMENT_CATALOG, MOD_CATALOG, STACKABLE_CATALOG, WEAPON_CATALOG, isAmmoId, isGarmentId, isStackableId, isWeaponId, itemSummary } from "../items/catalog";
import { RARITY } from "../items/rarity";
import type { AmmoId, GarmentId, ItemCategory, ModId, Rarity, StackableId, WeaponId } from "../items/types";
import type { FactionId } from "../reputation/reputation";

/**
 * The traders of the game (plan §6): doktor Mori's clinic, Oyaji's stall on the market and,
 * since ADR-0026, Fumiko's ramen stall in the market's north row. A shop is plain data;
 * prices and trades are the pure functions in `trade.ts`.
 */
export type ShopId = "clinic" | "oyaji" | "yatai";

export const SHOP_IDS: readonly ShopId[] = ["clinic", "oyaji", "yatai"];

export const isShopId = (v: unknown): v is ShopId => v === "clinic" || v === "oyaji" || v === "yatai";

/** What a shop sells besides implants. Each id appears at most once per shop. */
export type StockEntry =
  | { readonly kind: "stack"; readonly item: StackableId }
  /** A box of `qty` rounds into the pouch. */
  | { readonly kind: "ammo"; readonly item: AmmoId; readonly qty: number }
  | { readonly kind: "item"; readonly item: WeaponId | GarmentId | ModId; readonly rarity: Rarity };

export type ShopItemId = StockEntry["item"];

export interface ShopDefinition {
  readonly id: ShopId;
  readonly name: string;
  /** Faction whose standing sets the terms (and can shut the door). */
  readonly owner: FactionId;
  readonly stock: readonly StockEntry[];
  /** Categories the owner buys from the player. */
  readonly buys: readonly ItemCategory[];
  /** Implants bought here are installed on the spot; implants from the bag are fitted for a fee. */
  readonly implants: boolean;
  /** Mends garments for eddies and weapon parts. */
  readonly repairs: boolean;
  /** Sells the backpack upgrades. */
  readonly backpacks: boolean;
}

export const SHOPS: Readonly<Record<ShopId, ShopDefinition>> = {
  clinic: {
    id: "clinic",
    name: "Klinika doktora Mori",
    owner: "clinic",
    stock: [
      { kind: "stack", item: "medkit" },
      { kind: "stack", item: "bandage" },
    ],
    buys: ["cyberware"],
    implants: true,
    repairs: false,
    backpacks: false,
  },
  oyaji: {
    id: "oyaji",
    name: "Stragan Oyajiego",
    owner: "civilians",
    stock: [
      { kind: "ammo", item: "9mm", qty: 24 },
      { kind: "ammo", item: "44", qty: 6 },
      { kind: "ammo", item: "12g", qty: 8 },
      { kind: "ammo", item: "556", qty: 20 },
      { kind: "item", item: "suppressor", rarity: "common" },
      { kind: "item", item: "holo_sight", rarity: "common" },
      { kind: "item", item: "extended_mag", rarity: "common" },
      { kind: "item", item: "tactical_visor", rarity: "common" },
      { kind: "item", item: "moto_helmet", rarity: "common" },
      { kind: "item", item: "hebi_jacket", rarity: "common" },
      { kind: "item", item: "ballistic_vest", rarity: "common" },
      { kind: "item", item: "kevlar_pants", rarity: "common" },
      { kind: "item", item: "baton", rarity: "common" },
      { kind: "item", item: "hebi_smg", rarity: "uncommon" },
      { kind: "item", item: "oni44", rarity: "common" },
      { kind: "item", item: "raijin12", rarity: "common" },
      { kind: "item", item: "tessen_ar5", rarity: "common" },
    ],
    buys: ["weapon", "consumable", "garment", "cyberware", "mod", "junk"],
    implants: false,
    repairs: true,
    backpacks: true,
  },
  // Street food (ADR-0026): sells, buys nothing back.
  yatai: {
    id: "yatai",
    name: "Ramen u Fumiko",
    owner: "civilians",
    stock: [
      { kind: "stack", item: "ramen" },
      { kind: "stack", item: "yakitori" },
    ],
    buys: [],
    implants: false,
    repairs: false,
    backpacks: false,
  },
};

export const stockEntry = (shop: ShopId, item: ShopItemId): StockEntry | undefined => SHOPS[shop].stock.find((e) => e.item === item);

/** Name of what a stock id stands for (the ammo type for a box of rounds). */
export const shopItemName = (item: ShopItemId): string => (isAmmoId(item) ? AMMO_CATALOG[item].name : itemSummary(item).name);

/** Display name of a stock entry (a box of rounds says how many). */
export const stockName = (entry: StockEntry): string =>
  entry.kind === "ammo" ? `${AMMO_CATALOG[entry.item].name} × ${entry.qty}` : shopItemName(entry.item);

/** Counter text for a stock id. */
export const shopItemDescription = (item: ShopItemId): string => {
  if (isAmmoId(item)) return `Pudełko nabojów ${AMMO_CATALOG[item].name}, prosto do ładownicy.`;
  if (isStackableId(item)) return STACKABLE_CATALOG[item].description;
  return entryDef(item).description;
};

const entryDef = (item: WeaponId | GarmentId | ModId): { readonly name: string; readonly value: number; readonly description: string } =>
  isWeaponId(item) ? WEAPON_CATALOG[item] : isGarmentId(item) ? GARMENT_CATALOG[item] : MOD_CATALOG[item as ModId];

/** List price of a stock entry before the shop's terms: value × rarity, or a box of rounds. */
export const stockListPrice = (entry: StockEntry): number => {
  switch (entry.kind) {
    case "ammo":
      return AMMO_CATALOG[entry.item].value * entry.qty;
    case "stack":
      return STACKABLE_CATALOG[entry.item].value;
    case "item":
      return Math.round(entryDef(entry.item).value * RARITY[entry.rarity].value);
  }
};
