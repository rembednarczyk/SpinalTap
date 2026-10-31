import { describe, expect, it } from "vitest";
import { BREACH_XP, BREACH_XP_PER_DAEMON, type Contract, QUICKHACKS, QUICKHACK_XP, type Vec3, contractTerminalKey } from "@seki/core";
import { DOCKS_PLACE, DOKI_TERMINAL_SPOTS, GENZO_SPOT, SIM_HZ, type Simulation, docks, gangerEntity } from "../src";
import { byKey, collect, input, run, streetSim, teleportPlayer } from "./helpers";

/** XP from hacking (ADR-0059): the first quickhack on each target, and a breach that won daemons. */

const DOCKS_CHUNK = "nabrzeze-1-1";
const onDocks = (x: number, z: number): Vec3 => ({ x, y: DOCKS_PLACE.y, z });
const chest = (e: { position: Vec3 }) => ({ x: e.position.x, y: e.position.y + 1.25, z: e.position.z });

const tough = (sim: Simulation) => {
  sim.player()!.health = { current: 1e6, max: 1e6 };
};

const lookAt = (sim: Simulation, p: Vec3) => {
  const me = sim.player()!;
  const dx = p.x - me.position.x;
  const dz = p.z - me.position.z;
  me.yaw = Math.atan2(dx, dz);
  me.pitch = Math.atan2(me.position.y + 1.62 - p.y, Math.hypot(dx, dz));
};

/** Holds the scanner (and hack `slot` on the first step) until the upload lands, then lets RAM come back. */
const hack = (sim: Simulation, slot: 1 | 2, seconds: number) => {
  sim.step(input({ scan: true, quickhack: slot }));
  run(sim, Math.ceil(seconds * SIM_HZ) + 1, input({ scan: true }));
  run(sim, 20 * SIM_HZ);
};

const hackXp = (sim: Simulation) => collect<{ amount: number; source: string }>(sim, "ExperienceGained");

describe("quickhack XP (ADR-0059)", () => {
  it("the first quickhack on a target pays; hacking it again pays nothing; another target pays", () => {
    const sim = streetSim({ seed: 21 });
    teleportPlayer(sim, docks(16, 0, 97), -Math.PI / 2);
    sim.step();
    tough(sim);
    const speaker = byKey(sim, "dev:doki-speaker")!;
    const xp = hackXp(sim);
    const applied = collect(sim, "QuickhackApplied");
    // The farm of the verifier's probe: the speaker, over and over.
    const failed = collect(sim, "QuickhackFailed");
    for (let i = 0; i < 3; i++) {
      lookAt(sim, speaker.position);
      hack(sim, 2, QUICKHACKS.distract.upload);
    }
    expect(failed).toEqual([]);
    expect(applied).toHaveLength(3);
    expect(xp.filter((e) => e.source === "hack")).toEqual([{ amount: QUICKHACK_XP, source: "hack" }]);
    expect(sim.domain.progression.hacked).toEqual(["dev:doki-speaker"]);
    // Another target: a guard of Tessen put beside the yard.
    const guard = gangerEntity(90010, { key: "test-guard", position: docks(2, 0, 96), yaw: -Math.PI / 2 }, null, 110, DOCKS_CHUNK, undefined, "tessen_guard");
    sim.world.add(guard);
    sim.step();
    lookAt(sim, chest(guard));
    hack(sim, 1, QUICKHACKS.ping.upload);
    expect(applied).toHaveLength(4);
    expect(xp.filter((e) => e.source === "hack")).toHaveLength(2);
    expect(sim.domain.progression.hacked).toEqual(["dev:doki-speaker", "test-guard"]);
  });
});

describe("breach XP (ADR-0059)", () => {
  const atTerminal = (seed: number): { sim: Simulation; c: Contract } => {
    const sim = streetSim({ seed });
    teleportPlayer(sim, onDocks(GENZO_SPOT.x + 0.4, GENZO_SPOT.z - 2), 0);
    sim.step();
    tough(sim);
    sim.enqueue({ type: "accept-contract", kind: "hack" });
    sim.step();
    const c = sim.domain.contracts.active!;
    const t = DOKI_TERMINAL_SPOTS.quay_terminal!;
    teleportPlayer(sim, { x: t.x, y: t.y, z: t.z - 1.4 }, 0);
    sim.step(input({ interact: true }));
    return { sim, c };
  };

  it("a breach pays for what it won, once", () => {
    const { sim, c } = atTerminal(41);
    const xp = hackXp(sim);
    sim.enqueue({ type: "breach-result", terminalKey: contractTerminalKey(c.id), daemons: ["datamine", "icepick"] });
    sim.step();
    expect(xp.filter((e) => e.source === "hack")).toEqual([{ amount: BREACH_XP + 2 * BREACH_XP_PER_DAEMON, source: "hack" }]);
    sim.enqueue({ type: "breach-result", terminalKey: contractTerminalKey(c.id), daemons: ["datamine"] });
    sim.step();
    expect(xp.filter((e) => e.source === "hack")).toHaveLength(1);
  });

  it("a breach that won nothing pays nothing", () => {
    const { sim, c } = atTerminal(42);
    const xp = hackXp(sim);
    const breach = collect(sim, "BreachCompleted");
    sim.enqueue({ type: "breach-result", terminalKey: contractTerminalKey(c.id), daemons: [] });
    sim.step();
    expect(breach).toHaveLength(1);
    expect(xp.filter((e) => e.source === "hack")).toEqual([]);
  });
});
