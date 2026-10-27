import { describe, expect, it } from "vitest";
import type { CameraMode, EffectDescriptor, EntityId, RenderPort, Transform, ViewDescriptor } from "@seki/core";
import { FixedStepLoop, RenderSync, Simulation } from "../src";
import { input } from "./helpers";

class FakeRenderPort implements RenderPort {
  readonly views = new Map<EntityId, ViewDescriptor>();
  readonly transforms = new Map<EntityId, Transform>();
  camera: EntityId | null = null;
  mode: CameraMode = "FPP";
  effects: EffectDescriptor[] = [];
  spawn(id: EntityId, view: ViewDescriptor, t: Transform) { this.views.set(id, view); this.transforms.set(id, t); }
  updateTransform(id: EntityId, t: Transform) { this.transforms.set(id, t); }
  despawn(id: EntityId) { this.views.delete(id); this.transforms.delete(id); }
  clear() { this.views.clear(); this.transforms.clear(); }
  setCameraMode(mode: CameraMode) { this.mode = mode; }
  attachCamera(id: EntityId) { this.camera = id; }
  playEffect(e: EffectDescriptor) { this.effects.push(e); }
}

describe("FixedStepLoop", () => {
  it("runs a fixed number of steps for the elapsed time and reports alpha", () => {
    let now = 0;
    const alphas: number[] = [];
    let steps = 0;
    const loop = new FixedStepLoop({ now: () => now }, { update: () => steps++, render: (a) => alphas.push(a) }, 10, 5);
    loop.frame();
    now = 25;
    expect(loop.frame()).toBe(2);
    expect(alphas.at(-1)).toBeCloseTo(0.5);
    now = 1000;
    expect(loop.frame()).toBe(5);
    expect(alphas.at(-1)).toBe(0);
    loop.paused = true;
    now = 2000;
    expect(loop.frame()).toBe(0);
    expect(steps).toBe(7);
  });
});

describe("RenderSync", () => {
  it("spawns, interpolates, despawns and attaches the camera through the port", () => {
    const port = new FakeRenderPort();
    const sync = new RenderSync(port);
    const sim = Simulation.create({ seed: 3 });
    sync.sync(sim.world, 0);
    const player = sim.player()!;
    expect(port.camera).toBe(player.id);
    expect(port.views.get(player.id)).toEqual({ kind: "heroine" });
    const viewCount = port.views.size;

    sim.step(input({ moveZ: 1 }));
    sync.sync(sim.world, 0.5);
    const t = port.transforms.get(player.id)!;
    expect(t.position.z).toBeCloseTo((player.prevPosition.z + player.position.z) / 2);
    expect(t.speed).toBeGreaterThan(4);

    const guard = [...sim.world].find((e) => e.key === "guard")!;
    sim.world.remove(guard);
    sync.sync(sim.world, 0);
    expect(port.views.has(guard.id)).toBe(false);
    expect(port.views.size).toBe(viewCount - 1);

    sync.reset();
    expect(port.views.size).toBe(0);
  });
});
