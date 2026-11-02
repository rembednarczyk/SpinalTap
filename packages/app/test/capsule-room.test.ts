import { describe, expect, it } from "vitest";
import { EMPTY_INPUT, type EntityId, type InputFrame, type ViewDescriptor } from "@seki/core";
import { STORY_SOURCE } from "@seki/narrative";
import { MemorySaveStore, SavePersistence } from "@seki/persistence";
import { CAPSULE_CHUNK, CAPSULE_DOOR, CAPSULE_FURNITURE, CAPSULE_INTERIOR_ROOM, ROOM_ID_BASE, Simulation, capsulePoint, interiorAt, stateHash } from "@seki/sim";
import { createUiStore, translate } from "@seki/ui";
import { AUTOSAVE_SLOT } from "../src/controllers/autosave-controller";
import { GameSession } from "../src/game-session";
import { FakeRender, steps, teleport } from "./story-helpers";

/**
 * The capsule room on Jezuicka (ADR-0063 stage 3), headless: the player walks in from the street
 * through its door (`InteriorEntered`, the autosave of ADR-0061), the furniture and the walls stop
 * her, she walks out again (`InteriorLeft`), and a game saved inside goes on the same once loaded.
 */

class CountingStore extends MemorySaveStore {
  readonly puts: string[] = [];
  override async put(slot: string, value: string) {
    this.puts.push(slot);
    await super.put(slot, value);
  }
}

/** The fake renderer, keeping the views it was asked to spawn. */
const viewRender = () => {
  const views = new Map<EntityId, ViewDescriptor>();
  const render = Object.assign(new FakeRender(), { spawn: (id: EntityId, v: ViewDescriptor) => void views.set(id, v) });
  return { render, views };
};

const flush = () => new Promise((r) => setTimeout(r, 0));

/** A new game with the street's AI taken out, so nobody walks into the way. */
const start = () => {
  const store = new CountingStore();
  const { render, views } = viewRender();
  const session = new GameSession({ render, audio: { play() {}, stopAll() {} }, persistence: new SavePersistence(store), ui: createUiStore(), story: STORY_SOURCE, seed: () => 77, now: () => new Date(2026, 10, 2) });
  session.newGame();
  steps(session, 2);
  for (const g of [...session.sim.world.with("ai")]) session.sim.world.remove(g);
  const seen: string[] = [];
  session.bus.on("InteriorEntered", (e) => seen.push(`in:${e.interiorId}`));
  session.bus.on("InteriorLeft", (e) => seen.push(`out:${e.interiorId}`));
  return { session, store, views, seen };
};

const feet = (session: GameSession) => session.sim.player()!.position;

/** Walks towards (x, z), turning to it every step, for at most `max` steps; the distance left. */
const walkTo = (session: GameSession, x: number, z: number, max = 400): number => {
  for (let i = 0; i < max; i++) {
    const p = session.sim.player()!;
    const d = Math.hypot(x - p.position.x, z - p.position.z);
    if (d < 0.3) return d;
    const want = Math.atan2(x - p.position.x, z - p.position.z);
    const input: InputFrame = { ...EMPTY_INPUT, moveZ: 1, lookYaw: Math.atan2(Math.sin(want - p.yaw), Math.cos(want - p.yaw)) };
    steps(session, 1, input);
  }
  const p = session.sim.player()!;
  return Math.hypot(x - p.position.x, z - p.position.z);
};

/** On the cobbles of Jezuicka 2 m in front of the door, facing it. */
const OUTSIDE = { x: CAPSULE_DOOR.at.x, z: CAPSULE_DOOR.at.z - 2.2 };
/** The middle of the room, between the kitchen, the bed and the chest. */
const MIDDLE = capsulePoint(-0.3, 0, 0.9);

/** From the street to the middle of the room through the door. */
const walkIn = (session: GameSession) => {
  teleport(session, OUTSIDE.x, OUTSIDE.z, 0);
  steps(session, 2);
  expect(walkTo(session, CAPSULE_DOOR.at.x, CAPSULE_DOOR.at.z + 0.6)).toBeLessThan(0.3);
  expect(walkTo(session, MIDDLE.x, MIDDLE.z)).toBeLessThan(0.3);
};

describe("the capsule room on Jezuicka (ADR-0063 stage 3)", () => {
  it("is entered from the street through its door, with an autosave, and left the same way", async () => {
    const { session, store, seen } = start();
    walkIn(session);
    await flush();
    expect(seen).toEqual(["out:clinic", "in:capsule"]);
    expect(session.sim.session.interior).toBe("capsule");
    expect(store.puts.filter((s) => s === AUTOSAVE_SLOT)).toHaveLength(1);
    expect(feet(session).y).toBeCloseTo(CAPSULE_INTERIOR_ROOM.bottom, 1);
    expect(walkTo(session, CAPSULE_DOOR.at.x, CAPSULE_DOOR.at.z + 0.6)).toBeLessThan(0.3);
    expect(walkTo(session, OUTSIDE.x, OUTSIDE.z)).toBeLessThan(0.3);
    steps(session, 2);
    expect(seen).toEqual(["out:clinic", "in:capsule", "out:capsule"]);
    expect(session.sim.session.interior).toBeNull();
  });

  it("does not let her walk through the kitchen, the bed, the chest or the walls", () => {
    const { session } = start();
    walkIn(session);
    const R = 0.2;
    // West into the kitchen run, north into the bed, east into the chest, then into the east wall behind the door.
    const kitchen = capsulePoint(-1.22, 0, 0.9);
    walkTo(session, kitchen.x - 1, kitchen.z, 120);
    expect(feet(session).x).toBeGreaterThan(kitchen.x + R);
    walkTo(session, MIDDLE.x, MIDDLE.z);
    const bed = capsulePoint(-0.3, 0, -0.23);
    walkTo(session, bed.x, bed.z + 1, 120);
    expect(feet(session).z).toBeLessThan(bed.z - R);
    expect(feet(session).y).toBeLessThan(CAPSULE_INTERIOR_ROOM.bottom + 0.3);
    walkTo(session, MIDDLE.x, MIDDLE.z);
    const chest = capsulePoint(0.8, 0, 0.2);
    walkTo(session, chest.x + 1, chest.z, 120);
    expect(feet(session).x).toBeLessThan(chest.x - R);
    const front = capsulePoint(1.4, 0, 1.6);
    walkTo(session, front.x, front.z);
    walkTo(session, front.x + 2, front.z, 120);
    expect(feet(session).x).toBeLessThan(CAPSULE_INTERIOR_ROOM.maxX - R);
    walkTo(session, front.x, front.z - 3, 120);
    expect(feet(session).z).toBeGreaterThan(CAPSULE_INTERIOR_ROOM.minZ + R);
    expect(interiorAt(feet(session))?.id).toBe("capsule");
    expect(CAPSULE_FURNITURE).toHaveLength(3);
  });

  it("streams its solids in with the Old Town's chunk, without views and with ids outside the allocator", () => {
    const { session, views } = start();
    walkIn(session);
    const solids = session.sim.world.entities.filter((e) => e.id >= ROOM_ID_BASE && e.id < ROOM_ID_BASE + 1_000_000);
    expect(solids.length).toBeGreaterThan(8);
    expect(solids.every((e) => e.chunk === CAPSULE_CHUNK && e.solid && !e.view)).toBe(true);
    expect(solids.some((e) => views.has(e.id))).toBe(false);
  });

  it("goes on the same after a save inside and a load: the same state hash for 300 steps", async () => {
    const { session } = start();
    walkIn(session);
    expect(await session.saves.saveAsync("t")).toBe(true);
    const loaded = Simulation.fromSnapshot(JSON.parse(JSON.stringify(session.sim.snapshot(null, "t", ""))));
    expect(loaded.session.interior).toBe("capsule");
    const walk = { ...EMPTY_INPUT, moveZ: 1, lookYaw: 0.01 };
    for (let i = 0; i < 300; i++) {
      const input = i % 60 < 30 ? walk : EMPTY_INPUT;
      session.sim.step(input);
      loaded.step(input);
      expect(stateHash(loaded.snapshot(null, "t", "")), `step ${i}`).toBe(stateHash(session.sim.snapshot(null, "t", "")));
    }
    expect(interiorAt(loaded.player()!.position)?.id).toBe("capsule");
  });

  it("is named in English and in Polish", () => {
    expect(translate("en", "interior.capsule")).toBe("Capsule room to let");
    expect(translate("pl", "interior.capsule")).toBe("Pokój kapsułowy na wynajem");
  });
});
