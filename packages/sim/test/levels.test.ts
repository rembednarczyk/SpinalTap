import { describe, expect, it } from "vitest";
import { type Aabb, FOOTBRIDGE_TOP, MARKET_PLACE, OVERPASS_TOP, Simulation, ground, groundY, market, raySolid, topAt } from "../src";
import { input, run, teleportPlayer } from "./helpers";

const EAST = Math.PI / 2;
const WEST = -Math.PI / 2;
const NORTH = 0;
const SOUTH = Math.PI;

/**
 * A world with the market loaded and the player at the given spot of it. The market keeps its
 * own coordinates, moved onto Aleja Tysiąclecia by `MARKET_PLACE` (ADR-0045): points go in and
 * come back out in them.
 */
const at = (x: number, y: number, z: number, yaw = NORTH): Simulation => {
  const sim = Simulation.create({ seed: 1 });
  teleportPlayer(sim, market(x, y, z), yaw);
  run(sim, 2);
  teleportPlayer(sim, market(x, y, z), yaw);
  return sim;
};

const player = (sim: Simulation) => {
  const p = sim.player()!.position;
  return { x: p.x - MARKET_PLACE.x, y: p.y - MARKET_PLACE.y, z: p.z - MARKET_PLACE.z };
};

/** Walks forward along `yaw` until `done` or the step limit. */
const walk = (sim: Simulation, yaw: number, done: (p: { x: number; y: number; z: number }) => boolean, max = 900) => {
  sim.player()!.yaw = yaw;
  for (let i = 0; i < max && !done(player(sim)); i++) sim.step(input({ moveZ: 1 }));
  return player(sim);
};

const lift = (sim: Simulation) => sim.world.with("elevator", "solid").entities.find((e) => e.elevator.key === "targ-lift")!;

describe("levels (ADR-0020)", () => {
  it("climbs the stairs onto the overpass and walks along it", () => {
    const sim = at(69.2, 0, 98.1, EAST);
    const top = walk(sim, EAST, (p) => p.x > 87);
    expect(top.y).toBeCloseTo(OVERPASS_TOP, 5);
    const deck = walk(sim, SOUTH, (p) => p.z < 92);
    expect(deck.y).toBeCloseTo(OVERPASS_TOP, 5);
    // Walking down follows the steps instead of falling.
    walk(sim, NORTH, (p) => p.z > 98);
    let fell = false;
    sim.player()!.yaw = WEST;
    for (let i = 0; i < 400 && player(sim).x > 70; i++) {
      sim.step(input({ moveZ: 1 }));
      fell ||= sim.player()!.fall !== undefined;
    }
    expect(fell).toBe(false);
    expect(player(sim).y).toBeCloseTo(0, 5);
  });

  it("railings keep the player on the deck", () => {
    const sim = at(96, OVERPASS_TOP, 92, SOUTH);
    run(sim, 200, input({ moveZ: 1 }));
    expect(player(sim).z).toBeGreaterThan(87.2);
    expect(player(sim).y).toBeCloseTo(OVERPASS_TOP, 5);
    walk(sim, EAST, (p) => p.x > 200, 900);
    expect(player(sim).x).toBeLessThan(125.8);
  });

  it("walks under the deck at street level and falls from the air", () => {
    const under = at(96, 0, 92.5, EAST);
    run(under, 60, input({ moveZ: 1 }));
    expect(player(under).y).toBeCloseTo(0, 5);
    const air = at(96, OVERPASS_TOP, 80);
    run(air, 2);
    expect(air.player()!.fall).toBeLessThan(0);
    run(air, 90);
    expect(player(air).y).toBeCloseTo(0, 5);
    expect(air.player()!.fall).toBeUndefined();
  });

  it("the freight lift carries the player up, and its gate guards the shaft", () => {
    // From the deck the gate is shut while the platform is down.
    const deck = at(108, OVERPASS_TOP, 89, SOUTH);
    run(deck, 120, input({ moveZ: 1 }));
    expect(player(deck).z).toBeGreaterThan(87.2);
    expect(player(deck).y).toBeCloseTo(OVERPASS_TOP, 5);

    const sim = at(108, 0.15, 85.7);
    expect(lift(sim).solid.max.y - MARKET_PLACE.y).toBeCloseTo(0.15);
    run(sim, 2);
    expect(sim.session.focusPrompt).toBe("prompt.elevator");
    sim.step(input({ interact: true }));
    // Riders cannot walk off mid-ride.
    run(sim, 60, input({ moveZ: 1 }));
    expect(player(sim).z).toBeCloseTo(85.7, 5);
    run(sim, 240);
    expect(lift(sim).solid.max.y - MARKET_PLACE.y).toBeCloseTo(OVERPASS_TOP, 5);
    expect(player(sim).y).toBeCloseTo(OVERPASS_TOP, 5);
    // The gate has sunk into the deck: step off north onto the overpass.
    run(sim, 30);
    const off = walk(sim, NORTH, (p) => p.z > 89);
    expect(off.z).toBeGreaterThan(89);
    expect(off.y).toBeCloseTo(OVERPASS_TOP, 5);
    // Calling it from the deck while it is already here does nothing; a ride back down does.
    sim.step(input({ interact: true }));
    run(sim, 10);
    expect(lift(sim).solid.max.y - MARKET_PLACE.y).toBeCloseTo(OVERPASS_TOP, 5);
  });

  it("a body under the platform stops it coming down", () => {
    const sim = at(108, 0.15, 85.7);
    sim.step(input({ interact: true }));
    run(sim, 300);
    // Down below, with the platform up: stand in the shaft and call it.
    teleportPlayer(sim, market(108, 0, 83), NORTH);
    run(sim, 2);
    sim.step(input({ interact: true }));
    teleportPlayer(sim, market(108, 0, 85.7), NORTH);
    run(sim, 400);
    expect(lift(sim).solid.min.y - MARKET_PLACE.y).toBeGreaterThan(1.8);
  });

  it("the covered footbridge over Grodzka hangs out of reach: the street runs on under it (ADR-0045)", () => {
    const sim = Simulation.create({ seed: 1 });
    // Down Grodzka from the Rynek's side, under the footbridge, towards Brama Grodzka.
    const start = ground(648, 59);
    teleportPlayer(sim, start, Math.atan2(708 - 637, 134 - 47));
    run(sim, 2);
    for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
    for (let i = 0; i < 6 * 60; i++) sim.step(input({ moveZ: 1 }));
    const p = sim.player()!.position;
    expect(Math.hypot(p.x - start.x, p.z - start.z)).toBeGreaterThan(15);
    expect(p.y).toBeLessThan(groundY(p.x, p.z) + 0.3);
    expect(p.y).toBeLessThan(start.y + FOOTBRIDGE_TOP - 2);
  });

  it("a stairs prop rises along its axis and stops rays only under its slope", () => {
    const box: Aabb = { min: { x: 0, y: 0, z: 0 }, max: { x: 10, y: 5, z: 2 } };
    const slope = { axis: "x", dir: 1, low: 0 } as const;
    expect(topAt(box, slope, 0, 1)).toBe(0);
    expect(topAt(box, slope, 5, 1)).toBe(2.5);
    expect(topAt(box, { ...slope, dir: -1 }, 2, 1)).toBe(4);
    expect(topAt(box, undefined, 2, 1)).toBe(5);
    // Level ray above the slope's low half passes, through the high half it stops.
    const t = raySolid({ x: -1, y: 3, z: 1 }, { x: 1, y: 0, z: 0 }, box, slope, 20);
    expect(t).toBeCloseTo(7, 5);
    expect(raySolid({ x: -1, y: 6, z: 1 }, { x: 1, y: 0, z: 0 }, box, slope, 20)).toBeNull();
    // A ray starting on the stairs, aimed down the flight, leaves without hitting the ramp at once.
    const down = raySolid({ x: 6, y: 4.6, z: 1 }, { x: -1, y: 0, z: 0 }, box, slope, 20);
    expect(down).toBeNull();
    expect(raySolid({ x: -1, y: 1, z: 1 }, { x: 1, y: 0, z: 0 }, box, undefined, 20)).toBe(1);
  });
});
