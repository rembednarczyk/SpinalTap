import { describe, expect, it } from "vitest";
import { EMPTY_INPUT, type EntityId, type InputFrame, type ViewDescriptor } from "@seki/core";
import { STORY_SOURCE } from "@seki/narrative";
import { MemorySaveStore, SavePersistence } from "@seki/persistence";
import { ALCHEMIA_CHUNK, ALCHEMIA_MODULES, ALCHEMIA_PROPS, ALCHEMIA_ROOF, ROOM_ID_BASE } from "@seki/sim";
import { createUiStore } from "@seki/ui";
import { GameSession } from "../src/game-session";
import { FakeRender, steps, teleport } from "./story-helpers";

/**
 * Alchemia on Plac Ofiar Getta (ADR-0063 stage 4), headless: the hall and its stalls are solid.
 * Seki walking at the hall's front from the square, at a stall's window from Świętoduska's side
 * and at the stalls' backs from the open square stops at their walls, the hall's flat roof holds
 * her up (for the stages to come: a character up there, a lift); their solids stream in
 * with the plot's chunk, without views (the engine draws the models).
 */

const start = () => {
  const views = new Map<EntityId, ViewDescriptor>();
  const render = Object.assign(new FakeRender(), { spawn: (id: EntityId, v: ViewDescriptor) => void views.set(id, v) });
  const session = new GameSession({ render, audio: { play() {}, stopAll() {} }, persistence: new SavePersistence(new MemorySaveStore()), ui: createUiStore(), story: STORY_SOURCE, seed: () => 77, now: () => new Date(2026, 10, 2) });
  session.newGame();
  steps(session, 2);
  for (const g of [...session.sim.world.with("ai")]) session.sim.world.remove(g);
  return { session, views };
};

/** Walks towards (x, z), turning to it every step, for `n` steps. */
const walkAt = (session: GameSession, x: number, z: number, n: number): void => {
  for (let i = 0; i < n; i++) {
    const p = session.sim.player()!;
    const want = Math.atan2(x - p.position.x, z - p.position.z);
    const input: InputFrame = { ...EMPTY_INPUT, moveZ: 1, lookYaw: Math.atan2(Math.sin(want - p.yaw), Math.cos(want - p.yaw)) };
    steps(session, 1, input);
  }
};

const module = (key: string) => ALCHEMIA_MODULES.find((m) => m.key === key)!;

/** A point `out` metres off the module's middle along its front (negative: behind it), `side` metres to its right. */
const off = (m: (typeof ALCHEMIA_MODULES)[number], out: number, side = 0) => ({
  x: m.x + Math.sin(m.yaw) * out + Math.cos(m.yaw) * side,
  z: m.z + Math.cos(m.yaw) * out - Math.sin(m.yaw) * side,
});

/** How far in front of the module's middle (along its front) the player stands. */
const ahead = (session: GameSession, m: (typeof ALCHEMIA_MODULES)[number]): number => {
  const p = session.sim.player()!.position;
  return (p.x - m.x) * Math.sin(m.yaw) + (p.z - m.z) * Math.cos(m.yaw);
};

/** Body radius and a margin: she stops this far out of the wall or more. */
const CLEAR = 0.2;

describe("Alchemia on Plac Ofiar Getta (ADR-0063 stage 4)", () => {
  it("stops her at the hall's front, walking at it from the square by the car park", () => {
    const { session } = start();
    const hall = module("alchemia-hall");
    const from = off(hall, hall.depth / 2 + 4);
    teleport(session, from.x, from.z, hall.yaw + Math.PI);
    steps(session, 2);
    walkAt(session, hall.x, hall.z, 160);
    expect(ahead(session, hall)).toBeGreaterThan(hall.depth / 2 + CLEAR);
    expect(ahead(session, hall)).toBeLessThan(hall.depth / 2 + 1);
  });

  it("stops her at a stall's window from Świętoduska's side and at the stalls' backs from the open square", () => {
    const { session } = start();
    const stall = module("alchemia-stall-3");
    const front = off(stall, stall.depth / 2 + 1.2);
    teleport(session, front.x, front.z, stall.yaw + Math.PI);
    steps(session, 2);
    walkAt(session, stall.x, stall.z, 120);
    expect(ahead(session, stall)).toBeGreaterThan(stall.depth / 2 + CLEAR);
    const back = off(stall, -stall.depth / 2 - 4);
    teleport(session, back.x, back.z, stall.yaw);
    steps(session, 2);
    walkAt(session, stall.x, stall.z, 160);
    expect(ahead(session, stall)).toBeLessThan(-stall.depth / 2 - CLEAR);
  });

  it("holds her up on the hall's flat roof, the floor the next stages put a character on", () => {
    const { session } = start();
    const [a, , c] = ALCHEMIA_ROOF.corners;
    const mid = { x: (a!.x + c!.x) / 2, z: (a!.z + c!.z) / 2 };
    teleport(session, mid.x, mid.z, 0, 0, ALCHEMIA_ROOF.y);
    steps(session, 60);
    expect(session.sim.player()!.position.y).toBeCloseTo(ALCHEMIA_ROOF.y, 1);
  });

  it("streams its solids in with the plot's chunk, without views and with ids outside the allocator", () => {
    const { session, views } = start();
    const hall = module("alchemia-hall");
    const from = off(hall, hall.depth / 2 + 4);
    teleport(session, from.x, from.z, 0);
    steps(session, 3);
    const solids = session.sim.world.entities.filter((e) => e.id >= ROOM_ID_BASE && e.id < ROOM_ID_BASE + 1_000_000 && e.chunk === ALCHEMIA_CHUNK);
    expect(solids).toHaveLength(ALCHEMIA_PROPS.length);
    expect(solids.every((e) => e.solid && !e.view)).toBe(true);
    expect(solids.some((e) => views.has(e.id))).toBe(false);
  });
});
