import { describe, expect, it } from "vitest";
import { EMPTY_INPUT, type Vec3 } from "@seki/core";
import {
  METRO_DOOR,
  METRO_DOOR_FOOT,
  METRO_DOOR_PIECES,
  METRO_DOOR_TOP,
  METRO_ENTRANCES,
  P1,
  P1_METRO_OPENING,
  P1_PIECES,
  Simulation,
  WORLD_NAV,
  groundY,
  interiorAt,
  metroDoorStepY,
} from "../src";
import { routeAcrossLevels } from "../src/world/nav";
import { teleportPlayer } from "./helpers";

/*
 * The door from metro B's hall down to P-1 (ADR-0074 stage 10): the end wall of the hall opens on
 * eleven steps down under the terrain into P-1 through its east wall; the player walks down and up.
 */

const B = METRO_ENTRANCES.find((e) => e.station === "kanal" && e.label === "B")!;
const node = (id: string): Vec3 => WORLD_NAV.nodes.find((n) => n.id === id)!.at;

/** Steps toward (x, z) until within 0.4 m, at most `steps`. */
const walkTo = (sim: Simulation, x: number, z: number, steps = 600): void => {
  for (let i = 0; i < steps; i++) {
    const p = sim.player()!;
    if (Math.hypot(x - p.position.x, z - p.position.z) < 0.4) return;
    const want = Math.atan2(x - p.position.x, z - p.position.z);
    sim.step({ ...EMPTY_INPUT, moveZ: 1, lookYaw: Math.atan2(Math.sin(want - p.yaw), Math.cos(want - p.yaw)) });
  }
};

describe("the door from metro B's hall down to P-1 (ADR-0074 stage 10)", () => {
  it("opens B's end wall over its floor, on a passage as wide as its hall, through P-1's east wall", () => {
    expect(B.endDoor).toEqual({ head: METRO_DOOR.ceiling - B.floor, through: true });
    // The pavilion keeps its number of blocks: the end wall one block over the head, none under the floor.
    const size = (p: (typeof B.props)[number]): Vec3 => (p.view as { size: Vec3 }).size;
    const end = B.props.filter((p) => p.view.kind === "block" && size(p).x < 0.3 && Math.abs(p.center.x - size(p).x / 2 - B.outline.minX) < 1e-6 && p.center.y + size(p).y / 2 <= B.street + 0.5 + 1e-6);
    expect(end).toHaveLength(1);
    expect(end[0]!.center.y - size(end[0]!).y / 2).toBeCloseTo(METRO_DOOR.ceiling, 6);
    expect([P1_METRO_OPENING.minZ, P1_METRO_OPENING.maxZ]).toEqual([B.cut.bounds.minZ, B.cut.bounds.maxZ]);
    // No wall of P-1 stands across the opening.
    const across = P1_PIECES.filter((p) => p.kind === "wall" && p.box.x1 >= P1.maxX - P1.wall && p.box.x0 < P1.maxX && p.box.z1 > P1_METRO_OPENING.minZ && p.box.z0 < P1_METRO_OPENING.maxZ);
    expect(across).toEqual([]);
    expect(METRO_DOOR.outer - METRO_DOOR.wall).toBeCloseTo(2.4, 1);
  });

  it("keeps the risers in the stride, 2 m of headroom over every step and the slab under the terrain", () => {
    expect((METRO_DOOR.hall - METRO_DOOR.floor) / METRO_DOOR.risers).toBeLessThan(0.18);
    for (let x = METRO_DOOR_FOOT + 0.01; x < METRO_DOOR.inner; x += 0.07) {
      const over = x >= METRO_DOOR.wall ? METRO_DOOR.ceiling : P1.ceiling;
      expect(over - metroDoorStepY(x), `x ${x.toFixed(2)}`).toBeGreaterThan(2);
    }
    expect(METRO_DOOR_TOP - METRO_DOOR.ceiling).toBeGreaterThan(0.2);
    for (const p of METRO_DOOR_PIECES) expect(p.box.y1).toBeLessThan(Math.min(groundY(p.box.x0, p.box.z0), groundY(p.box.x1, p.box.z1)));
  });

  it("walks the player from B's hall down to P-1 and back up, in P-1's interior on the steps", () => {
    const sim = Simulation.create({ seed: 4 });
    teleportPlayer(sim, B.hallSpot, 0);
    sim.step();
    const door = node("metro-kanal-B-end");
    const foot = node("alchemia-p1-metro-foot");
    walkTo(sim, door.x + 0.6, door.z);
    walkTo(sim, foot.x, foot.z);
    const p = sim.player()!.position;
    expect(p.y).toBeCloseTo(P1.floor, 1);
    expect(interiorAt(p)?.id).toBe("alchemia-parking");
    walkTo(sim, door.x + 0.6, door.z);
    expect(sim.player()!.position.y).toBeCloseTo(B.floor, 1);
  });

  it("routes across the levels from the street at metro B down to P-1's apron, and back", () => {
    const sim = Simulation.create({ seed: 4 });
    teleportPlayer(sim, B.hallSpot, 0);
    sim.step();
    const apron = node("alchemia-p1-apron");
    for (const s of [B.hallSpot, B.door]) {
      expect(routeAcrossLevels(sim.world, WORLD_NAV, s, apron), "down").not.toBeNull();
      expect(routeAcrossLevels(sim.world, WORLD_NAV, apron, s), "up").not.toBeNull();
    }
  });
});
