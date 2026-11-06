import { describe, expect, it } from "vitest";
import { type AttributeId, type CyberwareLoadout, type DomainState, type ProgressionState, hasPerk, progressionFromXp, spendAttributePoint, spendPerkPoint, workingCyberware, xpForLevel } from "@seki/core";
import type { GameSession } from "../src/game-session";
import { openClinic, setup, steps } from "./story-helpers";

/*
 * Stage 3c of ADR-0059 in a session without a renderer: the respec trick (Tech and Overclock,
 * every implant in, a respec, the points elsewhere) no longer keeps every implant working, and the
 * HUD marks the pool while it is over.
 */

type Holder = { holder: { domain: DomainState } };
const patchDomain = (session: GameSession, patch: (d: DomainState) => DomainState): void => {
  const holder = (session.sim as unknown as Holder).holder;
  holder.domain = patch(holder.domain);
};

/** A level-`level` character with `attributes` raised and `perks` bought by the rules. */
const built = (level: number, attributes: Partial<Record<AttributeId, number>>, perks: string[]): ProgressionState => {
  let s = progressionFromXp(xpForLevel(level));
  for (const [id, value] of Object.entries(attributes) as [AttributeId, number][]) {
    while (s.attributes[id] < value) {
      const r = spendAttributePoint(s, id);
      if (!r.ok) throw new Error(r.reason);
      s = r.state;
    }
  }
  for (const id of perks) {
    const r = spendPerkPoint(s, id);
    if (!r.ok) throw new Error(`${id}: ${r.reason}`);
    s = r.state;
  }
  return s;
};

/** Level 7, Tech 8 with Tailor and Overclock at two ranks: a pool of 21 the four implants (21) fill only thanks to the points. */
const FULL: CyberwareLoadout = { optics: "hitomi_optics_mk1", skeleton: "kitsune_tendons", arms: "tsubame_reflex", nervous: "synapse_booster" };
const loaded = () => {
  const env = setup();
  env.session.newGame();
  const progression = built(7, { tech: 8 }, ["tech_tailor", "tech_overclock", "tech_overclock"]);
  patchDomain(env.session, (d) => ({ ...d, progression, wallet: { eddies: 5000 }, character: { ...d.character, cyberware: FULL } }));
  steps(env.session, 1);
  return env;
};

describe("the respec trick (stage 3c)", () => {
  it("leaves the implants in, but the ones over the pool are off; the HUD marks it until room is freed", () => {
    const { session, ui } = loaded();
    expect(ui.getState().capacity).toEqual({ used: 21, max: 21, inactive: [] });
    expect(hasPerk(workingCyberware(session.sim.domain), "deflect")).toBe(true);
    openClinic(session, ui);
    session.intents.respec();
    steps(session, 1);
    // The points go elsewhere: Might, not Tech.
    for (let i = 0; i < 5; i++) session.intents.spendAttributePoint("might");
    steps(session, 1);
    expect(session.sim.domain.progression.attributes.tech).toBe(3);
    expect(session.sim.domain.character.cyberware).toEqual(FULL);
    // Pool 16: optics, the booster and the tendons fit (13); the Tsubame reflex (8) is off.
    expect(ui.getState().capacity).toEqual({ used: 21, max: 16, inactive: ["tsubame_reflex"] });
    const working = workingCyberware(session.sim.domain);
    expect(hasPerk(working, "deflect")).toBe(false);
    expect(hasPerk(working, "dash")).toBe(true);
    // Out with the booster at Mori's: 16 of 16, the reflex works again at once.
    session.intents.removeCyberware("nervous");
    steps(session, 1);
    expect(ui.getState().capacity).toEqual({ used: 16, max: 16, inactive: [] });
    expect(hasPerk(workingCyberware(session.sim.domain), "deflect")).toBe(true);
  });
});
