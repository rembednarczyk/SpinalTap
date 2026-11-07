// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { type AttributeId, START_ATTRIBUTES, STANDARD_TERMS, createReputation, respecPrice } from "@seki/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, GameUi, type UiIntents, type UiState, createUiStore } from "../src";

/** Every intent is a spy. */
const intents = (): UiIntents & Record<string, ReturnType<typeof vi.fn>> => {
  const spies: Record<string | symbol, ReturnType<typeof vi.fn>> = {};
  return new Proxy(spies, { get: (t, k) => (t[k] ??= vi.fn()) }) as UiIntents & Record<string, ReturnType<typeof vi.fn>>;
};

/** The Progress tab (K, stage 7) open on a game with `state`, on the tree of `tree` when given. */
const sheet = (state: Partial<UiState>) => {
  const store = createUiStore({ screen: "playing", ...state });
  const i = intents();
  render(<GameUi store={store} intents={i} />);
  fireEvent.keyDown(window, { code: "KeyK" });
  return { i, section: screen.getByTestId("perks") };
};

/** Shows another attribute's tree on the Progress tab. */
const tree = (id: AttributeId) => fireEvent.click(screen.getByTestId(`attribute-tree-${id}`));

/** Mori's counter on the implants tab. */
const clinic = (state: Partial<UiState>) => {
  const store = createUiStore({ screen: "playing", shopOpen: true, shopId: "clinic", eddies: 5000, ...state });
  const i = intents();
  render(<GameUi store={store} intents={i} />);
  fireEvent.click(screen.getByTestId("shop-tab-implants"));
  return { i, section: screen.getByTestId("shop-respec") };
};

afterEach(cleanup);

describe("perks on the Progress tab (ADR-0059, stages 3 and 7)", () => {
  it("lists a tree's perks with their rank and what they need; no buttons without a point", () => {
    const { section } = sheet({ attributes: { ...START_ATTRIBUTES, might: 4 }, perks: { might_tough: 2 } });
    expect(screen.getByTestId("perk-might_tough").textContent).toContain("Thick Skin");
    expect(screen.getByTestId("perk-might_tough").textContent).toContain("Rank 2/3");
    expect(screen.getByTestId("perk-might_tough").textContent).not.toContain("Needs");
    expect(screen.queryByTestId("perk-points")).toBeNull();
    expect(within(section).queryAllByRole("button")).toHaveLength(0);
    // One tree at a time: Shadow's shows once picked.
    expect(screen.queryByTestId("perk-shadow_ghost_reload")).toBeNull();
    tree("shadow");
    expect(screen.getByTestId("perk-shadow_ghost_reload").textContent).toContain("Key perk");
    expect(screen.getByTestId("perk-shadow_ghost_reload").textContent).toContain("Needs Shadow 15");
  });

  it("with points left a button buys a rank of an open perk; none on a shut tier or at the last rank", () => {
    const { i } = sheet({ perkPoints: 2, attributes: { ...START_ATTRIBUTES, net: 8 }, perks: { net_recycler: 1 } });
    // The tab opens on the first tree where a point buys something: Net's.
    expect(screen.getByTestId("attribute-tree-net").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("perk-points").textContent).toBe("2 perk points to spend");
    fireEvent.click(screen.getByRole("button", { name: "Buy Buffer" }));
    expect(i.spendPerkPoint).toHaveBeenCalledWith("net_buffer");
    expect(within(screen.getByTestId("perk-net_recycler")).queryByRole("button")).toBeNull();
    expect(within(screen.getByTestId("perk-net_ghost_signal")).queryByRole("button")).toBeNull();
    tree("might");
    expect(within(screen.getByTestId("perk-might_tough")).queryByRole("button")).toBeNull();
  });

  it("speaks Polish with the Polish setting", () => {
    sheet({ perkPoints: 1, attributes: { ...START_ATTRIBUTES, shadow: 4 }, settings: { ...DEFAULT_SETTINGS, locale: "pl" } });
    expect(screen.getByTestId("perk-points").textContent).toBe("1 punkt perku do rozdania");
    expect(screen.getByRole("button", { name: "Kup: Ciche kroki" })).toBeTruthy();
    expect(screen.getByTestId("perk-shadow_mule").textContent).toContain("Wymaga: Cień 8");
  });
});

describe("the respec at Mori's (ADR-0059, stage 3)", () => {
  it("quotes the level's price and asks the game for it", () => {
    const { i, section } = clinic({ level: 6, attributes: { ...START_ATTRIBUTES, tech: 5 } });
    const price = respecPrice(6, STANDARD_TERMS);
    const button = within(section).getByRole("button");
    expect(button.textContent).toBe(`Respec · ${price.toLocaleString("en")} €$`);
    fireEvent.click(button);
    expect(i.respec).toHaveBeenCalled();
  });

  it("is shut with nothing spent, without the money and on Mori's basic terms", () => {
    expect(within(clinic({ level: 6 }).section).getByRole<HTMLButtonElement>("button").disabled).toBe(true);
    cleanup();
    expect(within(clinic({ level: 6, eddies: 10, perks: {}, attributes: { ...START_ATTRIBUTES, net: 4 } }).section).getByRole<HTMLButtonElement>("button").disabled).toBe(true);
    cleanup();
    const hostile = clinic({ level: 6, attributes: { ...START_ATTRIBUTES, net: 4 }, reputation: { ...createReputation(), clinic: -80 } });
    expect(within(hostile.section).getByRole<HTMLButtonElement>("button").disabled).toBe(true);
  });
});
