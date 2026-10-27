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
  buyCyberware: vi.fn(),
  buyItem: vi.fn(),
  closeShop: vi.fn(),
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

describe("ripperdoc clinic", () => {
  it("lists implants, disables what is installed or unaffordable, and buys", () => {
    const { i } = mount({ screen: "playing", shopOpen: true, eddies: 700, cyberware: { skeleton: "subdermal_weave" }, medkits: 2 });
    const shop = screen.getByTestId("shop");
    expect(shop.textContent).toContain("Doktor Mori");
    expect(screen.getByRole("button", { name: "Zainstalowane" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: /Wszczep · 1100/ }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /Wszczep · 500/ }));
    expect(i.buyCyberware).toHaveBeenCalledWith("steady_grip");
    fireEvent.click(screen.getByRole("button", { name: /Kup · 90/ }));
    expect(i.buyItem).toHaveBeenCalledWith("medkit");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(i.closeShop).toHaveBeenCalled();
  });

  it("shows list prices and no note at neutral standing", () => {
    mount({ screen: "playing", shopOpen: true, eddies: 5000 });
    expect(screen.queryByTestId("shop-terms")).toBeNull();
    expect(screen.getByRole("button", { name: /Kup · 90 €\$/ })).toBeTruthy();
  });

  it("gives a regular the discount, and charges a distrusted customer extra", () => {
    const rep = (clinic: number) => ({ fixers: 0, hebi: 0, civilians: 0, clinic });
    mount({ screen: "playing", shopOpen: true, eddies: 5000, reputation: rep(60) });
    expect(screen.getByTestId("shop-terms").textContent).toBe("Stała klientka · rabat 20%");
    expect(screen.getByRole("button", { name: /Kup · 72 €\$/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Wszczep · 400 €\$/ })).toBeTruthy();
    cleanup();
    mount({ screen: "playing", shopOpen: true, eddies: 600, reputation: rep(-20) });
    expect(screen.getByTestId("shop-terms").textContent).toBe("Klinika ci nie ufa · dopłata 25%");
    // 500 list, 625 with the surcharge: no longer affordable with 600.
    expect(screen.getByRole("button", { name: /Wszczep · 625 €\$/ }).hasAttribute("disabled")).toBe(true);
  });

  it("warns which implant a purchase replaces", () => {
    mount({ screen: "playing", shopOpen: true, eddies: 5000, cyberware: { nervous: "synapse_booster" } });
    expect(screen.getByText("Zastąpi: Wzmacniacz synaps")).toBeTruthy();
  });
});

describe("gear and character sheet", () => {
  it("shows ability cooldown and medkits", () => {
    mount({ screen: "playing", medkits: 3, ability: { name: "Przeciążenie odruchów", activeTime: 0, cooldown: 6.2, cooldownTotal: 16 } });
    expect(screen.getByTestId("gear").textContent).toContain("Apteczki × 3");
    expect(screen.getByTestId("gear").textContent).toContain("7 s");
  });

  it("toggles the character sheet with Tab", () => {
    mount({ screen: "playing", alias: "Seki Senshi", memories: ["combat_reflex"], cyberware: { optics: "hitomi_optics_mk1" }, reputation: { fixers: 20, hebi: -60, civilians: 0, clinic: 0 } });
    expect(screen.queryByTestId("character-panel")).toBeNull();
    fireEvent.keyDown(window, { code: "Tab" });
    const panel = screen.getByTestId("character-panel");
    expect(panel.textContent).toContain("Optyka Hitomi Mk1");
    expect(panel.textContent).toContain("Wspomnienie: odruch");
    expect(panel.textContent).toContain("-60 · wrogość");
    expect(screen.getByTestId("rep-hebi").textContent).toContain("Polują na ciebie");
    expect(screen.getByTestId("rep-fixers").textContent).toContain("Kaito płaci więcej");
    expect(screen.getByTestId("rep-clinic").textContent).toContain("Klinika Mori");
    expect(screen.getByTestId("rep-clinic").textContent).toContain("Ceny katalogowe");
    fireEvent.keyDown(window, { code: "Tab" });
    expect(screen.queryByTestId("character-panel")).toBeNull();
  });
});

describe("touch controls", () => {
  const sink = () => ({ setStick: vi.fn(), look: vi.fn(), press: vi.fn(), release: vi.fn(), reset: vi.fn() });

  const mountTouch = (state: Partial<UiState> = {}) => {
    const store = createUiStore({ screen: "playing", ...state });
    const i = intents();
    const pad = sink();
    const view = render(<GameUi store={store} intents={i} touch={pad} />);
    return { store, i, pad, view };
  };

  it("shows the pad only while playing without a dialogue or the clinic", () => {
    const { store } = mountTouch();
    expect(screen.getByTestId("touch-controls")).toBeTruthy();
    act(() => patchUi(store, { shopOpen: true }));
    expect(screen.queryByTestId("touch-controls")).toBeNull();
    act(() => patchUi(store, { shopOpen: false, screen: "paused" }));
    expect(screen.queryByTestId("touch-controls")).toBeNull();
  });

  it("lifts every finger when the pad hides", () => {
    const { store, pad } = mountTouch();
    act(() => patchUi(store, { screen: "paused" }));
    expect(pad.reset).toHaveBeenCalled();
  });

  it("presses and releases action buttons", () => {
    const { pad } = mountTouch({ ability: { name: "X", activeTime: 0, cooldown: 0, cooldownTotal: 16 } });
    const fire = screen.getByRole("button", { name: "Strzał" });
    fireEvent.pointerDown(fire, { pointerId: 1 });
    expect(pad.press).toHaveBeenCalledWith("fire");
    fireEvent.pointerUp(fire, { pointerId: 1 });
    expect(pad.release).toHaveBeenCalledWith("fire");
    fireEvent.pointerDown(screen.getByRole("button", { name: "Zdolność" }), { pointerId: 2 });
    expect(pad.press).toHaveBeenCalledWith("ability");
  });

  it("hides the ability button without the implant and pauses from the top bar", () => {
    const { i } = mountTouch();
    expect(screen.queryByRole("button", { name: "Zdolność" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Pauza" }));
    expect(i.pause).toHaveBeenCalled();
  });

  it("opens the character sheet from the top bar", () => {
    mountTouch();
    fireEvent.click(screen.getByRole("button", { name: "Karta postaci" }));
    expect(screen.getByTestId("character-panel")).toBeTruthy();
  });

  it("marks the document for touch layout", () => {
    mountTouch();
    expect(document.documentElement.classList.contains("touch-mode")).toBe(true);
  });
});
