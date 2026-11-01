import { describe, expect, it } from "vitest";
import { type DomainState, type ItemInstance, findItem } from "@seki/core";
import { SIM_DT, Simulation } from "../src/simulation";
import { byKey, collect, input, run } from "./helpers";

const ticks = (seconds: number) => Math.ceil(seconds / SIM_DT);

/** A fresh simulation whose domain is `patch` applied over a new game (loaded through a snapshot). */
const simWith = (patch: (d: DomainState) => DomainState, seed = 5): Simulation => {
  const base = Simulation.create({ seed });
  const snap = base.snapshot(null, "t", "");
  return Simulation.fromSnapshot({ ...snap, domain: patch(snap.domain) });
};

/** Adds pieces to the bag and optionally equips them by slot. */
const give = (d: DomainState, items: ItemInstance[], equip: Partial<Record<"primary" | "melee" | "secondary", string>> = {}): DomainState => ({
  ...d,
  inventory: { ...d.inventory, items: [...d.inventory.items, ...items], nextUid: d.inventory.nextUid + items.length },
  equipment: { ...d.equipment, ...equip },
});

const loaded = (sim: Simulation, uid = "i1") => findItem(sim.domain.inventory, uid)?.loaded;

describe("magazine and reload (plan E4)", () => {
  it("fires 12 shots, reloads for 1.4 s on the empty trigger and the reserve shrinks", () => {
    const sim = Simulation.create({ seed: 5 });
    const shots = collect<{ shooterId: number }>(sim, "ShotFired");
    const started = collect<{ duration: number }>(sim, "ReloadStarted");
    const finished = collect<{ loaded: number }>(sim, "ReloadFinished");
    run(sim, ticks(4), input({ fire: true }));
    expect(shots).toHaveLength(12);
    expect(loaded(sim)).toBe(0);
    expect(started).toEqual([expect.objectContaining({ duration: 1.4 })]);
    expect(sim.player()!.combatant!.reloading).toBeGreaterThan(0);
    run(sim, ticks(1.4), input({ fire: false }));
    expect(finished).toEqual([expect.objectContaining({ loaded: 12 })]);
    expect(loaded(sim)).toBe(12);
    expect(sim.domain.ammo["9mm"]).toBe(36);
  });

  it("R tops up a half-empty magazine and the old rounds go back to the pouch", () => {
    const sim = Simulation.create({ seed: 5 });
    run(sim, ticks(1.3), input({ fire: true }));
    const left = loaded(sim)!;
    expect(left).toBeLessThan(12);
    sim.step(input({ reload: true }));
    run(sim, ticks(1.4));
    expect(loaded(sim)).toBe(12);
    expect(sim.domain.ammo["9mm"]).toBe(48 - (12 - left));
  });

  it("does nothing on R with a full magazine or an empty pouch", () => {
    const sim = Simulation.create({ seed: 5 });
    const started = collect(sim, "ReloadStarted");
    sim.step(input({ reload: true }));
    expect(started).toHaveLength(0);
    const dry = simWith((d) => ({ ...d, ammo: {}, inventory: { ...d.inventory, items: d.inventory.items.map((i) => (i.uid === "i1" ? { ...i, loaded: 3 } : i)) } }));
    const dryStarted = collect(dry, "ReloadStarted");
    dry.step(input({ reload: true }));
    run(dry, ticks(1), input({ fire: true }));
    expect(dryStarted).toHaveLength(0);
    expect(loaded(dry)).toBe(0);
  });

  it("does not shoot while reloading", () => {
    const sim = simWith((d) => ({ ...d, inventory: { ...d.inventory, items: d.inventory.items.map((i) => (i.uid === "i1" ? { ...i, loaded: 5 } : i)) } }));
    const shots = collect(sim, "ShotFired");
    sim.step(input({ reload: true }));
    run(sim, ticks(1), input({ fire: true }));
    expect(shots).toHaveLength(0);
  });

  it("sprinting, holstering and a conversation interrupt a reload without moving any rounds", () => {
    const half = (d: DomainState) => ({ ...d, inventory: { ...d.inventory, items: d.inventory.items.map((i) => (i.uid === "i1" ? { ...i, loaded: 4 } : i)) } });
    for (const interrupt of ["sprint", "holster", "dialogue"] as const) {
      const sim = simWith(half);
      sim.step(input({ reload: true }));
      expect(sim.player()!.combatant!.reloading).toBeGreaterThan(0);
      if (interrupt === "sprint") sim.step(input({ moveZ: 1, sprint: true }));
      if (interrupt === "holster") sim.step(input({ toggleWeapon: true }));
      if (interrupt === "dialogue") {
        sim.session.dialogueActive = true;
        sim.step();
      }
      expect(sim.player()!.combatant!.reloading, interrupt).toBe(0);
      run(sim, ticks(1.5));
      expect(loaded(sim), interrupt).toBe(4);
      expect(sim.domain.ammo["9mm"], interrupt).toBe(48);
    }
  });
});

describe("weapon slots (plan E4)", () => {
  const smg: ItemInstance = { uid: "i4", def: "hebi_smg", rarity: "common", loaded: 30, mods: {} };

  it("switching slots puts one weapon away and draws the other, and interrupts a reload", () => {
    const sim = simWith((d) =>
      give({ ...d, inventory: { ...d.inventory, items: d.inventory.items.map((i) => (i.uid === "i1" ? { ...i, loaded: 2 } : i)) } }, [smg], { primary: "i4" }),
    );
    const switched = collect<{ slot: string; weapon: string }>(sim, "WeaponSwitched");
    sim.step(input({ reload: true }));
    expect(sim.player()!.combatant!.reloading).toBeGreaterThan(0);
    sim.step(input({ weaponSlot: 1 }));
    const c = sim.player()!.combatant!;
    expect(switched).toEqual([expect.objectContaining({ slot: "primary", weapon: "hebi_smg" })]);
    expect(sim.domain.equipment.active).toBe("primary");
    expect(c.reloading).toBe(0);
    // Unity-9 away (0.2 s) plus the SMG drawn (0.55 s), minus nothing yet.
    expect(c.drawing).toBeCloseTo(0.2 + 0.55, 5);
    run(sim, ticks(2));
    expect(loaded(sim)).toBe(2);
    expect(sim.domain.ammo["9mm"]).toBe(48);
  });

  it("the SMG empties its own magazine; the pistol keeps its rounds", () => {
    const sim = simWith((d) => give(d, [smg], { primary: "i4" }));
    sim.step(input({ weaponSlot: 1 }));
    run(sim, ticks(0.8));
    const shots = collect(sim, "ShotFired");
    run(sim, ticks(1), input({ fire: true }));
    expect(shots.length).toBeGreaterThanOrEqual(9);
    expect(loaded(sim, "i4")).toBe(30 - shots.length);
    expect(loaded(sim, "i1")).toBe(12);
    sim.step(input({ weaponSlot: 2 }));
    expect(sim.player()!.combatant!.weapon).toBe("unity9");
  });

  it("the mouse wheel cycles through the slots that hold a weapon, both ways", () => {
    const sim = simWith((d) => give(d, [smg], { primary: "i4" }));
    sim.step(input({ weaponCycle: 1 }));
    // Secondary -> melee is empty -> primary.
    expect(sim.domain.equipment.active).toBe("primary");
    sim.step(input({ weaponCycle: 1 }));
    expect(sim.domain.equipment.active).toBe("secondary");
    sim.step(input({ weaponCycle: -1 }));
    expect(sim.domain.equipment.active).toBe("primary");
    // Only one weapon: nothing to cycle to.
    const lone = Simulation.create({ seed: 5 });
    const switched = collect(lone, "WeaponSwitched");
    lone.step(input({ weaponCycle: 1 }));
    expect(switched).toHaveLength(0);
  });

  it("ignores an empty slot and draws a holstered weapon when its own slot is chosen", () => {
    const sim = Simulation.create({ seed: 5 });
    const switched = collect(sim, "WeaponSwitched");
    sim.step(input({ weaponSlot: 3 }));
    expect(switched).toHaveLength(0);
    expect(sim.domain.equipment.active).toBe("secondary");
    sim.step(input({ toggleWeapon: true }));
    expect(sim.player()!.combatant!.holstered).toBe(true);
    sim.step(input({ weaponSlot: 2 }));
    expect(sim.player()!.combatant!.holstered).toBe(false);
    sim.step(input({ weaponSlot: 2 }));
    expect(sim.player()!.combatant!.holstered).toBe(false);
  });

  it("a melee weapon needs no ammo and swings instead of shooting (ADR-0019)", () => {
    const baton: ItemInstance = { uid: "i4", def: "baton", rarity: "common" };
    const sim = simWith((d) => give({ ...d, ammo: {} }, [baton], { melee: "i4" }));
    const shots = collect(sim, "ShotFired");
    const swings = collect(sim, "MeleeSwing");
    const started = collect(sim, "ReloadStarted");
    sim.step(input({ weaponSlot: 3 }));
    run(sim, ticks(0.6));
    run(sim, ticks(1.3), input({ fire: true, reload: true }));
    expect(swings.length).toBeGreaterThanOrEqual(2);
    expect(shots).toHaveLength(0);
    expect(started).toHaveLength(0);
    expect(sim.aimSpread()).toBe(0);
  });

  it("with the active slot emptied the player has nothing to shoot", () => {
    const sim = Simulation.create({ seed: 5 });
    const shots = collect(sim, "ShotFired");
    sim.enqueue({ type: "unequip-item", slot: "secondary" });
    sim.step();
    expect(sim.player()!.combatant!.weapon).toBeNull();
    run(sim, 30, input({ fire: true, reload: true }));
    expect(shots).toHaveLength(0);
    expect(sim.aimSpread()).toBe(0);
  });
});

describe("shotgun: per-round reload", () => {
  const raijin: ItemInstance = { uid: "i4", def: "raijin12", rarity: "common", loaded: 0, mods: {} };
  const setup = () => simWith((d) => give({ ...d, ammo: { ...d.ammo, "12g": 10 } }, [raijin], { primary: "i4" }));

  it("loads one shell per 0.5 s until full", () => {
    const sim = setup();
    sim.step(input({ weaponSlot: 1 }));
    run(sim, ticks(1));
    sim.step(input({ reload: true }));
    run(sim, ticks(1.05));
    expect(loaded(sim, "i4")).toBe(2);
    run(sim, ticks(3));
    expect(loaded(sim, "i4")).toBe(6);
    expect(sim.domain.ammo["12g"]).toBe(4);
  });

  it("the trigger interrupts the reload once a shell is in, and fires nine pellets", () => {
    const sim = setup();
    sim.step(input({ weaponSlot: 1 }));
    run(sim, ticks(1));
    const shots = collect(sim, "ShotFired");
    sim.step(input({ reload: true }));
    run(sim, ticks(0.3), input({ fire: true }));
    expect(shots).toHaveLength(0);
    run(sim, ticks(0.25), input({ fire: true }));
    expect(shots).toHaveLength(1);
    expect(loaded(sim, "i4")).toBe(0);
    expect(sim.player()!.combatant!.stats!.pellets).toBe(9);
  });
});

describe("NPC magazines", () => {
  it("a ganger reloads for 2 s when the magazine runs dry, then has 30 rounds again", () => {
    const sim = Simulation.create({ seed: 5 });
    const guard = byKey(sim, "guard")!;
    const started = collect<{ entityId: number; duration: number }>(sim, "ReloadStarted");
    expect(guard.combatant!.loaded).toBe(30);
    guard.combatant!.loaded = 0;
    sim.step();
    expect(started).toEqual([{ entityId: guard.id, duration: 2 }]);
    run(sim, ticks(2));
    expect(guard.combatant!.loaded).toBe(30);
  });

  it("NPC magazines are saved (G-185): a loaded game gives them the rounds they had, a full one saves nothing", () => {
    const sim = Simulation.create({ seed: 5 });
    expect(sim.snapshot(null, "x", "").entities.find((e) => e.key === "guard")).not.toHaveProperty("gun");
    byKey(sim, "guard")!.combatant!.loaded = 3;
    const restored = Simulation.fromSnapshot(sim.snapshot(null, "x", ""));
    expect(byKey(restored, "guard")!.combatant!.loaded).toBe(3);
  });
});

describe("inventory commands", () => {
  const jacket: ItemInstance = { uid: "i4", def: "hebi_jacket", rarity: "uncommon", condition: 100 };
  const smg: ItemInstance = { uid: "i5", def: "hebi_smg", rarity: "common", loaded: 30, mods: {} };
  const sight: ItemInstance = { uid: "i6", def: "holo_sight", rarity: "common" };

  it("equips and unequips with events; the replaced piece returns to the bag", () => {
    const sim = simWith((d) => give(d, [jacket]));
    const equipped = collect(sim, "ItemEquipped");
    const unequipped = collect(sim, "ItemUnequipped");
    sim.enqueue({ type: "equip-item", uid: "i4" });
    sim.enqueue({ type: "equip-item", uid: "nope" });
    sim.step();
    expect(sim.domain.equipment.torso).toBe("i4");
    expect(equipped).toEqual([{ uid: "i4", slot: "torso", replaced: "i2" }]);
    sim.enqueue({ type: "unequip-item", slot: "torso" });
    sim.enqueue({ type: "unequip-item", slot: "head" });
    sim.step();
    expect(unequipped).toEqual([{ uid: "i4", slot: "torso" }]);
  });

  it("says so when the bag is too full to take a piece off", () => {
    const sim = simWith((d) => ({ ...d, inventory: { ...d.inventory, capacity: 1 } }));
    const full = collect(sim, "InventoryFull");
    sim.enqueue({ type: "unequip-item", slot: "legs" });
    sim.step();
    expect(full).toEqual([{ defId: "cargo_pants" }]);
    expect(sim.domain.equipment.legs).toBe("i3");
  });

  it("equipping into the active slot draws the new weapon", () => {
    const pistol2: ItemInstance = { uid: "i4", def: "oni44", rarity: "rare", loaded: 6, mods: {} };
    const sim = simWith((d) => give({ ...d, ammo: { ...d.ammo, "44": 12 } }, [pistol2]));
    run(sim, 5);
    sim.enqueue({ type: "equip-item", uid: "i4", slot: "secondary" });
    sim.step();
    sim.step();
    const c = sim.player()!.combatant!;
    expect(c.weapon).toBe("oni44");
    expect(c.drawing).toBeGreaterThan(0.3);
    expect(c.stats!.damage).toBeCloseTo(48 * 1.16);
  });

  it("mounts and removes mods; the sight narrows the aim cone", () => {
    const sim = simWith((d) => give(d, [smg, sight], { primary: "i5" }));
    const installed = collect(sim, "ModInstalled");
    const removed = collect(sim, "ModRemoved");
    sim.step(input({ weaponSlot: 1 }));
    run(sim, ticks(1));
    const before = sim.aimSpread();
    sim.enqueue({ type: "install-mod", weaponUid: "i5", modUid: "i6" });
    run(sim, 2);
    expect(installed).toEqual([{ weaponUid: "i5", modUid: "i6", slot: "sight" }]);
    expect(sim.aimSpread()).toBeCloseTo(before * 0.8, 4);
    sim.enqueue({ type: "install-mod", weaponUid: "i5", modUid: "i99" });
    sim.enqueue({ type: "remove-mod", weaponUid: "i5", slot: "sight" });
    sim.enqueue({ type: "remove-mod", weaponUid: "i5", slot: "muzzle" });
    sim.step();
    expect(removed).toEqual([{ weaponUid: "i5", modUid: "i6", slot: "sight" }]);
  });

  it("a mod swap reports the mod that came off, and the extended magazine's extra rounds go to the pouch", () => {
    const mag: ItemInstance = { uid: "i6", def: "extended_mag", rarity: "common" };
    const mag2: ItemInstance = { uid: "i7", def: "extended_mag", rarity: "rare" };
    const sim = simWith((d) => give(d, [{ ...smg, loaded: 45, mods: { magazine: "i6" } }, mag, mag2], { primary: "i5" }));
    const removed = collect(sim, "ModRemoved");
    sim.enqueue({ type: "install-mod", weaponUid: "i5", modUid: "i7" });
    sim.step();
    expect(removed).toEqual([{ weaponUid: "i5", modUid: "i6", slot: "magazine" }]);
    sim.enqueue({ type: "remove-mod", weaponUid: "i5", slot: "magazine" });
    sim.step();
    expect(loaded(sim, "i5")).toBe(30);
    expect(sim.domain.ammo["9mm"]).toBe(48 + 15);
    const full = simWith((d) => give({ ...d, inventory: { ...d.inventory, capacity: 1 } }, [{ ...smg, mods: { magazine: "i6" } }, mag], { primary: "i5" }));
    const noRoom = collect(full, "InventoryFull");
    full.enqueue({ type: "remove-mod", weaponUid: "i5", slot: "magazine" });
    full.enqueue({ type: "remove-mod", weaponUid: "i5", slot: "sight" });
    full.step();
    expect(noRoom).toEqual([{ defId: "extended_mag" }]);
  });

  it("uses a consumable by reference and ignores what cannot be used", () => {
    const sim = simWith((d) => ({ ...d, inventory: { ...d.inventory, stacks: { medkit: 1, bandage: 1, scrap: 1 } } }));
    const used = collect(sim, "ItemUsed");
    const p = sim.player()!;
    p.health = { ...p.health!, current: 50 };
    sim.enqueue({ type: "use-item", ref: { stack: "bandage" } });
    sim.enqueue({ type: "use-item", ref: { stack: "scrap" } });
    sim.enqueue({ type: "use-item", ref: { uid: "i1" } });
    sim.step();
    expect(used).toEqual([{ itemId: "bandage", healed: 15 }]);
    expect(sim.domain.inventory.stacks).toEqual({ medkit: 1, scrap: 1 });
    p.health = { ...p.health!, current: p.health!.max };
    sim.enqueue({ type: "use-item", ref: { stack: "medkit" } });
    sim.step();
    expect(used).toHaveLength(1);
  });

  it("quick use falls back to a bandage without medkits", () => {
    const sim = simWith((d) => ({ ...d, inventory: { ...d.inventory, stacks: { bandage: 2 } } }));
    const used = collect(sim, "ItemUsed");
    sim.player()!.health = { current: 60, max: 100 };
    sim.step(input({ useItem: true }));
    expect(used).toEqual([{ itemId: "bandage", healed: 15 }]);
  });
});

describe("weapon state in saves", () => {
  it("keeps the rounds in the magazine and the pouch; a reload in progress is dropped", () => {
    const sim = Simulation.create({ seed: 5 });
    run(sim, ticks(1), input({ fire: true }));
    sim.step(input({ reload: true }));
    const restored = Simulation.fromSnapshot(sim.snapshot(null, "x", ""));
    expect(loaded(restored)).toBe(loaded(sim));
    expect(restored.domain.ammo).toEqual(sim.domain.ammo);
    expect(restored.player()!.combatant!.reloading).toBe(0);
    expect(restored.player()!.combatant!.weapon).toBe("unity9");
  });
});
