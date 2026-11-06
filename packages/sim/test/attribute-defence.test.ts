import { describe, expect, it } from "vitest";
import { type AttributeId, type DomainEvents, type DomainState, type ProgressionState, contractTag, progressionFromXp, spendAttributePoint, xpForLevel } from "@seki/core";
import { GENZO_SPOT, SIM_HZ, Simulation, gangerEntity, ground } from "../src";
import { byKey, collect, input, run, streetSim, teleportPlayer } from "./helpers";
import { tough, yardFight } from "./difficulty-scenes";

/*
 * Shadow and Tech where the attribute test leaves off (ADR-0059, stage 2): the camera's spot
 * meter and an enforcer's suspicion of a disguise fill slower with Shadow, and the clothes stop
 * more of a shot with Tech. Each scene is the difficulty test's, with points spent instead of a
 * profile changed.
 */

/** A level-30 character with `n` points in `id`. */
const built = (id: AttributeId, n: number): ProgressionState => {
  let s = progressionFromXp(xpForLevel(30));
  for (let i = 0; i < n; i++) {
    const r = spendAttributePoint(s, id);
    if (!r.ok) throw new Error(r.reason);
    s = r.state;
  }
  return s;
};

type Holder = { holder: { domain: DomainState } };
/** Puts `progression` into the running game's domain (no snapshot: the scene stays as built). */
const setProgression = (sim: Simulation, progression: ProgressionState): void => {
  const holder = (sim as unknown as Holder).holder;
  holder.domain = { ...holder.domain, progression };
};

describe("Shadow slows the camera and the disguise (ADR-0059)", () => {
  it("a camera's spot meter fills 24% slower at 15", () => {
    const spot = (shadow: number) => {
      const sim = Simulation.create({ seed: 8 });
      setProgression(sim, built("shadow", shadow));
      teleportPlayer(sim, ground(GENZO_SPOT.x + 0.4, GENZO_SPOT.z - 2), 0);
      sim.step();
      tough(sim);
      sim.enqueue({ type: "accept-contract", kind: "infiltrate" });
      sim.step();
      const c = sim.domain.contracts.active!;
      // Nobody of the crew around: only the camera can see.
      for (const e of [...sim.world].filter((x) => x.tag === contractTag(c.id))) e.health = { current: 0, max: 1 };
      sim.step();
      const cam = byKey(sim, "dev:doki-office-cam")!;
      teleportPlayer(sim, { x: cam.position.x + Math.sin(cam.yaw) * 6, y: sim.player()!.position.y, z: cam.position.z + Math.cos(cam.yaw) * 6 }, 0);
      run(sim, 0.2 * SIM_HZ);
      return cam.device!.spot;
    };
    const plain = spot(0);
    expect(plain).toBeGreaterThan(0);
    expect(plain).toBeLessThan(0.5);
    expect(spot(12)).toBeCloseTo(0.76 * plain, 9);
  });

  it("an enforcer's suspicion of a disguise fills 24% slower at 15", () => {
    const suspicion = (shadow: number) => {
      const snap = streetSim({ seed: 9 }).snapshot(null, "t", "");
      const d = snap.domain;
      const domain: DomainState = {
        ...d,
        inventory: { ...d.inventory, items: [...d.inventory.items, { uid: "i9", def: "tessen_uniform", rarity: "common", condition: 100 }], nextUid: d.inventory.nextUid + 1 },
        equipment: { ...d.equipment, torso: "i9" },
        progression: built("shadow", shadow),
      };
      const sim = Simulation.fromSnapshot({ ...snap, domain });
      for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
      for (const c of [...sim.world.with("device")]) sim.world.remove(c);
      sim.step(input({ toggleWeapon: true }));
      const p = sim.player()!;
      // The Tessen shift boss is an enforcer by key (ADR-0033).
      const boss = sim.world.add(gangerEntity(4000, { key: "c9-g0", position: { x: p.position.x, y: 0, z: p.position.z + 6 }, yaw: Math.PI }, null, 500, p.chunk ?? "", undefined, "tessen_guard"));
      run(sim, 10);
      return boss.ai!.suspicion ?? 0;
    };
    const plain = suspicion(0);
    expect(plain).toBeGreaterThan(0);
    expect(plain).toBeLessThan(0.5);
    expect(suspicion(12)).toBeCloseTo(0.76 * plain, 9);
  });
});

describe("Tech: armor from clothes against real shots (ADR-0059)", () => {
  /**
   * The hits a Tessen guard 14 m off lands on the player in 4 s, by zone; with `bare` she has
   * taken the jacket off first. The guard aims at the chest, so the torso stands for the clothed
   * zone and, bare, for one without clothes (the head is seldom hit).
   */
  const hits = (tech: number, bare = false) => {
    const { sim } = yardFight({});
    setProgression(sim, built("tech", tech));
    if (bare) sim.enqueue({ type: "unequip-item", slot: "torso" });
    const dealt = collect<DomainEvents["DamageDealt"]>(sim, "DamageDealt");
    for (let i = 0; i < 4 * SIM_HZ; i++) {
      tough(sim);
      sim.step();
    }
    const me = sim.player()!.id;
    return dealt.filter((h) => h.targetId === me).map((h) => ({ zone: h.zone, amount: h.amount }));
  };
  /** Damage before and after on the hits of `zone`; the same shots land on the same zones (armor draws no random number). */
  const pairs = (plain: ReturnType<typeof hits>, tech: ReturnType<typeof hits>, zone: string) => {
    expect(tech.map((h) => h.zone)).toEqual(plain.map((h) => h.zone));
    const out = plain.flatMap((h, i) => (h.zone === zone ? [[h.amount, tech[i]!.amount] as const] : []));
    expect(out.length).toBeGreaterThan(0);
    return out;
  };

  it("a clothed torso takes less at Tech 5", () => {
    for (const [before, after] of pairs(hits(0), hits(2), "torso")) expect(after).toBeLessThan(before);
  });

  it("a bare torso takes the same: the bonus is the clothes'", () => {
    for (const [before, after] of pairs(hits(0, true), hits(2, true), "torso")) expect(after).toBe(before);
  });
});
