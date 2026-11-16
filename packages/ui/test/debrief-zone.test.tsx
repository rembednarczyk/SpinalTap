// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { textRef } from "@seki/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type ContractDebriefVm, GameUi, type UiIntents, type UiState, createUiStore, patchUi, pushToast } from "../src";

const intents = (): UiIntents => new Proxy({}, { get: () => vi.fn() }) as UiIntents;

const mount = (state: Partial<UiState> = {}) => {
  const store = createUiStore({ screen: "playing", ...state });
  const pad = { setStick: vi.fn(), look: vi.fn(), press: vi.fn(), release: vi.fn(), reset: vi.fn(), selectWeaponSlot: vi.fn() };
  const { container } = render(<GameUi store={store} intents={intents()} touch={pad} />);
  return { store, pad, container };
};

const debrief: ContractDebriefVm = { contractId: "c1", title: "Infiltration", fixer: "Genzō", badges: [], rank: "S", reward: 1200, bonus: 300, styleBonus: 150, seconds: 95 };
const dialogue = { lines: [{ speaker: "Kaito", text: "Dalej." }], choices: [], ended: false };

afterEach(cleanup);

/**
 * The contract card takes the middle zone (G-846, ADR-0085): while it is up the messages keep their
 * newest title in one line, and on a phone the stick's resting ring steps aside, as for the scanner
 * (G-433); the stick keeps working under the card. The card's place against the rest of the HUD is
 * measured in `e2e/ui-scale.spec.ts`.
 */
describe("the contract card's zone (G-846)", () => {
  it("narrows the messages to their newest line while the card is up, not while it waits for a talk", () => {
    const { store, container } = mount();
    act(() => {
      pushToast(store, { kind: "system", title: textRef("newGame.place"), text: textRef("newGame.intro") });
    });
    const column = () => container.querySelector(".toasts")!.classList;
    expect(column().contains("toasts--brief")).toBe(false);
    act(() => patchUi(store, { debrief, dialogue }));
    expect(screen.queryByTestId("debrief")).toBeNull();
    expect(column().contains("toasts--brief")).toBe(false);
    act(() => patchUi(store, { dialogue: null }));
    expect(screen.getByTestId("debrief")).toBeTruthy();
    expect(column().contains("toasts--brief")).toBe(true);
    act(() => patchUi(store, { debrief: null }));
    expect(column().contains("toasts--brief")).toBe(false);
  });

  it("puts the stick's ring away while the card is up and keeps the stick working", () => {
    const { store, pad } = mount();
    const ring = () => screen.getByTestId("touch-stick").querySelector(".touch__stick-hint");
    expect(ring()).not.toBeNull();
    act(() => patchUi(store, { debrief }));
    expect(ring()).toBeNull();
    const zone = screen.getByTestId("touch-stick");
    fireEvent.pointerDown(zone, { pointerId: 1, clientX: 100, clientY: 300 });
    fireEvent.pointerMove(zone, { pointerId: 1, clientX: 156, clientY: 300 });
    expect(pad.setStick.mock.lastCall?.[0]).toBe(1);
    fireEvent.pointerUp(zone, { pointerId: 1 });
    act(() => patchUi(store, { debrief: null }));
    expect(ring()).not.toBeNull();
  });
});
