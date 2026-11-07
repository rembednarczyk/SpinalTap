// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { textRef } from "@seki/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, GameUi, type UiIntents, createUiStore, patchUi, pushToast } from "../src";

/**
 * A toast keeps its key and parameters, not the sentence (G-466, ADR-0056): the district card
 * shown on arrival in English reads Polish the moment the player switches the language.
 */

const intents = (): UiIntents => new Proxy({}, { get: () => vi.fn() }) as UiIntents;

afterEach(cleanup);

describe("toast language", () => {
  it("follows a language switch while the toast is up", () => {
    const store = createUiStore({ screen: "playing", settings: { ...DEFAULT_SETTINGS, locale: "en" } });
    pushToast(store, { kind: "system", title: textRef("newGame.place"), text: textRef("newGame.intro") });
    render(<GameUi store={store} intents={intents()} />);
    expect(screen.getByText(/^You wake up/)).toBeTruthy();
    act(() => patchUi(store, { settings: { ...store.getState().settings, locale: "pl" } }));
    expect(screen.getByText(/^Budzisz się na fotelu/)).toBeTruthy();
    expect(screen.queryByText(/You wake up/)).toBeNull();
  });

  it("counts two pushes of the same key as one toast", () => {
    const store = createUiStore({ screen: "playing" });
    const a = pushToast(store, { kind: "system", title: textRef("newGame.place"), text: textRef("newGame.intro") });
    const b = pushToast(store, { kind: "system", title: textRef("newGame.place"), text: textRef("newGame.intro") });
    expect(b).toBe(a);
    expect(store.getState().toasts).toHaveLength(1);
    expect(store.getState().toasts[0]?.count).toBe(2);
  });

  it("marks the column while a talk is open, so a phone narrows it clear of the subtitles", () => {
    const store = createUiStore({ screen: "playing" });
    pushToast(store, { kind: "system", title: textRef("newGame.place"), text: textRef("newGame.intro") });
    const { container } = render(<GameUi store={store} intents={intents()} />);
    const column = () => container.querySelector(".toasts");
    expect(column()?.classList.contains("toasts--talk")).toBe(false);
    act(() => patchUi(store, { dialogue: { lines: [{ speaker: "Kaito", text: "Dalej." }], choices: [], ended: false } }));
    expect(column()?.classList.contains("toasts--talk")).toBe(true);
    act(() => patchUi(store, { dialogue: null }));
    expect(column()?.classList.contains("toasts--talk")).toBe(false);
  });
});
