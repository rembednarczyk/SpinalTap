import { describe, expect, it } from "vitest";
import { EMPTY_INPUT, type EntityId, type InputFrame, type Vec3, type ViewDescriptor } from "@seki/core";
import { STORY_SOURCE } from "@seki/narrative";
import { MemorySaveStore, SavePersistence } from "@seki/persistence";
import { ALCHEMIA_CHUNK, ALCHEMIA_PROPS, FOODHALL, ROOM_ID_BASE, STAIR, STAIR_HEAD_X, beforeKeeper, ground, opening } from "@seki/sim";
import { createUiStore } from "@seki/ui";
import { GameSession } from "../src/game-session";
import { FakeRender, steps, teleport } from "./story-helpers";

/**
 * Alchemia's food hall under its terrace (ADR-0074 stage 1), headless: Seki walks from T1 in
 * through the way in to the counters, the glass of the front stops her, she walks up the stairs
 * by the lift to the car park and back down, and onto the green roof from the car park; entering
 * the hall is an interior of ADR-0061 (autosave); its solids stream in with the plot's chunk,
 * without views (the engine draws them).
 */

const start = () => {
  const views = new Map<EntityId, ViewDescriptor>();
  const render = Object.assign(new FakeRender(), { spawn: (id: EntityId, v: ViewDescriptor) => void views.set(id, v) });
  const ui = createUiStore();
  const session = new GameSession({ render, audio: { play() {}, stopAll() {} }, persistence: new SavePersistence(new MemorySaveStore()), ui, story: STORY_SOURCE, seed: () => 77, now: () => new Date(2026, 10, 6) });
  session.newGame();
  steps(session, 2);
  for (const g of [...session.sim.world.with("ai")]) session.sim.world.remove(g);
  return { session, views, ui };
};

/** Walks towards (x, z), turning to it every step, for at most `n` steps or until within `near` of it. */
const walkAt = (session: GameSession, to: { x: number; z: number }, n: number, near = 0.3): void => {
  for (let i = 0; i < n; i++) {
    const p = session.sim.player()!;
    if (Math.hypot(to.x - p.position.x, to.z - p.position.z) < near) return;
    const want = Math.atan2(to.x - p.position.x, to.z - p.position.z);
    const input: InputFrame = { ...EMPTY_INPUT, moveZ: 1, lookYaw: Math.atan2(Math.sin(want - p.yaw), Math.cos(want - p.yaw)) };
    steps(session, 1, input);
  }
};

const at = (session: GameSession): Vec3 => session.sim.player()!.position;
const flat = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
const ENTRANCE = (opening("entrance").x0 + opening("entrance").x1) / 2;

describe("Alchemia's food hall under its terrace (ADR-0074 stage 1)", () => {
  it("lets her in from T1 through the way in to Kenta's counter, on the hall's floor, and counts it an interior", () => {
    const { session } = start();
    teleport(session, ENTRANCE, 64, Math.PI);
    steps(session, 2);
    expect(session.sim.session.interior).toBeNull();
    for (const p of [{ x: ENTRANCE, z: 55 }, { x: 418, z: 50 }, beforeKeeper("kenta")]) walkAt(session, p, 400);
    expect(flat(at(session), beforeKeeper("kenta"))).toBeLessThan(0.5);
    expect(at(session).y).toBeCloseTo(FOODHALL.floor, 2);
    expect(session.sim.session.interior).toBe("alchemia-foodhall");
  });

  it("stops her at the front's glass beside the way in", () => {
    const { session } = start();
    teleport(session, ENTRANCE + 8, 62, Math.PI);
    steps(session, 2);
    walkAt(session, { x: ENTRANCE + 8, z: 50 }, 240);
    expect(at(session).z).toBeGreaterThan(FOODHALL.maxZ + 0.3);
    expect(at(session).y).toBeCloseTo(ground(ENTRANCE + 8, 59).y, 1);
  });

  it("takes her up the stairs by the lift to the car park and back down to the hall, unhurt", () => {
    const { session } = start();
    const foot = { x: STAIR.footX + 1, z: 33.5 };
    teleport(session, 411, 38, Math.PI, 0, FOODHALL.floor);
    steps(session, 2);
    const hp = session.sim.player()!.health!.current;
    walkAt(session, foot, 200);
    walkAt(session, { x: STAIR_HEAD_X - 1.2, z: 33.5 }, 600);
    expect(at(session).y).toBeCloseTo(FOODHALL.roof, 1);
    walkAt(session, { x: 401.8, z: 33.5 }, 200);
    walkAt(session, { x: 401.8, z: 29 }, 300);
    expect(at(session).z).toBeLessThan(FOODHALL.minZ);
    expect(at(session).y).toBeCloseTo(ground(401.8, 29).y, 1);
    // And down again into the hall.
    walkAt(session, { x: 401.8, z: 33.5 }, 300);
    walkAt(session, { x: STAIR_HEAD_X - 1.2, z: 33.5 }, 200);
    walkAt(session, foot, 600);
    walkAt(session, { x: 411.3, z: 38 }, 300);
    expect(at(session).y).toBeCloseTo(FOODHALL.floor, 1);
    expect(session.sim.player()!.health!.current).toBe(hp);
  });

  it("holds her up on the green roof, walked onto from the car park", () => {
    const { session } = start();
    teleport(session, 420, 28, 0);
    steps(session, 2);
    walkAt(session, { x: 420, z: 50 }, 600);
    expect(at(session).z).toBeGreaterThan(49);
    expect(at(session).y).toBeCloseTo(FOODHALL.roof, 1);
    // The parapet over T1 keeps her on it.
    walkAt(session, { x: 420, z: 66 }, 300);
    expect(at(session).z).toBeLessThan(FOODHALL.maxZ);
    expect(at(session).y).toBeCloseTo(FOODHALL.roof, 1);
  });

  it("streams its solids in with the plot's chunk, without views and with ids outside the allocator", () => {
    const { session, views } = start();
    teleport(session, 420, 28, 0);
    steps(session, 3);
    expect(session.sim.streamer.isLoaded(ALCHEMIA_CHUNK)).toBe(true);
    const ids = [...session.sim.world.with("solid")].filter((e) => e.id >= ROOM_ID_BASE && Math.abs(e.position.x - 418) < 30 && Math.abs(e.position.z - 45) < 30).map((e) => e.id);
    expect(ids.length).toBeGreaterThanOrEqual(ALCHEMIA_PROPS.filter((p) => !p.mechanism).length);
    for (const id of ids) {
      const v = views.get(id);
      if (v && v.kind === "block") continue; // the lift's cage and gates draw themselves
      expect(v === undefined || (v.kind === "street-props" && v.items.length === 0), String(id)).toBe(true);
    }
  });
});
