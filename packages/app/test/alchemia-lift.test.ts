import { describe, expect, it } from "vitest";
import { EMPTY_INPUT, type EntityId, type InputFrame, type ViewDescriptor } from "@seki/core";
import { STORY_SOURCE } from "@seki/narrative";
import { MemorySaveStore, SavePersistence } from "@seki/persistence";
import { ALCHEMIA_CHUNK, ALCHEMIA_LIFT, ALCHEMIA_LIFT_PROPS, ALCHEMIA_PROPS, ALCHEMIA_TERRACE, ROOM_ID_BASE } from "@seki/sim";
import { createUiStore } from "@seki/ui";
import { GameSession } from "../src/game-session";
import { FakeRender, frame, steps, teleport } from "./story-helpers";

/**
 * The lift of Alchemia to the hall's roof (G-284, G-289), headless: Seki walks into the cage from
 * the square behind the hall, calls it, rides up, crosses the bridge onto the roof terrace, rides
 * back down and walks out; a game saved on the terrace loads with her standing there, the cage
 * waiting below. Its moving parts are entities the renderer is told about; the shaft is scenery.
 */

const store = new MemorySaveStore();

const start = (persistence = new SavePersistence(store)) => {
  const views = new Map<EntityId, ViewDescriptor>();
  const ui = createUiStore();
  const render = Object.assign(new FakeRender(), { spawn: (id: EntityId, v: ViewDescriptor) => void views.set(id, v) });
  const session = new GameSession({ render, audio: { play() {}, stopAll() {} }, persistence, ui, story: STORY_SOURCE, seed: () => 77, now: () => new Date(2026, 10, 6) });
  session.newGame();
  steps(session, 2);
  for (const g of [...session.sim.world.with("ai")]) session.sim.world.remove(g);
  return { session, views, ui };
};

const C = ALCHEMIA_LIFT.centre;
const [GROUND, TOP] = ALCHEMIA_LIFT.levels;
const DOOR = { x: C.x, z: C.z + ALCHEMIA_LIFT.half + 1.4 };
/** Steps of a ride from one level to the other (2.5 m/s, ADR-0020), and a few for the gate. */
const RIDE = Math.ceil(((TOP - GROUND) / 2.5) * 60) + 15;
const terrace = () => {
  const c = ALCHEMIA_TERRACE.corners;
  return { x: c.reduce((s, q) => s + q.x, 0) / c.length, z: c.reduce((s, q) => s + q.z, 0) / c.length };
};
const cage = (session: GameSession) => session.sim.world.with("elevator", "solid").entities.find((e) => e.elevator.key === ALCHEMIA_LIFT.key)!;

/** Walks towards (x, z), turning to it every step, for `n` steps. */
const walkAt = (session: GameSession, to: { x: number; z: number }, n: number): void => {
  for (let i = 0; i < n; i++) {
    const p = session.sim.player()!;
    const want = Math.atan2(to.x - p.position.x, to.z - p.position.z);
    const input: InputFrame = { ...EMPTY_INPUT, moveZ: 1, lookYaw: Math.atan2(Math.sin(want - p.yaw), Math.cos(want - p.yaw)) };
    steps(session, 1, input);
  }
};

const near = (p: { x: number; z: number }, q: { x: number; z: number }, d: number) => Math.hypot(p.x - q.x, p.z - q.z) < d;

/** From the square into the cage, a press of the button and the ride up. */
const rideUp = (session: GameSession): void => {
  teleport(session, DOOR.x, DOOR.z, Math.PI);
  steps(session, 3);
  walkAt(session, C, 90);
  expect(session.sim.player()!.position.y).toBeCloseTo(GROUND, 2);
  expect(session.sim.session.focusPrompt).toBe("prompt.elevator");
  steps(session, 1, frame({ interact: true }));
  steps(session, RIDE);
};

describe("the lift of Alchemia to the hall's roof (G-284, G-289)", () => {
  it("takes her up from the square onto the roof terrace and back down, unhurt", () => {
    const { session } = start();
    rideUp(session);
    const p = session.sim.player()!;
    expect(cage(session).solid.max.y).toBeCloseTo(TOP, 5);
    expect(p.position.y).toBeCloseTo(TOP, 2);
    const hp = p.health!.current;
    steps(session, 30);
    walkAt(session, terrace(), 200);
    expect(near(p.position, terrace(), 0.5)).toBe(true);
    expect(p.position.y).toBeCloseTo(ALCHEMIA_TERRACE.roof, 1);
    // Back across the bridge into the cage, which waited up here, and down.
    walkAt(session, C, 220);
    expect(near(p.position, C, 0.5)).toBe(true);
    steps(session, 1, frame({ interact: true }));
    steps(session, RIDE);
    expect(cage(session).solid.max.y).toBeCloseTo(GROUND, 5);
    expect(p.position.y).toBeCloseTo(GROUND, 2);
    steps(session, 30);
    walkAt(session, DOOR, 120);
    expect(near(p.position, DOOR, 0.5)).toBe(true);
    expect(p.health!.current).toBe(hp);
  });

  it("calls the cage up to the roof from the bridge and sends it down from below", () => {
    const { session } = start();
    // On the bridge with the cage below: its button calls it up.
    const bridge = { x: C.x - 0.5, z: C.z - ALCHEMIA_LIFT.half - 0.9 };
    teleport(session, bridge.x, bridge.z, 0, 0, TOP);
    steps(session, 3);
    expect(cage(session).solid.max.y).toBeCloseTo(GROUND, 5);
    expect(session.sim.session.focusPrompt).toBe("prompt.elevator");
    steps(session, 1, frame({ interact: true }));
    steps(session, RIDE);
    expect(cage(session).solid.max.y).toBeCloseTo(TOP, 5);
    // From the square, its button there calls it back down.
    teleport(session, DOOR.x - 0.6, DOOR.z, Math.PI);
    steps(session, 3);
    steps(session, 1, frame({ interact: true }));
    steps(session, RIDE);
    expect(cage(session).solid.max.y).toBeCloseTo(GROUND, 5);
  });

  it("loads a game saved on the terrace with her standing on it and the cage at the bottom", async () => {
    const persistence = new SavePersistence(new MemorySaveStore());
    const { session } = start(persistence);
    rideUp(session);
    walkAt(session, terrace(), 230);
    const at = { ...session.sim.player()!.position };
    expect(at.y).toBeCloseTo(ALCHEMIA_TERRACE.roof, 1);
    expect(await session.saves.saveAsync("roof")).toBe(true);
    const other = start(persistence);
    expect(await other.session.saves.loadAsync("roof")).toBe(true);
    steps(other.session, 120);
    const p = other.session.sim.player()!;
    expect(near(p.position, at, 0.05)).toBe(true);
    expect(p.position.y).toBeCloseTo(at.y, 2);
    expect(p.fall).toBeUndefined();
    expect(cage(other.session).solid.max.y).toBeCloseTo(GROUND, 5);
  });

  it("streams in with the plot's chunk: the shaft as scenery, its cage, gates and buttons with views of their own", () => {
    const { session, views } = start();
    teleport(session, DOOR.x, DOOR.z, Math.PI);
    steps(session, 3);
    const first = ROOM_ID_BASE + session.sim.world.entities.filter((e) => e.id >= ROOM_ID_BASE && e.id < ROOM_ID_BASE + 1_000_000 && e.chunk === ALCHEMIA_CHUNK).reduce((m, e) => Math.min(m, e.id - ROOM_ID_BASE), Infinity);
    const ids = ALCHEMIA_LIFT_PROPS.map((_, i) => first + ALCHEMIA_PROPS.length + i);
    const [shaft, ...moving] = ids.map((id) => session.sim.world.entities.find((e) => e.id === id)!);
    expect(shaft!.solid && !shaft!.view && !views.has(shaft!.id)).toBe(true);
    expect(moving.map((e) => e.view?.kind)).toEqual(["block", "block", "block", "block", "block"]);
    expect(moving.every((e) => views.has(e.id))).toBe(true);
  });
});
