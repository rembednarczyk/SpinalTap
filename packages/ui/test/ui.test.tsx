// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameUi, createUiStore, dismissToast, patchUi, pushToast, type UiIntents, type UiState } from "../src";

const intents = (): UiIntents => ({
  newGame: vi.fn(),
  resume: vi.fn(),
  pause: vi.fn(),
  save: vi.fn(),
  load: vi.fn(),
  choose: vi.fn(),
  closeDialogue: vi.fn(),
  quitToTitle: vi.fn(),
});

const mount = (state: Partial<UiState> = {}) => {
  const store = createUiStore(state);
  const i = intents();
  render(<GameUi store={store} intents={i} />);
  return { store, i };
};

afterEach(cleanup);

describe("title screen", () => {
  it("starts a new game", () => {
    const { i } = mount();
    fireEvent.click(screen.getByText("Nowa gra"));
    expect(i.newGame).toHaveBeenCalled();
  });

  it("disables loading without saves and lists slots with saves", () => {
    mount();
    expect(screen.getByText("Wczytaj").closest("button")?.disabled).toBe(true);
    cleanup();
    const { i } = mount({ hasSaves: true, slots: [{ slot: "slot-2", savedAtLabel: "22:10", objective: "Wróć do Kaito" }] });
    fireEvent.click(screen.getByText("Wczytaj"));
    expect(screen.getByText("Slot 1").closest("button")?.disabled).toBe(true);
    fireEvent.click(screen.getByText("Slot 2"));
    expect(i.load).toHaveBeenCalledWith("slot-2");
  });
});

describe("HUD", () => {
  it("renders vitals, wallet, objective and the interaction prompt from the store", () => {
    const { store } = mount({ screen: "playing", hp: 42, alias: "Seki Senshi", eddies: 1620, objective: "Wróć do Kaito", questTitle: "Pierwsze zlecenie" });
    expect(screen.getByText("Seki Senshi")).toBeTruthy();
    expect(screen.getByText("42 / 100")).toBeTruthy();
    expect(screen.getByTestId("eddies").textContent).toMatch(/1\s?620/);
    expect(screen.getByTestId("objective").textContent).toContain("Wróć do Kaito");
    expect(screen.queryByTestId("prompt")).toBeNull();
    act(() => patchUi(store, { prompt: "Rozmawiaj z Kaito" }));
    expect(screen.getByTestId("prompt").textContent).toContain("Rozmawiaj z Kaito");
  });

  it("shows and dismisses toasts", () => {
    const { store } = mount({ screen: "playing" });
    let id = 0;
    act(() => {
      id = pushToast(store, { kind: "memory", title: "Wspomnienie: odruch", text: "..." });
    });
    expect(screen.getByText("Wspomnienie: odruch")).toBeTruthy();
    act(() => dismissToast(store, id));
    expect(screen.queryByText("Wspomnienie: odruch")).toBeNull();
  });

  it("caps the toast stack", () => {
    const store = createUiStore();
    for (let n = 0; n < 6; n++) pushToast(store, { kind: "system", title: `t${n}`, text: "" });
    expect(store.getState().toasts.map((t) => t.title)).toEqual(["t2", "t3", "t4", "t5"]);
  });
});

describe("patchUi", () => {
  it("skips updates when nothing changed", () => {
    const store = createUiStore();
    const listener = vi.fn();
    store.subscribe(listener);
    patchUi(store, { hp: 100, eddies: 0 });
    expect(listener).not.toHaveBeenCalled();
    patchUi(store, { hp: 90 });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("dialogue panel", () => {
  const dialogue = {
    lines: [
      { speaker: "Kaito", text: "No proszę." },
      { speaker: null, text: "Deszcz." },
    ],
    choices: [
      { index: 0, text: "Kim jesteś?" },
      { index: 1, text: "Co mi się stało?" },
    ],
    ended: false,
  };

  it("renders lines and forwards choices by click and number key", () => {
    const { i } = mount({ screen: "playing", dialogue });
    expect(screen.getByText("No proszę.")).toBeTruthy();
    fireEvent.click(screen.getByText("Co mi się stało?"));
    expect(i.choose).toHaveBeenCalledWith(1);
    fireEvent.keyDown(window, { key: "1" });
    expect(i.choose).toHaveBeenCalledWith(0);
  });

  it("closes an ended conversation", () => {
    const { i } = mount({ screen: "playing", dialogue: { ...dialogue, choices: [], ended: true } });
    fireEvent.keyDown(window, { key: "e" });
    fireEvent.click(screen.getByText("Zakończ rozmowę"));
    expect(i.closeDialogue).toHaveBeenCalledTimes(2);
  });
});

describe("pause and death screens", () => {
  it("pause menu resumes, saves into a slot and quits", () => {
    const { i } = mount({ screen: "paused" });
    fireEvent.click(screen.getByText("Wróć do gry"));
    expect(i.resume).toHaveBeenCalled();
    fireEvent.click(screen.getByText("Zapisz"));
    fireEvent.click(screen.getByText("Slot 3"));
    expect(i.save).toHaveBeenCalledWith("slot-3");
    fireEvent.click(screen.getByText("Wróć"));
    fireEvent.click(screen.getByText("Menu główne"));
    expect(i.quitToTitle).toHaveBeenCalled();
  });

  it("pause menu can switch to loading", () => {
    const { i } = mount({ screen: "paused", slots: [{ slot: "quick", savedAtLabel: "x", objective: "y" }] });
    fireEvent.click(screen.getByText("Wczytaj"));
    fireEvent.click(screen.getByText("Szybki zapis"));
    expect(i.load).toHaveBeenCalledWith("quick");
  });

  it("death screen restarts", () => {
    const { i } = mount({ screen: "dead" });
    expect(screen.getByText("FLATLINE")).toBeTruthy();
    fireEvent.click(screen.getByText("Zacznij od nowa"));
    expect(i.newGame).toHaveBeenCalled();
  });
});
