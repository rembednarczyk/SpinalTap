import { describe, expect, it } from "vitest";
import { type DomainEvents, type PerkId, QUICKHACKS, type QuickhackSlotInput, SCAN_RANGE, SHORT_CIRCUIT_DAMAGE, contractTag, hackInSlot } from "@seki/core";
import { GENZO_SPOT, SIM_HZ, Simulation, TAKEDOWN_REACH, docks, gangerEntity, ground, type Entity } from "../src";
import { byKey, collect, input, run, streetSim, teleportPlayer } from "./helpers";
import { CROUCH, offset, quietStreet, ticks } from "./takedown-scenes";
import { tough } from "./difficulty-scenes";
import { withPerks } from "./perk-scenes";

/*
 * The Net and Shadow perks of stage 3b (ADR-0059) in the running game, in the scenes of the
 * hacking, camera and takedown tests: once with the perk, once with only its attribute and path.
 */

type Perks = Partial<Record<PerkId, number>>;

/** In the docks with one Tessen guard `distance` m west, the scanner on its chest. */
const hackScene = (perks: Perks, bought: boolean, distance = 8): { sim: Simulation; guard: Entity } => {
  const base = streetSim({ seed: 5 });
  const sim = Simulation.fromSnapshot(base.snapshot(null, "t", ""));
  for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
  withPerks(sim, perks, bought);
  teleportPlayer(sim, docks(16, 0, 97), -Math.PI / 2);
  sim.step();
  const p = sim.player()!.position;
  const guard = sim.world.add(gangerEntity(90010, { key: "guard-90010", position: { ...p, x: p.x - distance }, yaw: Math.PI / 2 }, null, 1e6, "nabrzeze-1-1", undefined, "tessen_guard"));
  sim.player()!.pitch = Math.atan2(1.62 - 1.25, distance);
  return { sim, guard };
};

/** Uploads the `slot`-th hack into the focused guard and waits for it. */
const hack = (sim: Simulation, slot: QuickhackSlotInput): void => {
  sim.step(input({ scan: true }));
  sim.step(input({ scan: true, quickhack: slot }));
  run(sim, ticks(3), input({ scan: true }));
};

describe("Net", () => {
  it("Long Range: the scanner reaches a guard 28 m away at two ranks (25 m without)", () => {
    const focused = (bought: boolean) => {
      const { sim, guard } = hackScene({ net_long_range: 2 }, bought, 28);
      const focus = collect<DomainEvents["ScanFocusChanged"]>(sim, "ScanFocusChanged");
      run(sim, 3, input({ scan: true }));
      return focus.some((f) => f.targetId === guard.id);
    };
    expect(28).toBeGreaterThan(SCAN_RANGE);
    expect(focused(false)).toBe(false);
    expect(focused(true)).toBe(true);
  });

  it("Persistence: a ping lasts 40% longer at two ranks", () => {
    const lasts = (bought: boolean) => {
      const { sim } = hackScene({ net_persistence: 2 }, bought);
      const applied = collect<DomainEvents["QuickhackApplied"]>(sim, "QuickhackApplied");
      hack(sim, 1);
      return applied[0]!.duration;
    };
    expect(lasts(false)).toBe(QUICKHACKS.ping.duration);
    expect(lasts(true)).toBeCloseTo(QUICKHACKS.ping.duration * 1.4, 9);
  });

  it("Overload: Short Circuit hits half again as hard at two ranks, in whole points", () => {
    const slot = ([1, 2, 3, 4, 5] as const).find((n) => hackInSlot("person", n) === "short_circuit")!;
    const damage = (bought: boolean) => {
      const { sim, guard } = hackScene({ net_overload: 2 }, bought);
      const dealt = collect<DomainEvents["DamageDealt"]>(sim, "DamageDealt");
      hack(sim, slot);
      return dealt.filter((d) => d.targetId === guard.id).map((d) => d.amount);
    };
    expect(damage(false)).toEqual([SHORT_CIRCUIT_DAMAGE]);
    expect(damage(true)).toEqual([Math.round(SHORT_CIRCUIT_DAMAGE * 1.5)]);
  });
});

describe("Shadow", () => {
  it("Low Profile: a camera's spot meter fills 10% slower at two ranks", () => {
    const spot = (bought: boolean) => {
      const sim = withPerks(Simulation.create({ seed: 8 }), { shadow_low_profile: 2 }, bought);
      teleportPlayer(sim, ground(GENZO_SPOT.x + 0.4, GENZO_SPOT.z - 2), 0);
      sim.step();
      tough(sim);
      sim.enqueue({ type: "accept-contract", kind: "infiltrate" });
      sim.step();
      const c = sim.domain.contracts.active!;
      for (const e of [...sim.world].filter((x) => x.tag === contractTag(c.id))) e.health = { current: 0, max: 1 };
      sim.step();
      const cam = byKey(sim, "dev:doki-office-cam")!;
      teleportPlayer(sim, { x: cam.position.x + Math.sin(cam.yaw) * 6, y: sim.player()!.position.y, z: cam.position.z + Math.cos(cam.yaw) * 6 }, 0);
      run(sim, 0.2 * SIM_HZ);
      return cam.device!.spot;
    };
    const plain = spot(false);
    expect(plain).toBeGreaterThan(0);
    expect(spot(true)).toBeCloseTo(0.9 * plain, 9);
  });

  it("Long Arms: she takes down a guard 1.9 m away, out of the plain reach", () => {
    const started = (bought: boolean) => {
      const sim = withPerks(quietStreet(), { shadow_long_arms: 1 }, bought);
      sim.world.add(gangerEntity(4000, { key: "victim", position: offset(sim, 0, 1.9), yaw: 0 }, null, 80, sim.player()!.chunk ?? "", undefined, "tessen_guard"));
      const holds = collect<DomainEvents["TakedownStarted"]>(sim, "TakedownStarted");
      sim.step(CROUCH);
      sim.enqueue({ type: "takedown", lethal: false });
      sim.step(CROUCH);
      return holds.length;
    };
    expect(1.9).toBeGreaterThan(TAKEDOWN_REACH);
    expect(started(false)).toBe(0);
    expect(started(true)).toBe(1);
  });
});
