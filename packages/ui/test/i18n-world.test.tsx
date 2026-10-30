// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Locale } from "@seki/core";
import { DEFAULT_SETTINGS, type UiIntents, type UiState, type UiStore, createUiStore, patchUi } from "../src";
import { BreachPanel } from "../src/breach/breach-panel";
import { CityMapPanel } from "../src/citymap/city-map-panel";
import { DialoguePanel } from "../src/dialogue/dialogue-panel";
import { JournalPanel } from "../src/journal/journal-panel";
import { SaveSlots } from "../src/menus/save-slots";
import { MetroMap, MetroRide } from "../src/metro/metro-panel";
import { PhonePanel } from "../src/phone/phone";
import { UiContext } from "../src/use-ui";

/**
 * The world panels in both languages (ADR-0056, stage 2b): English by default, Polish word for
 * word as before once chosen, switched in place. Names of Lublin and of the stations stay as
 * they are in both.
 */

const intents = (): UiIntents => {
  const spies = new Map<PropertyKey, unknown>();
  return new Proxy({}, { get: (_, key) => spies.get(key) ?? spies.set(key, vi.fn()).get(key) }) as UiIntents;
};

const mount = (node: React.ReactNode, state: Partial<UiState> = {}): UiStore => {
  const store = createUiStore({ screen: "playing", ...state });
  render(<UiContext.Provider value={{ store, intents: intents() }}>{node}</UiContext.Provider>);
  return store;
};

const speak = (store: UiStore, locale: Locale) => act(() => patchUi(store, { settings: { ...store.getState().settings, locale } }));

afterEach(cleanup);

describe("journal", () => {
  const journal: UiState["journal"] = {
    quests: [{ id: "contract-c2", title: "Kontrakt 2 · Kaito", kind: "contract", status: "active", tracked: true, pinned: false, steps: [{ objective: "Zneutralizuj gangerów", done: false }] }],
    memories: [],
  };

  it("labels the tabs and entries in English, then in Polish; titles and objectives stay as given", () => {
    const store = mount(<JournalPanel />, { journal });
    expect(screen.getByRole("heading", { name: "Journal" })).toBeTruthy();
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Active 1", "Completed 0", "Memories 0"]);
    const entry = screen.getByTestId("journal-quest-contract-c2");
    expect(entry.textContent).toContain("Contract");
    expect(entry.textContent).toContain("Kontrakt 2 · Kaito");
    expect(screen.getByTestId("journal-track-contract-c2").textContent).toBe("On HUD · pin");
    expect(screen.getByText(/close/).textContent).toBe("J close · I inventory · Tab character");
    speak(store, "pl");
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["W toku 1", "Ukończone 0", "Wspomnienia 0"]);
    expect(screen.getByRole("heading", { name: "Dziennik" })).toBeTruthy();
    expect(screen.getByTestId("journal-track-contract-c2").textContent).toBe("Na HUD · przypnij");
    expect(screen.getByText(/zamknij/).textContent).toBe("J zamknij · I ekwipunek · Tab karta postaci");
    fireEvent.click(screen.getByRole("tab", { name: /Ukończone/ }));
    expect(screen.getByText("Jeszcze nic nie skończyłaś.")).toBeTruthy();
  });
});

describe("map tab", () => {
  const map: UiState["map"] = { bounds: { x: 0, z: 0, w: 100, d: 100 }, blocks: [], streets: [], places: [{ name: "Stare Miasto", x: 10, z: 10 }] };

  it("names the tools and the credit in the chosen language, and the districts as they are", () => {
    const store = mount(<CityMapPanel />, { map, mapPlayer: { x: 0, z: 0, yaw: 0 } });
    expect(screen.getByRole("img", { name: "Map of Lublin" })).toBeTruthy();
    expect(screen.getByLabelText("Zoom in")).toBeTruthy();
    expect(screen.getByText("Me")).toBeTruthy();
    expect(screen.getByTestId("map-attribution").textContent).toBe("Map data © OpenStreetMap contributors (ODbL) · terrain: GUGiK NMT");
    speak(store, "pl");
    expect(screen.getByRole("img", { name: "Mapa Lublina" })).toBeTruthy();
    expect(screen.getByLabelText("Przybliż")).toBeTruthy();
    expect(screen.getByLabelText("Oddal")).toBeTruthy();
    expect(screen.getByText("Ja")).toBeTruthy();
    expect(screen.getByText("Stare Miasto")).toBeTruthy();
    expect(screen.getByTestId("map-attribution").textContent).toBe("Dane mapy © OpenStreetMap contributors (ODbL) · teren: GUGiK NMT");
  });

  it("says when there is no map", () => {
    const store = mount(<CityMapPanel />);
    expect(screen.getByText("No map.")).toBeTruthy();
    speak(store, "pl");
    expect(screen.getByText("Brak mapy.")).toBeTruthy();
  });
});

describe("metro", () => {
  const metroMap: UiState["metroMap"] = {
    line: "Kanjō Line",
    from: "kanal",
    refusal: null,
    stops: [
      { id: "kanal", name: "Brama Krakowska", fare: 0, here: true },
      { id: "doki", name: "Nabrzeże Bystrzycy", fare: 1250, here: false },
      { id: "targ", name: "Plac Zamkowy", fare: 25, here: false },
    ],
  };

  it("sells tickets in English with en-GB amounts, in Polish as before; the station names stay", () => {
    const store = mount(<MetroMap />, { metroMap, eddies: 30 });
    expect(screen.getByRole("dialog", { name: "Metro map" })).toBeTruthy();
    expect(screen.getByText("Ticket kiosk")).toBeTruthy();
    expect(screen.getByTestId("metro-stop-kanal").textContent).toBe("Brama KrakowskaYou are here");
    expect(screen.getByRole("button", { name: "Ticket to: Plac Zamkowy, 25 €$" }).textContent).toBe("Ticket · 25 €$");
    expect(screen.getByRole("button", { name: "Ticket to: Nabrzeże Bystrzycy, 1,250 €$" }).textContent).toBe("Not enough money · 1,250 €$");
    expect(screen.getByText("Leave the kiosk")).toBeTruthy();
    speak(store, "pl");
    expect(screen.getByRole("dialog", { name: "Mapa metra" })).toBeTruthy();
    expect(screen.getByTestId("metro-stop-kanal").textContent).toBe("Brama KrakowskaJesteś tutaj");
    const fare = (1250).toLocaleString("pl-PL");
    expect(screen.getByRole("button", { name: `Bilet do: Nabrzeże Bystrzycy, ${fare} €$` }).textContent).toBe(`Brak środków · ${fare} €$`);
    expect(screen.getByRole("button", { name: "Bilet do: Plac Zamkowy, 25 €$" }).textContent).toBe("Bilet · 25 €$");
    expect(screen.getByText("Odejdź od kiosku")).toBeTruthy();
  });

  it("labels the ride's progress", () => {
    const store = mount(<MetroRide />, { metroRide: { line: "Kanjō Line", fromName: "Brama Krakowska", toName: "Plac Zamkowy", progress: 0.5, caption: null } });
    expect(screen.getByRole("progressbar", { name: "Ride progress" })).toBeTruthy();
    speak(store, "pl");
    expect(screen.getByRole("progressbar", { name: "Postęp przejazdu" })).toBeTruthy();
  });
});

describe("phone and radio", () => {
  it("speaks English by default and Polish when chosen; station names stay", () => {
    const store = mount(<PhonePanel />, { phoneOpen: true });
    const phone = screen.getByRole("dialog", { name: "Phone" });
    expect(phone.textContent).toContain("No messages.");
    expect(screen.getByLabelText("Close phone")).toBeTruthy();
    const radio = screen.getByRole("radiogroup", { name: "Radio station" });
    expect(within(radio).getAllByRole("radio").map((r) => r.textContent)).toEqual(["Neon Drift 88.1synthwave", "Yoru FM 76.5city pop", "Tessen Info 24corporate news", "Offsilence"]);
    speak(store, "pl");
    expect(screen.getByRole("dialog", { name: "Telefon" }).textContent).toContain("Brak wiadomości.");
    expect(screen.getByLabelText("Zamknij telefon")).toBeTruthy();
    const stacje = screen.getByRole("radiogroup", { name: "Stacja radiowa" });
    expect(within(stacje).getAllByRole("radio").map((r) => r.textContent)).toEqual([
      "Neon Drift 88.1synthwave",
      "Yoru FM 76.5city pop",
      "Tessen Info 24wiadomości korporacji",
      "Wyłączonecisza",
    ]);
  });

  it("counts unread messages in the chosen language", () => {
    const thread = { from: "kaito", contact: "Kaito", unread: 2, messages: [{ id: 1, from: "kaito", contact: "Kaito", kind: "text" as const, priority: "contract" as const, time: "22:10", lines: [{ speaker: null, text: "Robota." }] }] };
    const store = mount(<PhonePanel />, { phoneOpen: true, phone: { threads: [thread], unread: 2 } });
    expect(screen.getByLabelText("Unread: 2")).toBeTruthy();
    expect(screen.getByRole("tablist", { name: "Contacts" })).toBeTruthy();
    speak(store, "pl");
    expect(screen.getByLabelText("Nieprzeczytane: 2")).toBeTruthy();
    expect(screen.getByRole("tablist", { name: "Kontakty" })).toBeTruthy();
  });
});

describe("breach", () => {
  it("names the game, the daemons and the buttons in the chosen language", () => {
    const store = mount(<BreachPanel rng={() => 0.3} />, { breach: { terminalKey: "t", daemons: ["icepick", "datamine", "mass_vulnerability"] } });
    expect(screen.getByRole("dialog", { name: "Terminal breach" })).toBeTruthy();
    expect(screen.getByTestId("breach-timer").textContent).toBe("30 s · starts on the first pick");
    expect(screen.getByTestId("breach-daemon-datamine").textContent).toContain("DatamineEddies from the network's accounts");
    expect(screen.getByTestId("breach-cell-0-0").getAttribute("aria-label")).toMatch(/^\w\w, row 1, column 1$/);
    expect(screen.getByText("Auto-solve (1 daemon)").getAttribute("title")).toBe("Uploads one daemon at most");
    speak(store, "pl");
    expect(screen.getByRole("dialog", { name: "Włamanie do terminala" })).toBeTruthy();
    expect(screen.getByTestId("breach-timer").textContent).toBe("30 s · start po 1. wyborze");
    expect(screen.getByTestId("breach-daemon-mass_vulnerability").textContent).toContain("Masowa podatnośćOchrona sieci słabnie");
    expect(screen.getByTestId("breach-cell-0-0").getAttribute("aria-label")).toMatch(/^\w\w, wiersz 1, kolumna 1$/);
    expect(screen.getByText("Bufor")).toBeTruthy();
    fireEvent.click(screen.getByTestId("breach-cell-0-0"));
    expect(screen.getByTestId("breach-cell-0-0").getAttribute("aria-label")).toMatch(/^\w\w, wiersz 1, kolumna 1, użyty$/);
    expect(screen.getByText("Odłącz")).toBeTruthy();
  });
});

describe("dialogue", () => {
  it("translates the interface around the talk and never the ink text", () => {
    const store = mount(<DialoguePanel />, { dialogue: { lines: [{ speaker: "Kaito", text: "Robota czeka." }], choices: [{ index: 0, text: "Biorę.", tone: "main" }], ended: false } });
    expect(screen.getByRole("group", { name: "Reply" })).toBeTruthy();
    expect(screen.getByRole("log", { name: "Conversation" }).textContent).toContain("Robota czeka.");
    expect(screen.getByRole("button", { name: /Biorę\..*main story/ })).toBeTruthy();
    speak(store, "pl");
    expect(screen.getByRole("button", { name: /Biorę\..*wątek główny/ })).toBeTruthy();
    act(() => patchUi(store, { dialogue: { lines: [], choices: [], ended: true } }));
    expect(screen.getByRole("button", { name: /Zakończ rozmowę/ })).toBeTruthy();
    speak(store, "en");
    expect(screen.getByRole("button", { name: /End conversation.*leave/ })).toBeTruthy();
  });
});

describe("save slots", () => {
  // The app writes the date into the label when it saves (en-GB or pl-PL, see the app's test).
  const slots: UiState["slots"] = [
    { slot: "slot-1", savedAtLabel: "30/10, 19:17", objective: "Wróć do Kaito" },
    { slot: "slot-2", savedAtLabel: "30.10, 19:17", objective: "Wróć do Kaito" },
    { slot: "slot-3", savedAtLabel: "—", objective: "save.corrupt" },
  ];

  it("shows each slot's date as it was saved and says a corrupt slot in the chosen language", () => {
    const store = mount(<SaveSlots mode="load" />, { slots });
    const metas = () => [...document.querySelectorAll(".slots__meta")].map((m) => m.textContent);
    expect(metas()).toEqual(["30/10, 19:17 · Wróć do Kaito", "30.10, 19:17 · Wróć do Kaito", "— · Corrupted save"]);
    speak(store, "pl");
    expect(metas()).toEqual(["30/10, 19:17 · Wróć do Kaito", "30.10, 19:17 · Wróć do Kaito", "— · Uszkodzony zapis"]);
  });

  it("is English by default", () => {
    expect(DEFAULT_SETTINGS.locale).toBe("en");
  });
});
