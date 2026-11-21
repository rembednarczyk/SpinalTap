// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, GameUi, type UiIntents, type VehicleVm, createUiStore } from "../src";
import { TACH_SEGMENTS } from "../src/hud/vehicle-dash";

/** The car's dashboard on the HUD (ADR-0097 §3): speed, gear, a segmented tachometer and the ABS and TC lamps. */

const intents = (): UiIntents => new Proxy({}, { get: () => vi.fn() }) as UiIntents;
const mount = (vehicle: VehicleVm | null) => render(<GameUi store={createUiStore({ screen: "playing", settings: { ...DEFAULT_SETTINGS, locale: "en" }, vehicle })} intents={intents()} />);
const at = (over: Partial<VehicleVm> = {}): VehicleVm => ({ kmh: 87, gear: "3", revs: 0.5, abs: false, tc: false, ...over });

afterEach(cleanup);

describe("the car's dashboard (ADR-0097 §3)", () => {
  it("shows the speed and the gear, and lights the tachometer's segments up to the revs", () => {
    mount(at());
    const dash = screen.getByTestId("vehicle");
    expect(dash.textContent).toContain("87");
    expect(dash.textContent).toContain("3");
    const tach = screen.getByTestId("vehicle-tach");
    expect(tach.children).toHaveLength(TACH_SEGMENTS);
    expect(tach.querySelectorAll(".hud__tach-seg--on")).toHaveLength(TACH_SEGMENTS / 2);
    expect(dash.classList.contains("hud__vehicle--limiter")).toBe(false);
  });

  it("flashes the whole bar at the limiter, the last segments red", () => {
    mount(at({ revs: 1 }));
    expect(screen.getByTestId("vehicle").classList.contains("hud__vehicle--limiter")).toBe(true);
    expect(screen.getByTestId("vehicle-tach").querySelectorAll(".hud__tach-seg--on.hud__tach-seg--red").length).toBeGreaterThan(0);
  });

  it("lights the ABS and TC lamps while the assists work", () => {
    mount(at({ abs: true }));
    expect(screen.getByTestId("lamp-abs").classList.contains("hud__lamp--on")).toBe(true);
    expect(screen.getByTestId("lamp-tc").classList.contains("hud__lamp--on")).toBe(false);
  });

  it("is not there on foot", () => {
    mount(null);
    expect(screen.queryByTestId("vehicle")).toBeNull();
  });
});
