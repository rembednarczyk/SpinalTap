import { describe, expect, it } from "vitest";
import { ALCHEMIA_CHUNK, FOODHALL, Simulation, gangerEntity, groundY } from "../src";
import { solidIndexOf } from "../src/world/solid-index";
import { run, teleportPlayer } from "./helpers";

/**
 * What a body in Alchemia collides with each step (20.11): the index gave it every prism of every
 * solid whose bounding box met its rectangle, the gallery's and the car park's buildings of
 * hundreds of prisms whole, some 250 colliders a query where those whose own boxes meet it are 57.
 * Every one of them is a pass of push-out, floor and foothold, each a loop over the others.
 */

/** Colliders per query, a brawler on his way from the car park down to the hall (249 before, 57 after). */
const PER_QUERY_LIMIT = 90;

describe("the colliders of a body in Alchemia (20.11)", () => {
  it("are those whose own boxes meet its rectangle, not every part of the buildings round it", () => {
    const sim = Simulation.create({ seed: 3 });
    teleportPlayer(sim, { x: 420, y: FOODHALL.floor, z: 51.6 });
    sim.step();
    const g = gangerEntity(9001, { key: "alch-cost", position: { x: 428, y: groundY(428, 10), z: 10 }, yaw: 0 }, null, 200, ALCHEMIA_CHUNK, undefined, "hebi_brawler");
    g.ai!.alerted = true;
    sim.world.add(g);
    const index = solidIndexOf(sim.world);
    const before = { ...index.stats };
    run(sim, 240);
    const queries = index.stats.colliderQueries - before.colliderQueries;
    const perQuery = (index.stats.colliders - before.colliders) / Math.max(1, queries);
    expect(Math.hypot(g.position.x - 428, g.position.z - 10)).toBeGreaterThan(3);
    expect(queries).toBeGreaterThan(0);
    expect(perQuery).toBeLessThan(PER_QUERY_LIMIT);
  });
});
