// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { START_ATTRIBUTES } from "@seki/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, GameUi, type UiIntents, type UiState, createUiStore } from "../src";

/* Stage 3b of ADR-0059 on the sheet and at Mori's: the tier's path, and implants over the pool. */

const intents = (): UiIntents & Record<string, ReturnType<typeof vi.fn>> => {
  const spies: Record<string | symbol, ReturnType<typeof vi.fn>> = {};
  return new Proxy(spies, { get: (t, k) => (t[k] ??= vi.fn()) }) as UiIntents & Record<string, ReturnType<typeof vi.fn>>;
};

/** The sheet tab open on a game with `state`. */
const sheet = (state: Partial<UiState>) => {
  const store = createUiStore({ screen: "playing", ...state });
  const i = intents();
  render(<GameUi store={store} intents={i} />);
  fireEvent.keyDown(window, { code: "Tab" });
  return i;
};

afterEach(cleanup);

describe("a tier needs a perk of the tier below (stage 3b)", () => {
  it("says so while the path is missing, with no button even though Might opens the tier", () => {
    sheet({ perkPoints: 2, attributes: { ...START_ATTRIBUTES, might: 8 } });
    const wind = screen.getByTestId("perk-might_second_wind");
    expect(wind.textContent).toContain("Needs a perk from tier 4");
    expect(wind.textContent).not.toContain("Needs Might");
    expect(within(wind).queryByRole("button")).toBeNull();
    // The first tier has no path to ask for.
    expect(screen.getByTestId("perk-might_tough").textContent).not.toContain("Needs");
  });

  it("opens once a perk of the tier below is bought; a shut attribute and a missing path both show", () => {
    const i = sheet({ perkPoints: 2, attributes: { ...START_ATTRIBUTES, might: 8 }, perks: { might_thick_skull: 1 } });
    const wind = screen.getByTestId("perk-might_second_wind");
    expect(wind.textContent).not.toContain("Needs");
    fireEvent.click(within(wind).getByRole("button", { name: "Buy Second Wind" }));
    expect(i.spendPerkPoint).toHaveBeenCalledWith("might_second_wind");
    const hardened = screen.getByTestId("perk-might_hardened").textContent;
    expect(hardened).toContain("Needs Might 12");
    expect(hardened).toContain("Needs a perk from tier 8");
  });

  it("a stage 3 save's perk over an empty tier asks for the path before its next rank (stage 3c)", () => {
    sheet({ perkPoints: 3, attributes: { ...START_ATTRIBUTES, might: 12 }, perks: { might_hardened: 1 }, settings: { ...DEFAULT_SETTINGS, locale: "pl" } });
    const hardened = screen.getByTestId("perk-might_hardened");
    expect(hardened.textContent).toContain("Wymaga: perk z progu 4");
    expect(within(hardened).queryByRole("button")).toBeNull();
    cleanup();
    // Tier 4 bought, tier 8 still empty: the lowest missing tier is named.
    sheet({ perkPoints: 3, attributes: { ...START_ATTRIBUTES, might: 12 }, perks: { might_hardened: 1, might_tough: 1 } });
    expect(screen.getByTestId("perk-might_hardened").textContent).toContain("Needs a perk from tier 8");
  });

  it("speaks Polish with the Polish setting", () => {
    sheet({ attributes: { ...START_ATTRIBUTES, net: 8 }, settings: { ...DEFAULT_SETTINGS, locale: "pl" } });
    expect(screen.getByTestId("perk-net_persistence").textContent).toContain("Uporczywy kod");
    expect(screen.getByTestId("perk-net_persistence").textContent).toContain("Wymaga: perk z progu 4");
  });
});

describe("implants over the pool after a respec (stage 3b)", () => {
  it("the sheet shows the pool and what to do while it is over", () => {
    sheet({ capacity: { used: 14, max: 12 } });
    expect(screen.getByTestId("sheet-capacity").textContent).toBe("Cyberware capacity14 / 12");
    expect(screen.getByTestId("capacity-over-pool").textContent).toContain("swap it for a smaller one");
    cleanup();
    sheet({ capacity: { used: 12, max: 12 } });
    expect(screen.queryByTestId("capacity-over-pool")).toBeNull();
  });

  it("Mori's capacity bar marks the excess, in Polish too", () => {
    const store = createUiStore({ screen: "playing", shopOpen: true, shopId: "clinic", capacity: { used: 14, max: 12 }, settings: { ...DEFAULT_SETTINGS, locale: "pl" } });
    render(<GameUi store={store} intents={intents()} />);
    fireEvent.click(screen.getByTestId("shop-tab-implants"));
    const bar = screen.getByTestId("capacity");
    expect(bar.className).toContain("capacity--over");
    expect(within(bar).getByTestId("capacity-over-pool").textContent).toContain("albo zamień na mniejszy");
  });
});
