// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { addStack, starterKit } from "@seki/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type CharacterStatsVm, GameUi, type UiIntents, type UiState, createUiStore, patchUi } from "../src";

/** Every intent is a spy. */
const intents = (): UiIntents & Record<string, ReturnType<typeof vi.fn>> => {
  const spies: Record<string | symbol, ReturnType<typeof vi.fn>> = {};
  return new Proxy(spies, { get: (t, k) => (t[k] ??= vi.fn()) }) as UiIntents & Record<string, ReturnType<typeof vi.fn>>;
};

const stats = (hp: number): CharacterStatsVm => ({ hp, maxHp: 100, armor: { head: 2, torso: 3, arm: 3, leg: 3 }, critChance: 0.08, critMultiplier: 1.8, spread: 1.1, moveSpeed: 4.2 });

/** Starter kit (a medkit, heals 40) plus two ramen (30 each) and scrap, which heals nothing. */
const bag = () => {
  const { inventory, equipment, ammo } = starterKit();
  let inv = addStack(inventory, equipment, "ramen", 2).inventory;
  inv = addStack(inv, equipment, "scrap", 3).inventory;
  return { inventory: inv, equipment, ammo };
};

const mount = (hp: number, state: Partial<UiState> = {}) => {
  const store = createUiStore({ screen: "playing", characterTab: "inventory", ...bag(), characterStats: stats(hp), ...state });
  const i = intents();
  render(<GameUi store={store} intents={i} />);
  return { store, i };
};

const cell = (def: string) => screen.getAllByTestId("item-cell").find((c) => c.getAttribute("data-def") === def)!;
const bar = () => screen.getByTestId("inventory-health");
const fill = () => bar().querySelector<HTMLElement>(".inv__hp-fill")!;
const gain = () => bar().querySelector<HTMLElement>(".inv__hp-gain");

afterEach(cleanup);

describe("health bar in the inventory", () => {
  it("shows HP as a HUD-style bar with current and max", () => {
    mount(62);
    expect(within(bar()).getByRole("meter", { name: "Health" }).getAttribute("aria-valuenow")).toBe("62");
    expect(bar().textContent).toContain("62 / 100");
    expect(fill().style.width).toBe("62%");
    expect(gain()).toBeNull();
  });

  it("previews what the selected food or medkit will heal, capped at max HP", () => {
    mount(50);
    fireEvent.click(cell("ramen"));
    expect(bar().textContent).toContain("+30");
    expect(gain()!.style.left).toBe("50%");
    expect(gain()!.style.width).toBe("30%");
    fireEvent.click(cell("medkit"));
    expect(bar().textContent).toContain("+40");
    // Scrap heals nothing: no preview.
    fireEvent.click(cell("scrap"));
    expect(gain()).toBeNull();
    expect(bar().textContent).not.toContain("+");
  });

  it("moves at once when eating from the bag raises HP, and the preview shrinks to what is left", () => {
    const { store, i } = mount(55);
    fireEvent.click(cell("medkit"));
    expect(bar().textContent).toContain("+40");
    fireEvent.click(cell("ramen"));
    fireEvent.click(within(screen.getByTestId("item-detail")).getByRole("button", { name: /Use/ }));
    expect(i.useItem).toHaveBeenCalledWith({ stack: "ramen" });
    // The app answers with the new HP in the same frame (menu command, then sync).
    act(() => patchUi(store, { characterStats: stats(85) }));
    expect(bar().textContent).toContain("85 / 100");
    expect(fill().style.width).toBe("85%");
    // Still on the ramen: 30 would heal, only 15 fit under max.
    expect(bar().textContent).toContain("+15");
    act(() => patchUi(store, { characterStats: stats(100) }));
    expect(gain()).toBeNull();
  });

  it("speaks Polish with the Polish setting", () => {
    const { store } = mount(40);
    act(() => patchUi(store, { settings: { ...store.getState().settings, locale: "pl" } }));
    expect(within(bar()).getByRole("meter", { name: "Zdrowie" })).toBeTruthy();
    fireEvent.click(cell("medkit"));
    expect(bar().textContent).toContain("+40 HP");
  });
});
