import { describe, expect, it } from "vitest";
import { Simulation, ground } from "../src";
import { LUBLIN_CHUNKS } from "../src/content/lublin";
import { BASIN_RIM, basinRimProps } from "../src/content/lublin/basins";
import { lineOfSight } from "../src/world/hitscan";
import { run, teleportPlayer } from "./helpers";

/** The fountains' basins of the map (ADR-0044), with the chunk each lies in. */
const basins = LUBLIN_CHUNKS.flatMap((c) => c.ground.filter((g) => g.surface === "basin").map((g) => ({ chunk: c, outline: g.outline })));

describe("fountain rims (ADR-0044)", () => {
  it("are a solid block along every side of every basin", () => {
    expect(basins.length).toBeGreaterThan(0);
    for (const c of LUBLIN_CHUNKS) {
      const sides = c.ground.filter((g) => g.surface === "basin").reduce((n, g) => n + g.outline.length / 2, 0);
      expect(basinRimProps(c).length).toBeLessThanOrEqual(sides);
      expect(basinRimProps(c).length).toBeGreaterThanOrEqual(sides > 0 ? 3 : 0);
    }
  });

  it("stop a walker's shins at the stone and let the eye over it", () => {
    const { outline } = basins[0]!;
    const a = { x: outline[0]!, z: outline[1]! };
    const b = { x: outline[2]!, z: outline[3]! };
    let cx = 0;
    let cz = 0;
    for (let i = 0; i < outline.length; i += 2) {
      cx += outline[i]! / (outline.length / 2);
      cz += outline[i + 1]! / (outline.length / 2);
    }
    // Across the middle of the first side, from 2 m outside to the basin's middle.
    const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
    const d = Math.hypot(mid.x - cx, mid.z - cz);
    const out = { x: mid.x + ((mid.x - cx) / d) * 2, z: mid.z + ((mid.z - cz) / d) * 2 };
    const sim = Simulation.create({ seed: 1 });
    teleportPlayer(sim, ground(out.x, out.z));
    run(sim, 2);
    const y = ground(mid.x, mid.z).y;
    const low = (p: { x: number; z: number }) => ({ x: p.x, y: y + BASIN_RIM.top / 2, z: p.z });
    const high = (p: { x: number; z: number }) => ({ x: p.x, y: y + BASIN_RIM.top + 0.6, z: p.z });
    expect(lineOfSight(sim.world, low(out), low({ x: cx, z: cz }), false)).toBe(false);
    expect(lineOfSight(sim.world, high(out), high({ x: cx, z: cz }), false)).toBe(true);
  });
});
