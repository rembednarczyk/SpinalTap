import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type AttributeId,
  type CyberwareLoadout,
  type DomainState,
  type ProgressionState,
  STANDARD_TERMS,
  START_ATTRIBUTES,
  progressionFromXp,
  respecPrice,
  spendAttributePoint,
  spendPerkPoint,
  xpForLevel,
} from "@seki/core";
import { patchUi } from "@seki/ui";
import { cyberCapacityOf } from "@seki/sim";
import type { GameSession } from "../src/game-session";
import { openClinic, setup, steps } from "./story-helpers";

/** Stage 3b of ADR-0059 in a session without a renderer: the tier's path, the respec over the pool, its messages and Chain's. */

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

/** A new game with `progression`, `eddies` and maybe `cyberware`, one step in. */
const game = (progression: ProgressionState, eddies = 0, cyberware?: CyberwareLoadout) => {
  const env = setup();
  env.session.newGame();
  patchDomain(env.session, (d) => ({ ...d, progression, wallet: { eddies }, ...(cyberware ? { character: { ...d.character, cyberware } } : {}) }));
  steps(env.session, 1);
  return env;
};

const lastToast = (ui: ReturnType<typeof setup>["ui"]) => ui.getState().toasts.at(-1);

describe("a tier needs a perk of the tier below, in the session", () => {
  it("Might 8 alone does not buy Second Wind; a perk of tier 4 first opens it", () => {
    const { session, ui } = game(built(10, { might: 8 }, []));
    session.intents.openCharacterScreen("sheet");
    session.intents.spendPerkPoint("might_second_wind");
    expect(ui.getState().perks).toEqual({});
    session.intents.spendPerkPoint("might_thick_skull");
    session.intents.spendPerkPoint("might_second_wind");
    expect(ui.getState()).toMatchObject({ perks: { might_thick_skull: 1, might_second_wind: 1 }, perkPoints: 7 });
  });
});

describe("the respec at Mori's (stage 3b)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  /** Level 7, Tech 8 with Tailor and Overclock at two ranks: a pool four implants only fill thanks to the points. */
  const loaded = (eddies: number) => {
    const progression = built(7, { tech: 8 }, ["tech_tailor", "tech_overclock", "tech_overclock"]);
    return game(progression, eddies, { optics: "hitomi_optics_mk1", skeleton: "kitsune_tendons", arms: "tsubame_reflex", nervous: "synapse_booster" });
  };

  it("goes through with implants over the shrunk pool: they stay, the bar and the sheet show the excess, a toast tells the points", () => {
    const { session, ui } = loaded(5000);
    const before = cyberCapacityOf(session.sim.domain);
    expect(before.used).toBeLessThanOrEqual(before.max);
    openClinic(session, ui);
    session.intents.respec();
    steps(session, 1);
    expect(session.sim.domain.progression).toMatchObject({ attributes: START_ATTRIBUTES, perks: {}, unspent: { attribute: 6, perk: 6 } });
    expect(session.sim.domain.wallet.eddies).toBe(5000 - respecPrice(7, STANDARD_TERMS));
    expect(session.sim.domain.character.cyberware).toMatchObject({ arms: "tsubame_reflex", nervous: "synapse_booster" });
    expect(lastToast(ui)).toMatchObject({ title: "Rewired", text: "Points to spend: 6 attribute, 6 perk" });
    const capacity = ui.getState().capacity!;
    expect(capacity.used).toBe(before.used);
    expect(capacity.used).toBeGreaterThan(capacity.max);
  });

  it("the respec's toast speaks Polish with the Polish setting", () => {
    const { session, ui } = loaded(5000);
    patchUi(ui, { settings: { ...ui.getState().settings, locale: "pl" } });
    openClinic(session, ui);
    session.intents.respec();
    steps(session, 1);
    expect(lastToast(ui)).toMatchObject({ title: "Przebudowa gotowa", text: "Do rozdania: atrybuty 6, perki 6" });
  });

  it("a refusal says what to do: bring the money, spend a point first (G-366)", () => {
    const poor = loaded(10);
    openClinic(poor.session, poor.ui);
    poor.session.intents.respec();
    steps(poor.session, 1);
    expect(poor.session.sim.domain.progression.perks).not.toEqual({});
    expect(lastToast(poor.ui)?.text).toBe(`Rewiring costs ${respecPrice(7, STANDARD_TERMS).toLocaleString("en")} €$. Come back with the money.`);
    expect(poor.ui.getState().toasts.some((t) => t.text === "Not enough eddies.")).toBe(false);
    const fresh = game(progressionFromXp(xpForLevel(3)), 5000);
    openClinic(fresh.session, fresh.ui);
    fresh.session.intents.respec();
    steps(fresh.session, 1);
    expect(lastToast(fresh.ui)?.text).toBe("Nothing to reset: spend an attribute or perk point first.");
    expect(fresh.session.sim.domain.wallet.eddies).toBe(5000);
  });
});

describe("Chain's second target on the scanner (stage 3b)", () => {
  it("the note says the hack jumped, in the language of the moment", () => {
    const { session, ui } = game(progressionFromXp(0));
    const [a, b] = [...session.sim.world].filter((e) => !e.player && e.health && (e.civilian || e.ai));
    session.bus.emit("QuickhackApplied", { hackId: "ping", targetId: b!.id, duration: 12 });
    session.bus.emit("QuickhackChained", { hackId: "ping", fromId: a!.id, targetId: b!.id });
    session.syncHud();
    expect(ui.getState().scanNote).toMatchObject({ tone: "ok", text: "Ping: chained to a second target" });
    patchUi(ui, { settings: { ...ui.getState().settings, locale: "pl" } });
    session.bus.emit("QuickhackChained", { hackId: "ping", fromId: a!.id, targetId: b!.id });
    expect(ui.getState().scanNote?.text).toBe("Ping: przeskok na drugi cel");
  });
});
