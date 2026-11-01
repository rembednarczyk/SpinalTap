import { describe, expect, it } from "vitest";
import type { DomainEvents } from "@seki/core";
import { WAKE_REACH, WAKE_TIME } from "../src";
import { collect, run } from "./helpers";
import { CROUCH, camera, patrol, quietStreet, stallholder, takeDown, ticks, victim, walkAway } from "./takedown-scenes";

/** Stage 2 of ADR-0065: who finds the body (BodyFound, the security's call, the search) and who wakes it. */

describe("a body found (ADR-0065)", () => {
  it("a guard of the security finds it: BodyFound, the call, the search from where she stood, reinforcements", () => {
    const sim = quietStreet();
    const guard = victim(sim);
    takeDown(sim);
    const stood = { ...sim.player()!.position };
    walkAway(sim);
    run(sim, 5, CROUCH);
    expect(sim.domain.heat.level).toBe(0);
    const found = collect<DomainEvents["BodyFound"]>(sim, "BodyFound");
    const reports = collect<DomainEvents["CrimeReported"]>(sim, "CrimeReported");
    // Twelve metres east of the body, looking at it.
    const finder = patrol(sim, 4100, { ...guard.position, x: guard.position.x + 12 }, -Math.PI / 2);
    sim.step(CROUCH);
    expect(found).toEqual([{ body: guard.id, finder: finder.id }]);
    expect(reports.map((r) => [r.crime, r.channel, r.witnessId])).toEqual([["assault", "patrol", finder.id]]);
    expect(reports[0]!.at.x).toBeCloseTo(stood.x, 6);
    expect(reports[0]!.at.z).toBeCloseTo(stood.z, 6);
    expect(sim.domain.heat.level).toBe(1);
    expect(sim.domain.heat.lastKnown?.z).toBeCloseTo(stood.z, 6);
    // It walks over to the body; the security sends its men out of her sight.
    run(sim, ticks(4), CROUCH);
    expect(Math.hypot(finder.position.x - guard.position.x, finder.position.z - guard.position.z)).toBeLessThanOrEqual(WAKE_REACH);
    run(sim, ticks(WAKE_TIME + 4), CROUCH);
    expect([...sim.world.with("security")].length).toBeGreaterThan(0);
    // The guard is up again, and nobody called twice.
    expect(guard.unconscious).toBeUndefined();
    expect(found).toHaveLength(1);
    expect(reports).toHaveLength(1);
  });

  it("wakes the knocked out after 6 s at its side, alerted and knowing where she stood", () => {
    const sim = quietStreet();
    const guard = victim(sim);
    takeDown(sim);
    const stood = { ...sim.player()!.position };
    walkAway(sim);
    // Right by the body, looking at it.
    const finder = patrol(sim, 4100, { ...guard.position, x: guard.position.x + 1.2 }, -Math.PI / 2);
    sim.step(CROUCH);
    expect(guard.downed?.finder).toBe(finder.id);
    run(sim, ticks(WAKE_TIME) - 2, CROUCH);
    expect(guard.unconscious).toBe(true);
    sim.step(CROUCH);
    expect(guard.unconscious).toBeUndefined();
    expect(guard.downed).toBeUndefined();
    expect(guard.ai!.alerted).toBe(true);
    expect(guard.ai!.lastKnown?.x).toBeCloseTo(stood.x, 6);
    expect(guard.ai!.lastKnown?.z).toBeCloseTo(stood.z, 6);
    expect(finder.ai!.lastKnown?.z).toBeCloseTo(stood.z, 6);
    expect(finder.ai!.alerted).toBe(false);
    // She stood right there: the woken guard looks around the place it remembers.
    sim.step(CROUCH);
    expect(guard.ai!.search).toBeGreaterThan(0);
  });

  it("a finder from afar walks over first, and wakes it on the same step every run", () => {
    const wokenAt = (seed: number): number => {
      const sim = quietStreet(seed);
      const guard = victim(sim);
      takeDown(sim);
      walkAway(sim);
      patrol(sim, 4100, { ...guard.position, x: guard.position.x + 9 }, -Math.PI / 2);
      for (let i = 1; i <= ticks(30); i++) {
        sim.step(CROUCH);
        if (!guard.unconscious) return i;
      }
      return -1;
    };
    const a = wokenAt(7);
    expect(a).toBeGreaterThan(ticks(WAKE_TIME));
    expect(wokenAt(7)).toBe(a);
    // Another seed (other passers-by on the square) changes nothing: the rules decide.
    expect(wokenAt(1234)).toBe(a);
  });

  it("a camera that sees the body reports it", () => {
    const sim = quietStreet();
    const guard = victim(sim);
    takeDown(sim);
    walkAway(sim);
    const found = collect<DomainEvents["BodyFound"]>(sim, "BodyFound");
    const reports = collect<DomainEvents["CrimeReported"]>(sim, "CrimeReported");
    const cam = camera(sim, 4200, { ...guard.position, z: guard.position.z - 7 }, 0);
    run(sim, 3, CROUCH);
    expect(found).toEqual([{ body: guard.id, finder: cam.id }]);
    expect(reports.map((r) => [r.crime, r.channel, r.witnessId])).toEqual([["assault", "camera", cam.id]]);
    expect(sim.domain.heat.level).toBe(1);
  });

  it("a civilian taken down unseen brings no heat, but its body found makes the street take fright", () => {
    const sim = quietStreet();
    const c = stallholder(sim);
    const spot = { ...c.position };
    const done = collect<DomainEvents["TakedownDone"]>(sim, "TakedownDone");
    const reports = collect(sim, "CrimeReported");
    const found = collect<DomainEvents["BodyFound"]>(sim, "BodyFound");
    const noise = collect<DomainEvents["Disturbance"]>(sim, "Disturbance");
    takeDown(sim);
    expect(done).toEqual([{ target: c.id, lethal: false, witnessed: false }]);
    walkAway(sim);
    // A bystander eight metres off (unless a passer-by of the square got there first).
    const at = { ...c.position, x: c.position.x - 8 };
    sim.world.add({ id: 4300, position: at, prevPosition: at, yaw: 0, prevYaw: 0, pitch: 0, faction: "civilians", velocity: { x: 0, y: 0, z: 0 }, civilian: { home: at } });
    sim.step(CROUCH);
    expect(found).toHaveLength(1);
    const finder = [...sim.world].find((e) => e.id === found[0]!.finder);
    expect(found[0]!.body).toBe(c.id);
    expect(finder?.civilian).toBeDefined();
    expect(finder?.civilian?.crowd?.state).toBe("fleeing");
    // The street around the body takes fright, as at a death (ADR-0029).
    expect(noise.filter((d) => d.kind === "body").map((d) => d.sourceId)).toEqual([c.id]);
    // A Hebi patrol walks over to it too, but calls nobody: no heat for a civilian.
    const g = patrol(sim, 4100, { ...c.position, x: c.position.x + 10 }, -Math.PI / 2);
    run(sim, ticks(3), CROUCH);
    expect(found.at(-1)).toEqual({ body: c.id, finder: g.id });
    expect(reports).toEqual([]);
    expect(sim.domain.heat.level).toBe(0);
    // Out cold it does not run with the rest.
    expect(c.unconscious).toBe(true);
    expect(c.position.x).toBeCloseTo(spot.x, 6);
    expect(c.position.z).toBeCloseTo(spot.z, 6);
  });
});
