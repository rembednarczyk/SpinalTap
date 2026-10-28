// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameUi, type UiIntents, createUiStore, patchUi } from "../src";
import { swallowNextClick } from "../src/touch/ghost-click";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const dialogue = {
  lines: [{ speaker: "Kaito", text: "No proszę." }],
  choices: [
    { index: 0, text: "Kim jesteś?" },
    { index: 1, text: "Nic, na razie." },
  ],
  ended: false,
};

describe("the click a lifted finger leaves behind (mobile dialogue bug)", () => {
  it("eats the first click after a touch press, and only within the window", () => {
    let t = 0;
    const seen = vi.fn();
    window.addEventListener("click", seen);
    swallowNextClick(window, () => t, 700);
    document.body.click();
    expect(seen).not.toHaveBeenCalled();
    document.body.click();
    expect(seen).toHaveBeenCalledTimes(1);
    swallowNextClick(window, () => t, 700);
    t = 800;
    document.body.click();
    expect(seen).toHaveBeenCalledTimes(2);
    window.removeEventListener("click", seen);
  });

  it("a tap on E opens the talk and the click after it does not pick a choice", () => {
    vi.useFakeTimers();
    const store = createUiStore({ screen: "playing", prompt: "Kaito" });
    const choose = vi.fn();
    const intents = new Proxy({} as UiIntents, { get: (_t, k) => (k === "choose" ? choose : vi.fn()) });
    const pad = { setStick: vi.fn(), look: vi.fn(), press: vi.fn(), release: vi.fn(), reset: vi.fn(), selectWeaponSlot: vi.fn() };
    render(<GameUi store={store} intents={intents} touch={pad} />);
    fireEvent.pointerDown(screen.getByLabelText("Interakcja"), { pointerId: 1, pointerType: "touch" });
    expect(pad.press).toHaveBeenCalledWith("interact");
    // The game answers the press: the dialogue opens and the pad goes away.
    act(() => patchUi(store, { dialogue, prompt: null }));
    // The finger comes up: the browser's click lands on the choice now under the thumb.
    fireEvent.click(screen.getByRole("button", { name: /Nic, na razie/ }));
    expect(choose).not.toHaveBeenCalled();
    // A real tap a moment later works.
    act(() => vi.advanceTimersByTime(800));
    fireEvent.click(screen.getByRole("button", { name: /Nic, na razie/ }));
    expect(choose).toHaveBeenCalledWith(1);
  });
});
