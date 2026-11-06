// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, GameUi, type UiIntents, type UiState, createUiStore, patchUi } from "../src";

/* Stage 3c of ADR-0059 on the HUD: a small mark by the health bar while cyberware is over the pool. */

const intents = (): UiIntents => new Proxy({}, { get: () => vi.fn() }) as UiIntents;

const mount = (state: Partial<UiState>) => {
  const store = createUiStore({ screen: "playing", hp: 100, maxHp: 100, ...state });
  render(<GameUi store={store} intents={intents()} />);
  return store;
};

afterEach(cleanup);

describe("the over-the-pool mark on the HUD", () => {
  it("shows only while the pool is over, names the implants that are off, and keeps the bar up", () => {
    const store = mount({ capacity: { used: 21, max: 16, inactive: ["tsubame_reflex"] } });
    const mark = screen.getByTestId("hud-over-pool");
    expect(mark.textContent).toContain("Over the pool 21 / 16");
    expect(mark.getAttribute("title")).toBe("Cyberware over the pool (21 / 16) is off: Tsubame reflex. Take an implant out at Mori's, raise Tech or use a capacity shard.");
    // Out of combat at full health the identity block steps aside, but not with implants off.
    expect(screen.getByTestId("identity").classList.contains("hud__identity--calm")).toBe(false);
    act(() => patchUi(store, { capacity: { used: 16, max: 16, inactive: [] } }));
    expect(screen.queryByTestId("hud-over-pool")).toBeNull();
    expect(screen.getByTestId("identity").classList.contains("hud__identity--calm")).toBe(true);
  });

  it("speaks Polish with the Polish setting", () => {
    mount({ capacity: { used: 14, max: 12, inactive: ["kitsune_tendons"] }, settings: { ...DEFAULT_SETTINGS, locale: "pl" } });
    const mark = screen.getByTestId("hud-over-pool");
    expect(mark.textContent).toContain("Ponad pulą 14 / 12");
    expect(mark.getAttribute("aria-label")).toContain("nie działa: Ścięgna Kitsune");
    expect(mark.getAttribute("aria-label")).toContain("podnieś Technikę");
  });

  it("is absent with no pool reported and within the pool", () => {
    mount({ capacity: null });
    expect(screen.queryByTestId("hud-over-pool")).toBeNull();
    cleanup();
    mount({ capacity: { used: 12, max: 12 } });
    expect(screen.queryByTestId("hud-over-pool")).toBeNull();
  });
});
