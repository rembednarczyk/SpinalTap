import { describe, expect, it } from "vitest";
import { EMPTY_INPUT } from "@seki/core";
import { MemorySaveStore, SavePersistence } from "@seki/persistence";
import type { GameSession } from "../src/game-session";
import { setup, steps, teleport } from "./story-helpers";

/*
 * After the prologue Hebi stand at −19 with the player (`m0-loop.test.ts`): before ADR-0091 every
 * patrol of the Rynek fought her on sight. The gang now holds its grudge per district, so with no
 * grudge on the Stare Miasto she walks through the Rynek with her gun away and nobody fights.
 */

/** Bramowa, the Rynek round the Trybunał, down to Grodzka. */
const ROUTE = [
  [457, -95.6], [472, -91.4], [487, -87.2], [497, -79], [520, -63], [561, -40], [573, -28], [577, -23],
] as const;

const walkTo = (s: GameSession, x: number, z: number): void => {
  for (let i = 0; i < 1200; i++) {
    const p = s.sim.player()!;
    if (Math.hypot(x - p.position.x, z - p.position.z) < 0.6) return;
    const want = Math.atan2(x - p.position.x, z - p.position.z);
    s.step({ ...EMPTY_INPUT, moveZ: 1, lookYaw: Math.atan2(Math.sin(want - p.yaw), Math.cos(want - p.yaw)) });
  }
};

describe("the Rynek after the prologue (ADR-0091 stage 3)", () => {
  it("lets the player walk past its patrols with her gun away while Hebi stand at −19", async () => {
    const store = new MemorySaveStore();
    const { session } = setup(store);
    session.newGame();
    const snap = session.saves.snapshot();
    const save = { ...snap, domain: { ...snap.domain, reputation: { ...snap.domain.reputation, hebi: -19 } } };
    await new SavePersistence(store).save("after-m0", save);
    await session.saves.loadAsync("after-m0");
    const provoked: string[] = [];
    session.sim.bus.on("TerritoryProvoked", (e) => provoked.push(e.cause));
    if (!session.sim.player()!.combatant!.holstered) session.step({ ...EMPTY_INPUT, toggleWeapon: true });
    teleport(session, 447, -95, Math.PI / 2);
    steps(session, 1);
    const hp = session.sim.player()!.health!.current;
    for (const [x, z] of ROUTE) walkTo(session, x, z);
    steps(session, 120);
    const patrols = [...session.sim.world.with("ai")].filter((g) => g.ai.territory === "rynek");
    expect(patrols.length).toBeGreaterThan(0);
    expect(patrols.filter((g) => g.ai.alerted).map((g) => g.key)).toEqual([]);
    expect(provoked).toEqual([]);
    expect(session.sim.player()!.health!.current).toBe(hp);
  });
});
