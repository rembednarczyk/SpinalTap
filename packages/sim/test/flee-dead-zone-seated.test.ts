import { describe, expect, it } from "vitest";
import type { ActivityId, ReputationState } from "@seki/core";
import { FLEE_DEAD_ZONE, FLEE_RADIUS, Simulation, type Entity } from "../src";
import { bareChunk } from "./fixtures/bare-chunk";
import { passerbyOnDeptak, run } from "./helpers";

/*
 * G-316: what the dead zone tests of ADR-0070 left unchecked. A resident with a conversation,
 * sitting or lying, keeps its heading on a street hostile to the player (the `seated` rule of
 * the civilian AI covers lying too, and `StayFacingPlayer` goes through it); a walker of a
 * crowd route that stops for the player drops its way round an obstacle, so it picks the walk
 * up from the nearest point of the route (`holdLanePlace`).
 */

const DEPTAK = bareChunk(300, -84);
const HOSTILE = { civilians: -60 };

const crowdWith = (reputation: Partial<ReputationState>, seed = 3): Simulation => {
  const snap = Simulation.create({ seed, crowd: "high", chunks: DEPTAK }).snapshot(null, "test", "");
  return Simulation.fromSnapshot({ ...snap, domain: { ...snap.domain, reputation: { ...snap.domain.reputation, ...reputation } } }, undefined, "high", "high", DEPTAK);
};
const byId = (sim: Simulation, id: number) => [...sim.world].find((e) => e.id === id)!;

/** A resident with a conversation (ADR-0070: never chased off) at `spot`, facing north, doing `activity`. */
const resident = (sim: Simulation, activity: ActivityId): Entity => {
  const p = sim.player()!.position;
  const spot = { x: p.x + 2, y: p.y, z: p.z };
  return sim.world.add({
    id: 4600,
    key: `resident-${activity}`,
    position: spot,
    prevPosition: spot,
    yaw: 0,
    prevYaw: 0,
    pitch: 0,
    body: { radius: 0.38, height: 1.8 },
    view: { kind: "npc", preset: "civilian" },
    faction: "civilians",
    velocity: { x: 0, y: 0, z: 0 },
    health: { current: 60, max: 60 },
    civilian: { home: spot },
    interactable: { kind: "dialogue", dialogueId: "ren_odagiri", prompt: "prompt.talk.ren", radius: 2.4 },
    // Its routine at this spot: the activity comes from it as from any passer-by's (`activityOf`).
    passerby: { chunk: sim.player()!.chunk ?? "", index: 99, goal: spot, yaw: 0, activity, waypoint: null, repath: 0 },
  });
};

describe("G-316: the dead zone's gaps", () => {
  it.each(["sit", "sleep"] as const)("a resident %s-ing on a hostile street keeps its heading with the player 2 m off", (activity) => {
    const sim = crowdWith(HOSTILE);
    passerbyOnDeptak(sim);
    const r = resident(sim, activity);
    run(sim, 60);
    const now = byId(sim, r.id);
    expect(now.activity).toBe(activity);
    // The player stands 2 m east; facing it would be a quarter turn.
    expect(now.yaw).toBe(0);
  });

  it("a crowd-route walker stopped past the radius drops its way round an obstacle", () => {
    const sim = crowdWith(HOSTILE);
    const walker = passerbyOnDeptak(sim, FLEE_RADIUS + FLEE_DEAD_ZONE / 2, (e) => !!e.passerby.lane);
    // On its way round something when the player turns up.
    byId(sim, walker.id).passerby!.waypoint = { ...walker.position };
    let held = false;
    for (let i = 0; i < 300 && !held; i++) {
      run(sim, 1);
      held = byId(sim, walker.id).passerby!.lane!.rejoin !== null;
    }
    expect(held).toBe(true);
    expect(byId(sim, walker.id).passerby!.waypoint).toBeNull();
  });
});
