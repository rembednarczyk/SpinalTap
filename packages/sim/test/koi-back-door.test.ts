import { describe, expect, it } from "vitest";
import type { Vec3 } from "@seki/core";
import { DOOR_MOVE_TIME, KOI_BACK_DOOR, SIM_HZ, Simulation, WORLD_NAV, type DoorDef, interiorAt, koiPoint } from "../src";
import { routeAcrossLevels } from "../src/world/nav";
import { input, run, teleportPlayer } from "./helpers";

/*
 * Neon Koi's back door to its yard (`docs/lokacje/koi-podworko.md`, the bar's card: "a second way out through the back
 * room to the yard"): a staff doorway at the west end of the bottle shelf, a corridor through the tenement's ground
 * floor, two steps up and a steel door in the back wall. Before it the back wall was whole and the yard was reached only
 * round the block.
 */

const koi = (x: number, z: number, y = 0): Vec3 => koiPoint(x, y, z);
/** The yard south of the door, on its ground. */
const YARD: Vec3 = { x: KOI_BACK_DOOR.at.x, y: 0.15, z: -111.4 };

const leaf = (sim: Simulation, door: DoorDef) => [...sim.world.with("door")].find((e) => e.door.door === door.key);

/** A new game with the player at `p` facing `yaw`, every AI of the street taken out. */
const quietAt = (p: Vec3, yaw: number): Simulation => {
  const sim = Simulation.create({ seed: 3 });
  teleportPlayer(sim, p, yaw);
  run(sim, 2);
  for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
  return sim;
};

describe("Neon Koi's back door to the yard", () => {
  it("counts the back room as the bar's inside, and the yard outside it", () => {
    expect(interiorAt(koi(20, KOI_BACK_DOOR.at.x - koi(0, 0).x, 0.5))?.id).toBe("neon-koi");
    expect(interiorAt(YARD)).toBeNull();
  });

  it("lets Seki walk from the shelf's end through the back room, up the steps and out into the yard", () => {
    // Facing south (yaw π): old +x, deeper into the building.
    const sim = quietAt(koi(16.2, KOI_BACK_DOOR.at.x - koi(0, 0).x), Math.PI);
    run(sim, 6 * SIM_HZ, input({ moveZ: 1 }));
    const p = sim.player()!.position;
    expect(p.z).toBeLessThan(-111);
    expect(Math.abs(p.x - KOI_BACK_DOOR.at.x)).toBeLessThan(0.5);
    expect(p.y).toBeGreaterThan(-0.1);
  });

  it("opens for her from the yard and lets her in, down the steps to the bar", () => {
    const sim = quietAt(YARD, 0);
    run(sim, Math.ceil(DOOR_MOVE_TIME * SIM_HZ) + 1);
    expect(leaf(sim, KOI_BACK_DOOR)?.door.open).toBe(1);
    run(sim, 6 * SIM_HZ, input({ moveZ: 1 }));
    const p = sim.player()!.position;
    expect(p.z).toBeGreaterThan(-103.5);
    expect(interiorAt(p)?.id).toBe("neon-koi");
  });

  it("gives the bar's people and the yard's crew a way between them through the back room", () => {
    const sim = quietAt(YARD, 0);
    // From the yard to Kaito's place at the counter, and back.
    expect(routeAcrossLevels(sim.world, WORLD_NAV, YARD, koi(12.75, 3.5))).not.toBeNull();
    expect(routeAcrossLevels(sim.world, WORLD_NAV, koi(12.75, 3.5), YARD)).not.toBeNull();
  });
});
