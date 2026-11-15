// @vitest-environment jsdom
import { cleanup, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CREDITS, type Credit, DEFAULT_SETTINGS, GameUi, LICENSES, type UiIntents, type UiState, createUiStore } from "../src";
import { useCredits } from "../src/credits/use-credits";
import { en } from "../src/i18n/en";
import { UiContext } from "../src/use-ui";

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
      const license = LICENSES[c.license];
      expect(row!.textContent, `${c.id} shows its licence`).toContain("name" in license ? license.name : en[license.key]);
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

  it("names the game's own work in the player's language, without links", () => {
    mount({ screen: "title" });
    fireEvent.click(screen.getByRole("button", { name: "Credits" }));
    const icon = screen.getByTestId("credits-app");
    expect(icon.querySelector("h4")!.textContent).toBe("App icon");
    const row = icon.querySelector('[data-credit="seki-senshi-app-icon"]')!;
    expect(row.textContent).toBe("Seki Senshi by Seki Senshi · the game's own work");
    expect(row.querySelectorAll("a")).toHaveLength(0);
  });

  it("shows a non-commercial licence with its deed, and a VRoid Hub model with its author's terms, in both languages", () => {
    const made = (over: Partial<Credit>): Credit => ({ id: "x", section: "characters", title: "Girl", author: "Someone", url: "https://hub.vroid.com/m", license: "CC0-1.0", files: [], changed: true, ...over });
    const list = [made({ id: "nc", license: "CC-BY-NC-4.0" }), made({ id: "sa", license: "CC-BY-NC-SA-4.0" }), made({ id: "hub", license: "VRoid-Hub-NC", licenseUrl: "https://hub.vroid.com/terms" })];
    const rows = (locale: "en" | "pl") => {
      const store = createUiStore({ settings: { ...DEFAULT_SETTINGS, locale } });
      const wrapper = ({ children }: { children: ReactNode }) => <UiContext.Provider value={{ store, intents: intents() }}>{children}</UiContext.Provider>;
      return renderHook(() => useCredits(list), { wrapper }).result.current.flatMap((g) => g.rows.map((r) => [r.license, r.licenseUrl]));
    };
    expect(rows("en")).toEqual([
      ["CC BY-NC 4.0", "https://creativecommons.org/licenses/by-nc/4.0/"],
      ["CC BY-NC-SA 4.0", "https://creativecommons.org/licenses/by-nc-sa/4.0/"],
      ["VRoid Hub, author's terms: non-commercial use", "https://hub.vroid.com/terms"],
    ]);
    expect(rows("pl")[2]).toEqual(["VRoid Hub, warunki autora: użycie niekomercyjne", "https://hub.vroid.com/terms"]);
  });

  it("speaks Polish around the names, which stay as written", () => {
    mount({ screen: "title", settings: { ...DEFAULT_SETTINGS, locale: "pl" } });
    fireEvent.click(screen.getByRole("button", { name: "Autorzy" }));
    const street = screen.getByTestId("credits-street");
    expect(street.querySelector("h4")!.textContent).toBe("Rekwizyty ulic");
    expect(street.querySelector('[data-credit="sketchfab-robotic-animal"]')!.textContent).toBe("Robotic Animal autor: igor.tesV · CC BY 4.0 · zmienione na potrzeby gry");
  });
});
