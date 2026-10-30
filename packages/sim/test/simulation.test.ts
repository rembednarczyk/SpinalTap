import { describe, expect, it } from "vitest";
import { M0_TARGET_TAG, QUEST_FIRST_CONTRACT, currentStep, killedFlag } from "@seki/core";
import { GANGER_MAX_HP, KRAKOWSKIE_SITE_POINTS, Simulation, koiPoint } from "../src";
import { STREET_START, alleySim, byKey, collect, input, run, teleportPlayer, streetSim } from "./helpers";

const newSim = () => streetSim({ seed: 7 });

describe("simulation: movement and camera", () => {
  it("walks forward along +Z at walk speed", () => {
    const sim = newSim();
    run(sim, 60, input({ moveZ: 1 }));
    const p = sim.player();
    expect(p?.position.z).toBeCloseTo(STREET_START.z + 4.2, 1);
    expect(p?.position.x).toBeCloseTo(STREET_START.x, 5);
  });

  it("sprints faster than it walks", () => {
    const sim = newSim();
    run(sim, 60, input({ moveZ: 1, sprint: true }));
    expect(sim.player()!.position.z - STREET_START.z).toBeGreaterThan(6.5);
  });

  it("strafes right relative to the view", () => {
    const sim = newSim();
    run(sim, 30, input({ moveX: 1 }));
    expect(sim.player()!.position.x - STREET_START.x).toBeGreaterThan(1.5);
  });

  it("stops at the district wall", () => {
    const sim = newSim();
    run(sim, 600, input({ moveZ: -1 }));
    // The houses on the south side of Plac Litewski stand ~17 m behind the start (ADR-0045):
    // the player walks up to their wall and stays there.
    const stopped = sim.player()!.position.z;
    expect(stopped).toBeLessThan(STREET_START.z - 15);
    run(sim, 120, input({ moveZ: -1 }));
    expect(sim.player()!.position.z).toBeCloseTo(stopped, 1);
  });

  it("applies and clamps look input", () => {
    const sim = newSim();
    sim.step(input({ lookYaw: 0.5, lookPitch: 5 }));
    expect(sim.player()!.yaw).toBeCloseTo(0.5);
    expect(sim.player()!.pitch).toBeCloseTo(1.25);
  });

  it("toggles the camera mode and stores it in preferences", () => {
    const sim = newSim();
    const modes = collect<{ mode: string }>(sim, "CameraModeChanged");
    sim.step(input({ toggleCamera: true }));
    expect(sim.domain.preferences.cameraMode).toBe("TPP");
    sim.step(input({ toggleCamera: true }));
    expect(modes.map((m) => m.mode)).toEqual(["TPP", "FPP"]);
  });
});

describe("simulation: interaction and narrative commands", () => {
  it("focuses the fixer in reach and starts the dialogue on interact", () => {
    const sim = newSim();
    const focus = collect<{ prompt: string | null }>(sim, "InteractionFocusChanged");
    const started = collect<{ dialogueId: string }>(sim, "InteractionStarted");
    // Kaito waits at the Neon Koi counter from the start (G-034): 1 m in front of him, facing him.
    teleportPlayer(sim, koiPoint(11.75, 0, 3.5), Math.PI);
    sim.step();
    expect(focus.at(-1)?.prompt).toBe("Rozmawiaj z Kaito");
    sim.step(input({ interact: true }));
    expect(started).toEqual([expect.objectContaining({ dialogueId: "fixer" })]);
    expect(sim.session.dialogueActive).toBe(true);

    // Movement is frozen during dialogue.
    const before = sim.player()!.position;
    run(sim, 10, input({ moveZ: 1 }));
    expect(sim.player()!.position).toEqual(before);

    sim.enqueue({ type: "set-alias", alias: "Seki Senshi" });
    sim.enqueue({ type: "set-flag", flag: "met_fixer" });
    sim.enqueue({ type: "change-reputation", faction: "fixers", delta: 5 });
    sim.enqueue({ type: "end-dialogue" });
    sim.step();
    expect(sim.session.dialogueActive).toBe(false);
    expect(sim.domain.character.alias).toBe("Seki Senshi");
    expect(sim.domain.reputation.fixers).toBe(5);
    expect(currentStep(sim.domain.quests, QUEST_FIRST_CONTRACT)?.id).toBe("eliminate_courier");
  });

  it("unlocks memories from commands only once", () => {
    const sim = newSim();
    const unlocked = collect(sim, "MemoryUnlocked");
    sim.enqueue({ type: "unlock-memory", memoryId: "street_runner" });
    sim.enqueue({ type: "unlock-memory", memoryId: "street_runner" });
    sim.step();
    expect(unlocked).toHaveLength(1);
    expect(sim.domain.character.memories).toEqual(["street_runner"]);
  });
});

describe("simulation: combat", () => {
  /** Puts the player in the alley, aiming straight at the courier. */
  const aimAtCourier = (sim: Simulation) => {
    const courier = byKey(sim, "courier")!;
    const from = { x: courier.position.x, y: courier.position.y, z: courier.position.z - 6 };
    teleportPlayer(sim, from, 0, 0.05);
    return courier;
  };

  it("damages, alerts and eventually kills the courier, completing the quest step", () => {
    const sim = newSim();
    const killed = collect<{ tag: string | null }>(sim, "EntityKilled");
    const memories = collect<{ memoryId: string }>(sim, "MemoryUnlocked");
    sim.enqueue({ type: "set-flag", flag: "met_fixer" });
    const courier = aimAtCourier(sim);
    sim.step(input({ fire: true }));
    expect(courier.ai?.alerted).toBe(true);
    for (let i = 0; i < 600 && killed.length === 0; i++) {
      teleportPlayer(sim, { x: courier.position.x, y: courier.position.y, z: courier.position.z - 6 }, 0, 0.05);
      sim.step(input({ fire: true }));
    }
    expect(killed[0]?.tag).toBe(M0_TARGET_TAG);
    expect(sim.domain.flags).toContain(killedFlag(M0_TARGET_TAG));
    expect(sim.domain.flags).toContain("dead:courier");
    expect(byKey(sim, "courier")).toBeUndefined();
    expect(memories.map((m) => m.memoryId)).toEqual(["combat_reflex"]);
    expect(currentStep(sim.domain.quests, QUEST_FIRST_CONTRACT)?.id).toBe("report_back");
  });

  it("respects the weapon cooldown while the trigger is held", () => {
    const sim = newSim();
    const shots = collect(sim, "ShotFired");
    run(sim, 30, input({ fire: true }));
    // 0.5 s at a 0.28 s cooldown: shots at t=0 and t≈0.28.
    expect(shots).toHaveLength(2);
  });

  it("gangers notice, approach and shoot a visible player", () => {
    const sim = alleySim({ seed: 7 });
    const hurt = collect<{ targetId: number }>(sim, "DamageDealt");
    // In the yard behind the car wash on Plac Łokietka, 10 m in front of the guard.
    teleportPlayer(sim, KRAKOWSKIE_SITE_POINTS.car_wash(1, 30));
    run(sim, 600);
    const playerId = sim.player()!.id;
    expect(byKey(sim, "guard")?.ai?.alerted).toBe(true);
    expect(hurt.some((h) => h.targetId === playerId)).toBe(true);
    expect(sim.player()!.health!.current).toBeLessThan(100);
  });

  it("ignores a player hidden far away", () => {
    // A new game wakes up in the clinic, 80 m up the deptak from the guard.
    const sim = Simulation.create({ seed: 7 });
    run(sim, 120);
    expect(byKey(sim, "guard")?.ai?.alerted).toBe(false);
    expect(byKey(sim, "guard")?.health?.current).toBe(GANGER_MAX_HP);
  });

  it("ends the run when the player flatlines", () => {
    const sim = newSim();
    const died = collect(sim, "PlayerDied");
    sim.player()!.health = { current: 0, max: 100 };
    sim.step();
    const at = sim.player()!.position;
    run(sim, 3, input({ moveZ: 1, fire: true }));
    expect(died).toHaveLength(1);
    expect(sim.session.gameOver).toBe(true);
    expect(sim.player()!.position).toEqual(at);
  });

  it("pays the contract on report-back, scaled by reputation", () => {
    const sim = newSim();
    const money = collect<{ delta: number }>(sim, "EddiesChanged");
    const done = collect(sim, "QuestCompleted");
    for (const flag of ["met_fixer", killedFlag(M0_TARGET_TAG), "reported_back"]) sim.enqueue({ type: "set-flag", flag });
    sim.step();
    expect(money).toEqual([{ balance: 620, delta: 500 }]);
    expect(sim.domain.reputation.fixers).toBe(10);
    expect(done).toHaveLength(1);
  });
});
