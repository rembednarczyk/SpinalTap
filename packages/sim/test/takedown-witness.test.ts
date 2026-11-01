import { describe, expect, it } from "vitest";
import type { DomainEvents } from "@seki/core";
import { escortEntity } from "../src";
import { collect, run } from "./helpers";
import { CROUCH, camera, offset, patrol, quietStreet, stallholder, takeDown, ticks, victim } from "./takedown-scenes";

/** Stage 2 of ADR-0065: who sees a takedown (an assault, heat as for an attack on a civilian). */

describe("witnesses of a takedown (ADR-0065)", () => {
  it("unseen it is no crime: no report, no heat", () => {
    const sim = quietStreet();
    const guard = victim(sim);
    const done = collect<DomainEvents["TakedownDone"]>(sim, "TakedownDone");
    const reports = collect(sim, "CrimeReported");
    takeDown(sim);
    run(sim, ticks(2), CROUCH);
    expect(done).toEqual([{ target: guard.id, lethal: false, witnessed: false }]);
    expect(reports).toEqual([]);
    expect(sim.domain.heat.level).toBe(0);
  });

  it("seen by a patrol it is an assault, a level below a murder", () => {
    for (const lethal of [false, true]) {
      const sim = quietStreet();
      const guard = victim(sim);
      // Ten metres east, looking at her.
      const w = patrol(sim, 4100, offset(sim, 10, 0), -Math.PI / 2);
      const done = collect<DomainEvents["TakedownDone"]>(sim, "TakedownDone");
      const reports = collect<DomainEvents["CrimeReported"]>(sim, "CrimeReported");
      takeDown(sim, lethal);
      expect(done).toEqual([{ target: guard.id, lethal, witnessed: true }]);
      expect(reports.map((r) => [r.crime, r.channel, r.witnessId])).toEqual(
        lethal ? [["assault", "patrol", w.id], ["murder", "patrol", w.id]] : [["assault", "patrol", w.id]],
      );
      expect(sim.domain.heat.level).toBe(lethal ? 2 : 1);
      expect(sim.domain.heat.faction).toBe("hebi");
    }
  });

  it("a camera is a witness", () => {
    const sim = quietStreet();
    const guard = victim(sim);
    // Six metres south of her, looking north at her.
    const cam = camera(sim, 4200, offset(sim, 0, -6), 0);
    const done = collect<DomainEvents["TakedownDone"]>(sim, "TakedownDone");
    const reports = collect<DomainEvents["CrimeReported"]>(sim, "CrimeReported");
    takeDown(sim);
    expect(done).toEqual([{ target: guard.id, lethal: false, witnessed: true }]);
    expect(reports.map((r) => [r.crime, r.channel, r.witnessId])).toEqual([["assault", "camera", cam.id]]);
    expect(sim.domain.heat.level).toBe(1);
  });

  it("a guard knocked out mid-fight is no crime, even seen", () => {
    const sim = quietStreet();
    const guard = victim(sim);
    guard.ai!.alerted = true;
    guard.melee!.stagger = 2;
    guard.melee!.stunned = true;
    patrol(sim, 4100, offset(sim, 10, 0), -Math.PI / 2);
    const done = collect<DomainEvents["TakedownDone"]>(sim, "TakedownDone");
    const reports = collect(sim, "CrimeReported");
    takeDown(sim);
    expect(guard.unconscious).toBe(true);
    expect(done).toEqual([{ target: guard.id, lethal: false, witnessed: true }]);
    expect(reports).toEqual([]);
  });

  it("takes down a civilian with health, but not an escort", () => {
    const sim = quietStreet();
    const c = stallholder(sim);
    sim.step(CROUCH);
    expect(sim.session.takedownTarget?.id).toBe(c.id);
    sim.world.remove(c);
    sim.world.add(escortEntity(4001, "mika", [offset(sim, 0, 1.2)], sim.player()!.chunk ?? ""));
    sim.step(CROUCH);
    expect(sim.session.takedownTarget).toBeNull();
  });
});
