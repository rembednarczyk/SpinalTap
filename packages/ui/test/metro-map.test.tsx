// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Locale } from "@seki/core";
import { type MapVm, type UiIntents, type UiState, type UiStore, createUiStore, patchUi } from "../src";
import { CityMapPanel } from "../src/citymap/city-map-panel";
import { Minimap } from "../src/hud/minimap";
import { MetroMap } from "../src/metro/metro-panel";
import { stepStop } from "../src/metro/use-metro-kiosk";
import { UiContext } from "../src/use-ui";
import { METRO_LAYER, kioskVm } from "./metro-fixture";

/** The metro line as a layer (ADR-0071 stage 1): the maps, the kiosk's route and card, a ticket in two steps. */

const intents = () => {
  const spies: Record<string | symbol, ReturnType<typeof vi.fn>> = {};
  return new Proxy(spies, { get: (t, k) => (t[k] ??= vi.fn()) }) as UiIntents & Record<string, ReturnType<typeof vi.fn>>;
};

const MAP: MapVm = { bounds: { x: 1200, z: 150, w: 3000, d: 800 }, blocks: [], streets: [], metro: METRO_LAYER };

const mount = (node: React.ReactNode, state: Partial<UiState> = {}): { store: UiStore; i: ReturnType<typeof intents> } => {
  const store = createUiStore({ screen: "playing", map: MAP, ...state });
  const i = intents();
  render(<UiContext.Provider value={{ store, intents: i }}>{node}</UiContext.Provider>);
  return { store, i };
};

const speak = (store: UiStore, locale: Locale) => act(() => patchUi(store, { settings: { ...store.getState().settings, locale } }));

afterEach(cleanup);

describe("the metro layer on the maps", () => {
  it("draws the line, the stations and the possible ones on the map tab, and the tool button hides it", () => {
    mount(<CityMapPanel />, { mapPlayer: { x: 490, z: -70, yaw: 0 } });
    expect(screen.getByTestId("metro-layer")).toBeTruthy();
    expect(screen.getAllByTestId(/^metro-station-/)).toHaveLength(4);
    expect(document.querySelectorAll(".metro-layer__leg")).toHaveLength(3);
    // A possible station: dashed, hollow, "under construction" with its distance, and no ticket anywhere.
    const saski = screen.getByTestId("metro-planned-ogrod-saski");
    expect(saski.querySelector(".metro-layer__dash")).toBeTruthy();
    expect(saski.textContent).toContain("under construction · 1.0 km");
    expect(saski.querySelector("title")?.textContent).toBe("Ogród Saski: under construction, 1.0 km from Plac Litewski");
    const toggle = screen.getByRole("button", { name: "Metro line on the map" });
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(toggle);
    expect(screen.queryByTestId("metro-layer")).toBeNull();
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
  });

  it("writes the possible station's distance as the language does", () => {
    const { store } = mount(<CityMapPanel />, { mapPlayer: { x: 490, z: -70, yaw: 0 } });
    speak(store, "pl");
    expect(screen.getByTestId("metro-planned-lublin-glowny").textContent).toContain("w budowie · 2,0 km");
    expect(screen.getByRole("button", { name: "Linia metra na mapie" })).toBeTruthy();
  });

  it("puts only the entrances on the minimap", () => {
    mount(<Minimap />, { mapPlayer: { x: 490, z: -70, yaw: 0 } });
    expect(screen.getAllByTestId(/^minimap-metro-/)).toHaveLength(4);
    expect(screen.getByTestId("minimap-metro-kanal").querySelector("title")?.textContent).toBe("Metro entrance: Brama Krakowska A");
    expect(screen.queryByTestId("metro-layer")).toBeNull();
  });

  it("draws nothing of the metro on a map without it", () => {
    mount(<CityMapPanel />, { map: { ...MAP, metro: undefined }, mapPlayer: { x: 0, z: 0, yaw: 0 } });
    expect(screen.queryByTestId("metro-layer")).toBeNull();
    expect(screen.queryByTestId("citymap-metro")).toBeNull();
  });
});

describe("the kiosk", () => {
  it("asks for a destination first: no route, no card and the ticket disabled", () => {
    mount(<MetroMap />, { metroMap: kioskVm("kanal"), eddies: 100 });
    expect(screen.getByTestId("metro-chart")).toBeTruthy();
    expect(screen.queryByTestId("metro-preview")).toBeNull();
    expect((screen.getByTestId("metro-buy") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId("metro-buy").textContent).toBe("Buy ticket");
    expect(document.querySelectorAll(".metro-layer__leg--route")).toHaveLength(0);
  });

  it("chooses with a click on the list, a tap on the map's ring and the arrows", () => {
    const { i } = mount(<MetroMap />, { metroMap: kioskVm("kanal"), eddies: 100 });
    fireEvent.click(screen.getByRole("button", { name: /Destination: Plac Zamkowy/ }));
    expect(i.selectMetroStop).toHaveBeenLastCalledWith("targ");
    fireEvent.click(screen.getByTestId("metro-station-doki"));
    expect(i.selectMetroStop).toHaveBeenLastCalledWith("doki");
    fireEvent.keyDown(window, { code: "ArrowDown" });
    expect(i.selectMetroStop).toHaveBeenLastCalledWith("shinsekai");
    fireEvent.keyDown(window, { code: "KeyE" });
    expect(i.closeMetro).toHaveBeenCalled();
    expect(i.buyMetroTicket).not.toHaveBeenCalled();
  });

  it("steps the arrows past the platform and stops at the ends", () => {
    expect(stepStop(kioskVm("kanal"), 1)).toBe("shinsekai");
    expect(stepStop(kioskVm("kanal"), -1)).toBe("doki");
    expect(stepStop(kioskVm("kanal", "shinsekai"), 1)).toBe("targ");
    expect(stepStop(kioskVm("kanal", "doki"), 1)).toBeNull();
    expect(stepStop(kioskVm("kanal", "targ"), -1)).toBe("shinsekai");
  });

  it("lights the route, lists the stops on the way and shows the card of the destination", () => {
    const { i } = mount(<MetroMap />, { metroMap: kioskVm("shinsekai", "targ"), eddies: 100 });
    // Two legs of three: Plac Litewski – Brama Krakowska – Plac Zamkowy.
    expect(document.querySelectorAll(".metro-layer__leg--route").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByTestId("metro-station-kanal").getAttribute("class")).toContain("--route");
    expect(screen.getByTestId("metro-stop-kanal").className).toContain("metro__stop--route");
    expect(screen.getByRole("button", { name: /Destination: Plac Zamkowy/ }).getAttribute("aria-pressed")).toBe("true");
    const card = screen.getByTestId("metro-preview");
    expect(within(card).getByRole("heading", { name: "Plac Zamkowy" })).toBeTruthy();
    expect(card.textContent).toContain("Podzamcze");
    expect(screen.getByTestId("metro-route").textContent).toBe("Stops: 2 · 9 s · 25 €$");
    expect(screen.getByTestId("metro-via").textContent).toBe("On the way: Brama Krakowska");
    expect(card.textContent).toContain("Entrance A · Plac Zamkowy");
    expect(screen.getByTestId("metro-preview-map")).toBeTruthy();
    const near = within(screen.getByTestId("metro-near")).getAllByRole("listitem").map((li) => li.textContent);
    expect(near).toEqual(["1. Oyaji's stall60 m", "2. Contracts · Hana70 m"]);
    fireEvent.click(screen.getByRole("button", { name: "Ticket to: Plac Zamkowy, 25 €$" }));
    expect(i.buyMetroTicket).toHaveBeenCalledTimes(1);
  });

  it("says when nothing is near and when the next stop has nothing on the way", () => {
    mount(<MetroMap />, { metroMap: kioskVm("kanal", "shinsekai"), eddies: 100 });
    expect(screen.getByTestId("metro-near-none").textContent).toBe("Nothing marked within 150 m.");
    expect(screen.getByTestId("metro-via").textContent).toBe("Next stop, nothing on the way");
  });

  it("lists the possible stations without a ticket", () => {
    mount(<MetroMap />, { metroMap: kioskVm("kanal", "targ"), eddies: 1000 });
    const planned = screen.getByTestId("metro-planned");
    expect(within(planned).getAllByRole("listitem").map((li) => li.getAttribute("aria-label"))).toEqual(["Ogród Saski: No ticket: the station isn't open yet", "Lublin Główny: No ticket: the station isn't open yet"]);
    expect(within(planned).queryByRole("button")).toBeNull();
    expect(screen.queryByRole("button", { name: /Ogród Saski|Lublin Główny/ })).toBeNull();
  });

  it("keeps the ticket shut while security watches the platform, and says so on the card", () => {
    mount(<MetroMap />, { metroMap: kioskVm("kanal", "targ", "Security is watching the platform."), eddies: 1000 });
    expect(screen.getByTestId("metro-preview-watched").textContent).toBe("Security is watching the platform.");
    expect((screen.getByTestId("metro-buy") as HTMLButtonElement).disabled).toBe(true);
  });

  it("refuses a ticket the wallet can't pay", () => {
    mount(<MetroMap />, { metroMap: kioskVm("kanal", "doki"), eddies: 10 });
    expect((screen.getByTestId("metro-buy") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId("metro-buy").textContent).toBe("Not enough money · 25 €$");
  });

  it("speaks Polish on the card, the names of Lublin stay", () => {
    const { store } = mount(<MetroMap />, { metroMap: kioskVm("shinsekai", "targ"), eddies: 100 });
    speak(store, "pl");
    expect(screen.getByTestId("metro-route").textContent).toBe("Przystanki: 2 · 9 s · 25 €$");
    expect(screen.getByTestId("metro-via").textContent).toBe("Po drodze: Brama Krakowska");
    expect(within(screen.getByTestId("metro-near")).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["1. Stragan Oyajiego60 m", "2. Zlecenia · Hana70 m"]);
    expect(screen.getByRole("button", { name: "Bilet do: Plac Zamkowy, 25 €$" }).textContent).toBe("Kup bilet · 25 €$");
  });

  it("works without the city map: the list, the card and the ticket stay", () => {
    mount(<MetroMap />, { map: null, metroMap: kioskVm("kanal", "targ"), eddies: 100 });
    expect(screen.queryByTestId("metro-chart")).toBeNull();
    expect(screen.getByTestId("metro-preview")).toBeTruthy();
    expect((screen.getByTestId("metro-buy") as HTMLButtonElement).disabled).toBe(false);
  });
});
