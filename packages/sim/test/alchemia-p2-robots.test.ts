import { describe, expect, it } from "vitest";
import { GAME_SECONDS_PER_REAL_SECOND } from "@seki/core";
import { P2, P2_LANE, P2_ROBOT, P2_ROBOTS, Simulation, shuttleProgress } from "../src";
import { teleportPlayer } from "./helpers";

/** P-2's robots (ADR-0074 stage 5b): carts on the lane's rails, running by the clock. */
describe("P-2's robots (ADR-0074 stage 5b)", () => {
  const robots = (sim: Simulation) => [...sim.world].filter((e) => e.shuttle?.key.startsWith("alchemia-p2-robot")).sort((a, b) => a.shuttle!.key.localeCompare(b.shuttle!.key));
  const loaded = (): Simulation => {
    const sim = Simulation.create({ seed: 4 });
    teleportPlayer(sim, { x: 412, y: P2.floor, z: 20 });
    sim.step();
    return sim;
  };

  it("runs each cart along its half of the lane, pausing at both ends, by the clock alone", () => {
    const s = { key: "t", base: { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 1 } }, axis: "z" as const, travel: 10, period: 20, phase: 0, pause: 0.1 };
    expect(shuttleProgress(s, 0)).toBe(0);
    expect(shuttleProgress(s, 1.9)).toBe(0);
    expect(shuttleProgress(s, 6)).toBeCloseTo(0.5, 6);
    expect(shuttleProgress(s, 10.5)).toBe(1);
    expect(shuttleProgress(s, 16)).toBeCloseTo(0.5, 6);
    expect(shuttleProgress(s, 20)).toBe(0);
    const sim = loaded();
    const rs = robots(sim);
    expect(rs).toHaveLength(P2_ROBOTS.length);
    const seen = rs.map(() => ({ min: Infinity, max: -Infinity }));
    for (let i = 0; i < 60 * P2_ROBOT.period; i += 10) {
      sim.step();
      rs.forEach((r, k) => {
        seen[k]!.min = Math.min(seen[k]!.min, r.position.z);
        seen[k]!.max = Math.max(seen[k]!.max, r.position.z);
        // On the lane, between its walkways.
        expect(r.solid!.min.x).toBeGreaterThan(P2_LANE.x0 + 1);
        expect(r.solid!.max.x).toBeLessThan(P2_LANE.x1 - 1);
        expect(r.solid!.min.y).toBeCloseTo(P2.floor, 6);
      });
      for (let j = 0; j < 9; j++) sim.step();
    }
    for (const s of seen) expect(s.max - s.min).toBeGreaterThan(P2_ROBOT.travel - 0.3);
    // Their runs never meet.
    expect(seen[0]!.max + P2_ROBOT.length / 2).toBeLessThan(seen[1]!.min - P2_ROBOT.length / 2);
  });

  it("puts the carts back where they were after a load, and on by a wait", () => {
    const sim = loaded();
    for (let i = 0; i < 60 * 7; i++) sim.step();
    const before = robots(sim).map((r) => ({ ...r.position }));
    const snap = JSON.parse(JSON.stringify(sim.snapshot(null, "t", ""))) as ReturnType<Simulation["snapshot"]>;
    const restored = Simulation.fromSnapshot(snap);
    restored.step();
    sim.step();
    expect(robots(restored).map((r) => r.position)).toEqual(robots(sim).map((r) => r.position));
    expect(before).toHaveLength(P2_ROBOTS.length);
    const t0 = sim.domain.clock.seconds / GAME_SECONDS_PER_REAL_SECOND;
    expect(robots(sim)[0]!.position.z).toBeCloseTo(P2_ROBOTS[0]!.center.z + P2_ROBOT.travel * shuttleProgress(robots(sim)[0]!.shuttle!, t0), 6);
  });

  it("pushes the player standing in a cart's way aside, never into it", () => {
    const sim = loaded();
    const r = robots(sim)[0]!;
    const mx = (P2_LANE.x0 + P2_LANE.x1) / 2;
    teleportPlayer(sim, { x: mx + 0.3, y: P2.floor, z: P2_ROBOTS[0]!.center.z + P2_ROBOT.travel / 2 });
    const p = sim.player()!;
    for (let i = 0; i < 60 * P2_ROBOT.period; i++) {
      sim.step();
      const b = r.solid!;
      const inside = p.position.x > b.min.x + 0.05 && p.position.x < b.max.x - 0.05 && p.position.z > b.min.z + 0.05 && p.position.z < b.max.z - 0.05 && p.position.y < b.max.y - 0.05;
      expect(inside, `step ${i}: ${p.position.x.toFixed(2)},${p.position.z.toFixed(2)}`).toBe(false);
    }
  });
});
