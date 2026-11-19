import { describe, expect, it } from "vitest";
import { EMPTY_INPUT, type EntityId, type InputFrame, type Vec3, type ViewDescriptor } from "@seki/core";
import { STORY_SOURCE } from "@seki/narrative";
import { MemorySaveStore, SavePersistence } from "@seki/persistence";
import { ALCHEMIA_CHUNK, ALCHEMIA_PROPS, FOODHALL, MALL_LEVELS, ROOM_ID_BASE, STAIR, STAIR_HEAD_X, beforeKeeper, ground, opening } from "@seki/sim";
import { createUiStore } from "@seki/ui";
import { GameSession } from "../src/game-session";
import { FakeRender, steps, teleport } from "./story-helpers";

/**
 * Alchemia's food hall under its terrace (ADR-0074 stage 1), headless: Seki walks from T1 in
 * through the way in onto P0 and up the escalators to the food hall's counters on P3 (ADR-0093 O3),
 * the glass of the front stops her, she walks up the stairs
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
  it("lets her in from T1 through the way in onto the gallery's P0, its shops round the fountain, and counts it an interior", () => {
    const { session } = start();
    teleport(session, ENTRANCE, 64, Math.PI);
    steps(session, 2);
    expect(session.sim.session.interior).toBeNull();
    // Past the fountain in the atrium (ADR-0093 O3) to the escalators' foot.
    for (const p of [{ x: ENTRANCE, z: 55 }, { x: 416, z: 51.6 }, { x: 426.3, z: 51.4 }, { x: 425.8, z: 40.75 }]) walkAt(session, p, 400);
    expect(flat(at(session), { x: 425.8, z: 40.75 })).toBeLessThan(0.5);
    expect(at(session).y).toBeCloseTo(FOODHALL.floor, 2);
    expect(session.sim.session.interior).toBe("alchemia-gallery");
  });

  it("takes her up the escalators from P0 to the food hall on P3 and to Kenta's counter, an interior of its own (ADR-0093 O3)", () => {
    const { session } = start();
    teleport(session, 425.8, 40.75, -Math.PI / 2, 0, FOODHALL.floor);
    steps(session, 2);
    const hp = session.sim.player()!.health!.current;
    // West up the first flight, east up the second, west up the third (`mall-plan.ts`), off the landing onto the gallery.
    for (const p of [{ x: 416.4, z: 40.75 }, { x: 416.4, z: 42.35 }, { x: 425.3, z: 42.35 }, { x: 425.3, z: 40.75 }, { x: 416.6, z: 40.75 }, { x: 416.6, z: 39.2 }, { x: 409.2, z: 39.2 }, { x: 409.2, z: 51.5 }, beforeKeeper("kenta")])
      walkAt(session, p, 600);
    expect(flat(at(session), beforeKeeper("kenta"))).toBeLessThan(0.5);
    expect(at(session).y).toBeCloseTo(MALL_LEVELS.p3, 2);
    expect(session.sim.session.interior).toBe("alchemia-foodhall");
    expect(session.sim.player()!.health!.current).toBe(hp);
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

  it("holds her up on the old green roof, the gallery's P1 since ADR-0093 O1, walked in from the car park through its doors", () => {
    const { session } = start();
    teleport(session, 420, 28, 0);
    steps(session, 2);
    // In through the main doors from T0's strip, between the south shops to the gallery and along
    // its east side (ADR-0093 O2: the shops stand between the gallery and the glass).
    walkAt(session, { x: 420, z: 35 }, 600);
    walkAt(session, { x: 420, z: 38.5 }, 300);
    walkAt(session, { x: 426.5, z: 38.5 }, 600);
    walkAt(session, { x: 426.5, z: 50 }, 600);
    expect(at(session).z).toBeGreaterThan(49);
    expect(at(session).y).toBeCloseTo(FOODHALL.roof, 1);
    // The glass over T1 keeps her in.
    walkAt(session, { x: 426.5, z: 66 }, 300);
    expect(at(session).z).toBeLessThan(FOODHALL.maxZ);
    expect(at(session).y).toBeCloseTo(FOODHALL.roof, 1);
  });

  it("streams its solids in with the plot's chunk, without views and with ids outside the allocator", () => {
    const { session, views } = start();
    teleport(session, 420, 28, 0);
    steps(session, 3);
    expect(session.sim.streamer.isLoaded(ALCHEMIA_CHUNK)).toBe(true);
    const ids = [...session.sim.world.with("solid")].filter((e) => e.id >= ROOM_ID_BASE && Math.abs(e.position.x - 418) < 30 && e.position.z > -12 && e.position.z < 75).map((e) => e.id);
    expect(ids.length).toBeGreaterThanOrEqual(ALCHEMIA_PROPS.filter((p) => !p.mechanism).length);
    for (const id of ids) {
      const v = views.get(id);
      if (v && v.kind === "block") continue; // the lift's cage and gates draw themselves
      expect(v === undefined || (v.kind === "street-props" && v.items.length === 0), String(id)).toBe(true);
    }
  });
});
