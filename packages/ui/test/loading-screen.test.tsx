// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, GameUi, type UiIntents, createUiStore } from "../src";

/** The loading screen of ADR-0057: a bar and the stage under way, in the player's language. */

const intents = (): UiIntents => new Proxy({}, { get: () => vi.fn() }) as UiIntents;

afterEach(cleanup);

describe("loading screen", () => {
  it("shows the share done and the stage under way, without the HUD", () => {
    render(<GameUi store={createUiStore({ screen: "loading", loading: { progress: 0.424, stage: "city" } })} intents={intents()} />);
    expect(screen.getByTestId("loading-screen")).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("42");
    expect(screen.getByTestId("loading-stage").textContent).toBe("Streets round you");
    expect(screen.queryByTestId("hud")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("speaks Polish with the Polish setting", () => {
    const store = createUiStore({ screen: "loading", loading: { progress: 1, stage: "shaders" }, settings: { ...DEFAULT_SETTINGS, locale: "pl" } });
    render(<GameUi store={store} intents={intents()} />);
    expect(screen.getByRole("heading").textContent).toBe("Wczytywanie");
    expect(screen.getByTestId("loading-stage").textContent).toBe("Shadery");
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("100");
  });

  it("follows the store and clamps what it is given", () => {
    const store = createUiStore({ screen: "loading" });
    render(<GameUi store={store} intents={intents()} />);
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("0");
    expect(screen.getByTestId("loading-stage").textContent?.trim()).toBe("");
    store.setState({ loading: { progress: 1.7, stage: "models" } });
    return Promise.resolve().then(() => {
      expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("100");
      expect(screen.getByTestId("loading-stage").textContent).toBe("Characters and weapons");
    });
  });

  it("is gone once the game plays", () => {
    render(<GameUi store={createUiStore({ screen: "playing" })} intents={intents()} />);
    expect(screen.queryByTestId("loading-screen")).toBeNull();
  });
});
