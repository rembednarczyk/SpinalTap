// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, GameUi, type SettingsVm, type UiIntents, createUiStore } from "../src";

/** The gamepad's own look settings in the Touch & Gamepad tab (ADR-0072, stage 4). */
const intents = (): UiIntents & Record<string, ReturnType<typeof vi.fn>> => {
  const spies: Record<string | symbol, ReturnType<typeof vi.fn>> = {};
  return new Proxy(spies, { get: (t, k) => (t[k] ??= vi.fn()) }) as UiIntents & Record<string, ReturnType<typeof vi.fn>>;
};

const openTab = (patch: Partial<SettingsVm> = {}) => {
  const i = intents();
  render(<GameUi store={createUiStore({ screen: "paused", settings: { ...DEFAULT_SETTINGS, ...patch } })} intents={i} />);
  const pl = patch.locale === "pl";
  fireEvent.click(screen.getByText(pl ? "Ustawienia" : "Settings"));
  fireEvent.click(screen.getByRole("tab", { name: pl ? "Dotyk i pad" : "Touch & Gamepad" }));
  return i;
};

const slider = (name: string) => screen.getByRole("slider", { name: new RegExp(`^${name}`) }) as HTMLInputElement;

afterEach(cleanup);

describe("gamepad settings (ADR-0072, stage 4)", () => {
  it("shows the pad's sensitivity, dead zone and the classic curve by default", () => {
    openTab();
    expect(slider("Gamepad sensitivity").value).toBe("1");
    expect(slider("Gamepad sensitivity")).toMatchObject({ min: "0.2", max: "3" });
    expect(slider("Stick dead zone").value).toBe("0.12");
    expect(slider("Stick dead zone")).toMatchObject({ min: "0.05", max: "0.3" });
    expect(screen.getByText("12%")).toBeTruthy();
    const curve = screen.getByRole("radiogroup", { name: "Response curve" });
    expect(within(curve).getByRole("radio", { name: "Classic" }).getAttribute("aria-checked")).toBe("true");
    expect(within(curve).getByRole("radio", { name: "Linear" }).getAttribute("aria-checked")).toBe("false");
    expect(within(curve).getByRole("radio", { name: "Precise" })).toBeTruthy();
  });

  it("hands each change to the settings intent", () => {
    const i = openTab();
    fireEvent.change(slider("Gamepad sensitivity"), { target: { value: "1.8" } });
    expect(i.changeSettings).toHaveBeenCalledWith({ padSensitivity: 1.8 });
    fireEvent.change(slider("Stick dead zone"), { target: { value: "0.2" } });
    expect(i.changeSettings).toHaveBeenCalledWith({ padDeadzone: 0.2 });
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Response curve" })).getByRole("radio", { name: "Linear" }));
    expect(i.changeSettings).toHaveBeenCalledWith({ padCurve: "linear" });
  });

  it("speaks Polish with the Polish setting", () => {
    openTab({ locale: "pl", padCurve: "precise", padSensitivity: 1.5 });
    expect(slider("Czułość pada").value).toBe("1.5");
    expect(screen.getByText("1,5×")).toBeTruthy();
    expect(slider("Martwa strefa gałek")).toBeTruthy();
    const curve = screen.getByRole("radiogroup", { name: "Krzywa reakcji" });
    expect(within(curve).getByRole("radio", { name: "Precyzyjna" }).getAttribute("aria-checked")).toBe("true");
    expect(within(curve).getByRole("radio", { name: "Liniowa" })).toBeTruthy();
    expect(within(curve).getByRole("radio", { name: "Klasyczna" })).toBeTruthy();
  });
});
