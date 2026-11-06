import { describe, expect, it } from "vitest";
import {
  type AttributeId,
  BASE_RAM,
  type DomainEvents,
  type DomainState,
  type ItemInstance,
  type ProgressionState,
  QUICKHACKS,
  WEAPON_CATALOG,
  progressionFromXp,
  spendAttributePoint,
  xpForLevel,
} from "@seki/core";
import { SIM_DT, Simulation, cyberCapacityOf, docks, gangerEntity, playerStatsOf, type Entity } from "../src";
import { STREET_START, collect, input, run, streetSim, teleportPlayer } from "./helpers";
import { emptySquare, enemyAt, secondsToAlarm } from "./stealth-scenes";

/*
 * The attributes' passive effects in the running game (ADR-0059, stage 2): each one reaches the
 * system it changes. A character with 3 everywhere plays as before (the golden hashes hold).
 */

const ticks = (seconds: number) => Math.ceil(seconds / SIM_DT - 1e-9);

/** A level-30 character with `points` spent on attributes, the rest unspent. */
const built = (points: Partial<Record<AttributeId, number>>): ProgressionState => {
  let s = progressionFromXp(xpForLevel(30));
  for (const [id, n] of Object.entries(points) as [AttributeId, number][]) {
    for (let i = 0; i < n; i++) {
      const r = spendAttributePoint(s, id);
      if (!r.ok) throw new Error(r.reason);
      s = r.state;
    }
  }
  return s;
};

/** A new game in the street, nobody armed about, with `points` spent and `patch` applied. */
const simWith = (points: Partial<Record<AttributeId, number>>, patch: (d: DomainState) => DomainState = (d) => d): Simulation => {
  const base = streetSim({ seed: 5 });
  const snap = base.snapshot(null, "t", "");
  const sim = Simulation.fromSnapshot({ ...snap, domain: patch({ ...snap.domain, progression: built(points) }) });
  for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
  return sim;
};

const withBaton = (d: DomainState): DomainState => {
  const baton: ItemInstance = { uid: "i9", def: "baton", rarity: "common" };
  return { ...d, inventory: { ...d.inventory, items: [...d.inventory.items, baton], nextUid: d.inventory.nextUid + 1 }, equipment: { ...d.equipment, melee: "i9", active: "melee" } };
};

describe("attribute points in the running game (ADR-0059, stage 2)", () => {
  it("Might: a point spent by command adds 4 to the player's maximum health at once", () => {
    const sim = simWith({});
    sim.step();
    const before = sim.player()!.health!.max;
    sim.enqueue({ type: "spend-attribute-point", attribute: "might" });
    sim.step();
    expect(sim.player()!.health!.max).toBe(before + 4);
  });

  it("Might: the baton hits 24% harder at 15", () => {
    const hit = (might: number) => {
      const sim = simWith({ might }, withBaton);
      const p = sim.player()!;
      sim.world.add({ id: 5001, position: { x: p.position.x, y: STREET_START.y, z: p.position.z + 1.5 }, prevPosition: { ...p.position }, yaw: Math.PI, prevYaw: Math.PI, pitch: 0, body: { radius: 0.38, height: 1.8 }, health: { current: 10_000, max: 10_000 } } as Entity);
      const hits = collect<{ amount: number }>(sim, "DamageDealt");
      run(sim, ticks(0.4));
      sim.step(input({ fire: true }));
      run(sim, ticks(WEAPON_CATALOG.baton.melee.combo[0].windup) + 1);
      return hits[0]!.amount;
    };
    const plain = hit(0);
    expect(plain).toBeGreaterThan(0);
    expect(hit(12)).toBeCloseTo(plain * 1.24, 0);
  });

  it("Reflex: aiming down sights is a fifth quicker at 13", () => {
    const aimAfter = (reflex: number) => {
      const sim = simWith({ reflex });
      sim.step(input({ aim: true }));
      return sim.player()!.posture!.aim;
    };
    expect(aimAfter(10)).toBeCloseTo(aimAfter(0) / 0.8, 9);
    expect(playerStatsOf(simWith({ reflex: 10 }).domain).aimStability - playerStatsOf(simWith({}).domain).aimStability).toBeCloseTo(0.1);
  });

  it("Tech: the cyberware pool grows by one per 3 points", () => {
    expect(cyberCapacityOf(simWith({ tech: 6 }).domain).max).toBe(cyberCapacityOf(simWith({}).domain).max + 2);
  });

  it("Net: a point that grows the RAM pool reports it, and the RAM fills up to it", () => {
    const sim = simWith({ net: 1 });
    sim.step();
    const ram = collect<DomainEvents["RamChanged"]>(sim, "RamChanged");
    sim.enqueue({ type: "spend-attribute-point", attribute: "net" });
    sim.step();
    expect(ram).toEqual([{ current: BASE_RAM, max: BASE_RAM + 1 }]);
    run(sim, ticks(2.5));
    expect(sim.domain.netrun.ram).toBe(BASE_RAM + 1);
    expect(ram.at(-1)).toEqual({ current: BASE_RAM + 1, max: BASE_RAM + 1 });
  });

  it("Net: the upload takes 10% less at 8", () => {
    const upload = (net: number) => {
      const sim = simWith({ net });
      teleportPlayer(sim, docks(16, 0, 97), -Math.PI / 2);
      sim.step();
      const p = sim.player()!.position;
      sim.world.add(gangerEntity(90010, { key: "test-guard", position: { ...p, x: p.x - 8 }, yaw: Math.PI / 2 }, null, 1e6, "nabrzeze-1-1", undefined, "tessen_guard"));
      // Looking at its chest: the scanner's focus follows the view.
      sim.player()!.pitch = Math.atan2(1.62 - 1.25, 8);
      const started = collect<DomainEvents["QuickhackStarted"]>(sim, "QuickhackStarted");
      sim.step(input({ scan: true }));
      sim.step(input({ scan: true, quickhack: 1 }));
      return started[0];
    };
    const plain = upload(0)!;
    const quick = upload(5)!;
    expect(plain.upload).toBe(QUICKHACKS[plain.hackId].upload);
    expect(quick.upload).toBeCloseTo(plain.upload * 0.9, 9);
  });

  it("Shadow: a Hebi ganger takes longer to raise the alarm at 15", () => {
    const alarm = (shadow: number) => {
      const sim = emptySquare(false);
      const domain = { ...sim.domain, progression: built({ shadow }) };
      const s2 = Simulation.fromSnapshot({ ...sim.snapshot(null, "t", ""), domain });
      for (const g of [...s2.world.with("ai")]) s2.world.remove(g);
      const p = s2.player()!;
      p.yaw = 0;
      p.prevYaw = 0;
      return secondsToAlarm(s2, enemyAt(s2, "hebi_ganger", 10, true));
    };
    const plain = alarm(0)!;
    const shadowed = alarm(12)!;
    expect(plain).toBeGreaterThan(0);
    expect(shadowed / plain).toBeCloseTo(1 / 0.76, 1);
  });
});
