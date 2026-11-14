// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_GRAPHICS, DEFAULT_SETTINGS, GameUi, type GraphicsUiState, type SettingsVm, type UiIntents, createUiStore } from "../src";

/** The High effects' switches under the quality choice (graphics toggles 14.11). */
const intents = (): UiIntents & Record<string, ReturnType<typeof vi.fn>> => {
  const spies: Record<string | symbol, ReturnType<typeof vi.fn>> = {};
  return new Proxy(spies, { get: (t, k) => (t[k] ??= vi.fn()) }) as UiIntents & Record<string, ReturnType<typeof vi.fn>>;
};

const OFF_QUALITY: GraphicsUiState["graphicsEffects"] = { contactShade: { available: false, on: false }, bloom: { available: false, on: false } };

const openSettings = (graphicsEffects = DEFAULT_GRAPHICS.graphicsEffects, patch: Partial<SettingsVm> = {}) => {
  const i = intents();
  render(<GameUi store={createUiStore({ screen: "paused", settings: { ...DEFAULT_SETTINGS, ...patch }, graphicsEffects })} intents={i} />);
  fireEvent.click(screen.getByText(patch.locale === "pl" ? "Ustawienia" : "Settings"));
  return i;
};

const group = (name: string) => screen.getByRole("radiogroup", { name });
const radio = (g: string, name: string) => within(group(g)).getByRole("radio", { name }) as HTMLButtonElement;

afterEach(cleanup);

describe("graphics switches (graphics toggles 14.11)", () => {
  it("shows contact shade and bloom on under High, applying at once", () => {
    openSettings();
    expect(radio("Contact shade", "On").getAttribute("aria-checked")).toBe("true");
    expect(radio("Bloom", "On").getAttribute("aria-checked")).toBe("true");
    expect(radio("Bloom", "Off").disabled).toBe(false);
    expect(screen.getByTestId("graphics-effects-note").textContent).toMatch(/at once/);
  });

  it("hands each switch to the graphics intent", () => {
    const i = openSettings();
    fireEvent.click(radio("Contact shade", "Off"));
    expect(i.setGraphicsEffect).toHaveBeenCalledWith("contactShade", false);
    fireEvent.click(radio("Bloom", "Off"));
    expect(i.setGraphicsEffect).toHaveBeenCalledWith("bloom", false);
    expect(i.changeSettings).not.toHaveBeenCalled();
  });

  it("shows a switched-off effect as off", () => {
    openSettings({ ...DEFAULT_GRAPHICS.graphicsEffects, bloom: { available: true, on: false } });
    expect(radio("Bloom", "Off").getAttribute("aria-checked")).toBe("true");
    expect(radio("Contact shade", "On").getAttribute("aria-checked")).toBe("true");
  });

  it("keeps both off and inactive on a quality without them, saying why", () => {
    const i = openSettings(OFF_QUALITY, { quality: "medium" });
    for (const g of ["Contact shade", "Bloom"]) {
      expect(radio(g, "Off").getAttribute("aria-checked")).toBe("true");
      expect(radio(g, "On").disabled).toBe(true);
      expect(radio(g, "Off").disabled).toBe(true);
      expect(group(g).getAttribute("aria-disabled")).toBe("true");
    }
    fireEvent.click(radio("Bloom", "On"));
    expect(i.setGraphicsEffect).not.toHaveBeenCalled();
    expect(screen.getByTestId("graphics-effects-note").textContent).toMatch(/only drawn on High/);
  });

  it("speaks Polish with the Polish setting", () => {
    openSettings(OFF_QUALITY, { locale: "pl", quality: "low" });
    expect(radio("Cień kontaktowy", "Nie").getAttribute("aria-checked")).toBe("true");
    expect(radio("Poświata (bloom)", "Tak").disabled).toBe(true);
    expect(screen.getByTestId("graphics-effects-note").textContent).toMatch(/tylko na wysokiej jakości/);
  });
});
