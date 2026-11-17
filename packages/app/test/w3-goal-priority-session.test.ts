import { describe, expect, it } from "vitest";
import { SABOTAGE_LOUD, type Vec3, type W3StationId, contractTag } from "@seki/core";
import { GENZO_SPOT, SIM_DT, SIM_HZ, TAKEDOWN_TIME, W3_STATION_SPOTS, W3_VIRUS_TERMINAL, W3_Y, gangerEntity } from "@seki/sim";
import { frame, setup, shootDown, steps, teleport } from "./story-helpers";
import type { GameSession } from "../src/game-session";

/**
 * G-910, headless: the dead of the loud way's fight lie in the aisle by the line's stations. The
 * job's goal keeps the interact key before a bag or a takedown nearer: by a station with a charge
 * in her bag the prompt says to plant it and the key does, with no loot panel over it. A spot with
 * nothing to do (no charges yet, a charge on it already) leaves the bag its "Search". Only a station
 * or a goal under the alarm goes before a takedown or a body: by the silent way's core (3 m of
 * reach) she still grabs and picks up. A door nearer than the goal keeps the key, bags with it.
 */

type Ui = ReturnType<typeof setup>["ui"];

const PLANT = /Plant a charge|Podłóż ładunek/;
const SEARCH = /^(Search|Przeszukaj)$/;
const GRAB = /^(Grab|Chwyć)$/;
const PICK_UP = /^(Pick up|Podnieś)$/;
const DOOR = /^(Keypad door: locked|Drzwi na kod: zamknięte)$/;

const start = () => {
  const s = setup();
  s.session.newGame();
  steps(s.session, 2);
  return s;
};

const acceptSabotage = (session: GameSession, u: Ui) => {
  teleport(session, GENZO_SPOT.x + 0.3, GENZO_SPOT.z - 1.8, 0);
  steps(session, 1);
  steps(session, 1, frame({ interact: true }));
  const choice = (u.getState().dialogue?.choices ?? []).find((c) => c.text.startsWith("Co to za partia dronów"));
  if (!choice) throw new Error("no sabotage offer");
  session.intents.choose(choice.index);
  session.intents.closeDialogue();
  steps(session, 2);
  const job = session.sim.domain.contracts.active;
  if (job?.kind !== "sabotage") throw new Error("no sabotage");
  return job;
};

const alive = (session: GameSession, id: string) => [...session.sim.world].filter((e) => e.tag === contractTag(id) && (e.health?.current ?? 0) > 0);

/** The job's men out of the way, but for `spare`. */
const knockOut = (session: GameSession, id: string, spare?: string) => {
  for (const g of alive(session, id).filter((e) => e.key !== spare)) g.health = { current: 0, max: g.health!.max };
  steps(session, 1);
};

/** Armoury S: the key takes the charges (and the alarm's waves come in). */
const takeCharges = (session: GameSession) => {
  teleport(session, 2555, 402, Math.PI, 0, W3_Y);
  steps(session, 1);
  steps(session, 1, frame({ interact: true }));
  expect(session.sim.domain.contracts.active?.charges).toEqual([]);
};

/** The aisle by a station's spot: south of the north row (S3, S4), north of the south row. */
const aisle = (s: W3StationId, by: number): Vec3 => {
  const p = W3_STATION_SPOTS[s];
  return { x: p.x, y: p.y, z: p.z + (s === "S3" || s === "S4" ? -by : by) };
};

/** A man of the job killed in the aisle by the station, shot down by her or not; the bag he left. */
let nextId = 9200;
const deadBy = (session: GameSession, id: string, s: W3StationId, shot: boolean) => {
  const chunk = session.sim.player()!.chunk ?? "";
  const tag = contractTag(id);
  // A man of the alarm's wave, or one more of the job's when none is left standing.
  const guard = alive(session, id).find((e) => e.key) ?? session.sim.world.add(gangerEntity(nextId++, { key: `g910-${nextId}`, position: aisle(s, 0.9), yaw: 0 }, tag, 80, chunk, undefined, "tessen_guard"));
  knockOut(session, id, guard.key);
  guard.position = aisle(s, 0.9);
  guard.prevPosition = guard.position;
  if (shot) shootDown(session, guard.key!);
  else knockOut(session, id);
  if (shot) expect(guard.lastHitBy).toBe(session.sim.player()!.id);
  const bag = session.sim.domain.loot.containers.find((c) => c.key === `loot:${guard.key}`);
  expect(bag, "his bag").toBeDefined();
  return bag!.position;
};

/** Seki on the way from the bag to the spot, the bag the nearer, both in reach. */
const between = (session: GameSession, s: W3StationId, bag: Vec3) => {
  const spot = W3_STATION_SPOTS[s];
  const at = { x: spot.x + (bag.x - spot.x) * 0.6, z: spot.z + (bag.z - spot.z) * 0.6 };
  const dSpot = Math.hypot(spot.x - at.x, spot.z - at.z);
  expect(Math.hypot(bag.x - at.x, bag.z - at.z)).toBeLessThan(dSpot);
  expect(dSpot).toBeLessThan(1.6);
  teleport(session, at.x, at.z, 0, 0, W3_Y);
  steps(session, 2);
};

describe("the job's goal before a bag or a takedown by it (G-910)", () => {
  it("by S3 with a guard she shot down between: Plant a charge, the key plants, no loot panel", () => {
    const { session, ui: u } = start();
    const job = acceptSabotage(session, u);
    knockOut(session, job.id);
    takeCharges(session);
    between(session, "S3", deadBy(session, job.id, "S3", true));
    expect(u.getState().prompt ?? "").toMatch(PLANT);
    steps(session, 1, frame({ interact: true }));
    expect(u.getState().loot).toBeNull();
    expect(session.sim.domain.contracts.active?.planting?.station).toBe("S3");
  });

  it("by S3 with a man from behind in reach: Plant a charge, not Grab, and the key plants", () => {
    const { session, ui: u } = start();
    const job = acceptSabotage(session, u);
    knockOut(session, job.id);
    takeCharges(session);
    knockOut(session, job.id);
    const at = aisle("S3", 1);
    teleport(session, at.x, at.z, 0, 0, W3_Y);
    // His back to her, a step further down the aisle.
    const man = session.sim.world.add(gangerEntity(9100, { key: "g910-guard", position: aisle("S3", 1.5), yaw: Math.PI }, null, 80, session.sim.player()!.chunk ?? "", undefined, "tessen_guard"));
    steps(session, 1);
    expect(session.sim.world.has(man)).toBe(true);
    expect(u.getState().prompt ?? "").toMatch(PLANT);
    steps(session, 1, frame({ interact: true }));
    expect(session.sim.session.takedown).toBeNull();
    expect(session.sim.domain.contracts.active?.planting?.station).toBe("S3");
  });

  it("a spot with nothing to do leaves the bag by it its Search: no charges yet, a charge on it already", () => {
    const { session, ui: u } = start();
    const job = acceptSabotage(session, u);
    between(session, "S3", deadBy(session, job.id, "S3", false));
    expect(u.getState().prompt ?? "").toMatch(SEARCH);
    knockOut(session, job.id);
    takeCharges(session);
    knockOut(session, job.id);
    const p = aisle("S1", 0.4);
    teleport(session, p.x, p.z, Math.PI, 0, W3_Y);
    steps(session, 1);
    steps(session, 1, frame({ interact: true }));
    steps(session, Math.round(SABOTAGE_LOUD.plantSeconds * SIM_HZ) + 1);
    expect(session.sim.domain.contracts.active?.charges).toEqual(["S1"]);
    between(session, "S1", deadBy(session, job.id, "S1", false));
    expect(u.getState().prompt ?? "").toMatch(SEARCH);
  });
});

const CORE = W3_VIRUS_TERMINAL;
const CROUCH = frame({ crouch: true });
const USE = frame({ crouch: true, interact: true });

/**
 * The silent way by the core, nobody in the way: the job's men and the cameras out of the world.
 * The server room's live camera sets the loud way after a second by the core, and the core of the
 * loud way is no goal; these cases are about the silent way's, so the camera goes.
 */
const silentAtCore = () => {
  const s = start();
  const job = acceptSabotage(s.session, s.ui);
  for (const e of [...s.session.sim.world.with("ai"), ...s.session.sim.world.with("device")]) s.session.sim.world.remove(e);
  steps(s.session, 1);
  return { ...s, job };
};

/** A man added on the core's line, his back to her (yaw π: facing -z, as she does). */
const manAt = (session: GameSession, id: number, z: number) =>
  session.sim.world.add(gangerEntity(id, { key: `g910-man-${id}`, position: { x: CORE.x, y: W3_Y, z }, yaw: Math.PI }, null, 80, session.sim.player()!.chunk ?? "", undefined, "tessen_guard"));

/** A door's panel in reach, offered locked to her as the door system offers one. */
const doorAt = (session: GameSession, x: number, z: number) => {
  const at = { x, y: W3_Y, z };
  return session.sim.world.add({ id: 9400, position: at, prevPosition: at, yaw: 0, prevYaw: 0, pitch: 0, interactable: { kind: "door", dialogueId: "g910-door", prompt: "prompt.door.locked", radius: 1.4 } });
};

describe("the job's goal goes before a takedown or a body only where the fight is on (G-910)", () => {
  it("by the silent way's core a guard from behind nearer than it: Grab, and the key grabs", () => {
    const { session, ui: u } = silentAtCore();
    teleport(session, CORE.x, CORE.z - 1.5, Math.PI, 0, W3_Y);
    steps(session, 1);
    manAt(session, 9301, CORE.z - 2.5);
    steps(session, 1);
    expect(u.getState().prompt ?? "").toMatch(GRAB);
    steps(session, 1, frame({ interact: true }));
    expect(session.sim.session.takedown).not.toBeNull();
    expect(session.sim.domain.contracts.active?.progress).toBeUndefined();
  });

  it("by the silent way's core a body nearer than it: Pick up, and the key picks it up", () => {
    const { session, ui: u } = silentAtCore();
    // Knocked out out of the core's reach, then laid 0.6 m from it.
    teleport(session, CORE.x, CORE.z - 4.5, Math.PI, 0, W3_Y);
    steps(session, 30, CROUCH);
    const man = manAt(session, 9302, session.sim.player()!.position.z - 1.2);
    steps(session, 1, CROUCH);
    steps(session, 1, USE);
    steps(session, 1, USE);
    steps(session, Math.ceil(TAKEDOWN_TIME / SIM_DT) + 1, CROUCH);
    expect(man.unconscious).toBe(true);
    const body = { x: CORE.x, y: W3_Y, z: CORE.z - 0.6 };
    man.position = { ...body };
    man.prevPosition = { ...body };
    teleport(session, body.x, body.z - 0.5, 0, 0, W3_Y);
    steps(session, 2, CROUCH);
    expect(u.getState().prompt ?? "").toMatch(PICK_UP);
    steps(session, 1, USE);
    expect(session.sim.session.carrying).toBe(man.id);
    expect(session.sim.domain.contracts.active?.progress).toBeUndefined();
  });

  it("by S3 a door nearer than the spot keeps the key, and a bag nearer still its Search", () => {
    const { session, ui: u } = start();
    const job = acceptSabotage(session, u);
    knockOut(session, job.id);
    takeCharges(session);
    knockOut(session, job.id);
    const at = aisle("S3", 1);
    teleport(session, at.x, at.z, 0, 0, W3_Y);
    const door = doorAt(session, at.x + 0.5, at.z);
    steps(session, 2);
    expect(u.getState().prompt ?? "").toMatch(DOOR);
    steps(session, 1, frame({ interact: true }));
    expect(session.sim.domain.contracts.active?.planting).toBeUndefined();
    // The bag the nearest, the door between it and the spot: the bag's, as with no goal by it.
    const bag = deadBy(session, job.id, "S3", true);
    between(session, "S3", bag);
    const p = session.sim.player()!.position;
    const spot = W3_STATION_SPOTS.S3;
    const mid = (Math.hypot(bag.x - p.x, bag.z - p.z) + Math.hypot(spot.x - p.x, spot.z - p.z)) / 2;
    door.position = { x: p.x - mid, y: W3_Y, z: p.z };
    door.prevPosition = door.position;
    steps(session, 1);
    expect(u.getState().prompt ?? "").toMatch(SEARCH);
  });
});
