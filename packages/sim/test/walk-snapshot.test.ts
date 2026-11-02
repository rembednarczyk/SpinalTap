import { describe, expect, it } from "vitest";
import { World } from "miniplex";
import { MOST_AVOIDED, MOST_UNSTICK_STEPS, type EntitySnapshot, type Vec3 } from "@seki/core";
import { SIM_DT, gangerEntity } from "../src";
import { entitySnapshotOf } from "../src/world/factory";
import type { Entity, WalkProgress } from "../src/world/components";
import type { SimContext } from "../src/world/context";
import type { StreamState } from "../src/world/actor-spawner";
import { unloadChunks } from "../src/world/chunk-unload";
import { GangerWalk } from "../src/systems/ai/ganger-walk";
import type { Ganger } from "../src/systems/ai/ganger-perception";

/** A walker's stuck check (G-208) as a save and a sleep with its chunk take it. */

const AT: Vec3 = { x: 10, y: 0, z: 20 };
const guard = (walk: WalkProgress): Entity & { key: string } => ({ ...gangerEntity(7, { key: "guard", position: { ...AT }, yaw: 0 }, null, 80, "c"), key: "guard", walk });
const stuck = (plan: WalkProgress["plan"]): WalkProgress => ({ x: AT.x, z: AT.z, since: 100, unstickUntil: 160, side: -1, plan });

describe("a walker's stuck check in a save and asleep (G-208)", () => {
  it("a save keeps no more than MOST_AVOIDED characters of a repath, the nearest", () => {
    const avoid = Array.from({ length: MOST_AVOIDED + 44 }, (_, i) => ({ x: AT.x + (MOST_AVOIDED + 44 - i) * 0.01, y: 0, z: AT.z }));
    const walk = entitySnapshotOf(guard(stuck({ from: { ...AT }, goal: { x: 30, y: 0, z: 20 }, avoid }))).walk!;
    expect(walk.plan!.avoid).toHaveLength(MOST_AVOIDED);
    const farthestKept = Math.max(...walk.plan!.avoid.map((a) => a.x - AT.x));
    expect(farthestKept).toBeCloseTo(MOST_AVOIDED * 0.01);
    // One within the limit is kept as it is.
    const few = avoid.slice(0, 3);
    expect(entitySnapshotOf(guard(stuck({ from: { ...AT }, goal: AT, avoid: few }))).walk!.plan!.avoid).toEqual(few);
  });

  it("asleep with its chunk, a walker leaves no stuck check behind: it wakes on a new stretch", () => {
    const world = new World<Entity>();
    world.add(guard(stuck(null)));
    const state: StreamState = { resident: new Set(["c"]), dormant: new Map<string, EntitySnapshot>(), streamedOut: new Set() };
    unloadChunks(world, state, new Set(["c"]), () => "c");
    const asleep = state.dormant.get("guard");
    expect(asleep).toBeDefined();
    expect(asleep!.walk).toBeUndefined();
  });

  it("gets unstuck for no longer than a save holds, however slow its time", () => {
    const self = gangerEntity(7, { key: "guard", position: { ...AT }, yaw: 0 }, null, 80, "c") as Ganger;
    self.walk = { x: AT.x, z: AT.z, since: 0, unstickUntil: 0, side: 1, plan: null };
    const tick = 1_000_000;
    const ctx = { world: new World<Entity>(), tick, dt: SIM_DT } as unknown as SimContext;
    const legs = new GangerWalk({ ctx, self, timeScale: 1e-3 });
    legs.walking = true;
    legs.checkProgress();
    expect(self.walk.unstickUntil).toBeGreaterThan(tick);
    expect(self.walk.unstickUntil).toBeLessThanOrEqual(tick + MOST_UNSTICK_STEPS);
  });
});
