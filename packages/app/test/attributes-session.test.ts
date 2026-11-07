import { describe, expect, it } from "vitest";
import { BASE_RAM } from "@seki/core";
import { setup, steps } from "./story-helpers";

/** Spending attribute points from the sheet (ADR-0059, stage 2), in a session without a renderer. */
describe("attribute points in the session", () => {
  /** A new game three levels up: three points to spend. */
  const levelled = () => {
    const env = setup();
    env.session.newGame();
    for (const flag of ["met_fixer", "killed:hebi_courier", "reported_back"]) env.session.sim.enqueue({ type: "set-flag", flag });
    steps(env.session, 2);
    return env;
  };

  it("the sheet shows the level and the points; a point spent shows at once and raises the health", () => {
    const { session, ui } = levelled();
    expect(ui.getState()).toMatchObject({ level: 4, attributePoints: 3, attributes: { might: 3 } });
    const maxHp = ui.getState().maxHp;
    session.intents.openCharacterScreen("sheet");
    session.intents.spendAttributePoint("might");
    expect(ui.getState()).toMatchObject({ attributePoints: 2, attributes: { might: 4 } });
    session.intents.closeCharacterScreen();
    steps(session, 1);
    expect(ui.getState().maxHp).toBe(maxHp + 4);
    expect(ui.getState().characterStats?.maxHp).toBe(maxHp + 4);
  });

  it("does nothing while the character menu is shut", () => {
    const { session, ui } = levelled();
    session.intents.spendAttributePoint("tech");
    steps(session, 1);
    expect(session.sim.domain.progression.attributes.tech).toBe(3);
    expect(ui.getState().attributePoints).toBe(3);
  });

  it("two points of Net grow the RAM the HUD shows, before the RAM next changes", () => {
    const { session, ui } = levelled();
    session.intents.openCharacterScreen("sheet");
    session.intents.spendAttributePoint("net");
    expect(ui.getState().ram.max).toBe(BASE_RAM);
    session.intents.spendAttributePoint("net");
    expect(ui.getState().ram).toEqual({ current: BASE_RAM, max: BASE_RAM + 1 });
  });

  it("the points spent come back with a saved game", async () => {
    const { session, store } = levelled();
    session.intents.openCharacterScreen("sheet");
    session.intents.spendAttributePoint("shadow");
    session.intents.closeCharacterScreen();
    expect(await session.saves.saveAsync("slot-1")).toBe(true);
    const other = setup(store);
    await other.session.saves.refreshSlots();
    expect(await other.session.saves.loadAsync("slot-1")).toBe(true);
    expect(other.session.sim.domain.progression).toMatchObject({ attributes: { shadow: 4 }, unspent: { attribute: 2 } });
    steps(other.session, 1);
    expect(other.ui.getState()).toMatchObject({ attributePoints: 2, attributes: { shadow: 4 } });
  });
});
