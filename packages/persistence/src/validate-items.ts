import { EQUIP_SLOTS, WEAPON_SLOTS, isAmmoId, isInstanceDefId, isRarity, isStackableId } from "@seki/core";

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isCount = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;
const isVec = (v: unknown): boolean => isObject(v) && isNum(v.x) && isNum(v.y) && isNum(v.z);
const MOD_SLOTS = ["muzzle", "sight", "magazine"];

const validInstance = (i: unknown): boolean => {
  if (!isObject(i) || typeof i.uid !== "string" || !isInstanceDefId(i.def) || !isRarity(i.rarity)) return false;
  if (i.loaded !== undefined && !isCount(i.loaded)) return false;
  if (i.condition !== undefined && !(isNum(i.condition) && i.condition >= 0 && i.condition <= 100)) return false;
  if (i.mods !== undefined && !(isObject(i.mods) && Object.entries(i.mods).every(([s, u]) => MOD_SLOTS.includes(s) && typeof u === "string"))) return false;
  return true;
};

const validLine = (l: unknown): boolean => {
  if (!isObject(l) || !Number.isInteger(l.qty) || (l.qty as number) < 1) return false;
  switch (l.kind) {
    case "eddies":
      return true;
    case "ammo":
      return isAmmoId(l.ammo);
    case "stack":
      return isStackableId(l.item);
    case "item":
      return isInstanceDefId(l.item) && isRarity(l.rarity) && l.qty === 1;
    default:
      return false;
  }
};

/**
 * Drops item records this build does not know (a removed item, a hand-edited save) instead of
 * refusing the whole save, and clears every reference to them. Returns one warning per drop.
 * Runs on a migrated payload before `findSchemaError`; structural damage is left for it.
 */
export const sanitizeItems = (s: Json): { payload: Json; warnings: string[] } => {
  const warnings: string[] = [];
  const d = s.domain;
  if (!isObject(d) || !isObject(d.inventory) || !Array.isArray(d.inventory.items)) return { payload: s, warnings };
  const items = d.inventory.items.filter((i) => {
    if (validInstance(i)) return true;
    warnings.push(`dropped unknown item ${JSON.stringify(i)}`);
    return false;
  }) as Json[];
  const uids = new Set(items.map((i) => i.uid as string));
  const cleanItems = items.map((i) => {
    if (!isObject(i.mods)) return i;
    const mods = Object.fromEntries(Object.entries(i.mods).filter(([, u]) => uids.has(u as string)));
    return Object.keys(mods).length === Object.keys(i.mods).length ? i : { ...i, mods };
  });
  let equipment = d.equipment;
  if (isObject(equipment)) {
    const eq: Json = { ...equipment };
    for (const slot of EQUIP_SLOTS) if (typeof eq[slot] === "string" && !uids.has(eq[slot])) eq[slot] = null;
    equipment = eq;
  }
  let loot = d.loot;
  if (isObject(loot) && Array.isArray(loot.containers)) {
    loot = {
      ...loot,
      containers: loot.containers.map((c) => {
        if (!isObject(c) || !Array.isArray(c.lines)) return c;
        const lines = c.lines.filter((l) => {
          if (validLine(l)) return true;
          warnings.push(`dropped unknown loot line ${JSON.stringify(l)}`);
          return false;
        });
        return { ...c, lines };
      }),
    };
  }
  return { payload: { ...s, domain: { ...d, inventory: { ...d.inventory, items: cleanItems }, equipment, loot } }, warnings };
};

/** First problem in the item part of the domain, or null. */
export const findItemsError = (d: Json): string | null => {
  const inv = d.inventory;
  if (!isObject(inv) || !isObject(inv.stacks) || !Array.isArray(inv.items) || !Array.isArray(inv.keyItems)) return "inventory";
  for (const [id, n] of Object.entries(inv.stacks)) if (!isStackableId(id) || !isCount(n) || n === 0) return "inventory stacks";
  if (!inv.items.every(validInstance)) return "inventory items";
  if (new Set(inv.items.map((i) => (i as Json).uid)).size !== inv.items.length) return "inventory uids";
  if (!inv.keyItems.every((k) => typeof k === "string")) return "inventory key items";
  if (!isCount(inv.capacity) || !isCount(inv.nextUid)) return "inventory capacity";
  const eq = d.equipment;
  if (!isObject(eq) || !EQUIP_SLOTS.every((slot) => eq[slot] === null || typeof eq[slot] === "string")) return "equipment";
  if (!(WEAPON_SLOTS as readonly unknown[]).includes(eq.active)) return "equipment";
  if (!isObject(d.ammo) || !Object.entries(d.ammo).every(([id, n]) => isAmmoId(id) && isCount(n))) return "ammo";
  const loot = d.loot;
  if (!isObject(loot) || !Array.isArray(loot.containers) || !isCount(loot.dropSeq)) return "loot";
  for (const c of loot.containers) {
    if (!isObject(c) || typeof c.key !== "string" || !isVec(c.position) || typeof c.chunk !== "string") return "loot container";
    if (!Number.isInteger(c.expiresAtTick) || !Array.isArray(c.lines) || !c.lines.every(validLine)) return "loot container";
  }
  return null;
};
