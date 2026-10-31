// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CREDITS, DEFAULT_SETTINGS, GameUi, type UiIntents, type UiState, createUiStore } from "../src";

/** The credits screen (ADR-0063): one list of models and sounds, on the title screen and in the pause menu. */

const intents = (): UiIntents => new Proxy({}, { get: () => vi.fn() }) as UiIntents;

const mount = (state: Partial<UiState>) => render(<GameUi store={createUiStore(state)} intents={intents()} />);

afterEach(cleanup);

describe("credits", () => {
  it("lists every entry of the credits with its author and licence, CC-BY ones marked as changed", () => {
    mount({ screen: "title" });
    fireEvent.click(screen.getByRole("button", { name: "Credits" }));
    const credits = screen.getByTestId("credits");
    for (const c of CREDITS) {
      const row = credits.querySelector(`[data-credit="${c.id}"]`);
      expect(row, c.id).not.toBeNull();
      expect(row!.textContent).toContain(c.title);
      expect(row!.textContent).toContain(c.author);
    }
    const pole = credits.querySelector('[data-credit="sketchfab-electric-pole"]')!;
    expect(pole.textContent).toBe("Electric pole by Eh (Just_Eh) · CC BY 4.0 · changed for the game");
    const links = [...pole.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(links).toEqual(["https://sketchfab.com/3d-models/electric-pole-a41cc931ffd84947b8f7b566acc33384", "https://sketchfab.com/Just_Eh", "https://creativecommons.org/licenses/by/4.0/"]);
    for (const a of pole.querySelectorAll("a")) expect(a.getAttribute("target")).toBe("_blank");
    // The map data stays credited.
    expect(credits.textContent).toContain("Open Database License");
    fireEvent.click(within(credits).getByRole("button", { name: "Back" }));
    expect(screen.queryByTestId("credits")).toBeNull();
    expect(screen.getByRole("button", { name: "New Game" })).toBeTruthy();
  });

  it("opens from the pause menu and goes back to it", () => {
    mount({ screen: "paused" });
    fireEvent.click(screen.getByRole("button", { name: "Credits" }));
    const credits = screen.getByTestId("credits");
    expect(within(credits).getByTestId("credits-street").textContent).toContain("Robotic Animal by igor.tesV");
    fireEvent.click(within(credits).getByRole("button", { name: "Back" }));
    expect(screen.queryByTestId("credits")).toBeNull();
    expect(screen.getByRole("button", { name: "Resume" })).toBeTruthy();
  });

  it("speaks Polish around the names, which stay as written", () => {
    mount({ screen: "title", settings: { ...DEFAULT_SETTINGS, locale: "pl" } });
    fireEvent.click(screen.getByRole("button", { name: "Autorzy" }));
    const street = screen.getByTestId("credits-street");
    expect(street.querySelector("h4")!.textContent).toBe("Rekwizyty ulic");
    expect(street.querySelector('[data-credit="sketchfab-robotic-animal"]')!.textContent).toBe("Robotic Animal autor: igor.tesV · CC BY 4.0 · zmienione na potrzeby gry");
  });
});
