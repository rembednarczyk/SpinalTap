import { describe, expect, it } from "vitest";
import { type DomainState, START_ATTRIBUTES, STANDARD_TERMS, respecPrice } from "@seki/core";
import type { GameSession } from "../src/game-session";
import { openClinic, setup, steps } from "./story-helpers";

/** Buying perks on the sheet and the respec at Mori's (ADR-0059, stage 3), in a session without a renderer. */

type Holder = { holder: { domain: DomainState } };
/** Puts eddies in her wallet (the test's shortcut past a contract). */
const pay = (session: GameSession, eddies: number): void => {
  const holder = (session.sim as unknown as Holder).holder;
  holder.domain = { ...holder.domain, wallet: { eddies } };
};

describe("perks in the session", () => {
  /** A new game three levels up, with a point of Might spent: Thick Skin is open, three perk points. */
  const levelled = () => {
    const env = setup();
    env.session.newGame();
    for (const flag of ["met_fixer", "killed:hebi_courier", "reported_back"]) env.session.sim.enqueue({ type: "set-flag", flag });
    steps(env.session, 2);
    env.session.intents.openCharacterScreen("sheet");
    env.session.intents.spendAttributePoint("might");
    return env;
  };

  it("the sheet shows the perk points; a rank bought shows at once and raises the health", () => {
    const { session, ui } = levelled();
    expect(ui.getState()).toMatchObject({ level: 4, perkPoints: 3, perks: {} });
    const maxHp = ui.getState().maxHp;
    session.intents.spendPerkPoint("might_tough");
    expect(ui.getState()).toMatchObject({ perkPoints: 2, perks: { might_tough: 1 } });
    // A tier Might 4 does not open is refused.
    session.intents.spendPerkPoint("might_second_wind");
    expect(ui.getState().perks).toEqual({ might_tough: 1 });
    session.intents.closeCharacterScreen();
    steps(session, 1);
    // The point of Might (+4) and a rank of Thick Skin (+8) reach the body in the next step.
    expect(ui.getState().maxHp).toBe(maxHp + 12);
  });

  it("does nothing while the character menu is shut", () => {
    const { session, ui } = levelled();
    session.intents.closeCharacterScreen();
    session.intents.spendPerkPoint("might_tough");
    steps(session, 1);
    expect(session.sim.domain.progression.perks).toEqual({});
    expect(ui.getState().perkPoints).toBe(3);
  });

  it("the ranks bought come back with a saved game", async () => {
    const { session, store } = levelled();
    session.intents.spendPerkPoint("might_tough");
    session.intents.spendPerkPoint("might_tough");
    session.intents.closeCharacterScreen();
    expect(await session.saves.saveAsync("slot-1")).toBe(true);
    const other = setup(store);
    await other.session.saves.refreshSlots();
    expect(await other.session.saves.loadAsync("slot-1")).toBe(true);
    expect(other.session.sim.domain.progression).toMatchObject({ perks: { might_tough: 2 }, unspent: { perk: 1 } });
    steps(other.session, 1);
    expect(other.ui.getState()).toMatchObject({ perkPoints: 1, perks: { might_tough: 2 } });
  });

  it("Mori's respec gives every point back for the level's price; the sheet and the wallet show it", () => {
    const { session, ui } = levelled();
    session.intents.spendPerkPoint("might_tough");
    session.intents.closeCharacterScreen();
    steps(session, 1);
    pay(session, 2000);
    openClinic(session, ui);
    session.intents.respec();
    steps(session, 1);
    expect(session.sim.domain.progression).toMatchObject({ attributes: START_ATTRIBUTES, perks: {}, unspent: { attribute: 3, perk: 3 } });
    expect(session.sim.domain.wallet.eddies).toBe(2000 - respecPrice(4, STANDARD_TERMS));
    expect(ui.getState()).toMatchObject({ attributePoints: 3, perkPoints: 3, perks: {}, attributes: START_ATTRIBUTES });
  });

  it("the respec needs Mori's counter open, and money for it", () => {
    const { session, ui } = levelled();
    session.intents.closeCharacterScreen();
    pay(session, 2000);
    session.intents.respec();
    steps(session, 1);
    expect(session.sim.domain.progression.attributes.might).toBe(4);
    pay(session, 10);
    openClinic(session, ui);
    session.intents.respec();
    steps(session, 1);
    expect(session.sim.domain.progression.attributes.might).toBe(4);
    expect(ui.getState().toasts.some((t) => t.text === "Not enough eddies.")).toBe(true);
  });
});
