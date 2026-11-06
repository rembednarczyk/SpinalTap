// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, GameUi, type SettingsVm, type UiIntents, type UiState, createUiStore } from "../src";

/** Every intent is a spy, including ones added later. */
const intents = (): UiIntents & Record<string, ReturnType<typeof vi.fn>> => {
  const spies: Record<string | symbol, ReturnType<typeof vi.fn>> = {};
  return new Proxy(spies, { get: (t, k) => (t[k] ??= vi.fn()) }) as UiIntents & Record<string, ReturnType<typeof vi.fn>>;
};

const mount = (state: Partial<UiState> = {}, touch = false) => {
  const store = createUiStore(state);
  const i = intents();
  const pad = { setStick: vi.fn(), look: vi.fn(), press: vi.fn(), release: vi.fn(), reset: vi.fn(), selectWeaponSlot: vi.fn() };
  render(<GameUi store={store} intents={i} touch={touch ? pad : undefined} />);
  return { store, i };
};

const settings = (patch: Partial<SettingsVm>): SettingsVm => ({ ...DEFAULT_SETTINGS, ...patch });

afterEach(cleanup);

describe("touch fire button in the settings (ADR-0072)", () => {
  const openTouchTab = (patch: Partial<SettingsVm> = {}, tab = "Touch & Gamepad") => {
    const r = mount({ screen: "paused", settings: settings(patch) });
    fireEvent.click(screen.getByText(patch.locale === "pl" ? "Ustawienia" : "Settings"));
    fireEvent.click(screen.getByRole("tab", { name: tab }));
    return r;
  };

  it("aims and fires by default, and the aim button sits in the same tab", () => {
    openTouchTab();
    const fire = screen.getByRole("radiogroup", { name: "Fire button" });
    expect(within(fire).getByRole("radio", { name: "Aims and fires" }).getAttribute("aria-checked")).toBe("true");
    expect(within(fire).getByRole("radio", { name: "Fires only" }).getAttribute("aria-checked")).toBe("false");
    const aim = screen.getByRole("radiogroup", { name: "Aim button" });
    expect(within(aim).getByRole("radio", { name: "Hold" }).getAttribute("aria-checked")).toBe("true");
  });

  it("fires only with a toggled aim button, so a tap on it raises the sights", () => {
    const { i } = openTouchTab();
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Fire button" })).getByRole("radio", { name: "Fires only" }));
    expect(i.changeSettings).toHaveBeenCalledWith({ touchFire: "separate", aimMode: "toggle" });
  });

  it("going back to aims and fires keeps the aim button as it is", () => {
    const { i } = openTouchTab({ touchFire: "separate", aimMode: "toggle" });
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Fire button" })).getByRole("radio", { name: "Aims and fires" }));
    expect(i.changeSettings).toHaveBeenCalledWith({ touchFire: "aims" });
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Aim button" })).getByRole("radio", { name: "Hold" }));
    expect(i.changeSettings).toHaveBeenCalledWith({ aimMode: "hold" });
  });

  it("speaks Polish with the Polish setting", () => {
    openTouchTab({ locale: "pl", touchFire: "separate" }, "Dotyk i pad");
    const fire = screen.getByRole("radiogroup", { name: "Przycisk strzału" });
    expect(within(fire).getByRole("radio", { name: "Tylko strzela" }).getAttribute("aria-checked")).toBe("true");
    expect(within(fire).getByRole("radio", { name: "Celuje i strzela" })).toBeTruthy();
    expect(screen.getByRole("radiogroup", { name: "Przycisk celowania" })).toBeTruthy();
  });
});

describe("aim assist in the settings (ADR-0072, stage 3)", () => {
  const openTouchTab = (patch: Partial<SettingsVm> = {}, tab = "Touch & Gamepad") => {
    const r = mount({ screen: "paused", settings: settings(patch) });
    fireEvent.click(screen.getByText(patch.locale === "pl" ? "Ustawienia" : "Settings"));
    fireEvent.click(screen.getByRole("tab", { name: tab }));
    return r;
  };

  it("is standard by default in the touch tab, and a choice changes the setting", () => {
    const { i } = openTouchTab();
    const assist = screen.getByRole("radiogroup", { name: "Aim assist" });
    expect(within(assist).getByRole("radio", { name: "Standard" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(within(assist).getByRole("radio", { name: "Off" }));
    expect(i.changeSettings).toHaveBeenCalledWith({ aimAssist: "off" });
    fireEvent.click(within(assist).getByRole("radio", { name: "Light" }));
    expect(i.changeSettings).toHaveBeenCalledWith({ aimAssist: "light" });
  });

  it("the touch sensitivity sits in the touch tab, not in General (user decision 6.11)", () => {
    const { i } = openTouchTab({ touchSensitivity: 0.8 });
    expect(screen.getByTestId("settings").textContent).toContain("0.8×");
    fireEvent.change(screen.getByLabelText(/Touch sensitivity/), { target: { value: "1.2" } });
    expect(i.changeSettings).toHaveBeenCalledWith({ touchSensitivity: 1.2 });
    fireEvent.click(screen.getByRole("tab", { name: "General" }));
    expect(screen.queryByLabelText(/Touch sensitivity/)).toBeNull();
  });

  it("speaks Polish with the Polish setting", () => {
    openTouchTab({ locale: "pl", aimAssist: "light" }, "Dotyk i pad");
    const assist = screen.getByRole("radiogroup", { name: "Wspomaganie celowania" });
    expect(within(assist).getByRole("radio", { name: "Lekkie" }).getAttribute("aria-checked")).toBe("true");
    expect(within(assist).getByRole("radio", { name: "Wyłączone" })).toBeTruthy();
    expect(within(assist).getByRole("radio", { name: "Standardowe" })).toBeTruthy();
  });
});

describe("sights ring at the crosshair (ADR-0072, variant B)", () => {
  const ring = () => screen.queryByTestId("ads-ring");

  it("shows on touch while the sights are up with a fire button that only fires", () => {
    mount({ screen: "playing", aiming: true, settings: settings({ touchFire: "separate", aimMode: "toggle" }) }, true);
    expect(ring()).not.toBeNull();
    expect(screen.getByTestId("touch-aim").className).toContain("touch__btn--on");
  });

  it("stays away from the hip, from the fire button that aims and from the mouse", () => {
    mount({ screen: "playing", aiming: false, settings: settings({ touchFire: "separate" }) }, true);
    expect(ring()).toBeNull();
    cleanup();
    mount({ screen: "playing", aiming: true, settings: settings({ touchFire: "aims" }) }, true);
    expect(ring()).toBeNull();
    cleanup();
    mount({ screen: "playing", aiming: true, settings: settings({ touchFire: "separate" }) }, false);
    expect(ring()).toBeNull();
  });
});
