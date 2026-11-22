import { describe, expect, it } from "vitest";
import { EMPTY_INPUT, type InputFrame, type Vec3 } from "@seki/core";
import { STORY_SOURCE } from "@seki/narrative";
import { MemorySaveStore, SavePersistence } from "@seki/persistence";
import { FRONT_FLOORS, FRONT_SHOP_BUILDS, GALLERY_FRONT_DOOR, L3_DOORS, MALL_LEVELS, galleryShopFrame } from "@seki/sim";
import { createUiStore } from "@seki/ui";
import { GameSession } from "../src/game-session";
import { FakeRender, steps, teleport } from "./story-helpers";

/**
 * The front's storeys joined to Alchemia's gallery (ADR-0093 O5), headless: Seki walks from the
 * gallery's P2 through its south door into L2 to a unit's counter, a room of the gallery all the way to the shop's own;
 * from the food hall on P3 into L3 and out by its south door onto L2's terrace, out of the interior.
 */

const start = () => {
  const ui = createUiStore();
  const session = new GameSession({ render: new FakeRender(), audio: { play() {}, stopAll() {} }, persistence: new SavePersistence(new MemorySaveStore()), ui, story: STORY_SOURCE, seed: () => 77, now: () => new Date(2026, 10, 6) });
  session.newGame();
  steps(session, 2);
  for (const g of [...session.sim.world.with("ai")]) session.sim.world.remove(g);
  return session;
};

/** Walks towards (x, z), turning to it every step, for at most `n` steps or until within 0.3 m of it. */
const walkAt = (session: GameSession, to: { x: number; z: number }, n: number): void => {
  for (let i = 0; i < n; i++) {
    const p = session.sim.player()!;
    if (Math.hypot(to.x - p.position.x, to.z - p.position.z) < 0.3) return;
    const want = Math.atan2(to.x - p.position.x, to.z - p.position.z);
    const input: InputFrame = { ...EMPTY_INPUT, moveZ: 1, sprint: true, lookYaw: Math.atan2(Math.sin(want - p.yaw), Math.cos(want - p.yaw)) };
    steps(session, 1, input);
  }
};
const at = (session: GameSession): Vec3 => session.sim.player()!.position;
const DOOR_X = (GALLERY_FRONT_DOOR.x0 + GALLERY_FRONT_DOOR.x1) / 2;

describe("Alchemia's front joined to its gallery (ADR-0093 O5)", () => {
  it("walks her from the gallery's P2 through its south door down L2's spine to BITBANK's counter, a room of the gallery all the way to the shop's own", () => {
    const session = start();
    teleport(session, 416.8, 38.5, Math.PI, 0, MALL_LEVELS.p2);
    steps(session, 2);
    expect(session.sim.session.interior).toBe("alchemia-gallery");
    const bank = FRONT_SHOP_BUILDS.find((b) => b.shop.id === "l2-s4")!;
    const door = bank.layout!.door;
    // Before its door on the cross arcade and a step in through it (its frame: `v` in from its front).
    const frame = galleryShopFrame(bank.shop);
    const front = (v: number) => frame.point((door.u0 + door.u1) / 2, v);
    for (const p of [{ x: DOOR_X, z: 33 }, { x: DOOR_X, z: 19.6 }, front(-1.0), front(1.2), bank.customer!]) walkAt(session, p, 400);
    expect(Math.hypot(at(session).x - bank.customer!.x, at(session).z - bank.customer!.z)).toBeLessThan(0.5);
    expect(at(session).y).toBeCloseTo(FRONT_FLOORS.l2, 1);
    // At its counter in BITBANK itself, a room of its own inside the gallery since 22.11.
    expect(session.sim.session.interior).toBe("alchemia-shop-l2-s4");
  });

  it("walks her from the food hall into L3 and out by its south door onto L2's terrace, out of the interior", () => {
    const session = start();
    teleport(session, DOOR_X, 35, Math.PI, 0, MALL_LEVELS.p3);
    steps(session, 2);
    expect(session.sim.session.interior).toBe("alchemia-foodhall");
    const sx = (L3_DOORS.south.x0 + L3_DOORS.south.x1) / 2;
    for (const p of [{ x: DOOR_X, z: 24.4 }, { x: sx, z: 24 }, { x: sx, z: 13.2 }, { x: sx, z: 8.5 }]) walkAt(session, p, 400);
    expect(at(session).z).toBeLessThan(9);
    expect(at(session).y).toBeCloseTo(FRONT_FLOORS.l3, 1);
    expect(session.sim.session.interior).toBeNull();
  });
});
