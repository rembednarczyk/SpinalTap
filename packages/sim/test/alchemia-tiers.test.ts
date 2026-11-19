import { describe, expect, it } from "vitest";
import { EMPTY_INPUT } from "@seki/core";
import { COURTYARD, FLIGHT_A, FLIGHT_B, FOODHALL, Simulation, TIER_A, TIER_B, tierLanding, tierPieces } from "../src";
import { teleportPlayer } from "./helpers";

/*
 * Alchemia's green tiers over the food hall (ADR-0074, decisions of 15.11): tier A of shops on the
 * hall's roof, tier B round its courtyard on A, both roofs terraces; the west stair climbs from T0
 * to A and on to B. The player walks up it to the green roof.
 */

/** Steps toward (x, z) until within 0.4 m, at most `steps`. */
const walkTo = (sim: Simulation, x: number, z: number, steps = 900): void => {
  for (let i = 0; i < steps; i++) {
    const p = sim.player()!;
    if (Math.hypot(x - p.position.x, z - p.position.z) < 0.4) return;
    const want = Math.atan2(x - p.position.x, z - p.position.z);
    sim.step({ ...EMPTY_INPUT, moveZ: 1, lookYaw: Math.atan2(Math.sin(want - p.yaw), Math.cos(want - p.yaw)) });
  }
};

describe("Alchemia's green tiers (ADR-0074, 15.11)", () => {
  it("stands A on the hall's roof inside its outline, B on A round the courtyard, off T0's back strip", () => {
    expect(TIER_A.bottom).toBe(FOODHALL.roof);
    expect(TIER_A.minX).toBeGreaterThan(FOODHALL.minX);
    expect(TIER_A.maxX).toBeLessThan(FOODHALL.maxX);
    // The stair house and the lift's kiosk keep the back strip (z up to 34.8).
    expect(TIER_A.minZ).toBeGreaterThan(35);
    expect(TIER_A.maxZ).toBeLessThan(FOODHALL.maxZ - 3);
    expect(TIER_B.bottom).toBe(TIER_A.top);
    for (const k of ["minX", "minZ"] as const) expect(TIER_B[k]).toBeGreaterThan(TIER_A[k]);
    for (const k of ["maxX", "maxZ"] as const) expect(TIER_B[k]).toBeLessThan(TIER_A[k]);
    expect(COURTYARD.minX).toBeGreaterThan(TIER_B.minX);
    expect(COURTYARD.maxX).toBeLessThan(TIER_B.maxX);
    // The board's high green tiers: about two storeys over the roof, under the tenements round it.
    expect(TIER_B.top - FOODHALL.roof).toBeGreaterThan(8);
    expect(TIER_B.top - FOODHALL.roof).toBeLessThan(10);
  });

  it("climbs each flight to its roof's level, its landing in a gap of the parapet", () => {
    const pieces = tierPieces();
    for (const [f, top] of [
      [FLIGHT_A, TIER_A.top],
      [FLIGHT_B, TIER_B.top],
    ] as const) {
      const l = tierLanding(f);
      const landing = pieces.find((p) => p.kind === "step" && p.box.z0 === l.z0 && p.box.x0 === f.x0)!;
      // A balustrade over the drop beside it and across its far end.
      expect(pieces.some((p) => p.kind === "parapet" && p.box.x0 === f.x0 && p.box.z1 === l.z1 && p.box.y1 > top)).toBe(true);
      expect(pieces.some((p) => p.kind === "parapet" && p.box.z0 === l.z1 && p.box.x1 === f.x1)).toBe(true);
      expect(landing.box.y1).toBeCloseTo(top, 6);
      // No parapet stands across the landing's way onto the roof.
      const across = pieces.filter((p) => p.kind === "parapet" && p.box.y0 === top && p.box.x0 <= f.x1 + 0.3 && p.box.x1 >= f.x1 && p.box.z1 > l.z0 && p.box.z0 < l.z1);
      expect(across).toEqual([]);
      // Risers the movement takes in its stride.
      expect(f.rise / f.risers).toBeLessThan(0.2);
    }
  });

  it("lets the player walk from the hall's roof up to the green roof of B", () => {
    const sim = Simulation.create({ seed: 3 });
    teleportPlayer(sim, { x: (FLIGHT_A.x0 + FLIGHT_A.x1) / 2, y: FOODHALL.roof + 0.05, z: FLIGHT_A.z0 - 1.4 }, 0);
    sim.step();
    const a = tierLanding(FLIGHT_A);
    walkTo(sim, (FLIGHT_A.x0 + FLIGHT_A.x1) / 2, (a.z0 + a.z1) / 2);
    expect(sim.player()!.position.y).toBeCloseTo(TIER_A.top, 1);
    // Off the landing onto A's west walk, south past the second flight, round to its foot.
    const walkX = (TIER_A.minX + FLIGHT_B.x0) / 2 + 0.1;
    // Walked on past the landing's end, she stays on it: the balustrade.
    walkTo(sim, (FLIGHT_A.x0 + FLIGHT_A.x1) / 2, a.z1 + 3, 120);
    expect(sim.player()!.position.y).toBeCloseTo(TIER_A.top, 1);
    walkTo(sim, walkX, (a.z0 + a.z1) / 2);
    walkTo(sim, walkX, FLIGHT_B.z0 - 0.9);
    walkTo(sim, (FLIGHT_B.x0 + FLIGHT_B.x1) / 2, FLIGHT_B.z0 - 0.9);
    const b = tierLanding(FLIGHT_B);
    walkTo(sim, (FLIGHT_B.x0 + FLIGHT_B.x1) / 2, (b.z0 + b.z1) / 2);
    walkTo(sim, TIER_B.minX + 2, (b.z0 + b.z1) / 2);
    const p = sim.player()!.position;
    expect(p.y).toBeCloseTo(TIER_B.top, 1);
    expect(p.x).toBeGreaterThan(TIER_B.minX);
  });
});
