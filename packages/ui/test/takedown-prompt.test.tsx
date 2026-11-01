// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameUi, type UiIntents, type UiState, createUiStore, patchUi } from "../src";

/** The takedown's prompt (ADR-0065): the interact key, and holding the attack button to kill. */

const intents = (): UiIntents => new Proxy({}, { get: () => vi.fn() }) as UiIntents;

const mount = (state: Partial<UiState> = {}, touch = false) => {
  const store = createUiStore({ screen: "playing", ...state });
  const pad = { setStick: vi.fn(), look: vi.fn(), press: vi.fn(), release: vi.fn(), reset: vi.fn(), selectWeaponSlot: vi.fn() };
  render(<GameUi store={store} intents={intents()} touch={touch ? pad : undefined} />);
  return { store };
};

const keys = (el: HTMLElement) => [...el.querySelectorAll("kbd")].map((k) => k.textContent);

afterEach(() => cleanup());

describe("takedown prompt (ADR-0065)", () => {
  it("shows the hold action with the attack key next to the interact key", () => {
    const { store } = mount({
      controls: [
        { action: "interact", label: "Interact", codes: ["KeyF"] },
        { action: "fire", label: "Fire", codes: ["KeyJ"] },
      ],
    });
    act(() => patchUi(store, { prompt: "Take down", promptHold: "hold attack to kill" }));
    const prompt = screen.getByTestId("prompt");
    expect(prompt.textContent).toContain("Take down");
    expect(screen.getByTestId("prompt-hold").textContent).toContain("hold attack to kill");
    expect(keys(prompt)).toEqual(["F", "J"]);
  });

  it("has no hold action for a plain prompt, nor once the prompt goes", () => {
    const { store } = mount();
    act(() => patchUi(store, { prompt: "Talk to Kaito", promptHold: null }));
    expect(screen.queryByTestId("prompt-hold")).toBeNull();
    act(() => patchUi(store, { prompt: null, promptHold: "hold attack to kill" }));
    expect(screen.queryByTestId("prompt")).toBeNull();
    expect(screen.queryByTestId("prompt-hold")).toBeNull();
  });

  it("names the hold action on touch without a key and without a new button", () => {
    const { store } = mount({}, true);
    const buttons = document.querySelectorAll("button").length;
    act(() => patchUi(store, { prompt: "Take down", promptHold: "hold attack to kill" }));
    expect(screen.getByTestId("prompt-hold").textContent).toContain("hold attack to kill");
    expect(keys(screen.getByTestId("prompt"))).toEqual([]);
    // The "Use" button names the takedown; nothing else is added to the pad.
    expect(document.querySelectorAll("button").length - buttons).toBeLessThanOrEqual(1);
  });
});
