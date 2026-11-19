import { describe, expect, it } from "vitest";
import { type Contract, type Vec3, contractAlarmFlag, contractItemKey, takenFlag } from "@seki/core";
import { ALCHEMIA_CHUNK, CONTRACT_ITEM_SPOTS, HANA_SPOT, P1, P2, SHELTER, SHELTER_HATCH, Simulation, gangerEntity, ground } from "../src";
import { input, teleportPlayer } from "./helpers";

/**
 * Hebi's stash in the shelter under T2 (ADR-0074 stage 5d2): Hana's retrieval taken without the
 * alarm both ways in, crouched: down the hatch from T2 behind the crew's backs, and through the
 * gate from P-2's corridor with its code, overheard from the lookout by the hatch; and a Hebi on
 * P-1 who saw her runs her down through P-2 and the gate into the shelter.
 */

const HATCH_Z = (SHELTER_HATCH.minZ + SHELTER_HATCH.maxZ) / 2;
const CRATE = CONTRACT_ITEM_SPOTS.hebi_stash!;

const retrieval = (): { sim: Simulation; c: Contract } => {
  const sim = Simulation.create({ seed: 4 });
  teleportPlayer(sim, ground(HANA_SPOT.x - 1.5, HANA_SPOT.z), Math.PI / 2);
  sim.step();
  sim.enqueue({ type: "accept-contract", kind: "retrieve" });
  sim.step();
  return { sim, c: sim.domain.contracts.active! };
};

/** Creeps crouched to (x, z), turning to it every step, for at most `n` steps. */
const creep = (sim: Simulation, to: { x: number; z: number }, n = 900): void => {
  for (let i = 0; i < n; i++) {
    const p = sim.player()!;
    if (Math.hypot(to.x - p.position.x, to.z - p.position.z) < 0.3) return;
    const want = Math.atan2(to.x - p.position.x, to.z - p.position.z);
    sim.step(input({ crouch: true, moveZ: 1, lookYaw: Math.atan2(Math.sin(want - p.yaw), Math.cos(want - p.yaw)) }));
  }
};

const crouch = (sim: Simulation, n: number): void => {
  for (let i = 0; i < n; i++) sim.step(input({ crouch: true }));
};

/** By the crate on the shelter's floor, it taken, no alarm. */
const takeIt = (sim: Simulation, c: Contract): void => {
  creep(sim, { x: CRATE.x + 0.9, z: CRATE.z });
  expect(sim.player()!.position.y).toBeCloseTo(SHELTER.floor, 1);
  sim.step(input({ crouch: true, interact: true }));
  expect(sim.domain.flags).toContain(takenFlag(contractItemKey(c.id)));
  expect(sim.domain.contracts.active?.status).toBe("cleared");
  expect(sim.domain.flags).not.toContain(contractAlarmFlag(c.id));
};

describe("Hebi's stash in the shelter (ADR-0074 stage 5d2)", () => {
  it("is taken without the alarm down the hatch from T2, along the north wall behind the crew", () => {
    const { sim, c } = retrieval();
    teleportPlayer(sim, ground(SHELTER_HATCH.maxX + 1.5, HATCH_Z), -Math.PI / 2);
    crouch(sim, 30);
    creep(sim, { x: SHELTER.maxX - 0.8, z: HATCH_Z });
    expect(sim.player()!.position.y).toBeCloseTo(SHELTER.floor, 1);
    creep(sim, { x: 428, z: 96.1 });
    takeIt(sim, c);
  });

  it("is taken without the alarm through the gate from P-2, its code overheard from the lookout by the hatch", () => {
    const { sim, c } = retrieval();
    const look = [...sim.world].find((e) => e.key === "hebi-lookout")!;
    // Crouched behind him, near enough to hear him say it over.
    teleportPlayer(sim, ground(look.position.x + 2, look.position.z + 2), Math.atan2(-1, -1));
    crouch(sim, 120);
    expect(sim.domain.contracts.hooks).toContain("hook_retrieve_2");
    teleportPlayer(sim, { x: 417.5, y: P2.floor, z: 66 }, 0);
    crouch(sim, 10);
    for (const p of [{ x: 418.8, z: 69.8 }, { x: 421.7, z: 69.8 }, { x: 421.7, z: 77 }, { x: 421.3, z: 85 }, { x: 421.2, z: 94.5 }]) creep(sim, p);
    takeIt(sim, c);
  });

  it("keeps the gate shut to her on the job without the code", () => {
    const { sim } = retrieval();
    teleportPlayer(sim, { x: 417.5, y: P2.floor, z: 69.8 }, Math.PI / 2);
    crouch(sim, 10);
    creep(sim, { x: 421.7, z: 69.8 }, 300);
    expect(sim.player()!.position.x).toBeLessThan(P2.maxX + 2.4);
  });

  it("an alerted Hebi on P-1's apron runs her down through P-2 and the gate into the shelter", () => {
    const sim = Simulation.create({ seed: 3 });
    const room: Vec3 = { x: 428, y: SHELTER.floor, z: 94.5 };
    teleportPlayer(sim, room);
    sim.step();
    const p = sim.player()!;
    const g = gangerEntity(9003, { key: "stash-chaser", position: { x: 412, y: P1.floor, z: 27 }, yaw: 0 }, null, 200, ALCHEMIA_CHUNK, undefined, "hebi_brawler");
    g.ai!.alerted = true;
    sim.world.add(g);
    let seen: number | null = null;
    let wasInP2 = false;
    for (let i = 0; i < 60 * 40 && seen === null; i++) {
      sim.step();
      if (g.position.y < P2.floor + 0.3 && g.position.x < 420.4) wasInP2 = true;
      if (Math.hypot(g.position.x - p.position.x, g.position.z - p.position.z) < 2.5 && Math.abs(g.position.y - p.position.y) < 1) seen = i / 60;
    }
    expect(seen).not.toBeNull();
    expect(wasInP2).toBe(true);
  });
});
