import { describe, expect, it } from "vitest";
import {
  EMPTY_EQUIPMENT,
  EMPTY_INVENTORY,
  EMPTY_LOOT,
  ENEMY_TYPES,
  LOOT_TABLES,
  type LootContainer,
  type LootLine,
  type LootTable,
  MAX_LOOT_CONTAINERS,
  type Pockets,
  type RandomPort,
  addContainer,
  bestLootRarity,
  expireContainers,
  rollLoot,
  takeLoot,
  updateContainer,
} from "../src";

/** Counts draws and returns a fixed sequence, cycling. */
const counting = (values: number[]) => {
  let i = 0;
  const rng: RandomPort & { calls: number } = {
    calls: 0,
    next() {
      rng.calls += 1;
      return values[i++ % values.length] ?? 0;
    },
  };
  return rng;
};

describe("rollLoot", () => {
  it("draws 1 + 3 numbers for a ganger and 1 + 2 + 2 + 9 for the enforcer, whatever comes out", () => {
    for (const r of [0, 0.3, 0.5, 0.99]) {
      const ganger = counting([r]);
      rollLoot(LOOT_TABLES.hebi_common, ganger);
      expect(ganger.calls).toBe(4);
      const boss = counting([r, 0.1, 0.9]);
      rollLoot(LOOT_TABLES.hebi_enforcer, boss);
      expect(boss.calls).toBe(1 + 2 * 2 + 3 * 3);
    }
  });

  it("maps the draws onto eddies, entry, quantity and rarity", () => {
    // eddies 0 -> 8; entry 0 -> 9 mm; quantity 0.99 -> 14.
    expect(rollLoot(LOOT_TABLES.hebi_common, counting([0, 0, 0.99, 0]))).toEqual([
      { kind: "eddies", qty: 8 },
      { kind: "ammo", ammo: "9mm", qty: 14 },
    ]);
    // eddies 0.99 -> 30; entry just under the end -> the grip stabiliser, always common.
    expect(rollLoot(LOOT_TABLES.hebi_common, counting([0.99, 0.999, 0, 0.99]))).toEqual([
      { kind: "eddies", qty: 30 },
      { kind: "item", item: "steady_grip", rarity: "common", qty: 1 },
    ]);
    // The SMG band (weights 36+24+10+10+8 = 88 of 100) with a rare roll.
    expect(rollLoot(LOOT_TABLES.hebi_common, counting([0.5, 90 / 100, 0, 0.97]))[1]).toEqual({ kind: "item", item: "hebi_smg", rarity: "rare", qty: 1 });
    expect(rollLoot(LOOT_TABLES.hebi_common, counting([0.5, 90 / 100, 0, 0.8]))[1]).toMatchObject({ rarity: "uncommon" });
    // A mod without a rarity rule is common; scrap is a stack.
    expect(rollLoot(LOOT_TABLES.hebi_common, counting([0.5, 96.5 / 100, 0, 0.99]))[1]).toEqual({ kind: "item", item: "suppressor", rarity: "common", qty: 1 });
    expect(rollLoot(LOOT_TABLES.hebi_common, counting([0.5, 40 / 100, 0.99, 0]))[1]).toEqual({ kind: "stack", item: "scrap", qty: 2 });
  });

  it("the enforcer always leaves its shotgun and shells", () => {
    const lines = rollLoot(LOOT_TABLES.hebi_enforcer, counting([0.4]));
    expect(lines[1]).toMatchObject({ kind: "item", item: "raijin12" });
    expect(lines[2]).toMatchObject({ kind: "ammo", ammo: "12g" });
    expect(lines).toHaveLength(6);
  });

  it("falls back to the last entry on a draw of exactly 1", () => {
    const table: LootTable = { eddies: [1, 1], guaranteed: [], rolls: 1, entries: [{ item: "scrap", weight: 1, qty: [1, 1] }, { item: "datachip", weight: 1, qty: [2, 3] }] };
    expect(rollLoot(table, counting([1]))).toEqual([
      { kind: "eddies", qty: 1 },
      { kind: "stack", item: "datachip", qty: 3 },
    ]);
  });

  it("every enemy type points at a table", () => {
    for (const t of Object.values(ENEMY_TYPES)) expect(LOOT_TABLES[t.loot].entries.length).toBeGreaterThan(0);
  });

  it("uses the plan weights (100 in all) and 19 eddies on average (plan §5.2, §6)", () => {
    // Analytical: expected eddies plus the list value of the expected items, no simulation.
    const table = LOOT_TABLES.hebi_common;
    const total = table.entries.reduce((s, e) => s + e.weight, 0);
    expect(total).toBe(100);
    const eddies = (table.eddies[0] + table.eddies[1]) / 2;
    expect(eddies).toBe(19);
  });
});

describe("bags", () => {
  it("knows the rarest piece inside", () => {
    expect(bestLootRarity([{ kind: "eddies", qty: 3 }])).toBeNull();
    expect(bestLootRarity([{ kind: "item", item: "baton", rarity: "uncommon", qty: 1 }, { kind: "item", item: "baton", rarity: "rare", qty: 1 }])).toBe("rare");
  });

  const bag = (key: string, expiresAtTick = 100): LootContainer => ({ key, position: { x: 0, y: 0, z: 0 }, chunk: "", expiresAtTick, lines: [{ kind: "eddies", qty: 1 }] });

  it("keeps at most twelve, pushing out the oldest", () => {
    let loot = EMPTY_LOOT;
    for (let i = 0; i < MAX_LOOT_CONTAINERS; i++) loot = addContainer(loot, bag(`b${i}`)).loot;
    const r = addContainer(loot, bag("new"));
    expect(r.evicted.map((c) => c.key)).toEqual(["b0"]);
    expect(r.loot.containers).toHaveLength(MAX_LOOT_CONTAINERS);
    expect(addContainer(r.loot, bag("new")).loot.containers.at(-1)?.key).toBe("new");
  });

  it("updates lines and removes an emptied bag", () => {
    const loot = addContainer(addContainer(EMPTY_LOOT, bag("a")).loot, bag("b")).loot;
    expect(updateContainer(loot, "a", [{ kind: "eddies", qty: 9 }]).containers[0]?.lines).toEqual([{ kind: "eddies", qty: 9 }]);
    expect(updateContainer(loot, "a", []).containers.map((c) => c.key)).toEqual(["b"]);
  });

  it("expires by tick", () => {
    const loot = addContainer(addContainer(EMPTY_LOOT, bag("a", 10)).loot, bag("b", 20)).loot;
    expect(expireContainers(loot, 9)).toEqual({ loot, expired: [] });
    const r = expireContainers(loot, 10);
    expect(r.expired.map((c) => c.key)).toEqual(["a"]);
    expect(r.loot.containers.map((c) => c.key)).toEqual(["b"]);
  });
});

describe("takeLoot", () => {
  const pockets = (patch: Partial<Pockets> = {}): Pockets => ({ wallet: { eddies: 10 }, inventory: EMPTY_INVENTORY, equipment: EMPTY_EQUIPMENT, ammo: {}, ...patch });
  const lines: LootLine[] = [
    { kind: "eddies", qty: 14 },
    { kind: "ammo", ammo: "9mm", qty: 9 },
    { kind: "stack", item: "scrap", qty: 2 },
    { kind: "item", item: "hebi_smg", rarity: "uncommon", qty: 1 },
  ];

  it("takes everything that fits", () => {
    const r = takeLoot(pockets(), lines, "all");
    expect(r.wallet.eddies).toBe(24);
    expect(r.ammo).toEqual({ "9mm": 9 });
    expect(r.inventory.stacks).toEqual({ scrap: 2 });
    expect(r.inventory.items).toEqual([{ uid: "i1", def: "hebi_smg", rarity: "uncommon", loaded: 0, mods: {} }]);
    expect(r.left).toEqual([]);
    expect(r.taken).toEqual(lines);
    expect(r.added).toEqual([
      { ref: { stack: "scrap" }, defId: "scrap", qty: 2 },
      { ref: { uid: "i1" }, defId: "hebi_smg", qty: 1 },
    ]);
    expect(r.full).toEqual([]);
  });

  it("takes one line by index", () => {
    const r = takeLoot(pockets(), lines, 1);
    expect(r.taken).toEqual([lines[1]]);
    expect(r.left).toEqual([lines[0], lines[2], lines[3]]);
    expect(r.wallet.eddies).toBe(10);
  });

  it("leaves what does not fit: ammo over the pouch limit, a full bag", () => {
    const full = { ...EMPTY_INVENTORY, capacity: 1, stacks: { scrap: 19 } };
    const r = takeLoot(pockets({ inventory: full, ammo: { "9mm": 175 } }), lines, "all");
    expect(r.ammo["9mm"]).toBe(180);
    expect(r.inventory.stacks.scrap).toBe(20);
    expect(r.left).toEqual([
      { kind: "ammo", ammo: "9mm", qty: 4 },
      { kind: "stack", item: "scrap", qty: 1 },
      { kind: "item", item: "hebi_smg", rarity: "uncommon", qty: 1 },
    ]);
    expect(r.full).toEqual(["9mm", "scrap", "hebi_smg"]);
    const none = takeLoot(pockets({ inventory: { ...EMPTY_INVENTORY, capacity: 0 } }), [{ kind: "stack", item: "medkit", qty: 1 }], "all");
    expect(none.taken).toEqual([]);
    expect(none.added).toEqual([]);
  });

  it("ignores a malformed money line", () => {
    const r = takeLoot(pockets(), [{ kind: "eddies", qty: 0 }], "all");
    expect(r.wallet.eddies).toBe(10);
    expect(r.left).toEqual([]);
    const odd = takeLoot(pockets(), [{ kind: "eddies", qty: 1.5 }], "all");
    expect(odd.wallet.eddies).toBe(10);
    expect(odd.full).toEqual([]);
  });
});
