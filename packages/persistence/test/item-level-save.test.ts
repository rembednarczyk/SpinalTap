import { describe, expect, it } from "vitest";
import { INITIAL_PROGRESSION, SAVE_SCHEMA_VERSION, type SaveSnapshot, createDomainState, newInstance } from "@seki/core";
import { MIGRATIONS, checksum, decodeSave, findSchemaError, sanitizeItems, withV28Level } from "../src";
import { snapshot } from "./fixtures";

const wrap = (payload: unknown) => {
  const text = JSON.stringify(payload);
  return JSON.stringify({ format: "seki-save", checksum: checksum(text), payload: text });
};

type Json = Record<string, unknown>;

/** Strips the v29 level and traits off a piece, as a v28 save had it. */
const v28Piece = (p: Json): Json => {
  const { level: _l, traits: _t, ...rest } = p;
  return rest;
};

/** A v28 save of a player at `level` with a bag of the given pieces and one loot bag. */
const v28 = (level: number, items: Json[], lines: Json[]): Json => {
  const s = snapshot();
  const domain = {
    ...s.domain,
    progression: { ...INITIAL_PROGRESSION, level, xp: 0 },
    inventory: { ...s.domain.inventory, items: items.map(v28Piece), nextUid: 20 },
    loot: { containers: [{ key: "loot:g1", position: { x: 0, y: 0, z: 0 }, chunk: "", expiresAtTick: 9000, lines: lines.map(v28Piece) }], dropSeq: 0 },
  };
  return { ...s, version: 28, domain };
};

const piece = (uid: string, def: Parameters<typeof newInstance>[1], rarity: "common" | "uncommon" | "rare" | "unique"): Json => ({ ...newInstance(uid, def, rarity) });

describe("item level in the save (v28 to v29, ADR-0059)", () => {
  it("gives an old save's weapons and garments the level of their tier, in the bag and in the loot bags", () => {
    const items = [piece("i1", "unity9", "common"), piece("i2", "hebi_smg", "uncommon"), piece("i3", "hebi_jacket", "rare"), piece("i4", "oni44", "unique"), piece("i5", "suppressor", "rare")];
    const lines = [
      { kind: "eddies", qty: 10 },
      { kind: "item", item: "raijin12", rarity: "uncommon", qty: 1 },
      { kind: "item", item: "holo_sight", rarity: "rare", qty: 1 },
      { kind: "stack", item: "scrap", qty: 1 },
    ];
    const migrated = MIGRATIONS[28]!(v28(7, items, lines)) as { version: number; domain: SaveSnapshot["domain"] };
    expect(migrated.version).toBe(29);
    expect(migrated.domain.inventory.items.map((i) => [i.def, i.level])).toEqual([
      ["unity9", 1],
      ["hebi_smg", 3],
      ["hebi_jacket", 5],
      ["oni44", 7],
      ["suppressor", undefined],
    ]);
    // The level sits right after the tier, as a new piece has it.
    expect(Object.keys(migrated.domain.inventory.items[1]!)).toEqual(["uid", "def", "rarity", "level", "loaded", "mods"]);
    expect(migrated.domain.loot.containers[0]!.lines).toEqual([
      { kind: "eddies", qty: 10 },
      { kind: "item", item: "raijin12", rarity: "uncommon", level: 3, qty: 1 },
      { kind: "item", item: "holo_sight", rarity: "rare", qty: 1 },
      { kind: "stack", item: "scrap", qty: 1 },
    ]);
  });

  it("loads an old save through the codec into a valid v29 snapshot", () => {
    const loaded = decodeSave("v28", wrap(v28(1, [piece("i1", "unity9", "rare")], [])));
    expect(loaded.version).toBe(SAVE_SCHEMA_VERSION);
    expect(loaded.domain.inventory.items[0]).toMatchObject({ def: "unity9", rarity: "rare", level: 5 });
  });

  it("an old new game migrates to the same bag as a new game of today", () => {
    const fresh = createDomainState();
    const migrated = MIGRATIONS[28]!(v28(1, fresh.inventory.items as unknown as Json[], [])) as { domain: SaveSnapshot["domain"] };
    expect(JSON.stringify(migrated.domain.inventory.items)).toBe(JSON.stringify(fresh.inventory.items));
  });

  it("leaves a piece with a level, a broken piece and a broken save as they are", () => {
    expect(withV28Level({ def: "unity9", rarity: "rare", level: 9 }, "def", 1)).toEqual({ def: "unity9", rarity: "rare", level: 9 });
    expect(withV28Level("junk", "def", 1)).toBe("junk");
    expect(withV28Level({ def: "nope", rarity: "rare" }, "def", 1)).toEqual({ def: "nope", rarity: "rare" });
    // No tier: common; a unique one past the cap stays within 1..30.
    expect(withV28Level({ def: "unity9" }, "def", 1)).toEqual({ def: "unity9", level: 1 });
    expect(withV28Level({ def: "unity9", rarity: "unique" }, "def", 44)).toEqual({ def: "unity9", rarity: "unique", level: 30 });
    expect(withV28Level({ def: "unity9", rarity: "mythic" }, "def", 4)).toEqual({ def: "unity9", rarity: "mythic", level: 1 });
    expect(MIGRATIONS[28]!({ version: 28 })).toEqual({ version: 29, domain: {} });
    const odd = MIGRATIONS[28]!({ version: 28, domain: { inventory: { items: "x" }, loot: { containers: ["x", { lines: "y" }] } } });
    expect(odd).toEqual({ version: 29, domain: { inventory: { items: "x" }, loot: { containers: ["x", { lines: "y" }] } } });
  });
});

describe("validation of levels and traits (v29)", () => {
  const withItem = (item: Json): Json => {
    const s = snapshot();
    return { ...s, domain: { ...s.domain, inventory: { ...s.domain.inventory, items: [...s.domain.inventory.items, item] } } };
  };
  const withLine = (line: Json): Json => {
    const s = snapshot();
    return { ...s, domain: { ...s.domain, loot: { containers: [{ key: "drop:0", position: { x: 0, y: 0, z: 0 }, chunk: "", expiresAtTick: 9, lines: [line] }], dropSeq: 1 } } };
  };

  it("takes a level 1..30 on weapons and garments and the traits of the piece's table", () => {
    expect(findSchemaError(withItem({ uid: "i9", def: "hebi_smg", rarity: "legendary", level: 30, traits: ["silenced", "hot_loads"], loaded: 0, mods: {} }))).toBeNull();
    expect(findSchemaError(withLine({ kind: "item", item: "cargo_pants", rarity: "epic", level: 4, traits: ["padded"], qty: 1 }))).toBeNull();
    // A piece saved without a level is of level 1.
    expect(findSchemaError(withItem({ uid: "i9", def: "hebi_smg", rarity: "rare", loaded: 0, mods: {} }))).toBeNull();
  });

  it("refuses a level out of range or on a mod, and traits of another table, unknown or repeated", () => {
    for (const bad of [
      { uid: "i9", def: "hebi_smg", rarity: "rare", level: 0 },
      { uid: "i9", def: "hebi_smg", rarity: "rare", level: 31 },
      { uid: "i9", def: "hebi_smg", rarity: "rare", level: 2.5 },
      { uid: "i9", def: "suppressor", rarity: "rare", level: 3 },
      { uid: "i9", def: "hebi_smg", rarity: "epic", level: 3, traits: ["padded"] },
      { uid: "i9", def: "hebi_smg", rarity: "epic", level: 3, traits: ["silenced", "silenced"] },
      { uid: "i9", def: "hebi_smg", rarity: "epic", level: 3, traits: [] },
      { uid: "i9", def: "hebi_smg", rarity: "epic", level: 3, traits: "silenced" },
    ]) {
      expect(findSchemaError(withItem(bad)), JSON.stringify(bad)).toBe("inventory items");
    }
    expect(findSchemaError(withLine({ kind: "item", item: "holo_sight", rarity: "rare", level: 3, qty: 1 }))).toBe("loot container");
    // The sanitizer drops such a piece rather than the whole save.
    const s = sanitizeItems(withItem({ uid: "i9", def: "hebi_smg", rarity: "rare", level: 99 }));
    expect(s.warnings).toHaveLength(1);
  });
});
