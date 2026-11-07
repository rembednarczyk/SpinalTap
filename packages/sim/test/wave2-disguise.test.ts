import { describe, expect, it } from "vitest";
import { DIFFICULTY_MAX, DIFFICULTY_PRESETS, type DifficultyProfile, type DomainState, type EnemyTypeId, type GarmentId, type ItemInstance } from "@seki/core";
import { DASH_COOLDOWN, SIM_DT, Simulation, deviceEntity, gangerEntity, type Entity } from "../src";
import { isEnforcer } from "../src/world/disguise";
import { sniperEntity } from "../src/world/factory";
import { collect, input, run, streetSim } from "./helpers";

const ticks = (seconds: number) => Math.ceil(seconds / SIM_DT - 1e-9);

/** The player wears `garment` on the torso (or her own jacket); every AI of the street removed. */
const simWearing = (garment: GarmentId | null, patch: (d: DomainState) => DomainState = (d) => d): Simulation => {
  const base = streetSim({ seed: 9 });
  const snap = base.snapshot(null, "t", "");
  const d = snap.domain;
  const piece: ItemInstance = { uid: "i9", def: garment ?? "seki_jacket", rarity: "common", condition: 100 };
  const domain: DomainState = garment
    ? { ...d, inventory: { ...d.inventory, items: [...d.inventory.items, piece], nextUid: d.inventory.nextUid + 1 }, equipment: { ...d.equipment, torso: "i9" } }
    : d;
  const sim = Simulation.fromSnapshot({ ...snap, domain: patch(domain) });
  for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
  for (const c of [...sim.world.with("device")]) sim.world.remove(c);
  return sim;
};

/** An enemy of `type` `distance` m north of the player, facing her. */
const watcher = (sim: Simulation, type: EnemyTypeId, key: string, distance = 6): Entity => {
  const p = sim.player()!;
  const e = gangerEntity(4000 + sim.world.entities.length, { key, position: { x: p.position.x, y: 0, z: p.position.z + distance }, yaw: Math.PI }, null, 500, p.chunk ?? "", undefined, type);
  return sim.world.add(e);
};

/** Holsters the weapon on the first step (a drawn weapon gives any disguise away). */
const holster = (sim: Simulation): void => sim.step(input({ toggleWeapon: true }));

describe("disguises (ADR-0033)", () => {
  it("marks the enforcers by key: the Tessen shift boss and every third Hebi", () => {
    expect(isEnforcer("c4-g0", 1, "tessen")).toBe(true);
    expect(isEnforcer("c4-g1", 1, "tessen")).toBe(false);
    expect(isEnforcer("c2-g0", 1, "hebi")).toBe(true);
    expect(isEnforcer("c2-g1", 1, "hebi")).toBe(false);
    expect(isEnforcer("c2-g3", 1, "hebi")).toBe(true);
    expect(isEnforcer("c2-g0", 1, "kagami")).toBe(false);
    const street = ["a", "b", "c", "d", "e", "f", "g", "h", "i"].filter((k) => isEnforcer(`ganger_${k}`, 1, "hebi")).length;
    expect(street).toBeGreaterThan(0);
    expect(street).toBeLessThan(9);
    // The view carries the mark for the HUD.
    const sim = simWearing(null);
    const boss = watcher(sim, "tessen_guard", "c9-g0");
    expect(boss.view).toEqual({ kind: "enemy", preset: "corpo", enforcer: true, look: expect.any(Number) });
    expect(boss.ai?.enforcer).toBe(true);
    expect(watcher(sim, "tessen_guard", "c9-g1").view).toEqual({ kind: "enemy", preset: "corpo", look: expect.any(Number) });
  });

  it("without a disguise a guard sees the intruder; in a uniform it sees a colleague", () => {
    const plain = simWearing(null);
    holster(plain);
    const g1 = watcher(plain, "tessen_guard", "c9-g1");
    run(plain, ticks(3));
    expect(g1.ai!.alerted).toBe(true);

    const sim = simWearing("tessen_uniform");
    const changed = collect<{ role: string | null }>(sim, "DisguiseChanged");
    holster(sim);
    expect(changed).toEqual([{ role: "tessen_guard" }]);
    expect(sim.domain.disguise).toEqual({ role: "tessen_guard", blown: false });
    const g2 = watcher(sim, "tessen_guard", "c9-g1");
    run(sim, ticks(8));
    expect(g2.ai!.alerted).toBe(false);
    expect(g2.ai!.suspicion ?? 0).toBe(0);
  });

  it("a drawn weapon is a forbidden act: anyone's suspicion fills and the disguise is blown", () => {
    const sim = simWearing("tessen_uniform");
    const blown = collect<{ observerId: number; role: string }>(sim, "DisguiseBlown");
    const g = watcher(sim, "tessen_guard", "c9-g1");
    run(sim, ticks(3));
    expect(blown).toEqual([{ observerId: g.id, role: "tessen_guard" }]);
    expect(sim.domain.disguise.blown).toBe(true);
    expect(g.ai!.alerted).toBe(true);
  });

  it("a sprint in front of them gives her away too", () => {
    const sim = simWearing("tessen_uniform");
    holster(sim);
    const g = watcher(sim, "tessen_guard", "c9-g1", 10);
    sim.player()!.yaw = Math.PI / 2;
    run(sim, ticks(1.5), input({ moveZ: 1, sprint: true }));
    expect(sim.domain.disguise.blown).toBe(true);
    expect(g.ai!.alerted).toBe(true);
  });

  it("an enforcer grows suspicious of a calm, holstered player within a few seconds", () => {
    const sim = simWearing("tessen_uniform");
    holster(sim);
    const boss = watcher(sim, "tessen_guard", "c9-g0");
    run(sim, ticks(1));
    expect(boss.ai!.suspicion).toBeGreaterThan(0);
    expect(boss.ai!.alerted).toBe(false);
    run(sim, ticks(3));
    expect(sim.domain.disguise.blown).toBe(true);
    expect(boss.ai!.alerted).toBe(true);
  });

  it("works for the Hebi jacket in front of Hebi, never in front of Tessen", () => {
    const sim = simWearing("hebi_jacket");
    holster(sim);
    const ganger = watcher(sim, "hebi_ganger", "c9-g1");
    run(sim, ticks(3));
    expect(ganger.ai!.alerted).toBe(false);
    // A Tessen guard sees an intruder in a gang jacket, and its shots wake the gang up too.
    const guard = watcher(sim, "tessen_guard", "c8-g1", 4);
    run(sim, ticks(3));
    expect(guard.ai!.alerted).toBe(true);
  });

  it("the sniper takes a Tessen uniform for a colleague", () => {
    const sim = simWearing("tessen_uniform");
    holster(sim);
    const aimed = collect(sim, "SniperAimed");
    const p = sim.player()!;
    sim.world.add(sniperEntity(4800, { key: "c9-g2", position: { x: p.position.x, y: 0, z: p.position.z + 15 }, yaw: Math.PI }, null, 60, p.chunk ?? "", [{ x: p.position.x, y: 0, z: p.position.z + 15 }]));
    run(sim, ticks(3));
    expect(aimed).toEqual([]);
  });

  it("staff overalls pass the camera of a no-go zone, a guard's uniform does not", () => {
    const zoneRun = (garment: GarmentId) => {
      const sim = simWearing(garment);
      holster(sim);
      const p = sim.player()!;
      const zone = { minX: p.position.x - 3, maxX: p.position.x + 3, minZ: p.position.z - 3, maxZ: p.position.z + 3 };
      sim.world.add(
        deviceEntity(4900, { key: "test-cam", chunk: p.chunk ?? "", kind: "camera", position: { x: p.position.x, y: 2.5, z: p.position.z - 5 }, yaw: 0, network: "tessen", faction: "tessen", restricted: zone }),
      );
      const reports = collect<{ crime: string }>(sim, "CrimeReported");
      const guard = watcher(sim, "tessen_guard", "c9-g1", 7);
      run(sim, ticks(3));
      return { reports: reports.length, blown: sim.domain.disguise.blown, alerted: guard.ai!.alerted };
    };
    expect(zoneRun("tessen_overalls")).toEqual({ reports: 0, blown: false, alerted: false });
    const guardUniform = zoneRun("tessen_uniform");
    expect(guardUniform.reports).toBeGreaterThan(0);
    expect(guardUniform.blown).toBe(true);
  });

  it("the hunting security does not know her in their uniform: no contact, the heat searches", () => {
    const sim = simWearing("tessen_uniform", (d) => ({ ...d, heat: { level: 1, faction: "tessen", searching: false, lastKnown: null, searchLeft: 20, cooldown: 0 } }));
    holster(sim);
    const g = watcher(sim, "tessen_guard", "c9-g1");
    run(sim, ticks(2));
    expect(g.ai!.alerted).toBe(false);
    expect(sim.domain.heat.searching).toBe(true);
  });

  it("a blown disguise is saved; changing clothes clears it", () => {
    const sim = simWearing("tessen_uniform");
    watcher(sim, "tessen_guard", "c9-g1");
    run(sim, ticks(3));
    expect(sim.domain.disguise.blown).toBe(true);
    const loaded = Simulation.fromSnapshot(sim.snapshot(null, "t", ""));
    expect(loaded.domain.disguise).toEqual({ role: "tessen_guard", blown: true });
    const changed = collect<{ role: string | null }>(loaded, "DisguiseChanged");
    loaded.step();
    // The first step announces the disguise for the HUD.
    expect(changed).toEqual([{ role: "tessen_guard" }]);
    loaded.enqueue({ type: "equip-item", uid: "i2", slot: "torso" });
    loaded.step();
    expect(loaded.domain.disguise).toEqual({ role: null, blown: false });
    expect(changed.at(-1)).toEqual({ role: null });
  });
});

describe("a dash in disguise (G-280)", () => {
  /** In a Tessen uniform with the Kitsune tendons at `difficulty`, the coffee's quicker cooldown if `coffee`, holstered. */
  const dasher = (difficulty: DifficultyProfile, coffee = false): Simulation => {
    const sim = simWearing("tessen_uniform", (d) => ({
      ...d,
      difficulty,
      character: { ...d.character, cyberware: { optics: "hitomi_optics_mk1", skeleton: "kitsune_tendons" } },
      buffs: coffee ? [{ id: "quick_cooldown", left: 60 }] : [],
    }));
    holster(sim);
    // Facing east: a dash or a sprint ahead runs across the guard's view, not into him.
    sim.player()!.yaw = Math.PI / 2;
    return sim;
  };

  /** Steps `n` times with `frame(i)`, returning the guard's highest suspicion meanwhile. */
  const watch = (sim: Simulation, g: Entity, n: number, frame: (i: number) => Parameters<typeof input>[0] = () => ({})): number => {
    let top = 0;
    for (let i = 0; i < n; i++) {
      sim.step(input(frame(i)));
      top = Math.max(top, g.ai!.suspicion ?? 0);
    }
    return top;
  };

  it("one dash gives her away on no level, the hardest awareness and the coffee included", () => {
    const levels: [DifficultyProfile, boolean][] = [
      [DIFFICULTY_PRESETS.hard, true],
      [DIFFICULTY_PRESETS.hard, false],
      [{ ...DIFFICULTY_PRESETS.hard, awareness: DIFFICULTY_MAX }, true],
      [{ ...DIFFICULTY_PRESETS.hard, awareness: DIFFICULTY_MAX }, false],
    ];
    const tops = levels.map(([level, coffee]) => {
      const sim = dasher(level, coffee);
      const g = watcher(sim, "tessen_guard", "c9-g1", 1.5);
      const top = watch(sim, g, ticks(4), (i) => (i === 0 ? { dash: true, moveZ: 1 } : {}));
      expect(sim.domain.disguise.blown).toBe(false);
      expect(g.ai!.alerted).toBe(false);
      return top;
    });
    // Seen from a step away on hard, one dash leaves him well short of sure.
    expect(tops[0]).toBeGreaterThan(0);
    expect(tops[0]).toBeLessThan(0.35);
    expect(tops[1]).toBeLessThan(0.35);
  });

  it("dash after dash in front of a guard still gives her away", () => {
    const sim = dasher(DIFFICULTY_PRESETS.normal);
    const blown = collect(sim, "DisguiseBlown");
    const g = watcher(sim, "tessen_guard", "c9-g1", 4);
    const every = ticks(DASH_COOLDOWN) + 1;
    // Back and forth across his view, a dash as soon as the legs allow.
    watch(sim, g, ticks(15), (i) => (i % every === 0 ? { dash: true, moveZ: (i / every) % 2 === 0 ? 1 : -1 } : {}));
    expect(blown).toHaveLength(1);
    expect(g.ai!.alerted).toBe(true);
  });

  it("a sprint gives her away faster than dashes in the same time", () => {
    const seconds = ticks(1);
    const sprint = dasher(DIFFICULTY_PRESETS.normal);
    const g1 = watcher(sprint, "tessen_guard", "c9-g1", 6);
    const bySprint = watch(sprint, g1, seconds, () => ({ moveZ: 1, sprint: true }));
    const dash = dasher(DIFFICULTY_PRESETS.normal);
    const g2 = watcher(dash, "tessen_guard", "c9-g1", 6);
    const byDash = watch(dash, g2, seconds, (i) => (i === 0 ? { dash: true, moveZ: 1 } : {}));
    expect(byDash).toBeGreaterThan(0);
    expect(bySprint).toBeGreaterThan(byDash * 2);
  });
});
