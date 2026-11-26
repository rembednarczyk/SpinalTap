import { EMPTY_INPUT, type EntityId, type InputFrame, type RenderPort } from "@seki/core";
import { describe, expect, it } from "vitest";
import { RenderSync, SCENERY_ID_BASE, Simulation, type Entity } from "../src";
import { PARKED_CARS } from "../src/content/parked-cars";
import { WORLD_SCENERY } from "../src/content/world-map";
import { parkedTakenFlag } from "../src/content/parked-taken";
import { BREAK_IN_PROMPT, BREAK_IN_WAIT } from "../src/world/vehicle/break-in";
import { SIM_DT } from "../src/step-rate";
import { sedanBeside, teleportPlayer } from "./helpers";

/**
 * Breaking into a parked car (ADR-0097 §3): beside a parked car the prompt offers it, the key has
 * her work at the door and get in, the street's solid and the scenery's view of it go, and its
 * place stays empty after a load; driving off, the car is hers.
 */
const press = (over: Partial<InputFrame>): InputFrame => ({ ...EMPTY_INPUT, ...over });

const nearestSedan = sedanBeside;

const parkedSolid = (sim: Simulation, index: number): Entity | undefined => [...sim.world].find((e) => e.parkedCar?.index === index);

const brokenInto = (): { sim: Simulation; index: number } => {
  const sim = Simulation.create({ seed: 3, crowd: "off", traffic: "off" });
  const { index, stand } = nearestSedan();
  teleportPlayer(sim, stand, 0);
  for (let i = 0; i < 120 && sim.session.focusPrompt !== BREAK_IN_PROMPT; i++) sim.step();
  expect(sim.session.focusPrompt).toBe(BREAK_IN_PROMPT);
  expect(parkedSolid(sim, index)).toBeDefined();
  sim.step(press({ interact: true }));
  return { sim, index };
};

describe("breaking into a parked car (ADR-0097 §3)", () => {
  it("offers the car beside her, works at the door, then puts her at the wheel of it; its solid is gone and the flag up", () => {
    const { sim, index } = brokenInto();
    const car = PARKED_CARS[index]!;
    expect(sim.session.driving).not.toBeNull();
    expect(sim.session.carAct?.kind).toBe("enter");
    expect(sim.domain.flags).toContain(parkedTakenFlag(index));
    expect(parkedSolid(sim, index)).toBeUndefined();
    const mine = [...sim.world].find((e) => e.id === sim.session.driving)!;
    expect(mine.view).toEqual({ kind: "vehicle", model: car.model, tint: car.tint });
    expect(Math.hypot(mine.position.x - car.x, mine.position.z - car.z)).toBeLessThan(0.3);
    // At the door for the break-in's seconds, then the clip of getting in (under 3 s more).
    let steps = 0;
    while (sim.session.carAct && steps < 600) {
      sim.step();
      steps++;
    }
    expect(steps * SIM_DT).toBeGreaterThan(BREAK_IN_WAIT);
    expect(steps * SIM_DT).toBeLessThan(BREAK_IN_WAIT + 3.5);
    // It drives: up to the next car of the kerb's bays, a metre or two ahead.
    for (let i = 0; i < 90; i++) sim.step(press({ moveZ: 1 }));
    expect(Math.hypot(mine.position.x - car.x, mine.position.z - car.z)).toBeGreaterThan(0.5);
  });

  it("takes its view out of the scenery, also from a renderer that starts after the break-in", () => {
    const { sim, index } = brokenInto();
    const scenery = WORLD_SCENERY.findIndex((s) => s.parked === index);
    expect(scenery).toBeGreaterThanOrEqual(0);
    const spawned = new Set<EntityId>();
    const port = {
      spawn: (id: EntityId) => spawned.add(id),
      despawn: (id: EntityId) => spawned.delete(id),
      updateTransform: () => {},
      setAppearance: () => {},
      attachCamera: () => {},
      clear: () => spawned.clear(),
    } as unknown as RenderPort;
    const fresh = new RenderSync(port, WORLD_SCENERY);
    fresh.sync(sim.world, 0, sim.streamer.streamedOut, sim.domain);
    expect(spawned.has(SCENERY_ID_BASE + scenery)).toBe(false);
    expect(spawned.has(SCENERY_ID_BASE + scenery + 1) || WORLD_SCENERY[scenery + 1]?.parked === undefined).toBe(true);
    // One that was drawing it before: the view goes once the flag is up.
    const before = Simulation.create({ seed: 3, crowd: "off", traffic: "off" });
    spawned.clear();
    const live = new RenderSync(port, WORLD_SCENERY);
    live.sync(before.world, 0, before.streamer.streamedOut, before.domain);
    expect(spawned.has(SCENERY_ID_BASE + scenery)).toBe(true);
    live.sync(sim.world, 0, sim.streamer.streamedOut, sim.domain);
    expect(spawned.has(SCENERY_ID_BASE + scenery)).toBe(false);
  });

  it("keeps its place empty after a load: no solid comes back with the chunk", () => {
    const { sim, index } = brokenInto();
    for (let i = 0; i < 300 && sim.session.carAct; i++) sim.step();
    const snap = JSON.parse(JSON.stringify(sim.snapshot(null, "t", ""))) as ReturnType<Simulation["snapshot"]>;
    const loaded = Simulation.fromSnapshot(snap, undefined, "off", "off");
    expect(loaded.domain.flags).toContain(parkedTakenFlag(index));
    expect(parkedSolid(loaded, index)).toBeUndefined();
    expect(loaded.session.driving).toBe(sim.session.driving);
    // Another parked car of the same chunk is still there.
    const chunk = PARKED_CARS[index]!.chunk;
    const other = PARKED_CARS.findIndex((c, i) => i !== index && c.chunk === chunk);
    if (other >= 0) expect(parkedSolid(loaded, other)).toBeDefined();
  });
});
