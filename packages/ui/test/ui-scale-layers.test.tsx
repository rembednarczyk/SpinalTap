// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, type DialogueVm, GameUi, type UiIntents, type UiState, createUiStore, patchUi } from "../src";

/**
 * One interface scale for every layer (ADR-0085): the root carries the scale `uiScale` gives for
 * the setting and the screen, and the HUD, the pad, the dialogue and the contract card each draw
 * as a scaled layer that reads it.
 */
const intents = new Proxy({} as UiIntents, { get: () => vi.fn() });
const pad = { setStick: vi.fn(), look: vi.fn(), press: vi.fn(), release: vi.fn(), reset: vi.fn(), selectWeaponSlot: vi.fn() };

const resize = (width: number, height: number) =>
  act(() => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: height });
    window.dispatchEvent(new Event("resize"));
  });

const mount = (state: Partial<UiState>, touch: boolean) => {
  const store = createUiStore({ screen: "playing", ...state });
  render(<GameUi store={store} intents={intents} touch={touch ? pad : undefined} />);
  return store;
};

const root = () => document.documentElement.style;

const dialogue: DialogueVm = { lines: [{ speaker: "Kaito", text: "Robota czeka." }], choices: [{ index: 0, text: "Biorę robotę.", tone: "main" }], ended: false };
const debrief = { contractId: "c1", title: "Job", fixer: "Kaito", badges: [], rank: "B", reward: 1200, bonus: 0, styleBonus: 0, seconds: 95 } as const;

afterEach(() => {
  cleanup();
  resize(1024, 768);
});

describe("interface scale on every layer (ADR-0085)", () => {
  it("puts the scale for the screen on the root and follows the setting and resizes", () => {
    resize(1920, 1080);
    const store = mount({ settings: { ...DEFAULT_SETTINGS, hudScale: 1.4 } }, false);
    expect(root().getPropertyValue("--ui-scale")).toBe("1.4");
    expect(root().getPropertyValue("--ui-touch-scale")).toBe("1.4");
    // 1280x720 holds the desktop layout's room up to 1.2.
    resize(1280, 720);
    expect(root().getPropertyValue("--ui-scale")).toBe("1.2");
    act(() => patchUi(store, { settings: { ...DEFAULT_SETTINGS, hudScale: 0.8 } }));
    expect(root().getPropertyValue("--ui-scale")).toBe("0.8");
  });

  it("keeps the pad's layout while the HUD shrinks on a phone, and draws the pad as small", () => {
    resize(844, 390);
    mount({ settings: { ...DEFAULT_SETTINGS, hudScale: 0.8 } }, true);
    expect(root().getPropertyValue("--ui-scale")).toBe("0.8");
    expect(root().getPropertyValue("--ui-touch-scale")).toBe("1");
    expect(root().getPropertyValue("--ui-touch-look")).toBe("0.8");
    expect(root().getPropertyValue("--ui-touch-spread")).toBe("0.92");
  });

  it("pulls the top row and the action cluster toward their corners under 1, not at 1", () => {
    resize(844, 390);
    const store = mount({ settings: { ...DEFAULT_SETTINGS, hudScale: 1 } }, true);
    const top = () => document.querySelector<HTMLElement>(".touch__top")!.style;
    const actions = () => document.querySelector<HTMLElement>(".touch__actions")!.style;
    // At 1 the groups sit where they always did: no transform of their own.
    expect([top().transform, actions().transform]).toEqual(["", ""]);
    act(() => patchUi(store, { settings: { ...DEFAULT_SETTINGS, hudScale: 0.8 } }));
    // At 0.8 each group, its gaps and its distance to the corner shrink toward its screen corner:
    // a button 100 px from the corner at 1 is 92 px from it at 0.8, not drawn smaller in place.
    expect([top().transform, top().transformOrigin]).toEqual(["scale(0.92)", "100% 0%"]);
    expect([actions().transform, actions().transformOrigin]).toEqual(["scale(0.92)", "100% 100%"]);
    const fromCorner = (offset: number) => offset * Number.parseFloat(actions().transform.slice(6));
    expect(fromCorner(100)).toBeLessThan(100);
    // Up from 1, as before.
    act(() => patchUi(store, { settings: { ...DEFAULT_SETTINGS, hudScale: 1.4 } }));
    expect([top().transform, actions().transform]).toEqual(["", ""]);
  });

  it("keeps the knob to the drawn ring when the pad is drawn smaller", () => {
    resize(844, 390);
    mount({ settings: { ...DEFAULT_SETTINGS, hudScale: 0.8 } }, true);
    const zone = screen.getByTestId("touch-stick");
    fireEvent.pointerDown(zone, { pointerId: 1, clientX: 200, clientY: 300 });
    const stick = zone.querySelector<HTMLElement>(".touch__stick")!;
    expect([stick.style.left, stick.style.top]).toEqual(["200px", "300px"]);
    // The ring is drawn at 0.8: the knob stops 44.8 px out on screen, full right, at the ring's edge.
    pad.setStick.mockClear();
    fireEvent.pointerMove(zone, { pointerId: 1, clientX: 244.8, clientY: 300 });
    expect(pad.setStick).toHaveBeenLastCalledWith(1, -0);
    fireEvent.pointerMove(zone, { pointerId: 1, clientX: 400, clientY: 300 });
    expect(stick.querySelector<HTMLElement>(".touch__knob")!.style.transform).toBe("translate(56px, 0px)");
  });

  it("draws the HUD, the pad, the dialogue and the contract card as scaled layers", () => {
    resize(844, 390);
    const store = mount({ settings: { ...DEFAULT_SETTINGS, hudScale: 0.8 } }, true);
    expect(screen.getByTestId("hud").classList).toContain("ui-layer");
    const touch = screen.getByTestId("touch-controls").classList;
    expect([touch.contains("ui-layer"), touch.contains("ui-layer--touch")]).toEqual([true, true]);
    act(() => patchUi(store, { debrief }));
    expect(screen.getByTestId("debrief").parentElement?.classList).toContain("ui-layer");
    act(() => patchUi(store, { debrief: null, dialogue }));
    expect(screen.getByTestId("dialogue").classList).toContain("ui-layer");
    // The toasts are the HUD's: they scale with it.
    act(() => patchUi(store, { dialogue: null, toasts: [{ id: 1, kind: "system", title: "Hi", text: "" }] }));
    expect(screen.getByTestId("hud").querySelector(".toast")).not.toBeNull();
  });

  it("puts the stick under the finger in the pad's own px when the pad is scaled", () => {
    resize(844, 390);
    mount({ settings: { ...DEFAULT_SETTINGS, hudScale: 1.4 } }, true);
    // 390 / 370: the compact layout's room.
    expect(root().getPropertyValue("--ui-touch-scale")).toBe("1.054");
    const zone = screen.getByTestId("touch-stick");
    fireEvent.pointerDown(zone, { pointerId: 1, clientX: 210.8, clientY: 316.2 });
    const stick = zone.querySelector<HTMLElement>(".touch__stick")!;
    expect([stick.style.left, stick.style.top]).toEqual(["200px", "300px"]);
    // Pulled 200 px to the right: the knob stops at the ring's edge, the stick reads full right.
    pad.setStick.mockClear();
    fireEvent.pointerMove(zone, { pointerId: 1, clientX: 410.8, clientY: 316.2 });
    expect(pad.setStick).toHaveBeenLastCalledWith(1, -0);
    expect(stick.querySelector<HTMLElement>(".touch__knob")!.style.transform).toBe("translate(56px, 0px)");
  });
});
