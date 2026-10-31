// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_HORIZONTAL_FOV, GameUi, createUiStore, dismissToast, hipVerticalFov, patchUi, pushToast, type UiIntents, type UiState } from "../src";
import { HUD_CAMERA_FOV, spreadToScreen } from "../src/hud/hud";

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
  talkToShopkeeper: vi.fn(),
  sellItem: vi.fn(),
  repairItem: vi.fn(),
  upgradeBackpack: vi.fn(),
  installCyberwareItem: vi.fn(),
  removeCyberware: vi.fn(),
  changeSettings: vi.fn(),
  setFieldOfView: vi.fn(),
  bindKey: vi.fn(),
  resetControls: vi.fn(),
  reload: vi.fn(),
  takeLoot: vi.fn(),
  closeLoot: vi.fn(),
  openCharacterScreen: vi.fn(),
  closeCharacterScreen: vi.fn(),
  setPreviewViewport: vi.fn(),
  rotatePreview: vi.fn(),
  resetPreview: vi.fn(),
  equip: vi.fn(),
  unequip: vi.fn(),
  useItem: vi.fn(),
  dropItem: vi.fn(),
  installMod: vi.fn(),
  removeMod: vi.fn(),
  openPhone: vi.fn(),
  closePhone: vi.fn(),
  readThread: vi.fn(),
  dismissDebrief: vi.fn(),
  setScan: vi.fn(),
  pickQuickhack: vi.fn(),
  submitBreach: vi.fn(),
  travelMetro: vi.fn(),
  closeMetro: vi.fn(),
  setRadioStation: vi.fn(),
  nextRadioStation: vi.fn(),
  trackQuest: vi.fn(),
});

const mount = (state: Partial<UiState> = {}) => {
  const store = createUiStore(state);
  const i = intents();
  render(<GameUi store={store} intents={i} />);
  return { store, i };
};

afterEach(cleanup);

/** The camera's vertical hip angle for the default setting on this window (ADR-0049). */
const screenFov = (degrees = DEFAULT_HORIZONTAL_FOV) => hipVerticalFov(degrees, window.innerWidth / window.innerHeight);

describe("title screen", () => {
  it("starts a new game", () => {
    const { i } = mount();
    fireEvent.click(screen.getByText("New Game"));
    expect(i.newGame).toHaveBeenCalled();
  });

  it("disables loading without saves and lists slots with saves", () => {
    mount();
    expect(screen.getByText("Load Game").closest("button")?.disabled).toBe(true);
    cleanup();
    const { i } = mount({ hasSaves: true, slots: [{ slot: "slot-2", savedAtLabel: "22:10", objective: "Wróć do Kaito" }] });
    fireEvent.click(screen.getByText("Load Game"));
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

  it("spreads the crosshair ticks with the aim cone and pulls them in while crouched", () => {
    const { store } = mount({ screen: "playing", aimSpread: 0.02 });
    const cross = screen.getByTestId("crosshair");
    const spread = () => Number(cross.style.getPropertyValue("--spread"));
    expect(cross.querySelectorAll(".crosshair__tick")).toHaveLength(4);
    const standing = spread();
    // Calibrated to the camera's vertical angle on this window's proportions (ADR-0049).
    expect(standing).toBeCloseTo(spreadToScreen(0.02, 1, screenFov()), 3);
    act(() => patchUi(store, { aimSpread: 0.07 }));
    expect(spread()).toBeGreaterThan(standing * 3);
    act(() => patchUi(store, { aimSpread: 0.008, crouched: true }));
    expect(spread()).toBeLessThan(standing);
    expect(cross.classList.contains("crosshair--crouched")).toBe(true);
    // Small angles map almost linearly: 0.02 rad is ~4.5% of half the screen at 16:9 and 80 degrees across.
    expect(spreadToScreen(0.02)).toBeCloseTo(Math.tan(0.02) / Math.tan(HUD_CAMERA_FOV / 2));
    expect(spreadToScreen(-1)).toBe(0);
  });

  it("pulls the ticks in while aiming down sights, calibrated to the zoomed view (ADR-0019)", () => {
    const { store } = mount({ screen: "playing", aimSpread: 0.03 });
    const cross = screen.getByTestId("crosshair");
    const spread = () => Number(cross.style.getPropertyValue("--spread"));
    const hip = spread();
    act(() => patchUi(store, { aimSpread: 0.015, aiming: true, aimZoom: 0.8 }));
    expect(cross.classList.contains("crosshair--aiming")).toBe(true);
    expect(spread()).toBeCloseTo(spreadToScreen(0.015, 0.8, screenFov()), 3);
    expect(spread()).toBeLessThan(hip);
    // The same cone covers more of a zoomed-in screen.
    expect(spreadToScreen(0.02, 0.6)).toBeGreaterThan(spreadToScreen(0.02));
    act(() => patchUi(store, { aiming: false, blocking: true }));
    expect(cross.classList.contains("crosshair--guard")).toBe(true);
  });

  it("calibrates the ticks to the field of view setting and the window's proportions (ADR-0049)", () => {
    const { store } = mount({ screen: "playing", aimSpread: 0.02 });
    const cross = screen.getByTestId("crosshair");
    const spread = () => Number(cross.style.getPropertyValue("--spread"));
    act(() => patchUi(store, { settings: { ...store.getState().settings, horizontalFov: 100 } }));
    expect(spread()).toBeCloseTo(spreadToScreen(0.02, 1, screenFov(100)), 4);
    const [w, h] = [window.innerWidth, window.innerHeight];
    try {
      // A phone turned sideways: the same horizontal angle is a shorter vertical one.
      act(() => {
        Object.assign(window, { innerWidth: 800, innerHeight: 370 });
        window.dispatchEvent(new Event("resize"));
      });
      expect(spread()).toBeCloseTo(spreadToScreen(0.02, 1, hipVerticalFov(100, 800 / 370)), 4);
    } finally {
      Object.assign(window, { innerWidth: w, innerHeight: h });
    }
  });

  it("does not re-render the crosshair when the store gets the same spread again", () => {
    const { store } = mount({ screen: "playing", aimSpread: 0.02 });
    let changes = 0;
    const off = store.subscribe(() => (changes += 1));
    act(() => patchUi(store, { aimSpread: 0.02, crouched: false }));
    expect(changes).toBe(0);
    off();
  });

  it("flashes the crosshair on a hit, red with an X on a head hit", () => {
    vi.useFakeTimers();
    try {
      const { store } = mount({ screen: "playing" });
      const cross = screen.getByTestId("crosshair");
      act(() => patchUi(store, { hitMarker: 1, hitZone: "torso" }));
      expect(cross.classList.contains("crosshair--hit")).toBe(true);
      expect(cross.classList.contains("crosshair--head")).toBe(false);
      act(() => vi.advanceTimersByTime(200));
      expect(cross.classList.contains("crosshair--hit")).toBe(false);
      act(() => patchUi(store, { hitMarker: 2, hitZone: "head" }));
      expect(cross.classList.contains("crosshair--head")).toBe(true);
      expect(cross.querySelector(".crosshair__x")).not.toBeNull();
      act(() => vi.advanceTimersByTime(300));
      expect(cross.classList.contains("crosshair--head")).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("caps the toast stack", () => {
    const store = createUiStore();
    for (let n = 0; n < 6; n++) pushToast(store, { kind: "system", title: `t${n}`, text: "" });
    expect(store.getState().toasts.map((t) => t.title)).toEqual(["t2", "t3", "t4", "t5"]);
  });

  it("over the limit drops the oldest toast that is not quest, memory or kept first (ADR-0059: a level up beside an ending)", () => {
    const store = createUiStore();
    pushToast(store, { kind: "quest", title: "ending", text: "" });
    pushToast(store, { kind: "reputation", title: "rep", text: "" });
    pushToast(store, { kind: "system", title: "level", text: "", keep: true });
    pushToast(store, { kind: "quest", title: "done", text: "" });
    pushToast(store, { kind: "quest", title: "next", text: "" });
    expect(store.getState().toasts.map((t) => t.title)).toEqual(["ending", "level", "done", "next"]);
    pushToast(store, { kind: "memory", title: "memory", text: "" });
    // All four kept: the oldest goes.
    expect(store.getState().toasts.map((t) => t.title)).toEqual(["level", "done", "next", "memory"]);
    pushToast(store, { kind: "money", title: "pay", text: "" });
    expect(store.getState().toasts.map((t) => t.title)).toEqual(["done", "next", "memory", "pay"]);
    // A failed load (system) outlives the payment that came before it.
    pushToast(store, { kind: "system", title: "Couldn't load the game", text: "", keep: true });
    expect(store.getState().toasts.map((t) => t.title)).toEqual(["done", "next", "memory", "Couldn't load the game"]);
    // Ordinary system toasts (purchases) come and go in order; the failed load stays.
    pushToast(store, { kind: "system", title: "bought 1", text: "" });
    pushToast(store, { kind: "system", title: "bought 2", text: "" });
    expect(store.getState().toasts.map((t) => t.title)).toEqual(["next", "memory", "Couldn't load the game", "bought 2"]);
  });

  it("shows the game clock with the day and the phase of the day", () => {
    mount({ screen: "playing" });
    expect(screen.queryByTestId("clock")).toBeNull();
    cleanup();
    const { store } = mount({ screen: "playing", clock: "21:00", day: 1, dayPhase: "night" });
    expect(screen.getByTestId("clock").textContent).toBe("Day 1night21:00");
    act(() => patchUi(store, { clock: "07:30", day: 2, dayPhase: "day" }));
    expect(screen.getByTestId("clock").textContent).toBe("Day 2day07:30");
    // Polish word for word as before (ADR-0056).
    act(() => patchUi(store, { settings: { ...store.getState().settings, locale: "pl" } }));
    expect(screen.getByTestId("clock").textContent).toBe("Dzień 2dzień07:30");
    expect(screen.getByTestId("clock").className).toContain("hud__clock--day");
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
    fireEvent.click(screen.getByText("End conversation"));
    expect(i.closeDialogue).toHaveBeenCalledTimes(2);
  });
});

describe("pause and death screens", () => {
  it("pause menu resumes, saves into a slot and quits", () => {
    const { i } = mount({ screen: "paused" });
    fireEvent.click(screen.getByText("Resume"));
    expect(i.resume).toHaveBeenCalled();
    fireEvent.click(screen.getByText("Save Game"));
    fireEvent.click(screen.getByText("Slot 3"));
    expect(i.save).toHaveBeenCalledWith("slot-3");
    fireEvent.click(screen.getByText("Back"));
    fireEvent.click(screen.getByText("Main Menu"));
    expect(i.quitToTitle).toHaveBeenCalled();
  });

  it("pause menu can switch to loading", () => {
    const { i } = mount({ screen: "paused", slots: [{ slot: "quick", savedAtLabel: "x", objective: "y" }] });
    fireEvent.click(screen.getByText("Load Game"));
    fireEvent.click(screen.getByText("Quicksave"));
    expect(i.load).toHaveBeenCalledWith("quick");
  });

  it("death screen restarts", () => {
    const { i } = mount({ screen: "dead" });
    expect(screen.getByText("FLATLINE")).toBeTruthy();
    fireEvent.click(screen.getByText("Start over"));
    expect(i.newGame).toHaveBeenCalled();
  });
});

describe("ripperdoc clinic", () => {
  it("lists implants, disables what is installed or unaffordable, and buys", () => {
    const { i } = mount({ screen: "playing", shopOpen: true, eddies: 700, cyberware: { skeleton: "subdermal_weave" }, medkits: 2 });
    const shop = screen.getByTestId("shop");
    expect(shop.textContent).toContain("Doctor Mori");
    expect(screen.getByRole("button", { name: "Installed" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: /Implant · 1,100/ }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /Implant · 500/ }));
    expect(i.buyCyberware).toHaveBeenCalledWith("steady_grip");
    fireEvent.click(screen.getByRole("button", { name: /Buy · 90/ }));
    expect(i.buyItem).toHaveBeenCalledWith("medkit");
    fireEvent.click(screen.getByRole("button", { name: "Talk to Mori" }));
    expect(i.talkToShopkeeper).toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(i.closeShop).toHaveBeenCalled();
  });

  it("shows list prices and no note at neutral standing", () => {
    mount({ screen: "playing", shopOpen: true, eddies: 5000 });
    expect(screen.queryByTestId("shop-terms")).toBeNull();
    expect(screen.getByRole("button", { name: /Buy · 90 €\$/ })).toBeTruthy();
  });

  it("gives a regular the discount, and charges a distrusted customer extra", () => {
    const rep = (clinic: number) => ({ fixers: 0, hebi: 0, civilians: 0, clinic, kagami: 0, tessen: 0 });
    mount({ screen: "playing", shopOpen: true, eddies: 5000, reputation: rep(60) });
    expect(screen.getByTestId("shop-terms").textContent).toBe("Regular customer · 20% off");
    expect(screen.getByRole("button", { name: /Buy · 72 €\$/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Implant · 400 €\$/ })).toBeTruthy();
    cleanup();
    mount({ screen: "playing", shopOpen: true, eddies: 600, reputation: rep(-20) });
    expect(screen.getByTestId("shop-terms").textContent).toBe("The clinic doesn't trust you · 25% surcharge");
    // 500 list, 625 with the surcharge: no longer affordable with 600.
    expect(screen.getByRole("button", { name: /Implant · 625 €\$/ }).hasAttribute("disabled")).toBe(true);
  });

  it("warns which implant a purchase replaces", () => {
    mount({ screen: "playing", shopOpen: true, eddies: 5000, cyberware: { nervous: "synapse_booster" } });
    expect(screen.getByText("Replaces: Synapse booster")).toBeTruthy();
  });
});

describe("gear and character sheet", () => {
  it("shows ability cooldown and medkits", () => {
    mount({ screen: "playing", medkits: 3, ability: { name: "ability.reflex_overdrive.name", activeTime: 0, cooldown: 6.2, cooldownTotal: 16 } });
    expect(screen.getByTestId("gear").textContent).toContain("Medkits × 3");
    expect(screen.getByTestId("gear").textContent).toContain("7 s");
    expect(screen.getByTestId("gear").textContent).toContain("Reflex overdrive");
  });

  it("toggles the character sheet with Tab", () => {
    mount({ screen: "playing", alias: "Seki Senshi", memories: ["combat_reflex"], cyberware: { optics: "hitomi_optics_mk1" }, reputation: { fixers: 20, hebi: -60, civilians: 0, clinic: 0, kagami: 0, tessen: 0 } });
    expect(screen.queryByTestId("character-panel")).toBeNull();
    fireEvent.keyDown(window, { code: "Tab" });
    const panel = screen.getByTestId("character-panel");
    expect(panel.textContent).toContain("Hitomi Mk1 optics");
    expect(panel.textContent).toContain("Memory: reflex");
    expect(panel.textContent).toContain("-60 · hostility");
    expect(screen.getByTestId("rep-hebi").textContent).toContain("They hunt you");
    expect(screen.getByTestId("rep-fixers").textContent).toContain("Kaito pays more");
    expect(screen.getByTestId("rep-clinic").textContent).toContain("Mori's clinic");
    expect(screen.getByTestId("rep-clinic").textContent).toContain("List prices");
    fireEvent.keyDown(window, { code: "Tab" });
    expect(screen.queryByTestId("character-panel")).toBeNull();
  });
});

describe("touch controls", () => {
  const sink = () => ({ setStick: vi.fn(), look: vi.fn(), press: vi.fn(), release: vi.fn(), reset: vi.fn(), selectWeaponSlot: vi.fn() });

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
    const fire = screen.getByRole("button", { name: "Fire" });
    fireEvent.pointerDown(fire, { pointerId: 1 });
    expect(pad.press).toHaveBeenCalledWith("fire");
    fireEvent.pointerUp(fire, { pointerId: 1 });
    expect(pad.release).toHaveBeenCalledWith("fire");
    fireEvent.pointerDown(screen.getByRole("button", { name: "Ability" }), { pointerId: 2 });
    expect(pad.press).toHaveBeenCalledWith("ability");
  });

  it("holds the aim button while pressed and lights it while aiming or guarding (ADR-0019)", () => {
    const { store, pad } = mountTouch();
    const aim = screen.getByTestId("touch-aim");
    fireEvent.pointerDown(aim, { pointerId: 5 });
    expect(pad.press).toHaveBeenCalledWith("aim");
    fireEvent.pointerUp(aim, { pointerId: 5 });
    expect(pad.release).toHaveBeenCalledWith("aim");
    expect(aim.classList.contains("touch__btn--on")).toBe(false);
    act(() => patchUi(store, { aiming: true }));
    expect(aim.classList.contains("touch__btn--on")).toBe(true);
    act(() => patchUi(store, { aiming: false, blocking: true }));
    expect(aim.classList.contains("touch__btn--on")).toBe(true);
  });

  it("toggles crouch: one tap holds it, the next lets go", () => {
    const { store, pad } = mountTouch();
    // Crouch sits behind "more" (ADR-0035).
    fireEvent.pointerDown(screen.getByTestId("touch-more"));
    const crouch = screen.getByTestId("touch-crouch");
    fireEvent.pointerDown(crouch, { pointerId: 3 });
    fireEvent.pointerUp(crouch, { pointerId: 3 });
    expect(pad.press).toHaveBeenCalledWith("crouch");
    expect(pad.release).not.toHaveBeenCalledWith("crouch");
    expect(crouch.getAttribute("aria-pressed")).toBe("true");
    fireEvent.pointerDown(crouch, { pointerId: 4 });
    expect(pad.release).toHaveBeenCalledWith("crouch");
    expect(crouch.getAttribute("aria-pressed")).toBe("false");
    // Lit from the game state too.
    act(() => patchUi(store, { crouched: true }));
    expect(crouch.classList.contains("touch__btn--on")).toBe(true);
  });

  it("hides the ability button without the implant and pauses from the top bar", () => {
    const { i } = mountTouch();
    expect(screen.queryByRole("button", { name: "Ability" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(i.pause).toHaveBeenCalled();
  });

  it("opens the character screen from the top bar, sheet one tab away", () => {
    mountTouch();
    fireEvent.click(screen.getByRole("button", { name: "Character" }));
    expect(screen.getByTestId("inventory-tab")).toBeTruthy();
    expect(screen.queryByTestId("touch-controls")).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: /Sheet/ }));
    expect(screen.getByTestId("character-panel")).toBeTruthy();
  });

  it("marks the document for touch layout", () => {
    mountTouch();
    expect(document.documentElement.classList.contains("touch-mode")).toBe(true);
  });
});
