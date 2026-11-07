// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameUi, type UiIntents, type UiState, createUiStore, patchUi } from "../src";

/** The grab's prompt (ADR-0065, ADR-0075): the interact key knocks out, the attack button kills. */

const intents = (): UiIntents => new Proxy({}, { get: () => vi.fn() }) as UiIntents;

const mount = (state: Partial<UiState> = {}, touch = false) => {
  const store = createUiStore({ screen: "playing", ...state });
  const pad = { setStick: vi.fn(), look: vi.fn(), press: vi.fn(), release: vi.fn(), reset: vi.fn(), selectWeaponSlot: vi.fn() };
  render(<GameUi store={store} intents={intents()} touch={touch ? pad : undefined} />);
  return { store };
};

const keys = (el: HTMLElement) => [...el.querySelectorAll("kbd")].map((k) => k.textContent);

afterEach(() => cleanup());

describe("grab prompt (ADR-0075)", () => {
  it("shows the kill with the attack key next to the interact key", () => {
    const { store } = mount({
      controls: [
        { action: "interact", label: "Interact", codes: ["KeyF"] },
        { action: "fire", label: "Fire", codes: ["KeyJ"] },
      ],
    });
    act(() => patchUi(store, { prompt: "Knock out", promptHold: "Kill" }));
    const prompt = screen.getByTestId("prompt");
    expect(prompt.textContent).toContain("Knock out");
    expect(screen.getByTestId("prompt-hold").textContent).toContain("Kill");
    expect(keys(prompt)).toEqual(["F", "J"]);
  });

  it("shows the knock-out and the kill as two equal parts on a computer", () => {
    const { store } = mount();
    act(() => patchUi(store, { prompt: "Knock out", promptHold: "Kill" }));
    const main = screen.getByTestId("prompt-main");
    const kill = screen.getByTestId("prompt-hold");
    expect(main.textContent).toBe("E Knock out");
    expect(kill.textContent).toBe("LMB Kill");
    // Siblings with the same class: the kill is not nested in, nor styled quieter than, the knock-out.
    expect(kill.parentElement).toBe(main.parentElement);
    expect(kill.className).toBe(main.className);
    expect(kill.getAttribute("style")).toBeNull();
    expect(screen.getByTestId("prompt").textContent).toBe("E Knock out · LMB Kill");
  });

  it("has no second action for a plain prompt, nor once the prompt goes", () => {
    const { store } = mount();
    act(() => patchUi(store, { prompt: "Talk to Kaito", promptHold: null }));
    expect(screen.queryByTestId("prompt-hold")).toBeNull();
    act(() => patchUi(store, { prompt: null, promptHold: "Kill" }));
    expect(screen.queryByTestId("prompt")).toBeNull();
    expect(screen.queryByTestId("prompt-hold")).toBeNull();
  });

  it("names the kill on touch without a key and without a new button: the fire button says it", () => {
    const { store } = mount({}, true);
    const buttons = document.querySelectorAll("button").length;
    expect(screen.getByTestId("touch-fire").textContent).toBe("●");
    act(() => patchUi(store, { prompt: "Knock out", promptHold: "Kill" }));
    expect(screen.getByTestId("prompt-hold").textContent).toContain("Kill");
    expect(keys(screen.getByTestId("prompt"))).toEqual([]);
    expect(screen.getByTestId("touch-fire").textContent).toBe("●Kill");
    expect(screen.getByTestId("touch-fire").getAttribute("aria-label")).toBe("Attack: Kill");
    // The "Use" button names the knock-out; nothing else is added to the pad.
    expect(document.querySelectorAll("button").length - buttons).toBeLessThanOrEqual(1);
    act(() => patchUi(store, { prompt: null, promptHold: "Kill" }));
    expect(screen.getByTestId("touch-fire").textContent).toBe("●");
    expect(screen.getByTestId("touch-fire").getAttribute("aria-label")).toBe("Fire");
  });
});
