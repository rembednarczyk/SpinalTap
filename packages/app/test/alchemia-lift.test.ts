import { describe, expect, it } from "vitest";
import { EMPTY_INPUT, type EntityId, type InputFrame, type ViewDescriptor } from "@seki/core";
import { STORY_SOURCE } from "@seki/narrative";
import { MemorySaveStore, SavePersistence } from "@seki/persistence";
import { ALCHEMIA_LIFT, ALCHEMIA_LIFT_MECHANISM, ROOM_ID_BASE, ground } from "@seki/sim";
import { createUiStore } from "@seki/ui";
import { GameSession } from "../src/game-session";
import { FakeRender, frame, steps, teleport } from "./story-helpers";

/**
 * The lift of Alchemia (ADR-0074 stage 1), headless: Seki walks into the cage from the food hall,
 * calls it, rides up to T0 and walks out of the kiosk onto the car park; from there she calls it
 * up again and rides back down into the hall. Its moving parts are entities the renderer is told
 * about; the shaft is drawn with the hall.
 */

const start = () => {
  const views = new Map<EntityId, ViewDescriptor>();
  const render = Object.assign(new FakeRender(), { spawn: (id: EntityId, v: ViewDescriptor) => void views.set(id, v) });
  const session = new GameSession({ render, audio: { play() {}, stopAll() {} }, persistence: new SavePersistence(new MemorySaveStore()), ui: createUiStore(), story: STORY_SOURCE, seed: () => 77, now: () => new Date(2026, 10, 6) });
  session.newGame();
  steps(session, 2);
  for (const g of [...session.sim.world.with("ai")]) session.sim.world.remove(g);
  return { session, views };
};

const C = ALCHEMIA_LIFT.centre;
const [LOW, TOP] = ALCHEMIA_LIFT.levels;
const [IN_HALL, ON_T0] = ALCHEMIA_LIFT.doors;
/** Steps of a ride from one level to the other (2.5 m/s, ADR-0020), and a few for the gate. */
const RIDE = Math.ceil(((TOP - LOW) / 2.5) * 60) + 15;

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

describe("the lift of Alchemia, T0 to the food hall (ADR-0074 stage 1)", () => {
  it("takes her up from the hall's floor to the car park and back down, unhurt", () => {
    const { session } = start();
    teleport(session, IN_HALL.x, IN_HALL.z, Math.PI, 0, LOW);
    steps(session, 3);
    walkAt(session, C, 90);
    const p = session.sim.player()!;
    expect(p.position.y).toBeCloseTo(LOW, 2);
    expect(session.sim.session.focusPrompt).toBe("prompt.elevator");
    const hp = p.health!.current;
    steps(session, 1, frame({ interact: true }));
    steps(session, RIDE);
    expect(p.position.y).toBeCloseTo(TOP, 2);
    walkAt(session, ON_T0, 150);
    expect(near(p.position, ON_T0, 0.6)).toBe(true);
    expect(p.position.y).toBeCloseTo(ground(ON_T0.x, ON_T0.z).y, 1);
    // Back in: the cage waited up here; down into the hall and out.
    walkAt(session, C, 150);
    steps(session, 1, frame({ interact: true }));
    steps(session, RIDE);
    expect(p.position.y).toBeCloseTo(LOW, 2);
    walkAt(session, IN_HALL, 150);
    expect(near(p.position, IN_HALL, 0.6)).toBe(true);
    expect(p.health!.current).toBe(hp);
  });

  it("calls the cage up to the car park from the kiosk's door", () => {
    const { session } = start();
    const cage = () => session.sim.world.with("elevator", "solid").entities.find((e) => e.elevator.key === ALCHEMIA_LIFT.key)!;
    teleport(session, ON_T0.x, ON_T0.z, 0);
    steps(session, 3);
    expect(cage().solid.max.y).toBeCloseTo(LOW, 5);
    expect(session.sim.session.focusPrompt).toBe("prompt.elevator");
    steps(session, 1, frame({ interact: true }));
    steps(session, RIDE);
    expect(cage().solid.max.y).toBeCloseTo(TOP, 5);
  });

  it("streams in with the plot's chunk: its cage, gates and buttons with views of their own", () => {
    const { session, views } = start();
    teleport(session, ON_T0.x, ON_T0.z - 2, 0);
    steps(session, 3);
    const moving = session.sim.world.entities.filter((e) => e.id >= ROOM_ID_BASE && views.get(e.id)?.kind === "block" && Math.hypot(e.position.x - C.x, e.position.z - C.z) < 2.5);
    expect(moving).toHaveLength(ALCHEMIA_LIFT_MECHANISM.length);
  });
});
