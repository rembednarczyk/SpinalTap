import { describe, expect, it } from "vitest";
import { EMPTY_INPUT, type InputFrame, SAVE_SCHEMA_VERSION } from "@seki/core";
import { PLAZA_STASHES, PLAZA_WAKE, checksum } from "@seki/persistence";
import { ALCHEMIA_T1, ALCHEMIA_T2, ARKADY, CONTRACT_ITEM_SPOTS, HEBI_LOOKOUT_POST, TARG_OVERPASS_STASH, T2_STAIRS, arkadyLocal, arkadyPoint, groundY } from "@seki/sim";
import { setup, steps, teleport } from "./story-helpers";
import type { GameSession } from "../src/game-session";

/**
 * The lower square T2 before the rebuilt Arkady (ADR-0074 stage 2), headless: Seki walks from T1
 * down the wide stairs onto T2, across it to the Hebi stash before the south arches and in under
 * the arches, where the restaurants' fronts stop her; the Hebi lookout keeps his place under the
 * arches by day; a game saved in the old hollow by the ruin (v33) loads with Seki safe on T2 and
 * the blockade's bag before the arches.
 */

/** Walks towards (x, z), turning to it every step, until within `near` of it. */
const walkAt = (session: GameSession, to: { x: number; z: number }, n: number, near = 0.3): void => {
  for (let i = 0; i < n; i++) {
    const p = session.sim.player()!;
    if (Math.hypot(to.x - p.position.x, to.z - p.position.z) < near) return;
    const want = Math.atan2(to.x - p.position.x, to.z - p.position.z);
    const input: InputFrame = { ...EMPTY_INPUT, moveZ: 1, lookYaw: Math.atan2(Math.sin(want - p.yaw), Math.cos(want - p.yaw)) };
    steps(session, 1, input);
  }
};

const start = () => {
  const s = setup();
  s.session.newGame();
  steps(s.session, 2);
  return s;
};

const quiet = (session: GameSession): void => {
  for (const g of [...session.sim.world.with("ai")]) session.sim.world.remove(g);
};

describe("T2 before the Arkady (ADR-0074 stage 2)", () => {
  it("takes her from T1 down the stairs onto T2, unhurt, to the Hebi stash before the south arches", () => {
    const { session } = start();
    teleport(session, T2_STAIRS.a.x, T2_STAIRS.a.z - 4, 0);
    steps(session, 3);
    quiet(session);
    const p = session.sim.player()!;
    expect(p.position.y).toBeCloseTo(ALCHEMIA_T1, 1);
    const hp = p.health!.current;
    walkAt(session, { x: T2_STAIRS.b.x, z: T2_STAIRS.b.z + 3 }, 600);
    expect(p.position.z).toBeGreaterThan(T2_STAIRS.b.z + 2);
    expect(p.position.y).toBeCloseTo(ALCHEMIA_T2, 1);
    // Beside the stash's crate, between it and the big crate for a body.
    const crate = CONTRACT_ITEM_SPOTS.hebi_stash!;
    const by = arkadyPoint(11.2, -2.2);
    walkAt(session, by, 600);
    expect(Math.hypot(p.position.x - by.x, p.position.z - by.z)).toBeLessThan(0.5);
    expect(Math.hypot(p.position.x - crate.x, p.position.z - crate.z)).toBeLessThan(3);
    expect(p.position.y).toBeCloseTo(ALCHEMIA_T2, 1);
    expect(groundY(crate.x, crate.z)).toBeCloseTo(ALCHEMIA_T2, 2);
    expect(p.health!.current).toBe(hp);
  });

  it("lets her in under the arches on their level floor, and the restaurants' fronts stop her", () => {
    const { session } = start();
    const before = arkadyPoint(18.6, -4);
    teleport(session, before.x, before.z, 0);
    steps(session, 3);
    quiet(session);
    const p = session.sim.player()!;
    // In through the arch of the fifth span, on to the restaurants' glass behind.
    const deep = arkadyPoint(18.6, 4);
    walkAt(session, deep, 300);
    const inside = arkadyLocal(p.position.x, p.position.z);
    expect(inside.c).toBeGreaterThan(0.8);
    expect(inside.c).toBeLessThan(ARKADY.arcade);
    expect(p.position.y).toBeCloseTo(ARKADY.ground, 1);
    // Along the arcade under the arches to its north end.
    const along = arkadyPoint(40, 1.4);
    walkAt(session, along, 600);
    expect(Math.hypot(p.position.x - along.x, p.position.z - along.z)).toBeLessThan(0.5);
    expect(p.position.y).toBeCloseTo(ARKADY.ground, 1);
  });

  it("keeps the Hebi lookout under the arches by day, on T2", () => {
    const { session } = start();
    session.sim.enqueue({ type: "wait", minutes: 15 * 60 }); // 12:00
    teleport(session, HEBI_LOOKOUT_POST.x - 10, HEBI_LOOKOUT_POST.z - 6, 0);
    steps(session, 120);
    const lookout = [...session.sim.world].find((e) => e.key === "hebi-lookout")!;
    expect(Math.hypot(lookout.position.x - HEBI_LOOKOUT_POST.x, lookout.position.z - HEBI_LOOKOUT_POST.z)).toBeLessThan(0.5);
    expect(lookout.position.y).toBeCloseTo(ARKADY.ground, 1);
    const at = arkadyLocal(lookout.position.x, lookout.position.z);
    expect(at.c).toBeGreaterThan(0);
    expect(at.c).toBeLessThan(ARKADY.arcade);
  });

  it("loads a game saved in the old hollow by the ruin (v33) with Seki on T2 and the blockade's bag before the arches", async () => {
    const { session, store } = setup();
    session.newGame();
    steps(session, 2);
    const now = session.sim.snapshot(null, "old", "");
    const entities = [...now.entities.filter((e) => e.key !== "player" && e.key !== "hebi-lookout"), { ...now.entities.find((e) => e.key === "player")!, position: { x: 442, y: -9.17, z: 93 } }];
    const containers = [{ key: TARG_OVERPASS_STASH.key, position: { x: 452.8, y: -8.9, z: 111.8 }, chunk: "krakowskie-2-1", expiresAtTick: Number.MAX_SAFE_INTEGER, lines: TARG_OVERPASS_STASH.lines }];
    const text = JSON.stringify({ ...now, version: 33, entities, domain: { ...now.domain, loot: { ...now.domain.loot, containers } }, streaming: { loadedChunks: ["krakowskie-2-1"] } });
    await store.put("old", JSON.stringify({ format: "seki-save", checksum: checksum(text), payload: text }));
    expect(await session.saves.loadAsync("old")).toBe(true);
    expect(SAVE_SCHEMA_VERSION).toBeGreaterThanOrEqual(34);
    const p = session.sim.player()!;
    expect({ x: p.position.x, z: p.position.z }).toEqual({ x: PLAZA_WAKE.x, z: PLAZA_WAKE.z });
    const hp = p.health!.current;
    steps(session, 30);
    expect(p.position.y).toBeCloseTo(ALCHEMIA_T2, 1);
    expect(p.health!.current).toBe(hp);
    const bag = session.sim.domain.loot.containers.find((c) => c.key === TARG_OVERPASS_STASH.key)!;
    expect(bag.position).toEqual(TARG_OVERPASS_STASH.at);
    // The migration's spot is the content's, to a centimetre, and on T2.
    const by = PLAZA_STASHES[TARG_OVERPASS_STASH.key]!;
    expect(Math.hypot(by.x - TARG_OVERPASS_STASH.at.x, by.y - TARG_OVERPASS_STASH.at.y, by.z - TARG_OVERPASS_STASH.at.z)).toBeLessThan(0.01);
    expect(groundY(by.x, by.z)).toBeCloseTo(ALCHEMIA_T2, 2);
  });
});
