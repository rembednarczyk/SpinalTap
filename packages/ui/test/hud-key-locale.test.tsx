// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, GameUi, type UiIntents, type UiState, createUiStore } from "../src";

/** The HUD names keys in the player's language (ADR-0056): "Mouse" in English, "Mysz" in Polish. */

const intents = (): UiIntents => new Proxy({}, { get: () => vi.fn() }) as UiIntents;

const mount = (locale: "en" | "pl", state: Partial<UiState> = {}) =>
  render(<GameUi store={createUiStore({ screen: "playing", settings: { ...DEFAULT_SETTINGS, locale }, ...state })} intents={intents()} />);

const hud = (): Partial<UiState> => ({
  hint: { id: "move", keys: ["KeyW", "MouseMove"], text: "move and look around" },
  dash: { cooldown: 0, total: 1.2 },
  controls: [{ action: "dash", label: "Dash", codes: ["Space"] }],
  prompt: "Talk",
});

afterEach(cleanup);

describe("HUD key names", () => {
  it("are English with the English setting", () => {
    mount("en", hud());
    expect(screen.getByTestId("hint").textContent).toContain("Mouse");
    expect(screen.getByTestId("hint").textContent).not.toContain("Mysz");
    expect(screen.getByTestId("dash").textContent).toBe("Space");
  });

  it("stay Polish with the Polish setting", () => {
    mount("pl", hud());
    expect(screen.getByTestId("hint").textContent).toContain("Mysz");
    expect(screen.getByTestId("dash").textContent).toBe("Spacja");
  });
});
