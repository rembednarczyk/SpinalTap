import { describe, expect, it, vi } from "vitest";
import { CorruptSaveError, SAVE_SCHEMA_VERSION, createDomainState } from "@seki/core";
import { MIGRATIONS, checksum, decodeSave, encodeSave, findSchemaError, migrate, sanitizeItems } from "../src";
import { snapshot, v1Payload, v6Payload, v7Payload } from "./fixtures";

const wrap = (payload: unknown) => {
  const text = JSON.stringify(payload);
  return JSON.stringify({ format: "seki-save", checksum: checksum(text), payload: text });
};

const expectCorrupt = (raw: string, reason: RegExp) => {
  expect(() => decodeSave("slot-1", raw)).toThrow(CorruptSaveError);
  expect(() => decodeSave("slot-1", raw)).toThrow(reason);
};

describe("save codec", () => {
  it("round-trips a snapshot losslessly", () => {
    const s = snapshot();
    expect(decodeSave("a", encodeSave(s))).toEqual(s);
  });

  it("rejects non-JSON, unknown formats and checksum mismatches", () => {
    expectCorrupt("{nope", /envelope is not valid JSON/);
    expectCorrupt(JSON.stringify({ format: "other" }), /unknown format/);
    expectCorrupt("null", /unknown format/);
    const tampered = JSON.parse(encodeSave(snapshot())) as { payload: string };
    tampered.payload = tampered.payload.replace('"eddies":120', '"eddies":999999');
    expectCorrupt(JSON.stringify(tampered), /checksum mismatch/);
  });

  it("rejects truncated payloads and non-object payloads", () => {
    const text = JSON.stringify(snapshot()).slice(0, 50);
    expectCorrupt(JSON.stringify({ format: "seki-save", checksum: checksum(text), payload: text }), /payload is not valid JSON/);
    expectCorrupt(wrap([1, 2]), /not an object/);
  });

  it("rejects saves from the future or without a version", () => {
    expectCorrupt(wrap({ ...snapshot(), version: 99 }), /newer version/);
    expectCorrupt(wrap({ ...snapshot(), version: "2" }), /missing schema version/);
  });

  it("names the invalid field", () => {
    expectCorrupt(wrap({ ...snapshot(), entities: [{ key: "p" }] }), /entity shape/);
    const s = snapshot();
    expectCorrupt(wrap({ ...s, domain: { ...s.domain, character: { ...s.domain.character, memories: ["fake"] } } }), /memories/);
    expectCorrupt(wrap({ ...s, domain: { ...s.domain, wallet: { eddies: -1 } } }), /wallet/);
  });
});

describe("migrations", () => {
  it("upgrades a v1 save to the current schema", () => {
    const s = decodeSave("old", wrap(v1Payload()));
    expect(s.version).toBe(SAVE_SCHEMA_VERSION);
    expect(s.domain.wallet).toEqual({ eddies: 250 });
    expect(s.domain.preferences.cameraMode).toBe("FPP");
    expect(s.rngState).toBe(42);
    expect(s.entities.every((e) => e.alerted === false)).toBe(true);
  });

  it("has a migration for every version below the current one", () => {
    for (let v = 1; v < SAVE_SCHEMA_VERSION; v++) expect(MIGRATIONS[v]).toBeTypeOf("function");
  });

  it("leaves current saves untouched and fails on gaps", () => {
    const s = snapshot() as unknown as Record<string, unknown>;
    expect(migrate(s)).toBe(s);
    expect(() => migrate({ version: 0 })).toThrow(/no migration from version 0/);
  });

  it("tolerates a v1 save with missing optional sections", () => {
    const m = migrate({ version: 1, seed: 5 });
    expect(m).toMatchObject({
      version: SAVE_SCHEMA_VERSION,
      rngState: 5,
      entities: [],
      streaming: { loadedChunks: [] },
      domain: {
        wallet: { eddies: 0 },
        inventory: { stacks: { medkit: 1 }, capacity: 24, nextUid: 4 },
        equipment: { secondary: "i1", active: "secondary" },
        ammo: { "9mm": 48 },
        loot: { containers: [], dropSeq: 0 },
        reputation: { clinic: 0 },
        story: { choices: {}, ending: null },
      },
    });
  });

  it("upgrades an M1 (v3) save: the clinic becomes its own neutral faction", () => {
    const s = snapshot();
    const { clinic: _c, ...m1Reputation } = { ...s.domain.reputation, fixers: 12, hebi: -30, civilians: 4 };
    const loaded = decodeSave("m1", wrap({ ...s, version: 3, domain: { ...s.domain, reputation: m1Reputation } }));
    expect(loaded.version).toBe(SAVE_SCHEMA_VERSION);
    expect(loaded.domain.reputation).toEqual({ fixers: 12, hebi: -30, civilians: 4, clinic: 0, kagami: 0, tessen: 0 });
    expect(loaded.domain.inventory).toEqual(s.domain.inventory);
  });

  it("the v3 migration keeps an existing clinic standing and tolerates a missing reputation", () => {
    expect(MIGRATIONS[3]?.({ version: 3, domain: { reputation: { clinic: 7 } } })).toMatchObject({ domain: { reputation: { clinic: 7 } } });
    expect(MIGRATIONS[3]?.({ version: 3 })).toEqual({ version: 4, domain: { reputation: { clinic: 0 } } });
  });

  it("upgrades an M0 (v2) save with the M1 starter kit", () => {
    const s = snapshot();
    const { inventory: _i, contracts: _c, ability: _a, ...domain } = s.domain;
    const loaded = decodeSave("m0", wrap({ ...s, version: 2, domain }));
    expect(loaded.domain.inventory.stacks).toEqual({ medkit: 1 });
    expect(loaded.domain.contracts).toEqual({ active: null, completed: 0 });
    expect(loaded.domain.ability).toEqual({ activeTime: 0, cooldown: 0 });
    expect(loaded.domain.flags).toEqual(s.domain.flags);
  });

  it("upgrades an M2 (v4) save: empty story state, act I started when the first contract is done", () => {
    const s = snapshot();
    const { story: _s, ...domain } = s.domain;
    const fresh = decodeSave("m2", wrap({ ...s, version: 4, domain }));
    expect(fresh.version).toBe(SAVE_SCHEMA_VERSION);
    expect(fresh.domain.story).toEqual({ choices: {}, ending: null, act2Ending: null });
    expect(fresh.domain.quests).toEqual(s.domain.quests);

    const done = { ...domain, quests: { m0_first_contract: { status: "completed" } } };
    const upgraded = decodeSave("m2", wrap({ ...s, version: 4, domain: done }));
    expect(upgraded.domain.quests).toEqual({ m0_first_contract: { status: "completed" }, m3_echo: { status: "active", stepIndex: 0 } });

    // Never resets act I progress that is already there, and tolerates a missing domain.
    const ahead = { ...domain, quests: { m0_first_contract: { status: "completed" }, m3_echo: { status: "active", stepIndex: 2 } } };
    expect(decodeSave("m2", wrap({ ...s, version: 4, domain: ahead })).domain.quests.m3_echo).toEqual({ status: "active", stepIndex: 2 });
    expect(MIGRATIONS[4]!({ version: 4 })).toEqual({ version: 5, domain: { quests: {}, story: { choices: {}, ending: null } } });
  });

  it("walks an M1 (v3) save through both steps: clinic faction (v4), then story state (v5)", () => {
    const s = snapshot();
    const { story: _s, ...domain } = s.domain;
    const { clinic: _c, ...m1Reputation } = domain.reputation;
    const m1 = { ...domain, reputation: m1Reputation, quests: { m0_first_contract: { status: "completed" } } };
    const loaded = decodeSave("m1", wrap({ ...s, version: 3, domain: m1 }));
    expect(loaded.version).toBe(SAVE_SCHEMA_VERSION);
    expect(loaded.domain.reputation.clinic).toBe(0);
    expect(loaded.domain.story).toEqual({ choices: {}, ending: null, act2Ending: null });
    expect(loaded.domain.quests.m3_echo).toEqual({ status: "active", stepIndex: 0 });
  });

  it("keeps story choices and the ending through the round trip", () => {
    const s = snapshot();
    const story = { choices: { case: "opened" as const, name: "silent" as const, crash: "wheel" as const }, ending: "aya" as const, act2Ending: null };
    const withStory = { ...s, domain: { ...s.domain, story } };
    expect(decodeSave("st", encodeSave(withStory)).domain.story).toEqual(story);
  });

  it("upgrades an M3 (v5) save to world streaming with nothing preloaded", () => {
    const { streaming: _s, ...v5 } = snapshot();
    const loaded = decodeSave("m3", wrap({ ...v5, version: 5 }));
    expect(loaded.version).toBe(SAVE_SCHEMA_VERSION);
    expect(loaded.streaming).toEqual({ loadedChunks: [] });
    expect(loaded.entities).toEqual(v5.entities);
    expect(loaded.domain).toEqual(v5.domain);
  });

  it("upgrades an M2 streaming (v6) save to the day clock, telling the time from the saved tick", () => {
    const s = snapshot({ tick: 5400 });
    const { clock: _c, ...v6Domain } = s.domain;
    const loaded = decodeSave("m2", wrap({ ...s, version: 6, domain: v6Domain }));
    expect(loaded.version).toBe(SAVE_SCHEMA_VERSION);
    // 21:00 plus 5400 ticks of one game second each: 22:30.
    expect(loaded.domain.clock).toEqual({ seconds: 21 * 3600 + 5400 });
    expect(loaded.domain).toEqual({ ...v6Domain, clock: { seconds: 81000 } });
    expect(loaded.entities).toEqual(s.entities);
    expect(loaded.streaming).toEqual(s.streaming);
  });

  it("the v6 migration keeps an existing clock and tolerates a missing tick or domain", () => {
    expect(MIGRATIONS[6]!({ version: 6, domain: { clock: { seconds: 5 } } })).toEqual({ version: 7, domain: { clock: { seconds: 5 } } });
    expect(MIGRATIONS[6]!({ version: 6, tick: -3 })).toEqual({ version: 7, tick: -3, domain: { clock: { seconds: 75600 } } });
  });

  it("keeps the clock of a current save through the round trip", () => {
    const s = snapshot();
    const later = { ...s, domain: { ...s.domain, clock: { seconds: 200_000 } } };
    expect(decodeSave("t", encodeSave(later)).domain.clock).toEqual({ seconds: 200_000 });
  });

  it("keeps the streaming state of a current save through the round trip", () => {
    const s = snapshot({ streaming: { loadedChunks: ["kanal", "targ-south"] } });
    expect(decodeSave("s", encodeSave(s)).streaming.loadedChunks).toEqual(["kanal", "targ-south"]);
  });

  it("keeps an active contract through the round trip", () => {
    const s = snapshot();
    const contract = { id: "c2", siteId: "east_lot" as const, targets: 3, reward: 700, status: "active" as const };
    const withContract = { ...s, domain: { ...s.domain, contracts: { active: contract, completed: 1 } } };
    expect(decodeSave("c", encodeSave(withContract)).domain.contracts.active).toEqual(contract);
  });

  it("keeps a market contract (M4 fields) through the round trip without a schema bump", () => {
    const s = snapshot();
    const contract = { id: "c3", kind: "delivery" as const, siteId: "hana_stall" as const, targets: 0, reward: 325, status: "active" as const, deadlineTick: 4800 };
    const withContract = { ...s, domain: { ...s.domain, contracts: { active: contract, completed: 2 } } };
    expect(decodeSave("c", encodeSave(withContract)).domain.contracts.active).toEqual(contract);
  });

  it("keeps the street life of ADR-0026 in a v10 save: the job under the footbridge, street food, a placed stash", () => {
    const s = snapshot();
    const contract = { id: "c4", siteId: "kanal_bridge" as const, targets: 2, reward: 500, status: "active" as const };
    const stash = { key: "stash:kanal-alley", position: { x: 9.1, y: 0, z: 55.6 }, chunk: "kanal", expiresAtTick: Number.MAX_SAFE_INTEGER, lines: [{ kind: "stack" as const, item: "yakitori" as const, qty: 2 }] };
    const street = {
      ...s,
      entities: [...s.entities, { key: "hideo", position: { x: 52.6, y: 5, z: 75.4 }, yaw: 0, pitch: 0, hp: null, cooldown: 0, alerted: false }],
      domain: {
        ...s.domain,
        flags: [...s.domain.flags, "placed:stash:kanal-alley", "met_fumiko"],
        contracts: { active: contract, completed: 3 },
        inventory: { ...s.domain.inventory, stacks: { ...s.domain.inventory.stacks, ramen: 2, yakitori: 1 } },
        loot: { ...s.domain.loot, containers: [stash] },
      },
    };
    const back = decodeSave("w", encodeSave(street));
    expect(back.version).toBe(SAVE_SCHEMA_VERSION);
    expect(back.domain.contracts.active).toEqual(contract);
    expect(back.domain.inventory.stacks).toMatchObject({ ramen: 2, yakitori: 1 });
    expect(back.domain.loot.containers).toEqual([stash]);
    expect(back.entities.map((e) => e.key)).toContain("hideo");
  });
});

describe("schema validation", () => {
  it("accepts a well-formed snapshot", () => {
    expect(findSchemaError(snapshot() as unknown as Record<string, unknown>)).toBeNull();
  });

  it.each([
    ["seed", { seed: Number.NaN }],
    ["narrative", { narrative: 5 }],
    ["meta", { meta: { label: 1 } }],
    ["entities", { entities: {} }],
    ["streaming", { streaming: null }],
    ["streaming", { streaming: { loadedChunks: "kanal" } }],
    ["streaming", { streaming: { loadedChunks: [3] } }],
  ])("rejects a bad %s", (_name, patch) => {
    expect(findSchemaError({ ...snapshot(), ...patch } as unknown as Record<string, unknown>)).not.toBeNull();
  });

  it.each([
    ["quests", { quests: { q: { status: "active", stepIndex: 0.5 } } }],
    ["quests", { quests: { q: { status: "weird" } } }],
    ["flags", { flags: [1] }],
    ["preferences", { preferences: { cameraMode: "VR" } }],
    ["reputation", { reputation: { fixers: 0 } }],
    ["reputation", { reputation: { fixers: 0, hebi: 0, civilians: 0 } }],
    ["inventory", { inventory: { medkit: 1 } }],
    ["inventory stacks", { inventory: { ...createDomainState().inventory, stacks: { medkit: -1 } } }],
    ["inventory stacks", { inventory: { ...createDomainState().inventory, stacks: { rocket: 1 } } }],
    ["inventory stacks", { inventory: { ...createDomainState().inventory, stacks: { medkit: 0 } } }],
    ["inventory items", { inventory: { ...createDomainState().inventory, items: [{ uid: "i1", def: "unity9", rarity: "common", loaded: -1 }] } }],
    ["inventory items", { inventory: { ...createDomainState().inventory, items: [{ uid: "i1", def: "unity9", rarity: "common", condition: 101 }] } }],
    ["inventory items", { inventory: { ...createDomainState().inventory, items: [{ uid: "i1", def: "unity9", rarity: "common", mods: { barrel: "i2" } }] } }],
    ["inventory uids", { inventory: { ...createDomainState().inventory, items: [{ uid: "i1", def: "unity9", rarity: "common" }, { uid: "i1", def: "baton", rarity: "common" }] } }],
    ["inventory key items", { inventory: { ...createDomainState().inventory, keyItems: [1] } }],
    ["inventory capacity", { inventory: { ...createDomainState().inventory, capacity: -1 } }],
    ["equipment", { equipment: { ...createDomainState().equipment, head: 3 } }],
    ["equipment", { equipment: { ...createDomainState().equipment, active: "torso" } }],
    ["equipment", { equipment: null }],
    ["ammo", { ammo: { "9mm": 1.5 } }],
    ["ammo", { ammo: { rocket: 1 } }],
    ["loot", { loot: { containers: [], dropSeq: -1 } }],
    ["loot container", { loot: { dropSeq: 0, containers: [{ key: "k", position: { x: 0, y: 0 }, chunk: "a", expiresAtTick: 1, lines: [] }] } }],
    ["loot container", { loot: { dropSeq: 0, containers: [{ key: "k", position: { x: 0, y: 0, z: 0 }, chunk: "a", expiresAtTick: 1.5, lines: [] }] } }],
    ["loot container", { loot: { dropSeq: 0, containers: [{ key: "k", position: { x: 0, y: 0, z: 0 }, chunk: "a", expiresAtTick: 1, lines: [{ kind: "eddies", qty: 0 }] }] } }],
    ["contracts", { contracts: { active: null, completed: 0.5 } }],
    ["contracts", { contracts: { active: { id: "c1", siteId: "moon", targets: 2, reward: 1, status: "active" }, completed: 0 } }],
    ["contracts", { contracts: { active: { id: "c1", siteId: "east_lot", targets: 2, reward: 1, status: "done" }, completed: 0 } }],
    ["contract kind", { contracts: { active: { id: "c1", kind: "heist", siteId: "east_lot", targets: 2, reward: 1, status: "active" }, completed: 0 } }],
    ["contract deadline", { contracts: { active: { id: "c1", kind: "delivery", siteId: "hana_stall", targets: 0, reward: 1, status: "active", deadlineTick: 1.5 }, completed: 0 } }],
    ["ability", { ability: { activeTime: "x", cooldown: 0 } }],
    ["cyberware", { character: { alias: null, memories: [], cyberware: { optics: "fake" } } }],
    ["story", { story: null }],
    ["story", { story: { choices: [], ending: null } }],
    ["story choices", { story: { choices: { mood: "opened" }, ending: null } }],
    ["story choices", { story: { choices: { case: "wheel" }, ending: null } }],
    ["story choices", { story: { choices: { case: 1 }, ending: null } }],
    ["story ending", { story: { choices: {}, ending: "happy" } }],
    ["clock", { clock: null }],
    ["clock", { clock: { seconds: 1.5 } }],
    ["clock", { clock: { seconds: -60 } }],
    ["story ending", { story: { choices: {}, ending: 0 } }],
  ])("rejects bad domain %s", (_name, patch) => {
    const s = snapshot();
    expect(findSchemaError({ ...s, domain: { ...s.domain, ...patch } } as unknown as Record<string, unknown>)).not.toBeNull();
  });
});

describe("inventory migration (v7 to v8, ADR-0015)", () => {
  it("turns a v6 medkit counter into the slot inventory with the starter weapon and clothes", () => {
    const loaded = decodeSave("v6", wrap(v6Payload(3)));
    expect(loaded.version).toBe(SAVE_SCHEMA_VERSION);
    expect(loaded.domain.inventory).toEqual({
      stacks: { medkit: 3 },
      items: [
        { uid: "i1", def: "unity9", rarity: "common", loaded: 12, mods: {} },
        { uid: "i2", def: "seki_jacket", rarity: "common", condition: 100 },
        { uid: "i3", def: "cargo_pants", rarity: "common", condition: 100 },
      ],
      keyItems: [],
      capacity: 24,
      nextUid: 4,
    });
    expect(loaded.domain.equipment).toEqual({ primary: null, secondary: "i1", melee: null, head: null, torso: "i2", legs: "i3", active: "secondary" });
    expect(loaded.domain.ammo).toEqual({ "9mm": 48 });
    expect(loaded.domain.loot).toEqual({ containers: [], dropSeq: 0 });
    // The new game starts with the same kit, so old and new saves play alike.
    const fresh = createDomainState();
    expect(loaded.domain.equipment).toEqual(fresh.equipment);
    expect(loaded.domain.inventory.items).toEqual(fresh.inventory.items);
  });

  it("upgrades a v7 save with the day clock, keeping the clock, and an empty medkit counter", () => {
    const v7 = v7Payload(0);
    const loaded = decodeSave("v7", wrap(v7));
    expect(loaded.version).toBe(SAVE_SCHEMA_VERSION);
    expect(loaded.domain.inventory.stacks).toEqual({});
    expect(loaded.domain.clock).toEqual(v7.domain.clock);
    expect(loaded.domain.equipment.secondary).toBe("i1");
  });

  it("a v6 save gets both the clock (v7) and the inventory (v8)", () => {
    const loaded = decodeSave("v6", wrap(v6Payload(1)));
    expect(loaded.domain.clock).toBeDefined();
    expect(loaded.domain.inventory.stacks).toEqual({ medkit: 1 });
  });

  it("chains every old version to the current one", () => {
    for (const version of [2, 3, 4, 5, 6, 7]) {
      const loaded = decodeSave(`v${version}`, wrap({ ...(version < 7 ? v6Payload(2) : v7Payload(2)), version }));
      expect(loaded.version).toBe(SAVE_SCHEMA_VERSION);
      expect(loaded.domain.inventory.stacks.medkit).toBe(2);
      expect(loaded.domain.equipment.secondary).toBe("i1");
    }
  });

  it("tolerates a missing domain and keeps sections that already exist", () => {
    expect(MIGRATIONS[7]!({ version: 7 })).toMatchObject({ version: 8, domain: { inventory: { stacks: {} }, ammo: { "9mm": 48 } } });
    const current = snapshot();
    const again = MIGRATIONS[7]!({ ...current, version: 7 } as unknown as Record<string, unknown>);
    expect(again.domain).toEqual(current.domain);
    expect(MIGRATIONS[7]!({ version: 7, domain: { inventory: { medkit: 1.5 } } })).toMatchObject({ domain: { inventory: { stacks: {} } } });
  });

  it("round-trips weapons, mods, ammo and a bag in an unloaded chunk", () => {
    const s = snapshot();
    const domain = {
      ...s.domain,
      inventory: {
        ...s.domain.inventory,
        items: [
          ...s.domain.inventory.items,
          { uid: "i4", def: "hebi_smg" as const, rarity: "rare" as const, loaded: 17, mods: { muzzle: "i5" } },
          { uid: "i5", def: "suppressor" as const, rarity: "common" as const },
        ],
        nextUid: 6,
      },
      equipment: { ...s.domain.equipment, primary: "i4", active: "primary" as const },
      ammo: { "9mm": 31, "12g": 6 },
      loot: {
        dropSeq: 1,
        containers: [
          {
            key: "loot:c1-g0",
            position: { x: 3, y: 0, z: 140 },
            chunk: "targ-south",
            expiresAtTick: 20_000,
            lines: [
              { kind: "eddies" as const, qty: 14 },
              { kind: "ammo" as const, ammo: "9mm" as const, qty: 9 },
              { kind: "stack" as const, item: "scrap" as const, qty: 2 },
              { kind: "item" as const, item: "hebi_jacket" as const, rarity: "uncommon" as const, qty: 1 as const },
            ],
          },
        ],
      },
    };
    const withLoot = { ...s, domain };
    expect(decodeSave("loot", encodeSave(withLoot))).toEqual(withLoot);
  });

  it("drops an item of unknown kind with a warning and still loads", () => {
    const s = snapshot();
    const broken = {
      ...s,
      domain: {
        ...s.domain,
        inventory: {
          ...s.domain.inventory,
          items: [
            ...s.domain.inventory.items,
            { uid: "i4", def: "plasma_rifle", rarity: "common" },
            { uid: "i5", def: "hebi_smg", rarity: "common", loaded: 0, mods: { muzzle: "i6", sight: "i7" } },
            { uid: "i6", def: "laser_sight", rarity: "common" },
            { uid: "i7", def: "holo_sight", rarity: "common" },
          ],
        },
        equipment: { ...s.domain.equipment, primary: "i4", head: "i6" },
        loot: {
          dropSeq: 0,
          containers: [{ key: "k", position: { x: 0, y: 0, z: 0 }, chunk: "", expiresAtTick: 9, lines: [{ kind: "item", item: "plasma_rifle", rarity: "rare", qty: 1 }, { kind: "eddies", qty: 3 }] }],
        },
      },
    };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const loaded = decodeSave("broken", wrap(broken));
    expect(loaded.domain.inventory.items.map((i) => i.uid)).toEqual(["i1", "i2", "i3", "i5", "i7"]);
    expect(loaded.domain.inventory.items.find((i) => i.uid === "i5")?.mods).toEqual({ sight: "i7" });
    expect(loaded.domain.equipment).toMatchObject({ primary: null, head: null, secondary: "i1" });
    expect(loaded.domain.loot.containers[0]?.lines).toEqual([{ kind: "eddies", qty: 3 }]);
    expect(warn).toHaveBeenCalledTimes(3);
    warn.mockRestore();
  });

  it("leaves structural damage to the schema check", () => {
    expect(sanitizeItems({ domain: { inventory: {} } }).warnings).toEqual([]);
    expect(sanitizeItems({ domain: 3 }).warnings).toEqual([]);
    const s = snapshot();
    const odd = { ...s, domain: { ...s.domain, equipment: null, loot: { containers: [null, { key: "x" }], dropSeq: 0 } } };
    const r = sanitizeItems(odd as unknown as Record<string, unknown>);
    expect(r.warnings).toEqual([]);
    expect(findSchemaError(r.payload)).toBe("equipment");
    for (const line of [{ kind: "ammo", ammo: "rocket", qty: 1 }, { kind: "stack", item: "rocket", qty: 1 }, { kind: "item", item: "baton", rarity: "common", qty: 2 }, { kind: "gift", qty: 1 }]) {
      const bag = { ...s, domain: { ...s.domain, loot: { dropSeq: 0, containers: [{ key: "k", position: { x: 0, y: 0, z: 0 }, chunk: "", expiresAtTick: 1, lines: [line] }] } } };
      expect(findSchemaError(bag as unknown as Record<string, unknown>)).toBe("loot container");
    }
  });
});

describe("act II migration (v8 to v9, ADR-0023)", () => {
  /** What v8 wrote: no Kagami faction, no act-II ending, the act-I ending only in `story`. */
  const v8Payload = (patch: { quests?: object; story?: object; flags?: string[] } = {}) => {
    const s = snapshot();
    const { kagami: _k, ...reputation } = s.domain.reputation;
    const { act2Ending: _a, ...story } = s.domain.story;
    return { ...s, version: 8, domain: { ...s.domain, reputation, story: { ...story, ...patch.story }, quests: patch.quests ?? s.domain.quests, flags: patch.flags ?? s.domain.flags } };
  };

  it("adds a neutral Kagami faction and an empty act-II ending, and leaves an unfinished act I alone", () => {
    const loaded = decodeSave("v8", wrap(v8Payload()));
    expect(loaded.version).toBe(SAVE_SCHEMA_VERSION);
    expect(loaded.domain.reputation.kagami).toBe(0);
    expect(loaded.domain.story).toEqual({ choices: {}, ending: null, act2Ending: null });
    expect(loaded.domain.quests).toEqual(snapshot().domain.quests);
    expect(loaded.domain.flags).toEqual(["met_fixer"]);
  });

  it("starts act II after a finished act I and keeps its ending as a flag", () => {
    const done = { m0_first_contract: { status: "completed" }, m3_echo: { status: "completed" } };
    const loaded = decodeSave(
      "v8",
      wrap(v8Payload({ quests: done, story: { choices: { case: "sealed", name: "silent", crash: "ren" }, ending: "seki" }, flags: ["act1_ending", "met_fixer"] })),
    );
    expect(loaded.domain.quests).toEqual({ ...done, m3_lustro: { status: "active", stepIndex: 0 } });
    expect(loaded.domain.flags).toEqual(["act1_ending", "ending:seki", "met_fixer"]);
    expect(loaded.domain.story).toEqual({ choices: { case: "sealed", name: "silent", crash: "ren" }, ending: "seki", act2Ending: null });
  });

  it("never restarts act II, keeps what is there and tolerates a missing domain", () => {
    const ahead = { m3_echo: { status: "completed" }, m3_lustro: { status: "active", stepIndex: 2 } };
    expect(decodeSave("v8", wrap(v8Payload({ quests: ahead, story: { ending: "aya" }, flags: ["ending:aya"] }))).domain).toMatchObject({
      quests: ahead,
      flags: ["ending:aya"],
    });
    expect(MIGRATIONS[8]!({ version: 8 })).toEqual({
      version: 9,
      domain: { reputation: { kagami: 0 }, story: { choices: {}, ending: null, act2Ending: null }, quests: {}, flags: [] },
    });
    const current = snapshot();
    expect(MIGRATIONS[8]!({ ...current, version: 8 } as unknown as Record<string, unknown>).domain).toEqual(current.domain);
  });

  it("validates the act-II ending of a current save", () => {
    const s = snapshot();
    const story = { choices: { archive: "hebi" as const, rooftop: "alone" as const }, ending: "aya" as const, act2Ending: "hebi" as const };
    expect(decodeSave("st", encodeSave({ ...s, domain: { ...s.domain, story } })).domain.story).toEqual(story);
    const bad = { ...s, domain: { ...s.domain, story: { ...story, act2Ending: "aya" } } };
    expect(findSchemaError(bad as unknown as Record<string, unknown>)).toBe("story ending");
  });
});

describe("Tessen standing (v9 to v10, ADR-0024)", () => {
  /** What v9 wrote: no Tessen. */
  const v9Payload = () => {
    const s = snapshot();
    const { tessen: _t, ...reputation } = s.domain.reputation;
    return { ...s, version: 9, domain: { ...s.domain, reputation: { ...reputation, hebi: -12 } } };
  };

  it("adds a neutral Tessen and keeps the other standings", () => {
    const loaded = decodeSave("v9", wrap(v9Payload()));
    expect(loaded.version).toBe(SAVE_SCHEMA_VERSION);
    expect(loaded.domain.reputation).toEqual({ fixers: 0, hebi: -12, civilians: 0, clinic: 0, kagami: 0, tessen: 0 });
  });

  it("tolerates a missing domain and keeps a standing that is already there", () => {
    expect(MIGRATIONS[9]!({ version: 9 })).toEqual({ version: 10, domain: { reputation: { tessen: 0 } } });
    expect(MIGRATIONS[9]!({ version: 9, domain: { reputation: { tessen: -20 } } })).toMatchObject({ domain: { reputation: { tessen: -20 } } });
  });

  it("a save without Tessen is rejected unless migrated", () => {
    const { version: _v, ...rest } = v9Payload();
    expect(findSchemaError({ ...rest, version: SAVE_SCHEMA_VERSION } as unknown as Record<string, unknown>)).toBe("reputation");
  });

  it("checks a hack's clock when it is there", () => {
    const s = snapshot();
    const hack = { id: "c4", kind: "hack", siteId: "quay_terminal", targets: 3, reward: 700, status: "active", progress: 120, away: 0 } as const;
    const withHack = { ...s, domain: { ...s.domain, contracts: { active: hack, completed: 3 } } };
    expect(decodeSave("hack", encodeSave(withHack)).domain.contracts.active).toEqual(hack);
    for (const bad of [-1, 1.5, "3"]) {
      const broken = { ...withHack, domain: { ...withHack.domain, contracts: { active: { ...hack, progress: bad }, completed: 3 } } };
      expect(findSchemaError(broken as unknown as Record<string, unknown>)).toBe("contract progress");
    }
  });
});

describe("heat, cyberdeck and debrief counters (v10 to v11, ADR-0029)", () => {
  /** What v10 wrote: no heat, no cyberdeck, a running contract without counters. */
  const v10Payload = () => {
    const s = snapshot();
    const { heat: _h, netrun: _n, ...domain } = s.domain;
    const job = { id: "c2", kind: "retrieve", siteId: "hebi_stash", targets: 2, reward: 470, status: "active" } as const;
    return { ...s, version: 10, domain: { ...domain, contracts: { active: job, completed: 1 } } };
  };

  it("adds no heat, a full deck and counters starting at the save's tick", () => {
    const loaded = decodeSave("v10", wrap(v10Payload()));
    expect(loaded.version).toBe(SAVE_SCHEMA_VERSION);
    expect(loaded.domain.heat).toEqual({ level: 0, faction: null, searching: false, lastKnown: null, searchLeft: 0, cooldown: 0 });
    expect(loaded.domain.netrun).toEqual({ ram: 8, upload: null });
    expect(loaded.domain.contracts.tally).toEqual({ startTick: 900, detected: false, alarm: false, extraKills: 0, damaged: false, hacked: false, bonusLost: false });
  });

  it("tolerates a missing domain and keeps what is already there", () => {
    expect(MIGRATIONS[10]!({ version: 10 })).toMatchObject({ version: 11, domain: { netrun: { ram: 8, upload: null }, contracts: { active: null } } });
    const heat = { level: 2, faction: "hebi", searching: true, lastKnown: { x: 1, y: 0, z: 2 }, searchLeft: 4, cooldown: 0 };
    expect(MIGRATIONS[10]!({ version: 10, domain: { heat } })).toMatchObject({ domain: { heat } });
  });

  it("validates heat, the upload and the counters of a current save", () => {
    const s = snapshot();
    const upload = { hackId: "ping", target: "dev:doki-yard-cam", left: 0.3, ram: 2 } as const;
    const withUpload = { ...s, domain: { ...s.domain, netrun: { ram: 3.5, upload } } };
    expect(decodeSave("u", encodeSave(withUpload)).domain.netrun.upload).toEqual(upload);
    const bad = (domain: Record<string, unknown>) => findSchemaError({ ...s, domain: { ...s.domain, ...domain } } as unknown as Record<string, unknown>);
    expect(bad({ heat: { ...s.domain.heat, level: 4 } })).toBe("heat");
    expect(bad({ heat: { ...s.domain.heat, faction: "ncpd" } })).toBe("heat");
    expect(bad({ netrun: { ram: -1, upload: null } })).toBe("netrun");
    expect(bad({ netrun: { ram: 2, upload: { ...upload, hackId: "suicide" } } })).toBe("netrun upload");
    const job = { id: "c2", kind: "retrieve", siteId: "hebi_stash", targets: 2, reward: 470, status: "active" };
    expect(bad({ contracts: { active: job, completed: 1, tally: { startTick: 1 } } })).toBe("contract tally");
    const entity = { key: "g", position: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, hp: 1, cooldown: 0, alerted: false, search: "x" };
    expect(findSchemaError({ ...s, entities: [entity] } as unknown as Record<string, unknown>)).toBe("entity g search");
  });
});

describe("buffs, capacity shards and the disguise (v12 to v13, ADR-0033)", () => {
  /** What v12 wrote: none of the wave 2 body state. */
  const v12Payload = () => {
    const s = snapshot();
    const { buffs: _b, capacityShards: _c, disguise: _d, ...domain } = s.domain;
    return { ...s, version: 12, domain };
  };

  it("adds no buffs, no shards and no disguise", () => {
    const loaded = decodeSave("v12", wrap(v12Payload()));
    expect(loaded.version).toBe(SAVE_SCHEMA_VERSION);
    expect(loaded.domain.buffs).toEqual([]);
    expect(loaded.domain.capacityShards).toBe(0);
    expect(loaded.domain.disguise).toEqual({ role: null, blown: false });
  });

  it("tolerates a missing domain and keeps what is already there", () => {
    expect(MIGRATIONS[12]!({ version: 12 })).toEqual({ version: 13, domain: { buffs: [], capacityShards: 0, disguise: { role: null, blown: false } } });
    const kept = { buffs: [{ id: "regen", left: 3 }], capacityShards: 2, disguise: { role: "hebi", blown: true } };
    expect(MIGRATIONS[12]!({ version: 12, domain: kept })).toMatchObject({ domain: kept });
  });

  it("validates buffs, shards and the disguise of a current save", () => {
    const s = snapshot();
    const body = { ...s, domain: { ...s.domain, buffs: [{ id: "regen", left: 40 }, { id: "steady", left: 2.5 }], capacityShards: 3, disguise: { role: "tessen_staff", blown: false } } } as const;
    expect(decodeSave("b", encodeSave(body)).domain).toMatchObject({ capacityShards: 3, disguise: { role: "tessen_staff", blown: false } });
    const bad = (domain: Record<string, unknown>) => findSchemaError({ ...s, domain: { ...s.domain, ...domain } } as unknown as Record<string, unknown>);
    expect(bad({ buffs: [{ id: "speed", left: 3 }] })).toBe("buffs");
    expect(bad({ buffs: [{ id: "regen", left: 0 }] })).toBe("buffs");
    expect(bad({ buffs: [{ id: "regen", left: 3 }, { id: "regen", left: 4 }] })).toBe("buffs");
    expect(bad({ capacityShards: -1 })).toBe("capacity shards");
    expect(bad({ capacityShards: 1.5 })).toBe("capacity shards");
    expect(bad({ disguise: { role: "ncpd", blown: false } })).toBe("disguise");
    expect(bad({ disguise: { role: null } })).toBe("disguise");
  });
});
