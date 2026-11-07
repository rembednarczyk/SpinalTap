// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, GameUi, type ScanTargetVm, type UiIntents, type UiState, createUiStore, patchUi } from "../src";

const intents = (): UiIntents & Record<string, ReturnType<typeof vi.fn>> => {
  const spies: Record<string | symbol, ReturnType<typeof vi.fn>> = {};
  return new Proxy(spies, { get: (t, k) => (t[k] ??= vi.fn()) }) as UiIntents & Record<string, ReturnType<typeof vi.fn>>;
};

const mount = (state: Partial<UiState> = {}) => {
  const store = createUiStore({ screen: "playing", ...state });
  const pad = { setStick: vi.fn(), look: vi.fn(), press: vi.fn(), release: vi.fn(), reset: vi.fn(), selectWeaponSlot: vi.fn() };
  render(<GameUi store={store} intents={intents()} touch={pad} />);
  return { store, pad };
};

/** The longest card: Polish, an enemy with its level, the longest enemy name and faction. */
const enemy: ScanTargetVm = { id: 7, kind: "person", name: "Czyściciel Kagami", faction: "Mieszkańcy Lublina", profile: ["Pisze anonimowo na netboardach"], hostile: true, level: 10 };

afterEach(cleanup);

/**
 * The scan card on a phone held sideways (G-433): it takes the left column, where the stick's ring
 * sits, so the ring steps aside while the scanner is on and comes back after; the stick keeps
 * working under the card. The card's size against the rest of the HUD is measured in
 * `e2e/touch-layout.spec.ts`.
 */
describe("the touch scan card and the stick's ring (G-433)", () => {
  it("hides the ring while scanning and shows it again when the scanner is let go", () => {
    const { store } = mount({ settings: { ...DEFAULT_SETTINGS, locale: "pl" } });
    const ring = () => screen.getByTestId("touch-stick").querySelector(".touch__stick-hint");
    expect(ring()?.textContent).toBe("ruch");
    act(() => patchUi(store, { scanning: true, scanTarget: enemy }));
    expect(screen.getByTestId("scan-level").textContent).toContain("Poziom 10");
    expect(ring()).toBeNull();
    act(() => patchUi(store, { scanning: false, scanTarget: null }));
    expect(ring()).not.toBeNull();
  });

  it("the stick still moves the player while the card is up", () => {
    const { pad } = mount({ scanning: true, scanTarget: enemy });
    const zone = screen.getByTestId("touch-stick");
    fireEvent.pointerDown(zone, { pointerId: 1, clientX: 100, clientY: 300 });
    fireEvent.pointerMove(zone, { pointerId: 1, clientX: 156, clientY: 300 });
    expect(pad.setStick.mock.lastCall?.[0]).toBe(1);
  });

  it("every hack of the card is a button to tap", () => {
    mount({ scanning: true, scanTarget: enemy, ram: { current: 8, max: 8 } });
    for (const id of ["ping", "reboot_optics", "cripple_movement", "short_circuit"]) expect(screen.getByTestId(`hack-${id}`).querySelector("button")).not.toBeNull();
  });
});
