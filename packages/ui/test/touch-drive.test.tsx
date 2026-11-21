// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameUi, type UiIntents, type UiState, type VehicleVm, createUiStore } from "../src";

/** Every intent is a spy, including ones added later. */
const intents = (): UiIntents => {
  const spies: Record<string | symbol, ReturnType<typeof vi.fn>> = {};
  return new Proxy(spies, { get: (t, k) => (t[k] ??= vi.fn()) }) as unknown as UiIntents;
};

const CAR: VehicleVm = { kmh: 0, gear: "N", revs: 0.1, abs: false, tc: false, damage: 0 };

const mount = (state: Partial<UiState> = {}) => {
  const store = createUiStore({ screen: "playing", ...state });
  const pad = { setStick: vi.fn(), setSteer: vi.fn(), look: vi.fn(), press: vi.fn(), release: vi.fn(), reset: vi.fn(), selectWeaponSlot: vi.fn() };
  render(<GameUi store={store} intents={intents()} touch={pad} />);
  return { store, pad };
};

afterEach(cleanup);

describe("the touch pad at the wheel (ADR-0097 §4)", () => {
  it("swaps the stick and the jump for the steering slider, the pedals, the handbrake and the horn, and back", () => {
    const { store, pad } = mount();
    expect(screen.queryByTestId("touch-drive")).toBeNull();
    expect(screen.getByTestId("touch-stick")).toBeTruthy();
    pad.reset.mockClear();
    act(() => store.setState({ vehicle: CAR }));
    expect(screen.getByTestId("touch-drive")).toBeTruthy();
    expect(screen.queryByTestId("touch-stick")).toBeNull();
    expect(screen.queryByTestId("touch-jump")).toBeNull();
    for (const id of ["touch-steer", "touch-gas", "touch-brake", "touch-handbrake", "touch-horn"]) expect(screen.getByTestId(id), id).toBeTruthy();
    // Getting in lets go of whatever the thumbs held on foot.
    expect(pad.reset).toHaveBeenCalled();
    act(() => store.setState({ vehicle: null }));
    expect(screen.getByTestId("touch-stick")).toBeTruthy();
  });

  it("holds the pedals while pressed and steers by the thumb's sideways travel only", () => {
    const { pad } = mount({ vehicle: CAR });
    fireEvent.pointerDown(screen.getByTestId("touch-gas"), { pointerId: 2 });
    expect(pad.press).toHaveBeenCalledWith("gas");
    fireEvent.pointerUp(screen.getByTestId("touch-gas"), { pointerId: 2 });
    expect(pad.release).toHaveBeenCalledWith("gas");
    const steer = screen.getByTestId("touch-steer");
    fireEvent.pointerDown(steer, { pointerId: 1, clientX: 200, clientY: 300 });
    fireEvent.pointerMove(steer, { pointerId: 1, clientX: 180, clientY: 200 });
    const [x] = pad.setSteer.mock.calls.at(-1) as [number];
    expect(x).toBeLessThan(0);
    expect(x).toBeGreaterThan(-1);
    // Far past its reach it turns fully, no further.
    fireEvent.pointerMove(steer, { pointerId: 1, clientX: 900, clientY: 300 });
    expect(pad.setSteer.mock.calls.at(-1)).toEqual([1]);
    fireEvent.pointerUp(steer, { pointerId: 1 });
    expect(pad.setSteer.mock.calls.at(-1)).toEqual([0]);
  });
});
