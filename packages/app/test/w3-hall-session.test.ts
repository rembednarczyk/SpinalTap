import { describe, expect, it } from "vitest";
import { MemorySaveStore } from "@seki/persistence";
import { W3_INSIDE_BLOCKS, W3_LAYOUT, W3_NAV, W3_Y } from "@seki/sim";
import { AUTOSAVE_PLACE_COOLDOWN_TICKS, AUTOSAVE_SLOT } from "../src/controllers/autosave-controller";
import { frame, setup, steps, teleport } from "./story-helpers";
import type { GameSession } from "../src/game-session";

/**
 * W-3's hall in a session (ADR-0082 stage 2), headless: Seki walks in from the west yard through
 * personnel airlock S (the interior `w3-hall`, no autosave behind the fence), down stair A from the
 * parts line into the basement (`w3-basement`) and up the stair from airlock N onto the mezzanine.
 */

class CountingStore extends MemorySaveStore {
  readonly puts: string[] = [];
  override async put(slot: string, value: string) {
    this.puts.push(slot);
    await super.put(slot, value);
  }
}

const flush = () => new Promise((r) => setTimeout(r, 0));

const at = (id: string) => W3_NAV.nodes.find((n) => n.id === id)!.at;

/** A new game with the streets' AI taken out, Seki standing on node `from`. */
const start = (from: string) => {
  const store = new CountingStore();
  const { session } = setup(store);
  session.newGame();
  steps(session, 2);
  const p = at(from);
  teleport(session, p.x, p.z, 0, 0, p.y);
  steps(session, 2);
  for (const g of [...session.sim.world.with("ai")]) session.sim.world.remove(g);
  return { session, store };
};

/** Walks the nodes in order, turning towards each, until within half a metre of it. */
const walk = (session: GameSession, ids: readonly string[]) => {
  for (const id of ids) {
    const goal = at(id);
    for (let i = 0; i < 60 * 20; i++) {
      const p = session.sim.player()!;
      const [dx, dz] = [goal.x - p.position.x, goal.z - p.position.z];
      if (Math.hypot(dx, dz) < 0.5) break;
      p.yaw = Math.atan2(dx, dz);
      session.step(frame({ moveZ: 1 }));
    }
    const p = session.sim.player()!.position;
    expect(Math.hypot(goal.x - p.x, goal.z - p.z), id).toBeLessThan(0.6);
  }
};

describe("W-3's hall in a session (ADR-0082 stage 2)", () => {
  it("walks in through airlock S into the hall, which saves nothing", async () => {
    const { session, store } = start("w3-als-out");
    // Coming to Nabrzeże saves once (a new district); past the places' cooldown, stepping into the hall does not.
    steps(session, AUTOSAVE_PLACE_COOLDOWN_TICKS + 2);
    await flush();
    const before = store.puts.filter((s) => s === AUTOSAVE_SLOT).length;
    const seen: string[] = [];
    session.bus.on("InteriorEntered", (e) => seen.push(e.interiorId));
    walk(session, ["w3-als", "w3-hall-sw", "w3-aisle-w", "w3-aisle-mid"]);
    steps(session, 2);
    await flush();
    expect(seen).toEqual(["w3-hall"]);
    expect(session.sim.session.interior).toBe("w3-hall");
    expect(store.puts.filter((s) => s === AUTOSAVE_SLOT).length).toBe(before);
  });

  it("goes down stair A from the parts line into the basement and up stair B into workshop W2", () => {
    const { session } = start("w3-cs-2527");
    walk(session, ["w3-parts-line-door", "w3-stair-a-top", "w3-cellar-a"]);
    expect(session.sim.player()!.position.y).toBeCloseTo(W3_Y + W3_LAYOUT.BASEMENT_FLOOR, 1);
    expect(session.sim.session.interior).toBe("w3-basement");
    walk(session, ["w3-cellar-w", "w3-cellar-mid", "w3-cellar-b", "w3-stair-b-top", "w3-workshop-2-s", "w3-workshop-2"]);
    expect(session.sim.player()!.position.y).toBeCloseTo(W3_Y, 1);
    expect(session.sim.session.interior).toBe("w3-hall");
  });

  it("climbs the stair from airlock N onto the mezzanine's gallery and into the shift office", () => {
    const { session } = start("w3-hall-nw");
    walk(session, ["w3-hall-n", "w3-stair-n-top", "w3-mez-w", "w3-mez-2530", "w3-mez-office"]);
    expect(session.sim.player()!.position.y).toBeCloseTo(W3_Y + W3_LAYOUT.MEZZANINE, 1);
  });

  it("enters and leaves the hall through airlock S, and the hall's blocks are solids without views (stage 2b)", () => {
    const { session } = start("w3-als-out");
    const events: string[] = [];
    session.bus.on("InteriorEntered", (e) => events.push(`in:${e.interiorId}`));
    session.bus.on("InteriorLeft", (e) => events.push(`out:${e.interiorId}`));
    walk(session, ["w3-als", "w3-hall-sw"]);
    expect(session.sim.session.interior).toBe("w3-hall");
    walk(session, ["w3-als", "w3-als-out"]);
    steps(session, 2);
    expect(events).toEqual(["in:w3-hall", "out:w3-hall"]);
    expect(session.sim.session.interior).toBeNull();
    // The renderer bakes the inside (ADR-0082 §4): the walls stop a body, but no entity draws them.
    const key = (p: { x: number; y: number; z: number }) => `${p.x.toFixed(3)},${p.y.toFixed(3)},${p.z.toFixed(3)}`;
    const unseen = new Set([...session.sim.world.with("solid", "position")].filter((e) => e.chunk === "nabrzeze-w3" && !e.view).map((e) => key(e.position)));
    expect(W3_INSIDE_BLOCKS.length).toBeGreaterThan(200);
    expect(W3_INSIDE_BLOCKS.filter((b) => !unseen.has(key(b.center)))).toEqual([]);
  });
});
