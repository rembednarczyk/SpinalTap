import { describe, expect, it } from "vitest";
import { type CyberwareLoadout, type DomainState, progressionFromXp, xpForLevel } from "@seki/core";
import { cyberCapacityOf, playerStatsOf } from "@seki/sim";
import type { GameSession } from "../src/game-session";
import { setup, steps } from "./story-helpers";

/*
 * The character's stats panel follows what changes the stats (ADR-0059, stage 3c): a capacity
 * shard or a level that brings an implant over the pool back, and a stat buff starting.
 */

type Holder = { holder: { domain: DomainState } };
const patchDomain = (session: GameSession, patch: (d: DomainState) => DomainState): void => {
  const holder = (session.sim as unknown as Holder).holder;
  holder.domain = patch(holder.domain);
};

/** Optics 2 + Synapse booster 5 + Kitsune tendons 6 = 13 over a fresh pool of 12: the tendons are off. */
const OVER: CyberwareLoadout = { optics: "hitomi_optics_mk1", nervous: "synapse_booster", skeleton: "kitsune_tendons" };

const game = (patch: (d: DomainState) => DomainState) => {
  const env = setup();
  env.session.newGame();
  patchDomain(env.session, (d) => patch({ ...d, character: { ...d.character, cyberware: OVER } }));
  steps(env.session, 1);
  return env;
};

describe("the stats panel and the pool (stage 3c)", () => {
  it("a capacity shard brings the tendons back, and the panel shows their speed", () => {
    const { session, ui } = game((d) => ({ ...d, inventory: { ...d.inventory, stacks: { ...d.inventory.stacks, capacity_shard: 1 } } }));
    const before = ui.getState().characterStats!.moveSpeed;
    session.intents.openCharacterScreen("inventory");
    session.intents.useItem({ stack: "capacity_shard" });
    steps(session, 1);
    expect(cyberCapacityOf(session.sim.domain)).toEqual({ used: 13, max: 14 });
    expect(playerStatsOf(session.sim.domain).moveSpeed).toBeGreaterThan(before);
    expect(ui.getState().characterStats!.moveSpeed).toBe(playerStatsOf(session.sim.domain).moveSpeed);
  });

  it("a level that grows the pool does the same", () => {
    const { session, ui } = game((d) => d);
    const before = ui.getState().characterStats!.moveSpeed;
    // Level 3 adds 2 to the pool; nothing else in the key changes.
    patchDomain(session, (d) => ({ ...d, progression: { ...progressionFromXp(xpForLevel(3)), attributes: d.progression.attributes, perks: d.progression.perks } }));
    steps(session, 1);
    expect(cyberCapacityOf(session.sim.domain).max).toBe(14);
    expect(ui.getState().characterStats!.moveSpeed).toBeGreaterThan(before);
    expect(ui.getState().characterStats!.moveSpeed).toBe(playerStatsOf(session.sim.domain).moveSpeed);
  });
});

describe("the stats panel and the buffs", () => {
  it("follows a stat buff starting and ending (the steady stim steadies the aim)", () => {
    const { session, ui } = game((d) => ({ ...d, character: { ...d.character, cyberware: { optics: "hitomi_optics_mk1" } }, inventory: { ...d.inventory, stacks: { ...d.inventory.stacks, steady_stim: 1 } } }));
    const before = ui.getState().characterStats!;
    expect(before.spread).not.toBeNull();
    session.intents.openCharacterScreen("inventory");
    session.intents.useItem({ stack: "steady_stim" });
    steps(session, 1);
    expect(session.sim.domain.buffs.map((b) => b.id)).toEqual(["steady"]);
    expect(ui.getState().characterStats!.spread!).toBeLessThan(before.spread!);
    // The buff runs out in play: the panel goes back.
    session.intents.closeCharacterScreen();
    patchDomain(session, (d) => ({ ...d, buffs: d.buffs.map((b) => ({ ...b, left: 1e-3 })) }));
    steps(session, 2);
    expect(session.sim.domain.buffs).toEqual([]);
    expect(ui.getState().characterStats!.spread).toBe(before.spread);
  });
});
