import { describe, expect, it } from "vitest";
import { Simulation, gangerEntity, ground } from "../src";
import { MAP_CHUNKS, PASSAGES } from "../src/content/lublin/sites";
import { input, run, teleportPlayer } from "./helpers";

/** The covered lanes of the Old Town the map draws under its houses (ADR-0048). */
const LANES = [
  ["Rybna", "w66293430"],
  ["Ku Farze", "w66293395"],
] as const;

describe("passages through the map's buildings (ADR-0048)", () => {
  it("come from the map's gateways too, the gates' own buildings left to the hand-made ones", () => {
    expect(PASSAGES.length).toBeGreaterThan(15);
    expect(PASSAGES.filter((p) => p.building === "w232362876")).toHaveLength(1);
    for (const [, building] of LANES) expect(PASSAGES.some((p) => p.building === building)).toBe(true);
  });

  it.each(LANES)("%s runs on under its house: the player walks through", (_, building) => {
    const p = PASSAGES.find((x) => x.building === building)!;
    const sim = Simulation.create({ seed: 1 });
    const start = ground(p.from.x, p.from.z);
    teleportPlayer(sim, start, Math.atan2(p.to.x - p.from.x, p.to.z - p.from.z));
    run(sim, 2);
    for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
    const len = Math.hypot(p.to.x - p.from.x, p.to.z - p.from.z);
    for (let i = 0; i < 5 * 60; i++) sim.step(input({ moveZ: 1 }));
    const at = sim.player()!.position;
    // Past the far facade, on the passage's line.
    expect(((at.x - p.from.x) * (p.to.x - p.from.x) + (at.z - p.from.z) * (p.to.z - p.from.z)) / len).toBeGreaterThan(len - 0.5);
  });
});

type P = { readonly x: number; readonly z: number };

/**
 * The middles of Brama Grodzka's fronts as the street sees them (G-136): of the wall at Grodzka
 * less the stretch Teatr NN stands in front of, and of the castle's between w66293322 and its
 * other neighbour, from the map data (the scan's `gate-mouth-off-axis`, 1.11).
 */
const GRODZKA_FRONT: P = { x: 706.83, z: 135.14 };
const CASTLE_FRONT: P = { x: 720.92, z: 147.91 };
const SPAN = Math.hypot(CASTLE_FRONT.x - GRODZKA_FRONT.x, CASTLE_FRONT.z - GRODZKA_FRONT.z);

/** The point `d` metres along the line from a to b (before a when negative). */
const onLine = (a: P, b: P, d: number): P => {
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  return { x: a.x + ((b.x - a.x) / len) * d, z: a.z + ((b.z - a.z) / len) * d };
};

/** Where along the line from a to b a point is, and how far off it. */
const alongLine = (a: P, b: P, p: P): { s: number; off: number } => {
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  const [ux, uz] = [(b.x - a.x) / len, (b.z - a.z) / len];
  return { s: (p.x - a.x) * ux + (p.z - a.z) * uz, off: (p.x - a.x) * uz - (p.z - a.z) * ux };
};

const chunkOf = (p: P): string => MAP_CHUNKS.find(({ bounds: b }) => p.x >= b.minX && p.x <= b.maxX && p.z >= b.minZ && p.z <= b.maxZ)!.id;

/** How long an alerted brawler from `from` takes to come within 2.5 m of the player at `target`, or null within 15 s. */
const chase = (from: P, target: P): number | null => {
  const sim = Simulation.create({ seed: 3 });
  teleportPlayer(sim, ground(target.x, target.z));
  sim.step();
  const p = sim.player()!;
  const g = gangerEntity(9001, { key: "g136-brawler", position: ground(from.x, from.z), yaw: 0 }, null, 200, chunkOf(from), undefined, "hebi_brawler");
  g.ai!.alerted = true;
  sim.world.add(g);
  for (let i = 0; i < 60 * 15; i++) {
    sim.step();
    if (Math.hypot(g.position.x - p.position.x, g.position.z - p.position.z) < 2.5) return i / 60;
  }
  return null;
};

describe("through Brama Grodzka on the axis of its fronts (G-136)", () => {
  it.each([
    ["down from Grodzka to the castle", GRODZKA_FRONT, CASTLE_FRONT],
    ["up from the castle to Grodzka", CASTLE_FRONT, GRODZKA_FRONT],
  ])("the player walks %s without brushing a jamb or a wall of the passage", (_, a, b) => {
    const sim = Simulation.create({ seed: 1 });
    const start = onLine(a, b, -4);
    teleportPlayer(sim, ground(start.x, start.z), Math.atan2(b.x - a.x, b.z - a.z));
    run(sim, 2);
    for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
    let worst = 0;
    for (let i = 0; i < 6 * 60; i++) {
      sim.step(input({ moveZ: 1 }));
      const at = alongLine(a, b, sim.player()!.position);
      if (at.s < SPAN + 1) worst = Math.max(worst, Math.abs(at.off));
    }
    // Past the far front, never pushed off the line by a jamb or the passage's wall.
    expect(alongLine(a, b, sim.player()!.position).s).toBeGreaterThan(SPAN + 1);
    expect(worst).toBeLessThan(0.1);
  });

  it("an alerted brawler follows the player through it from the castle's side and from Grodzka", () => {
    const castle = onLine(GRODZKA_FRONT, CASTLE_FRONT, SPAN + 6);
    const grodzka = onLine(GRODZKA_FRONT, CASTLE_FRONT, -6);
    expect(chase(castle, grodzka)).not.toBeNull();
    expect(chase(grodzka, castle)).not.toBeNull();
  });
});
